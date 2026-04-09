"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { Industry } from "@/lib/discovery-options";
import type { SeniorityOption } from "@/lib/discovery-options";

type Phase = "discovery" | "results";

type DashboardDiscoveryValue = {
  phase: Phase;
  step: 1 | 2 | 3;
  industry: Industry | null;
  role: string | null;
  seniority: SeniorityOption | null;
  pickIndustry: (i: Industry) => void;
  pickRole: (r: string) => void;
  pickSeniority: (s: SeniorityOption) => void;
  startOver: () => void;
  refine: () => void;
};

const DashboardDiscoveryContext = createContext<DashboardDiscoveryValue | null>(
  null
);

export function DashboardDiscoveryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>("discovery");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [industry, setIndustry] = useState<Industry | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [seniority, setSeniority] = useState<SeniorityOption | null>(null);

  const reset = useCallback(() => {
    setPhase("discovery");
    setStep(1);
    setIndustry(null);
    setRole(null);
    setSeniority(null);
  }, []);

  const pickIndustry = useCallback((i: Industry) => {
    setIndustry(i);
    setStep(2);
  }, []);

  const pickRole = useCallback((r: string) => {
    setRole(r);
    setStep(3);
  }, []);

  const pickSeniority = useCallback((s: SeniorityOption) => {
    setSeniority(s);
    setPhase("results");
  }, []);

  const startOver = useCallback(() => {
    reset();
  }, [reset]);

  const refine = useCallback(() => {
    if (phase === "results") {
      // Go back to step 3, keep industry + role
      setPhase("discovery");
      setStep(3);
      setSeniority(null);
    } else if (step === 3) {
      setStep(2);
      setRole(null);
      setSeniority(null);
    } else if (step === 2) {
      setStep(1);
      setIndustry(null);
      setRole(null);
      setSeniority(null);
    }
  }, [phase, step]);

  const value = useMemo(
    () => ({
      phase,
      step,
      industry,
      role,
      seniority,
      pickIndustry,
      pickRole,
      pickSeniority,
      startOver,
      refine,
    }),
    [
      phase,
      step,
      industry,
      role,
      seniority,
      pickIndustry,
      pickRole,
      pickSeniority,
      startOver,
      refine,
    ]
  );

  return (
    <DashboardDiscoveryContext.Provider value={value}>
      {children}
    </DashboardDiscoveryContext.Provider>
  );
}

export function useDashboardDiscovery() {
  const ctx = useContext(DashboardDiscoveryContext);
  if (!ctx) {
    throw new Error(
      "useDashboardDiscovery must be used within DashboardDiscoveryProvider"
    );
  }
  return ctx;
}
