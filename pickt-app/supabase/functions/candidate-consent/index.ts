// Supabase Edge Function: candidate-consent  (Stage 5A)
// The page a referred candidate reaches from their email, plus the daily run.
//
//   view     { token }          who referred them and what's shared (no login needed)
//   respond  { token, choice }  "yes" makes the profile live; "no" deletes their details
//   daily    (x-cron-secret)    14-day reminder, 30-day deletion
//
// No login is needed: the link's secret is the proof. Deploy with --no-verify-jwt.
// Secrets: RESEND_API_KEY, EMAIL_FROM, CONSENT_CRON_SECRET (for the daily run).
//
// Deploy: supabase functions deploy candidate-consent --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  EXPIRE_AFTER_DAYS, makeLive, referrerNames, removeCandidate, REMINDER_AFTER_DAYS, requestForToken, sendConsentEmail,
} from "../_shared/consent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
const DAY = 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));

  try {
    // ---------- The daily run ----------
    if (body.action === "daily") {
      const secret = Deno.env.get("CONSENT_CRON_SECRET");
      if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "Unauthorized" }, 401);
      const { data: pending } = await admin.from("candidate_consent_requests")
        .select("candidate_id, first_sent_at, reminder_sent_at, site_url, candidates!inner(consent_status)")
        .is("decided_at", null).eq("candidates.consent_status", "awaiting");
      const now = Date.now();
      let reminded = 0, expired = 0;
      for (const r of pending ?? []) {
        const age = now - new Date(r.first_sent_at).getTime();
        if (age >= EXPIRE_AFTER_DAYS * DAY) {
          await removeCandidate(admin, r.candidate_id, "expired");
          await admin.from("candidate_consent_requests").update({ decided_at: new Date().toISOString(), decision: "expired" }).eq("candidate_id", r.candidate_id);
          expired++;
        } else if (age >= REMINDER_AFTER_DAYS * DAY && !r.reminder_sent_at) {
          const result = await sendConsentEmail(admin, r.candidate_id, r.site_url, { reminder: true });
          if (result.sent) reminded++;
        }
      }
      return json({ checked: pending?.length ?? 0, reminded, expired });
    }

    // ---------- The candidate's page ----------
    const request = await requestForToken(admin, body.token);
    if (!request) return json({ state: "invalid" });
    const { data: c } = await admin.from("candidates").select("id, full_name, role_applied_for, consent_status").eq("id", request.candidate_id).maybeSingle();
    if (!c) return json({ state: "invalid" });

    // Past the 30 days but the daily run hasn't caught it yet
    if (c.consent_status === "awaiting" && Date.now() - new Date(request.first_sent_at).getTime() >= EXPIRE_AFTER_DAYS * DAY) {
      await removeCandidate(admin, c.id, "expired");
      await admin.from("candidate_consent_requests").update({ decided_at: new Date().toISOString(), decision: "expired" }).eq("candidate_id", c.id);
      return json({ state: "expired" });
    }
    if (c.consent_status === "live") return json({ state: "live" });
    if (c.consent_status !== "awaiting") return json({ state: c.consent_status === "expired" ? "expired" : "declined" });

    if (body.action === "view") {
      return json({
        state: "awaiting",
        firstName: (c.full_name || "").trim().split(/\s+/)[0] || null,
        role: c.role_applied_for,
        companies: await referrerNames(admin, c.id),
      });
    }

    if (body.action === "respond") {
      if (!["yes", "no"].includes(body.choice)) return json({ error: "Choose yes or no." }, 400);
      if (body.choice === "yes") await makeLive(admin, c.id);
      else await removeCandidate(admin, c.id, "declined");
      await admin.from("candidate_consent_requests").update({ decided_at: new Date().toISOString(), decision: body.choice }).eq("candidate_id", c.id);
      return json({ state: body.choice === "yes" ? "live" : "declined" });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[candidate-consent]", err);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
