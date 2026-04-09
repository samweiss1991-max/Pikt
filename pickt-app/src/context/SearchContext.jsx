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

export function useSearch() {
  return useContext(SearchContext)
}
