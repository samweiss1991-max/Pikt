"use client";

import { useState } from "react";

/**
 * Light-theme pickt preview — static page with no auth required.
 * Shows marketplace tiles, locked profile, unlock modal, and shortlist.
 */

// Inline the light theme tokens so this page is self-contained
const tokens = `
  :root {
    --bg: #f5f7f2; --surface: #ffffff; --surface2: #f0f4eb; --surface3: #e8edde;
    --border: #dde5d0; --border2: #c8d4b8;
    --text: #1a2010; --text2: #3d5026; --muted: #7a8f6a;
    --accent: #7ab830; --accent-bright: #c8f060;
    --accent-dim: rgba(122,184,48,0.1); --accent-border: rgba(122,184,48,0.28);
    --green: #2d7d46; --green-dim: rgba(45,125,70,0.08); --green-border: rgba(45,125,70,0.22);
    --amber: #b45309; --amber-dim: rgba(180,83,9,0.07); --amber-border: rgba(180,83,9,0.2);
    --red: #dc2626; --red-dim: rgba(220,38,38,0.07); --red-border: rgba(220,38,38,0.2);
    --blue: #1d6fb8; --blue-dim: rgba(29,111,184,0.08); --blue-border: rgba(29,111,184,0.2);
    --purple: #6d28d9; --purple-dim: rgba(109,40,217,0.08); --purple-border: rgba(109,40,217,0.2);
  }
  @keyframes shimmer { 0%{background-position:-200px 0} 100%{background-position:200px 0} }
  body, .bg-background { margin:0; background:var(--bg) !important; color:var(--text) !important; font-family:'DM Sans',system-ui,sans-serif; font-size:13px; }
`;

const MOCK = [
  { id: "1", role: "Senior Backend Engineer", seniority: "Senior", city: "Sydney", company: "Canva", skills: ["Go", "PostgreSQL", "Kubernetes"], interviews: 4, fee: 8, salaryLow: 170000, salaryHigh: 195000, yrs: 7, days: 2, popular: true, avail: "available" },
  { id: "2", role: "Product Manager", seniority: "Mid-level", city: "Melbourne", company: "Atlassian", skills: ["Product Strategy", "SQL", "Figma"], interviews: 3, fee: 8, salaryLow: 140000, salaryHigh: 160000, yrs: 5, days: 5, popular: false, avail: "available" },
  { id: "3", role: "Staff Frontend Engineer", seniority: "Staff/Lead", city: "Brisbane", company: "SafetyCulture", skills: ["React", "TypeScript", "GraphQL"], interviews: 5, fee: 8, salaryLow: 190000, salaryHigh: 220000, yrs: 9, days: 1, popular: true, avail: "interviewing_elsewhere" },
  { id: "4", role: "Data Engineer", seniority: "Senior", city: "Sydney", company: "Zip Co", skills: ["Python", "Spark", "Airflow", "dbt"], interviews: 3, fee: 10, salaryLow: 155000, salaryHigh: 175000, yrs: 6, days: 14, popular: false, avail: "available" },
];

function chip(bg: string, border: string, color: string) {
  return { display: "inline-flex", alignItems: "center", padding: "3px 11px", borderRadius: 99, fontSize: 11, fontWeight: 500, background: bg, border: `1px solid ${border}`, color, whiteSpace: "nowrap" as const, gap: 4 };
}

function Dot({ filled }: { filled: boolean }) {
  return <div style={{ width: 8, height: 8, borderRadius: "50%", background: filled ? "var(--accent)" : "var(--border2)" }} />;
}

function Tile({ c }: { c: typeof MOCK[0] }) {
  const isNew = c.days <= 7;
  const ring = isNew ? "0 0 0 2.5px var(--green)" : c.days <= 30 ? "0 0 0 2.5px var(--amber)" : "none";
  const saving = Math.round(((0.22 - c.fee / 100) * (c.salaryLow + c.salaryHigh) / 2) / 1000);

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 1px 8px rgba(0,0,0,.03)", padding: 18, position: "relative" }}>
      {c.popular && <div style={{ position: "absolute", top: 10, right: 10, ...chip("var(--amber-dim)", "var(--amber-border)", "var(--amber)"), fontSize: 10, fontWeight: 600 }}>&#128293; Popular</div>}
      {isNew && !c.popular && <div style={{ position: "absolute", top: 10, right: 10, ...chip("var(--green-dim)", "var(--green-border)", "var(--green)"), fontSize: 10, fontWeight: 600 }}>New this week</div>}

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: "linear-gradient(135deg, var(--accent) 0%, #5a9020 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16, fontWeight: 600, boxShadow: ring, flexShrink: 0 }}>
          {c.role[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 16, color: "var(--text)" }}>{c.role}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
            <span style={chip("var(--accent-dim)", "var(--accent-border)", "var(--accent)")}>{c.seniority}</span>
            <span style={chip("var(--surface2)", "var(--border)", "var(--text2)")}>{c.city}</span>
            <span style={chip("var(--green-dim)", "var(--green-border)", "var(--green)")}>{c.interviews} interviews</span>
            {c.avail === "interviewing_elsewhere" && <span style={chip("var(--amber-dim)", "var(--amber-border)", "var(--amber)")}>Interviewing elsewhere</span>}
            {c.avail === "available" && <span style={chip("var(--green-dim)", "var(--green-border)", "var(--green)")}>Active</span>}
            <span style={chip("var(--purple-dim)", "var(--purple-border)", "var(--purple)")}>{c.yrs} yrs experience</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 12 }}>
        {c.skills.map((s) => <span key={s} style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)" }}>{s}</span>)}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 12 }}>
        <span>
          <span style={{ color: "var(--text2)" }}>{c.fee}% fee</span>
          {saving > 0 && <span style={{ color: "var(--muted)" }}> · <span style={{ color: "var(--green)", fontWeight: 700 }}>saves ~${saving}k vs agency</span></span>}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          {Array.from({ length: 5 }).map((_, i) => <Dot key={i} filled={i < c.interviews} />)}
        </div>
      </div>

      {c.days <= 7 && (
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>
          &#128065; 8 companies viewed this week
        </div>
      )}
    </div>
  );
}

function LockedProfile({ c }: { c: typeof MOCK[0] }) {
  const saving = Math.round(((0.22 - c.fee / 100) * (c.salaryLow + c.salaryHigh) / 2) / 1000);
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,.06)", padding: 22, position: "relative" }}>
      <div style={{ position: "absolute", top: 22, right: 22, textAlign: "right" }}>
        <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 28, color: "var(--accent)" }}>{c.fee}%</div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>vs 20–25% agency</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--green)", marginTop: 4 }}>saves ~${saving}k</div>
      </div>

      <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: "var(--text)", margin: 0 }}>{c.role}</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        <span style={chip("var(--accent-dim)", "var(--accent-border)", "var(--accent)")}>{c.seniority}</span>
        <span style={chip("var(--accent-dim)", "var(--accent-border)", "var(--accent)")}>{c.city}</span>
        <span style={chip("var(--green-dim)", "var(--green-border)", "var(--green)")}>{c.interviews} interviews</span>
        <span style={chip("var(--surface2)", "var(--border)", "var(--muted)")}>Currently at {c.company}</span>
        <span style={chip("var(--amber-dim)", "var(--amber-border)", "var(--amber)")}>Seeking ${Math.round(c.salaryLow/1000)}k – ${Math.round(c.salaryHigh/1000)}k</span>
        <span style={chip("var(--purple-dim)", "var(--purple-border)", "var(--purple)")}>{c.yrs} yrs experience</span>
      </div>

      {/* Shimmer bars for name/contact */}
      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ width: "45%", height: 18, borderRadius: 8, background: "linear-gradient(90deg, var(--surface2) 25%, var(--surface3) 50%, var(--surface2) 75%)", backgroundSize: "400px 100%", animation: "shimmer 1.5s ease-in-out infinite" }} />
        <div style={{ width: "55%", height: 14, borderRadius: 6, background: "linear-gradient(90deg, var(--surface2) 25%, var(--surface3) 50%, var(--surface2) 75%)", backgroundSize: "400px 100%", animation: "shimmer 1.5s ease-in-out infinite" }} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 16 }}>
        {Array.from({ length: 5 }).map((_, i) => <Dot key={i} filled={i < c.interviews} />)}
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginLeft: 8 }}>{c.interviews} interviews</span>
      </div>
    </div>
  );
}

function SocialProofBar() {
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 16, padding: "12px 18px", borderRadius: 10, background: "rgba(122,184,48,.06)", border: "1px solid var(--accent-border)", fontSize: 12, color: "var(--text2)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontWeight: 700, color: "var(--accent)" }}>8</span> companies viewed this week
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontWeight: 700, color: "var(--accent)" }}>3</span> companies have saved this
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 12px", borderRadius: 99, background: "var(--amber-dim)", border: "1px solid var(--amber-border)" }}>
        <span style={{ fontWeight: 700, color: "var(--amber)" }}>2</span>
        <span style={{ color: "var(--amber)" }}>companies reviewing now</span>
      </div>
      <div style={{ marginLeft: "auto", fontWeight: 500 }}>
        Canva <span style={{ color: "var(--amber)" }}>&#9733; 4.6</span> <span style={{ color: "var(--muted)" }}>· 6 placements</span>
      </div>
    </div>
  );
}

function UnlockModal() {
  return (
    <div style={{ width: 380, background: "var(--surface)", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.15)", padding: "28px 24px" }}>
      <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--accent-dim)", border: "1.5px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
      </div>
      <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 21, color: "var(--text)", textAlign: "center", margin: "16px 0 0" }}>
        Unlock <span style={{ fontStyle: "italic", color: "var(--accent)" }}>profile</span>
      </h2>
      <p style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", lineHeight: 1.65, margin: "8px 0 0" }}>
        You&apos;re about to unlock full access to this candidate — including name, email, LinkedIn, and employer history.
      </p>

      <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, marginTop: 20, overflow: "hidden" }}>
        {[["Placement fee", "8% of first-year salary", true], ["When charged", "On successful hire only", false], ["Candidate's desired salary", "$170k – $195k", false], ["Referred by", "Canva · 4.6 ★", false], ["Interviews completed", "4 interviews", false]].map(([label, value, accent], i) => (
          <div key={label as string} style={{ display: "flex", justifyContent: "space-between", padding: "9px 16px", fontSize: 12, borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
            <span style={{ color: "var(--muted)" }}>{label as string}</span>
            <span style={{ fontWeight: accent ? 600 : 400, color: accent ? "var(--accent)" : label === "Candidate's desired salary" ? "var(--amber)" : "var(--text)" }}>{value as string}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: "rgba(45,125,70,.08)", border: "1px solid rgba(45,125,70,.2)", marginTop: 12, fontSize: 12 }}>
        <span style={{ color: "var(--muted)" }}>vs. typical agency (20–25%)</span>
        <span style={{ fontWeight: 700, color: "var(--green)" }}>Save ~$22k – $25k</span>
      </div>

      <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.65, marginTop: 14 }}>
        By unlocking you agree to the <span style={{ color: "var(--accent)", cursor: "pointer" }}>Terms & Conditions</span>.
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <button style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 13, fontWeight: 500 }}>Cancel</button>
        <button style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600 }}>Confirm & unlock</button>
      </div>
    </div>
  );
}

// ── MAIN PAGE ───────────────────────────────────────────────

export default function LightPreview() {
  const [section, setSection] = useState<"tiles" | "profile" | "modal">("tiles");

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: tokens }} />
      <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, color: "var(--text)" }}>
        {/* Topbar */}
        <div style={{ height: 52, background: "var(--surface)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px" }}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 21 }}>
            pick<span style={{ fontStyle: "italic", color: "var(--accent)" }}>t</span>
            <span style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginLeft: 8 }}>Preview</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["tiles", "profile", "modal"] as const).map((s) => (
              <button key={s} onClick={() => setSection(s)} style={{
                padding: "6px 16px", borderRadius: 99, fontSize: 12, fontWeight: 500, cursor: "pointer",
                border: section === s ? "1px solid var(--accent-border)" : "1px solid var(--border)",
                background: section === s ? "var(--accent-dim)" : "var(--surface)",
                color: section === s ? "var(--accent)" : "var(--muted)",
              }}>{s === "tiles" ? "Marketplace" : s === "profile" ? "Locked Profile" : "Unlock Modal"}</button>
            ))}
          </div>
        </div>

        <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 32px" }}>
          {/* Marketplace tiles */}
          {section === "tiles" && (
            <>
              <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 28, fontWeight: 400, margin: "0 0 20px" }}>Marketplace</h1>

              {/* Search bar */}
              <div style={{ position: "relative", marginBottom: 16 }}>
                <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                </div>
                <input type="text" placeholder="Search roles, skills, locations…" style={{ width: "100%", height: 42, padding: "0 16px 0 40px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 14, outline: "none" }} />
              </div>

              {/* Quick filters */}
              <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto" }}>
                {["All", "Engineering", "Design", "Data", "Product", "Senior+", "Remote"].map((f, i) => (
                  <button key={f} style={{
                    padding: "6px 16px", borderRadius: 99, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap",
                    border: i === 0 ? "1px solid var(--accent-border)" : "1px solid var(--border)",
                    background: i === 0 ? "var(--accent-dim)" : "var(--surface)",
                    color: i === 0 ? "var(--accent)" : "var(--muted)", cursor: "pointer",
                  }}>{f}</button>
                ))}
              </div>

              <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>
                Showing <strong>4</strong> of <strong>24</strong> candidates
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {MOCK.map((c) => <Tile key={c.id} c={c} />)}
              </div>
            </>
          )}

          {/* Locked profile */}
          {section === "profile" && (
            <>
              <a href="#" style={{ fontSize: 12, color: "var(--muted)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16 }}>&#8592; Back to marketplace</a>

              <LockedProfile c={MOCK[0]} />

              <div style={{ marginTop: 16 }}><SocialProofBar /></div>

              {/* 3+3 snapshot */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 12 }}>Career history</div>
                  {[{ co: "Canva", tenure: "3 yrs", dates: "Jan 2022 – Present", ach: "Led migration of 2.4M user accounts to microservices, reducing p99 latency by 68%." },
                    { co: "Atlassian", tenure: "2 yrs", dates: "Mar 2020 – Dec 2021", ach: "Built real-time collaboration backend handling 50k concurrent connections." },
                    { co: "Zip Co", tenure: "1.5 yrs", dates: "Jul 2018 – Feb 2020", ach: "Designed payment processing pipeline processing $2M+ daily transactions." }
                  ].map((w, i) => (
                    <div key={i}>
                      {i > 0 && <div style={{ height: 1, background: "var(--border)", margin: "10px 0" }} />}
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{w.co}</span>
                        <span style={{ fontSize: 10, color: "var(--muted)" }}>{w.tenure}</span>
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--accent)", marginTop: 1 }}>{w.dates}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.4, marginTop: 3 }}>{w.ach}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 12 }}>Top skill sets</div>
                  {[{ name: "Backend Systems", tags: ["Go", "PostgreSQL", "gRPC"] }, { name: "Cloud Infrastructure", tags: ["AWS", "Terraform", "Kubernetes"] }, { name: "Data Pipeline", tags: ["Kafka", "Redis", "Spark"] }].map((cl, i) => (
                    <div key={i} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text2)" }}>{cl.name}</div>
                      <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
                        {cl.tags.map((t) => <span key={t} style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}>{t}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Blurred CV */}
              <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", marginTop: 16, border: "1px solid var(--border)" }}>
                <div style={{ background: "#fff", padding: "28px 24px", fontSize: 12, lineHeight: 1.6, color: "var(--text)", minHeight: 200 }}>
                  <div style={{ fontWeight: 500 }}>Sydney, NSW</div>
                  <div style={{ filter: "blur(5px)", userSelect: "none" }}>jane.doe@email.com | +61 4XX XXX XXX</div>
                  <div style={{ filter: "blur(5px)", userSelect: "none" }}>linkedin.com/in/janedoe</div>
                  <br />
                  <div style={{ filter: "blur(5px)", userSelect: "none" }}>PROFESSIONAL EXPERIENCE</div>
                  <div style={{ fontWeight: 500 }}>Canva</div>
                  <div style={{ filter: "blur(5px)", userSelect: "none" }}>Senior Backend Engineer | Jan 2022 – Present</div>
                  <div style={{ filter: "blur(5px)", userSelect: "none" }}>Led cross-functional team of 12 to migrate 2.4M accounts...</div>
                </div>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "60%", background: "linear-gradient(to bottom, transparent 0%, var(--bg) 90%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: 28 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8, boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text2)" }}>CV locked</span>
                </div>
              </div>
            </>
          )}

          {/* Unlock modal */}
          {section === "modal" && (
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 40 }}>
              <UnlockModal />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
