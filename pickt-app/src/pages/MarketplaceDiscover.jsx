import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getCandidates, getCandidatesRaw } from '../lib/seedData'
import { CANDIDATES as MOCK_CANDIDATES } from '../data/discoveryOptions'
import { fetchCandidatesPublic } from '../lib/supabaseQueries'
import { COPY } from '../lib/copy'
import { useViewMode } from '../context/ViewModeContext'
import { useSearch } from '../context/SearchContext'
import { addToShortlist } from '../lib/shortlist'
import CandidateCard from '../components/CandidateCard'
import RightInsightsPanel from '../components/marketplace/RightInsightsPanel'
import EmptyState from '../components/shared/EmptyState'
import ErrorBanner from '../components/shared/ErrorBanner'
import { useScrollReveal, useStaggerReveal } from '../hooks/useScrollReveal'
import { computeCategoryCounts, ROLE_TO_CATEGORY } from '../lib/roleCategories'
import { mapCandidate } from '../lib/candidateUtils'
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
const WORK_OPTIONS = ['Remote', 'Hybrid', 'On-site']
const NAMED_CITIES = ['Sydney', 'Melbourne', 'Brisbane']
const OTHER_CITIES = 'Other cities'
const LOCATION_OPTIONS = [...NAMED_CITIES, OTHER_CITIES]

const VIEW_MODES = [
  { key: 'stack', label: COPY.viewModes.stack, icon: 'view_agenda' },
  { key: 'carousel', label: COPY.viewModes.carousel, icon: 'view_carousel' },
  { key: 'matrix', label: COPY.viewModes.matrix, icon: 'grid_view' },
  { key: 'tinder', label: COPY.viewModes.fickt, icon: 'swipe' },
  { key: 'compact', label: COPY.viewModes.compact, icon: 'density_small' },
  { key: 'focus', label: COPY.viewModes.focus, icon: 'center_focus_strong' },
]

const MOBILE_MODES = ['stack', 'tinder', 'compact']

// ── Tinder stack ──
function TinderView({ candidates, onSave, onSkip }) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)
  const cardRef = useRef(null)
  const remaining = candidates.length - currentIdx

  function handlePointerDown(e) { startX.current = e.clientX; setDragging(true); cardRef.current?.setPointerCapture(e.pointerId) }
  function handlePointerMove(e) { if (dragging) setDragX(e.clientX - startX.current) }
  function handlePointerUp() {
    if (!dragging) return
    setDragging(false)
    if (dragX > 80) doSave()
    else if (dragX < -80) doSkip()
    setDragX(0)
  }
  function doSave() { if (currentIdx < candidates.length) { onSave?.(candidates[currentIdx]); setCurrentIdx(i => i + 1) } }
  function doSkip() { if (currentIdx < candidates.length) { onSkip?.(candidates[currentIdx]); setCurrentIdx(i => i + 1) } }

  if (remaining <= 0) return <EmptyState message="You've reviewed all candidates" />

  return (
    <div className="mk-tinder-wrap">
      <div className="mk-tinder-counter">{remaining} candidates remaining</div>
      <div className="mk-tinder-stack">
        {[2, 1, 0].map(offset => {
          const idx = currentIdx + offset
          if (idx >= candidates.length) return null
          const isFront = offset === 0
          const style = isFront
            ? { transform: `translateX(${dragX}px) rotate(${dragX * 0.1}deg)`, zIndex: 3 }
            : { transform: `scale(${1 - offset * 0.03}) translateY(${offset * 6}px)`, zIndex: 3 - offset, pointerEvents: 'none' }
          return (
            <div key={candidates[idx].id} ref={isFront ? cardRef : undefined} className="mk-tinder-card" style={style}
              onPointerDown={isFront ? handlePointerDown : undefined} onPointerMove={isFront ? handlePointerMove : undefined} onPointerUp={isFront ? handlePointerUp : undefined}>
              {isFront && dragging && <>
                <div className="mk-tinder-hint mk-tinder-hint--save" style={{ opacity: Math.max(0, dragX / 150) }}>SAVE {'\u2713'}</div>
                <div className="mk-tinder-hint mk-tinder-hint--skip" style={{ opacity: Math.max(0, -dragX / 150) }}>SKIP {'\u2717'}</div>
              </>}
              <CandidateCard candidate={candidates[idx]} viewMode="tinder" index={idx} />
            </div>
          )
        })}
      </div>
      <div className="mk-tinder-actions">
        <button className="mk-tinder-btn mk-tinder-btn--skip" onClick={doSkip}>{'\u2717'}</button>
        <button className="mk-tinder-btn mk-tinder-btn--save" onClick={doSave}>{'\u2713'}</button>
      </div>
    </div>
  )
}

// ── Carousel ──
function CarouselView({ candidates }) {
  const [current, setCurrent] = useState(0)
  const total = candidates.length
  const prev = useCallback(() => setCurrent(i => (i - 1 + total) % total), [total])
  const next = useCallback(() => setCurrent(i => (i + 1) % total), [total])

  useEffect(() => {
    const h = e => { if (e.key === 'ArrowLeft') prev(); if (e.key === 'ArrowRight') next() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [prev, next])

  const startXRef = useRef(0)
  if (total === 0) return null
  return (
    <div className="mk-carousel" onPointerDown={e => { startXRef.current = e.clientX }} onPointerUp={e => { const d = e.clientX - startXRef.current; if (d > 60) prev(); else if (d < -60) next() }}>
      <button className="mk-carousel-arrow mk-carousel-arrow--left" onClick={prev}>{'\u2039'}</button>
      <CandidateCard candidate={candidates[current]} viewMode="carousel" index={current} />
      <button className="mk-carousel-arrow mk-carousel-arrow--right" onClick={next}>{'\u203A'}</button>
      <div className="mk-carousel-dots">{candidates.map((_, i) => <span key={i} className={`mk-carousel-dot ${i === current ? 'mk-carousel-dot--active' : ''}`} onClick={() => setCurrent(i)} />)}</div>
    </div>
  )
}

// ── Focus ──
function FocusView({ candidates }) {
  const [current, setCurrent] = useState(0)
  const total = candidates.length
  const prev = useCallback(() => setCurrent(i => (i - 1 + total) % total), [total])
  const next = useCallback(() => setCurrent(i => (i + 1) % total), [total])

  useEffect(() => {
    const h = e => { if (e.key === 'ArrowLeft') prev(); if (e.key === 'ArrowRight') next() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [prev, next])

  if (total === 0) return null
  return (
    <div className="mk-focus">
      <div className="mk-focus-counter">Candidate {current + 1} of {total}</div>
      <button className="mk-focus-arrow mk-focus-arrow--left" onClick={prev}>{'\u2039'}</button>
      <CandidateCard candidate={candidates[current]} viewMode="focus" index={current} />
      <button className="mk-focus-arrow mk-focus-arrow--right" onClick={next}>{'\u203A'}</button>
    </div>
  )
}

// ══ MAIN ══
export default function MarketplaceDiscover() {
  const navigate = useNavigate()
  const location = useLocation()
  const { viewMode, setViewMode } = useViewMode()
  const { query: searchQuery } = useSearch()

  const [candidates, setCandidates] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [transitioning, setTransitioning] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // ── Discovery / tray state ──
  const [activeCategories, setActiveCategories] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [categoryCounts, setCategoryCounts] = useState({})
  const [discoveryConfirmed, setDiscoveryConfirmed] = useState(() => {
    try { return sessionStorage.getItem('pickt_discovery_confirmed') === 'true' } catch { return false }
  })
  const [trayDismissing, setTrayDismissing] = useState(false)
  const [showMoreFilters, setShowMoreFilters] = useState(false)

  // ── Pill filters ──
  const [availability, setAvailability] = useState([])
  const [workPreference, setWorkPreference] = useState([])
  const [locations, setLocations] = useState([])

  // ── Salary & experience filters ──
  const [salaryMax, setSalaryMax] = useState(300)
  const [minExperience, setMinExperience] = useState(0)

  // ── Tray search state ──
  const [trayQuery, setTrayQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('') // debounced trayQuery used for filtering
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

  const WORK_TYPE_MAP = { 'Remote': 'remote', 'Hybrid': 'hybrid', 'On-site': 'on_site', 'On-Site': 'on_site' }

  function fetchCandidates({
    categories = [],
    query = '',
    salaryMax = null,
    minExperience = null,
    workPreferences = [],
    locations = [],
    interviewDepth = null,
    availability = [],
  } = {}) {
    let result = allCandidatesRef.current

    // Filter by category (role → category mapping)
    if (categories.length > 0) {
      result = result.filter(c => categories.includes(ROLE_TO_CATEGORY[c.role]))
    }

    // Filter by work preference (Remote, Hybrid, On-site)
    if (workPreferences.length > 0) {
      const mapped = workPreferences.map(w => (WORK_TYPE_MAP[w] || w).toLowerCase())
      result = result.filter(c => mapped.includes((c.preferred_work_type || '').toLowerCase()))
    }

    // Filter by location (named city match, or any city outside the named ones)
    if (locations.length > 0) {
      const named = NAMED_CITIES.map(l => l.toLowerCase())
      result = result.filter(c => {
        const city = (c.city || '').toLowerCase()
        return locations.some(l => l === OTHER_CITIES ? !named.includes(city) : city === l.toLowerCase())
      })
    }

    // Filter by salary (candidate's min salary must be ≤ salaryMax)
    if (salaryMax != null) {
      result = result.filter(c => (c.salaryLow || 0) <= salaryMax)
    }

    // Filter by minimum years experience
    if (minExperience != null) {
      result = result.filter(c => (c.years || 0) >= minExperience)
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

    // Filter by availability (based on notice_period_days)
    if (availability.length > 0) {
      result = result.filter(c => {
        const notice = c.notice_period_days ?? 30
        return availability.some(a => {
          if (a === 'Available now') return notice <= 0
          if (a === '2 weeks') return notice <= 14
          if (a === '1 month') return notice <= 30
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
        (c.city || '').toLowerCase().includes(q) ||
        (c.skills || []).some(s => s.toLowerCase().includes(q)) ||
        (c.seniority || '').toLowerCase().includes(q)
      )
    }

    return { candidates: result, total: result.length }
  }

  function loadCandidates() {
    setLoading(true)
    setError(null)
    try {
      const result = fetchCandidates({
        categories: activeCategories,
        query: appliedQuery || searchQuery,
        salaryMax: salaryMax < 300 ? salaryMax * 1000 : null,
        minExperience: minExperience > 0 ? minExperience : null,
        workPreferences: workPreference,
        locations,
        availability,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setCandidates(result.candidates)
        setTotal(result.total)
      }

      // Always compute category counts from the full uncandidates set
      if (allCandidatesRef.current.length > 0) {
        const { totalCount: t, categoryCounts: c } = computeCategoryCounts(allCandidatesRef.current)
        setTotalCount(t)
        setCategoryCounts(c)
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

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (isMobile && !MOBILE_MODES.includes(viewMode)) setViewMode('stack')
  }, [isMobile, viewMode, setViewMode])

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
  }, [dataLoaded, activeCategories, searchQuery, appliedQuery, salaryMax, minExperience, availability, workPreference, locations]) // eslint-disable-line react-hooks/exhaustive-deps

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

  function resetMarketplace() {
    try { sessionStorage.removeItem('pickt_discovery_confirmed') } catch { /* ignore */ }
    setDiscoveryConfirmed(false)
    setActiveCategories([])
    setTrayQuery('')
    setAppliedQuery('')
    setSalaryMax(300)
    setMinExperience(0)
    setAvailability([])
    setWorkPreference([])
    setLocations([])
    setViewMode('stack')
  }

  function handleExperienceChange(direction) {
    setMinExperience(prev => Math.max(0, Math.min(20, prev + direction)))
  }

  function togglePillFilter(value, setter) {
    setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])
  }

  function handleSalaryChange(val) {
    setSalaryMax(val)
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

  const displayCount = useMemo(() => {
    if (activeCategories.length > 0) {
      return activeCategories.reduce((sum, cat) => sum + (categoryCounts[cat] || 0), 0)
    }
    return totalCount
  }, [activeCategories, categoryCounts, totalCount])

  function switchView(mode) {
    if (mode === viewMode) return
    setTransitioning(true)
    setTimeout(() => { setViewMode(mode); setTimeout(() => setTransitioning(false), 20) }, 150)
  }

  const moreFiltersCount = (salaryMax < 300 ? 1 : 0) + (minExperience > 0 ? 1 : 0) + availability.length + workPreference.length + locations.length
  const hasActiveFilters = activeCategories.length > 0 || trayQuery.trim().length >= 2 || moreFiltersCount > 0
  const showCandidates = discoveryConfirmed || hasActiveFilters

  const visibleModes = isMobile ? VIEW_MODES.filter(m => MOBILE_MODES.includes(m.key)) : VIEW_MODES
  const candidateCountText = COPY.marketplace.candidateCount(total)

  const headerRef = useScrollReveal()
  const cardsRef = useStaggerReveal({ staggerMs: 100, deps: [candidates, viewMode, loading, showCandidates] })

  return (
    <div className="mk-page" style={{ position: 'relative', minHeight: 'calc(100vh - 4rem)' }}>
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
        <div className="mk-header-right">
          <button className="mk-filter-btn press-scale">
            <span className="material-symbols-outlined">filter_list</span>
            {COPY.marketplace.filterBtn}
          </button>
          <button className="mk-new-search-btn press-scale">
            <span className="material-symbols-outlined">add</span>
            {COPY.marketplace.newSearchBtn}
          </button>
        </div>
      </header>

      {/* ── Candidate count ── */}
      <p className="mk-candidate-count">{candidateCountText}</p>

      {/* ── View switcher ── */}
      <div className="mk-view-switcher">
        {visibleModes.map(m => (
          <button key={m.key} className={`mk-view-btn ${viewMode === m.key ? 'mk-view-btn--active' : ''}`} onClick={() => switchView(m.key)}>
            <span className="material-symbols-outlined mk-view-icon">{m.icon}</span>
            <span className="mk-view-label">{m.label}</span>
          </button>
        ))}
      </div>

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
                    <div className="mk-tray-badge">
                      {totalCount > 0 ? (
                        <>
                          <span className="mk-tray-badge-dot" />
                          {displayCount} candidates ready
                        </>
                      ) : ('Loading\u2026')}
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
                        aria-controls="mk-suggestion-list"
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

                  <div className="mk-tray-chips">
                    {CATEGORY_CHIPS.map(({ key, icon }) => {
                      const active = activeCategories.includes(key)
                      const count = categoryCounts[key] || 0
                      const empty = count === 0 && !active
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`mk-tray-chip ${active ? 'mk-tray-chip--active' : ''} ${empty ? 'mk-tray-chip--empty' : ''}`}
                          disabled={empty}
                          title={empty ? `No ${key} candidates yet` : undefined}
                          onClick={() => setActiveCategories(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key])}
                        >
                          <span className="material-symbols-outlined mk-tray-chip-icon" aria-hidden="true">{icon}</span>
                          {key}
                          <span className="mk-tray-chip-count">{count}</span>
                        </button>
                      )
                    })}
                  </div>

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
                        <div className="mk-tray-salary">
                          <div className="mk-tray-salary-header">
                            <span className="mk-tray-salary-label">Salary expectation</span>
                            <span className="mk-tray-salary-value">
                              {salaryMax >= 300 ? '$300k+ AUD' : `Up to $${salaryMax}k AUD`}
                            </span>
                          </div>
                          <input
                            type="range"
                            className="mk-tray-slider"
                            min={40}
                            max={300}
                            step={5}
                            value={salaryMax}
                            onChange={e => handleSalaryChange(parseInt(e.target.value))}
                            style={{ '--pct': `${((salaryMax - 40) / (300 - 40)) * 100}%` }}
                          />
                          <div className="mk-tray-salary-range">
                            <span>$40k</span>
                            <span>$300k+</span>
                          </div>
                        </div>

                        <div className="mk-tray-quant-sep" />

                        <div className="mk-tray-experience">
                          <div className="mk-tray-exp-header">
                            <span className="mk-tray-salary-label">Min. experience</span>
                            <span className="mk-tray-salary-value">
                              {minExperience === 0 ? 'Any experience' : `${minExperience}+ years`}
                            </span>
                          </div>
                          <div className="mk-tray-exp-controls">
                            <button
                              type="button"
                              className="mk-tray-exp-btn"
                              disabled={minExperience <= 0}
                              onClick={() => handleExperienceChange(-1)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>remove</span>
                            </button>
                            <span className="mk-tray-exp-value">
                              {minExperience === 0 ? 'Any' : `${minExperience}+`}
                            </span>
                            <button
                              type="button"
                              className="mk-tray-exp-btn"
                              disabled={minExperience >= 20}
                              onClick={() => handleExperienceChange(1)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="mk-tray-divider" />

                      <div className="mk-tray-pill-row">
                        {[
                          { label: 'Availability', options: AVAILABILITY_OPTIONS, value: availability, setter: setAvailability },
                          { label: 'Work preference', options: WORK_OPTIONS, value: workPreference, setter: setWorkPreference },
                          { label: 'Location', options: LOCATION_OPTIONS, value: locations, setter: setLocations },
                        ].map(({ label, options, value, setter }, gi) => (
                          <div key={label} style={{ display: 'contents' }}>
                            {gi > 0 && <div className="mk-tray-quant-sep" />}
                            <div className="mk-tray-pill-group">
                              <span className="mk-tray-salary-label">{label}</span>
                              <div className="mk-tray-pills">
                                {options.map(v => (
                                  <button key={v} type="button" className={`mk-tray-pill ${value.includes(v) ? 'mk-tray-pill--active' : ''}`} onClick={() => togglePillFilter(v, setter)}>
                                    {v}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mk-tray-bottom">
                    <button type="button" className="mk-tray-toggle press-scale" onClick={showAllRoles}>
                      See all roles &rarr;
                    </button>
                    <button type="button" className="mk-tray-confirm press-scale" onClick={confirmDiscovery}>
                      Show me candidates &rarr;
                    </button>
                  </div>
              </div>
            </div>
          )}
          <div className={transitioning ? 'mk-left--transitioning' : ''}>
          {showCandidates && (
            <>
              {loading && <p className="mk-loading" role="status">Loading candidates…</p>}

              {!loading && error && <ErrorBanner message={error} onRetry={() => { allCandidatesRef.current = []; loadCandidates() }} />}

              {!loading && !error && candidates.length === 0 && (
                <EmptyState icon="search_off" message={COPY.emptyStates.marketplace} ctaLabel={COPY.emptyStates.marketplaceCta} onCta={() => navigate('/marketplace')} />
              )}

              {!loading && !error && candidates.length > 0 && (
                <>
                  {viewMode === 'stack' && (
                    <div className="mk-grid-stack" ref={cardsRef}>{candidates.map((c, i) => <div key={c.id} data-reveal><CandidateCard candidate={c} viewMode="stack" index={i} /></div>)}</div>
                  )}
                  {viewMode === 'carousel' && <CarouselView candidates={candidates} />}
                  {viewMode === 'matrix' && (
                    <div className="mk-grid-matrix" ref={cardsRef}>{candidates.map((c, i) => <div key={c.id} data-reveal><CandidateCard candidate={c} viewMode="matrix" index={i} /></div>)}</div>
                  )}
                  {viewMode === 'tinder' && <TinderView candidates={candidates} onSave={c => addToShortlist(c.id)} />}
                  {viewMode === 'compact' && (
                    <div className="mk-compact-list">{candidates.map((c, i) => <CandidateCard key={c.id} candidate={c} viewMode="compact" index={i} />)}</div>
                  )}
                  {viewMode === 'focus' && <FocusView candidates={candidates} />}
                </>
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
