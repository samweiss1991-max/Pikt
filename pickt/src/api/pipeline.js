/**
 * Pipeline API — stage tracking for buyer-side hiring workflow.
 */

import { createClient } from "@supabase/supabase-js";
import { auditLog } from "../middleware/auditLog.js";
import { notifyCompany } from "../lib/notifications.js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const NOTIFY_STAGES = {
  interviewing: { title: "Your candidate is interviewing", emoji: "\uD83C\uDFAF" },
  offer_made:   { title: "Your candidate has received an offer", emoji: "\uD83D\uDE80" },
  hired:        { title: "Your candidate has been placed!", emoji: "\uD83D\uDCB0" },
};

// ── POST /api/pipeline-events ───────────────────────────────

export async function createPipelineEvent(req, { userId }) {
  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", userId)
    .single();

  if (!userData) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const body = await req.json();
  const { unlock_id, candidate_id, stage, notes } = body;

  if (!unlock_id || !candidate_id || !stage) {
    return { status: 400, body: { error: "unlock_id, candidate_id, and stage are required" } };
  }

  // Verify unlock belongs to this company
  const { data: unlock } = await supabase
    .from("candidate_unlock")
    .select("id, candidate_public_id")
    .eq("id", unlock_id)
    .eq("company_id", userData.company_id)
    .eq("status", "confirmed")
    .single();

  if (!unlock) {
    return { status: 403, body: { error: "Invalid unlock" } };
  }

  // Insert event
  const { data: event, error } = await supabase
    .from("candidate_pipeline_event")
    .insert({
      unlock_id,
      candidate_id,
      company_id: userData.company_id,
      stage,
      notes: notes ? notes.slice(0, 500) : null,
      updated_by_user_id: userId,
    })
    .select("*")
    .single();

  if (error) {
    return { status: 500, body: { error: error.message } };
  }

  // Audit
  auditLog("pipeline_stage_changed", candidate_id, req, {
    stage,
    unlock_id,
    event_id: event.id,
  });

  // Refresh materialised view (best-effort)
  supabase.rpc("refresh_current_stages").catch(() => {});

  // Notify referring company for key stages
  if (NOTIFY_STAGES[stage]) {
    const { data: candidate } = await supabase
      .from("candidate_public")
      .select("role_applied_for, uploaded_by_company_id")
      .eq("id", candidate_id)
      .single();

    if (candidate) {
      const n = NOTIFY_STAGES[stage];
      notifyCompany(candidate.uploaded_by_company_id, "candidate_stage_changed", {
        title: `${n.title} ${n.emoji}`,
        body: `Your ${candidate.role_applied_for} candidate has moved to the ${stage.replace(/_/g, " ")} stage.`,
        actionUrl: `/candidates/${candidate_id}`,
        actionLabel: "View candidate",
        candidateRole: candidate.role_applied_for,
        metadata: { stage, candidate_id },
      });
    }
  }

  return { status: 201, body: { event } };
}

// ── GET /api/pipeline-events?candidate_id=X ─────────────────

export async function getPipelineEvents(req, { userId }) {
  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", userId)
    .single();

  if (!userData) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const { searchParams } = new URL(req.url);
  const candidateId = searchParams.get("candidate_id");

  if (!candidateId) {
    return { status: 400, body: { error: "candidate_id required" } };
  }

  const { data: events, error } = await supabase
    .from("candidate_pipeline_event")
    .select("id, stage, notes, updated_by_user_id, created_at")
    .eq("candidate_id", candidateId)
    .eq("company_id", userData.company_id)
    .order("created_at", { ascending: true });

  if (error) {
    return { status: 500, body: { error: error.message } };
  }

  return { status: 200, body: { events: events || [] } };
}

// ── GET /api/my-candidates — buyer's unlocked candidates with stage ─

export async function getMyCandidates(req, { userId }) {
  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", userId)
    .single();

  if (!userData) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const { searchParams } = new URL(req.url);
  const stageFilter = searchParams.get("stage");
  const limit = Math.min(parseInt(searchParams.get("limit") || "25", 10), 50);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  // Get unlocks with current stage
  let q = supabase
    .from("candidate_unlock")
    .select(
      `id, candidate_public_id, unlocked_at, status,
       candidate_public:candidate_public_id (
         id, role_applied_for, seniority_level, location_city,
         current_company_name, interview_count, salary_band_low,
         salary_band_high, skills, availability_status, referred_at
       )`,
      { count: "exact" }
    )
    .eq("company_id", userData.company_id)
    .eq("status", "confirmed")
    .order("unlocked_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: unlocks, count, error } = await q;

  if (error) {
    return { status: 500, body: { error: error.message } };
  }

  // Fetch current stages for these candidates
  const candidateIds = (unlocks || []).map((u) => u.candidate_public_id);
  let stageMap = {};

  if (candidateIds.length > 0) {
    const { data: stages } = await supabase
      .from("candidate_current_stage")
      .select("candidate_id, stage, stage_updated_at")
      .in("candidate_id", candidateIds)
      .eq("company_id", userData.company_id);

    stageMap = Object.fromEntries(
      (stages || []).map((s) => [s.candidate_id, s])
    );
  }

  let results = (unlocks || []).map((u) => ({
    unlock_id: u.id,
    unlocked_at: u.unlocked_at,
    candidate: u.candidate_public,
    current_stage: stageMap[u.candidate_public_id]?.stage || "unlocked",
    stage_updated_at: stageMap[u.candidate_public_id]?.stage_updated_at || u.unlocked_at,
  }));

  // Filter by stage if requested
  if (stageFilter) {
    results = results.filter((r) => r.current_stage === stageFilter);
  }

  return {
    status: 200,
    body: {
      candidates: results,
      total: stageFilter ? results.length : (count || 0),
    },
  };
}
