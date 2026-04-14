// Supabase Edge Function: create-candidate
// Handles the Refer form submission (and extension quick-add).
// Uses the service role key to insert into the candidates table.
//
// Deploy: supabase functions deploy create-candidate

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  const { data, error } = await adminClient
    .from("candidates")
    .insert({
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

  return new Response(JSON.stringify({ id: data.id, success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
