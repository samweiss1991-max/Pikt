// Candidate field rules: the allowed options, conversions and display wording.
//
// Used by the server (create-candidate, candidate-profile) and the browser (the
// Refer form, marketplace filters, card and profile), so they can't disagree.
// Plain JavaScript with no imports so both Deno and Vite can load it.
// The conversions mirror migration 034.

export const EXPERIENCE_BANDS = ['<1 year', '1–3 years', '3–5 years', '5–7 years', '7+ years']
export const WORK_PREFERENCES = ['Remote', 'Hybrid', 'On-site']
export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Casual']
export const RESIDENCY_STATUSES = ['Citizen', 'Permanent resident', 'Work visa', 'Student visa']
export const VISA_STATUSES = ['Work visa', 'Student visa']
export const NOTICE_WEEKS_MAX = 26

// Lowest years in each band, kept in years_experience for ranking and matching
const BAND_LOW_YEARS = { '<1 year': 0, '1–3 years': 1, '3–5 years': 3, '5–7 years': 5, '7+ years': 7 }

/** A value on a boundary goes in the higher band: 3 years is "3–5 years". */
export function bandFromYears(years) {
  if (years === null || years === undefined || years === '') return null
  const y = Number(years)
  if (!Number.isFinite(y) || y < 0) return null
  if (y < 1) return EXPERIENCE_BANDS[0]
  if (y < 3) return EXPERIENCE_BANDS[1]
  if (y < 5) return EXPERIENCE_BANDS[2]
  if (y < 7) return EXPERIENCE_BANDS[3]
  return EXPERIENCE_BANDS[4]
}

export function yearsFromBand(band) {
  return band in BAND_LOW_YEARS ? BAND_LOW_YEARS[band] : null
}

/** Days → whole weeks, rounded up, at most 26. */
export function weeksFromDays(days) {
  if (days === null || days === undefined || days === '') return null
  const d = Number(days)
  if (!Number.isFinite(d) || d < 0) return null
  return Math.min(NOTICE_WEEKS_MAX, Math.ceil(d / 7))
}

export function normaliseWorkPreference(value) {
  const v = String(value ?? '').trim().toLowerCase().replace(/[\s_-]/g, '')
  if (v === 'remote') return 'Remote'
  if (v === 'hybrid') return 'Hybrid'
  if (v === 'onsite') return 'On-site'
  return null
}

export function normaliseEmploymentType(value) {
  const v = String(value ?? '').trim().toLowerCase().replace(/[\s_-]/g, '')
  if (v === 'fulltime') return 'Full-time'
  if (v === 'parttime') return 'Part-time'
  if (v === 'contract') return 'Contract'
  if (v === 'casual') return 'Casual'
  return null
}

/** "Sydney, NSW, Australia". Leaves out whatever isn't known. */
export function formatLocation({ city, stateCode, state, country } = {}) {
  return [city, stateCode || state, country].filter(Boolean).join(', ')
}

/** "4 weeks' notice" */
export function formatNotice(weeks) {
  if (weeks === null || weeks === undefined || weeks === '') return null
  const w = Number(weeks)
  if (!Number.isFinite(w)) return null
  if (w === 0) return 'No notice period'
  return w === 1 ? "1 week's notice" : `${w} weeks' notice`
}

function list(value) {
  return Array.isArray(value) ? value : (value ? [value] : [])
}

/**
 * Turns a referral request into candidate columns, or returns an error message.
 * Fills the old columns too, because the site on master, ranking and job matching
 * still read them. Also accepts the old form's fields, while that site is live.
 */
export function candidateFieldsFromRequest(body) {
  const isNewForm = Array.isArray(body.preferred_work_types)

  const workTypes = [...new Set(list(isNewForm ? body.preferred_work_types : body.preferred_work_type)
    .map(normaliseWorkPreference).filter(Boolean))]
  if (workTypes.length === 0) return { error: 'Choose at least one work preference' }

  const employmentTypes = [...new Set(list(isNewForm ? body.employment_types : body.employment_type)
    .map(normaliseEmploymentType).filter(Boolean))]
  if (isNewForm && employmentTypes.length === 0) return { error: 'Choose at least one employment type' }

  const band = isNewForm ? (body.experience_band || null) : bandFromYears(body.years_experience)
  if (band && !EXPERIENCE_BANDS.includes(band)) return { error: 'Choose a valid years of experience option' }

  const weeks = isNewForm
    ? (body.notice_period_weeks === '' || body.notice_period_weeks == null ? null : Number(body.notice_period_weeks))
    : weeksFromDays(body.notice_period_days)
  if (weeks !== null && (!Number.isInteger(weeks) || weeks < 0 || weeks > NOTICE_WEEKS_MAX)) {
    return { error: `Notice period must be a whole number of weeks from 0 to ${NOTICE_WEEKS_MAX}` }
  }

  // The old form offered "Other", which no longer exists
  const residency = RESIDENCY_STATUSES.includes(body.residency_status) ? body.residency_status : null
  if (isNewForm && body.residency_status && !residency) return { error: 'Choose a valid residency status' }

  const visaType = VISA_STATUSES.includes(residency) ? String(body.visa_type ?? '').trim() : ''
  if (isNewForm && VISA_STATUSES.includes(residency) && !visaType) return { error: 'Visa type is required' }

  const fields = {
    experience_band: band,
    years_experience: band ? yearsFromBand(band) : (body.years_experience || null),
    location_country: body.location_country,
    location_country_code: body.location_country_code || null,
    location_state: body.location_state || null,
    location_state_code: body.location_state_code || null,
    location_city: body.location_city,
    residency_status: residency,
    visa_type: visaType || null,
    preferred_work_types: workTypes,
    preferred_work_type: workTypes[0],
    employment_types: employmentTypes,
    employment_type: employmentTypes[0] || null,
    notice_period_weeks: weeks,
    // Exact days typed on the old form are kept; otherwise worked out from weeks
    notice_period_days: isNewForm ? (weeks === null ? null : weeks * 7) : (body.notice_period_days || null),
  }
  return { fields }
}
