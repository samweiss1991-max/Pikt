// Drafts of the Refer form are saved in the browser, so someone can come back to
// one written before the form's fields changed. This converts those fields, and
// ignores anything that no longer makes sense, so an old draft can't break the form.

import {
  bandFromYears, EMPLOYMENT_TYPES, EXPERIENCE_BANDS, INTERVIEW_OUTCOMES, MAX_FEEDBACK_CHIP_LENGTH, MAX_FEEDBACK_CHIPS,
  normaliseEmploymentType, normaliseWorkPreference, OTHER_OUTCOME,
  RESIDENCY_STATUSES, VISA_STATUSES, WORK_PREFERENCES, weeksFromDays,
} from '../../supabase/functions/_shared/candidateFields.js'

export function upgradeReferDraft(saved, initial) {
  const {
    years_experience, preferred_work_type, employment_type, notice_period_days,
    why_not_hired, strengths, gaps, feedback_summary, interview_notes, ...rest
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

  // Interview feedback: old free text becomes chips if short, otherwise it moves to answer (a)
  const text = v => (typeof v === 'string' ? v.trim() : '')
  const fitsChip = t => t && t.length <= MAX_FEEDBACK_CHIP_LENGTH
  const clean = v => (Array.isArray(v)
    ? [...new Set(v.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim().slice(0, MAX_FEEDBACK_CHIP_LENGTH)))].slice(0, MAX_FEEDBACK_CHIPS)
    : [])

  const roundNotes = Array.isArray(interview_notes) ? interview_notes.map(n => text(n?.note_text)).filter(Boolean) : []
  const oldNotes = [
    text(feedback_summary),
    ...(fitsChip(text(strengths)) ? [] : [text(strengths)]),
    ...(fitsChip(text(gaps)) ? [] : [text(gaps)]),
    ...roundNotes,
  ].filter(Boolean).join('\n\n')

  draft.strengths_list = clean(saved.strengths_list).length ? clean(saved.strengths_list) : (fitsChip(text(strengths)) ? [text(strengths)] : [])
  draft.development_areas = clean(saved.development_areas).length ? clean(saved.development_areas) : (fitsChip(text(gaps)) ? [text(gaps)] : [])
  draft.note_impressed = text(saved.note_impressed) ? saved.note_impressed : oldNotes
  draft.note_why_not_offer = typeof saved.note_why_not_offer === 'string' ? saved.note_why_not_offer : ''
  draft.note_best_fit = typeof saved.note_best_fit === 'string' ? saved.note_best_fit : ''

  const reason = text(saved.outcome ?? why_not_hired)
  draft.outcome = INTERVIEW_OUTCOMES.includes(reason) ? reason : (reason ? OTHER_OUTCOME : '')
  draft.outcome_other = draft.outcome !== OTHER_OUTCOME ? ''
    : (text(saved.outcome_other) || (INTERVIEW_OUTCOMES.includes(reason) ? '' : reason))

  return draft
}
