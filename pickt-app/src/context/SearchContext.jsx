import { createContext, useContext, useState } from 'react'

const SearchContext = createContext({ query: '', setQuery: () => {} })

export function SearchProvider({ children }) {
  const [query, setQuery] = useState('')
  return (
    <SearchContext.Provider value={{ query, setQuery }}>
      {children}
    </SearchContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSearch() {
  return useContext(SearchContext)
}
