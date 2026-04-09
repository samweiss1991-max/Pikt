/**
 * Nightly job: recalculate fee band unlock rate stats.
 *
 * Calls the recalculate_fee_band_stats() Postgres function
 * which updates the platform_stats table with current data.
 *
 * Cron schedule: 0 2 * * * (2am daily)
 * Run manually: node src/jobs/recalculateFeeStats.js
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function recalculateFeeStats() {
  console.log("[fee-stats] Recalculating unlock rates by fee band...");

  const { error } = await supabase.rpc("recalculate_fee_band_stats");

  if (error) {
    console.error("[fee-stats] Failed:", error.message);
    throw error;
  }

  // Fetch and log the result
  const { data } = await supabase
    .from("platform_stats")
    .select("value, calculated_at")
    .eq("id", "unlock_rate_by_fee_band")
    .single();

  if (data) {
    const bands = data.value?.bands || [];
    console.log("[fee-stats] Updated at:", data.calculated_at);
    for (const b of bands) {
      console.log(
        `  ${b.label}: ${(b.unlock_rate * 100).toFixed(0)}% unlock rate ` +
        `(${b.total_unlocked || 0}/${b.total_listed || 0})`
      );
    }
  }

  console.log("[fee-stats] Done.");
}

if (typeof process !== "undefined" && process.argv[1]?.includes("recalculateFeeStats")) {
  recalculateFeeStats()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
