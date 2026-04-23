import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getCandidates } from '../lib/seedData'
import { CANDIDATES as MOCK_CANDIDATES } from '../data/discoveryOptions'
import { COPY } from '../lib/copy'
import { useViewMode } from '../context/ViewModeContext'
import { useSearch } from '../context/SearchContext'
import { addToShortlist } from '../lib/shortlist'
import CandidateCard from '../components/CandidateCard'
import GhostCandidateCard from '../components/GhostCandidateCard'
import RightInsightsPanel from '../components/marketplace/RightInsightsPanel'
import EmptyState from '../components/shared/EmptyState'
import ErrorBanner from '../components/shared/ErrorBanner'
import SkeletonCard from '../components/shared/SkeletonCard'
import { useScrollReveal, useStaggerReveal } from '../hooks/useScrollReveal'
import { computeCategoryCounts, ROLE_TO_CATEGORY } from '../lib/roleCategories'
import './Marketplace.css'

const GHOST_DELAYS = [0, 0.15, 0.3, 0.1, 0.25, 0.4]

const CATEGORY_CHIPS = [
  { key: 'Engineering', icon: 'code' },
  { key: 'Sales', icon: 'trending_up' },
  { key: 'Product', icon: 'palette' },
  { key: 'Data', icon: 'bar_chart' },
  { key: 'Operations', icon: 'settings' },
  { key: 'Finance', icon: 'account_balance' },
  { key: 'Final round', icon: 'emoji_events' },
  { key: 'Remote', icon: 'public' },
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

const VIEW_MODES = [
  { key: 'stack', label: COPY.viewModes.stack, icon: 'view_agenda' },
  { key: 'carousel', label: COPY.viewModes.carousel, icon: 'view_carousel' },
  { key: 'matrix', label: COPY.viewModes.matrix, icon: 'grid_view' },
  { key: 'tinder', label: COPY.viewModes.fickt, icon: 'swipe' },
  { key: 'compact', label: COPY.viewModes.compact, icon: 'density_small' },
  { key: 'focus', label: COPY.viewModes.focus, icon: 'center_focus_strong' },
]

const MOBILE_MODES = ['stack', 'tinder', 'compact']

function mapDbCandidate(c) {
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
    fee: c.fee_percentage ?? c.fee ?? 8,
    salaryLow: c.salary_expectation_min ?? c.salaryLow ?? 0,
    salaryHigh: c.salary_expectation_max ?? c.salaryHigh ?? 0,
    years: c.years_experience ?? c.years ?? 0,
    daysAgo: c.referred_at ? Math.floor((Date.now() - new Date(c.referred_at).getTime()) / 86400000) : (c.daysAgo ?? 5),
    strengths: c.strengths,
    gaps: c.gaps,
    feedback_summary: c.feedback_summary,
    recommendation: c.recommendation,
    industry: c.industry,
    status: c.status || 'available',
    preferred_work_type: c.preferred_work_type || 'Hybrid',
    workHistory: c.workHistory || c.work_history || [],
  }
}

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
export default function Marketplace() {
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
  const [activeRole, setActiveRole] = useState(null)
  const [totalCount, setTotalCount] = useState(0)
  const [categoryCounts, setCategoryCounts] = useState({})
  const [ghostBlur, setGhostBlur] = useState(4)
  const [ghostOpacity, setGhostOpacity] = useState(0.6)
  const [discoveryConfirmed, setDiscoveryConfirmed] = useState(() => {
    try { return sessionStorage.getItem('pickt_discovery_confirmed') === 'true' } catch { return false }
  })
  const [trayDismissing, setTrayDismissing] = useState(false)
  const [showAllRoles, setShowAllRoles] = useState(false)

  // ── Pill filters ──
  const [availability, setAvailability] = useState([])
  const [workPreference, setWorkPreference] = useState([])
  const [locations, setLocations] = useState([])

  // ── Salary & experience filters ──
  const [salaryMax, setSalaryMax] = useState(300)
  const [minExperience, setMinExperience] = useState(0)
  const salaryDebounceRef = useRef(null)

  // ── Tray search state ──
  const [trayQuery, setTrayQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const traySearchRef = useRef(null)
  const debounceRef = useRef(null)

  // ── Central data loader ──
  // Single source of truth for loading + filtering candidates.
  // Returns { candidates, total } and updates component state.

  const allCandidatesRef = useRef([])

  const WORK_TYPE_MAP = { 'Remote': 'remote', 'Hybrid': 'hybrid', 'On-site': 'on_site', 'On-Site': 'on_site' }

  function fetchCandidates({
    categories = [],
    role = null,
    query = '',
    salaryMax = null,
    minExperience = null,
    workPreferences = [],
    locations = [],
    interviewDepth = null,
    availability = [],
  } = {}) {
    // Load raw candidates (seed data or mock fallback)
    if (allCandidatesRef.current.length === 0) {
      try {
        const stored = getCandidates()
        allCandidatesRef.current = (stored && stored.length > 0)
          ? stored.map(mapDbCandidate)
          : MOCK_CANDIDATES.map(mapDbCandidate)
      } catch (err) {
        return { candidates: [], total: 0, error: err.message }
      }
    }

    let result = allCandidatesRef.current

    // Filter by category (role → category mapping)
    if (categories.length > 0) {
      result = result.filter(c => {
        const cat = ROLE_TO_CATEGORY[c.role]
        if (cat && categories.includes(cat)) return true
        if (categories.includes('Final round') && (c.interview_stage_reached || '').toLowerCase().includes('final')) return true
        if (categories.includes('Remote') && (c.preferred_work_type || '').toLowerCase() === 'remote') return true
        return false
      })
    }

    // Filter by specific role
    if (role) {
      result = result.filter(c => c.role === role)
    }

    // Filter by work preference (Remote, Hybrid, On-site)
    if (workPreferences.length > 0) {
      const mapped = workPreferences.map(w => (WORK_TYPE_MAP[w] || w).toLowerCase())
      result = result.filter(c => mapped.includes((c.preferred_work_type || '').toLowerCase()))
    }

    // Filter by location (city match, or remote if "Remote AU" is selected)
    if (locations.length > 0) {
      const nonRemote = locations.filter(l => l !== 'Remote AU' && l !== 'Remote')
      const includesRemote = locations.some(l => l === 'Remote AU' || l === 'Remote')
      result = result.filter(c => {
        if (includesRemote && (c.preferred_work_type || '').toLowerCase() === 'remote') return true
        if (nonRemote.length > 0 && nonRemote.some(l => (c.city || '').toLowerCase() === l.toLowerCase())) return true
        return nonRemote.length === 0 && includesRemote
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
        role: activeRole,
        query: searchQuery,
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
        setActiveRole(null)
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

  // Load candidates on mount + whenever filters change
  useEffect(() => {
    loadCandidates()
  }, [activeCategories, activeRole, searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ghost blur/opacity reacts to filter state
  useEffect(() => {
    if (activeCategories.length > 0) {
      setGhostBlur(0); setGhostOpacity(1)
    } else if (activeRole !== null) {
      setGhostBlur(1); setGhostOpacity(0.85)
    } else {
      setGhostBlur(4); setGhostOpacity(0.6)
    }
  }, [activeCategories, activeRole])

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
    setActiveRole(null)
    setTrayQuery('')
    setSalaryMax(300)
    setMinExperience(0)
    setAvailability([])
    setWorkPreference([])
    setLocations([])
    setViewMode('stack')
  }

  function handleExperienceChange(direction) {
    const next = Math.max(0, Math.min(20, minExperience + direction))
    setMinExperience(next)
    const result = fetchCandidates({
      categories: activeCategories,
      role: activeRole,
      query: trayQuery || searchQuery,
      salaryMax: salaryMax < 300 ? salaryMax * 1000 : null,
      minExperience: next > 0 ? next : null,
    })
    setCandidates(result.candidates)
    setTotal(result.total)
    confirmDiscovery()
  }

  function togglePillFilter(arr, value, setter, filterKey) {
    const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
    setter(next)
    const result = fetchCandidates({
      categories: activeCategories,
      role: activeRole,
      query: trayQuery || searchQuery,
      salaryMax: salaryMax < 300 ? salaryMax * 1000 : null,
      minExperience: minExperience > 0 ? minExperience : null,
      workPreferences: filterKey === 'workPreferences' ? next : workPreference,
      locations: filterKey === 'locations' ? next : locations,
      availability: filterKey === 'availability' ? next : availability,
    })
    setCandidates(result.candidates)
    setTotal(result.total)
    confirmDiscovery()
  }

  function handleSalaryChange(val) {
    setSalaryMax(val)
    clearTimeout(salaryDebounceRef.current)
    salaryDebounceRef.current = setTimeout(() => {
      const result = fetchCandidates({
        categories: activeCategories,
        role: activeRole,
        query: trayQuery || searchQuery,
        salaryMax: val < 300 ? val * 1000 : null,
        minExperience: minExperience > 0 ? minExperience : null,
      })
      setCandidates(result.candidates)
      setTotal(result.total)
      confirmDiscovery()
    }, 500)
  }

  // ── Tray search: suggestions ──

  function computeSuggestions(q) {
    if (!q || q.length < 2 || allCandidatesRef.current.length === 0) return []
    const lower = q.toLowerCase()
    const seen = new Set()
    const results = []

    // Roles
    for (const c of allCandidatesRef.current) {
      if (c.role && c.role.toLowerCase().includes(lower) && !seen.has('role:' + c.role)) {
        seen.add('role:' + c.role)
        results.push({ text: c.role, type: 'role', icon: 'work' })
      }
    }
    // Skills
    for (const c of allCandidatesRef.current) {
      for (const s of (c.skills || [])) {
        if (s.toLowerCase().includes(lower) && !seen.has('skill:' + s)) {
          seen.add('skill:' + s)
          results.push({ text: s, type: 'skill', icon: 'build' })
        }
      }
    }
    // Companies (referred by)
    for (const c of allCandidatesRef.current) {
      const co = c.referringCompany || c.company
      if (co && co.toLowerCase().includes(lower) && !seen.has('company:' + co)) {
        seen.add('company:' + co)
        results.push({ text: co, type: 'company', icon: 'business' })
      }
    }

    return results.slice(0, 6)
  }

  function applySuggestion(text, type) {
    setTrayQuery(text)
    setShowSuggestions(false)

    // Auto-select matching role chip if applicable
    if (type === 'role') {
      const allRoles = [...DEFAULT_ROLES, ...EXPANDED_ROLES]
      if (allRoles.includes(text)) {
        setActiveRole(text)
        setActiveCategories([])
      }
    }

    // Load candidates with this query + current filters
    setLoading(true)
    const result = fetchCandidates({
      categories: activeCategories,
      role: type === 'role' ? text : activeRole,
      query: text,
    })
    setCandidates(result.candidates)
    setTotal(result.total)
    setLoading(false)

    confirmDiscovery()
  }

  function clearSearch() {
    setTrayQuery('')
    setSuggestions([])
    setActiveRole(null)

    // If other filters remain, re-fetch; otherwise reset tray
    if (activeCategories.length > 0) {
      loadCandidates()
    } else {
      try { sessionStorage.removeItem('pickt_discovery_confirmed') } catch { /* ignore */ }
      setDiscoveryConfirmed(false)
    }
  }

  // Debounced search trigger: 2+ chars → compute suggestions + fetch candidates
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (trayQuery.length >= 2) {
      debounceRef.current = setTimeout(() => {
        setSuggestions(computeSuggestions(trayQuery))
        setShowSuggestions(true)

        // Also fetch candidates immediately with the typed query
        const result = fetchCandidates({
          categories: activeCategories,
          role: activeRole,
          query: trayQuery,
        })
        setCandidates(result.candidates)
        setTotal(result.total)
        confirmDiscovery()
      }, 300)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
    return () => clearTimeout(debounceRef.current)
  }, [trayQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close suggestions on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (traySearchRef.current && !traySearchRef.current.contains(e.target)) {
        setShowSuggestions(false)
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

  const visibleModes = isMobile ? VIEW_MODES.filter(m => MOBILE_MODES.includes(m.key)) : VIEW_MODES
  const candidateCountText = COPY.marketplace.candidateCount(total)

  const headerRef = useScrollReveal()
  const cardsRef = useStaggerReveal({ staggerMs: 100 })

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
        {/* Left: candidate list OR ghost grid */}
        <div className={`mk-left ${transitioning ? 'mk-left--transitioning' : ''}`}>
          {!discoveryConfirmed ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, padding: '20px 0 160px' }}>
              {GHOST_DELAYS.map((delay, i) => (
                <GhostCandidateCard key={i} animationDelay={delay} blur={ghostBlur} opacity={ghostOpacity} />
              ))}
            </div>
          ) : (
            <>
              {loading && <SkeletonCard count={3} />}

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

        {/* Right: insights panel */}
        <div className="mk-right">
          <RightInsightsPanel />
        </div>
      </div>

      {/* ── Discovery tray (floating card, visible until confirmed) ── */}
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
                  <span className="material-symbols-outlined mk-tray-search-icon">search</span>
                  <input
                    type="text"
                    className="mk-tray-search-input"
                    placeholder="Search roles, skills, or companies..."
                    value={trayQuery}
                    onChange={e => setTrayQuery(e.target.value)}
                    onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
                  />
                  {trayQuery && (
                    <button type="button" className="mk-tray-search-clear" onClick={clearSearch}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                    </button>
                  )}
                </div>
                {showSuggestions && suggestions.length > 0 && (
                  <div className="mk-tray-suggestions">
                    {suggestions.map((s, i) => (
                      <button key={i} type="button" className="mk-tray-suggestion" onClick={() => applySuggestion(s.text, s.type)}>
                        <span className="material-symbols-outlined mk-tray-suggestion-icon">{s.icon}</span>
                        <span className="mk-tray-suggestion-text">{s.type === 'company' ? `Referred by ${s.text}` : s.text}</span>
                        <span className="mk-tray-suggestion-type">{s.type}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mk-tray-chips">
                {CATEGORY_CHIPS.map(({ key, icon }) => {
                  const active = activeCategories.includes(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`mk-tray-chip ${active ? 'mk-tray-chip--active' : ''}`}
                      onClick={() => { setActiveCategories(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]); confirmDiscovery() }}
                    >
                      <span className="material-symbols-outlined mk-tray-chip-icon">{icon}</span>
                      {key}
                      <span className="mk-tray-chip-count">{categoryCounts[key] || 0}</span>
                    </button>
                  )
                })}
              </div>

              <div className="mk-tray-divider" />

              <p className="mk-tray-role-label">Or pick a specific role</p>
              <div className="mk-tray-roles">
                {(showAllRoles ? [...DEFAULT_ROLES, ...EXPANDED_ROLES] : DEFAULT_ROLES).map(r => {
                  const active = activeRole === r
                  return (
                    <button
                      key={r}
                      type="button"
                      className={`mk-tray-role ${active ? 'mk-tray-role--active' : ''}`}
                      onClick={() => {
                        if (activeRole === r) { setActiveRole(null) }
                        else { setActiveRole(r); setActiveCategories([]) }
                        confirmDiscovery()
                      }}
                    >
                      {r}
                    </button>
                  )
                })}
              </div>

              <div className="mk-tray-divider" />

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
                <div className="mk-tray-pill-group">
                  <span className="mk-tray-salary-label">Availability</span>
                  <div className="mk-tray-pills">
                    {['Available now', '2 weeks', '1 month', 'Flexible'].map(v => (
                      <button key={v} type="button" className={`mk-tray-pill ${availability.includes(v) ? 'mk-tray-pill--active' : ''}`} onClick={() => togglePillFilter(availability, v, setAvailability, 'availability')}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mk-tray-quant-sep" />

                <div className="mk-tray-pill-group">
                  <span className="mk-tray-salary-label">Work preference</span>
                  <div className="mk-tray-pills">
                    {['Remote', 'Hybrid', 'On-site'].map(v => (
                      <button key={v} type="button" className={`mk-tray-pill ${workPreference.includes(v) ? 'mk-tray-pill--active' : ''}`} onClick={() => togglePillFilter(workPreference, v, setWorkPreference, 'workPreferences')}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mk-tray-quant-sep" />

                <div className="mk-tray-pill-group">
                  <span className="mk-tray-salary-label">Location</span>
                  <div className="mk-tray-pills">
                    {['Sydney', 'Melbourne', 'Brisbane', 'Remote AU'].map(v => (
                      <button key={v} type="button" className={`mk-tray-pill ${locations.includes(v) ? 'mk-tray-pill--active' : ''}`} onClick={() => togglePillFilter(locations, v, setLocations, 'locations')}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mk-tray-bottom">
                <button type="button" className="mk-tray-toggle press-scale" onClick={() => setShowAllRoles(v => !v)}>
                  {showAllRoles ? 'Show less \u2191' : 'See all roles \u2192'}
                </button>
              </div>
          </div>
        </div>
      )}

      {/* Reset to discovery button (only after confirmed) */}
      {discoveryConfirmed && (
        <button type="button" className="mk-discovery-fab press-scale" onClick={resetMarketplace} title="Back to discovery">
          <span className="material-symbols-outlined">tune</span>
        </button>
      )}
    </div>
  )
}
