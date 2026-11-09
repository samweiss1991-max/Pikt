// Supabase Edge Function: candidate-profile
// Returns one candidate's profile for the profile page.
//
// LOCKED (viewer's company hasn't unlocked): employer descriptions, stages,
// counts, activity and short feedback teasers only — no employer names,
// full feedback, outcome reasons or contact details ever leave the server.
// UNLOCKED: everything, including employer names and contact details.
//
// What goes in each version is decided by ../_shared/profileShape.js.
//
// Deploy: supabase functions deploy candidate-profile

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { shapeProfile } from "../_shared/profileShape.js";

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
  if (!userData) return json({ error: "User not found" }, 404);

  const { candidateId } = await req.json().catch(() => ({}));
  if (!candidateId) return json({ error: "candidateId is required" }, 400);

  const { data: candidate } = await adminClient
    .from("candidates")
    .select("*")
    .eq("id", candidateId)
    .single();
  if (!candidate) return json({ error: "Candidate not found" }, 404);

  // Unlocked only if THIS company has an approved unlock record
  const { data: unlock } = await adminClient
    .from("candidate_unlocks")
    .select("id")
    .eq("candidate_id", candidateId)
    .eq("requesting_company_id", userData.company_id)
    .eq("status", "approved")
    .maybeSingle();
  const unlocked = Boolean(unlock);

  const { data: interviewRows, error: interviewsError } = await adminClient
    .from("candidate_interviews")
    .select("id, employer_company_id, employer_industry, employer_location, stage_reached, stage_rank, interviews_completed, feedback, outcome_reason, feedback_teaser, outcome, outcome_other, strengths_list, development_areas, note_impressed, note_why_not_offer, note_best_fit")
    .eq("candidate_id", candidateId);
  if (interviewsError) return json({ error: interviewsError.message }, 500);

  let interviews = interviewRows ?? [];

  // Employer names are looked up only for unlocked viewers
  if (unlocked && interviews.length > 0) {
    const ids = [...new Set(interviews.map((r) => r.employer_company_id))];
    const { data: companies } = await adminClient
      .from("companies")
      .select("id, name")
      .in("id", ids);
    const names = new Map((companies ?? []).map((co) => [co.id, co.name]));
    interviews = interviews.map((r) => ({ ...r, employer_name: names.get(r.employer_company_id) ?? null }));
  }

  // Hire details: full figures go only to the company that made the hire
  const { data: hireRow } = await adminClient
    .from("hires")
    .select("hiring_company_id, start_date, first_year_salary, total_fee_percentage, total_fee_amount")
    .eq("candidate_id", candidateId)
    .maybeSingle();

  // Fee rules: a candidate's referrers get only their own rate; everyone else
  // gets only the total. Nobody here gets Pickt's share.
  const { data: referrerRows } = await adminClient
    .from("candidate_referrers")
    .select("company_id, referrer_position")
    .eq("candidate_id", candidateId);

  const ownReferral = (referrerRows ?? []).find((r) => r.company_id === userData.company_id);
  const viewerIsReferrer = Boolean(ownReferral) || candidate.uploaded_by_company_id === userData.company_id;

  let fee: number | null = null;
  let viewerReferrer: { position: number; rate: number } | null = null;

  if (ownReferral) {
    const { data: rateRow } = await adminClient
      .from("commission_settings")
      .select("referrer_rate")
      .eq("referrer_position", ownReferral.referrer_position)
      .single();
    viewerReferrer = { position: ownReferral.referrer_position, rate: rateRow?.referrer_rate ?? null };
  } else if (!viewerIsReferrer) {
    const { data: total } = await adminClient.rpc("employer_fee_for", {
      p_referrer_count: Math.max(1, referrerRows?.length ?? 0),
    });
    fee = total ?? null;
  }

  // shapeProfile drops everything a locked viewer must not see
  return json(shapeProfile({
    candidate,
    interviews,
    unlocked,
    fee,
    viewerIsReferrer,
    viewerReferrer,
    isHired: Boolean(hireRow),
    hire: hireRow && hireRow.hiring_company_id === userData.company_id ? hireRow : null,
  }));
});
