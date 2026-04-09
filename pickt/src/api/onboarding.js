/**
 * Onboarding API.
 *
 * GET /api/onboarding/status — checklist state
 * POST /api/onboarding/dismiss — hide checklist
 * POST /api/onboarding/complete — mark onboarding done
 * POST /api/onboarding/seen-example — mark upload example seen
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getCompanyId(userId) {
  const { data } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", userId)
    .single();
  return data?.company_id || null;
}

// GET /api/onboarding/status
export async function getOnboardingStatus(req, { userId }) {
  const companyId = await getCompanyId(userId);
  if (!companyId) return { status: 401, body: { error: "Unauthorized" } };

  const { data: company } = await supabase
    .from("companies")
    .select("onboarding_completed_at, onboarding_step_reached, onboarding_dismissed_at, seen_upload_example, ats_connection_id")
    .eq("id", companyId)
    .single();

  if (!company) return { status: 404, body: { error: "Company not found" } };

  // Check each step
  const hasAts = !!company.ats_connection_id;

  const { count: candidateCount } = await supabase
    .from("candidate_public")
    .select("id", { count: "exact", head: true })
    .eq("uploaded_by_company_id", companyId);

  const hasCandidate = (candidateCount || 0) > 0;

  const { data: companyProfile } = await supabase
    .from("companies")
    .select("name, industry, website")
    .eq("id", companyId)
    .single();

  const hasProfile = !!(companyProfile?.name && companyProfile?.industry);

  const { count: teamCount } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  const hasTeam = (teamCount || 0) > 1;

  const steps = [
    { id: "ats", label: "Connect your ATS", url: "/settings/integrations", completed: hasAts },
    { id: "upload", label: "Upload your first candidate", url: "/upload", completed: hasCandidate },
    { id: "profile", label: "Complete your agency profile", url: "/settings/profile", completed: hasProfile },
    { id: "team", label: "Invite a team member", url: "/settings/team", completed: hasTeam },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const allComplete = completedCount === 4;

  // Auto-complete onboarding if all steps done
  if (allComplete && !company.onboarding_completed_at) {
    await supabase
      .from("companies")
      .update({
        onboarding_completed_at: new Date().toISOString(),
        onboarding_step_reached: 4,
      })
      .eq("id", companyId);
  }

  return {
    status: 200,
    body: {
      steps,
      completed_count: completedCount,
      total: 4,
      all_complete: allComplete,
      onboarding_completed_at: company.onboarding_completed_at,
      onboarding_dismissed_at: company.onboarding_dismissed_at,
      seen_upload_example: company.seen_upload_example,
      visible: !company.onboarding_completed_at && !company.onboarding_dismissed_at,
    },
  };
}

// POST /api/onboarding/dismiss
export async function dismissOnboarding(req, { userId }) {
  const companyId = await getCompanyId(userId);
  if (!companyId) return { status: 401, body: { error: "Unauthorized" } };

  await supabase
    .from("companies")
    .update({ onboarding_dismissed_at: new Date().toISOString() })
    .eq("id", companyId);

  return { status: 200, body: { success: true } };
}

// POST /api/onboarding/seen-example
export async function markExampleSeen(req, { userId }) {
  const companyId = await getCompanyId(userId);
  if (!companyId) return { status: 401, body: { error: "Unauthorized" } };

  await supabase
    .from("companies")
    .update({ seen_upload_example: true })
    .eq("id", companyId);

  return { status: 200, body: { success: true } };
}
