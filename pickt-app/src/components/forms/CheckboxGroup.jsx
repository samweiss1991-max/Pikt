import './FormControls.css'

/**
 * A multi-select as a labelled group of checkboxes: each one works with Tab and
 * Space, and screen readers announce the group's name.
 */
export default function CheckboxGroup({ label, required = false, options, value = [], onChange }) {
  function toggle(option, checked) {
    // Keeps the order the options are listed in
    onChange(options.filter(o => (o === option ? checked : value.includes(o))))
  }

  return (
    <fieldset className="fc-group" aria-required={required || undefined}>
      <legend className="fc-label">{label}{required && ' *'}</legend>
      <div className="fc-group-options">
        {options.map(option => (
          <label key={option} className={`fc-check ${value.includes(option) ? 'fc-check--on' : ''}`}>
            <input type="checkbox" checked={value.includes(option)} onChange={e => toggle(option, e.target.checked)} />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
