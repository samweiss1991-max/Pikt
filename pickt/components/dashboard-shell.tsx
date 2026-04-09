"use client";

import { Suspense } from "react";
import { DashboardDiscoveryProvider } from "@/contexts/dashboard-discovery-context";
import { ViewModeProvider } from "@/contexts/view-mode-context";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardDiscoveryProvider>
      <Suspense>
        <ViewModeProvider>
          <div className="flex min-h-screen bg-background">
            <DashboardSidebar />
            <div className="ml-[220px] flex min-h-screen flex-1 flex-col">
              <DashboardTopbar />
              <div className="flex flex-1 flex-col">{children}</div>
            </div>
          </div>
        </ViewModeProvider>
      </Suspense>
    </DashboardDiscoveryProvider>
  );
}
