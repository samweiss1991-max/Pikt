import { NextResponse } from "next/server";
import { CANDIDATES } from "@/lib/candidates-seed";
import {
  INDUSTRIES,
  SENIORITY_OPTIONS,
  type Industry,
  type SeniorityOption,
} from "@/lib/discovery-options";
import { rankCandidates } from "@/lib/ranking";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const industry = searchParams.get("industry");
  const role = searchParams.get("role");
  const seniority = searchParams.get("seniority");

  if (!industry || !role || !seniority) {
    return NextResponse.json(
      { error: "Missing industry, role, or seniority" },
      { status: 400 }
    );
  }

  if (!INDUSTRIES.includes(industry as Industry)) {
    return NextResponse.json({ error: "Invalid industry" }, { status: 400 });
  }

  if (!SENIORITY_OPTIONS.includes(seniority as SeniorityOption)) {
    return NextResponse.json({ error: "Invalid seniority" }, { status: 400 });
  }

  const pool = CANDIDATES.filter((c) => c.industry === industry);
  const candidates = rankCandidates(pool, {
    role,
    seniority: seniority as SeniorityOption,
  });

  return NextResponse.json({
    candidates,
    total: candidates.length,
  });
}
