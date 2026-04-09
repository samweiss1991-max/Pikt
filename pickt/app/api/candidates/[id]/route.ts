import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { sanitizeCandidate } from "@/lib/sanitize-candidate";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get requesting user's company
  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch anonymised candidate from public view
  const { data: publicCandidate, error: pubError } = await supabase
    .from("candidates_public")
    .select("*")
    .eq("id", params.id)
    .single();

  if (pubError || !publicCandidate) {
    return NextResponse.json(
      { error: "Candidate not found" },
      { status: 404 }
    );
  }

  // Check if this company has an unlock
  const { data: unlock } = await supabase
    .from("candidate_unlocks")
    .select("id, status, unlocked_at")
    .eq("candidate_id", params.id)
    .eq("requesting_company_id", userData.company_id)
    .single();

  const unlocked = !!unlock && unlock.status === "approved";

  // Check if this is the uploading company (they see their own PII)
  const isOwner =
    publicCandidate.uploaded_by_company_id === userData.company_id;

  let candidate = publicCandidate;

  // Merge PII if unlocked or owner — use explicit column list, never SELECT *
  if (unlocked || isOwner) {
    const { data: fullCandidate } = await supabase
      .from("candidates")
      .select(
        [
          "id",
          "uploaded_by_company_id",
          "industry",
          "role_applied_for",
          "seniority_level",
          "years_experience",
          "skills",
          "employment_type",
          "salary_expectation_min",
          "salary_expectation_max",
          "notice_period_days",
          "available_from",
          "location_city",
          "location_state",
          "location_country",
          "residency_status",
          "preferred_work_type",
          "willing_to_relocate",
          "interview_stage_reached",
          "interviews_completed",
          "why_not_hired",
          "recommendation",
          "strengths",
          "gaps",
          "feedback_summary",
          "interview_notes",
          "skill_ratings",
          "fee_percentage",
          "pii_redacted",
          "status",
          "source",
          "referred_at",
          "referring_company",
          "created_at",
          // PII fields (revealed after unlock)
          "full_name",
          "email",
          "mobile_number",
          "linkedin_url",
          "portfolio_url",
          "current_employer",
          "current_job_title",
          "cv_filename",
          "cv_file_url",
          "cover_letter_url",
        ].join(",")
      )
      .eq("id", params.id)
      .single();

    if (fullCandidate) {
      candidate = fullCandidate;
    }
  }

  // Get referring company name
  const { data: referringCompany } = await supabase
    .from("companies")
    .select("name")
    .eq("id", publicCandidate.uploaded_by_company_id)
    .single();

  // Check if requesting company has ATS connected
  const { data: requestingCompany } = await supabase
    .from("companies")
    .select("ats_connection_id")
    .eq("id", userData.company_id)
    .single();

  // Sanitize: strip date_of_birth, gender, raw file paths, interviewer_name
  const sanitized = sanitizeCandidate(candidate) as Record<string, unknown>;

  // Add discriminant field on the candidate object itself
  sanitized.unlocked = unlocked || isOwner;

  // Add computed score fields (placeholder values for profile page —
  // real scores are only computed for ranked marketplace results)
  const referredAt = candidate.referred_at
    ? new Date(candidate.referred_at)
    : new Date();
  const daysAgo = Math.max(
    0,
    Math.floor((Date.now() - referredAt.getTime()) / 86400000)
  );
  sanitized.days_ago = daysAgo;
  sanitized.role_score = 0;
  sanitized.seniority_score = 0;
  sanitized.interview_score = Math.min(
    100,
    ((candidate.interviews_completed || 0) / 4) * 100
  );
  sanitized.recency_score =
    daysAgo <= 3 ? 100 : daysAgo <= 5 ? 80 : daysAgo <= 7 ? 60 : 40;
  sanitized.total_score = 0;

  return NextResponse.json({
    candidate: sanitized,
    isOwner,
    referringCompanyName:
      referringCompany?.name ||
      candidate.referring_company ||
      "Unknown",
    hasAtsConnection: !!requestingCompany?.ats_connection_id,
  });
}
