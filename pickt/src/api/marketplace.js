/**
 * Marketplace API — server-side search and filtering.
 *
 * GET /api/candidates/marketplace
 * Query params:
 *   q: string — full-text search
 *   seniority: string[] — filter by seniority levels
 *   location: string — filter by location city (partial match)
 *   skills: string[] — filter by skills (array overlap)
 *   fee_max: number — max fee percentage
 *   interview_stage: string — filter by interview stage
 *   listed_within_days: number — only candidates referred within N days
 *   availability_status: string[] — filter by availability
 *   sort: 'recent' | 'views_desc' | 'fee_asc' | 'interviews_desc'
 *   page: number (default 1)
 *   per_page: number (default 12, max 50)
 *
 * Returns: { candidates, total, page, per_page, filters_applied }
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function getMarketplace(req) {
  const { searchParams } = new URL(req.url);

  // Parse params
  const q = searchParams.get("q")?.trim() || "";
  const seniority = searchParams.getAll("seniority").filter(Boolean);
  const location = searchParams.get("location")?.trim() || "";
  const skills = searchParams.getAll("skills").filter(Boolean);
  const feeMax = searchParams.get("fee_max") ? parseInt(searchParams.get("fee_max"), 10) : null;
  const interviewStage = searchParams.get("interview_stage") || "";
  const listedWithinDays = searchParams.get("listed_within_days")
    ? parseInt(searchParams.get("listed_within_days"), 10)
    : null;
  const availabilityStatus = searchParams.getAll("availability_status").filter(Boolean);
  const sort = searchParams.get("sort") || "recent";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("per_page") || "12", 10)));
  const offset = (page - 1) * perPage;

  // Track which filters are active
  const filtersApplied = [];

  // Build query
  let query = supabase
    .from("candidate_public")
    .select(
      `id, role_applied_for, seniority_level, location_city,
       current_company_name, skills, interview_stage_reached,
       interview_count, reason_not_hired, feedback_summary,
       strengths, gaps, status, salary_band_low, salary_band_high,
       years_experience, work_history, top_skills, referred_at,
       availability_status, fee_percentage, parse_confidence_score,
       created_at`,
      { count: "exact" }
    );

  // Default: only listed candidates
  query = query.eq("status", "listed");

  // Default availability: available + interviewing_elsewhere
  if (availabilityStatus.length > 0) {
    query = query.in("availability_status", availabilityStatus);
    filtersApplied.push(`availability: ${availabilityStatus.join(", ")}`);
  } else {
    query = query.in("availability_status", ["available", "interviewing_elsewhere"]);
  }

  // Full-text search
  if (q) {
    query = query.textSearch("search_vector", q, { type: "websearch" });
    filtersApplied.push(`search: "${q}"`);
  }

  // Seniority filter
  if (seniority.length > 0) {
    query = query.in("seniority_level", seniority);
    filtersApplied.push(`seniority: ${seniority.join(", ")}`);
  }

  // Location filter (partial match)
  if (location) {
    query = query.ilike("location_city", `%${location}%`);
    filtersApplied.push(`location: ${location}`);
  }

  // Skills filter (array overlap)
  if (skills.length > 0) {
    query = query.overlaps("skills", skills);
    filtersApplied.push(`skills: ${skills.join(", ")}`);
  }

  // Fee max
  if (feeMax != null) {
    query = query.lte("fee_percentage", feeMax);
    filtersApplied.push(`fee ≤ ${feeMax}%`);
  }

  // Interview stage
  if (interviewStage) {
    query = query.eq("interview_stage_reached", interviewStage);
    filtersApplied.push(`stage: ${interviewStage}`);
  }

  // Listed within N days
  if (listedWithinDays) {
    const cutoff = new Date(Date.now() - listedWithinDays * 86400000).toISOString();
    query = query.gte("referred_at", cutoff);
    filtersApplied.push(`within ${listedWithinDays} days`);
  }

  // Sorting
  switch (sort) {
    case "fee_asc":
      query = query.order("fee_percentage", { ascending: true });
      break;
    case "interviews_desc":
      query = query.order("interview_count", { ascending: false });
      break;
    case "views_desc":
      // Sort by views requires join with engagement stats — handled post-query
      query = query.order("referred_at", { ascending: false });
      break;
    case "recent":
    default:
      query = query.order("referred_at", { ascending: false });
  }

  // Pagination
  query = query.range(offset, offset + perPage - 1);

  const { data: candidates, count, error } = await query;

  if (error) {
    return { status: 500, body: { error: error.message } };
  }

  // Fetch engagement stats for returned candidates
  const candidateIds = (candidates || []).map((c) => c.id);
  let engagementMap = {};

  if (candidateIds.length > 0) {
    const { data: stats } = await supabase
      .from("candidate_engagement_stats")
      .select("candidate_id, views_this_week, saves_count, unlock_count, days_since_last_unlock, is_popular")
      .in("candidate_id", candidateIds);

    engagementMap = Object.fromEntries(
      (stats || []).map((s) => [s.candidate_id, s])
    );
  }

  // Enrich candidates with engagement
  let enriched = (candidates || []).map((c) => ({
    ...c,
    engagement: engagementMap[c.id] || {
      views_this_week: 0, saves_count: 0, unlock_count: 0,
      days_since_last_unlock: null, is_popular: false,
    },
  }));

  // Post-query sort by views if requested
  if (sort === "views_desc") {
    enriched.sort((a, b) =>
      (b.engagement.views_this_week || 0) - (a.engagement.views_this_week || 0)
    );
  }

  return {
    status: 200,
    body: {
      candidates: enriched,
      total: count || 0,
      page,
      per_page: perPage,
      filters_applied: filtersApplied,
    },
  };
}
