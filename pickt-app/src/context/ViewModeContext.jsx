import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

const VALID_MODES = ['stack', 'carousel', 'matrix', 'tinder', 'compact', 'focus']
const STORAGE_KEY = 'pickt_view_mode'

const ViewModeContext = createContext({ viewMode: 'stack', setViewMode: () => {} })

export function ViewModeProvider({ children }) {
  const [searchParams, setSearchParams] = useSearchParams()

  const getInitial = () => {
    const fromUrl = searchParams.get('view')
    if (fromUrl && VALID_MODES.includes(fromUrl)) return fromUrl
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored && VALID_MODES.includes(stored)) return stored
    } catch {}
    return 'stack'
  }

  const [viewMode, setViewModeState] = useState(getInitial)

  const setViewMode = useCallback((mode) => {
    if (!VALID_MODES.includes(mode)) return
    setViewModeState(mode)
    try { localStorage.setItem(STORAGE_KEY, mode) } catch {}
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('view', mode)
      return next
    }, { replace: true })
  }, [setSearchParams])

  // Sync URL on mount
  useEffect(() => {
    const fromUrl = searchParams.get('view')
    if (fromUrl !== viewMode) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        next.set('view', viewMode)
        return next
      }, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode }}>
      {children}
    </ViewModeContext.Provider>
  )
}

export function useViewMode() {
  return useContext(ViewModeContext)
}
