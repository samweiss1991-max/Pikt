// Supabase Edge Function: account
// The signed-in person's profile, preferences, team, notifications and billing.
// Everything is limited to their own account and their own company.
//
// Deploy: supabase functions deploy account

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { companyAccess, PERMISSIONS } from "../_shared/companyAccess.ts";
import { placementsFor, placementsCsv } from "./placements.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const HOMEPAGES = ["marketplace", "my-candidates", "shortlist", "refer", "dashboard"];
const VIEWS = ["stack", "carousel", "matrix", "tinder", "focus"];
const EMAIL_PREFS = ["saved_search_matches", "referral_status", "request_outcomes", "hire_commission", "new_requests"];
const TEAM_ERRORS: Record<string, string> = {
  not_allowed: "You don't have permission to do that.",
  not_in_company: "That person isn't in your company.",
  owners_only: "Only an Owner can change or remove an Owner.",
  last_owner: "A company must keep at least one Owner.",
  invalid_role: "Choose a valid role.",
};
const OWNER_ONLY = "Only your company's Owner can manage access.";
const teamError = (message: string) => {
  const code = Object.keys(TEAM_ERRORS).find((k) => message.includes(k));
  return code ? json({ code, error: TEAM_ERRORS[code] }, code === "last_owner" ? 409 : 403) : json({ error: "That didn't work. Please try again." }, 500);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));

  // First sign-in after being invited: join the company that invited them.
  // Only with a confirmed email, so nobody can claim an invite for an address they don't own.
  if (body.action === "me" && user.email && user.email_confirmed_at) {
    await admin.rpc("claim_company_invite", {
      p_user: user.id, p_email: user.email, p_name: user.user_metadata?.full_name ?? null,
    });
  }

  const access = await companyAccess(admin, user.id);

  switch (body.action) {
    case "me": {
      const { data: picktAdmin } = await admin.from("pickt_admins").select("user_id").eq("user_id", user.id).maybeSingle();
      const { data: prefs } = await admin.from("user_preferences").select("homepage, default_view, email_prefs").eq("user_id", user.id).maybeSingle();
      let pendingCount = 0;
      if (access.perms.approve) {
        const { count } = await admin.from("company_requests").select("id", { count: "exact", head: true })
          .eq("company_id", access.companyId).eq("status", "pending");
        pendingCount = count ?? 0;
      }
      const { count: unread } = await admin.from("user_notifications").select("id", { count: "exact", head: true })
        .eq("user_id", user.id).is("read_at", null);
      return json({
        user: {
          id: user.id,
          email: user.email,
          fullName: access.row?.full_name ?? user.user_metadata?.full_name ?? null,
          jobTitle: access.row?.job_title ?? null,
        },
        company: access.companyId
          ? { id: access.companyId, name: access.company?.name ?? null, logoUrl: access.company?.logo_url ?? null }
          : null,
        role: access.role,
        canApprove: access.canApprove,
        canSeeMoney: access.canSeeFees,
        canSeeCommission: access.canSeeCommission,
        isOwner: access.isOwner,
        permissions: access.perms,
        isPicktAdmin: Boolean(picktAdmin),
        pendingCount,
        unreadNotifications: unread ?? 0,
        preferences: {
          homepage: prefs?.homepage ?? "marketplace",
          defaultView: prefs?.default_view ?? "stack",
          email: prefs?.email_prefs ?? {},
        },
      });
    }

    case "update_profile": {
      if (!access.companyId) return json({ error: "This login isn't part of a company, so there's no profile to update." }, 400);
      const fullName = String(body.fullName ?? "").trim().slice(0, 120);
      const jobTitle = String(body.jobTitle ?? "").trim().slice(0, 120);
      if (!fullName) return json({ error: "Enter your name." }, 400);
      const { error } = await admin.from("users").update({ full_name: fullName, job_title: jobTitle || null, updated_at: new Date().toISOString() }).eq("id", user.id);
      if (error) return json({ error: "Could not save your profile. Please try again." }, 500);
      return json({ success: true });
    }

    case "update_preferences": {
      if (!HOMEPAGES.includes(body.homepage)) return json({ error: "Choose a valid homepage." }, 400);
      if (!VIEWS.includes(body.defaultView)) return json({ error: "Choose a valid results view." }, 400);
      const email: Record<string, boolean> = {};
      for (const key of EMAIL_PREFS) if (typeof body.email?.[key] === "boolean") email[key] = body.email[key];
      const { error } = await admin.from("user_preferences").upsert({
        user_id: user.id, homepage: body.homepage, default_view: body.defaultView, email_prefs: email, updated_at: new Date().toISOString(),
      });
      if (error) return json({ error: "Could not save your preferences. Please try again." }, 500);
      return json({ success: true });
    }

    case "notifications": {
      const { data } = await admin.from("user_notifications").select("id, kind, title, body, link, read_at, created_at")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
      return json({ notifications: data ?? [] });
    }

    case "mark_notifications_read": {
      await admin.from("user_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
      return json({ success: true });
    }
  }

  // Everything below needs a company
  if (!access.companyId) return json({ error: "This login isn't part of a company." }, 403);

  switch (body.action) {
    case "team": {
      const { data: members } = await admin.from("users").select("id, full_name, email, role, job_title, created_at")
        .eq("company_id", access.companyId).order("created_at");
      let invites: unknown[] = [];
      if (access.perms.manage_users) {
        const { data } = await admin.from("company_invites").select("id, email, role, created_at")
          .eq("company_id", access.companyId).is("accepted_at", null).is("cancelled_at", null).order("created_at");
        invites = data ?? [];
      }
      return json({ members: members ?? [], invites });
    }

    case "invite": {
      if (!access.perms.manage_users) return json({ error: TEAM_ERRORS.not_allowed }, 403);
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
      if (!["admin", "member"].includes(body.role)) return json({ error: "Choose Admin or Member." }, 400);

      const { data: existing } = await admin.from("users").select("id").ilike("email", email).maybeSingle();
      if (existing) return json({ error: "That person already has a Pickt company account." }, 409);

      const { error: inviteError } = await admin.from("company_invites").insert({
        company_id: access.companyId, email, role: body.role, invited_by: user.id,
      });
      if (inviteError) {
        return inviteError.code === "23505"
          ? json({ error: "That person has already been invited." }, 409)
          : json({ error: "Could not create the invite. Please try again." }, 500);
      }

      // The invite stands either way: they join when they first sign in with this email
      const origin = req.headers.get("origin");
      const { error: sendError } = await admin.auth.admin.inviteUserByEmail(email, origin ? { redirectTo: `${origin}/login` } : {});
      if (sendError) console.error("[account] invite email not sent:", sendError.message);
      return json({ success: true, emailSent: !sendError });
    }

    case "cancel_invite": {
      if (!access.perms.manage_users) return json({ error: TEAM_ERRORS.not_allowed }, 403);
      await admin.from("company_invites").update({ cancelled_at: new Date().toISOString() })
        .eq("id", body.inviteId).eq("company_id", access.companyId);
      return json({ success: true });
    }

    case "change_role": {
      const { error } = await admin.rpc("team_change_role", { p_actor: user.id, p_target: body.userId, p_role: body.role });
      return error ? teamError(error.message) : json({ success: true });
    }

    case "remove_member": {
      const { error } = await admin.rpc("team_remove_member", { p_actor: user.id, p_target: body.userId });
      return error ? teamError(error.message) : json({ success: true });
    }

    // Manage access: Owners only, enforced here and again in the database
    case "permissions": {
      if (!access.isOwner) return json({ error: OWNER_ONLY }, 403);
      const [{ data: rows }, { data: log }] = await Promise.all([
        admin.from("company_permissions").select("role, permission, allowed").eq("company_id", access.companyId),
        admin.from("permission_changes").select("id, changed_by, role, permission, allowed, automatic, created_at")
          .eq("company_id", access.companyId).order("created_at", { ascending: false }).limit(100),
      ]);
      const grid: Record<string, Record<string, boolean>> = { admin: {}, member: {} };
      for (const role of ["admin", "member"]) for (const p of PERMISSIONS) grid[role][p] = false;
      for (const r of rows ?? []) if (grid[r.role] && r.permission in grid[r.role]) grid[r.role][r.permission] = Boolean(r.allowed);
      const ids = [...new Set((log ?? []).map((l) => l.changed_by).filter(Boolean))];
      const { data: people } = ids.length ? await admin.from("users").select("id, full_name, email").in("id", ids) : { data: [] };
      const nameOf = new Map((people ?? []).map((u: { id: string; full_name: string | null; email: string }) => [u.id, u.full_name || u.email]));
      return json({
        grid,
        log: (log ?? []).map((l) => ({
          id: l.id, by: nameOf.get(l.changed_by) ?? "A former team member", role: l.role,
          permission: l.permission, allowed: l.allowed, automatic: l.automatic, at: l.created_at,
        })),
      });
    }

    case "set_permission": {
      if (!access.isOwner) return json({ error: OWNER_ONLY }, 403);
      if (!["admin", "member"].includes(body.role)) return json({ error: "Choose Admin or Member." }, 400);
      if (!(PERMISSIONS as readonly string[]).includes(body.permission)) return json({ error: "Unknown permission." }, 400);
      const { data, error } = await admin.rpc("set_role_permission", {
        p_actor: user.id, p_role: body.role, p_permission: body.permission, p_allowed: body.allowed === true,
      });
      if (error) return error.message.includes("owners_only") ? json({ error: OWNER_ONLY }, 403) : json({ error: "Could not save that change. Please try again." }, 500);
      return json({ success: true, changes: data ?? [] });
    }

    case "placements": {
      return json(await placementsFor(admin, access));
    }

    case "export": {
      if (!access.perms.export) return json({ error: "You don't have permission to export data." }, 403);
      return json({ filename: "pickt-placements.csv", csv: placementsCsv(await placementsFor(admin, access)) });
    }

    case "billing": {
      if (!access.perms.see_billing) return json({ error: "You don't have permission to see billing." }, 403);
      const companyId = access.companyId;
      const [unlocks, hires, commissions] = await Promise.all([
        admin.from("candidate_unlocks").select("candidate_id, unlocked_at, created_at, approved_by, requested_by, candidates(role_applied_for)")
          .eq("requesting_company_id", companyId).eq("status", "approved").order("unlocked_at", { ascending: false }),
        admin.from("hires").select("id, candidate_id, first_year_salary, start_date, total_fee_percentage, total_fee_amount, recorded_by, requested_by, created_at, candidates(role_applied_for)")
          .eq("hiring_company_id", companyId).order("created_at", { ascending: false }),
        // This company's own commission only. Pickt's share is in another table and isn't read here.
        admin.from("commissions").select("id, candidate_id, referrer_position, rate, amount, status, paid_at, created_at, candidates(role_applied_for)")
          .eq("referrer_company_id", companyId).order("created_at", { ascending: false }),
      ]);
      const ids = new Set<string>();
      for (const r of [...(unlocks.data ?? []), ...(hires.data ?? [])] as { approved_by?: string; recorded_by?: string; requested_by?: string }[]) {
        for (const id of [r.approved_by, r.recorded_by, r.requested_by]) if (id) ids.add(id);
      }
      const { data: people } = ids.size ? await admin.from("users").select("id, full_name, email").in("id", [...ids]) : { data: [] };
      const nameOf = new Map((people ?? []).map((p: { id: string; full_name: string | null; email: string }) => [p.id, p.full_name || p.email]));
      const role = (r: { candidates?: unknown }) => (r.candidates as { role_applied_for?: string } | null)?.role_applied_for ?? null;
      return json({
        unlocks: (unlocks.data ?? []).map((u) => ({
          candidateId: u.candidate_id, role: role(u), date: u.unlocked_at ?? u.created_at,
          approvedBy: nameOf.get(u.approved_by) ?? null, requestedBy: nameOf.get(u.requested_by) ?? null,
        })),
        hires: (hires.data ?? []).map((h) => ({
          id: h.id, candidateId: h.candidate_id, role: role(h), startDate: h.start_date,
          // Placement fees only with the approve permission
          salary: access.canSeeFees ? h.first_year_salary : null,
          feePercentage: access.canSeeFees ? h.total_fee_percentage : null, feeAmount: access.canSeeFees ? h.total_fee_amount : null,
          approvedBy: nameOf.get(h.recorded_by) ?? null, requestedBy: nameOf.get(h.requested_by) ?? null, date: h.created_at,
        })),
        commissions: (commissions.data ?? []).map((c) => ({
          id: c.id, candidateId: c.candidate_id, role: role(c), position: c.referrer_position,
          rate: access.canSeeCommission ? c.rate : null, amount: access.canSeeCommission ? c.amount : null, status: c.status, paidAt: c.paid_at, date: c.created_at,
        })),
      });
    }

    default:
      return json({ error: "Unknown action" }, 400);
  }
});
