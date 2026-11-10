// Candidate consent (Stage 5A): the email asking a referred candidate to confirm,
// and what happens when they say yes, no, or nothing at all.

import { brandedEmail, sendEmail } from "./email.ts";
import { DOCUMENTS_BUCKET } from "./uploads.ts";
import { notifyReferrers } from "./notify.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

export const REMINDER_AFTER_DAYS = 14;
export const EXPIRE_AFTER_DAYS = 30;

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** The secret in the emailed link. Only its hash is stored. */
export async function hashToken(token: string) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}
function newToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return hex(bytes.buffer);
}

/** Where links in emails point: the Pickt site the referral was made from */
export function siteUrlFrom(req: Request) {
  const candidates = [req.headers.get("origin"), Deno.env.get("SITE_URL")];
  for (const c of candidates) {
    try {
      const u = new URL(c ?? "");
      if (u.protocol === "https:" || u.hostname === "localhost") return u.origin;
    } catch { /* try the next */ }
  }
  return null;
}

/** Names of the companies that referred this candidate, first referrer first */
export async function referrerNames(admin: Any, candidateId: string): Promise<string[]> {
  const { data } = await admin.from("candidate_referrers").select("referrer_position, companies(name)")
    .eq("candidate_id", candidateId).order("referrer_position");
  return (data ?? []).map((r: Any) => r.companies?.name).filter(Boolean);
}

const joinNames = (names: string[]) =>
  names.length <= 1 ? names[0] ?? "A company" : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

function consentEmail({ firstName, companies, role, link, reminder }: {
  firstName: string | null; companies: string[]; role: string | null; link: string; reminder: boolean;
}) {
  const who = joinNames(companies);
  const several = companies.length > 1;
  const subject = reminder
    ? `Reminder: ${who} referred you to Pickt`
    : `${who} ${several ? "have" : "has"} referred you to Pickt`;
  const { html, text } = brandedEmail({
    preheader: `${who} thought you were a strong candidate. Would you like a Pickt profile?`,
    heading: firstName ? `Hi ${firstName}, you've been referred to Pickt` : "You've been referred to Pickt",
    paragraphs: [
      `**${who}** interviewed you${role ? ` for a ${role} role` : ""} and thought you were a strong candidate, even though the role went to someone else. They've referred you to Pickt.`,
      "**What is Pickt?** Pickt helps companies that are hiring find people other companies have already interviewed and rated highly. It's free for you.",
      "**What employers see before they unlock you:**",
      { list: ["Your role, experience, skills and location", "Your salary expectation, availability and work preferences", "How far you got in interviews, and a short summary of the feedback"] },
      "**What stays private until an employer unlocks your profile:**",
      { list: ["Your name, email and mobile number", "Your CV, LinkedIn and other documents"] },
      "Nothing goes live unless you say yes. You can pause or remove your profile at any time.",
    ],
    buttons: [
      { label: "Yes, create my profile", href: `${link}&choice=yes`, style: "primary" },
      { label: "No thanks", href: `${link}&choice=no`, style: "secondary" },
    ],
    footnote: `If you don't reply, we'll send one reminder, and after ${EXPIRE_AFTER_DAYS} days we'll delete your details.`,
    footer: "You're receiving this because a company referred you to Pickt. If you don't want a profile, choose \"No thanks\" and we'll delete your details.",
  });
  return { subject, html, text };
}

/**
 * Sends (or re-sends) the confirmation email with a fresh link. The previous
 * link stops working. Returns whether the email went.
 */
export async function sendConsentEmail(admin: Any, candidateId: string, siteUrl: string, { reminder = false } = {}) {
  const { data: c } = await admin.from("candidates").select("id, full_name, email, role_applied_for, consent_status").eq("id", candidateId).maybeSingle();
  if (!c || c.consent_status !== "awaiting") return { sent: false, error: "not_awaiting" };
  if (!c.email) return { sent: false, error: "This candidate has no email address." };

  const token = newToken();
  const now = new Date().toISOString();
  const { data: existing } = await admin.from("candidate_consent_requests").select("candidate_id, token_hash").eq("candidate_id", candidateId).maybeSingle();
  const row = {
    token_hash: await hashToken(token),
    // The link in the previous email keeps working
    previous_token_hash: existing?.token_hash ?? null,
    site_url: siteUrl, last_sent_at: now, ...(reminder ? { reminder_sent_at: now } : {}),
  };
  const { error: saveError } = existing
    ? await admin.from("candidate_consent_requests").update(row).eq("candidate_id", candidateId)
    : await admin.from("candidate_consent_requests").insert({ candidate_id: candidateId, first_sent_at: now, ...row });
  if (saveError) return { sent: false, error: saveError.message };

  const email = consentEmail({
    firstName: (c.full_name || "").trim().split(/\s+/)[0] || null,
    companies: await referrerNames(admin, candidateId),
    role: c.role_applied_for,
    link: `${siteUrl}/candidate/confirm?token=${token}`,
    reminder,
  });
  const result = await sendEmail({ to: c.email, ...email });
  await admin.from("candidate_consent_requests").update({ email_error: result.sent ? null : result.error }).eq("candidate_id", candidateId);
  return result;
}

/** Deletes the candidate's uploaded documents from storage. Best effort. */
async function deleteDocuments(admin: Any, candidateId: string) {
  const { data: c } = await admin.from("candidates").select("cv_file_url, cover_letter_url, additional_documents").eq("id", candidateId).maybeSingle();
  if (!c) return;
  const paths = [c.cv_file_url, c.cover_letter_url, ...((c.additional_documents ?? []) as Any[]).map((d) => d?.url)]
    .filter((p): p is string => typeof p === "string" && p.length > 0 && !p.startsWith("http"));
  if (!paths.length) return;
  const { error } = await admin.storage.from(DOCUMENTS_BUCKET).remove(paths);
  if (error) console.error("[consent] documents not deleted:", error.message);
}

const OUTCOME_TEXT: Record<string, string> = {
  declined: "declined to join Pickt",
  expired: "didn't respond to Pickt's email, so their details have been deleted",
  removed: "has removed their Pickt profile",
};

/**
 * The candidate said no, didn't answer, or removed their profile: delete their
 * personal details and documents, and tell the referrers (with no other detail).
 */
export async function removeCandidate(admin: Any, candidateId: string, status: "declined" | "expired" | "removed") {
  const { data: c } = await admin.from("candidates").select("role_applied_for").eq("id", candidateId).maybeSingle();
  await deleteDocuments(admin, candidateId);
  // Someone who said no keeps their scrambled email/mobile on file so they aren't referred again
  const { error } = await admin.rpc("scrub_candidate", { p_candidate: candidateId, p_status: status, p_keep_identity: status !== "expired" });
  if (error) throw new Error(error.message);
  await notifyReferrers(admin, candidateId, {
    kind: "referral_status",
    pref: "referral_status",
    title: `A candidate you referred ${OUTCOME_TEXT[status]}${c?.role_applied_for ? `: ${c.role_applied_for}` : ""}`,
    link: "/my-candidates",
  });
}

/** Marks a candidate who said yes as live */
export async function makeLive(admin: Any, candidateId: string) {
  const now = new Date().toISOString();
  const { error } = await admin.from("candidates").update({ consent_status: "live", consent_decided_at: now, last_active_at: now, updated_at: now })
    .eq("id", candidateId).eq("consent_status", "awaiting");
  if (error) throw new Error(error.message);
  await notifyReferrers(admin, candidateId, {
    kind: "referral_status", pref: "referral_status",
    title: "A candidate you referred confirmed their Pickt profile. It's now live.",
    link: "/my-candidates",
  });
}

/** The consent request a link belongs to (the latest or the previous email's link) */
export async function requestForToken(admin: Any, token: string) {
  if (!/^[0-9a-f]{64}$/.test(token || "")) return null;
  const h = await hashToken(token);
  const { data } = await admin.from("candidate_consent_requests").select("*").or(`token_hash.eq.${h},previous_token_hash.eq.${h}`).maybeSingle();
  return data ?? null;
}

/** Is this candidate live (visible and unlockable)? */
export async function isLive(admin: Any, candidateId: string) {
  const { data } = await admin.from("candidates").select("consent_status").eq("id", candidateId).maybeSingle();
  return data?.consent_status === "live";
}
