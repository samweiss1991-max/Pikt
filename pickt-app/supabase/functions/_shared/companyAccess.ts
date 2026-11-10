// Who the signed-in person is within their company, and what they may see and do.
// Every function that returns money or acts for a company asks here, so a person is
// held back on the server whatever the screens show.
//
// The Owner always has every permission. Admins and Members have only what the Owner
// has turned on in Account settings → Manage access (migration 037).

export const PERMISSIONS = [
  "approve", // Approve unlocks & hires (includes seeing placement fees)
  "unlock", // Unlock candidate profiles
  "record_hire", // Record hires
  "see_commission", // See commission amounts & totals
  "manage_users", // Invite and remove users
  "see_billing", // See billing & unlock history
  "export", // Export data (CSV)
] as const;
export type Permission = typeof PERMISSIONS[number];
export type Permissions = Record<Permission, boolean>;

const none = (): Permissions => Object.fromEntries(PERMISSIONS.map((p) => [p, false])) as Permissions;

// deno-lint-ignore no-explicit-any
export async function companyAccess(admin: any, userId: string) {
  const { data } = await admin
    .from("users")
    .select("company_id, role, full_name, email, job_title, companies(name, logo_url)")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.company_id) {
    return {
      companyId: null, role: null, isOwner: false, perms: none(),
      canApprove: false, canSeeFees: false, canSeeCommission: false, row: null, company: null,
    };
  }
  const company = data.companies as { name: string; logo_url: string | null } | null;
  const isOwner = data.role === "owner";
  const perms = none();
  if (isOwner) {
    for (const p of PERMISSIONS) perms[p] = true;
  } else {
    const { data: rows } = await admin.from("company_permissions").select("permission, allowed")
      .eq("company_id", data.company_id).eq("role", data.role);
    for (const r of rows ?? []) if ((PERMISSIONS as readonly string[]).includes(r.permission)) perms[r.permission as Permission] = Boolean(r.allowed);
  }
  return {
    companyId: data.company_id as string,
    role: data.role as string,
    isOwner,
    perms,
    // Approving requests and seeing placement fees go together
    canApprove: perms.approve,
    canSeeFees: perms.approve,
    // Referral commission: rates and amounts
    canSeeCommission: perms.see_commission,
    row: data,
    company,
  };
}

/** Owners, plus everyone whose role may approve. They get new unlock and hire requests. */
// deno-lint-ignore no-explicit-any
export async function companyApprovers(admin: any, companyId: string): Promise<{ id: string; email: string }[]> {
  const { data } = await admin.rpc("company_approvers", { p_company: companyId });
  return data ?? [];
}
