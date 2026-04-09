import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get company info
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("company_id, companies(name)")
    .eq("id", user.id)
    .single();

  if (userError || !userData) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  const companyId = userData.company_id;
  const companyName = (userData.companies as unknown as { name: string })?.name;

  const body = await request.json();

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
      return NextResponse.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  if (!body.skills || body.skills.length === 0) {
    return NextResponse.json(
      { error: "At least one skill is required" },
      { status: 400 }
    );
  }

  if (!body.cv_file_url) {
    return NextResponse.json(
      { error: "CV upload is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("candidates")
    .insert({
      uploaded_by_company_id: companyId,
      referring_company: companyName,
      pii_redacted: true,
      status: "available",
      source: "upload_form",
      consent_given: body.consent_given ?? true,
      referred_at: new Date().toISOString(),

      // Step 1
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

      // Step 2
      why_not_hired: body.why_not_hired,
      strengths: body.strengths,
      gaps: body.gaps,
      feedback_summary: body.feedback_summary || null,
      recommendation: body.recommendation,
      interview_notes: body.interview_notes || null,
      skill_ratings: body.skill_ratings || null,

      // Step 3
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, success: true });
}
