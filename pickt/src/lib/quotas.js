/**
 * Plan quotas and usage tracking.
 *
 * Monthly quotas by plan:
 *   Free: 20 CV parses, 10 unlocks
 *   Pro: 200 CV parses, unlimited unlocks
 *
 * On quota exceeded: returns 402 with upgrade_url.
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PLAN_QUOTAS = {
  free: {
    cv_parse: 20,
    unlock: 10,
    ats_import: 50,
    api_call: 10000,
  },
  starter: {
    cv_parse: 100,
    unlock: 50,
    ats_import: 200,
    api_call: 50000,
  },
  pro: {
    cv_parse: 200,
    unlock: Infinity,
    ats_import: Infinity,
    api_call: Infinity,
  },
  enterprise: {
    cv_parse: Infinity,
    unlock: Infinity,
    ats_import: Infinity,
    api_call: Infinity,
  },
};

/**
 * Check if a company has quota remaining for a metric type.
 * If yes, increments the counter and returns { allowed: true, remaining }.
 * If no, returns { allowed: false, error, upgrade_url }.
 *
 * @param {string} companyId
 * @param {string} metricType - 'cv_parse' | 'unlock' | 'ats_import' | 'api_call'
 * @returns {object}
 */
export async function checkAndIncrementQuota(companyId, metricType) {
  // Get company plan
  const { data: company } = await supabase
    .from("companies")
    .select("plan")
    .eq("id", companyId)
    .single();

  const plan = company?.plan || "free";
  const quotas = PLAN_QUOTAS[plan] || PLAN_QUOTAS.free;
  const limit = quotas[metricType];

  if (limit === Infinity) {
    // Unlimited — just increment for tracking
    await supabase.rpc("increment_usage", {
      p_company_id: companyId,
      p_metric_type: metricType,
    });
    return { allowed: true, remaining: Infinity };
  }

  // Check current usage
  const { data: currentUsage } = await supabase.rpc("get_usage", {
    p_company_id: companyId,
    p_metric_type: metricType,
  });

  const used = currentUsage || 0;

  if (used >= limit) {
    const labels = {
      cv_parse: "CV parses",
      unlock: "profile unlocks",
      ats_import: "ATS imports",
      api_call: "API calls",
    };
    return {
      allowed: false,
      error: `Monthly ${labels[metricType] || metricType} limit reached (${limit}/${plan} plan). Upgrade for more.`,
      upgrade_url: "/billing",
      used,
      limit,
    };
  }

  // Increment
  await supabase.rpc("increment_usage", {
    p_company_id: companyId,
    p_metric_type: metricType,
  });

  return {
    allowed: true,
    remaining: limit - used - 1,
    used: used + 1,
    limit,
  };
}

/**
 * Get all usage metrics for a company (for dashboard display).
 */
export async function getCompanyUsage(companyId) {
  const { data: company } = await supabase
    .from("companies")
    .select("plan")
    .eq("id", companyId)
    .single();

  const plan = company?.plan || "free";
  const quotas = PLAN_QUOTAS[plan] || PLAN_QUOTAS.free;

  const metrics = {};
  for (const type of Object.keys(quotas)) {
    const { data: usage } = await supabase.rpc("get_usage", {
      p_company_id: companyId,
      p_metric_type: type,
    });
    metrics[type] = {
      used: usage || 0,
      limit: quotas[type],
      remaining: quotas[type] === Infinity ? Infinity : quotas[type] - (usage || 0),
    };
  }

  return { plan, metrics };
}
