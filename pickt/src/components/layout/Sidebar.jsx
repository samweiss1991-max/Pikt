import { useState } from "react";

const NAV_SECTIONS = [
  {
    items: [
      { id: "overview", label: "Overview" },
      { id: "reviewing", label: "Reviewing", badge: 3 },
    ],
  },
  {
    heading: "Discover",
    items: [
      { id: "marketplace", label: "Marketplace" },
      { id: "saved", label: "Saved" },
    ],
  },
  {
    heading: "Manage",
    items: [
      { id: "my-candidates", label: "My candidates" },
      { id: "placements", label: "Placements" },
      { id: "earnings", label: "Earnings" },
    ],
  },
  {
    items: [{ id: "settings", label: "Settings" }],
  },
];

function NavItem({ item, active, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(item.id)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "8px 16px",
        border: "none",
        borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
        borderRadius: 0,
        background: active ? "var(--surface2)" : "transparent",
        color: active ? "var(--text)" : "var(--text2)",
        fontSize: 13,
        fontWeight: active ? 500 : 400,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: active ? "var(--accent)" : "var(--border2)",
          flexShrink: 0,
        }}
      />
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.badge != null && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            background: "var(--accent-dim)",
            color: "var(--accent)",
            border: "1px solid var(--accent-border)",
            borderRadius: 99,
            padding: "1px 8px",
            lineHeight: "18px",
          }}
        >
          {item.badge}
        </span>
      )}
    </button>
  );
}

export default function Sidebar() {
  const [active, setActive] = useState("marketplace");

  return (
    <aside
      style={{
        width: 214,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        overflowY: "auto",
      }}
    >
      {/* Logo */}
      <div style={{ padding: "20px 20px 4px" }}>
        <div
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: 21,
            color: "var(--text)",
            lineHeight: 1,
          }}
        >
          pick
          <span style={{ fontStyle: "italic", color: "var(--accent)" }}>
            t
          </span>
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginTop: 4,
          }}
        >
          Talent marketplace
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, paddingTop: 16 }}>
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} style={{ marginBottom: 8 }}>
            {section.heading && (
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  padding: "8px 20px 4px",
                }}
              >
                {section.heading}
              </div>
            )}
            {section.items.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                active={active === item.id}
                onClick={setActive}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* User card */}
      <div
        style={{
          padding: "16px 20px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: "linear-gradient(135deg, var(--accent) 0%, #5a9020 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          A
        </div>
        <div style={{ overflow: "hidden" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Acme Recruiting
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>Free plan</div>
        </div>
      </div>
    </aside>
  );
}
