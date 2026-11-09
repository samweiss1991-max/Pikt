// Supabase Edge Function: admin-commissions
// Pickt admins only. This is the ONLY place Pickt's share of a commission ever
// leaves the server. Every request first checks the caller is in pickt_admins.
//
// Actions (POST body { action, ... }):
//   list                                        all commissions + open reviews
//   mark_paid      { commissionId }             pending → paid
//   correct_hire   { hireId, salary, startDate } fix a mistake (until anything is paid)
//   resolve_review { reviewId }                 close an identity review
//
// Deploy: supabase functions deploy admin-commissions

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

  const { data: admin } = await adminClient
    .from("pickt_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!admin) return json({ error: "You don't have access to this page." }, 403);

  const body = await req.json().catch(() => ({}));

  switch (body.action) {
    case "list": {
      const { data: commissions, error } = await adminClient
        .from("admin_commission_report")
        .select("*")
        .order("created_at", { ascending: false })
        .order("referrer_position", { ascending: true });
      if (error) return json({ error: error.message }, 500);

      const { data: reviewRows, error: reviewError } = await adminClient
        .from("referral_identity_reviews")
        .select("id, company_id, email_match_candidate_id, mobile_match_candidate_id, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (reviewError) return json({ error: reviewError.message }, 500);

      const companyIds = [...new Set((reviewRows ?? []).map((r) => r.company_id))];
      const { data: companies } = companyIds.length
        ? await adminClient.from("companies").select("id, name").in("id", companyIds)
        : { data: [] };
      const names = new Map((companies ?? []).map((c) => [c.id, c.name]));

      return json({
        commissions: commissions ?? [],
        reviews: (reviewRows ?? []).map((r) => ({ ...r, company_name: names.get(r.company_id) ?? null })),
      });
    }

    case "mark_paid": {
      if (!body.commissionId) return json({ error: "commissionId is required" }, 400);
      const { data, error } = await adminClient
        .from("commissions")
        .update({ status: "paid", paid_at: new Date().toISOString(), paid_by: user.id })
        .eq("id", body.commissionId)
        .eq("status", "pending")
        .select("id");
      if (error) return json({ error: error.message }, 500);
      if (!data?.length) return json({ error: "This commission isn't pending." }, 409);
      return json({ success: true });
    }

    case "correct_hire": {
      const salary = Number(body.salary);
      if (!body.hireId || !Number.isFinite(salary) || salary <= 0 || salary > 9_999_999) {
        return json({ error: "Enter a valid salary." }, 400);
      }
      if (typeof body.startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.startDate)) {
        return json({ error: "Enter a valid start date." }, 400);
      }
      const { error } = await adminClient.rpc("correct_hire", {
        p_hire_id: body.hireId,
        p_admin_id: user.id,
        p_salary: salary,
        p_start_date: body.startDate,
      });
      if (error) {
        if (error.message.includes("commission_already_paid")) {
          return json({ error: "A commission on this hire has already been paid, so it can't be corrected here." }, 409);
        }
        return json({ error: error.message }, 500);
      }
      return json({ success: true });
    }

    case "resolve_review": {
      if (!body.reviewId) return json({ error: "reviewId is required" }, 400);
      const { error } = await adminClient
        .from("referral_identity_reviews")
        .update({ status: "resolved", resolved_by: user.id, resolved_at: new Date().toISOString() })
        .eq("id", body.reviewId);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    default:
      return json({ error: "Unknown action" }, 400);
  }
});
