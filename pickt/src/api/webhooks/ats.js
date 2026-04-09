/**
 * ATS Webhook Receiver.
 *
 * POST /api/webhooks/ats/:provider/:company_id
 * Verifies HMAC signature per provider, processes events,
 * creates pending referrals for archived/rejected candidates.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { auditLog } from "../../middleware/auditLog.js";
import { notifyCompany } from "../../lib/notifications.js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const REJECTION_KEYWORDS = [
  "archived", "rejected", "no_hire", "not_moving_forward",
  "declined", "passed", "not_selected", "withdrawn",
];

// ── Signature verification ──────────────────────────────────

function verifyGreenhouseSignature(payload, signature, secret) {
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch { return false; }
}

function verifyLeverSignature(payload, signature, secret) {
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch { return false; }
}

function verifyWorkdayToken(authHeader, secret) {
  const token = authHeader?.replace("Bearer ", "");
  if (!token || !secret) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch { return false; }
}

function getSignature(headers, provider) {
  switch (provider) {
    case "greenhouse": return headers["x-greenhouse-signature"] || "";
    case "lever": return headers["x-lever-signature"] || "";
    case "workday": return headers["authorization"] || "";
    default: return "";
  }
}

function verifySignature(provider, payload, signature, secret) {
  switch (provider) {
    case "greenhouse": return verifyGreenhouseSignature(payload, signature, secret);
    case "lever": return verifyLeverSignature(payload, signature, secret);
    case "workday": return verifyWorkdayToken(signature, secret);
    default: return false;
  }
}

// ── Event extraction per provider ───────────────────────────

function extractEvent(provider, body) {
  switch (provider) {
    case "greenhouse": return {
      eventType: body.action || body.event_type || "",
      candidateId: body.payload?.candidate?.id?.toString() || "",
      candidateName: [body.payload?.candidate?.first_name, body.payload?.candidate?.last_name].filter(Boolean).join(" "),
      role: body.payload?.job?.name || body.payload?.application?.job?.name || "",
      reason: body.payload?.rejection_reason?.name || body.payload?.candidate?.rejection_reason || "",
      stage: body.payload?.current_stage?.name || body.payload?.application?.current_stage?.name || "",
    };
    case "lever": return {
      eventType: body.event || "",
      candidateId: body.data?.candidateId || body.data?.opportunityId || "",
      candidateName: body.data?.contact?.name || "",
      role: body.data?.posting?.text || "",
      reason: body.data?.stageChange?.toStage?.text || body.data?.archiveReason?.text || "",
      stage: body.data?.stageChange?.toStage?.text || "",
    };
    case "workday": return {
      eventType: body.eventType || body.event || "",
      candidateId: body.candidate?.id || "",
      candidateName: body.candidate?.name || "",
      role: body.requisition?.title || "",
      reason: body.dispositionReason || "",
      stage: body.stage || "",
    };
    default: return { eventType: "", candidateId: "", candidateName: "", role: "", reason: "", stage: "" };
  }
}

function isRejectionEvent(event) {
  const combined = `${event.eventType} ${event.stage} ${event.reason}`.toLowerCase();
  return REJECTION_KEYWORDS.some((kw) => combined.includes(kw));
}

// ── Main handler ────────────────────────────────────────────

export async function handleAtsWebhook(req, { provider, companyId }) {
  const startTime = Date.now();

  // 1. Fetch webhook config
  const { data: config } = await supabase
    .from("ats_webhook_config")
    .select("id, webhook_secret, status")
    .eq("company_id", companyId)
    .eq("ats_provider", provider)
    .single();

  if (!config || config.status === "inactive") {
    return { status: 404, body: { error: "Webhook not configured" } };
  }

  // 2. Read body
  const rawBody = await req.text();
  const headers = Object.fromEntries(
    req.headers instanceof Headers
      ? req.headers.entries()
      : Object.entries(req.headers || {})
  );

  // 3. Verify signature
  const signature = getSignature(headers, provider);
  const valid = verifySignature(provider, rawBody, signature, config.webhook_secret);

  if (!valid) {
    auditLog("ats_import_triggered", null, req, {
      provider,
      company_id: companyId,
      error: "invalid_signature",
    });

    await supabase.from("ats_webhook_event").insert({
      config_id: config.id,
      event_type: "signature_failed",
      payload_summary: "Invalid HMAC signature",
      processing_ms: Date.now() - startTime,
      status: "error",
    });

    return { status: 401, body: { error: "Invalid signature" } };
  }

  // 4. Parse event
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: "Invalid JSON" } };
  }

  const event = extractEvent(provider, body);

  // 5. Update last_event_received_at
  await supabase
    .from("ats_webhook_config")
    .update({ last_event_received_at: new Date().toISOString(), status: "active" })
    .eq("id", config.id);

  // 6. Process rejection events
  let eventStatus = "ignored";

  if (isRejectionEvent(event)) {
    eventStatus = "processed";

    // Create pending referral
    const { data: referral } = await supabase
      .from("pending_referral")
      .insert({
        company_id: companyId,
        ats_provider: provider,
        ats_candidate_id: event.candidateId,
        ats_candidate_name: event.candidateName,
        ats_role: event.role,
        ats_rejection_reason: event.reason,
        ats_raw_payload: body,
      })
      .select("id")
      .single();

    // Notify company
    if (referral) {
      notifyCompany(companyId, "ats_referral_prompt", {
        title: `Ready to refer ${event.candidateName || "a candidate"} to pickt?`,
        body: `${event.candidateName || "A candidate"} was archived in ${provider} for ${event.reason || "unspecified reason"}.`,
        actionUrl: `/upload?prefill=${referral.id}`,
        actionLabel: "Start referral",
        candidateRole: event.role,
        metadata: { pending_referral_id: referral.id, provider },
      });
    }

    auditLog("ats_import_triggered", null, req, {
      provider,
      company_id: companyId,
      candidate_name: event.candidateName,
      role: event.role,
      reason: event.reason,
    });
  }

  // 7. Log event
  await supabase.from("ats_webhook_event").insert({
    config_id: config.id,
    event_type: event.eventType || "unknown",
    payload_summary: `${event.candidateName || "Unknown"} — ${event.role || "Unknown role"} — ${event.reason || event.stage || ""}`.slice(0, 200),
    processing_ms: Date.now() - startTime,
    status: eventStatus,
  });

  return { status: 200, body: { received: true } };
}
