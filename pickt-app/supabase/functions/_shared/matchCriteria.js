// Which candidates match a Marketplace search. One copy of the rules, used by the
// Marketplace page and by the server (Dashboard roles, pipeline and new matches),
// so the numbers always agree. Works on candidates shaped by mapCandidate().

import {
  employmentTypesOf, experienceBandOf, locationLabelOf, mapCandidate, matchesLocation, noticeWeeksOf, workPreferencesOf,
} from './candidateUtils.js'
import { ROLE_TO_CATEGORY } from './roleCategories.js'

export const SALARY_FLOOR = 40 // $k AUD
export const SALARY_CEIL = 300 // $k AUD, means "$300k+"

/** The Marketplace filter. Same behaviour as before it moved here. */
export function filterCandidates(list, {
  categories = [],
  query = '',
  salaryMin = null,
  salaryMax = null,
  bands = [],
  workPreferences = [],
  employment = [],
  place = null,
  interviewDepth = null,
  availability = [],
} = {}) {
  let result = list

  // Filter by category (role → category mapping)
  if (categories.length > 0) {
    result = result.filter(c => categories.includes(ROLE_TO_CATEGORY[c.role]))
  }

  // Work preference and employment type: candidates with ANY of the selected options
  if (workPreferences.length > 0) {
    result = result.filter(c => workPreferencesOf(c).some(w => workPreferences.includes(w)))
  }
  if (employment.length > 0) {
    result = result.filter(c => employmentTypesOf(c).some(t => employment.includes(t)))
  }

  // Location: Country, then State, then City, as far as chosen
  if (place?.country) {
    result = result.filter(c => matchesLocation(c, place))
  }

  // Filter by salary: the candidate's expected range must overlap the selected range
  if (salaryMax != null) {
    result = result.filter(c => (c.salaryLow || 0) <= salaryMax)
  }
  if (salaryMin != null) {
    result = result.filter(c => (c.salaryHigh || c.salaryLow || 0) >= salaryMin)
  }

  // Experience: candidates in ANY of the selected bands
  if (bands.length > 0) {
    result = result.filter(c => bands.includes(experienceBandOf(c)))
  }

  // Filter by interview depth
  if (interviewDepth) {
    if (interviewDepth === '2+') {
      result = result.filter(c => (c.interviews || 0) >= 2)
    } else if (interviewDepth === '3+') {
      result = result.filter(c => (c.interviews || 0) >= 3)
    } else if (interviewDepth === 'Final only') {
      result = result.filter(c => (c.interview_stage_reached || '').toLowerCase().includes('final'))
    }
  }

  // Filter by availability (based on notice period in weeks; unknown counts as 4)
  if (availability.length > 0) {
    result = result.filter(c => {
      const notice = noticeWeeksOf(c) ?? 4
      return availability.some(a => {
        if (a === 'Available now') return notice <= 0
        if (a === '2 weeks') return notice <= 2
        if (a === '1 month') return notice <= 4
        if (a === 'Flexible') return true
        if (a === 'Final round') return (c.interview_stage_reached || '').toLowerCase().includes('final')
        return false
      })
    })
  }

  // Filter by search query (role, city, skills, seniority)
  if (query.trim()) {
    const q = query.toLowerCase()
    result = result.filter(c =>
      c.role.toLowerCase().includes(q) ||
      locationLabelOf(c).toLowerCase().includes(q) ||
      (c.skills || []).some(s => s.toLowerCase().includes(q)) ||
      (c.seniority || '').toLowerCase().includes(q)
    )
  }

  return { candidates: result, total: result.length }
}

/** A saved search's criteria (salary in $k) → filter options (salary in $) */
export function criteriaToOptions(criteria = {}) {
  const arr = v => (Array.isArray(v) ? v : [])
  const q = String(criteria.query || '').trim()
  const min = Number(criteria.salaryMin), max = Number(criteria.salaryMax)
  return {
    categories: arr(criteria.categories),
    query: q.length >= 2 ? q : '',
    salaryMin: min > SALARY_FLOOR ? min * 1000 : null,
    salaryMax: max && max < SALARY_CEIL ? max * 1000 : null,
    bands: arr(criteria.experienceBands),
    workPreferences: arr(criteria.workPreference),
    employment: arr(criteria.employmentTypes),
    place: criteria.location?.country ? criteria.location : null,
    availability: arr(criteria.availability),
  }
}

/** Raw rows (from candidates_public) matching a saved search */
export function matchSavedSearch(rows, criteria) {
  return filterCandidates(rows.map(mapCandidate), criteriaToOptions(criteria)).candidates
}

/**
 * How well one candidate fits a saved search, 0–100: the share of the search's
 * filters they meet. A search with no filters set fits everyone at 100.
 */
export function matchPercent(candidate, criteria) {
  const c = mapCandidate(candidate)
  const opts = criteriaToOptions(criteria)
  const checks = []
  const one = (key, value) => checks.push(filterCandidates([c], { [key]: value }).total === 1)
  if (opts.categories.length) one('categories', opts.categories)
  if (opts.query) one('query', opts.query)
  if (opts.salaryMin != null) one('salaryMin', opts.salaryMin)
  if (opts.salaryMax != null) one('salaryMax', opts.salaryMax)
  if (opts.bands.length) one('bands', opts.bands)
  if (opts.workPreferences.length) one('workPreferences', opts.workPreferences)
  if (opts.employment.length) one('employment', opts.employment)
  if (opts.place) one('place', opts.place)
  if (opts.availability.length) one('availability', opts.availability)
  if (!checks.length) return 100
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}
