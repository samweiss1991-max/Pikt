/**
 * Reputation Calculator — nightly job.
 *
 * For each company with >= 1 unlock, recalculates:
 *   - placement_rate_score (40% weight)
 *   - listing_quality_score (20% weight)
 *   - availability_accuracy_score (20% weight)
 *   - response_rate_score (20% weight)
 *   - overall_score (weighted average)
 *
 * Only displayed publicly when company has >= 3 unlocks.
 *
 * Cron: 0 3 * * * (3am daily)
 * Run manually: node src/jobs/reputationCalc.js
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SCORE_VERSION = 1;

// ── Score calculators ───────────────────────────────────────

function calcPlacementRateScore(placements, unlocks) {
  if (unlocks === 0) return { rate: 0, score: 0 };
  const rate = placements / unlocks;
  // Scale: 0% = 0, 10% = 2.5, 20% = 4, 30%+ = 5
  const score = Math.min(5, rate * 16.67);
  return { rate: parseFloat(rate.toFixed(4)), score: parseFloat(score.toFixed(1)) };
}

function calcListingQualityScore(avgConfidence) {
  if (!avgConfidence) return 2.5;
  // Scale: 0 confidence = 0, 60 = 3, 80 = 4, 100 = 5
  return parseFloat(Math.min(5, avgConfidence / 20).toFixed(1));
}

function calcAvailabilityAccuracyScore(confirmed, total) {
  if (total === 0) return 3.5; // neutral default
  const rate = confirmed / total;
  return parseFloat((rate * 5).toFixed(1));
}

function calcResponseRateScore(responded, total) {
  if (total === 0) return 3.5; // neutral default
  const rate = responded / total;
  return parseFloat((rate * 5).toFixed(1));
}

function calcOverall(placement, quality, availability, response) {
  const weighted =
    placement * 0.4 +
    quality * 0.2 +
    availability * 0.2 +
    response * 0.2;
  return parseFloat(weighted.toFixed(1));
}

// ── Main job ────────────────────────────────────────────────

export async function runReputationCalc() {
  console.log("[reputation] Starting reputation calculation...");

  // Find all companies that have uploaded candidates
  const { data: companies } = await supabase
    .from("candidate_public")
    .select("uploaded_by_company_id")
    .limit(10000);

  const companyIds = [...new Set((companies || []).map((c) => c.uploaded_by_company_id))];
  console.log(`[reputation] Processing ${companyIds.length} companies`);

  let updated = 0;

  for (const companyId of companyIds) {
    try {
      // 1. Placement rate
      const candidateIds = (
        await supabase
          .from("candidate_public")
          .select("id")
          .eq("uploaded_by_company_id", companyId)
      ).data?.map((c) => c.id) || [];

      let totalUnlocks = 0;
      let totalPlacements = 0;

      if (candidateIds.length > 0) {
        const { count: unlockCount } = await supabase
          .from("candidate_unlock")
          .select("id", { count: "exact", head: true })
          .in("candidate_public_id", candidateIds)
          .eq("status", "confirmed");
        totalUnlocks = unlockCount || 0;

        const { count: placementCount } = await supabase
          .from("placement")
          .select("id", { count: "exact", head: true })
          .in("candidate_public_id", candidateIds);
        totalPlacements = placementCount || 0;
      }

      if (totalUnlocks === 0) continue; // Skip companies with no unlocks

      const { rate, score: placementScore } = calcPlacementRateScore(totalPlacements, totalUnlocks);

      // 2. Listing quality (avg parse_confidence_score)
      const { data: confidenceRows } = await supabase
        .from("candidate_public")
        .select("parse_confidence_score")
        .eq("uploaded_by_company_id", companyId)
        .not("parse_confidence_score", "is", null);

      const avgConfidence = confidenceRows && confidenceRows.length > 0
        ? confidenceRows.reduce((sum, r) => sum + (r.parse_confidence_score || 0), 0) / confidenceRows.length
        : null;

      const qualityScore = calcListingQualityScore(avgConfidence);

      // 3. Availability accuracy
      const { count: totalAvailChecks } = await supabase
        .from("availability_token")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("action", "confirm");

      const { count: confirmedChecks } = await supabase
        .from("availability_token")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("action", "confirm")
        .not("used_at", "is", null);

      const availabilityScore = calcAvailabilityAccuracyScore(
        confirmedChecks || 0,
        totalAvailChecks || 0
      );

      // 4. Response rate (48h SLA)
      const { count: totalResponses } = await supabase
        .from("pending_response")
        .select("id", { count: "exact", head: true })
        .eq("referrer_company_id", companyId);

      const { count: respondedCount } = await supabase
        .from("pending_response")
        .select("id", { count: "exact", head: true })
        .eq("referrer_company_id", companyId)
        .eq("status", "responded");

      const responseScore = calcResponseRateScore(
        respondedCount || 0,
        totalResponses || 0
      );

      // 5. Overall
      const overallScore = calcOverall(placementScore, qualityScore, availabilityScore, responseScore);

      // 6. Member since
      const { data: companyRow } = await supabase
        .from("companies")
        .select("created_at")
        .eq("id", companyId)
        .single();

      // 7. Upsert
      await supabase
        .from("company_reputation")
        .upsert({
          company_id: companyId,
          placement_rate: rate,
          placement_rate_score: placementScore,
          listing_quality_score: qualityScore,
          availability_accuracy_score: availabilityScore,
          response_rate_score: responseScore,
          overall_score: overallScore,
          total_placements: totalPlacements,
          total_unlocks: totalUnlocks,
          member_since: companyRow?.created_at
            ? new Date(companyRow.created_at).toISOString().split("T")[0]
            : null,
          last_calculated_at: new Date().toISOString(),
          score_version: SCORE_VERSION,
        }, { onConflict: "company_id" });

      updated++;
    } catch (err) {
      console.error(`[reputation] Error processing ${companyId}:`, err.message);
    }
  }

  console.log(`[reputation] Done. Updated ${updated} companies.`);
  return { updated, total: companyIds.length };
}

// ── Expire pending responses past 48h SLA ───────────────────

export async function expirePendingResponses() {
  const { count } = await supabase
    .from("pending_response")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("sla_deadline", new Date().toISOString())
    .select("id", { count: "exact", head: true });

  console.log(`[reputation] Expired ${count || 0} pending responses`);
  return count || 0;
}

// Run directly
if (typeof process !== "undefined" && process.argv[1]?.includes("reputationCalc")) {
  (async () => {
    await expirePendingResponses();
    const result = await runReputationCalc();
    console.log("[reputation] Result:", result);
    process.exit(0);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
