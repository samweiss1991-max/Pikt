// Drafts of the Refer form are saved in the browser, so someone can come back to
// one written before the form's fields changed. This converts those fields, and
// ignores anything that no longer makes sense, so an old draft can't break the form.

import {
  bandFromYears, EMPLOYMENT_TYPES, EXPERIENCE_BANDS, normaliseEmploymentType, normaliseWorkPreference,
  RESIDENCY_STATUSES, VISA_STATUSES, WORK_PREFERENCES, weeksFromDays,
} from '../../supabase/functions/_shared/candidateFields.js'

export function upgradeReferDraft(saved, initial) {
  const {
    years_experience, preferred_work_type, employment_type, notice_period_days, ...rest
  } = saved
  const draft = { ...initial, ...rest }

  const band = saved.experience_band ?? bandFromYears(years_experience)
  draft.experience_band = EXPERIENCE_BANDS.includes(band) ? band : ''

  const work = Array.isArray(saved.preferred_work_types) ? saved.preferred_work_types : [preferred_work_type]
  draft.preferred_work_types = WORK_PREFERENCES.filter(w => work.map(normaliseWorkPreference).includes(w))

  const types = Array.isArray(saved.employment_types) ? saved.employment_types : [employment_type]
  draft.employment_types = EMPLOYMENT_TYPES.filter(t => types.map(normaliseEmploymentType).includes(t))

  const weeks = saved.notice_period_weeks ?? weeksFromDays(notice_period_days)
  draft.notice_period_weeks = Number.isInteger(weeks) && weeks >= 0 && weeks <= 26 ? weeks : ''

  // "Other" is no longer an option
  if (!RESIDENCY_STATUSES.includes(draft.residency_status)) draft.residency_status = ''
  if (!VISA_STATUSES.includes(draft.residency_status) || typeof draft.visa_type !== 'string') draft.visa_type = ''

  // Old drafts held free text with no codes; the location picker matches them up.
  // An empty country falls back to the form's default.
  if (!draft.location_country) {
    draft.location_country = initial.location_country
    draft.location_country_code = initial.location_country_code
  } else if (!saved.location_country_code) {
    draft.location_country_code = ''
  }
  if (!saved.location_state_code) draft.location_state_code = ''

  return draft
}
