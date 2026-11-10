// Who the signed-in person is within their company, and what they may see and do.
// Every function that returns money or acts for a company asks here, so a Member is
// held back on the server whatever the screens show.

// deno-lint-ignore no-explicit-any
export async function companyAccess(admin: any, userId: string) {
  const { data } = await admin
    .from("users")
    .select("company_id, role, full_name, email, job_title, companies(name, logo_url, members_see_fees)")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.company_id) {
    return { companyId: null, role: null, canApprove: false, canSeeMoney: false, isMember: false, row: null, company: null };
  }
  const company = data.companies as { name: string; logo_url: string | null; members_see_fees: boolean } | null;
  const canApprove = data.role === "owner" || data.role === "admin";
  return {
    companyId: data.company_id as string,
    role: data.role as string,
    canApprove,
    // Members only see amounts if the Owner has turned that setting on
    canSeeMoney: canApprove || Boolean(company?.members_see_fees),
    isMember: !canApprove,
    row: data,
    company,
  };
}
