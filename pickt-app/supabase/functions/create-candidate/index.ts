// Supabase Edge Function: create-candidate
// Handles the Refer form submission (and extension quick-add).
// Uses the service role key to insert into the candidates table.
//
// Candidates are identified by email AND mobile: both are required, and a match
// on either one means it's the same person (so a different phone number can't
// get around the two-referrer limit). If the email matches one candidate and the
// mobile another, the referral stops and is logged for a Pickt admin to review.
//
// Repeat referrals: no new candidate is created. This employer's interview is
// added to the existing profile and they become the 2nd referrer. Once two
// referrers exist, further referrals are refused. The rules and rates live in
// the database (register_referral, commission_settings; see migration 030).
// The fee is set by the database, never taken from the request.
//
// Env: IDENTITY_HASH_SECRET — secret key for hashing email/mobile (set it with
//      `supabase secrets set IDENTITY_HASH_SECRET=<long random string>`).
//
// Deploy: supabase functions deploy create-candidate

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { identityHash, normaliseEmail, normaliseMobile } from "../_shared/identity.ts";
import { isAllowedUploadPath, storagePathFrom } from "../_shared/uploads.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Turns a register_referral error into a message for the referrer
function referralErrorResponse(dbMessage: string) {
  const known: Record<string, { status: number; error: string }> = {
    referrals_full: {
      status: 409,
      error: "Referrals are full – this candidate already has the maximum of two referrers, so new referrals can't earn commission. You can write a testimonial instead.",
    },
    already_referred: { status: 409, error: "Your company has already referred this candidate" },
    already_hired: { status: 409, error: "This candidate has already been hired, so they can't be referred." },
  };
  const code = Object.keys(known).find((k) => dbMessage.includes(k));
  if (!code) console.error("[create-candidate] referral failed:", dbMessage);
  return new Response(
    JSON.stringify(code ? { code, error: known[code].error } : { error: "Could not record this referral. Please try again." }),
    { status: code ? known[code].status : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verify the calling user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Client scoped to the calling user (for auth check)
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  // Admin client for privileged operations
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get company info
  const { data: userData } = await adminClient
    .from("users")
    .select("company_id, companies(name)")
    .eq("id", user.id)
    .single();

  if (!userData) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const companyId = userData.company_id;
  const companyName = (userData.companies as { name: string })?.name;

  const body = await req.json();

  // Required field validation
  const required = [
    "industry",
    "role_applied_for",
    "seniority_level",
    "location_city",
    "location_country",
    "preferred_work_type",
    "interview_stage_reached",
    "why_not_hired",
    "strengths",
    "gaps",
    "recommendation",
  ];

  for (const field of required) {
    if (!body[field]) {
      return new Response(
        JSON.stringify({ error: `Missing required field: ${field}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  if (!body.skills || body.skills.length === 0) {
    return new Response(
      JSON.stringify({ error: "At least one skill is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!body.cv_file_url) {
    return new Response(
      JSON.stringify({ error: "CV upload is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Documents must be this user's own uploads, otherwise cv-url could be used
  // to reach someone else's file
  const cvPath = storagePathFrom(body.cv_file_url);
  const coverLetterPath = storagePathFrom(body.cover_letter_url);
  const additionalDocuments = (Array.isArray(body.additional_documents) ? body.additional_documents : [])
    .map((d: { url?: unknown; filename?: unknown }) => ({ url: storagePathFrom(d?.url), filename: d?.filename ?? null }));

  const documentPaths = [cvPath, ...(body.cover_letter_url ? [coverLetterPath] : []), ...additionalDocuments.map((d: { url: string | null }) => d.url)];
  if (documentPaths.some((path) => !isAllowedUploadPath(path, user.id))) {
    return new Response(
      JSON.stringify({ error: "Please upload the documents again." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Email and mobile together identify a candidate across referrals
  const email = normaliseEmail(body.email);
  const mobile = normaliseMobile(body.mobile_number);
  if (!email || !mobile) {
    return new Response(
      JSON.stringify({ error: "Candidate email and mobile number are both required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let emailHash: string | null;
  let mobileHash: string | null;
  try {
    emailHash = await identityHash("email", email);
    mobileHash = await identityHash("mobile", mobile);
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // This employer's interview, as stored in candidate_interviews
  const interviewFields = {
    employer_industry: body.employer_industry || body.industry || null,
    employer_location: body.employer_location || body.location_city || null,
    stage_reached: body.interview_stage_reached,
    interviews_completed: body.interviews_completed ?? 0,
    feedback: body.feedback_summary || body.strengths || null,
    outcome_reason: body.why_not_hired || null,
  };

  // ── Repeat referral: same person already on Pickt ─────────
  const { data: matches, error: matchError } = await adminClient
    .from("candidates")
    .select("id, email_hash, mobile_hash")
    .or(`email_hash.eq.${emailHash},mobile_hash.eq.${mobileHash}`)
    .limit(10);

  if (matchError) {
    return new Response(JSON.stringify({ error: matchError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Email and mobile point at different people: a person needs to look at this
  if ((matches ?? []).length > 1) {
    const { error: reviewError } = await adminClient.from("referral_identity_reviews").insert({
      company_id: companyId,
      email_match_candidate_id: matches!.find((m) => m.email_hash === emailHash)?.id ?? null,
      mobile_match_candidate_id: matches!.find((m) => m.mobile_hash === mobileHash)?.id ?? null,
    });
    if (reviewError) console.error("[create-candidate] review not logged:", reviewError.message);

    return new Response(
      JSON.stringify({
        code: "needs_review",
        error: "This email and mobile number match different candidates on Pickt. Your referral hasn't been added. The Pickt team will review it. Please check the details are correct.",
      }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const existing = matches?.[0];

  if (existing) {
    const { data: referral, error: referralError } = await adminClient.rpc("register_referral", {
      p_candidate_id: existing.id,
      p_company_id: companyId,
      p_interview: interviewFields,
      p_is_original: false,
    });

    if (referralError) return referralErrorResponse(referralError.message);

    return new Response(
      JSON.stringify({
        id: existing.id,
        success: true,
        merged: true,
        referrerPosition: referral.position,
        referrerRate: referral.rate,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ── First referral: create the candidate ──────────────────
  const { data, error } = await adminClient
    .from("candidates")
    .insert({
      full_name: body.full_name || null,
      email: email,
      email_hash: emailHash,
      mobile_hash: mobileHash,
      last_active_at: new Date().toISOString(),
      open_to_offers: body.open_to_offers ?? true,
      uploaded_by_company_id: companyId,
      referring_company: companyName,
      pii_redacted: true,
      status: "available",
      source: "upload_form",
      consent_given: body.consent_given ?? true,
      referred_at: new Date().toISOString(),
      industry: body.industry,
      role_applied_for: body.role_applied_for,
      seniority_level: body.seniority_level,
      years_experience: body.years_experience || null,
      location_city: body.location_city,
      location_state: body.location_state || null,
      location_country: body.location_country,
      residency_status: body.residency_status || null,
      preferred_work_type: body.preferred_work_type,
      willing_to_relocate: body.willing_to_relocate ?? false,
      employment_type: body.employment_type || null,
      notice_period_days: body.notice_period_days || null,
      available_from: body.available_from || null,
      salary_expectation_min: body.salary_expectation_min || null,
      salary_expectation_max: body.salary_expectation_max || null,
      skills: body.skills,
      interview_stage_reached: body.interview_stage_reached,
      interviews_completed: body.interviews_completed ?? 0,
      why_not_hired: body.why_not_hired,
      strengths: body.strengths,
      gaps: body.gaps,
      feedback_summary: body.feedback_summary || null,
      recommendation: body.recommendation,
      interview_notes: body.interview_notes || null,
      skill_ratings: body.skill_ratings || null,
      cv_file_url: cvPath,
      cv_filename: body.cv_filename || null,
      cover_letter_url: coverLetterPath,
      additional_documents: additionalDocuments.length > 0 ? additionalDocuments : null,
      linkedin_url: body.linkedin_url || null,
      portfolio_url: body.portfolio_url || null,
      current_employer: body.current_employer || null,
      current_job_title: body.current_job_title || null,
      mobile_number: body.mobile_number || null,
    })
    .select("id")
    .single();

  if (error) {
    // Unique email/mobile: someone else referred this person a moment ago
    const message = error.code === "23505"
      ? "This candidate was just added to Pickt. Please submit again to be added as a referrer."
      : error.message;
    return new Response(JSON.stringify({ error: message }), {
      status: error.code === "23505" ? 409 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // This company becomes the 1st referrer, with their interview
  const { data: referral, error: firstReferralError } = await adminClient.rpc("register_referral", {
    p_candidate_id: data.id,
    p_company_id: companyId,
    p_interview: interviewFields,
    p_is_original: true,
  });

  if (firstReferralError) {
    // A candidate must never exist without a referrer, so undo the insert
    const { error: undoError } = await adminClient.from("candidates").delete().eq("id", data.id);
    if (undoError) console.error("[create-candidate] could not undo candidate:", undoError.message);
    return referralErrorResponse(firstReferralError.message);
  }

  return new Response(
    JSON.stringify({
      id: data.id,
      success: true,
      merged: false,
      referrerPosition: referral.position,
      referrerRate: referral.rate,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
