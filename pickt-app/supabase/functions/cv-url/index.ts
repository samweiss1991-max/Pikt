// Supabase Edge Function: cv-url
// Generates short-lived signed Storage URLs for candidate CVs. This is the only way
// to reach a CV: only the candidate's referrers and employers who have unlocked them.
// Requires service role key (createSignedUrl is not available to anon).
//
// Deploy: supabase functions deploy cv-url

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOCUMENTS_BUCKET, storagePathFrom } from "../_shared/uploads.ts";

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

  // Fetch candidate (only the fields we need)
  const { data: candidate } = await adminClient
    .from("candidates")
    .select("id, uploaded_by_company_id, cv_file_url, cv_filename")
    .eq("id", candidateId)
    .single();

  if (!candidate) {
    return new Response(JSON.stringify({ error: "Candidate not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Must be one of the candidate's referrers, or have an unlock record
  const { data: referral } = await adminClient
    .from("candidate_referrers")
    .select("id")
    .eq("candidate_id", candidateId)
    .eq("company_id", userData.company_id)
    .maybeSingle();
  const isReferrer = Boolean(referral) || candidate.uploaded_by_company_id === userData.company_id;

  if (!isReferrer) {
    const { data: unlock } = await adminClient
      .from("candidate_unlocks")
      .select("id")
      .eq("candidate_id", candidateId)
      .eq("requesting_company_id", userData.company_id)
      .eq("status", "approved")
      .maybeSingle();

    if (!unlock) {
      return new Response(
        JSON.stringify({ error: "Unlock this candidate before accessing their CV." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  const cvPath = storagePathFrom(candidate.cv_file_url);
  if (!cvPath) {
    return new Response(JSON.stringify({ error: "No CV available" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Generate signed URL (1 hour expiry)
  const { data: signedUrl, error } = await adminClient.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(cvPath, 3600);

  if (error || !signedUrl) {
    return new Response(
      JSON.stringify({ error: "Failed to generate download URL" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

  return new Response(
    JSON.stringify({
      signedUrl: signedUrl.signedUrl,
      expiresAt,
      filename: candidate.cv_filename || null,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
