export default function Topbar({ title, actions }) {
  return (
    <header
      style={{
        height: 52,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Page title */}
      <h1
        style={{
          fontFamily: "'Instrument Serif', serif",
          fontSize: 20,
          fontWeight: 400,
          color: "var(--text)",
          margin: 0,
        }}
      >
        {title}
      </h1>

      {/* Right slot: actions + notification bell */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {actions}
        <button
          type="button"
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--muted)",
            position: "relative",
          }}
          aria-label="Notifications"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>
      </div>
    </header>
  );
}
