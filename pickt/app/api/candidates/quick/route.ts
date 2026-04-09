import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// Lighter candidate creation endpoint for the Chrome extension.
// Fewer required fields than the main POST /api/candidates.
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id, companies(name)")
    .eq("id", user.id)
    .single();

  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const companyId = userData.company_id;
  const companyName = (userData.companies as unknown as { name: string })?.name;

  const body = await request.json();

  // Minimal required fields for extension referral
  if (!body.role_applied_for) {
    return NextResponse.json(
      { error: "Role title is required" },
      { status: 400 }
    );
  }
  if (!body.why_not_hired) {
    return NextResponse.json(
      { error: "Reason for not hiring is required" },
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
      source: "extension",
      consent_given: body.consent_given ?? false,
      referred_at: new Date().toISOString(),

      // From ATS detection or form
      full_name: body.full_name || null,
      email: body.email || null,
      role_applied_for: body.role_applied_for,
      seniority_level: body.seniority_level || null,
      industry: body.industry || null,
      skills: body.skills || [],
      location_city: body.location_city || null,
      location_country: body.location_country || null,
      preferred_work_type: body.preferred_work_type || null,
      interview_stage_reached: body.interview_stage_reached || null,
      interviews_completed: body.interviews_completed || 0,
      why_not_hired: body.why_not_hired,
      strengths: body.strengths || null,
      gaps: body.gaps || null,
      recommendation: body.recommendation || null,
      fee_percentage: body.fee_percentage ?? 8,

      // ATS metadata
      ats_candidate_id: body.ats_candidate_id || null,
      ats_platform: body.ats_platform || null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, success: true });
}
