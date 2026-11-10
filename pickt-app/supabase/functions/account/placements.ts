// Placements for the signed-in person's company: people it hired through Pickt, and
// people it referred who were hired. Own company only. Amounts are left out unless
// the person's role has the permission: placement fees need "approve", commission
// needs "see_commission". Pickt's share is never read here.

type Access = {
  companyId: string | null;
  canSeeFees: boolean;
  canSeeCommission: boolean;
};

type Candidate = {
  full_name?: string | null;
  role_applied_for?: string | null;
  location_city?: string | null;
  location_state_code?: string | null;
  location_country?: string | null;
};

const DAY = 24 * 60 * 60 * 1000;

const locationOf = (c: Candidate | null) =>
  [c?.location_city, c?.location_state_code || c?.location_country].filter(Boolean).join(", ") || null;

/** Fee is due 30 days after the start date until real invoicing exists (see TODO.md) */
const feeDueDate = (start: string) => new Date(new Date(`${start}T00:00:00Z`).getTime() + 30 * DAY).toISOString().slice(0, 10);

// deno-lint-ignore no-explicit-any
export async function placementsFor(admin: any, access: Access) {
  const companyId = access.companyId;
  if (!companyId) {
    return { canSeeFees: false, canSeeCommission: false, hired: [], referred: [], visibleTo: { fees: ["Owner"], commission: ["Owner"] }, totals: { fees: null, commission: null } };
  }

  const candidateFields = "full_name, role_applied_for, location_city, location_state_code, location_country";
  const [hiresRes, ownReferralsRes] = await Promise.all([
    admin.from("hires")
      .select(`id, candidate_id, first_year_salary, start_date, total_fee_percentage, total_fee_amount, fee_paid_at, created_at, candidates(${candidateFields})`)
      .eq("hiring_company_id", companyId).order("start_date", { ascending: false }),
    admin.from("candidate_referrers").select("candidate_id, referrer_position, referred_at").eq("company_id", companyId),
  ]);
  const hires = hiresRes.data ?? [];
  const ownReferrals = ownReferralsRes.data ?? [];

  // ---- Hired through Pickt ----
  const hiredIds = hires.map((h: { candidate_id: string }) => h.candidate_id);
  const [referrersRes, unlocksRes] = hiredIds.length
    ? await Promise.all([
      admin.from("candidate_referrers").select("candidate_id, referrer_position, company_id, companies(name)").in("candidate_id", hiredIds),
      admin.from("candidate_unlocks").select("candidate_id").eq("requesting_company_id", companyId).eq("status", "approved").in("candidate_id", hiredIds),
    ])
    : [{ data: [] }, { data: [] }];
  const referrersOf = new Map<string, { position: number; name: string }[]>();
  for (const r of referrersRes.data ?? []) {
    const list = referrersOf.get(r.candidate_id) ?? [];
    list.push({ position: r.referrer_position, name: (r.companies as { name?: string } | null)?.name ?? "A referrer" });
    referrersOf.set(r.candidate_id, list);
  }
  const unlocked = new Set((unlocksRes.data ?? []).map((u: { candidate_id: string }) => u.candidate_id));

  const hired = hires.map((h: Record<string, unknown>) => {
    const c = h.candidates as Candidate | null;
    const isUnlocked = unlocked.has(h.candidate_id as string);
    const row: Record<string, unknown> = {
      id: h.id,
      candidateId: h.candidate_id,
      unlocked: isUnlocked,
      name: isUnlocked ? c?.full_name ?? null : null,
      role: c?.role_applied_for ?? null,
      location: locationOf(c),
      startDate: h.start_date,
      referrers: (referrersOf.get(h.candidate_id as string) ?? []).sort((a, b) => a.position - b.position).map((r) => r.name),
    };
    if (access.canSeeFees) {
      row.salary = Number(h.first_year_salary);
      row.feePercentage = Number(h.total_fee_percentage);
      row.feeAmount = Number(h.total_fee_amount);
      row.feePaidAt = h.fee_paid_at ?? null;
      row.feeDueDate = feeDueDate(h.start_date as string);
    }
    return row;
  });

  // ---- Referred placements: our referrals that were hired ----
  const referredIds = ownReferrals.map((r: { candidate_id: string }) => r.candidate_id);
  const [refHiresRes, commissionsRes] = referredIds.length
    ? await Promise.all([
      admin.from("hires").select(`id, candidate_id, start_date, hiring_company_id, companies(name), candidates(${candidateFields})`).in("candidate_id", referredIds),
      admin.from("commissions").select("candidate_id, referrer_position, first_year_salary, rate, amount, status, paid_at")
        .eq("referrer_company_id", companyId).in("candidate_id", referredIds),
    ])
    : [{ data: [] }, { data: [] }];
  const hireOf = new Map((refHiresRes.data ?? []).map((h: { candidate_id: string }) => [h.candidate_id, h]));
  const commissionOf = new Map((commissionsRes.data ?? []).map((c: { candidate_id: string }) => [c.candidate_id, c]));

  const referred = ownReferrals
    .filter((r: { candidate_id: string }) => hireOf.has(r.candidate_id))
    .map((r: { candidate_id: string; referrer_position: number; referred_at: string }) => {
      // deno-lint-ignore no-explicit-any
      const h = hireOf.get(r.candidate_id) as any;
      // deno-lint-ignore no-explicit-any
      const cm = commissionOf.get(r.candidate_id) as any;
      const c = h.candidates as Candidate | null;
      const row: Record<string, unknown> = {
        candidateId: r.candidate_id,
        role: c?.role_applied_for ?? null,
        referredAt: r.referred_at,
        position: r.referrer_position,
        hiringCompany: (h.companies as { name?: string } | null)?.name ?? null,
        startDate: h.start_date,
      };
      if (access.canSeeCommission) {
        row.salary = cm ? Number(cm.first_year_salary) : null;
        row.rate = cm ? Number(cm.rate) : null;
        row.commission = cm ? Number(cm.amount) : null;
        row.commissionStatus = cm?.status ?? "pending";
        row.commissionPaidAt = cm?.paid_at ?? null;
      }
      return row;
    })
    .sort((a: { startDate: string }, b: { startDate: string }) => String(b.startDate).localeCompare(String(a.startDate)));

  // Who besides the Owner can see each money panel, for the "Visible to" line
  const { data: grants } = await admin.from("company_permissions").select("role, permission")
    .eq("company_id", companyId).eq("allowed", true).in("permission", ["approve", "see_commission"]);
  const visibleTo = (permission: string) => ["Owner", ...["admin", "member"]
    .filter((role) => (grants ?? []).some((g: { role: string; permission: string }) => g.role === role && g.permission === permission))
    .map((role) => (role === "admin" ? "Admins" : "Members"))];

  const sum = (rows: Record<string, unknown>[], key: string) => Math.round(rows.reduce((t, r) => t + (Number(r[key]) || 0), 0) * 100) / 100;
  return {
    canSeeFees: access.canSeeFees,
    canSeeCommission: access.canSeeCommission,
    hired,
    referred,
    visibleTo: { fees: visibleTo("approve"), commission: visibleTo("see_commission") },
    totals: {
      fees: access.canSeeFees ? sum(hired, "feeAmount") : null,
      commission: access.canSeeCommission ? sum(referred, "commission") : null,
    },
  };
}

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote everything, and stop spreadsheet apps treating text as a formula
  return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** One CSV of both lists, with the amounts this person is allowed to see */
export function placementsCsv(p: Awaited<ReturnType<typeof placementsFor>>) {
  const lines = [["Type", "Candidate", "Role", "Location", "Start date", "Referred by / Hired by", "Salary", "Fee or rate %", "Amount", "Status"]];
  for (const h of p.hired as Record<string, unknown>[]) {
    lines.push([
      "Hired through Pickt", h.name ?? "", h.role, h.location, h.startDate, (h.referrers as string[]).join("; "),
      h.salary ?? "", h.feePercentage ?? "", h.feeAmount ?? "",
      p.canSeeFees ? (h.feePaidAt ? `Paid ${String(h.feePaidAt).slice(0, 10)}` : `Due ${h.feeDueDate}`) : "",
    ] as string[]);
  }
  for (const r of p.referred as Record<string, unknown>[]) {
    lines.push([
      "Referred placement", "", r.role, "", r.startDate, r.hiringCompany,
      r.salary ?? "", r.rate ?? "", r.commission ?? "",
      p.canSeeCommission ? (r.commissionPaidAt ? `Paid ${String(r.commissionPaidAt).slice(0, 10)}` : "Pending") : "",
    ] as string[]);
  }
  return lines.map((l) => l.map(cell).join(",")).join("\r\n");
}
