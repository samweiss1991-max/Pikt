/**
 * Deduplication API.
 *
 * POST /api/candidates/check-duplicate
 * Finds similar candidates using pg_trgm and logs all checks.
 *
 * PATCH /api/duplicates/:id/resolve
 * Records the user's resolution for a duplicate check.
 *
 * GET /api/admin/duplicates
 * Returns candidate pairs with similarity > 0.8 for admin review.
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Helpers ─────────────────────────────────────────────────

async function getCompanyId(userId) {
  const { data } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", userId)
    .single();
  return data?.company_id || null;
}

// ── POST /api/candidates/check-duplicate ────────────────────

export async function checkDuplicate(req, { userId }) {
  const companyId = await getCompanyId(userId);
  if (!companyId) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const body = await req.json();
  const { role, location_city, current_company_name } = body;

  if (!role || !location_city || !current_company_name) {
    return {
      status: 400,
      body: { error: "role, location_city, and current_company_name are required" },
    };
  }

  // Call the DB function for fuzzy matching (threshold 0.6 to catch warnings too)
  const { data: matches, error } = await supabase.rpc("find_similar_candidates", {
    p_role: role,
    p_city: location_city,
    p_company: current_company_name,
    p_threshold: 0.6,
    p_limit: 5,
  });

  if (error) {
    return { status: 500, body: { error: error.message } };
  }

  const results = (matches || []).map((m) => ({
    candidate_id: m.candidate_id,
    role_applied_for: m.role_applied_for,
    location_city: m.location_city,
    current_company_name: m.current_company_name,
    referred_at: m.referred_at,
    similarity_score: parseFloat(m.similarity_score),
    level: m.similarity_score >= 0.75 ? "high" : "warning",
  }));

  // Log all matches with score > 0.6 to the check log
  if (results.length > 0) {
    const rows = results.map((r) => ({
      submitting_company_id: companyId,
      potential_duplicate_candidate_id: r.candidate_id,
      similarity_score: r.similarity_score,
    }));

    await supabase.from("duplicate_check_log").insert(rows);
  }

  // Split into high (modal) and warning (inline) matches
  const highMatches = results.filter((r) => r.similarity_score >= 0.75).slice(0, 3);
  const warningMatches = results.filter(
    (r) => r.similarity_score >= 0.6 && r.similarity_score < 0.75
  );

  return {
    status: 200,
    body: {
      has_high_match: highMatches.length > 0,
      has_warning: warningMatches.length > 0,
      high_matches: highMatches,
      warning_matches: warningMatches,
    },
  };
}

// ── PATCH /api/duplicates/:id/resolve ───────────────────────

export async function resolveDuplicate(req, { id, userId }) {
  const companyId = await getCompanyId(userId);
  if (!companyId) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const body = await req.json();
  const { resolution } = body;

  const validResolutions = [
    "different_person",
    "same_person_withdrawn",
    "support_contacted",
    "ignored",
  ];
  if (!validResolutions.includes(resolution)) {
    return {
      status: 400,
      body: { error: `Invalid resolution. Must be one of: ${validResolutions.join(", ")}` },
    };
  }

  const { error } = await supabase
    .from("duplicate_check_log")
    .update({
      resolution,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("submitting_company_id", companyId);

  if (error) {
    return { status: 500, body: { error: error.message } };
  }

  return { status: 200, body: { success: true } };
}

// ── GET /api/admin/duplicates ───────────────────────────────

export async function getAdminDuplicates(req) {
  const { searchParams } = new URL(req.url);
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "25", 10), 100);
  const minScore = parseFloat(searchParams.get("min_score") || "0.8");

  const { data: logs, count, error } = await supabase
    .from("duplicate_check_log")
    .select("*", { count: "exact" })
    .gte("similarity_score", minScore)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return { status: 500, body: { error: error.message } };
  }

  // Enrich with candidate and company details
  const candidateIds = [...new Set((logs || []).map((l) => l.potential_duplicate_candidate_id))];
  const companyIds = [...new Set((logs || []).map((l) => l.submitting_company_id))];

  let candidateMap = {};
  if (candidateIds.length > 0) {
    const { data: candidates } = await supabase
      .from("candidate_public")
      .select("id, role_applied_for, location_city, current_company_name, referred_at")
      .in("id", candidateIds);
    candidateMap = Object.fromEntries((candidates || []).map((c) => [c.id, c]));
  }

  let companyMap = {};
  if (companyIds.length > 0) {
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name")
      .in("id", companyIds);
    companyMap = Object.fromEntries((companies || []).map((c) => [c.id, c.name]));
  }

  const enriched = (logs || []).map((l) => ({
    ...l,
    candidate: candidateMap[l.potential_duplicate_candidate_id] || null,
    company_name: companyMap[l.submitting_company_id] || null,
  }));

  return {
    status: 200,
    body: { duplicates: enriched, total: count || 0 },
  };
}
