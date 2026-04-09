/**
 * Referrer performance API.
 *
 * GET /api/referrer/candidates/performance
 * Scoped to authenticated company. Never exposes which companies
 * viewed or unlocked — only aggregate counts.
 *
 * Response cached 5 minutes client-side via Cache-Control.
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function getReferrerPerformance(req, { userId }) {
  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", userId)
    .single();

  if (!userData) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const companyId = userData.company_id;

  // Fetch all candidates uploaded by this company
  const { data: candidates, error: candErr } = await supabase
    .from("candidate_public")
    .select("id, role_applied_for, seniority_level, referred_at, status")
    .eq("uploaded_by_company_id", companyId)
    .order("referred_at", { ascending: false });

  if (candErr) {
    return { status: 500, body: { error: candErr.message } };
  }

  if (!candidates || candidates.length === 0) {
    return {
      status: 200,
      body: {
        summary: { total_views: 0, total_unlocks: 0, total_placements: 0 },
        candidates: [],
      },
      headers: { "Cache-Control": "private, max-age=300" },
    };
  }

  const candidateIds = candidates.map((c) => c.id);

  // Count views per candidate from audit_log
  const { data: viewRows } = await supabase
    .from("audit_log")
    .select("candidate_id")
    .eq("event_type", "profile_viewed")
    .in("candidate_id", candidateIds);

  const viewCounts = {};
  for (const row of viewRows || []) {
    viewCounts[row.candidate_id] = (viewCounts[row.candidate_id] || 0) + 1;
  }

  // Count unlocks per candidate (distinct companies, status=confirmed)
  const { data: unlockRows } = await supabase
    .from("candidate_unlock")
    .select("candidate_public_id, company_id")
    .in("candidate_public_id", candidateIds)
    .eq("status", "confirmed");

  const unlockCounts = {};
  for (const row of unlockRows || []) {
    unlockCounts[row.candidate_public_id] =
      (unlockCounts[row.candidate_public_id] || 0) + 1;
  }

  // Check placement status — from pipeline current stage
  const { data: stageRows } = await supabase
    .from("candidate_current_stage")
    .select("candidate_id, stage")
    .in("candidate_id", candidateIds);

  // Determine placement status per candidate:
  // If ANY company has stage=hired → 'placed'
  // If ANY company has stage in (interviewing, offer_made) → 'interviewing'
  // Otherwise → 'not_placed'
  const placementMap = {};
  for (const row of stageRows || []) {
    const current = placementMap[row.candidate_id];
    if (row.stage === "hired") {
      placementMap[row.candidate_id] = "placed";
    } else if (
      !current &&
      (row.stage === "interviewing" || row.stage === "offer_made" ||
       row.stage === "interview_scheduled" || row.stage === "contacted")
    ) {
      placementMap[row.candidate_id] = "interviewing";
    }
  }

  // Build response
  const enriched = candidates.map((c) => ({
    candidate_id: c.id,
    role_applied_for: c.role_applied_for,
    seniority_level: c.seniority_level,
    referred_at: c.referred_at,
    views: viewCounts[c.id] || 0,
    unlock_count: unlockCounts[c.id] || 0,
    placement_status: c.status === "placed"
      ? "placed"
      : placementMap[c.id] || "not_placed",
  }));

  const totalViews = enriched.reduce((sum, c) => sum + c.views, 0);
  const totalUnlocks = enriched.reduce((sum, c) => sum + c.unlock_count, 0);
  const totalPlacements = enriched.filter((c) => c.placement_status === "placed").length;

  return {
    status: 200,
    body: {
      summary: {
        total_views: totalViews,
        total_unlocks: totalUnlocks,
        total_placements: totalPlacements,
      },
      candidates: enriched,
    },
    headers: { "Cache-Control": "private, max-age=300" },
  };
}
