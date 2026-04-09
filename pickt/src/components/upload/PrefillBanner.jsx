import { useCallback, useEffect, useState } from "react";

/**
 * PrefillBanner — shown on /upload?prefill=:id
 * Fetches pending referral data and pre-populates the upload form.
 *
 * Props:
 *   referralId: string | null — from URL query param
 *   onPrefill: (data) => void — callback to set form values
 */

const s = {
  banner: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "14px 18px",
    borderRadius: 10,
    background: "var(--blue-dim)",
    border: "1px solid var(--blue-border)",
    marginBottom: 16,
    fontSize: 12,
    color: "var(--text2)",
    lineHeight: 1.5,
  },
  icon: {
    fontSize: 16,
    flexShrink: 0,
    marginTop: 1,
    color: "var(--blue)",
  },
  content: { flex: 1 },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--blue)",
    marginBottom: 4,
  },
  providerPill: {
    display: "inline-block",
    padding: "1px 8px",
    borderRadius: 99,
    fontSize: 10,
    fontWeight: 600,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--text2)",
    marginLeft: 6,
  },
  dismiss: {
    border: "none",
    background: "none",
    color: "var(--muted)",
    fontSize: 16,
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
    flexShrink: 0,
  },
};

const PROVIDER_NAMES = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  workday: "Workday",
};

export default function PrefillBanner({ referralId, onPrefill }) {
  const [referral, setReferral] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const fetchReferral = useCallback(async () => {
    if (!referralId) return;
    try {
      const res = await fetch(`/api/pending-referrals/${referralId}`);
      if (res.ok) {
        const data = await res.json();
        setReferral(data.referral);

        // Pre-populate form
        if (data.referral) {
          onPrefill?.({
            role_applied_for: data.referral.ats_role || "",
            candidate_name: data.referral.ats_candidate_name || "",
            reason_not_hired: data.referral.ats_rejection_reason || "",
            ats_provider: data.referral.ats_provider,
            pending_referral_id: data.referral.id,
          });
        }
      }
    } catch {
      // Silent fail
    }
  }, [referralId, onPrefill]);

  useEffect(() => {
    fetchReferral();
  }, [fetchReferral]);

  if (!referral || dismissed) return null;

  const providerName = PROVIDER_NAMES[referral.ats_provider] || referral.ats_provider;

  return (
    <div style={s.banner}>
      <span style={s.icon}>&#8505;&#65039;</span>
      <div style={s.content}>
        <div style={s.title}>
          Pre-filled from your ATS
          <span style={s.providerPill}>{providerName}</span>
        </div>
        <div>
          {referral.ats_candidate_name && (
            <span><strong>{referral.ats_candidate_name}</strong> — </span>
          )}
          {referral.ats_role && <span>{referral.ats_role}</span>}
          {referral.ats_rejection_reason && (
            <span style={{ color: "var(--muted)" }}> · {referral.ats_rejection_reason}</span>
          )}
        </div>
        <div style={{ marginTop: 4, color: "var(--muted)", fontSize: 11 }}>
          Please review and complete the remaining fields below.
        </div>
      </div>
      <button type="button" style={s.dismiss} onClick={() => setDismissed(true)}>
        &#10005;
      </button>
    </div>
  );
}
