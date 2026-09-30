import { useLocation, useNavigate } from 'react-router-dom'
import { useSearch } from '../../context/SearchContext'
import { clearRememberedSearch } from '../../lib/searchCriteria'
import './SearchActions.css'

export const MARKETPLACE_SEARCH_PATH = '/marketplace/discover'

// Pages with search controls or a candidate list get the "New search" button
const PAGES_WITH_SEARCH = [/^\/$/, /^\/marketplace(\/|$)/, /^\/candidates\//, /^\/shortlist$/, /^\/my-candidates$/]

/**
 * Top-right action bar, in the same place on every page with search controls
 * or candidates. The marketplace search page adds "Saved searches" and
 * "Save search" into the slot next to "New search".
 */
export default function SearchActionsBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { setQuery, sendSearchCommand } = useSearch()

  if (!PAGES_WITH_SEARCH.some(re => re.test(pathname))) return null

  function newSearch() {
    // Forget the remembered last search so it doesn't come back after a reload
    clearRememberedSearch()
    setQuery('')
    if (pathname === MARKETPLACE_SEARCH_PATH) {
      sendSearchCommand({ type: 'reset' })          // reset in place, no reload
    } else {
      navigate(MARKETPLACE_SEARCH_PATH, { state: { newSearch: true } })
    }
  }

  return (
    <div className="sa-bar" role="toolbar" aria-label="Search actions">
      {/* Marketplace search page renders Saved searches + Save search here */}
      <div id="sa-slot" className="sa-slot" />
      <button type="button" className="sa-btn press-scale" onClick={newSearch}>
        <span className="material-symbols-outlined" aria-hidden="true">restart_alt</span>
        New search
      </button>
    </div>
  )
}
