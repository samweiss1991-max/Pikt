"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

const NAV_SECTIONS = [
  {
    label: "Discover",
    items: [
      { name: "Marketplace", href: "/dashboard", badgeKey: "marketplace" as const },
      { name: "Saved", href: "/dashboard/saved" },
    ],
  },
  {
    label: "Manage",
    items: [
      { name: "My candidates", href: "/dashboard/my-candidates" },
      { name: "Placements", href: "/dashboard/placements" },
      { name: "Earnings", href: "/dashboard/earnings" },
    ],
  },
  {
    label: "Account",
    items: [{ name: "Settings", href: "/dashboard/settings" }],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState("My Company");
  const [companyPlan, setCompanyPlan] = useState("Free plan");
  const [companyInitial, setCompanyInitial] = useState("M");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/candidates/count")
      .then((r) => r.json())
      .then((data: { count: number }) => {
        if (!cancelled) setLiveCount(data.count);
      })
      .catch(() => {
        if (!cancelled) setLiveCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;
      supabase
        .from("users")
        .select("company_id, companies(name, plan)")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (cancelled || !data) return;
          const company = data.companies as unknown as { name: string; plan: string } | null;
          if (company) {
            setCompanyName(company.name);
            setCompanyPlan(`${company.plan.charAt(0).toUpperCase() + company.plan.slice(1)} plan`);
            setCompanyInitial(company.name.charAt(0).toUpperCase());
          }
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[220px] flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      <div className="px-5 pt-6 pb-5">
        <div className="font-serif text-2xl tracking-tight text-white">
          pick<span className="italic text-accent-green">t</span>
        </div>
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
          Talent Marketplace
        </p>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                const showBadge =
                  "badgeKey" in item &&
                  item.badgeKey === "marketplace" &&
                  liveCount !== null;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`group flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-nav-active text-white"
                          : "text-muted hover:bg-nav-active/50 hover:text-foreground"
                      }`}
                    >
                      {active && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-green" />
                      )}
                      {!active && <span className="w-1.5 shrink-0" aria-hidden />}
                      <span>{item.name}</span>
                      {showBadge && (
                        <span className="ml-auto rounded-full bg-accent-green/15 px-2 py-0.5 text-[11px] font-medium text-accent-green">
                          {liveCount}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-3 pb-3">
        <Link
          href="/dashboard/refer"
          className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-accent-green px-4 py-2.5 text-sm font-semibold text-background transition-all hover:brightness-110"
        >
          + Refer candidate
        </Link>
      </div>

      <div className="border-t border-[var(--border)] px-4 py-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-sm font-semibold text-background"
            style={{
              background: "linear-gradient(135deg, #c8f060 0%, #a0d840 100%)",
            }}
          >
            {companyInitial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {companyName}
            </p>
            <p className="text-[11px] text-muted">{companyPlan}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
