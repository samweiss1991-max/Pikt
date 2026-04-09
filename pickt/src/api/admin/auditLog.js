/**
 * Admin audit log API.
 *
 * GET /api/admin/audit-log
 * Query params: offset, limit, from, to, types (comma-separated), company
 * Returns: { logs: [...], total: number }
 *
 * Each log entry is joined with company name and candidate role
 * for display in the admin table.
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function getAuditLogs(req) {
  const { searchParams } = new URL(req.url);
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "25", 10), 100);
  const dateFrom = searchParams.get("from");
  const dateTo = searchParams.get("to");
  const types = searchParams.get("types");
  const companySearch = searchParams.get("company");

  // Build query — join company name and candidate role
  let q = supabase
    .from("audit_log")
    .select(
      `id, event_type, actor_company_id, actor_user_id, candidate_id,
       ip_address, user_agent, session_id, metadata, created_at`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Filter: date range
  if (dateFrom) {
    q = q.gte("created_at", `${dateFrom}T00:00:00Z`);
  }
  if (dateTo) {
    q = q.lte("created_at", `${dateTo}T23:59:59Z`);
  }

  // Filter: event types
  if (types) {
    const typeList = types.split(",").filter(Boolean);
    if (typeList.length > 0) {
      q = q.in("event_type", typeList);
    }
  }

  const { data: logs, count, error } = await q;

  if (error) {
    return { status: 500, body: { error: error.message } };
  }

  // Enrich with company names and candidate roles
  const companyIds = [...new Set((logs || []).map((l) => l.actor_company_id).filter(Boolean))];
  const candidateIds = [...new Set((logs || []).map((l) => l.candidate_id).filter(Boolean))];

  // Batch fetch companies
  let companyMap = {};
  if (companyIds.length > 0) {
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name")
      .in("id", companyIds);
    companyMap = Object.fromEntries((companies || []).map((c) => [c.id, c.name]));
  }

  // Batch fetch candidate roles
  let candidateMap = {};
  if (candidateIds.length > 0) {
    const { data: candidates } = await supabase
      .from("candidate_public")
      .select("id, role_applied_for")
      .in("id", candidateIds);
    candidateMap = Object.fromEntries(
      (candidates || []).map((c) => [c.id, c.role_applied_for])
    );
  }

  // Merge and filter by company name if needed
  let enriched = (logs || []).map((l) => ({
    ...l,
    company_name: companyMap[l.actor_company_id] || null,
    candidate_role: candidateMap[l.candidate_id] || null,
  }));

  // Client-side company name filter (post-join)
  if (companySearch) {
    const lower = companySearch.toLowerCase();
    enriched = enriched.filter(
      (l) => l.company_name && l.company_name.toLowerCase().includes(lower)
    );
  }

  return {
    status: 200,
    body: {
      logs: enriched,
      total: companySearch ? enriched.length : (count || 0),
    },
  };
}
