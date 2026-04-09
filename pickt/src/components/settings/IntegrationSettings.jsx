import { useCallback, useEffect, useState } from "react";

/**
 * IntegrationSettings — ATS webhook configuration page.
 * Route: /settings/integrations
 */

const PROVIDER_INFO = {
  greenhouse: { name: "Greenhouse", color: "var(--green)" },
  lever: { name: "Lever", color: "var(--blue)" },
  workday: { name: "Workday", color: "var(--purple)" },
};

const s = {
  page: {
    minHeight: "100vh", background: "var(--bg)", padding: 32,
    fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, color: "var(--text)",
  },
  container: { maxWidth: 700, margin: "0 auto" },
  title: {
    fontFamily: "'Instrument Serif', serif", fontSize: 28, fontWeight: 400, margin: "0 0 8px",
  },
  subtitle: { fontSize: 13, color: "var(--muted)", marginBottom: 24 },

  card: (connected) => ({
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,.04)", marginBottom: 16,
    opacity: connected ? 1 : 0.75, padding: 20,
  }),
  cardHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14,
  },
  providerName: { fontSize: 15, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 },
  statusDot: (status) => ({
    width: 8, height: 8, borderRadius: "50%",
    background: status === "active" ? "var(--green)" : status === "error" ? "var(--red)" : "var(--amber)",
  }),
  statusLabel: (status) => ({
    fontSize: 11, fontWeight: 500,
    color: status === "active" ? "var(--green)" : status === "error" ? "var(--red)" : "var(--amber)",
  }),

  fieldLabel: { fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, marginTop: 12 },
  urlBox: {
    display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
    borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)",
    fontFamily: "monospace", fontSize: 11, color: "var(--text2)", wordBreak: "break-all",
  },
  copyBtn: {
    padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)",
    background: "var(--surface)", color: "var(--text2)", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
  },

  secretBox: {
    display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
    borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)",
    fontFamily: "monospace", fontSize: 11, color: "var(--text2)",
  },
  secretMasked: { flex: 1, letterSpacing: 2 },

  btnRow: { display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" },
  btn: (variant) => ({
    padding: "7px 16px", borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: "pointer",
    border: variant === "danger" ? "1px solid var(--red-border)"
      : variant === "primary" ? "none"
      : "1px solid var(--border)",
    background: variant === "primary" ? "var(--accent)"
      : variant === "danger" ? "var(--red-dim)"
      : "var(--surface)",
    color: variant === "primary" ? "#fff"
      : variant === "danger" ? "var(--red)"
      : "var(--text2)",
  }),

  // Events table
  eventsTable: { width: "100%", borderCollapse: "collapse", marginTop: 12 },
  evTh: {
    textAlign: "left", padding: "6px 8px", fontSize: 10, fontWeight: 600,
    color: "var(--muted)", textTransform: "uppercase", borderBottom: "1px solid var(--border)",
  },
  evTd: { padding: "6px 8px", fontSize: 11, color: "var(--text2)", borderBottom: "1px solid var(--border)" },
  evStatus: (status) => ({
    fontSize: 10, fontWeight: 600, padding: "1px 8px", borderRadius: 99,
    background: status === "processed" ? "var(--green-dim)" : status === "error" ? "var(--red-dim)" : "var(--surface2)",
    border: `1px solid ${status === "processed" ? "var(--green-border)" : status === "error" ? "var(--red-border)" : "var(--border)"}`,
    color: status === "processed" ? "var(--green)" : status === "error" ? "var(--red)" : "var(--muted)",
  }),

  connectCta: {
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "20px 0", gap: 10,
  },
  connectText: { fontSize: 13, color: "var(--muted)" },
};

export default function IntegrationSettings() {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSecrets, setShowSecrets] = useState({});
  const [newSecret, setNewSecret] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/integrations");
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations || []);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleConnect(provider) {
    const res = await fetch("/api/settings/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    if (res.ok) {
      const data = await res.json();
      setNewSecret((prev) => ({ ...prev, [provider]: data.webhook_secret }));
      fetchData();
    }
  }

  async function handleRegenerate(configId, provider) {
    const res = await fetch(`/api/settings/integrations/${configId}/regenerate`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setNewSecret((prev) => ({ ...prev, [provider]: data.webhook_secret }));
    }
  }

  async function handleTest(configId) {
    await fetch(`/api/settings/integrations/${configId}/test`, { method: "POST" });
    fetchData();
  }

  async function handleDisconnect(configId) {
    await fetch(`/api/settings/integrations/${configId}`, { method: "DELETE" });
    fetchData();
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <h1 style={s.title}>Integrations</h1>
        <p style={s.subtitle}>Connect your ATS to automatically prompt referrals when candidates are archived.</p>

        {loading && <div style={{ color: "var(--muted)" }}>Loading...</div>}

        {!loading && integrations.map((item) => {
          const info = PROVIDER_INFO[item.provider] || { name: item.provider, color: "var(--muted)" };
          const cfg = item.config;
          const secret = newSecret[item.provider];

          if (!item.connected) {
            return (
              <div key={item.provider} style={s.card(false)}>
                <div style={s.cardHeader}>
                  <span style={s.providerName}>{info.name}</span>
                </div>
                <div style={s.connectCta}>
                  <div style={s.connectText}>Not connected</div>
                  <button type="button" style={s.btn("primary")} onClick={() => handleConnect(item.provider)}>
                    Connect {info.name}
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={item.provider} style={s.card(true)}>
              <div style={s.cardHeader}>
                <span style={s.providerName}>
                  <div style={s.statusDot(cfg.status)} />
                  {info.name}
                </span>
                <span style={s.statusLabel(cfg.status)}>{cfg.status}</span>
              </div>

              {/* Webhook URL */}
              <div style={s.fieldLabel}>Webhook URL</div>
              <div style={s.urlBox}>
                <span style={{ flex: 1 }}>{cfg.webhook_endpoint_url}</span>
                <button type="button" style={s.copyBtn} onClick={() => copyToClipboard(cfg.webhook_endpoint_url)}>
                  Copy
                </button>
              </div>

              {/* Secret */}
              <div style={s.fieldLabel}>Webhook secret</div>
              <div style={s.secretBox}>
                <span style={s.secretMasked}>
                  {showSecrets[item.provider]
                    ? (secret || "••••••••••••••••••••••••••••••••")
                    : "••••••••••••••••"}
                </span>
                <button type="button" style={s.copyBtn}
                  onClick={() => setShowSecrets((prev) => ({ ...prev, [item.provider]: !prev[item.provider] }))}>
                  {showSecrets[item.provider] ? "Hide" : "Show"}
                </button>
                <button type="button" style={s.copyBtn}
                  onClick={() => handleRegenerate(cfg.id, item.provider)}>
                  Regenerate
                </button>
              </div>
              {secret && (
                <div style={{ fontSize: 11, color: "var(--amber)", marginTop: 4 }}>
                  New secret generated — copy it now, it won't be shown again.
                </div>
              )}

              {/* Last events */}
              {cfg.recent_events && cfg.recent_events.length > 0 && (
                <>
                  <div style={s.fieldLabel}>Recent events</div>
                  <table style={s.eventsTable}>
                    <thead>
                      <tr>
                        <th style={s.evTh}>Type</th>
                        <th style={s.evTh}>Summary</th>
                        <th style={s.evTh}>Status</th>
                        <th style={s.evTh}>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cfg.recent_events.map((ev) => (
                        <tr key={ev.id}>
                          <td style={s.evTd}>{ev.event_type}</td>
                          <td style={{ ...s.evTd, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ev.payload_summary}
                          </td>
                          <td style={s.evTd}>
                            <span style={s.evStatus(ev.status)}>{ev.status}</span>
                          </td>
                          <td style={s.evTd}>
                            {new Date(ev.created_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {/* Actions */}
              <div style={s.btnRow}>
                <button type="button" style={s.btn("default")} onClick={() => handleTest(cfg.id)}>
                  Test connection
                </button>
                <button type="button" style={s.btn("danger")} onClick={() => handleDisconnect(cfg.id)}>
                  Disconnect
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
