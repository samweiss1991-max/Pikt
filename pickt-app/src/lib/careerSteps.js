// Work history → ordered "career climb" steps for the candidate card.

const PRESENT_RE = /present|now|current/i

// Accepts "Jan 2022 – Present" style strings or start/end fields; returns years for the bar label.
export function parseJobDates(w) {
  const raw = w.dates || [w.start_date || w.start, w.end_date || w.end || (w.start_date || w.start ? 'Present' : '')].filter(Boolean).join(' – ')
  const years = (raw.match(/\b(19|20)\d{2}\b/g) || []).map(Number)
  const current = PRESENT_RE.test(raw)
  const start = years[0] ?? null
  const end = current ? null : (years[1] ?? years[0] ?? null)
  let short = raw
  if (start != null) {
    if (current) short = `${start}–now`
    else if (end != null && end !== start) short = `${start}–${String(end).slice(-2)}`
    else short = String(start)
  }
  return { raw, start, end, current, short }
}

// Oldest → newest, at most the 4 most recent jobs
export function careerSteps(history) {
  if (!Array.isArray(history) || history.length === 0) return []
  const jobs = history.map(w => ({ ...w, when: parseJobDates(w) }))
  const allDated = jobs.every(j => j.when.start != null)
  // Undated data is assumed newest-first (as stored), so just reverse it
  const ordered = allDated
    ? [...jobs].sort((a, b) => a.when.start - b.when.start || (a.when.current ? 1 : 0) - (b.when.current ? 1 : 0))
    : [...jobs].reverse()
  return ordered.slice(-4)
}
