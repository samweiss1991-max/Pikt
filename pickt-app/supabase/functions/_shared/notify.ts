// In-app notifications, plus an email if RESEND_API_KEY is set and the person hasn't
// turned that kind off. Never carries fee or commission figures. Best-effort: a failed
// notification must never undo the action that caused it.

function escapeHtml(text: unknown) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
  ));
}

type Message = { kind: string; pref: string; title: string; body?: string; link?: string };

// deno-lint-ignore no-explicit-any
export async function notifyUsers(admin: any, recipients: { id: string; email: string | null }[], message: Message) {
  if (recipients.length === 0) return;
  try {
    await admin.from("user_notifications").insert(recipients.map((r) => ({
      user_id: r.id, kind: message.kind, title: message.title, body: message.body ?? null, link: message.link ?? null,
    })));

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return;

    const { data: prefs } = await admin
      .from("user_preferences").select("user_id, email_prefs").in("user_id", recipients.map((r) => r.id));
    const prefFor = new Map((prefs ?? []).map((p: { user_id: string; email_prefs: Record<string, boolean> }) => [p.user_id, p.email_prefs]));

    for (const r of recipients) {
      // Everything is on until someone turns it off
      if (!r.email || (prefFor.get(r.id) as Record<string, boolean> | undefined)?.[message.pref] === false) continue;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "pickt <notifications@pickt.com>",
          to: r.email,
          subject: message.title,
          html: `<p>${escapeHtml(message.title)}</p>${message.body ? `<p>${escapeHtml(message.body)}</p>` : ""}<p>— The pickt team</p>`,
        }),
      });
    }
  } catch (err) {
    console.error("[notify] failed:", err);
  }
}

// deno-lint-ignore no-explicit-any
export async function notifyApprovers(admin: any, companyId: string, message: Message) {
  // The Owners, plus every role the Owner allows to approve (migration 037)
  const { data } = await admin.rpc("company_approvers", { p_company: companyId });
  await notifyUsers(admin, data ?? [], message);
}

/** Tells the Owners and approvers of each company that referred this candidate. No figures. */
// deno-lint-ignore no-explicit-any
export async function notifyReferrers(admin: any, candidateId: string, message: Message) {
  const { data: referrers } = await admin.from("candidate_referrers").select("company_id").eq("candidate_id", candidateId);
  for (const r of referrers ?? []) await notifyApprovers(admin, r.company_id, message);
}
