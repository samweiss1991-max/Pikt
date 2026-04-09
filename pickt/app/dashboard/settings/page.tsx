"use client";

export default function SettingsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-8">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Settings</h1>
          <p className="mt-2 text-sm text-muted">
            Manage your company profile, team, and integrations.
          </p>
        </div>

        {/* Browser extension card */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Browser extension
              </h2>
              <p className="mt-1 text-sm text-muted">
                Refer candidates and search pickt directly from Greenhouse,
                Lever, Workable, or Ashby — without switching tabs.
              </p>
            </div>
            <a
              href="#"
              className="shrink-0 rounded-[12px] bg-accent-green px-5 py-2.5 text-sm font-semibold text-background transition-all hover:brightness-110"
            >
              Add to Chrome
            </a>
          </div>

          {/* Install instructions */}
          <div className="mt-6 rounded-[12px] border border-[var(--border)] bg-background p-4">
            <h3 className="text-sm font-semibold text-foreground">
              Install for development
            </h3>
            <ol className="mt-3 space-y-2 text-xs text-muted">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-nav-active text-[10px] font-semibold text-foreground">
                  1
                </span>
                Open <code className="rounded bg-nav-active px-1.5 py-0.5 text-foreground">chrome://extensions</code> in
                your browser
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-nav-active text-[10px] font-semibold text-foreground">
                  2
                </span>
                Enable <strong className="text-foreground">Developer mode</strong> (top right toggle)
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-nav-active text-[10px] font-semibold text-foreground">
                  3
                </span>
                Click <strong className="text-foreground">Load unpacked</strong> and
                select the <code className="rounded bg-nav-active px-1.5 py-0.5 text-foreground">extension/</code> folder
                in the pickt project
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-nav-active text-[10px] font-semibold text-foreground">
                  4
                </span>
                Navigate to any ATS candidate page and click the pickt icon
              </li>
            </ol>
          </div>

          {/* Supported ATS */}
          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Supported platforms
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {["Greenhouse", "Lever", "Workable", "Ashby"].map((ats) => (
                <span
                  key={ats}
                  className="rounded-[99px] border border-[var(--border)] bg-background px-3 py-1 text-xs text-muted"
                >
                  {ats}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
