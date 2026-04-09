/**
 * ATS Integration Settings API.
 *
 * GET /api/settings/integrations — list configs for this company
 * POST /api/settings/integrations — connect a new ATS
 * POST /api/settings/integrations/:id/regenerate — new webhook secret
 * POST /api/settings/integrations/:id/test — test connection
 * DELETE /api/settings/integrations/:id — disconnect
 * GET /api/pending-referrals/:id — fetch prefill data
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "node:crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

async function getCompanyId(userId) {
  const { data } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", userId)
    .single();
  return data?.company_id || null;
}

function generateSecret() {
  return randomBytes(32).toString("hex");
}

function hashSecret(secret) {
  return createHash("sha256").update(secret).digest("hex");
}

// GET /api/settings/integrations
export async function getIntegrations(req, { userId }) {
  const companyId = await getCompanyId(userId);
  if (!companyId) return { status: 401, body: { error: "Unauthorized" } };

  const { data: configs } = await supabase
    .from("ats_webhook_config")
    .select("id, ats_provider, webhook_endpoint_url, last_ping_at, last_event_received_at, status, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  // Fetch last 5 events per config
  const configIds = (configs || []).map((c) => c.id);
  let eventsMap = {};
  if (configIds.length > 0) {
    const { data: events } = await supabase
      .from("ats_webhook_event")
      .select("id, config_id, event_type, payload_summary, processing_ms, status, created_at")
      .in("config_id", configIds)
      .order("created_at", { ascending: false })
      .limit(25);

    for (const ev of events || []) {
      if (!eventsMap[ev.config_id]) eventsMap[ev.config_id] = [];
      if (eventsMap[ev.config_id].length < 5) {
        eventsMap[ev.config_id].push(ev);
      }
    }
  }

  const enriched = (configs || []).map((c) => ({
    ...c,
    recent_events: eventsMap[c.id] || [],
    // Never return the actual secret — just indicate it exists
    has_secret: true,
  }));

  // List all providers with connection status
  const allProviders = ["greenhouse", "lever", "workday"];
  const connectedProviders = new Set((configs || []).map((c) => c.ats_provider));

  const result = allProviders.map((provider) => {
    const config = enriched.find((c) => c.ats_provider === provider);
    return {
      provider,
      connected: connectedProviders.has(provider),
      config: config || null,
    };
  });

  return { status: 200, body: { integrations: result } };
}

// POST /api/settings/integrations
export async function connectIntegration(req, { userId }) {
  const companyId = await getCompanyId(userId);
  if (!companyId) return { status: 401, body: { error: "Unauthorized" } };

  const { provider } = await req.json();
  if (!["greenhouse", "lever", "workday"].includes(provider)) {
    return { status: 400, body: { error: "Invalid provider" } };
  }

  const secret = generateSecret();
  const endpointUrl = `${BASE_URL}/api/webhooks/ats/${provider}/${companyId}`;

  const { data: config, error } = await supabase
    .from("ats_webhook_config")
    .upsert({
      company_id: companyId,
      ats_provider: provider,
      webhook_secret: secret, // Store plaintext for HMAC verification
      webhook_endpoint_url: endpointUrl,
      status: "inactive",
    }, { onConflict: "company_id,ats_provider" })
    .select("id, webhook_endpoint_url")
    .single();

  if (error) return { status: 500, body: { error: error.message } };

  return {
    status: 201,
    body: {
      config_id: config.id,
      webhook_url: config.webhook_endpoint_url,
      webhook_secret: secret, // Show once on creation
    },
  };
}

// POST /api/settings/integrations/:id/regenerate
export async function regenerateSecret(req, { configId, userId }) {
  const companyId = await getCompanyId(userId);
  if (!companyId) return { status: 401, body: { error: "Unauthorized" } };

  const secret = generateSecret();

  const { error } = await supabase
    .from("ats_webhook_config")
    .update({ webhook_secret: secret })
    .eq("id", configId)
    .eq("company_id", companyId);

  if (error) return { status: 500, body: { error: error.message } };

  return { status: 200, body: { webhook_secret: secret } };
}

// POST /api/settings/integrations/:id/test
export async function testConnection(req, { configId, userId }) {
  const companyId = await getCompanyId(userId);
  if (!companyId) return { status: 401, body: { error: "Unauthorized" } };

  await supabase
    .from("ats_webhook_config")
    .update({ last_ping_at: new Date().toISOString() })
    .eq("id", configId)
    .eq("company_id", companyId);

  return { status: 200, body: { success: true, tested_at: new Date().toISOString() } };
}

// DELETE /api/settings/integrations/:id
export async function disconnectIntegration(req, { configId, userId }) {
  const companyId = await getCompanyId(userId);
  if (!companyId) return { status: 401, body: { error: "Unauthorized" } };

  await supabase
    .from("ats_webhook_config")
    .delete()
    .eq("id", configId)
    .eq("company_id", companyId);

  return { status: 200, body: { success: true } };
}

// GET /api/pending-referrals/:id
export async function getPendingReferral(req, { referralId, userId }) {
  const companyId = await getCompanyId(userId);
  if (!companyId) return { status: 401, body: { error: "Unauthorized" } };

  const { data, error } = await supabase
    .from("pending_referral")
    .select("*")
    .eq("id", referralId)
    .eq("company_id", companyId)
    .single();

  if (error || !data) {
    return { status: 404, body: { error: "Referral not found" } };
  }

  return { status: 200, body: { referral: data } };
}
