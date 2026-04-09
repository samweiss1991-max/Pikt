/**
 * Shortlist API.
 *
 * GET /api/shortlist — list shortlisted candidates with unlock status
 * POST /api/shortlist — add candidate
 * DELETE /api/shortlist/:candidateId — remove
 * GET /api/shortlist/count — pending_review badge count
 */

import { createClient } from "@supabase/supabase-js";
import { auditLog } from "../middleware/auditLog.js";

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

// GET /api/shortlist
export async function getShortlist(req, { userId }) {
  const companyId = await getCompanyId(userId);
  if (!companyId) return { status: 401, body: { error: "Unauthorized" } };

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") || "all"; // all | unlocked | locked
  const sort = searchParams.get("sort") || "added_at";
  const search = searchParams.get("q")?.trim() || "";

  // Fetch shortlist entries
  const { data: entries, error } = await supabase
    .from("shortlist")
    .select("id, candidate_id, added_at, status, reviewed_at")
    .eq("company_id", companyId)
    .neq("status", "removed")
    .order("added_at", { ascending: false });

  if (error) return { status: 500, body: { error: error.message } };

  const candidateIds = (entries || []).map((e) => e.candidate_id);
  if (candidateIds.length === 0) {
    return { status: 200, body: { candidates: [], counts: { all: 0, unlocked: 0, locked: 0 } } };
  }

  // Fetch candidate public data
  const { data: candidates } = await supabase
    .from("candidate_public")
    .select(`id, role_applied_for, seniority_level, location_city,
       current_company_name, skills, interview_count, salary_band_low,
       salary_band_high, years_experience, work_history, top_skills,
       fee_percentage, availability_status, referred_at, status`)
    .in("id", candidateIds);

  const candidateMap = Object.fromEntries(
    (candidates || []).map((c) => [c.id, c])
  );

  // Check which candidates are unlocked by this company
  const { data: unlocks } = await supabase
    .from("candidate_unlock")
    .select("candidate_public_id, id, unlocked_at")
    .eq("company_id", companyId)
    .eq("status", "confirmed")
    .in("candidate_public_id", candidateIds);

  const unlockMap = Object.fromEntries(
    (unlocks || []).map((u) => [u.candidate_public_id, u])
  );

  // Check ATS sync status
  // (placeholder — check if an ATS import record exists)
  const atsMap = {};

  // Fetch PII for unlocked candidates (name only, via service role)
  const unlockedIds = Object.keys(unlockMap);
  let piiMap = {};
  if (unlockedIds.length > 0) {
    const { data: piiRows } = await supabase
      .from("candidate_pii")
      .select("candidate_public_id, full_name")
      .in("candidate_public_id", unlockedIds);
    // Note: full_name is encrypted — would need decryption here
    // For now, pass through (decryption handled at API layer)
    piiMap = Object.fromEntries(
      (piiRows || []).map((p) => [p.candidate_public_id, p])
    );
  }

  // Build enriched list
  let results = (entries || []).map((entry) => {
    const c = candidateMap[entry.candidate_id];
    if (!c) return null;
    const unlock = unlockMap[entry.candidate_id];
    const isUnlocked = !!unlock;

    return {
      shortlist_id: entry.id,
      added_at: entry.added_at,
      shortlist_status: entry.shortlist_status,
      candidate: c,
      is_unlocked: isUnlocked,
      unlock_id: unlock?.id || null,
      unlocked_at: unlock?.unlocked_at || null,
      candidate_name: isUnlocked ? (piiMap[entry.candidate_id]?.full_name || null) : null,
      ats_synced: !!atsMap[entry.candidate_id],
    };
  }).filter(Boolean);

  // Filter by tab
  const counts = {
    all: results.length,
    unlocked: results.filter((r) => r.is_unlocked).length,
    locked: results.filter((r) => !r.is_unlocked).length,
  };

  if (filter === "unlocked") results = results.filter((r) => r.is_unlocked);
  if (filter === "locked") results = results.filter((r) => !r.is_unlocked);

  // Search
  if (search) {
    const q = search.toLowerCase();
    results = results.filter((r) =>
      r.candidate.role_applied_for?.toLowerCase().includes(q) ||
      r.candidate.skills?.some((sk) => sk.toLowerCase().includes(q))
    );
  }

  // Sort
  if (sort === "fee_asc") {
    results.sort((a, b) => (a.candidate.fee_percentage || 0) - (b.candidate.fee_percentage || 0));
  } else if (sort === "interviews_desc") {
    results.sort((a, b) => (b.candidate.interview_count || 0) - (a.candidate.interview_count || 0));
  } else if (sort === "salary_band") {
    results.sort((a, b) => (b.candidate.salary_band_high || 0) - (a.candidate.salary_band_high || 0));
  }

  return { status: 200, body: { candidates: results, counts } };
}

// POST /api/shortlist
export async function addToShortlist(req, { userId }) {
  const companyId = await getCompanyId(userId);
  if (!companyId) return { status: 401, body: { error: "Unauthorized" } };

  const { candidate_id } = await req.json();
  if (!candidate_id) return { status: 400, body: { error: "candidate_id required" } };

  const { error } = await supabase
    .from("shortlist")
    .upsert({
      company_id: companyId,
      candidate_id,
      user_id: userId,
      status: "pending_review",
      added_at: new Date().toISOString(),
    }, { onConflict: "candidate_id,company_id" });

  if (error) return { status: 500, body: { error: error.message } };

  auditLog("shortlist_added", candidate_id, req, {});

  return { status: 201, body: { success: true } };
}

// DELETE /api/shortlist/:candidateId
export async function removeFromShortlist(req, { candidateId, userId }) {
  const companyId = await getCompanyId(userId);
  if (!companyId) return { status: 401, body: { error: "Unauthorized" } };

  await supabase
    .from("shortlist")
    .update({ status: "removed" })
    .eq("candidate_id", candidateId)
    .eq("company_id", companyId);

  auditLog("shortlist_removed", candidateId, req, {});

  return { status: 200, body: { success: true } };
}

// GET /api/shortlist/count
export async function getShortlistCount(req, { userId }) {
  const companyId = await getCompanyId(userId);
  if (!companyId) return { status: 401, body: { error: "Unauthorized" } };

  const { count } = await supabase
    .from("shortlist")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "pending_review");

  return { status: 200, body: { count: count || 0 } };
}
