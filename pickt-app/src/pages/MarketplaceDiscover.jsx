import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { getCandidates, getCandidatesRaw } from '../lib/seedData'
import { CANDIDATES as MOCK_CANDIDATES } from '../data/discoveryOptions'
import { fetchCandidatesPublic } from '../lib/supabaseQueries'
import { COPY } from '../lib/copy'
import { useViewMode } from '../context/ViewModeContext'
import { useSearch } from '../context/SearchContext'
import RightInsightsPanel from '../components/marketplace/RightInsightsPanel'
import EmptyState from '../components/shared/EmptyState'
import ErrorBanner from '../components/shared/ErrorBanner'
import { useScrollReveal } from '../hooks/useScrollReveal'
import { computeCategoryCounts, ROLE_TO_CATEGORY } from '../lib/roleCategories'
import { mapCandidate } from '../lib/candidateUtils'
import LocationSelect from '../components/forms/LocationSelect'
import { EMPTY_LOCATION } from '../lib/locations'
import { EMPLOYMENT_TYPES, EXPERIENCE_BANDS, formatLocation, WORK_PREFERENCES } from '../../supabase/functions/_shared/candidateFields.js'
import SaveSearchControls from '../components/search/SaveSearchControls'
import { SALARY_FLOOR, SALARY_CEIL, REMEMBERED_SEARCH_KEY, clearRememberedSearch, isDefaultCriteria } from '../lib/searchCriteria'
import CandidateResults, { ViewSwitcher } from '../components/results/CandidateResults'
import { filterCandidates } from '../../supabase/functions/_shared/matchCriteria.js'
import { openRole } from '../lib/dashboard'
import './MarketplaceDiscover.css'

const isDevMode = import.meta.env.DEV


const CATEGORY_CHIPS = [
  { key: 'Engineering', icon: 'code' },
  { key: 'Sales', icon: 'trending_up' },
  { key: 'Product', icon: 'palette' },
  { key: 'Data', icon: 'bar_chart' },
  { key: 'Operations', icon: 'settings' },
  { key: 'Finance', icon: 'account_balance' },
]

const DEFAULT_ROLES = [
  'Account Executive', 'Backend Engineer', 'Customer Success Manager',
  'Data Analyst', 'DevOps Engineer', 'Frontend Engineer',
  'Head of Product', 'Head of Sales', 'ML / AI Engineer',
  'Product Manager', 'Solutions Architect', 'UX / UI Designer',
]

const EXPANDED_ROLES = [
  'Analytics Engineer', 'Brand Manager', 'CFO / Finance Director',
  'Compliance Manager', 'Content / SEO', 'Data Engineer',
  'Data Scientist', 'Growth Marketer', 'Head of CS',
  'Head of Data', 'SDR / BDR', 'Talent Acquisition',
]

const ALL_ROLES = [...DEFAULT_ROLES, ...EXPANDED_ROLES]

const AVAILABILITY_OPTIONS = ['Available now', '2 weeks', '1 month', 'Flexible', 'Final round']

// Salary slider bounds (SALARY_FLOOR / SALARY_CEIL, in $k AUD) come from lib/searchCriteria
const SALARY_STEP = 5

// Saved or remembered searches from before these filters changed
const OLD_MIN_EXPERIENCE_TO_BANDS = {
  2: EXPERIENCE_BANDS.slice(1),
  5: EXPERIENCE_BANDS.slice(3),
  8: EXPERIENCE_BANDS.slice(4),
}
const OLD_CITY_TO_LOCATION = {
  Sydney: { countryCode: 'AU', country: 'Australia', stateCode: 'NSW', state: 'New South Wales', city: 'Sydney' },
  Melbourne: { countryCode: 'AU', country: 'Australia', stateCode: 'VIC', state: 'Victoria', city: 'Melbourne' },
  Brisbane: { countryCode: 'AU', country: 'Australia', stateCode: 'QLD', state: 'Queensland', city: 'Brisbane' },
}

function sanitizeLocation(saved) {
  if (saved?.location?.country) {
    const { countryCode = '', country, stateCode = '', state = '', city = '' } = saved.location
    return { countryCode, country, stateCode, state, city }
  }
  // Only a single named city converts exactly; "Other cities" or several don't
  return (Array.isArray(saved?.locations) && saved.locations.length === 1 && OLD_CITY_TO_LOCATION[saved.locations[0]]) || null
}

function formatSalaryK(k) {
  return k >= SALARY_CEIL ? `$${SALARY_CEIL}k+` : `$${k}k`
}

// Spoken form for screen readers, e.g. "80,000 dollars AUD"
function salarySpoken(k) {
  const dollars = `${(k * 1000).toLocaleString('en-AU')} dollars AUD`
  return k >= SALARY_CEIL ? `${dollars} or more` : dollars
}

// ── Remembered last search (localStorage, this browser only) ──
// Restored on return; "New search" deletes it. Named saved searches live on
// the server instead (see SaveSearchControls).
// Every access is wrapped in try/catch: storage can be blocked (private mode, browser settings).

const DEFAULT_FILTERS = {
  query: '', categories: [], salaryMin: SALARY_FLOOR, salaryMax: SALARY_CEIL,
  experienceBands: [], availability: [], workPreference: [], employmentTypes: [], location: null,
}

// Only keep values the current UI still offers (options may change between releases)
function sanitizeFilters(saved) {
  if (!saved || typeof saved !== 'object') return DEFAULT_FILTERS
  const pick = (arr, allowed) => Array.isArray(arr) ? arr.filter(v => allowed.includes(v)) : []
  const inRange = (n, fallback) => Number.isFinite(n) && n >= SALARY_FLOOR && n <= SALARY_CEIL ? n : fallback
  const salaryMin = inRange(saved.salaryMin, SALARY_FLOOR)
  const salaryMax = inRange(saved.salaryMax, SALARY_CEIL)
  const validSalary = salaryMin < salaryMax
  return {
    query: typeof saved.query === 'string' ? saved.query.slice(0, 100) : '',
    categories: pick(saved.categories, CATEGORY_CHIPS.map(c => c.key)),
    salaryMin: validSalary ? salaryMin : SALARY_FLOOR,
    salaryMax: validSalary ? salaryMax : SALARY_CEIL,
    experienceBands: pick(saved.experienceBands ?? OLD_MIN_EXPERIENCE_TO_BANDS[saved.minExperience], EXPERIENCE_BANDS),
    availability: pick(saved.availability, AVAILABILITY_OPTIONS),
    workPreference: pick(saved.workPreference, WORK_PREFERENCES),
    employmentTypes: pick(saved.employmentTypes, EMPLOYMENT_TYPES),
    location: sanitizeLocation(saved),
  }
}

function loadSavedFilters() {
  try {
    return sanitizeFilters(JSON.parse(localStorage.getItem(REMEMBERED_SEARCH_KEY) || 'null'))
  } catch {
    return DEFAULT_FILTERS
  }
}

function saveFilters(filters) {
  try {
    // Nothing set = nothing to remember (e.g. right after "New search")
    if (isDefaultCriteria(filters)) localStorage.removeItem(REMEMBERED_SEARCH_KEY)
    else localStorage.setItem(REMEMBERED_SEARCH_KEY, JSON.stringify(filters))
  } catch { /* storage blocked — ignore */ }
}

export default function MarketplaceDiscover() {
  const location = useLocation()
  const { setViewMode } = useViewMode()
  const { query: searchQuery, setQuery: setTopbarQuery, searchCommand } = useSearch()

  const [candidates, setCandidates] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Last search + filters, restored from localStorage (read once on mount)
  const [saved] = useState(loadSavedFilters)

  // ── Discovery / tray state ──
  const [activeCategories, setActiveCategories] = useState(saved.categories)
  const [categoryCounts, setCategoryCounts] = useState({})
  const [discoveryConfirmed, setDiscoveryConfirmed] = useState(() => {
    try { return sessionStorage.getItem('pickt_discovery_confirmed') === 'true' } catch { return false }
  })
  const [trayDismissing, setTrayDismissing] = useState(false)
  // Open "More filters" straight away if any of its filters were restored
  const [showMoreFilters, setShowMoreFilters] = useState(() =>
    saved.salaryMin > SALARY_FLOOR || saved.salaryMax < SALARY_CEIL || saved.experienceBands.length > 0 ||
    saved.availability.length > 0 || saved.workPreference.length > 0 || saved.employmentTypes.length > 0 || Boolean(saved.location)
  )

  // ── Pill filters ──
  const [availability, setAvailability] = useState(saved.availability)
  const [workPreference, setWorkPreference] = useState(saved.workPreference)
  const [employmentTypes, setEmploymentTypes] = useState(saved.employmentTypes)
  const [locationFilter, setLocationFilter] = useState(saved.location)

  // ── Salary & experience filters ──
  const [salaryMin, setSalaryMin] = useState(saved.salaryMin)
  const [salaryMax, setSalaryMax] = useState(saved.salaryMax)
  const [topSalaryThumb, setTopSalaryThumb] = useState('max') // which handle sits on top when they overlap
  const [experienceBands, setExperienceBands] = useState(saved.experienceBands)

  // ── Tray search state ──
  const [trayQuery, setTrayQuery] = useState(saved.query)
  const [appliedQuery, setAppliedQuery] = useState(saved.query.trim().length >= 2 ? saved.query.trim() : '') // debounced trayQuery used for filtering
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const traySearchRef = useRef(null)
  const trayInputRef = useRef(null)
  const debounceRef = useRef(null)

  // ── Central data loader ──
  // Single source of truth for loading + filtering candidates.
  // Returns { candidates, total } and updates component state.

  const allCandidatesRef = useRef([])
  const [dataLoaded, setDataLoaded] = useState(false)

  // The filtering rules live in one shared file, also used by the Dashboard on the server
  function fetchCandidates(options = {}) {
    return filterCandidates(allCandidatesRef.current, options)
  }

  function loadCandidates() {
    setLoading(true)
    setError(null)
    try {
      const result = fetchCandidates({
        categories: activeCategories,
        query: appliedQuery || searchQuery,
        salaryMin: salaryMin > SALARY_FLOOR ? salaryMin * 1000 : null,
        salaryMax: salaryMax < SALARY_CEIL ? salaryMax * 1000 : null,
        bands: experienceBands,
        workPreferences: workPreference,
        employment: employmentTypes,
        place: locationFilter,
        availability,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setCandidates(result.candidates)
        setTotal(result.total)
      }

      // Always compute category counts from the full, unfiltered set
      if (allCandidatesRef.current.length > 0) {
        setCategoryCounts(computeCategoryCounts(allCandidatesRef.current).categoryCounts)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Reset discovery state when navigating to this page with sessionStorage cleared
  useEffect(() => {
    try {
      if (sessionStorage.getItem('pickt_discovery_confirmed') !== 'true' && discoveryConfirmed) {
        setDiscoveryConfirmed(false)
        setActiveCategories([])
      }
    } catch { /* ignore */ }
  }, [location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // One-time async load: Supabase first, fall back to seed/mock if empty or errors
  useEffect(() => {
    let cancelled = false
    async function loadInitial() {
      setLoading(true)
      let pool = []
      if (isDevMode) {
        const seeded = getCandidatesRaw()
        if (seeded && seeded.length > 0) pool = getCandidates().map(mapCandidate)
      }
      if (pool.length === 0) {
        try {
          const rows = await fetchCandidatesPublic()
          if (rows && rows.length > 0) pool = rows.map(mapCandidate)
        } catch {
          // fall through to seed/mock
        }
      }
      if (pool.length === 0) {
        const stored = getCandidates()
        pool = (stored && stored.length > 0)
          ? stored.map(mapCandidate)
          : MOCK_CANDIDATES.map(mapCandidate)
      }
      if (cancelled) return
      allCandidatesRef.current = pool
      setDataLoaded(true)
    }
    loadInitial()
    return () => { cancelled = true }
  }, [])

  // Load candidates whenever any filter changes (after the initial pool is loaded).
  // Every filter goes through this one path so they always combine consistently.
  useEffect(() => {
    if (!dataLoaded) return
    loadCandidates()
  }, [dataLoaded, activeCategories, searchQuery, appliedQuery, salaryMin, salaryMax, experienceBands, availability, workPreference, employmentTypes, locationFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  function confirmDiscovery() {
    if (!discoveryConfirmed) {
      setTrayDismissing(true)
      setTimeout(() => {
        setDiscoveryConfirmed(true)
        setTrayDismissing(false)
        try { sessionStorage.setItem('pickt_discovery_confirmed', 'true') } catch { /* ignore */ }
      }, 200)
    }
  }

  function clearAllFilters() {
    setActiveCategories([])
    setTrayQuery('')
    setAppliedQuery('')
    setSuggestions([])
    setSalaryMin(SALARY_FLOOR)
    setSalaryMax(SALARY_CEIL)
    setExperienceBands([])
    setAvailability([])
    setWorkPreference([])
    setEmploymentTypes([])
    setLocationFilter(null)
  }

  // ── New search / Clear all: back to the initial search page, everything reset ──
  const [announcement, setAnnouncement] = useState('')
  const [resetTick, setResetTick] = useState(0)
  const focusAfterReset = useRef(false)

  function newSearchReset() {
    clearRememberedSearch()          // the old search must not come back after a reload
    clearAllFilters()
    closeSuggestions()
    setShowMoreFilters(false)
    setTrayDismissing(false)
    setDiscoveryConfirmed(false)     // show the search panel again
    setTopbarQuery('')
    focusAfterReset.current = true
    setResetTick(t => t + 1)
  }

  // After a reset has rendered: scroll to the search panel, focus the box, announce it
  useEffect(() => {
    if (!focusAfterReset.current) return
    focusAfterReset.current = false
    const input = trayInputRef.current
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    input?.closest('.mk-tray-wrap')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    input?.focus({ preventScroll: true })
    const t1 = setTimeout(() => setAnnouncement('Search cleared'), 50)
    const t2 = setTimeout(() => setAnnouncement(''), 2500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [resetTick])

  // "New search" pressed while on this page (sent from the search actions bar)
  useEffect(() => {
    if (searchCommand?.type !== 'reset') return
    Promise.resolve().then(newSearchReset)
  }, [searchCommand?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Arrived via "New search" from another page: state is already fresh, just focus + announce
  useEffect(() => {
    if (!location.state?.newSearch) return
    // Drop the one-off flag so a reload doesn't repeat this. Done on the browser history
    // directly: a router navigation would remount the page and lose the focus.
    window.history.replaceState({ ...window.history.state, usr: null }, '')
    focusAfterReset.current = true
    Promise.resolve().then(() => setResetTick(t => t + 1))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // From the Dashboard: ?search=<role> runs that company role (saved search);
  // ?searches=open opens the saved searches menu
  const [openSearchesMenu] = useState(() => new URLSearchParams(location.search).get('searches') === 'open')
  const [roleNotice, setRoleNotice] = useState(null)
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('search')
    if (!id) return undefined
    let cancelled = false
    openRole(id)
      .then(role => { if (!cancelled) { runSavedSearch(role.criteria); setRoleNotice(`Showing matches for: ${role.name}`) } })
      .catch(() => { if (!cancelled) setRoleNotice("That role couldn't be opened. It may have been deleted.") })
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Run a saved search: apply its text + filters (results and count update as usual)
  function runSavedSearch(criteria) {
    const c = sanitizeFilters(criteria)
    setActiveCategories(c.categories)
    setTrayQuery(c.query)
    setAppliedQuery(c.query.trim().length >= 2 ? c.query.trim() : '')
    closeSuggestions()
    setSalaryMin(c.salaryMin)
    setSalaryMax(c.salaryMax)
    setExperienceBands(c.experienceBands)
    setAvailability(c.availability)
    setWorkPreference(c.workPreference)
    setEmploymentTypes(c.employmentTypes)
    setLocationFilter(c.location)
    setShowMoreFilters(c.salaryMin > SALARY_FLOOR || c.salaryMax < SALARY_CEIL || c.experienceBands.length > 0
      || c.availability.length > 0 || c.workPreference.length > 0 || c.employmentTypes.length > 0 || Boolean(c.location))
    setTrayDismissing(false)
    setDiscoveryConfirmed(false)
    setAnnouncement('Saved search applied')
    setTimeout(() => setAnnouncement(''), 2500)
  }

  // The actions bar (in the page shell) has a slot for Saved searches + Save search
  const [actionsSlot, setActionsSlot] = useState(null)
  useEffect(() => {
    Promise.resolve().then(() => setActionsSlot(document.getElementById('sa-slot')))
  }, [])

  function resetMarketplace() {
    newSearchReset()
    setViewMode('stack')
  }

  // Save the search + filters whenever they change
  useEffect(() => {
    saveFilters({ query: trayQuery, categories: activeCategories, salaryMin, salaryMax, experienceBands, availability, workPreference, employmentTypes, location: locationFilter })
  }, [trayQuery, activeCategories, salaryMin, salaryMax, experienceBands, availability, workPreference, employmentTypes, locationFilter])


  function togglePillFilter(value, setter) {
    setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])
  }

  // Keep the two handles at least one step apart so they never cross
  function handleSalaryMinChange(val) {
    setSalaryMin(Math.min(val, salaryMax - SALARY_STEP))
  }
  function handleSalaryMaxChange(val) {
    setSalaryMax(Math.max(val, salaryMin + SALARY_STEP))
  }
  // Raise whichever handle is nearest the pointer, so overlapping handles stay grabbable
  function handleSalaryPointer(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const half = 22 // half the 44px thumb: the thumb centre travels from rect.left + 22 to rect.right - 22
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left - half) / (rect.width - half * 2)))
    const pointerVal = SALARY_FLOOR + pct * (SALARY_CEIL - SALARY_FLOOR)
    setTopSalaryThumb(pointerVal < (salaryMin + salaryMax) / 2 ? 'min' : 'max')
  }

  // ── Tray search: type-ahead suggestions ──

  // Roles first (known roles + any role in the data), then skills and referring companies.
  function computeSuggestions(q) {
    const pool = allCandidatesRef.current
    const lower = q.trim().toLowerCase()
    const roleCount = role => pool.filter(c => (c.role || '').toLowerCase().includes(role.toLowerCase())).length

    const roleNames = [...new Set([...ALL_ROLES, ...pool.map(c => c.role).filter(Boolean)])]
    const roles = roleNames
      .filter(r => r.toLowerCase().includes(lower))
      .sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(lower), bStarts = b.toLowerCase().startsWith(lower)
        if (aStarts !== bStarts) return aStarts ? -1 : 1
        return a.localeCompare(b)
      })
      .map(r => ({ text: r, type: 'role', icon: 'work', count: roleCount(r) }))

    // Browsing all roles (empty query): roles only
    if (!lower) return roles

    const seen = new Set()
    const others = []
    for (const c of pool) {
      for (const sk of (c.skills || [])) {
        if (sk.toLowerCase().includes(lower) && !seen.has('skill:' + sk)) {
          seen.add('skill:' + sk)
          others.push({ text: sk, type: 'skill', icon: 'build' })
        }
      }
    }
    for (const c of pool) {
      const co = c.referringCompany || c.company
      if (co && co.toLowerCase().includes(lower) && !seen.has('company:' + co)) {
        seen.add('company:' + co)
        others.push({ text: co, type: 'company', icon: 'business' })
      }
    }
    return [...roles.slice(0, 6), ...others.slice(0, 3)]
  }

  function openSuggestions(q) {
    const next = computeSuggestions(q)
    setSuggestions(next)
    setShowSuggestions(next.length > 0)
    setHighlightIdx(-1)
  }

  function closeSuggestions() {
    setShowSuggestions(false)
    setHighlightIdx(-1)
  }

  function handleTrayQueryChange(value) {
    setTrayQuery(value)
    if (value.trim()) openSuggestions(value)
    else { setSuggestions([]); closeSuggestions() }
  }

  function applySuggestion(text) {
    setTrayQuery(text)
    setAppliedQuery(text) // apply immediately, skip the typing debounce
    closeSuggestions()
  }

  function showAllRoles() {
    openSuggestions('')
    trayInputRef.current?.focus()
  }

  function handleTrayKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!showSuggestions) { openSuggestions(trayQuery); return }
      const n = suggestions.length
      if (!n) return
      setHighlightIdx(i => e.key === 'ArrowDown' ? (i + 1) % n : (i <= 0 ? n - 1 : i - 1))
    } else if (e.key === 'Enter') {
      if (showSuggestions && highlightIdx >= 0 && suggestions[highlightIdx]) {
        e.preventDefault()
        applySuggestion(suggestions[highlightIdx].text)
      } else {
        closeSuggestions()
      }
    } else if (e.key === 'Escape') {
      if (showSuggestions) { e.preventDefault(); closeSuggestions() }
    }
  }

  function clearSearch() {
    setTrayQuery('')
    setAppliedQuery('')
    setSuggestions([])
    closeSuggestions()
    trayInputRef.current?.focus()
  }

  // Debounce typed text into the query used for filtering (2+ chars)
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const q = trayQuery.trim()
      setAppliedQuery(q.length >= 2 ? q : '')
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [trayQuery])

  // Keep the keyboard-highlighted suggestion scrolled into view
  useEffect(() => {
    if (highlightIdx >= 0) document.getElementById(`mk-suggestion-${highlightIdx}`)?.scrollIntoView({ block: 'nearest' })
  }, [highlightIdx])

  // Close suggestions on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (traySearchRef.current && !traySearchRef.current.contains(e.target)) {
        closeSuggestions()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentCriteria = { query: trayQuery, categories: activeCategories, salaryMin, salaryMax, experienceBands, availability, workPreference, employmentTypes, location: locationFilter }
  const salaryActive = salaryMin > SALARY_FLOOR || salaryMax < SALARY_CEIL
  const moreFiltersCount = (salaryActive ? 1 : 0) + experienceBands.length + availability.length + workPreference.length + employmentTypes.length + (locationFilter?.country ? 1 : 0)
  const hasActiveFilters = activeCategories.length > 0 || trayQuery.trim().length >= 2 || moreFiltersCount > 0

  // Chips summarising every active filter, each with its own remove action
  const removeFrom = (setter, value) => () => setter(prev => prev.filter(v => v !== value))
  const activeFilterChips = [
    ...(trayQuery.trim() ? [{ id: 'q', label: `“${trayQuery.trim()}”`, remove: clearSearch }] : []),
    ...activeCategories.map(c => ({ id: 'cat:' + c, label: c, remove: removeFrom(setActiveCategories, c) })),
    ...(salaryActive ? [{ id: 'salary', label: `${formatSalaryK(salaryMin)} – ${formatSalaryK(salaryMax)}`, remove: () => { setSalaryMin(SALARY_FLOOR); setSalaryMax(SALARY_CEIL) } }] : []),
    ...experienceBands.map(v => ({ id: 'exp:' + v, label: v, remove: removeFrom(setExperienceBands, v) })),
    ...availability.map(v => ({ id: 'avail:' + v, label: v, remove: removeFrom(setAvailability, v) })),
    ...workPreference.map(v => ({ id: 'work:' + v, label: v, remove: removeFrom(setWorkPreference, v) })),
    ...employmentTypes.map(v => ({ id: 'emp:' + v, label: v, remove: removeFrom(setEmploymentTypes, v) })),
    ...(locationFilter?.country ? [{ id: 'loc', label: formatLocation(locationFilter), remove: () => setLocationFilter(null) }] : []),
  ]

  // Live match count for the main button, from the same filter logic as the results
  const noMatches = dataLoaded && total === 0
  const confirmLabel = !dataLoaded
    ? 'Loading candidates…'
    : noMatches
      ? 'No matches – try removing a filter'
      : `Show ${total} ${total === 1 ? 'candidate' : 'candidates'}`
  const showCandidates = discoveryConfirmed || hasActiveFilters

  const candidateCountText = COPY.marketplace.candidateCount(total)

  const headerRef = useScrollReveal()

  return (
    <div className="mk-page" style={{ position: 'relative', minHeight: 'calc(100vh - 4rem)' }}>
      {/* Saved searches + Save search, shown next to "New search" in the actions bar */}
      {actionsSlot && createPortal(
        <SaveSearchControls criteria={currentCriteria} hasCriteria={!isDefaultCriteria(currentCriteria)} onRun={runSavedSearch} openMenu={openSearchesMenu} />,
        actionsSlot,
      )}
      <p className="mk-sr-only" role="status" aria-live="polite">{announcement}</p>
      {roleNotice && <p className="mk-role-notice" role="status">{roleNotice}</p>}
      {/* ── Page header ── */}
      <header className="mk-header reveal-fade-up" ref={headerRef} data-parallax-speed="0.08">
        <div className="mk-header-left">
          <h2 className="mk-heading text-reveal">
            <span className="text-reveal-word" style={{ animationDelay: '100ms' }}>{COPY.marketplace.headingStart}</span>
            <span className="text-reveal-word mk-heading-italic" style={{ animationDelay: '220ms' }}>{COPY.marketplace.headingItalic}</span>
            <span className="text-reveal-word" style={{ animationDelay: '340ms' }}>{COPY.marketplace.headingEnd}</span>
          </h2>
          <p className="mk-subtitle text-reveal-word" style={{ animationDelay: '460ms' }}>{COPY.marketplace.subtitle}</p>
        </div>
      </header>

      {/* ── Candidate count ── */}
      <p className="mk-candidate-count">{candidateCountText}</p>

      {/* ── View switcher ── */}
      <ViewSwitcher />

      {/* ── Bento grid ── */}
      <div className="mk-bento">
        {/* Left: search panel + candidate list */}
        <div className="mk-left">
          {/* ── Discovery search panel (sits below view switcher until confirmed) ── */}
          {!discoveryConfirmed && (
            <div className={`mk-tray-wrap ${trayDismissing ? 'mk-tray-wrap--dismissing' : ''}`}>
              <div className="mk-tray">
                  <div className="mk-tray-top">
                    <div>
                      <h3 className="mk-tray-title">
                        Find the right{' '}
                        <span className="mk-tray-title-accent">candidate</span>
                      </h3>
                      <p className="mk-tray-subtitle">Search, filter by category, or pick a role</p>
                    </div>
                  </div>

                  <div className="mk-tray-search" ref={traySearchRef}>
                    <div className="mk-tray-search-input-wrap">
                      <span className="material-symbols-outlined mk-tray-search-icon" aria-hidden="true">search</span>
                      <input
                        ref={trayInputRef}
                        type="text"
                        className="mk-tray-search-input"
                        placeholder="Search roles, skills, or companies..."
                        aria-label="Search roles, skills, or companies"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={showSuggestions}
                        aria-controls={showSuggestions ? 'mk-suggestion-list' : undefined}
                        aria-activedescendant={showSuggestions && highlightIdx >= 0 ? `mk-suggestion-${highlightIdx}` : undefined}
                        autoComplete="off"
                        value={trayQuery}
                        onChange={e => handleTrayQueryChange(e.target.value)}
                        onKeyDown={handleTrayKeyDown}
                        onFocus={() => { if (trayQuery.trim()) openSuggestions(trayQuery) }}
                      />
                      {trayQuery && (
                        <button type="button" className="mk-tray-search-clear" onClick={clearSearch} aria-label="Clear search">
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }} aria-hidden="true">close</span>
                        </button>
                      )}
                    </div>
                    <p className="mk-sr-only" role="status">
                      {showSuggestions && suggestions.length > 0
                        ? `${suggestions.length} suggestions available. Use up and down arrows to choose, Enter to select.`
                        : ''}
                    </p>
                    {showSuggestions && suggestions.length > 0 && (
                      <ul className="mk-tray-suggestions" id="mk-suggestion-list" role="listbox" aria-label="Suggestions">
                        {suggestions.map((s, i) => (
                          <li
                            key={s.type + s.text}
                            id={`mk-suggestion-${i}`}
                            role="option"
                            aria-selected={i === highlightIdx}
                            className={`mk-tray-suggestion ${i === highlightIdx ? 'mk-tray-suggestion--active' : ''}`}
                            onMouseDown={e => { e.preventDefault(); applySuggestion(s.text) }}
                            onMouseEnter={() => setHighlightIdx(i)}
                          >
                            <span className="material-symbols-outlined mk-tray-suggestion-icon" aria-hidden="true">{s.icon}</span>
                            <span className="mk-tray-suggestion-text">{s.type === 'company' ? `Referred by ${s.text}` : s.text}</span>
                            <span className="mk-tray-suggestion-type">{s.type === 'role' ? `${s.count} ${s.count === 1 ? 'candidate' : 'candidates'}` : s.type}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <fieldset className="mk-tray-fieldset">
                    <legend className="mk-sr-only">Categories</legend>
                    <div className="mk-tray-chips">
                      {CATEGORY_CHIPS.map(({ key, icon }) => {
                        const active = activeCategories.includes(key)
                        const count = categoryCounts[key] || 0
                        const empty = dataLoaded && count === 0 && !active
                        return (
                          <button
                            key={key}
                            type="button"
                            className={`mk-tray-chip ${active ? 'mk-tray-chip--active' : ''} ${empty ? 'mk-tray-chip--empty' : ''}`}
                            disabled={empty}
                            aria-pressed={active}
                            title={empty ? `No ${key} candidates yet` : undefined}
                            onClick={() => setActiveCategories(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key])}
                          >
                            <span className="material-symbols-outlined mk-tray-chip-icon" aria-hidden="true">{icon}</span>
                            {key}
                            <span className="mk-tray-chip-count" aria-hidden="true">{count}</span>
                            <span className="mk-sr-only">, {count} {count === 1 ? 'candidate' : 'candidates'}</span>
                          </button>
                        )
                      })}
                    </div>
                  </fieldset>

                  <button
                    type="button"
                    className={`mk-tray-more-btn ${moreFiltersCount > 0 ? 'mk-tray-more-btn--has-active' : ''}`}
                    aria-expanded={showMoreFilters}
                    aria-controls="mk-more-filters"
                    onClick={() => setShowMoreFilters(v => !v)}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">tune</span>
                    More filters{moreFiltersCount > 0 ? ` (${moreFiltersCount})` : ''}
                    <span className="material-symbols-outlined mk-tray-more-chevron" aria-hidden="true">{showMoreFilters ? 'expand_less' : 'expand_more'}</span>
                  </button>

                  {showMoreFilters && (
                    <div className="mk-tray-more" id="mk-more-filters">
                      <div className="mk-tray-quant-row">
                        <div className="mk-tray-salary" role="group" aria-labelledby="mk-salary-label">
                          <div className="mk-tray-salary-header">
                            <span className="mk-tray-salary-label" id="mk-salary-label">Salary expectation</span>
                            <span className="mk-tray-salary-value">
                              {formatSalaryK(salaryMin)} – {formatSalaryK(salaryMax)} AUD
                            </span>
                          </div>
                          <div
                            className="mk-tray-range"
                            onPointerMove={handleSalaryPointer}
                            onPointerDown={handleSalaryPointer}
                            style={{
                              '--lo': `${((salaryMin - SALARY_FLOOR) / (SALARY_CEIL - SALARY_FLOOR)) * 100}%`,
                              '--hi': `${((salaryMax - SALARY_FLOOR) / (SALARY_CEIL - SALARY_FLOOR)) * 100}%`,
                            }}
                          >
                            <div className="mk-tray-range-track" aria-hidden="true" />
                            <input
                              type="range"
                              className="mk-tray-range-input"
                              min={SALARY_FLOOR}
                              max={SALARY_CEIL}
                              step={SALARY_STEP}
                              value={salaryMin}
                              style={{ zIndex: topSalaryThumb === 'min' ? 2 : 1 }}
                              onFocus={() => setTopSalaryThumb('min')}
                              aria-label="Minimum salary"
                              aria-valuetext={salarySpoken(salaryMin)}
                              onChange={e => handleSalaryMinChange(parseInt(e.target.value))}
                            />
                            <input
                              type="range"
                              className="mk-tray-range-input"
                              min={SALARY_FLOOR}
                              max={SALARY_CEIL}
                              step={SALARY_STEP}
                              value={salaryMax}
                              style={{ zIndex: topSalaryThumb === 'max' ? 2 : 1 }}
                              onFocus={() => setTopSalaryThumb('max')}
                              aria-label="Maximum salary"
                              aria-valuetext={salarySpoken(salaryMax)}
                              onChange={e => handleSalaryMaxChange(parseInt(e.target.value))}
                            />
                          </div>
                          <div className="mk-tray-salary-range">
                            <span>{formatSalaryK(SALARY_FLOOR)}</span>
                            <span>{formatSalaryK(SALARY_CEIL)}</span>
                          </div>
                        </div>

                        <div className="mk-tray-quant-sep" />

                        <fieldset className="mk-tray-experience mk-tray-fieldset">
                          <legend className="mk-tray-salary-label">Years of experience</legend>
                          <div className="mk-tray-pills">
                            {EXPERIENCE_BANDS.map(band => (
                              <button
                                key={band}
                                type="button"
                                className={`mk-tray-pill ${experienceBands.includes(band) ? 'mk-tray-pill--active' : ''}`}
                                aria-pressed={experienceBands.includes(band)}
                                onClick={() => togglePillFilter(band, setExperienceBands)}
                              >
                                {band}
                              </button>
                            ))}
                          </div>
                        </fieldset>
                      </div>

                      <div className="mk-tray-divider" />

                      <div className="mk-tray-pill-row">
                        {[
                          { label: 'Availability', options: AVAILABILITY_OPTIONS, value: availability, setter: setAvailability },
                          { label: 'Work preference', options: WORK_PREFERENCES, value: workPreference, setter: setWorkPreference },
                          { label: 'Employment type', options: EMPLOYMENT_TYPES, value: employmentTypes, setter: setEmploymentTypes },
                        ].map(({ label, options, value, setter }, gi) => (
                          <div key={label} style={{ display: 'contents' }}>
                            {gi > 0 && <div className="mk-tray-quant-sep" />}
                            <fieldset className="mk-tray-pill-group mk-tray-fieldset">
                              <legend className="mk-tray-salary-label">{label}</legend>
                              <div className="mk-tray-pills">
                                {options.map(v => (
                                  <button
                                    key={v}
                                    type="button"
                                    className={`mk-tray-pill ${value.includes(v) ? 'mk-tray-pill--active' : ''}`}
                                    aria-pressed={value.includes(v)}
                                    onClick={() => togglePillFilter(v, setter)}
                                  >
                                    {v}
                                  </button>
                                ))}
                              </div>
                            </fieldset>
                          </div>
                        ))}
                      </div>

                      <div className="mk-tray-divider" />

                      <fieldset className="mk-tray-fieldset">
                        <legend className="mk-tray-salary-label">Location</legend>
                        <LocationSelect
                          value={locationFilter || EMPTY_LOCATION}
                          onChange={next => setLocationFilter(next.country ? next : null)}
                        />
                      </fieldset>
                    </div>
                  )}

                  {activeFilterChips.length > 0 && (
                    <div className="mk-tray-active">
                      <span className="mk-tray-active-label" id="mk-active-label">Active filters</span>
                      <ul className="mk-tray-active-list" aria-labelledby="mk-active-label">
                        {activeFilterChips.map(chip => (
                          <li key={chip.id}>
                            <button type="button" className="mk-tray-active-chip" onClick={chip.remove} aria-label={`Remove filter: ${chip.label}`}>
                              {chip.label}
                              <span className="material-symbols-outlined" aria-hidden="true">close</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button type="button" className="mk-tray-clear-all" onClick={newSearchReset}>
                        Clear all
                      </button>
                    </div>
                  )}

                  {/* Announces the live match count to screen readers */}
                  <p className="mk-sr-only" aria-live="polite" aria-atomic="true">
                    {dataLoaded ? (noMatches ? 'No matching candidates. Try removing a filter.' : `${total} matching ${total === 1 ? 'candidate' : 'candidates'}`) : ''}
                  </p>

                  <div className="mk-tray-bottom">
                    <button type="button" className="mk-tray-toggle press-scale" onClick={showAllRoles}>
                      See all roles &rarr;
                    </button>
                    <button
                      type="button"
                      className="mk-tray-confirm press-scale"
                      onClick={confirmDiscovery}
                      disabled={!dataLoaded || noMatches}
                    >
                      {confirmLabel}{!noMatches && dataLoaded && <> &rarr;</>}
                    </button>
                  </div>
              </div>
            </div>
          )}
          <div>
          {showCandidates && (
            <>
              {loading && <p className="mk-loading" role="status">Loading candidates…</p>}

              {!loading && error && <ErrorBanner message={error} onRetry={() => { allCandidatesRef.current = []; loadCandidates() }} />}

              {!loading && !error && candidates.length === 0 && (
                <EmptyState icon="search_off" message={COPY.emptyStates.marketplace} ctaLabel={COPY.emptyStates.marketplaceCta} onCta={newSearchReset} />
              )}

              {!loading && !error && candidates.length > 0 && (
                <CandidateResults candidates={candidates} />
              )}
            </>
          )}
          </div>
        </div>

        {/* Right: insights panel */}
        <div className="mk-right">
          <RightInsightsPanel />
        </div>
      </div>

      {/* Reset to discovery button (only after confirmed) */}
      {discoveryConfirmed && (
        <button type="button" className="mk-discovery-fab press-scale" onClick={resetMarketplace} title="Back to discovery">
          <span className="material-symbols-outlined">tune</span>
        </button>
      )}
    </div>
  )
}
