// Supabase Edge Function: dashboard
// The Dashboard's sections, each requested separately, plus two small actions:
// marking an unlocked candidate contacted/interviewing, and noting that someone
// opened their saved search. Own company only; permissions are checked here.
//
// Deploy: supabase functions deploy dashboard

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { companyAccess } from "../_shared/companyAccess.ts";
import { activity, attention, matches, pipeline, referrals, roleCriteria, saved, summary, unlockedList, type Ctx } from "./sections.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const SECTIONS: Record<string, (ctx: Ctx) => Promise<unknown>> = { summary, attention, pipeline, matches, referrals, activity, saved };
const STAGES = ["unlocked", "contacted", "interviewing"];
const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const access = await companyAccess(admin, user.id);
  if (!access.companyId) return json({ error: "This login isn't part of a company." }, 403);
  const body = await req.json().catch(() => ({}));

  // The person's own month start (sent by the page); otherwise the start of this month in UTC
  const now = new Date();
  const sent = new Date(body.monthStart);
  const monthStart = !isNaN(sent.getTime()) && Math.abs(now.getTime() - sent.getTime()) < 32 * 24 * 3600 * 1000
    ? sent
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const ctx: Ctx = {
    admin,
    userId: user.id,
    access: { companyId: access.companyId, role: access.role as string, perms: access.perms },
    now,
    monthStart,
    // The same view the Marketplace reads, as this user: no private details
    loadPool: async (columns: string) => {
      const { data, error } = await userClient.from("candidates_public").select(columns).limit(5000);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  };

  try {
    if (body.action === "section") {
      const fn = SECTIONS[body.section];
      if (!fn) return json({ error: "Unknown section" }, 400);
      return json(await fn(ctx));
    }

    if (body.action === "unlocked") {
      const result = await unlockedList(ctx, {
        roleId: UUID.test(body.roleId ?? "") ? body.roleId : undefined,
        stage: typeof body.stage === "string" ? body.stage : undefined,
      });
      return "error" in result ? json({ error: "That role wasn't found." }, 404) : json(result);
    }

    if (body.action === "role") {
      if (!UUID.test(body.id ?? "")) return json({ error: "That role wasn't found." }, 404);
      const role = await roleCriteria(ctx, body.id);
      if (!role) return json({ error: "That role wasn't found." }, 404);
      // Opening your own saved search clears its "new matches"
      if (role.mine) await admin.rpc("mark_saved_search_seen", { p_user: user.id, p_search: role.id });
      return json(role);
    }

    if (body.action === "set_stage") {
      if (!UUID.test(body.candidateId ?? "") || !STAGES.includes(body.stage)) return json({ error: "Choose a valid status." }, 400);
      const { data, error } = await admin.rpc("set_unlock_stage", { p_user: user.id, p_candidate: body.candidateId, p_stage: body.stage });
      if (error) {
        return error.message.includes("not_unlocked")
          ? json({ error: "Your company needs to unlock this candidate first." }, 403)
          : json({ error: "Could not save that. Please try again." }, 500);
      }
      return json({ success: true, contactedAt: data?.contacted_at ?? null, interviewingAt: data?.interviewing_at ?? null });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[dashboard]", err);
    return json({ error: "This section couldn't load. Please try again." }, 500);
  }
});
