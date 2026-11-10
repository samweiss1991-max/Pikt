// Supabase Edge Function: unlock-candidate
// Creates an unlock record and notifies the referrers. Owners and Admins only:
// Members use company-requests to ask for approval.
//
// Deploy: supabase functions deploy unlock-candidate

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { companyAccess } from "../_shared/companyAccess.ts";
import { notifyReferrers } from "../_shared/notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const access = await companyAccess(adminClient, user.id);
  if (!access.companyId) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  // Only roles allowed to unlock, however the request reaches this function
  if (!access.perms.unlock) {
    return new Response(
      JSON.stringify({ code: "approval_required", error: "You don't have permission to unlock profiles. Please request an unlock instead." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const userData = { company_id: access.companyId };

  const { candidateId } = await req.json();

  if (!candidateId) {
    return new Response(JSON.stringify({ error: "candidateId is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check candidate exists
  const { data: candidate } = await adminClient
    .from("candidates_public")
    .select("id, uploaded_by_company_id")
    .eq("id", candidateId)
    .single();

  if (!candidate) {
    return new Response(JSON.stringify({ error: "Candidate not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Can't unlock a candidate your company referred (1st or 2nd referrer), so a
  // company can't earn commission on its own hire
  const { data: ownReferral } = await adminClient
    .from("candidate_referrers")
    .select("id")
    .eq("candidate_id", candidateId)
    .eq("company_id", userData.company_id)
    .maybeSingle();

  if (candidate.uploaded_by_company_id === userData.company_id || ownReferral) {
    return new Response(
      JSON.stringify({ error: "You cannot unlock a candidate your company referred" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Create unlock record
  const unlockedAt = new Date().toISOString();
  const { data: unlock, error } = await adminClient
    .from("candidate_unlocks")
    .insert({
      candidate_id: candidateId,
      requesting_company_id: userData.company_id,
      status: "approved",
      unlocked_at: unlockedAt,
      approved_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return new Response(JSON.stringify({ error: "Already unlocked" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Post-unlock side effects (best-effort) ──────────────

  // Tell every referrer (1st and 2nd). No fee or commission figures.
  await notifyReferrers(adminClient, candidateId, {
    kind: "referral_status",
    pref: "referral_status",
    title: "A candidate you referred has been unlocked",
    body: "If they're hired, you'll earn your commission on their first-year salary.",
    link: "/my-candidates",
  });

  return new Response(
    JSON.stringify({
      unlockId: unlock.id,
      candidateId,
      unlockedAt,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
