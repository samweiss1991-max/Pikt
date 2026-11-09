// Country → State → City lists (ISO 3166 / 3166-2 codes).
// The package and its data only download when a screen first needs them, so they
// don't slow down the rest of the app. Each answer is kept for the visit.

export const EMPTY_LOCATION = { countryCode: '', country: '', stateCode: '', state: '', city: '' }

const loadPackage = () => import('@countrystatecity/countries-browser')
const cache = new Map()

function remember(key, load) {
  if (!cache.has(key)) {
    const pending = load().catch(err => {
      cache.delete(key) // let a later attempt try again
      throw err
    })
    cache.set(key, pending)
  }
  return cache.get(key)
}

const toOptions = rows => rows
  .map(r => ({ value: r.iso2 || r.name, label: r.name }))
  .sort((a, b) => a.label.localeCompare(b.label))

export function loadCountries() {
  return remember('countries', async () => {
    const { getCountries } = await loadPackage()
    return toOptions(await getCountries())
  })
}

export function loadStates(countryCode) {
  return remember(`states:${countryCode}`, async () => {
    const { getStatesOfCountry } = await loadPackage()
    return toOptions(await getStatesOfCountry(countryCode))
  })
}

export function loadCities(countryCode, stateCode) {
  return remember(`cities:${countryCode}:${stateCode}`, async () => {
    const { getCitiesOfState } = await loadPackage()
    const rows = await getCitiesOfState(countryCode, stateCode)
    const names = [...new Set(rows.map(r => r.name))].sort((a, b) => a.localeCompare(b))
    return names.map(name => ({ value: name, label: name }))
  })
}

/** Finds a list entry from text such as "Australia", "AU" or "NSW". */
export function findOption(options, text) {
  const t = String(text ?? '').trim().toLowerCase()
  if (!t) return null
  return options.find(o => o.label.toLowerCase() === t || String(o.value).toLowerCase() === t) || null
}
