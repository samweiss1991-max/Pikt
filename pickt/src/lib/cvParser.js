/**
 * CV Parser — confidence scoring and validation.
 *
 * Run after receiving Claude API response to score accuracy
 * and flag fields that need human review.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Load known skills list
let KNOWN_SKILLS = [];
try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(join(__dirname, "../data/knownSkills.json"), "utf-8");
  KNOWN_SKILLS = JSON.parse(raw).map((s) => s.toLowerCase());
} catch {
  // Fallback: empty list (scoring will be lenient)
}

/**
 * Score the confidence of a parsed CV result.
 * @param {object} parsed — structured output from Claude
 * @returns {{ score: number, issues: string[], fieldScores: object }}
 */
export function scoreParseConfidence(parsed) {
  let score = 100;
  const issues = [];
  const fieldScores = {};

  // ── Work history ──────────────────────────────────────
  if (!parsed.work_history || parsed.work_history.length < 3) {
    score -= 20;
    issues.push("Fewer than 3 work history items");
    fieldScores.work_history = "low";
  } else {
    fieldScores.work_history = "high";
  }

  (parsed.work_history || []).forEach((w, i) => {
    if (!w.company || w.company.length < 2) {
      score -= 8;
      issues.push(`Job ${i + 1}: missing company name`);
      fieldScores[`work_history_${i}_company`] = "low";
    }
    if (!w.dates || !/\d{4}/.test(w.dates)) {
      score -= 5;
      issues.push(`Job ${i + 1}: invalid or missing dates`);
      fieldScores[`work_history_${i}_dates`] = "low";
    }
    if (!w.achievement || w.achievement.split(" ").length < 8) {
      score -= 7;
      issues.push(`Job ${i + 1}: achievement too short or missing`);
      fieldScores[`work_history_${i}_achievement`] = "low";
    }
    if (!w.tenure) {
      score -= 3;
      issues.push(`Job ${i + 1}: missing tenure`);
    }
  });

  // ── Skills / top_skills ───────────────────────────────
  const skillClusters = parsed.top_skills || parsed.skills || [];

  if (Array.isArray(skillClusters) && skillClusters.length > 0) {
    if (typeof skillClusters[0] === "object" && skillClusters[0].tags) {
      // Structured skill clusters
      skillClusters.forEach((s, i) => {
        const validTags = (s.tags || []).filter((t) =>
          KNOWN_SKILLS.includes(t.toLowerCase())
        );
        if (validTags.length === 0) {
          score -= 10;
          issues.push(`Skill cluster ${i + 1} ("${s.name || "?"}"): no recognised tags`);
          fieldScores[`skill_${i}`] = "low";
        }
      });
    } else if (typeof skillClusters[0] === "string") {
      // Flat skills array
      const recognised = skillClusters.filter((t) =>
        KNOWN_SKILLS.includes(t.toLowerCase())
      );
      if (recognised.length < skillClusters.length * 0.5) {
        score -= 15;
        issues.push("More than half of skills are unrecognised");
        fieldScores.skills = "low";
      }
    }
  } else {
    score -= 15;
    issues.push("No skills extracted");
    fieldScores.skills = "low";
  }

  // ── Contact / PII fields ──────────────────────────────
  if (!parsed.full_name || parsed.full_name.length < 3) {
    score -= 10;
    issues.push("Name not extracted or too short");
    fieldScores.full_name = "low";
  }

  if (!parsed.email || !parsed.email.includes("@")) {
    score -= 5;
    issues.push("Email not extracted or invalid");
    fieldScores.email = "low";
  }

  if (!parsed.location_city) {
    score -= 5;
    issues.push("Location not extracted");
    fieldScores.location_city = "low";
  }

  // ── Seniority ─────────────────────────────────────────
  const validSeniority = [
    "Junior", "Mid-level", "Senior", "Staff/Lead",
    "Principal", "Director+", "Manager",
  ];
  if (!parsed.seniority_level || !validSeniority.includes(parsed.seniority_level)) {
    score -= 5;
    issues.push("Seniority level not mapped to valid enum");
    fieldScores.seniority_level = "low";
  }

  // ── Summary ───────────────────────────────────────────
  if (!parsed.summary || parsed.summary.split(" ").length < 10) {
    score -= 5;
    issues.push("Summary too short or missing");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    fieldScores,
  };
}

/**
 * Determine confidence band for UI display.
 * @param {number} score
 * @returns {{ band: 'high'|'medium'|'low', color: string, label: string }}
 */
export function getConfidenceBand(score) {
  if (score >= 80) {
    return {
      band: "high",
      color: "var(--green)",
      bgColor: "var(--green-dim)",
      borderColor: "var(--green-border)",
      label: "\u2713 High confidence parse",
    };
  }
  if (score >= 60) {
    return {
      band: "medium",
      color: "var(--amber)",
      bgColor: "var(--amber-dim)",
      borderColor: "var(--amber-border)",
      label: "\u26A0 Some fields may need review",
    };
  }
  return {
    band: "low",
    color: "var(--red)",
    bgColor: "var(--red-dim)",
    borderColor: "var(--red-border)",
    label: "We had difficulty parsing this CV accurately",
  };
}
