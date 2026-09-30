// Marketplace search criteria: defaults, "is anything set?", a stable
// fingerprint for duplicate detection, an automatic name for saved searches,
// and the browser's remembered last search.

export const SALARY_FLOOR = 40   // $k AUD
export const SALARY_CEIL = 300   // $k AUD, means "$300k+" (no upper limit)

export const DEFAULT_CRITERIA = Object.freeze({
  query: '',
  categories: [],
  salaryMin: SALARY_FLOOR,
  salaryMax: SALARY_CEIL,
  minExperience: 0,
  availability: [],
  workPreference: [],
  locations: [],
})

// The last search is remembered in this browser only (restored on the next visit)
export const REMEMBERED_SEARCH_KEY = 'pickt_marketplace_filters'
const DISCOVERY_CONFIRMED_KEY = 'pickt_discovery_confirmed'

/** Forget the remembered last search (saved searches are untouched). */
export function clearRememberedSearch() {
  try { localStorage.removeItem(REMEMBERED_SEARCH_KEY) } catch { /* storage blocked */ }
  try { sessionStorage.removeItem(DISCOVERY_CONFIRMED_KEY) } catch { /* storage blocked */ }
}

export function isDefaultCriteria(c) {
  return !c.query.trim()
    && c.categories.length === 0
    && c.salaryMin <= SALARY_FLOOR && c.salaryMax >= SALARY_CEIL
    && !c.minExperience
    && c.availability.length === 0
    && c.workPreference.length === 0
    && c.locations.length === 0
}

/** Same search → same key, regardless of order or capitalisation. */
export function criteriaKey(c) {
  const sorted = arr => [...arr].map(String).sort()
  return JSON.stringify([
    c.query.trim().toLowerCase(),
    sorted(c.categories),
    c.salaryMin,
    c.salaryMax,
    c.minExperience || 0,
    sorted(c.availability),
    sorted(c.workPreference),
    sorted(c.locations),
  ])
}

const k = n => (n >= SALARY_CEIL ? `$${SALARY_CEIL}k+` : `$${n}k`)

/** e.g. "Product · Melbourne · $120k–$160k" */
export function autoSearchName(c) {
  const parts = []
  if (c.query.trim()) parts.push(`“${c.query.trim()}”`)
  if (c.categories.length) parts.push(c.categories.join(', '))
  if (c.locations.length) parts.push(c.locations.join(', '))
  if (c.salaryMin > SALARY_FLOOR || c.salaryMax < SALARY_CEIL) parts.push(`${k(c.salaryMin)}–${k(c.salaryMax)}`)
  if (c.minExperience) parts.push(`${c.minExperience}+ yrs`)
  if (c.workPreference.length) parts.push(c.workPreference.join(', '))
  if (c.availability.length) parts.push(c.availability.join(', '))
  return (parts.join(' · ') || 'All candidates').slice(0, 120)
}
