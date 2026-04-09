import { useCallback, useState } from "react";

/**
 * ParsedOutput — displays CV parse results with confidence scoring,
 * editable fields, and scanned PDF notice.
 *
 * Props:
 *   parsed: object — candidate data from parse API
 *   confidence: { score, issues, fieldScores }
 *   confidenceBand: { band, color, bgColor, borderColor, label }
 *   source: 'text_extraction' | 'scanned_pdf'
 *   onSave: (editedData) => void
 */

const s = {
  wrapper: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,.04)",
    overflow: "hidden",
  },

  // Banners
  banner: (bgColor, borderColor, color) => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 20px",
    background: bgColor,
    borderBottom: `1px solid ${borderColor}`,
    fontSize: 13,
    fontWeight: 500,
    color,
  }),
  bannerIcon: { fontSize: 16 },

  scannedNotice: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 20px",
    background: "var(--blue-dim)",
    borderBottom: "1px solid var(--blue-border)",
    fontSize: 12,
    color: "var(--blue)",
  },

  // Issues list
  issuesList: {
    padding: "8px 20px 12px",
    borderBottom: "1px solid var(--border)",
  },
  issueItem: {
    fontSize: 11,
    color: "var(--muted)",
    padding: "2px 0",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  issueDot: (color) => ({
    width: 6, height: 6, borderRadius: "50%",
    background: color, flexShrink: 0,
  }),

  // Section
  section: {
    padding: "16px 20px",
    borderBottom: "1px solid var(--border)",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: 600, textTransform: "uppercase",
    letterSpacing: "0.08em", color: "var(--muted)",
  },
  editBtn: {
    border: "none", background: "none", color: "var(--accent)",
    fontSize: 12, fontWeight: 500, cursor: "pointer",
    display: "flex", alignItems: "center", gap: 4,
  },
  saveBtn: {
    padding: "6px 14px", borderRadius: 8, border: "none",
    background: "var(--accent)", color: "#fff",
    fontSize: 12, fontWeight: 600, cursor: "pointer",
  },
  cancelBtn: {
    padding: "6px 14px", borderRadius: 8,
    border: "1px solid var(--border)", background: "transparent",
    color: "var(--muted)", fontSize: 12, cursor: "pointer",
  },

  // Field display
  fieldRow: {
    display: "flex", justifyContent: "space-between",
    padding: "4px 0", fontSize: 13,
  },
  fieldLabel: { color: "var(--muted)", fontSize: 12 },
  fieldValue: { color: "var(--text)", fontWeight: 500, textAlign: "right" },
  fieldLow: (color) => ({
    borderLeft: `2px solid ${color}`,
    paddingLeft: 8,
    marginLeft: -8,
  }),

  // Input (edit mode)
  input: {
    width: "100%", padding: "6px 10px", borderRadius: 8,
    border: "1px solid var(--border)", background: "var(--surface2)",
    color: "var(--text)", fontSize: 12, outline: "none",
    marginBottom: 6,
  },
  textarea: {
    width: "100%", padding: "6px 10px", borderRadius: 8,
    border: "1px solid var(--border)", background: "var(--surface2)",
    color: "var(--text)", fontSize: 12, outline: "none",
    resize: "vertical", minHeight: 60,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    marginBottom: 6,
  },

  // Work history
  historyItem: { marginBottom: 12 },
  historyCompany: { fontSize: 13, fontWeight: 600, color: "var(--text)" },
  historyRole: { fontSize: 12, color: "var(--text2)", marginTop: 2 },
  historyMeta: { fontSize: 11, color: "var(--muted)", marginTop: 2 },
  historyAchievement: { fontSize: 11, color: "var(--muted)", marginTop: 3, lineHeight: 1.4 },
  historyDivider: { height: 1, background: "var(--border)", margin: "10px 0" },

  // Skills
  tagRow: { display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 },
  tag: {
    padding: "2px 8px", borderRadius: 6, fontSize: 10,
    background: "var(--surface2)", border: "1px solid var(--border)",
    color: "var(--text2)",
  },
  tagLow: {
    padding: "2px 8px", borderRadius: 6, fontSize: 10,
    background: "var(--amber-dim)", border: "1px solid var(--amber-border)",
    color: "var(--amber)",
  },
  clusterName: { fontSize: 12, fontWeight: 500, color: "var(--text2)" },
};

// ── Editable Section ────────────────────────────────────────

function EditableSection({ title, children, onEdit, editing, onSave, onCancel, confidence }) {
  const lowConfidence = confidence === "low";

  return (
    <div style={{
      ...s.section,
      ...(lowConfidence ? s.fieldLow("var(--amber)") : {}),
    }}>
      <div style={s.sectionHeader}>
        <span style={s.sectionTitle}>{title}</span>
        <div style={{ display: "flex", gap: 6 }}>
          {editing ? (
            <>
              <button type="button" style={s.cancelBtn} onClick={onCancel}>Cancel</button>
              <button type="button" style={s.saveBtn} onClick={onSave}>Save edits</button>
            </>
          ) : (
            <button type="button" style={s.editBtn} onClick={onEdit}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────

export default function ParsedOutput({
  parsed,
  confidence,
  confidenceBand,
  source,
  onSave,
}) {
  const [data, setData] = useState({ ...parsed });
  const [editSection, setEditSection] = useState(null);
  const [editBuffer, setEditBuffer] = useState({});

  const band = confidenceBand || { band: "high", color: "var(--green)", bgColor: "var(--green-dim)", borderColor: "var(--green-border)", label: "Parsed" };
  const fieldScores = confidence?.fieldScores || {};

  function startEdit(section) {
    setEditSection(section);
    setEditBuffer(JSON.parse(JSON.stringify(data)));
  }

  function cancelEdit() {
    setEditSection(null);
    setEditBuffer({});
  }

  const saveEdit = useCallback(() => {
    setData({ ...editBuffer });
    setEditSection(null);
    onSave?.({ ...editBuffer });
  }, [editBuffer, onSave]);

  const isEditing = (section) => editSection === section;

  return (
    <div style={s.wrapper}>
      {/* Scanned PDF notice */}
      {source === "scanned_pdf" && (
        <div style={s.scannedNotice}>
          <span style={s.bannerIcon}>&#128196;</span>
          Scanned PDF detected — used AI vision to read
        </div>
      )}

      {/* Confidence banner */}
      <div style={s.banner(band.bgColor, band.borderColor, band.color)}>
        <span style={s.bannerIcon}>
          {band.band === "high" ? "\u2713" : band.band === "medium" ? "\u26A0" : "\u26A0"}
        </span>
        {band.label}
        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 400 }}>
          Score: {confidence?.score ?? "—"}/100
        </span>
      </div>

      {/* Issues list (for medium/low) */}
      {confidence?.issues?.length > 0 && band.band !== "high" && (
        <div style={s.issuesList}>
          {confidence.issues.slice(0, 5).map((issue, i) => (
            <div key={i} style={s.issueItem}>
              <div style={s.issueDot(band.color)} />
              {issue}
            </div>
          ))}
          {confidence.issues.length > 5 && (
            <div style={{ ...s.issueItem, color: "var(--muted)" }}>
              +{confidence.issues.length - 5} more issues
            </div>
          )}
        </div>
      )}

      {/* Contact info */}
      <EditableSection
        title="Contact details"
        editing={isEditing("contact")}
        onEdit={() => startEdit("contact")}
        onSave={saveEdit}
        onCancel={cancelEdit}
        confidence={fieldScores.full_name || fieldScores.email}
      >
        {isEditing("contact") ? (
          <>
            <input style={s.input} value={editBuffer.full_name || ""} placeholder="Full name"
              onChange={(e) => setEditBuffer({ ...editBuffer, full_name: e.target.value })} />
            <input style={s.input} value={editBuffer.email || ""} placeholder="Email"
              onChange={(e) => setEditBuffer({ ...editBuffer, email: e.target.value })} />
            <input style={s.input} value={editBuffer.phone || ""} placeholder="Phone"
              onChange={(e) => setEditBuffer({ ...editBuffer, phone: e.target.value })} />
            <input style={s.input} value={editBuffer.location_city || ""} placeholder="City"
              onChange={(e) => setEditBuffer({ ...editBuffer, location_city: e.target.value })} />
          </>
        ) : (
          <>
            <div style={s.fieldRow}>
              <span style={s.fieldLabel}>Name</span>
              <span style={s.fieldValue}>{data.full_name || "—"}</span>
            </div>
            <div style={s.fieldRow}>
              <span style={s.fieldLabel}>Email</span>
              <span style={s.fieldValue}>{data.email || "—"}</span>
            </div>
            <div style={s.fieldRow}>
              <span style={s.fieldLabel}>Phone</span>
              <span style={s.fieldValue}>{data.phone || "—"}</span>
            </div>
            <div style={s.fieldRow}>
              <span style={s.fieldLabel}>Location</span>
              <span style={s.fieldValue}>{data.location_city || "—"}</span>
            </div>
          </>
        )}
      </EditableSection>

      {/* Work history */}
      <EditableSection
        title="Career history"
        editing={isEditing("work")}
        onEdit={() => startEdit("work")}
        onSave={saveEdit}
        onCancel={cancelEdit}
        confidence={fieldScores.work_history}
      >
        {isEditing("work") ? (
          (editBuffer.work_history || []).map((w, i) => (
            <div key={i} style={s.historyItem}>
              <input style={s.input} value={w.company || ""} placeholder="Company"
                onChange={(e) => {
                  const wh = [...(editBuffer.work_history || [])];
                  wh[i] = { ...wh[i], company: e.target.value };
                  setEditBuffer({ ...editBuffer, work_history: wh });
                }} />
              <input style={s.input} value={w.role || ""} placeholder="Role"
                onChange={(e) => {
                  const wh = [...(editBuffer.work_history || [])];
                  wh[i] = { ...wh[i], role: e.target.value };
                  setEditBuffer({ ...editBuffer, work_history: wh });
                }} />
              <input style={s.input} value={w.dates || ""} placeholder="Dates (e.g. Jan 2022 – Present)"
                onChange={(e) => {
                  const wh = [...(editBuffer.work_history || [])];
                  wh[i] = { ...wh[i], dates: e.target.value };
                  setEditBuffer({ ...editBuffer, work_history: wh });
                }} />
              <textarea style={s.textarea} value={w.achievement || ""} placeholder="Key achievement"
                onChange={(e) => {
                  const wh = [...(editBuffer.work_history || [])];
                  wh[i] = { ...wh[i], achievement: e.target.value };
                  setEditBuffer({ ...editBuffer, work_history: wh });
                }} />
              {i < (editBuffer.work_history || []).length - 1 && <div style={s.historyDivider} />}
            </div>
          ))
        ) : (
          (data.work_history || []).map((w, i) => (
            <div key={i}>
              {i > 0 && <div style={s.historyDivider} />}
              <div style={s.historyItem}>
                <div style={s.historyCompany}>{w.company || "—"}</div>
                {w.role && <div style={s.historyRole}>{w.role}</div>}
                <div style={s.historyMeta}>
                  {[w.dates, w.tenure].filter(Boolean).join(" · ")}
                </div>
                {w.achievement && <div style={s.historyAchievement}>{w.achievement}</div>}
              </div>
            </div>
          ))
        )}
      </EditableSection>

      {/* Skills */}
      <EditableSection
        title="Skills"
        editing={isEditing("skills")}
        onEdit={() => startEdit("skills")}
        onSave={saveEdit}
        onCancel={cancelEdit}
        confidence={fieldScores.skills}
      >
        {isEditing("skills") ? (
          <textarea
            style={s.textarea}
            value={(editBuffer.skills || []).join(", ")}
            placeholder="Comma-separated skills"
            onChange={(e) => setEditBuffer({
              ...editBuffer,
              skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
            })}
          />
        ) : (
          <>
            {Array.isArray(data.top_skills) && data.top_skills.length > 0 ? (
              data.top_skills.map((cluster, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={s.clusterName}>{cluster.name}</div>
                  <div style={s.tagRow}>
                    {(cluster.tags || []).map((t, j) => (
                      <span key={j} style={fieldScores[`skill_${i}`] === "low" ? s.tagLow : s.tag}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div style={s.tagRow}>
                {(data.skills || []).map((sk, i) => (
                  <span key={i} style={s.tag}>{sk}</span>
                ))}
              </div>
            )}
          </>
        )}
      </EditableSection>
    </div>
  );
}
