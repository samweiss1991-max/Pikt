import type { CandidateRecord } from "./candidatesSeed";
import type { SeniorityOption } from "../data/discoveryOptions";

export type RankedCandidate = CandidateRecord & {
  score: number;
  roleScore: number;
  seniorityScore: number;
  interviewScore: number;
  recencyScore: number;
  daysAgo: number;
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\/]/g, " ")
    .trim();
}

/** Fuzzy match 0–100 between selected role label and candidate role */
export function computeRoleScore(selectedRole: string, candidateRole: string): number {
  const a = normalize(selectedRole);
  const b = normalize(candidateRole);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (b.includes(a) || a.includes(b)) return 88;
  const tokensA = a.split(/[\s]+/).filter((t) => t.length > 1);
  const tokensB = new Set(b.split(/[\s]+/).filter((t) => t.length > 1));
  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++;
  }
  if (overlap > 0) return Math.min(95, 45 + overlap * 18);
  return 20;
}

const SENIORITY_TIER: Record<string, number> = {
  Junior: 1,
  Mid: 2,
  Senior: 3,
  Lead: 4,
  Director: 5,
  Executive: 6,
};

function tierFromSeniorityField(label: string): number {
  const t = SENIORITY_TIER[label];
  if (t !== undefined) return t;
  return tierFromCandidateLabel(label);
}

function tierFromCandidateLabel(label: string): number {
  const l = label.toLowerCase();
  if (l.includes("vp") || l.includes("c-suite") || l.includes("chief")) return 6;
  if (l.includes("director") || l.includes("head of")) return 5;
  if (l.includes("lead") || l.includes("principal")) return 4;
  if (l.includes("senior")) return 3;
  if (l.includes("mid")) return 2;
  if (l.includes("junior")) return 1;
  return 2;
}

function tierFromSelection(option: SeniorityOption): number | null {
  if (option === "Any level — show all") return null;
  if (option.startsWith("Junior")) return 1;
  if (option.startsWith("Mid-level")) return 2;
  if (option.startsWith("Senior (5")) return 3;
  if (option.startsWith("Lead/Principal")) return 4;
  if (option.startsWith("Head of/Director")) return 5;
  if (option.startsWith("VP/C-suite")) return 6;
  return 2;
}

export function computeSeniorityScore(
  selected: SeniorityOption,
  candidateSeniority: string
): number {
  const want = tierFromSelection(selected);
  if (want === null) return 100;
  const have = tierFromSeniorityField(candidateSeniority);
  const diff = Math.abs(want - have);
  return Math.max(0, 100 - diff * 22);
}

export function computeInterviewScore(interviewsCompleted: number): number {
  return Math.min(100, (interviewsCompleted / 4) * 100);
}

export function computeRecencyScore(daysAgo: number): number {
  if (daysAgo <= 3) return 100;
  if (daysAgo <= 5) return 80;
  if (daysAgo <= 7) return 60;
  return 40;
}

export function daysBetween(isoDate: string, now: Date): number {
  const d = new Date(isoDate + "T12:00:00Z");
  const ms = now.getTime() - d.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function totalScore(
  roleScore: number,
  seniorityScore: number,
  interviewScore: number,
  recencyScore: number
): number {
  return (
    roleScore * 0.35 +
    seniorityScore * 0.25 +
    interviewScore * 0.2 +
    recencyScore * 0.2
  );
}

export function rankCandidates(
  pool: CandidateRecord[],
  params: {
    role: string;
    seniority: SeniorityOption;
    now?: Date;
  }
): RankedCandidate[] {
  const now = params.now ?? new Date();
  const ranked: RankedCandidate[] = pool.map((c) => {
    const daysAgo = daysBetween(c.referred_at, now);
    const roleScore = computeRoleScore(params.role, c.role_applied_for);
    const seniorityScore = computeSeniorityScore(params.seniority, c.seniority_level);
    const interviewScore = computeInterviewScore(c.interviews_completed);
    const recencyScore = computeRecencyScore(daysAgo);
    const score = totalScore(roleScore, seniorityScore, interviewScore, recencyScore);
    return {
      ...c,
      daysAgo,
      roleScore,
      seniorityScore,
      interviewScore,
      recencyScore,
      score,
    };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, 20);
}
