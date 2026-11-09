// Supabase Edge Function: referral-status
// Powers the "Refer this candidate" screen. Given an email and mobile, says what
// this company would be if it referred them, and sends ONLY the rate for that
// position. Never the total fee, never Pickt's share, never another position's rate.
//
// state:
//   open    can refer: { position, rate, spotsLeft, referrers, salaryLow, salaryHigh }
//   yours   this company already referred them: { position, rate }
//   full    no spots left: { candidateId } (so they can write a testimonial)
//   hired   already hired, no more referrals
//   review  email and mobile match different candidates
//
// Deploy: supabase functions deploy referral-status

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { identityHash, normaliseEmail, normaliseMobile } from "../_shared/identity.ts";

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

  const body = await req.json().catch(() => ({}));
  const email = normaliseEmail(body.email);
  const mobile = normaliseMobile(body.mobile);
  if (!email || !mobile) {
    return json({ error: "Enter the candidate's email and mobile number." }, 400);
  }

  let emailHash: string | null;
  let mobileHash: string | null;
  try {
    emailHash = await identityHash("email", email);
    mobileHash = await identityHash("mobile", mobile);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }

  const { data: matches, error: matchError } = await adminClient
    .from("candidates")
    .select("id, salary_expectation_min, salary_expectation_max")
    .or(`email_hash.eq.${emailHash},mobile_hash.eq.${mobileHash}`)
    .limit(10);
  if (matchError) return json({ error: matchError.message }, 500);

  if ((matches ?? []).length > 1) return json({ state: "review" });

  // Only referrer rates are ever selected here
  const { data: rates, error: ratesError } = await adminClient
    .from("commission_settings")
    .select("referrer_position, referrer_rate")
    .order("referrer_position");
  if (ratesError) return json({ error: ratesError.message }, 500);
  const rateFor = (position: number) =>
    (rates ?? []).find((r) => r.referrer_position === position)?.referrer_rate ?? null;
  const maxReferrers = (rates ?? []).length;

  const existing = matches?.[0];

  // Not on Pickt yet: this company would be the 1st referrer
  if (!existing) {
    return json({
      state: "open",
      position: 1,
      rate: rateFor(1),
      spotsLeft: maxReferrers,
      referrers: [],
      salaryLow: null,
      salaryHigh: null,
      matchesCandidate: !body.candidateId,
    });
  }

  const matchesCandidate = !body.candidateId || body.candidateId === existing.id;

  const { data: referrerRows, error: referrerError } = await adminClient
    .from("candidate_referrers")
    .select("company_id, referrer_position, companies(name)")
    .eq("candidate_id", existing.id)
    .order("referrer_position");
  if (referrerError) return json({ error: referrerError.message }, 500);
  const referrers = referrerRows ?? [];

  const own = referrers.find((r) => r.company_id === companyId);
  if (own) {
    return json({ state: "yours", position: own.referrer_position, rate: rateFor(own.referrer_position), matchesCandidate });
  }

  const { data: hire } = await adminClient
    .from("hires")
    .select("id")
    .eq("candidate_id", existing.id)
    .maybeSingle();
  if (hire) return json({ state: "hired", matchesCandidate });

  const nextPosition = referrers.length + 1;
  if (nextPosition > maxReferrers) {
    return json({ state: "full", candidateId: existing.id, matchesCandidate });
  }

  return json({
    state: "open",
    position: nextPosition,
    rate: rateFor(nextPosition),
    spotsLeft: maxReferrers - referrers.length,
    referrers: referrers.map((r) => (r.companies as unknown as { name: string })?.name).filter(Boolean),
    salaryLow: existing.salary_expectation_min ?? null,
    salaryHigh: existing.salary_expectation_max ?? null,
    matchesCandidate,
  });
});
