/**
 * Refresh engagement stats — run every 30 minutes via cron.
 *
 * Cron schedule: */30 * * * *
 * Run manually: node src/jobs/refreshEngagement.js
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function refreshEngagement() {
  console.log("[engagement] Refreshing candidate_engagement_stats...");

  const { error } = await supabase.rpc("refresh_engagement_stats");

  if (error) {
    console.error("[engagement] Refresh failed:", error.message);
    throw error;
  }

  console.log("[engagement] Done.");
}

if (typeof process !== "undefined" && process.argv[1]?.includes("refreshEngagement")) {
  refreshEngagement()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
