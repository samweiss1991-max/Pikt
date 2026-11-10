import { useLocation } from 'react-router-dom'
import { useNewSearch } from '../../hooks/useNewSearch'
import './SearchActions.css'

// Pages with search controls or a candidate list get the "New search" button
// (not the Dashboard: it's an overview, with no search or candidate list)
const PAGES_WITH_SEARCH = [/^\/marketplace(\/|$)/, /^\/candidates\//, /^\/shortlist$/, /^\/my-candidates$/]

// The job description pages: upload has no search to reset, and the results page has
// its own "New search" next to Back
const HIDDEN_ON = ['/marketplace/upload', '/marketplace/matches']

/**
 * Top-right action bar, in the same place on every page with search controls
 * or candidates. The marketplace search page adds "Saved searches" and
 * "Save search" into the slot next to "New search".
 */
export default function SearchActionsBar() {
  const { pathname } = useLocation()
  const newSearch = useNewSearch()

  if (!PAGES_WITH_SEARCH.some(re => re.test(pathname)) || HIDDEN_ON.includes(pathname)) return null

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
