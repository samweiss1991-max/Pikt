// The Dashboard's sections, one function each, so the page can load them separately.
// Every section works on the signed-in person's own company only, and leaves out
// anything their permissions don't allow (see _shared/companyAccess.ts).
//
// Candidates come from candidates_public read AS THE USER (the same view the
// Marketplace uses), so no private details are ever loaded here.

import { matchPercent, matchSavedSearch } from "../_shared/matchCriteria.js";
import { experienceBandOf, locationLabelOf, mapCandidate } from "../_shared/candidateUtils.js";
import { ROLE_TO_CATEGORY } from "../_shared/roleCategories.js";
import { earningsFor } from "../_shared/earnings.ts";

const DAY = 24 * 60 * 60 * 1000;
const POOL_COLUMNS = "id, role_applied_for, seniority_level, years_experience, location_city, location_state, location_country, " +
  "location_country_code, location_state_code, preferred_work_type, preferred_work_types, employment_type, employment_types, " +
  "notice_period_days, notice_period_weeks, salary_expectation_min, salary_expectation_max, skills, interview_stage_reached, " +
  "interviews_completed, experience_band, referred_at, created_at, referrer_count, is_silver_medallist";

// deno-lint-ignore no-explicit-any
type Any = any;
export type Ctx = {
  admin: Any;
  /** candidates_public rows, read as the signed-in user */
  loadPool: (columns: string) => Promise<Any[]>;
  userId: string;
  access: {
    companyId: string;
    role: string;
    perms: Record<string, boolean>;
  };
  now: Date;
  /** Start of this month in the person's own time zone */
  monthStart: Date;
};

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => isoDay(new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * DAY));
const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });

// ---------- shared loads, cached per request ----------
function loader(ctx: Ctx) {
  const cache = new Map<string, Promise<Any>>();
  const once = <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    if (!cache.has(key)) cache.set(key, fn());
    return cache.get(key) as Promise<T>;
  };
  const { admin, access } = ctx;
  return {
    pool: () => once("pool", () => ctx.loadPool(POOL_COLUMNS)),
    hiredIds: () => once("hired", async () => {
      const { data } = await admin.from("hires").select("candidate_id");
      return new Set<string>((data ?? []).map((h: Any) => h.candidate_id));
    }),
    companyHires: () => once("companyHires", async () => {
      const { data } = await admin.from("hires")
        .select("id, candidate_id, start_date, total_fee_amount, fee_paid_at, recorded_by, created_at")
        .eq("hiring_company_id", access.companyId);
      return data ?? [];
    }),
    roles: () => once("roles", async () => {
      const { data } = await admin.from("saved_searches")
        .select("id, user_id, name, criteria, created_at, last_seen_at")
        .eq("company_id", access.companyId).order("created_at", { ascending: false });
      return data ?? [];
    }),
    unlocks: () => once("unlocks", async () => {
      const { data } = await admin.from("candidate_unlocks")
        .select("id, candidate_id, unlocked_at, created_at, contacted_at, interviewing_at, approved_by, requested_by, stage_updated_by, updated_at")
        .eq("requesting_company_id", access.companyId).eq("status", "approved");
      return data ?? [];
    }),
    ownReferrals: () => once("ownReferrals", async () => {
      const { data } = await admin.from("candidate_referrers")
        .select("candidate_id, referrer_position, referred_at")
        .eq("company_id", access.companyId).order("referred_at", { ascending: false });
      return data ?? [];
    }),
    rolesOf: async (ids: string[]) => {
      if (!ids.length) return new Map<string, string>();
      const { data } = await admin.from("candidates").select("id, role_applied_for").in("id", ids);
      return new Map<string, string>((data ?? []).map((c: Any) => [c.id, c.role_applied_for || "Candidate"]));
    },
  };
}

/** Matches for one saved search, and how many arrived since its owner last opened it */
function roleMatches(pool: Any[], role: Any) {
  const matched = matchSavedSearch(pool, role.criteria || {});
  const since = new Date(role.last_seen_at || role.created_at).getTime();
  const fresh = matched.filter((c: Any) => {
    const raw = pool.find((p) => p.id === c.id);
    return raw && new Date(raw.created_at || raw.referred_at || 0).getTime() > since;
  });
  return { matched, fresh };
}

// ---------- 2. Key numbers ----------
export async function summary(ctx: Ctx) {
  const L = loader(ctx);
  const [pool, hired, roles, unlocks, companyHires, ownReferrals] = await Promise.all([
    L.pool(), L.hiredIds(), L.roles(), L.unlocks(), L.companyHires(), L.ownReferrals(),
  ]);
  const available = pool.filter((c) => !hired.has(c.id));
  const matchedIds = new Set<string>();
  for (const r of roles) for (const c of roleMatches(available, r).matched) matchedIds.add(c.id);

  const monthStart = ctx.monthStart.getTime();
  const unlockedThisMonth = unlocks.filter((u: Any) => new Date(u.unlocked_at || u.created_at).getTime() >= monthStart).length;
  const notContacted = unlocks.filter((u: Any) => !u.contacted_at && !hired.has(u.candidate_id)).length;
  const referredPlaced = ownReferrals.filter((r: Any) => hired.has(r.candidate_id)).length;

  const result: Record<string, unknown> = {
    activeRoles: { count: roles.length, matched: matchedIds.size },
    unlocked: { thisMonth: unlockedThisMonth, notContacted },
    placements: { total: companyHires.length + referredPlaced, hired: companyHires.length, referred: referredPlaced },
    isNewCompany: roles.length === 0 && unlocks.length === 0 && companyHires.length === 0 && ownReferrals.length === 0,
  };
  if (ctx.access.perms.see_earnings) {
    const e = await earningsFor(ctx.admin, ctx.access.companyId);
    result.savings = { total: e.totals.savings, hires: e.totals.hires, benchmark: e.benchmark };
  } else {
    const mine = roles.filter((r: Any) => r.user_id === ctx.userId);
    result.savedSearches = { count: mine.length, newMatches: mine.reduce((n: number, r: Any) => n + roleMatches(available, r).fresh.length, 0) };
  }
  return result;
}

// ---------- 3. Needs your attention ----------
type Item = { id: string; kind: string; icon: string; title: string; detail: string; action: { label: string; to: string }; at: string; urgency: number };

export async function attention(ctx: Ctx) {
  const L = loader(ctx);
  const { admin, access, userId } = ctx;
  const today = isoDay(ctx.now);
  const items: Item[] = [];
  const [hired, unlocks, companyHires] = await Promise.all([L.hiredIds(), L.unlocks(), L.companyHires()]);

  const { data: requests } = await admin.from("company_requests")
    .select("id, candidate_id, type, status, requested_by, decided_at, decline_reason, created_at")
    .eq("company_id", access.companyId).order("created_at", { ascending: false }).limit(100);
  const reqs = requests ?? [];

  const candidateIds = new Set<string>();
  reqs.forEach((r: Any) => candidateIds.add(r.candidate_id));
  unlocks.forEach((u: Any) => candidateIds.add(u.candidate_id));
  companyHires.forEach((h: Any) => candidateIds.add(h.candidate_id));
  const roleOf = await L.rolesOf([...candidateIds]);
  const role = (id: string) => roleOf.get(id) ?? "Candidate";

  // Waiting for this person's approval
  if (access.perms.approve) {
    const pending = reqs.filter((r: Any) => r.status === "pending" && r.requested_by !== userId);
    const ids = [...new Set(pending.map((r: Any) => r.requested_by))];
    const { data: people } = ids.length ? await admin.from("users").select("id, full_name, email").in("id", ids) : { data: [] };
    const nameOf = new Map((people ?? []).map((p: Any) => [p.id, p.full_name || p.email]));
    for (const r of pending) {
      items.push({
        id: `req-${r.id}`, kind: "request", icon: r.type === "hire" ? "how_to_reg" : "lock_open",
        title: r.type === "hire" ? `Hire approval requested: ${role(r.candidate_id)}` : `Unlock requested: ${role(r.candidate_id)}`,
        detail: `From ${nameOf.get(r.requested_by) ?? "a team member"}`,
        action: { label: "Review", to: "/account?tab=team" }, at: r.created_at, urgency: 1,
      });
    }
    // Placement fees due within 14 days (or overdue)
    for (const h of companyHires) {
      if (h.fee_paid_at) continue;
      const due = addDays(h.start_date, 30);
      if (due > addDays(today, 14)) continue;
      items.push({
        id: `fee-${h.id}`, kind: "fee", icon: "receipt_long",
        title: `Placement fee ${due < today ? "overdue" : "due"}: ${role(h.candidate_id)}`,
        detail: `${due < today ? "Was due" : "Due"} ${shortDate(due)}`,
        action: { label: "View", to: "/placements?tab=hired" }, at: `${due}T00:00:00Z`, urgency: 2,
      });
    }
  }

  // 30- and 90-day check-ins in the next 7 days
  for (const h of companyHires) {
    for (const days of [30, 90]) {
      const date = addDays(h.start_date, days);
      if (date < today || date > addDays(today, 7)) continue;
      items.push({
        id: `check-${h.id}-${days}`, kind: "checkin", icon: "event_available",
        title: `${days}-day check-in: ${role(h.candidate_id)}`,
        detail: date === today ? "Due today" : `Due ${shortDate(date)}`,
        action: { label: "View placement", to: "/placements?tab=hired" }, at: `${date}T00:00:00Z`, urgency: 3,
      });
    }
  }

  // This person's own requests: waiting, or decided in the last 14 days
  const recent = ctx.now.getTime() - 14 * DAY;
  for (const r of reqs.filter((x: Any) => x.requested_by === userId)) {
    if (r.status === "pending") {
      items.push({
        id: `mine-${r.id}`, kind: "own_request", icon: "hourglass_top",
        title: `Your ${r.type} request is waiting: ${role(r.candidate_id)}`, detail: "Waiting for approval",
        action: { label: "View", to: "/account?tab=team" }, at: r.created_at, urgency: 4,
      });
    } else if (r.decided_at && new Date(r.decided_at).getTime() >= recent) {
      const approved = r.status === "approved";
      items.push({
        id: `mine-${r.id}`, kind: "own_request", icon: approved ? "check_circle" : "cancel",
        title: `Your ${r.type} request was ${approved ? "approved" : "declined"}: ${role(r.candidate_id)}`,
        detail: approved ? "You can go ahead" : (r.decline_reason ? `Reason: ${r.decline_reason}` : "Declined"),
        action: { label: approved ? "Open profile" : "View", to: approved ? `/candidates/${r.candidate_id}` : "/account?tab=team" },
        at: r.decided_at, urgency: 4,
      });
    }
  }

  // Unlocked but not contacted yet
  for (const u of unlocks.filter((x: Any) => !x.contacted_at && !hired.has(x.candidate_id))) {
    items.push({
      id: `contact-${u.id}`, kind: "not_contacted", icon: "mail",
      title: `Not contacted yet: ${role(u.candidate_id)}`,
      detail: `Unlocked ${shortDate(isoDay(new Date(u.unlocked_at || u.created_at)))}`,
      action: { label: "Open profile", to: `/candidates/${u.candidate_id}` }, at: u.unlocked_at || u.created_at, urgency: 5,
    });
  }

  // New matches for this person's saved searches
  const [pool, roles] = await Promise.all([L.pool(), L.roles()]);
  const available = pool.filter((c: Any) => !hired.has(c.id));
  for (const r of roles.filter((x: Any) => x.user_id === userId)) {
    const n = roleMatches(available, r).fresh.length;
    if (!n) continue;
    items.push({
      id: `matches-${r.id}`, kind: "matches", icon: "person_search",
      title: `${n} new ${n === 1 ? "match" : "matches"}: ${r.name}`, detail: "Since you last opened this search",
      action: { label: "See matches", to: `/marketplace/discover?search=${r.id}` }, at: ctx.now.toISOString(), urgency: 6,
    });
  }

  items.sort((a, b) => a.urgency - b.urgency || String(b.at).localeCompare(String(a.at)));
  return { items };
}

// ---------- 4. Hiring pipeline ----------
export async function pipeline(ctx: Ctx) {
  const L = loader(ctx);
  const [pool, roles, unlocks, companyHires] = await Promise.all([L.pool(), L.roles(), L.unlocks(), L.companyHires()]);
  const unlocked = new Map(unlocks.map((u: Any) => [u.candidate_id, u]));
  const hiredHere = new Set(companyHires.map((h: Any) => h.candidate_id));
  return {
    roles: roles.map((r: Any) => {
      const ids = matchSavedSearch(pool, r.criteria || {}).map((c: Any) => c.id);
      return {
        id: r.id,
        name: r.name,
        postedAt: r.created_at,
        matched: ids.length,
        unlocked: ids.filter((id: string) => unlocked.has(id)).length,
        interviewing: ids.filter((id: string) => (unlocked.get(id) as Any)?.interviewing_at).length,
        hired: ids.filter((id: string) => hiredHere.has(id)).length,
      };
    }),
  };
}

// ---------- 5. New matches for your roles ----------
export async function matches(ctx: Ctx) {
  const L = loader(ctx);
  const [pool, roles, hired, unlocks] = await Promise.all([L.pool(), L.roles(), L.hiredIds(), L.unlocks()]);
  const unlockedHere = new Set(unlocks.map((u: Any) => u.candidate_id));
  if (!roles.length) return { candidates: [] };
  const best = pool
    .filter((c: Any) => !hired.has(c.id) && !unlockedHere.has(c.id))
    .map((c: Any) => {
      let top = { percent: 0, role: "" };
      for (const r of roles) {
        const percent = matchPercent(c, r.criteria || {});
        if (percent > top.percent) top = { percent, role: r.name };
      }
      return { c, ...top };
    })
    .filter((x: Any) => x.percent >= 60)
    .sort((a: Any, b: Any) => b.percent - a.percent || String(b.c.created_at).localeCompare(String(a.c.created_at)))
    .slice(0, 3);
  return {
    candidates: best.map(({ c, percent, role }: Any) => {
      const m = mapCandidate(c);
      const years = Number(c.years_experience);
      const interviews = Number(c.interviews_completed) || 0;
      const referrals = Number(c.referrer_count) || 0;
      return {
        id: c.id,
        matchPercent: percent,
        forRole: role,
        category: ROLE_TO_CATEGORY[m.role] || null,
        role: m.role,
        experience: years > 0 ? `${years} ${years === 1 ? "year" : "years"}` : experienceBandOf(c) || null,
        location: locationLabelOf(c) || null,
        salaryMin: c.salary_expectation_min ?? null,
        salaryMax: c.salary_expectation_max ?? null,
        highlight: c.is_silver_medallist
          ? "Silver medallist"
          : `✓ ${interviews} ${interviews === 1 ? "interview" : "interviews"} · ${referrals} ${referrals === 1 ? "referral" : "referrals"}`,
      };
    }),
  };
}

// ---------- 6. Your company's referrals ----------
export async function referrals(ctx: Ctx) {
  const L = loader(ctx);
  const { admin, access } = ctx;
  const own = (await L.ownReferrals()).slice(0, 6);
  const ids = own.map((r: Any) => r.candidate_id);
  if (!ids.length) return { referrals: [], pendingTotal: access.perms.see_commission ? 0 : null };
  const [hired, roleOf, unlocksRes, commissionsRes] = await Promise.all([
    L.hiredIds(),
    L.rolesOf(ids),
    admin.from("candidate_unlocks").select("candidate_id, interviewing_at").in("candidate_id", ids).eq("status", "approved"),
    access.perms.see_commission
      ? admin.from("commissions").select("candidate_id, amount, status").eq("referrer_company_id", access.companyId)
      : Promise.resolve({ data: null }),
  ]);
  const unlocksOf = new Map<string, Any[]>();
  for (const u of unlocksRes.data ?? []) unlocksOf.set(u.candidate_id, [...(unlocksOf.get(u.candidate_id) ?? []), u]);
  const commissionOf = new Map((commissionsRes.data ?? []).map((c: Any) => [c.candidate_id, c]));

  const rows = own.map((r: Any) => {
    const list = unlocksOf.get(r.candidate_id) ?? [];
    const placed = hired.has(r.candidate_id);
    const step = placed ? 4 : list.some((u) => u.interviewing_at) ? 3 : list.length ? 2 : 1;
    const row: Record<string, unknown> = {
      candidateId: r.candidate_id,
      role: roleOf.get(r.candidate_id) ?? "Candidate",
      referredAt: r.referred_at,
      step,
      placed,
      unlockedBy: list.length,
    };
    if (access.perms.see_commission) {
      const c = commissionOf.get(r.candidate_id) as Any;
      row.commission = c ? { amount: Number(c.amount), status: c.status === "paid" ? "paid" : "pending" } : null;
    }
    return row;
  });
  const pendingTotal = access.perms.see_commission
    ? Math.round((commissionsRes.data ?? []).filter((c: Any) => c.status !== "paid").reduce((t: number, c: Any) => t + Number(c.amount), 0) * 100) / 100
    : null;
  return { referrals: rows, pendingTotal };
}

// ---------- 7a. Team activity (Owners and Admins) or your own (Members) ----------
export async function activity(ctx: Ctx) {
  const L = loader(ctx);
  const { admin, access, userId } = ctx;
  const team = access.role === "owner" || access.role === "admin";
  const [unlocks, companyHires, ownReferrals] = await Promise.all([L.unlocks(), L.companyHires(), team ? L.ownReferrals() : Promise.resolve([])]);
  const [{ data: requests }, { data: members }, { data: company }] = await Promise.all([
    admin.from("company_requests").select("id, candidate_id, type, status, requested_by, decided_by, decided_at, created_at")
      .eq("company_id", access.companyId).order("created_at", { ascending: false }).limit(50),
    admin.from("users").select("id, full_name, email, created_at").eq("company_id", access.companyId),
    admin.from("companies").select("name").eq("id", access.companyId).maybeSingle(),
  ]);

  type Ev = { actor: string | null; text: string; at: string; candidateId?: string };
  const ev: Ev[] = [];
  for (const u of unlocks) {
    if (u.approved_by) ev.push({ actor: u.approved_by, text: "unlocked", at: u.unlocked_at || u.created_at, candidateId: u.candidate_id });
    if (u.stage_updated_by && (u.interviewing_at || u.contacted_at)) {
      ev.push({ actor: u.stage_updated_by, text: u.interviewing_at ? "moved to interviewing" : "contacted", at: u.interviewing_at || u.contacted_at, candidateId: u.candidate_id });
    }
  }
  for (const r of requests ?? []) {
    ev.push({ actor: r.requested_by, text: r.type === "hire" ? "asked to record a hire for" : "asked to unlock", at: r.created_at, candidateId: r.candidate_id });
    if (r.decided_by && r.decided_at) ev.push({ actor: r.decided_by, text: `${r.status === "approved" ? "approved" : "declined"} a ${r.type} request for`, at: r.decided_at, candidateId: r.candidate_id });
  }
  for (const h of companyHires) ev.push({ actor: h.recorded_by, text: "recorded a hire:", at: h.created_at, candidateId: h.candidate_id });
  for (const m of members ?? []) ev.push({ actor: m.id, text: "joined the team", at: m.created_at });
  for (const r of ownReferrals) ev.push({ actor: null, text: "referred", at: r.referred_at, candidateId: r.candidate_id });

  const mine = team ? ev : ev.filter((e) => e.actor === userId);
  const latest = mine.filter((e) => e.at).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 5);
  const roleOf = await L.rolesOf([...new Set(latest.map((e) => e.candidateId).filter(Boolean) as string[])]);
  const nameOf = new Map((members ?? []).map((m: Any) => [m.id, m.full_name || m.email]));
  const companyName = company?.name ?? "Your company";

  return {
    scope: team ? "team" : "own",
    events: latest.map((e, i) => {
      const who = e.actor ? (e.actor === userId ? "You" : nameOf.get(e.actor) ?? "A former team member") : companyName;
      const what = e.candidateId ? `${e.text} ${aOrAn(roleOf.get(e.candidateId) ?? "candidate")}` : e.text;
      return { id: `${i}-${e.at}`, who, initials: initials(who === "You" ? nameOf.get(userId) ?? "You" : who), text: `${who} ${what}`, at: e.at };
    }),
  };
}

const initials = (s: string) => s.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
const aOrAn = (role: string) => (/^[aeiou]/i.test(role) ? `an ${role}` : `a ${role}`);

// ---------- 7b. Recently saved ----------
export async function saved(ctx: Ctx) {
  const { admin, userId } = ctx;
  const [{ data: cands }, { data: searches }] = await Promise.all([
    admin.from("saved_candidates").select("candidate_id, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(3),
    admin.from("saved_searches").select("id, name, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(3),
  ]);
  const roleOf = await loader(ctx).rolesOf((cands ?? []).map((c: Any) => c.candidate_id));
  const items = [
    ...(cands ?? []).map((c: Any) => ({ kind: "candidate", id: c.candidate_id, title: roleOf.get(c.candidate_id) ?? "Candidate", to: `/candidates/${c.candidate_id}`, at: c.created_at })),
    ...(searches ?? []).map((s: Any) => ({ kind: "search", id: s.id, title: s.name, to: `/marketplace/discover?search=${s.id}`, at: s.created_at })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 3);
  return { items };
}

// ---------- Unlocked candidates list (linked from the tiles and pipeline) ----------
export async function unlockedList(ctx: Ctx, opts: { roleId?: string; stage?: string }) {
  const L = loader(ctx);
  const [unlocks, hired, companyHires, roles, pool] = await Promise.all([L.unlocks(), L.hiredIds(), L.companyHires(), L.roles(), opts.roleId ? L.pool() : Promise.resolve([])]);
  const hiredHere = new Set(companyHires.map((h: Any) => h.candidate_id));
  let list = unlocks;
  let roleName: string | null = null;
  if (opts.roleId) {
    const role = roles.find((r: Any) => r.id === opts.roleId);
    if (!role) return { error: "role_not_found" };
    roleName = role.name;
    const ids = new Set(matchSavedSearch(pool, role.criteria || {}).map((c: Any) => c.id));
    list = list.filter((u: Any) => ids.has(u.candidate_id));
  }
  const stageOf = (u: Any) => hiredHere.has(u.candidate_id) ? "hired" : hired.has(u.candidate_id) ? "hired_elsewhere" : u.interviewing_at ? "interviewing" : u.contacted_at ? "contacted" : "not_contacted";
  const roleOf = await L.rolesOf(list.map((u: Any) => u.candidate_id));
  const rows = list.map((u: Any) => ({ candidateId: u.candidate_id, role: roleOf.get(u.candidate_id) ?? "Candidate", unlockedAt: u.unlocked_at || u.created_at, stage: stageOf(u) }))
    .filter((r: Any) => !opts.stage || opts.stage === "all" || r.stage === opts.stage || (opts.stage === "this_month" && new Date(r.unlockedAt).getTime() >= ctx.monthStart.getTime()))
    .sort((a: Any, b: Any) => String(b.unlockedAt).localeCompare(String(a.unlockedAt)));
  return { roleName, candidates: rows };
}

/** A company role (saved search) for opening in the Marketplace */
export async function roleCriteria(ctx: Ctx, id: string) {
  const role = (await loader(ctx).roles()).find((r: Any) => r.id === id);
  if (!role) return null;
  return { id: role.id, name: role.name, criteria: role.criteria, mine: role.user_id === ctx.userId };
}
