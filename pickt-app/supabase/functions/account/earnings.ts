// Earnings & savings for the signed-in person's company. Own company only, and only
// for people with the "see_earnings" permission (the caller checks). Pickt's share
// is never read here.
//
// Saving per hire = benchmark% x first-year salary - Pickt fee, never below $0.
// The benchmark lives in app_settings (migration 038).

const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_BENCHMARK = 20;
const round2 = (n: number) => Math.round(n * 100) / 100;
const feeDueDate = (start: string) => new Date(new Date(`${start}T00:00:00Z`).getTime() + 30 * DAY).toISOString().slice(0, 10);
const roleOf = (r: { candidates?: unknown }) => (r.candidates as { role_applied_for?: string } | null)?.role_applied_for ?? null;

// deno-lint-ignore no-explicit-any
export async function benchmarkPercent(admin: any): Promise<number> {
  const { data } = await admin.from("app_settings").select("value").eq("key", "agency_fee_benchmark_percent").maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) && n > 0 && n < 100 ? n : DEFAULT_BENCHMARK;
}

// deno-lint-ignore no-explicit-any
export async function earningsFor(admin: any, companyId: string) {
  const [benchmark, hiresRes, commissionsRes, grantsRes] = await Promise.all([
    benchmarkPercent(admin),
    admin.from("hires").select("id, candidate_id, first_year_salary, start_date, total_fee_percentage, total_fee_amount, fee_paid_at, candidates(role_applied_for)")
      .eq("hiring_company_id", companyId),
    admin.from("commissions").select("id, candidate_id, first_year_salary, rate, amount, status, paid_at, candidates(role_applied_for)")
      .eq("referrer_company_id", companyId),
    admin.from("company_permissions").select("role").eq("company_id", companyId).eq("permission", "see_earnings").eq("allowed", true),
  ]);

  const hires = (hiresRes.data ?? []).map((h: Record<string, unknown>) => {
    const salary = Number(h.first_year_salary);
    const feeAmount = Number(h.total_fee_amount);
    const agencyFee = round2(salary * benchmark / 100);
    return {
      id: h.id,
      candidateId: h.candidate_id,
      role: roleOf(h),
      salary,
      startDate: h.start_date,
      feePercentage: Number(h.total_fee_percentage),
      feeAmount,
      agencyFee,
      // A Pickt fee above the benchmark counts as no saving, never a negative one
      saving: Math.max(0, round2(agencyFee - feeAmount)),
      feePaidAt: h.fee_paid_at ?? null,
      feeDueDate: feeDueDate(h.start_date as string),
    };
  }).sort((a: { saving: number }, b: { saving: number }) => b.saving - a.saving);

  const commissions = (commissionsRes.data ?? []).map((c: Record<string, unknown>) => ({
    id: c.id,
    candidateId: c.candidate_id,
    role: roleOf(c),
    salary: Number(c.first_year_salary),
    rate: Number(c.rate),
    amount: Number(c.amount),
    status: c.status === "paid" ? "paid" : "pending",
    paidAt: c.paid_at ?? null,
  }));

  const sum = (rows: Record<string, unknown>[], key: string) => round2(rows.reduce((t, r) => t + (Number(r[key]) || 0), 0));
  const savings = sum(hires, "saving");
  const commissionPaid = sum(commissions.filter((c: { status: string }) => c.status === "paid"), "amount");
  const commissionPending = sum(commissions.filter((c: { status: string }) => c.status !== "paid"), "amount");
  const commissionTotal = round2(commissionPaid + commissionPending);
  const grants = (grantsRes.data ?? []).map((g: { role: string }) => g.role);

  return {
    benchmark,
    visibleTo: ["Owner", ...(grants.includes("admin") ? ["Admins"] : []), ...(grants.includes("member") ? ["Members"] : [])],
    hires,
    commissions,
    totals: {
      savings,
      hires: hires.length,
      fees: sum(hires, "feeAmount"),
      commissionTotal,
      commissionPaid,
      commissionPending,
      value: round2(savings + commissionTotal),
    },
  };
}

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

export function earningsCsv(e: Awaited<ReturnType<typeof earningsFor>>) {
  const lines: unknown[][] = [["Type", "Role", "First-year salary", "Pickt fee or commission rate %", "Amount", `Agency fee (${e.benchmark}%)`, "Saved", "Status"]];
  for (const h of e.hires) {
    lines.push(["Hire", h.role, h.salary, h.feePercentage, h.feeAmount, h.agencyFee, h.saving,
      h.feePaidAt ? `Paid ${String(h.feePaidAt).slice(0, 10)}` : `Due ${h.feeDueDate}`]);
  }
  for (const c of e.commissions) {
    lines.push(["Referral commission", c.role, c.salary, c.rate, c.amount, "", "",
      c.paidAt ? `Paid ${String(c.paidAt).slice(0, 10)}` : "Pending"]);
  }
  lines.push(["Total", "", "", "", "", "", e.totals.savings, `Total value ${e.totals.value}`]);
  return lines.map((l) => l.map(cell).join(",")).join("\r\n");
}
