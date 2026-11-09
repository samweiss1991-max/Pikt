import { useCallback, useEffect, useRef, useState } from 'react'
import CandidateCard from '../CandidateCard'
import EmptyState from '../shared/EmptyState'
import { useViewMode } from '../../context/ViewModeContext'
import { useStaggerReveal } from '../../hooks/useScrollReveal'
import { saveCandidate } from '../../lib/shortlist'
import { COPY } from '../../lib/copy'
import './CandidateResults.css'

// The one way candidates are shown as results: the view switcher and its five layouts,
// around the shared CandidateCard. Used by the Marketplace, the AI match results and
// the Dashboard, so a change here or to the card applies to all of them. The chosen
// view is remembered across pages (see ViewModeContext). It starts on Stack.

const VIEW_MODES = [
  { key: 'stack', label: COPY.viewModes.stack, icon: 'view_agenda' },
  { key: 'carousel', label: COPY.viewModes.carousel, icon: 'view_carousel' },
  { key: 'matrix', label: COPY.viewModes.matrix, icon: 'grid_view' },
  { key: 'tinder', label: COPY.viewModes.flickt, icon: 'swipe' },
  { key: 'focus', label: COPY.viewModes.focus, icon: 'center_focus_strong' },
]

const MOBILE_MODES = ['stack', 'tinder']

// ── Tinder stack ──
function TinderView({ candidates, renderAbove, onSave, onSkip }) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)
  const cardRef = useRef(null)
  const remaining = candidates.length - currentIdx

  function handlePointerDown(e) {
    // Let buttons / tabs inside the card receive their own clicks (no drag)
    if (e.target.closest('button, a, [role="tab"]')) return
    startX.current = e.clientX; setDragging(true)
  }
  function handlePointerMove(e) {
    if (!dragging) return
    const dx = e.clientX - startX.current
    // Only take over the pointer once it's really a drag, so a plain tap still
    // reaches the card (Flickt: tap to show / hide details)
    if (Math.abs(dx) > 6 && !cardRef.current?.hasPointerCapture(e.pointerId)) {
      cardRef.current?.setPointerCapture(e.pointerId)
    }
    setDragX(dx)
  }
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
            // Cards behind the front one are visual only: not clickable or reachable by keyboard
            <div key={candidates[idx].id} ref={isFront ? cardRef : undefined} className="mk-tinder-card" style={style} inert={!isFront}
              onPointerDown={isFront ? handlePointerDown : undefined} onPointerMove={isFront ? handlePointerMove : undefined} onPointerUp={isFront ? handlePointerUp : undefined}>
              {isFront && dragging && <>
                <div className="mk-tinder-hint mk-tinder-hint--save" style={{ opacity: Math.max(0, dragX / 150) }}>SAVE {'\u2713'}</div>
                <div className="mk-tinder-hint mk-tinder-hint--skip" style={{ opacity: Math.max(0, -dragX / 150) }}>SKIP {'\u2717'}</div>
              </>}
              {renderAbove && <div className="cr-above">{renderAbove(candidates[idx], idx)}</div>}
              <CandidateCard candidate={candidates[idx]} viewMode="tinder" index={idx} />
            </div>
          )
        })}
      </div>
      <div className="mk-tinder-actions">
        <button className="mk-tinder-btn mk-tinder-btn--skip" onClick={doSkip} aria-label="Skip candidate">{'\u2717'}</button>
        <button className="mk-tinder-btn mk-tinder-btn--save" onClick={doSave} aria-label="Save candidate">{'\u2713'}</button>
      </div>
    </div>
  )
}

// ── Carousel ──
function CarouselView({ candidates, renderAbove }) {
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
      <button className="mk-carousel-arrow mk-carousel-arrow--left" onClick={prev} aria-label="Previous candidate">{'\u2039'}</button>
      {renderAbove && <div className="cr-above">{renderAbove(candidates[current], current)}</div>}
      <CandidateCard candidate={candidates[current]} viewMode="carousel" index={current} />
      <button className="mk-carousel-arrow mk-carousel-arrow--right" onClick={next} aria-label="Next candidate">{'\u203A'}</button>
      <div className="mk-carousel-dots">{candidates.map((_, i) => <span key={i} className={`mk-carousel-dot ${i === current ? 'mk-carousel-dot--active' : ''}`} onClick={() => setCurrent(i)} />)}</div>
    </div>
  )
}

// ── Focus ──
function FocusView({ candidates, renderAbove }) {
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
      <button className="mk-focus-arrow mk-focus-arrow--left" onClick={prev} aria-label="Previous candidate">{'\u2039'}</button>
      {renderAbove && <div className="cr-above">{renderAbove(candidates[current], current)}</div>}
      <CandidateCard candidate={candidates[current]} viewMode="focus" index={current} />
      <button className="mk-focus-arrow mk-focus-arrow--right" onClick={next} aria-label="Next candidate">{'\u203A'}</button>
    </div>
  )
}

// ══ MAIN ══

/** Stack / Carousel / Matrix / Flickt / Focus. Phones get Stack and Flickt only. */
export function ViewSwitcher() {
  const { viewMode, setViewMode, switchView } = useViewMode()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (isMobile && !MOBILE_MODES.includes(viewMode)) setViewMode('stack')
  }, [isMobile, viewMode, setViewMode])

  const modes = isMobile ? VIEW_MODES.filter(m => MOBILE_MODES.includes(m.key)) : VIEW_MODES
  return (
    <div className="mk-view-switcher">
      {modes.map(m => (
        <button key={m.key} className={`mk-view-btn ${viewMode === m.key ? 'mk-view-btn--active' : ''}`} aria-pressed={viewMode === m.key} onClick={() => switchView(m.key)}>
          <span className="material-symbols-outlined mk-view-icon" aria-hidden="true">{m.icon}</span>
          <span className="mk-view-label">{m.label}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * The candidates, in the chosen view.
 * renderAbove(candidate, index) adds something directly above each card, such as match details.
 */
export default function CandidateResults({ candidates, renderAbove }) {
  const { viewMode, transitioning } = useViewMode()
  const cardsRef = useStaggerReveal({ staggerMs: 100, deps: [candidates, viewMode] })

  const gridItem = mode => (c, i) => (
    <div key={c.id} data-reveal>
      {renderAbove && <div className="cr-above">{renderAbove(c, i)}</div>}
      <CandidateCard candidate={c} viewMode={mode} index={i} />
    </div>
  )

  return (
    <div className={transitioning ? 'mk-left--transitioning' : ''}>
      {viewMode === 'stack' && <div className="mk-grid-stack" ref={cardsRef}>{candidates.map(gridItem('stack'))}</div>}
      {viewMode === 'carousel' && <CarouselView candidates={candidates} renderAbove={renderAbove} />}
      {viewMode === 'matrix' && <div className="mk-grid-matrix" ref={cardsRef}>{candidates.map(gridItem('matrix'))}</div>}
      {viewMode === 'tinder' && (
        <TinderView
          candidates={candidates}
          renderAbove={renderAbove}
          onSave={c => saveCandidate(c.id).catch(() => { /* card stays unsaved; user can retry from its Save button */ })}
        />
      )}
      {viewMode === 'focus' && <FocusView candidates={candidates} renderAbove={renderAbove} />}
    </div>
  )
}
