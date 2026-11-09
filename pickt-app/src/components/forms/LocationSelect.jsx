import { useEffect, useState } from 'react'
import SearchableSelect from './SearchableSelect'
import { EMPTY_LOCATION, findOption, loadCities, loadCountries, loadStates } from '../../lib/locations'
import './FormControls.css'

/**
 * Three linked dropdowns: Country → State → City.
 * Changing the country clears State and City; changing the State clears City.
 * A city that isn't listed can be typed in.
 *
 * If the lists can't be downloaded, all three become typed entry, so nobody is
 * stuck. Values that arrive as plain names (saved drafts, CV parsing, older
 * records) are matched to their codes once the lists load.
 */
export default function LocationSelect({ value, onChange, required = false }) {
  const [countries, setCountries] = useState([])
  const [states, setStates] = useState([])
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState({ countries: true, states: false, cities: false })
  const [failed, setFailed] = useState(false)
  const { countryCode, country, stateCode, state, city } = value

  useEffect(() => {
    let cancelled = false
    loadCountries()
      .then(rows => { if (!cancelled) setCountries(rows) })
      .catch(() => { if (!cancelled) setFailed(true) })
      .finally(() => { if (!cancelled) setLoading(l => ({ ...l, countries: false })) })
    return () => { cancelled = true }
  }, [])

  // A country known only by name: find its code, or clear it if it isn't a country
  useEffect(() => {
    if (countryCode || !country || countries.length === 0) return
    const match = findOption(countries, country)
    onChange(match
      ? { ...value, countryCode: match.value, country: match.label }
      : { ...EMPTY_LOCATION })
  }, [countries, countryCode, country]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!countryCode || failed) return undefined
    let cancelled = false
    Promise.resolve().then(() => { if (!cancelled) { setStates([]); setLoading(l => ({ ...l, states: true })) } })
    loadStates(countryCode)
      .then(rows => { if (!cancelled) setStates(rows) })
      .catch(() => { if (!cancelled) setFailed(true) })
      .finally(() => { if (!cancelled) setLoading(l => ({ ...l, states: false })) })
    // Stops counting as loading if the country changes or clears part-way through
    return () => { cancelled = true; setLoading(l => ({ ...l, states: false })) }
  }, [countryCode, failed])

  // A state known only by name or code: match it to the list
  useEffect(() => {
    if (!state && !stateCode) return
    if (states.length === 0 || (stateCode && state)) return
    const match = findOption(states, state || stateCode)
    if (match) onChange({ ...value, stateCode: match.value, state: match.label })
    else onChange({ ...value, stateCode: '', state: '', city: '' })
  }, [states]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!countryCode || !stateCode || failed) return undefined
    let cancelled = false
    Promise.resolve().then(() => { if (!cancelled) { setCities([]); setLoading(l => ({ ...l, cities: true })) } })
    loadCities(countryCode, stateCode)
      .then(rows => { if (!cancelled) setCities(rows) })
      // No city list isn't a problem: a city can always be typed in
      .catch(() => { if (!cancelled) setCities([]) })
      .finally(() => { if (!cancelled) setLoading(l => ({ ...l, cities: false })) })
    return () => { cancelled = true; setLoading(l => ({ ...l, cities: false })) }
  }, [countryCode, stateCode, failed])

  const countryHasNoStates = Boolean(countryCode) && !loading.states && !failed && states.length === 0

  function pickCountry(row) {
    if ((row?.value || '') === countryCode && row) return
    onChange({ ...EMPTY_LOCATION, countryCode: row && !row.custom ? row.value : '', country: row?.label || '' })
  }

  function pickState(row) {
    if ((row?.value || '') === stateCode && row) return
    onChange({ ...value, stateCode: row && !row.custom ? row.value : '', state: row?.label || '', city: '' })
  }

  const cityEnabled = failed || Boolean(stateCode || state) || countryHasNoStates

  return (
    <div className="fc-location">
      <SearchableSelect
        label="Country"
        required={required}
        options={countries}
        value={country}
        onSelect={pickCountry}
        loading={loading.countries}
        allowCustom={failed}
        placeholder={failed ? 'Type the country' : 'Search countries'}
      />
      <SearchableSelect
        label="State"
        required={required && !countryHasNoStates}
        options={states}
        value={state}
        onSelect={pickState}
        disabled={failed ? !country : (!countryCode || countryHasNoStates)}
        loading={loading.states}
        allowCustom={failed}
        placeholder={
          failed ? 'Type the state'
            : !countryCode ? 'Choose a country first'
              : countryHasNoStates ? 'No states for this country'
                : 'Search states'
        }
      />
      <SearchableSelect
        label="City"
        required={required}
        options={cities}
        value={city}
        onSelect={row => onChange({ ...value, city: row?.label || '' })}
        disabled={!cityEnabled}
        loading={loading.cities}
        allowCustom
        placeholder={cityEnabled ? 'Search, or type your city' : 'Choose a state first'}
      />
      {failed && (
        <p className="fc-hint fc-location-note" role="status">
          We couldn't load the location lists, so please type these in.
        </p>
      )}
    </div>
  )
}
