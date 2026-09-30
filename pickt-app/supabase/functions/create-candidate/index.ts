// Supabase Edge Function: create-candidate
// Handles the Refer form submission (and extension quick-add).
// Uses the service role key to insert into the candidates table.
//
// Repeat referrals: if the candidate's email or mobile matches someone already
// on Pickt, no new candidate is created. Instead this employer's interview is
// added to the existing profile (candidate_interviews) and the referrer earns
// points rather than a fee.
//
// Env: IDENTITY_HASH_SECRET — secret key for hashing email/mobile (set it with
//      `supabase secrets set IDENTITY_HASH_SECRET=<long random string>`).
//
// Deploy: supabase functions deploy create-candidate

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REPEAT_REFERRAL_POINTS = 100;

// ── Identity matching (email / mobile) ──────────────────────
// Only keyed hashes are stored for matching, so the raw values can't be
// looked up or compared from the database alone.

function normaliseEmail(email: unknown): string | null {
  const e = String(email ?? "").trim().toLowerCase();
  return e.includes("@") ? e : null;
}

// Digits only; Australian numbers compared by their last 9 digits so
// "+61 412 345 678", "0412 345 678" and "412345678" all match.
function normaliseMobile(mobile: unknown): string | null {
  const digits = String(mobile ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

async function identityHash(kind: "email" | "mobile", value: string | null): Promise<string | null> {
  if (!value) return null;
  const secret = Deno.env.get("IDENTITY_HASH_SECRET");
  if (!secret) throw new Error("IDENTITY_HASH_SECRET is not configured");
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${kind}:${value}`));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    "fee_percentage",
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

  // Email or mobile is needed to recognise the same person across referrals
  const email = normaliseEmail(body.email);
  const mobile = normaliseMobile(body.mobile_number);
  if (!email && !mobile) {
    return new Response(
      JSON.stringify({ error: "Candidate email or mobile number is required" }),
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
    employer_company_id: companyId,
    employer_industry: body.employer_industry || body.industry || null,
    employer_location: body.employer_location || body.location_city || null,
    stage_reached: body.interview_stage_reached,
    interviews_completed: body.interviews_completed ?? 0,
    feedback: body.feedback_summary || body.strengths || null,
    outcome_reason: body.why_not_hired || null,
  };

  // ── Repeat referral: same person already on Pickt ─────────
  const matchFilters = [
    emailHash ? `email_hash.eq.${emailHash}` : null,
    mobileHash ? `mobile_hash.eq.${mobileHash}` : null,
  ].filter(Boolean).join(",");

  const { data: existing } = await adminClient
    .from("candidates")
    .select("id")
    .or(matchFilters)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data: interview, error: interviewError } = await adminClient
      .from("candidate_interviews")
      .insert({ candidate_id: existing.id, ...interviewFields, is_original_referral: false })
      .select("id")
      .single();

    if (interviewError) {
      const alreadyReferred = interviewError.code === "23505";
      return new Response(
        JSON.stringify({
          error: alreadyReferred
            ? "Your company has already referred this candidate"
            : interviewError.message,
        }),
        { status: alreadyReferred ? 409 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: pointsError } = await adminClient.from("referral_points").insert({
      company_id: companyId,
      candidate_id: existing.id,
      interview_id: interview.id,
      points: REPEAT_REFERRAL_POINTS,
      reason: "repeat_referral",
    });
    if (pointsError) console.error("[create-candidate] points not recorded:", pointsError.message);

    return new Response(
      JSON.stringify({
        id: existing.id,
        success: true,
        merged: true,
        feeEligible: false,
        pointsAwarded: pointsError ? 0 : REPEAT_REFERRAL_POINTS,
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
      cv_file_url: body.cv_file_url,
      cv_filename: body.cv_filename || null,
      cover_letter_url: body.cover_letter_url || null,
      additional_documents: body.additional_documents || null,
      linkedin_url: body.linkedin_url || null,
      portfolio_url: body.portfolio_url || null,
      current_employer: body.current_employer || null,
      current_job_title: body.current_job_title || null,
      mobile_number: body.mobile_number || null,
      fee_percentage: body.fee_percentage,
    })
    .select("id")
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Their interview with this (first) employer
  const { error: firstInterviewError } = await adminClient
    .from("candidate_interviews")
    .insert({ candidate_id: data.id, ...interviewFields, is_original_referral: true });
  if (firstInterviewError) {
    console.error("[create-candidate] interview row not created:", firstInterviewError.message);
  }

  return new Response(JSON.stringify({ id: data.id, success: true, merged: false, feeEligible: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
