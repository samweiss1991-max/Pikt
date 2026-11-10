// Supabase Edge Function: company-requests
// Members ask; Owners and Admins approve or decline. The rules are enforced in the
// database (migration 036), and this decides what each person gets back: a Member
// sees only their own requests, with no amounts unless the Owner's setting is on.
//
// Deploy: supabase functions deploy company-requests

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { companyAccess } from "../_shared/companyAccess.ts";
import { notifyApprovers, notifyReferrers, notifyUsers } from "../_shared/notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const ERRORS: Record<string, [number, string]> = {
  already_pending: [409, "A request for this candidate is already waiting for approval."],
  already_unlocked: [409, "Your company has already unlocked this candidate."],
  already_hired: [409, "This candidate has already been hired."],
  already_decided: [409, "Someone has already decided this request."],
  not_unlocked: [403, "Your company needs to unlock this candidate first."],
  own_referral: [403, "Your company referred this candidate, so it can't unlock or hire them."],
  candidate_not_found: [404, "Candidate not found."],
  request_not_found: [404, "Request not found."],
  not_allowed: [403, "You don't have permission to do that."],
  invalid_salary: [400, "Enter a valid first-year salary."],
  invalid_start_date: [400, "Enter a valid start date."],
  reason_required: [400, "Please give a reason."],
  wrong_type: [400, "That request can't be approved this way."],
};
function dbError(message: string) {
  const code = Object.keys(ERRORS).find((k) => message.includes(k));
  if (!code) {
    console.error("[company-requests] failed:", message);
    return json({ error: "That didn't work. Please try again." }, 500);
  }
  return json({ code, error: ERRORS[code][1] }, ERRORS[code][0]);
}
function isRealDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}
const validSalary = (n: number) => Number.isFinite(n) && n > 0 && n <= 9_999_999;

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
  const requesterName = access.row?.full_name || access.row?.email || "A team member";

  const candidateRole = async (id: string) => {
    const { data } = await admin.from("candidates").select("role_applied_for").eq("id", id).maybeSingle();
    return data?.role_applied_for ?? "a candidate";
  };

  switch (body.action) {
    case "request_unlock":
    case "request_hire": {
      const isHire = body.action === "request_hire";
      if (isHire ? access.perms.record_hire : access.perms.unlock) return json({ error: "You can do this directly." }, 400);
      const salary = isHire ? Number(body.salary) : null;
      if (isHire && !validSalary(salary as number)) return json({ error: ERRORS.invalid_salary[1] }, 400);
      if (isHire && !isRealDate(body.startDate)) return json({ error: ERRORS.invalid_start_date[1] }, 400);

      const { data, error } = await admin.rpc("create_company_request", {
        p_user: user.id, p_candidate: body.candidateId, p_type: isHire ? "hire" : "unlock",
        p_note: body.note ? String(body.note).slice(0, 1000) : null,
        p_salary: salary, p_start: isHire ? body.startDate : null,
      });
      if (error) return dbError(error.message);

      const role = await candidateRole(body.candidateId);
      await notifyApprovers(admin, access.companyId, {
        kind: isHire ? "hire_request" : "unlock_request",
        pref: "new_requests",
        title: isHire ? `${requesterName} asked to record a hire: ${role}` : `${requesterName} asked to unlock: ${role}`,
        body: body.note ? String(body.note).slice(0, 1000) : undefined,
        link: "/account?tab=team",
      });
      return json({ id: data, success: true });
    }

    case "list": {
      let query = admin.from("company_requests")
        .select("id, candidate_id, type, status, requested_by, note, proposed_salary, proposed_start_date, approved_salary, approved_start_date, decided_by, decided_at, decline_reason, created_at, candidates(role_applied_for)")
        .eq("company_id", access.companyId).order("created_at", { ascending: false }).limit(100);
      // Members see their own requests only
      if (!access.canApprove) query = query.eq("requested_by", user.id);
      const { data: rows, error } = await query;
      if (error) return dbError(error.message);

      const peopleIds = [...new Set((rows ?? []).flatMap((r) => [r.requested_by, r.decided_by]).filter(Boolean))];
      const { data: people } = peopleIds.length ? await admin.from("users").select("id, full_name, email").in("id", peopleIds) : { data: [] };
      const nameOf = new Map((people ?? []).map((p: { id: string; full_name: string | null; email: string }) => [p.id, p.full_name || p.email]));

      const requests = [];
      for (const r of rows ?? []) {
        const row: Record<string, unknown> = {
          id: r.id, candidateId: r.candidate_id, type: r.type, status: r.status,
          role: (r.candidates as unknown as { role_applied_for?: string } | null)?.role_applied_for ?? null,
          note: r.note, requestedBy: nameOf.get(r.requested_by) ?? null, decidedBy: nameOf.get(r.decided_by) ?? null,
          decidedAt: r.decided_at, declineReason: r.decline_reason, createdAt: r.created_at,
          startDate: r.approved_start_date ?? r.proposed_start_date,
        };
        if (access.canSeeFees) {
          row.salary = r.approved_salary ?? r.proposed_salary;
        }
        // What the approver needs in order to decide: the total fee and its amount
        if (access.canApprove && r.type === "hire" && r.status === "pending") {
          const { count } = await admin.from("candidate_referrers").select("id", { count: "exact", head: true }).eq("candidate_id", r.candidate_id);
          const { data: pct } = await admin.rpc("employer_fee_for", { p_referrer_count: Math.max(1, count ?? 0) });
          row.feePercentage = pct;
          row.feeAmount = Math.round(Number(r.proposed_salary) * Number(pct)) / 100;
        }
        requests.push(row);
      }
      return json({ requests, canApprove: access.canApprove });
    }

    case "approve": {
      if (!access.canApprove) return json({ error: ERRORS.not_allowed[1] }, 403);
      const { data: existing } = await admin.from("company_requests").select("type").eq("id", body.requestId).eq("company_id", access.companyId).maybeSingle();
      if (!existing) return json({ error: ERRORS.request_not_found[1] }, 404);

      let salary: number | null = null;
      let start: string | null = null;
      if (existing.type === "hire") {
        if (body.salary !== undefined && body.salary !== null) {
          salary = Number(body.salary);
          if (!validSalary(salary)) return json({ error: ERRORS.invalid_salary[1] }, 400);
        }
        if (body.startDate) {
          if (!isRealDate(body.startDate)) return json({ error: ERRORS.invalid_start_date[1] }, 400);
          start = body.startDate;
        }
      }
      const { data: req_, error } = existing.type === "hire"
        ? await admin.rpc("approve_hire_request", { p_request: body.requestId, p_approver: user.id, p_salary: salary, p_start: start })
        : await admin.rpc("approve_unlock_request", { p_request: body.requestId, p_approver: user.id });
      if (error) return dbError(error.message);

      const role = await candidateRole(req_.candidate_id);
      const { data: requester } = await admin.from("users").select("id, email").eq("id", req_.requested_by).maybeSingle();
      if (requester) {
        await notifyUsers(admin, [requester], {
          kind: "request_outcome", pref: "request_outcomes",
          title: existing.type === "hire" ? `Your hire request was approved: ${role}` : `Your unlock request was approved: ${role}`,
          link: `/candidates/${req_.candidate_id}`,
        });
      }
      await notifyReferrers(admin, req_.candidate_id, existing.type === "hire"
        ? { kind: "referral_status", pref: "referral_status", title: `A candidate you referred has been hired: ${role}`, body: "See Placements for the details.", link: "/placements?tab=referred" }
        : { kind: "referral_status", pref: "referral_status", title: `A candidate you referred has been unlocked: ${role}`, link: "/my-candidates" });
      return json({ success: true });
    }

    case "decline": {
      if (!access.canApprove) return json({ error: ERRORS.not_allowed[1] }, 403);
      const { data: req_, error } = await admin.rpc("decline_company_request", { p_request: body.requestId, p_approver: user.id, p_reason: body.reason ?? "" });
      if (error) return dbError(error.message);
      const role = await candidateRole(req_.candidate_id);
      const { data: requester } = await admin.from("users").select("id, email").eq("id", req_.requested_by).maybeSingle();
      if (requester) {
        await notifyUsers(admin, [requester], {
          kind: "request_outcome", pref: "request_outcomes",
          title: req_.type === "hire" ? `Your hire request was declined: ${role}` : `Your unlock request was declined: ${role}`,
          body: `Reason: ${req_.decline_reason}`,
          link: `/candidates/${req_.candidate_id}`,
        });
      }
      return json({ success: true });
    }

    default:
      return json({ error: "Unknown action" }, 400);
  }
});
