import {
  bandFromYears, formatLocation, formatNotice, normaliseEmploymentType, normaliseWorkPreference, weeksFromDays,
} from '../../supabase/functions/_shared/candidateFields.js'

// Normalize a raw candidate (from Supabase, seed data, or mock) into the
// shape the UI expects. Idempotent — returns the input unchanged if it's
// already been mapped.
export function mapCandidate(c) {
  if (!c) return null
  if (c.role && c.salaryLow !== undefined) return c
  return {
    id: c.id,
    role: c.role_applied_for || c.role,
    seniority: c.seniority_level || c.seniority,
    city: c.location_city || c.city,
    company: c.current_employer || c.referring_company || c.company || 'Unknown',
    referringCompany: c.referring_company || c.referringCompany || c.company || 'Unknown',
    skills: c.skills || [],
    interviews: c.interviews_completed ?? c.interviews ?? 0,
    interview_stage_reached: c.interview_stage_reached || c.stage || 'Technical screen',
    fee: c.fee_percentage ?? c.fee ?? null,
    salaryLow: c.salary_expectation_min ?? c.salaryLow ?? 0,
    salaryHigh: c.salary_expectation_max ?? c.salaryHigh ?? 0,
    years: c.years_experience ?? c.years ?? 0,
    daysAgo: c.referred_at
      ? Math.floor((Date.now() - new Date(c.referred_at).getTime()) / 86400000)
      : (c.daysAgo ?? 5),
    notice_period_days: c.notice_period_days,
    notice_period_weeks: c.notice_period_weeks,
    experience_band: c.experience_band,
    location_country: c.location_country,
    location_country_code: c.location_country_code,
    location_state: c.location_state,
    location_state_code: c.location_state_code,
    residency_status: c.residency_status,
    preferred_work_types: c.preferred_work_types,
    employment_types: c.employment_types,
    employment_type: c.employment_type,
    strengths: c.strengths,
    gaps: c.gaps,
    feedback_summary: c.feedback_summary,
    recommendation: c.recommendation,
    why_not_hired: c.why_not_hired,
    industry: c.industry,
    status: c.status || 'available',
    preferred_work_type: c.preferred_work_type || 'Hybrid',
    workHistory: c.workHistory || c.work_history || [],
    full_name: c.full_name,
    email: c.email,
    mobile_number: c.mobile_number,
    linkedin_url: c.linkedin_url,
    current_employer: c.current_employer || c.company,
    current_job_title: c.current_job_title || c.role_applied_for || c.role,
    // Per-employer description / stage / teaser only (see migration 027)
    interviewSnapshot: c.interview_snapshot || c.interviewSnapshot || null,
    is_silver_medallist: c.is_silver_medallist,
  }
}

// ── Candidate fields, whichever shape the record is in (new columns, older
// columns, or demo data) ──

export function experienceBandOf(c) {
  return c?.experience_band || bandFromYears(c?.years_experience ?? c?.years)
}

export function locationPartsOf(c) {
  return {
    city: c?.location_city || c?.city || '',
    stateCode: c?.location_state_code || c?.stateCode || '',
    state: c?.location_state || c?.state || '',
    countryCode: c?.location_country_code || c?.countryCode || '',
    country: c?.location_country || c?.country || '',
  }
}

/** "Sydney, NSW, Australia" */
export function locationLabelOf(c) {
  return formatLocation(locationPartsOf(c))
}

/** Sorted for display: "Hybrid · Remote" */
export function workPreferencesOf(c) {
  const list = c?.preferred_work_types?.length ? c.preferred_work_types : [c?.preferred_work_type || c?.workType]
  return [...new Set(list.map(normaliseWorkPreference).filter(Boolean))].sort()
}

export function employmentTypesOf(c) {
  const list = c?.employment_types?.length ? c.employment_types : [c?.employment_type]
  return [...new Set(list.map(normaliseEmploymentType).filter(Boolean))]
}

export function noticeWeeksOf(c) {
  return c?.notice_period_weeks ?? weeksFromDays(c?.notice_period_days)
}

/** "4 weeks' notice" */
export function noticeLabelOf(c) {
  return formatNotice(noticeWeeksOf(c))
}

/** Marketplace filter: Country, then State, then City, as far as chosen. */
export function matchesLocation(c, filter) {
  if (!filter?.country) return true
  const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()
  const p = locationPartsOf(c)
  if (!(same(p.countryCode, filter.countryCode) && p.countryCode) && !same(p.country, filter.country)) return false
  if (filter.state && !(same(p.stateCode, filter.stateCode) && p.stateCode) && !same(p.state, filter.state)) return false
  if (filter.city && !same(p.city, filter.city)) return false
  return true
}

// Icon symbol based on role keywords
export function getIconForRole(role) {
  const r = (role || '').toLowerCase()
  if (r.includes('frontend') || r.includes('react') || r.includes('design')) return 'architecture'
  if (r.includes('cloud') || r.includes('devops') || r.includes('platform')) return 'cloud'
  if (r.includes('data') || r.includes('analytics') || r.includes('ml')) return 'database'
  if (r.includes('security')) return 'shield'
  if (r.includes('mobile')) return 'smartphone'
  if (r.includes('product')) return 'category'
  if (r.includes('sales') || r.includes('account') || r.includes('revenue')) return 'trending_up'
  if (r.includes('marketing') || r.includes('growth') || r.includes('seo')) return 'campaign'
  if (r.includes('hr') || r.includes('people') || r.includes('talent')) return 'groups'
  if (r.includes('finance') || r.includes('cfo')) return 'account_balance'
  if (r.includes('legal') || r.includes('compliance') || r.includes('privacy')) return 'gavel'
  if (r.includes('operations') || r.includes('coo') || r.includes('project')) return 'settings'
  if (r.includes('customer') || r.includes('success')) return 'support_agent'
  return 'code'
}

// Gradient class based on index
const GRADIENTS = [
  'from-primary-container to-secondary-container',
  'from-tertiary-fixed to-primary-fixed-dim',
  'from-secondary-container to-primary-container',
  'from-primary-fixed-dim to-tertiary-container',
  'from-tertiary-container to-secondary-container',
  'from-secondary-fixed to-primary-container',
]

export function getGradientClass(index) {
  return GRADIENTS[index % GRADIENTS.length]
}
