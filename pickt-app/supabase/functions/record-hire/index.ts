// Supabase Edge Function: record-hire
// The hiring employer records a hire: start date and actual first-year salary
// (base + super, all inclusive). The database then works out every commission
// (record_hire, migration 030).
//
// Returns only what the employer may see: the total fee. Never the split
// between referrers and Pickt.
//
// Deploy: supabase functions deploy record-hire

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { companyAccess } from "../_shared/companyAccess.ts";
import { notifyReferrers } from "../_shared/notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const MAX_SALARY = 9_999_999;

const KNOWN_ERRORS: Record<string, { status: number; error: string }> = {
  not_unlocked: { status: 403, error: "You need to unlock this candidate before recording a hire." },
  own_referral: { status: 403, error: "Your company referred this candidate, so it can't record their hire. Please contact Pickt." },
  already_hired: { status: 409, error: "A hire has already been recorded for this candidate." },
  candidate_not_found: { status: 404, error: "Candidate not found." },
  no_referrer: { status: 409, error: "This candidate has no referrer on record. Please contact Pickt." },
  invalid_salary: { status: 400, error: "Enter a valid first-year salary." },
  invalid_start_date: { status: 400, error: "Enter a valid start date." },
};

function isRealDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const access = await companyAccess(adminClient, user.id);
  if (!access.companyId) return json({ error: "User not found" }, 404);
  // Only roles allowed to record hires, however the request reaches this function
  if (!access.perms.record_hire) {
    return json({ code: "approval_required", error: "You don't have permission to record hires. Please request hire approval instead." }, 403);
  }

  const { candidateId, salary, startDate } = await req.json().catch(() => ({}));
  if (!candidateId) return json({ error: "candidateId is required" }, 400);

  const salaryNumber = Number(salary);
  if (!Number.isFinite(salaryNumber) || salaryNumber <= 0 || salaryNumber > MAX_SALARY) {
    return json({ error: KNOWN_ERRORS.invalid_salary.error }, 400);
  }
  if (!isRealDate(startDate)) return json({ error: KNOWN_ERRORS.invalid_start_date.error }, 400);

  const { data, error } = await adminClient.rpc("record_hire", {
    p_candidate_id: candidateId,
    p_company_id: access.companyId,
    p_user_id: user.id,
    p_salary: salaryNumber,
    p_start_date: startDate,
  });

  if (error) {
    const code = Object.keys(KNOWN_ERRORS).find((k) => error.message.includes(k));
    if (code) return json({ code, error: KNOWN_ERRORS[code].error }, KNOWN_ERRORS[code].status);
    console.error("[record-hire] failed:", error.message);
    return json({ error: "Could not record this hire. Please try again." }, 500);
  }

  await notifyReferrers(adminClient, candidateId, {
    kind: "referral_status",
    pref: "referral_status",
    title: "A candidate you referred has been hired",
    body: "See Billing & unlocks for your commission.",
    link: "/account?tab=billing",
  });

  return json({
    hireId: data.hire_id,
    totalFeePercentage: data.total_fee_percentage,
    totalFeeAmount: data.total_fee_amount,
  });
});
