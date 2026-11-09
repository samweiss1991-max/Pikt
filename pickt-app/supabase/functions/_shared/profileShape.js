// Candidate profile payload — the single place that decides what a profile
// contains when LOCKED vs UNLOCKED.
//
// Used by:
//   - supabase/functions/candidate-profile (the real server response)
//   - src/lib/candidateProfile.js (demo/offline mode, so it matches the server)
//
// Plain JavaScript so both Deno (edge functions) and Vite can load it.
//
// LOCKED payloads contain only: employer descriptions, stages, counts,
// activity and short feedback teasers. Never employer names, full feedback,
// outcome reasons, or contact details.

import {
  bandFromYears, formatLocation, formatNotice, normaliseEmploymentType, normaliseWorkPreference, weeksFromDays,
} from './candidateFields.js'

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
 * @param isHired    whether any company has recorded a hire for this candidate
 * @param hire       hire details, passed only if the viewing company made the hire
 * @param fee        total fee for this viewer (server: null for the candidate's
 *                   referrers). Demo mode leaves it out and uses the demo data's value.
 * @param viewerIsReferrer  the viewing company referred this candidate
 * @param viewerReferrer    that company's own { position, rate }
 */
export function shapeProfile({
  candidate: c, interviews = [], unlocked = false, isHired = false, hire = null,
  fee, viewerIsReferrer = false, viewerReferrer = null, now = Date.now(),
}) {
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
    experienceBand: c.experience_band || bandFromYears(c.years_experience ?? c.years),
    city: c.location_city || c.city || null,
    location: formatLocation({
      city: c.location_city || c.city,
      stateCode: c.location_state_code || c.stateCode,
      state: c.location_state || c.state,
      country: c.location_country || c.country,
    }) || null,
    // Sorted for display: "Hybrid · Remote"
    workPreferences: [...new Set((c.preferred_work_types?.length ? c.preferred_work_types : [c.preferred_work_type || c.workType])
      .map(normaliseWorkPreference).filter(Boolean))].sort(),
    employmentTypes: [...new Set((c.employment_types?.length ? c.employment_types : [c.employment_type])
      .map(normaliseEmploymentType).filter(Boolean))],
    notice: formatNotice(c.notice_period_weeks ?? weeksFromDays(c.notice_period_days)),
    // Residency status is shown to everyone; visa type only after unlocking (below)
    residencyStatus: c.residency_status || null,
    skills: c.skills || [],
    salaryLow: c.salary_expectation_min ?? c.salaryLow ?? null,
    salaryHigh: c.salary_expectation_max ?? c.salaryHigh ?? null,
    fee: fee !== undefined ? fee : (c.fee_percentage ?? c.fee ?? null),
    viewerIsReferrer,
    viewerReferrer,
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
    profile.visaType = c.visa_type || null
    profile.currentEmployer = c.current_employer || null
    profile.strengths = c.strengths || null
    profile.gaps = c.gaps || null
    profile.recommendation = c.recommendation || null
    profile.hasCv = Boolean(c.cv_file_url || c.cv_filename || c.has_cv)
    profile.isHired = isHired
    profile.hire = hire
      ? {
          startDate: hire.start_date,
          salary: hire.first_year_salary,
          totalFeePercentage: hire.total_fee_percentage,
          totalFeeAmount: hire.total_fee_amount,
        }
      : null
  }

  return profile
}
