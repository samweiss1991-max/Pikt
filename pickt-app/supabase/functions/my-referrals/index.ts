// Supabase Edge Function: my-referrals
// The referrer's dashboard: this company's referrals, each with its status
// (Referred / Hired / Paid), its OWN rate, and its OWN commission once hired.
// Never the total fee, the salary, another referrer's commission or Pickt's share.
//
// Deploy: supabase functions deploy my-referrals

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  const { data: userData } = await adminClient
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();
  if (!userData?.company_id) return json({ error: "User not found" }, 404);
  const companyId = userData.company_id;

  const { data: rows, error } = await adminClient
    .from("candidate_referrers")
    .select("candidate_id, referrer_position, referred_at")
    .eq("company_id", companyId)
    .order("referred_at", { ascending: false });
  if (error) return json({ error: error.message }, 500);
  if (!rows?.length) return json({ referrals: [] });

  const ids = rows.map((r) => r.candidate_id);

  const [candidates, rates, commissions, hires, unlocks] = await Promise.all([
    adminClient
      .from("candidates")
      .select("id, uploaded_by_company_id, role_applied_for, seniority_level, years_experience, location_city, location_state, location_state_code, location_country, experience_band, skills, interview_stage_reached, interviews_completed, salary_expectation_min, salary_expectation_max, strengths, recommendation")
      .in("id", ids),
    adminClient.from("commission_settings").select("referrer_position, referrer_rate"),
    // This company's own rows only. Salary is deliberately not selected.
    adminClient
      .from("commissions")
      .select("candidate_id, rate, amount, status, paid_at")
      .eq("referrer_company_id", companyId)
      .in("candidate_id", ids),
    adminClient.from("hires").select("candidate_id").in("candidate_id", ids),
    adminClient.from("candidate_unlocks").select("candidate_id").eq("status", "approved").in("candidate_id", ids),
  ]);

  const firstError = [candidates, rates, commissions, hires, unlocks].find((r) => r.error)?.error;
  if (firstError) return json({ error: firstError.message }, 500);

  const candidateById = new Map((candidates.data ?? []).map((c) => [c.id, c]));
  const rateByPosition = new Map((rates.data ?? []).map((r) => [r.referrer_position, r.referrer_rate]));
  const commissionByCandidate = new Map((commissions.data ?? []).map((c) => [c.candidate_id, c]));
  const hiredIds = new Set((hires.data ?? []).map((h) => h.candidate_id));
  const unlockCounts = new Map<string, number>();
  for (const u of unlocks.data ?? []) unlockCounts.set(u.candidate_id, (unlockCounts.get(u.candidate_id) ?? 0) + 1);

  return json({
    referrals: rows.map((r) => {
      const c = candidateById.get(r.candidate_id);
      const commission = commissionByCandidate.get(r.candidate_id);
      const wroteAssessment = c?.uploaded_by_company_id === companyId;
      return {
        candidateId: r.candidate_id,
        role: c?.role_applied_for ?? null,
        seniority: c?.seniority_level ?? null,
        years: c?.years_experience ?? null,
        experienceBand: c?.experience_band ?? null,
        city: c?.location_city ?? null,
        stateCode: c?.location_state_code ?? null,
        state: c?.location_state ?? null,
        country: c?.location_country ?? null,
        skills: c?.skills ?? [],
        stage: c?.interview_stage_reached ?? null,
        interviews: c?.interviews_completed ?? 0,
        salaryLow: c?.salary_expectation_min ?? null,
        salaryHigh: c?.salary_expectation_max ?? null,
        // The first referrer's own written assessment; not shown to the second
        strengths: wroteAssessment ? c?.strengths ?? null : null,
        recommendation: wroteAssessment ? c?.recommendation ?? null : null,
        referredAt: r.referred_at,
        position: r.referrer_position,
        rate: commission?.rate ?? rateByPosition.get(r.referrer_position) ?? null,
        status: commission?.status === "paid" ? "paid" : hiredIds.has(r.candidate_id) ? "hired" : "referred",
        commissionAmount: commission?.amount ?? null,
        paidAt: commission?.paid_at ?? null,
        unlocks: unlockCounts.get(r.candidate_id) ?? 0,
      };
    }),
  });
});
