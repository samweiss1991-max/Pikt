import { useState, useEffect } from 'react'

type ViewMode = 'stack' | 'carousel' | 'matrix' | 'fickt' | 'compact' | 'focus'

const STORAGE_KEY = 'pickt-view-mode'
const DEFAULT: ViewMode = 'stack'

export function useViewMode() {
  const [viewMode, setViewMode] = useState<ViewMode>(DEFAULT)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ViewMode | null
    if (stored) setViewMode(stored)
  }, [])

  const updateViewMode = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem(STORAGE_KEY, mode)
  }

  return { viewMode, setViewMode: updateViewMode }
}
