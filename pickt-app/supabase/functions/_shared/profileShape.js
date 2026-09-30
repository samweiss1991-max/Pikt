// Candidate profile payload — the single place that decides what a profile
// contains when LOCKED vs UNLOCKED.
//
// Used by:
//   - supabase/functions/candidate-profile (the real server response)
//   - src/lib/candidateProfile.js (demo/offline mode, so it matches the server)
//
// Plain JavaScript with no imports so both Deno (edge functions) and Vite can load it.
//
// LOCKED payloads contain only: employer descriptions, stages, counts,
// activity and short feedback teasers. Never employer names, full feedback,
// outcome reasons, or contact details.

export const INTERVIEW_STAGES = [
  '1st phone screen',
  'Technical screen',
  '2nd round',
  '3rd round',
  'Final round',
]

const DAY_MS = 86400000

/** 1-based position of a stage in the hiring process (unknown → 1). */
export function stageRank(stage) {
  const i = INTERVIEW_STAGES.findIndex(s => s.toLowerCase() === String(stage || '').toLowerCase())
  return i === -1 ? 1 : i + 1
}

/**
 * First sentence of the feedback, cut to about `maxLen` characters on a word
 * boundary, always ending with "…". Mirrors feedback_teaser() in migration 026.
 */
export function feedbackTeaser(text, maxLen = 60) {
  if (!text || !String(text).trim()) return null
  let s = String(text).replace(/\s+/g, ' ').trim()
  const firstSentence = s.match(/^(.*?[.!?])(\s|$)/)
  if (firstSentence) s = firstSentence[1]
  if (s.length > maxLen) s = s.slice(0, maxLen).replace(/\s+\S*$/, '')
  s = s.replace(/[\s.,;:!?…-]+$/, '')
  return `${s}…`
}

/** Whole days since `date` (0 = today). Null if unknown. */
export function daysSince(date, now = Date.now()) {
  if (!date) return null
  const t = new Date(date).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((now - t) / DAY_MS))
}

/**
 * Build the profile payload.
 * @param candidate  row from `candidates` (server) or seed/mock data (demo)
 * @param interviews rows shaped like `candidate_interviews`, plus `employer_name`
 * @param unlocked   whether the viewing company has unlocked this candidate
 */
export function shapeProfile({ candidate: c, interviews = [], unlocked = false, now = Date.now() }) {
  const lastActiveAt = c.last_active_at || c.referred_at || c.created_at || null

  const rows = interviews
    .map(iv => {
      const rank = iv.stage_rank || stageRank(iv.stage_reached)
      const row = {
        id: iv.id,
        employerDescription: [iv.employer_industry, iv.employer_location].filter(Boolean).join(' · ') || 'Employer',
        stage: iv.stage_reached || INTERVIEW_STAGES[0],
        stageRank: rank,
        stageTotal: INTERVIEW_STAGES.length,
        interviewsCompleted: iv.interviews_completed || 0,
        teaser: iv.feedback_teaser || feedbackTeaser(iv.feedback),
      }
      if (unlocked) {
        row.employerName = iv.employer_name || null
        row.feedback = iv.feedback || null
        row.outcomeReason = iv.outcome_reason || null
      }
      return row
    })
    // Furthest stage first, then most interviews
    .sort((a, b) => b.stageRank - a.stageRank || b.interviewsCompleted - a.interviewsCompleted)

  const profile = {
    id: c.id,
    unlocked,
    role: c.role_applied_for || c.role,
    seniority: c.seniority_level || c.seniority || null,
    years: c.years_experience ?? c.years ?? null,
    city: c.location_city || c.city || null,
    workType: c.preferred_work_type || null,
    skills: c.skills || [],
    salaryLow: c.salary_expectation_min ?? c.salaryLow ?? null,
    salaryHigh: c.salary_expectation_max ?? c.salaryHigh ?? null,
    fee: c.fee_percentage ?? c.fee ?? null,
    // Public by product decision: the referrer is shown on marketplace cards
    referringCompany: c.referring_company || c.referringCompany || null,
    activity: {
      lastActiveAt,
      daysSince: daysSince(lastActiveAt, now),
      openToOffers: c.open_to_offers ?? (c.status ? c.status === 'available' : true),
    },
    stats: {
      employers: rows.length,
      interviews: rows.reduce((n, r) => n + r.interviewsCompleted, 0),
      finalRounds: rows.filter(r => r.stageRank === INTERVIEW_STAGES.length).length,
    },
    interviews: rows,
    contact: null,
  }

  if (unlocked) {
    profile.contact = {
      fullName: c.full_name || null,
      email: c.email || null,
      mobile: c.mobile_number || null,
      linkedin: c.linkedin_url || null,
    }
    profile.currentEmployer = c.current_employer || null
    profile.strengths = c.strengths || null
    profile.gaps = c.gaps || null
    profile.recommendation = c.recommendation || null
    profile.hasCv = Boolean(c.cv_file_url || c.cv_filename || c.has_cv)
  }

  return profile
}
