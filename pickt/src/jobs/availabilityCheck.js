/**
 * Availability check job — run weekly via cron.
 *
 * For candidates where last_availability_confirmed_at is null
 * or older than 30 days:
 *   1. Send email to referring company via sendNotification()
 *   2. Generate one-click confirm/remove tokens
 *   3. If no response after 7 days: set status = 'unconfirmed'
 *
 * Cron schedule: 0 9 * * 1 (Monday 9am)
 *
 * Run manually: node src/jobs/availabilityCheck.js
 */

import { createClient } from "@supabase/supabase-js";
import { notifyCompany } from "../lib/notifications.js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

// ── Step 1: Mark stale unconfirmed candidates ───────────────

async function markStaleUnconfirmed() {
  // Candidates who were sent a check email 7+ days ago
  // and still haven't confirmed → mark unconfirmed
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const { data: staleTokens } = await supabase
    .from("availability_token")
    .select("candidate_public_id")
    .eq("action", "confirm")
    .is("used_at", null)
    .lt("created_at", sevenDaysAgo);

  if (!staleTokens || staleTokens.length === 0) return 0;

  const candidateIds = [...new Set(staleTokens.map((t) => t.candidate_public_id))];

  const { count } = await supabase
    .from("candidate_public")
    .update({ availability_status: "unconfirmed" })
    .in("id", candidateIds)
    .eq("availability_status", "available")
    .select("id", { count: "exact", head: true });

  console.log(`[availability] Marked ${count || 0} candidates as unconfirmed`);
  return count || 0;
}

// ── Step 2: Send check emails for stale candidates ──────────

async function sendCheckEmails() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  // Find candidates needing a check
  const { data: candidates } = await supabase
    .from("candidate_public")
    .select("id, role_applied_for, uploaded_by_company_id, last_availability_confirmed_at")
    .in("availability_status", ["available", "interviewing_elsewhere"])
    .eq("status", "listed")
    .or(`last_availability_confirmed_at.is.null,last_availability_confirmed_at.lt.${thirtyDaysAgo}`)
    .limit(100);

  if (!candidates || candidates.length === 0) {
    console.log("[availability] No candidates need checking.");
    return 0;
  }

  let sent = 0;

  for (const c of candidates) {
    // Check if we already sent a token in the last 7 days (avoid spam)
    const recentCutoff = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: recentToken } = await supabase
      .from("availability_token")
      .select("id")
      .eq("candidate_public_id", c.id)
      .gt("created_at", recentCutoff)
      .limit(1)
      .single();

    if (recentToken) continue; // Already emailed recently

    // Create confirm + remove tokens
    const { data: confirmToken } = await supabase
      .from("availability_token")
      .insert({
        candidate_public_id: c.id,
        company_id: c.uploaded_by_company_id,
        action: "confirm",
      })
      .select("id")
      .single();

    const { data: removeToken } = await supabase
      .from("availability_token")
      .insert({
        candidate_public_id: c.id,
        company_id: c.uploaded_by_company_id,
        action: "remove",
      })
      .select("id")
      .single();

    if (!confirmToken || !removeToken) continue;

    const confirmUrl = `${BASE_URL}/api/availability/confirm?token=${confirmToken.id}`;
    const removeUrl = `${BASE_URL}/api/availability/confirm?token=${removeToken.id}`;

    // Send notification to referring company
    await notifyCompany(c.uploaded_by_company_id, "ats_referral_prompt", {
      title: `Is ${c.role_applied_for} still available on pickt?`,
      body: `Please confirm this candidate is still available, or remove them from the marketplace.`,
      actionUrl: confirmUrl,
      actionLabel: "Confirm availability",
      candidateRole: c.role_applied_for,
      metadata: {
        candidate_id: c.id,
        confirm_url: confirmUrl,
        remove_url: removeUrl,
      },
    });

    sent++;
  }

  console.log(`[availability] Sent ${sent} check emails`);
  return sent;
}

// ── Main ────────────────────────────────────────────────────

export async function runAvailabilityCheck() {
  console.log("[availability] Starting availability check...");

  const marked = await markStaleUnconfirmed();
  const sent = await sendCheckEmails();

  console.log(`[availability] Done. Marked ${marked} unconfirmed, sent ${sent} emails.`);
  return { marked, sent };
}

// Run directly
if (typeof process !== "undefined" && process.argv[1]?.includes("availabilityCheck")) {
  runAvailabilityCheck()
    .then((result) => {
      console.log("[availability] Result:", result);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[availability] Error:", err);
      process.exit(1);
    });
}
