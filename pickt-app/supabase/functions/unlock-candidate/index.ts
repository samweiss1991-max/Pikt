// Supabase Edge Function: unlock-candidate
// Creates an unlock record, sends an email notification via Resend,
// and triggers an ATS push (best-effort).
//
// Deploy: supabase functions deploy unlock-candidate

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

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

  const { data: userData } = await adminClient
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!userData) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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

  // Tell every referrer (1st and 2nd). No fee or commission figures in this email.
  if (resendApiKey) {
    try {
      const { data: referrers } = await adminClient
        .from("candidate_referrers")
        .select("company_id")
        .eq("candidate_id", candidateId);

      const { data: requestingCompany } = await adminClient
        .from("companies")
        .select("name")
        .eq("id", userData.company_id)
        .single();

      for (const referrer of referrers ?? []) {
        const { data: referringCompany } = await adminClient
          .from("companies")
          .select("name")
          .eq("id", referrer.company_id)
          .single();

        const { data: referringAdmin } = await adminClient
          .from("users")
          .select("email, full_name")
          .eq("company_id", referrer.company_id)
          .eq("role", "admin")
          .limit(1)
          .maybeSingle();

        if (referringAdmin?.email) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "pickt <notifications@pickt.com>",
              to: referringAdmin.email,
              subject: "A candidate you referred has been unlocked",
              html: `
                <p>Hi ${referringAdmin.full_name || referringCompany?.name || "there"},</p>
                <p><strong>${requestingCompany?.name || "A company"}</strong> has unlocked one of your referred candidates on pickt.</p>
                <p>If they hire this candidate, you'll earn your commission on their first-year salary.</p>
                <p>— The pickt team</p>
              `,
            }),
          });
        }
      }
    } catch {
      // Notification is best-effort
    }
  }

  return new Response(
    JSON.stringify({
      unlockId: unlock.id,
      candidateId,
      unlockedAt,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
