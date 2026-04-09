/**
 * Notification utility — creates in-app records and sends emails.
 *
 * sendNotification(recipientUserId, type, data)
 *   1. Creates a notification DB record
 *   2. Checks user email preferences
 *   3. Sends email via Resend if enabled for this type
 */

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

// ── Email preference mapping ────────────────────────────────

const TYPE_TO_PREF = {
  candidate_unlocked: "email_candidate_unlocked",
  candidate_stage_changed: "email_stage_changed",
  hire_confirmation_due: "email_hire_confirmation_due",
  ats_referral_prompt: "email_ats_referral_prompt",
  candidate_viewed: "email_candidate_viewed",
};

// ── HTML email template ─────────────────────────────────────

function buildEmailHtml({ title, body, actionUrl, actionLabel, candidateRole }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
  <style>
    body { margin: 0; padding: 0; background: #f5f7f2; font-family: 'DM Sans', system-ui, sans-serif; font-size: 14px; color: #1a2010; }
  </style>
</head>
<body>
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f5f7f2; padding: 40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width: 520px; width: 100%;">
        <!-- Logo -->
        <tr><td style="padding: 0 0 24px; text-align: center;">
          <span style="font-family: 'Instrument Serif', serif; font-size: 24px; color: #1a2010;">
            pick<span style="font-style: italic; color: #7ab830;">t</span>
          </span>
        </td></tr>
        <!-- Card -->
        <tr><td style="background: #ffffff; border: 1px solid #dde5d0; border-radius: 12px; padding: 32px 28px;">
          <!-- Title -->
          <h1 style="font-family: 'Instrument Serif', serif; font-size: 22px; font-weight: 400; color: #1a2010; margin: 0 0 8px;">
            ${title}
          </h1>
          ${candidateRole ? `<p style="font-size: 12px; color: #7a8f6a; margin: 0 0 16px;">${candidateRole}</p>` : ""}
          <!-- Body -->
          <p style="font-size: 14px; color: #3d5026; line-height: 1.6; margin: 0 0 24px;">
            ${body}
          </p>
          ${actionUrl ? `
          <!-- CTA -->
          <table cellpadding="0" cellspacing="0"><tr><td>
            <a href="${actionUrl}" style="display: inline-block; padding: 12px 28px; background: #7ab830; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 10px;">
              ${actionLabel || "View on pickt"}
            </a>
          </td></tr></table>
          ` : ""}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding: 20px 0; text-align: center;">
          <p style="font-size: 11px; color: #7a8f6a; margin: 0;">
            This email was sent by pickt. You can update your notification preferences in Settings.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Main function ───────────────────────────────────────────

/**
 * @param {string} recipientUserId - auth.users.id of the recipient
 * @param {string} type - notification_type enum value
 * @param {object} data
 * @param {string} data.title - max 80 chars
 * @param {string} data.body - max 200 chars
 * @param {string} [data.actionUrl] - link to navigate to
 * @param {string} [data.actionLabel] - CTA button text
 * @param {string} [data.candidateRole] - for email template
 * @param {object} [data.metadata] - arbitrary JSON
 * @returns {object|null} notification record
 */
export async function sendNotification(recipientUserId, type, data) {
  try {
    // Get user's company
    const { data: userData } = await supabase
      .from("users")
      .select("company_id, email, full_name")
      .eq("id", recipientUserId)
      .single();

    if (!userData) return null;

    // 1. Create in-app notification
    const { data: notification, error: insertErr } = await supabase
      .from("notification")
      .insert({
        recipient_company_id: userData.company_id,
        recipient_user_id: recipientUserId,
        type,
        title: (data.title || "").slice(0, 80),
        body: (data.body || "").slice(0, 200),
        action_url: data.actionUrl || null,
        metadata: data.metadata || {},
      })
      .select("*")
      .single();

    if (insertErr) {
      console.error("[notifications] Insert failed:", insertErr.message);
      return null;
    }

    // 2. Check email preferences
    const prefColumn = TYPE_TO_PREF[type];
    let shouldEmail = true;

    if (prefColumn) {
      const { data: pref } = await supabase
        .from("user_notification_preference")
        .select(prefColumn)
        .eq("user_id", recipientUserId)
        .single();

      if (pref && pref[prefColumn] === false) {
        shouldEmail = false;
      }
    }

    // 3. Send email if enabled
    if (shouldEmail && userData.email) {
      const html = buildEmailHtml({
        title: data.title,
        body: data.body,
        actionUrl: data.actionUrl,
        actionLabel: data.actionLabel,
        candidateRole: data.candidateRole,
      });

      await resend.emails.send({
        from: "pickt <notifications@pickt.com>",
        to: userData.email,
        subject: data.title,
        html,
      }).catch((err) => {
        console.error("[notifications] Email send failed:", err.message);
      });
    }

    return notification;
  } catch (err) {
    console.error("[notifications] sendNotification failed:", err.message);
    return null;
  }
}

/**
 * Send notification to all admin users of a company.
 */
export async function notifyCompany(companyId, type, data) {
  const { data: admins } = await supabase
    .from("users")
    .select("id")
    .eq("company_id", companyId)
    .in("role", ["admin", "member"]);

  const results = [];
  for (const admin of admins || []) {
    const r = await sendNotification(admin.id, type, data);
    if (r) results.push(r);
  }
  return results;
}

/**
 * Get unread count for a user's company.
 */
export async function getUnreadCount(companyId) {
  const { count } = await supabase
    .from("notification")
    .select("id", { count: "exact", head: true })
    .eq("recipient_company_id", companyId)
    .is("read_at", null);
  return count || 0;
}

/**
 * Mark all notifications as read for a company.
 */
export async function markAllRead(companyId) {
  await supabase
    .from("notification")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_company_id", companyId)
    .is("read_at", null);
}
