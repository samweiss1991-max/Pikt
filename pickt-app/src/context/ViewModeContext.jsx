import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

// A saved or linked mode that no longer exists (e.g. the removed 'compact') falls back to 'stack'
const VALID_MODES = ['stack', 'carousel', 'matrix', 'tinder', 'focus']
const STORAGE_KEY = 'pickt_view_mode'

const ViewModeContext = createContext({ viewMode: 'stack', setViewMode: () => {}, switchView: () => {}, transitioning: false })

export function ViewModeProvider({ children }) {
  const [searchParams, setSearchParams] = useSearchParams()

  const getInitial = () => {
    const fromUrl = searchParams.get('view')
    if (fromUrl && VALID_MODES.includes(fromUrl)) return fromUrl
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored && VALID_MODES.includes(stored)) return stored
    } catch { /* localStorage unavailable */ }
    return 'stack'
  }

  const [viewMode, setViewModeState] = useState(getInitial)

  const setViewMode = useCallback((mode) => {
    if (!VALID_MODES.includes(mode)) return
    setViewModeState(mode)
    try { localStorage.setItem(STORAGE_KEY, mode) } catch { /* localStorage unavailable */ }
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('view', mode)
      return next
      // Keep the page's own state, e.g. the AI match results
    }, { replace: true, state: window.history.state?.usr })
  }, [setSearchParams])

  // Changing view with a brief fade, used by the view switcher on every results page
  const [transitioning, setTransitioning] = useState(false)
  const switchView = useCallback((mode) => {
    if (mode === viewMode) return
    setTransitioning(true)
    setTimeout(() => { setViewMode(mode); setTimeout(() => setTransitioning(false), 20) }, 150)
  }, [viewMode, setViewMode])

  // Sync URL on mount
  useEffect(() => {
    const fromUrl = searchParams.get('view')
    if (fromUrl !== viewMode) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        next.set('view', viewMode)
        return next
      }, { replace: true, state: window.history.state?.usr })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode, switchView, transitioning }}>
      {children}
    </ViewModeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useViewMode() {
  return useContext(ViewModeContext)
}
