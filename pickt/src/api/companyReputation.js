/**
 * Company reputation API.
 *
 * GET /api/companies/:id/reputation
 * Returns reputation scores from COMPANY_REPUTATION table.
 * Only shows publicly when company has >= 3 unlocks.
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MIN_UNLOCKS = 3;

export async function getCompanyReputation(req, { companyId }) {
  // Fetch from company_reputation table
  const { data: rep } = await supabase
    .from("company_reputation")
    .select("*")
    .eq("company_id", companyId)
    .single();

  if (!rep) {
    // No reputation data yet
    return {
      status: 200,
      body: {
        has_score: false,
        message: "New referrer — building reputation",
        total_unlocks: 0,
        min_unlocks_required: MIN_UNLOCKS,
      },
    };
  }

  const hasEnoughData = rep.total_unlocks >= MIN_UNLOCKS;

  return {
    status: 200,
    body: {
      has_score: hasEnoughData,
      overall_score: hasEnoughData ? parseFloat(rep.overall_score) : null,
      placement_rate_score: rep.placement_rate_score,
      listing_quality_score: rep.listing_quality_score,
      availability_accuracy_score: rep.availability_accuracy_score,
      response_rate_score: rep.response_rate_score,
      scores: [
        { label: "Placement rate", score: parseFloat(rep.placement_rate_score), max: 5 },
        { label: "Listing quality", score: parseFloat(rep.listing_quality_score), max: 5 },
        { label: "Availability accuracy", score: parseFloat(rep.availability_accuracy_score), max: 5 },
        { label: "Response rate", score: parseFloat(rep.response_rate_score), max: 5 },
      ],
      total_placements: rep.total_placements,
      total_unlocks: rep.total_unlocks,
      member_since: rep.member_since,
      last_calculated_at: rep.last_calculated_at,
      min_unlocks_required: MIN_UNLOCKS,
      message: hasEnoughData ? null : "New referrer — building reputation",
    },
  };
}
