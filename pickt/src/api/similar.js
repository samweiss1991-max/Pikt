/**
 * Similar Candidates API.
 *
 * GET /api/candidates/:id/similar
 * Returns top 3 similar candidates scored by seniority, location,
 * skills overlap, and salary band proximity.
 * Also returns a contextual summary line for the profile.
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function getSimilarCandidates(req, { candidateId }) {
  // Fetch source candidate for contextual line
  const { data: source } = await supabase
    .from("candidate_public")
    .select("id, role_applied_for, seniority_level, location_city")
    .eq("id", candidateId)
    .single();

  if (!source) {
    return { status: 404, body: { error: "Candidate not found" } };
  }

  // Call the scoring function
  const { data: similar, error } = await supabase
    .rpc("find_similar_candidates_scored", {
      p_candidate_id: candidateId,
      p_limit: 3,
    });

  if (error) {
    return { status: 500, body: { error: error.message } };
  }

  const results = similar || [];

  // Build contextual line
  let contextLine = null;
  if (results.length > 0) {
    const seniority = source.seniority_level;
    const role = source.role_applied_for;
    const city = source.location_city;
    contextLine = `${results.length} similar ${seniority} ${role}${results.length !== 1 ? "s" : ""} available${city ? ` in ${city}` : ""}`;
  }

  // Count total available candidates matching seniority for "Browse X" link
  const { count: totalMatching } = await supabase
    .from("candidate_public")
    .select("id", { count: "exact", head: true })
    .eq("seniority_level", source.seniority_level)
    .eq("status", "listed")
    .eq("availability_status", "available")
    .neq("id", candidateId);

  return {
    status: 200,
    body: {
      candidates: results.map((c) => ({
        id: c.id,
        role_applied_for: c.role_applied_for,
        seniority_level: c.seniority_level,
        location_city: c.location_city,
        skills: (c.skills || []).slice(0, 2),
        fee_percentage: c.fee_percentage,
        similarity_score: c.similarity_score,
        interview_count: c.interview_count,
        referred_at: c.referred_at,
      })),
      context_line: contextLine,
      total_matching: totalMatching || 0,
      source_seniority: source.seniority_level,
    },
  };
}
