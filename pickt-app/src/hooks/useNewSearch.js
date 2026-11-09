import { useLocation, useNavigate } from 'react-router-dom'
import { useSearch } from '../context/SearchContext'
import { clearRememberedSearch } from '../lib/searchCriteria'

export const MARKETPLACE_SEARCH_PATH = '/marketplace/discover'

/**
 * "New search", wherever the button is: clears the search box, every filter and chip
 * and the remembered last search, and returns to the marketplace's initial search
 * page. Saved searches are kept. Replaces the current history entry, so the browser's
 * Back button can't bring back what was just cleared, such as AI match results.
 */
export function useNewSearch() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { setQuery, sendSearchCommand } = useSearch()

  return function newSearch() {
    // Forget the remembered last search so it doesn't come back after a reload
    clearRememberedSearch()
    setQuery('')
    if (pathname === MARKETPLACE_SEARCH_PATH) {
      sendSearchCommand({ type: 'reset' })          // reset in place, no reload
    } else {
      navigate(MARKETPLACE_SEARCH_PATH, { state: { newSearch: true }, replace: true })
    }
  }
}
