// Sending email from Pickt, through Resend (https://resend.com).
//
// Needs two secrets, set from your own terminal:
//   RESEND_API_KEY  the API key from Resend
//   EMAIL_FROM      who emails come from, e.g. "Pickt <hello@yourdomain.com>" — the
//                   domain must be verified in Resend. Until then Resend's test sender
//                   "Pickt <onboarding@resend.dev>" is used, which can only send to the
//                   email address you signed up to Resend with.

export function escapeHtml(text: unknown) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
  ));
}

export type Email = { to: string; subject: string; html: string; text: string };

/** Sends one email. Never throws: returns whether it went, and why not. */
export async function sendEmail(email: Email): Promise<{ sent: boolean; error?: string }> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { sent: false, error: "Email isn't set up yet (RESEND_API_KEY is missing)." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("EMAIL_FROM") || "Pickt <onboarding@resend.dev>",
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { sent: false, error: `Resend refused the email (${res.status}): ${detail.slice(0, 300)}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, error: `Could not reach Resend: ${(err as Error).message}` };
  }
}

// Pickt's colours, written out because email apps ignore stylesheets
const NAVY = "#002366";
const GREEN = "#065F46";
const CREAM = "#FAF8F3";
const TEXT = "#1F2937";
const MUTED = "#6B7280";

type Button = { label: string; href: string; style?: "primary" | "secondary" };

/** A Pickt-branded email: navy header, white card, buttons that work in every email app */
export function brandedEmail({ preheader, heading, paragraphs, buttons = [], footnote, footer = "Pickt connects strong candidates who weren't hired with companies that are hiring." }: {
  preheader: string;
  heading: string;
  /** Plain text; **bold** is allowed */
  paragraphs: (string | { list: string[] })[];
  buttons?: Button[];
  footnote?: string;
  /** Small print at the bottom */
  footer?: string;
}) {
  const rich = (s: string) => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const body = paragraphs.map((p) => typeof p === "string"
    ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${TEXT};">${rich(p)}</p>`
    : `<ul style="margin:0 0 16px;padding-left:20px;font-size:16px;line-height:1.6;color:${TEXT};">${p.list.map((li) => `<li style="margin:0 0 6px;">${rich(li)}</li>`).join("")}</ul>`).join("");
  const buttonHtml = buttons.map((b) => {
    const primary = b.style !== "secondary";
    return `<a href="${escapeHtml(b.href)}" style="display:inline-block;margin:0 12px 12px 0;padding:14px 24px;border-radius:10px;font-size:16px;font-weight:700;text-decoration:none;${
      primary ? `background:${GREEN};color:#FFFFFF;border:2px solid ${GREEN};` : `background:#FFFFFF;color:${NAVY};border:2px solid ${NAVY};`
    }">${escapeHtml(b.label)}</a>`;
  }).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:${CREAM};font-family:Manrope,'Segoe UI',Helvetica,Arial,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E5E7EB;">
<tr><td style="background:${NAVY};padding:24px 32px;"><span style="font-size:26px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;">Pickt</span></td></tr>
<tr><td style="padding:32px;">
<h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;color:${NAVY};">${escapeHtml(heading)}</h1>
${body}
${buttonHtml ? `<div style="margin:24px 0 8px;">${buttonHtml}</div>` : ""}
${footnote ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:${MUTED};">${rich(footnote)}</p>` : ""}
</td></tr>
<tr><td style="padding:20px 32px;background:#F9FAFB;font-size:12px;line-height:1.6;color:${MUTED};">${escapeHtml(footer)}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    heading, "",
    ...paragraphs.flatMap((p) => typeof p === "string" ? [p.replace(/\*\*/g, ""), ""] : [...p.list.map((li) => `- ${li.replace(/\*\*/g, "")}`), ""]),
    ...buttons.map((b) => `${b.label}: ${b.href}`),
    ...(footnote ? ["", footnote.replace(/\*\*/g, "")] : []),
  ].join("\n");
  return { html, text };
}
