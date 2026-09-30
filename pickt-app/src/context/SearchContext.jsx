import { createContext, useCallback, useContext, useState } from 'react'

const SearchContext = createContext({
  query: '',
  setQuery: () => {},
  searchCommand: null,
  sendSearchCommand: () => {},
})

export function SearchProvider({ children }) {
  const [query, setQuery] = useState('')
  // Commands for the marketplace search page from elsewhere in the app, e.g.
  // { type: 'reset' } from "New search" or { type: 'run', criteria } from Saved searches.
  // `id` changes every time so the same command can be sent twice.
  const [searchCommand, setSearchCommand] = useState(null)
  const sendSearchCommand = useCallback(cmd => setSearchCommand({ ...cmd, id: Date.now() + Math.random() }), [])

  return (
    <SearchContext.Provider value={{ query, setQuery, searchCommand, sendSearchCommand }}>
      {children}
    </SearchContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSearch() {
  return useContext(SearchContext)
}
