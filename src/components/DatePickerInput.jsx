import DatePicker from 'react-datepicker'

export default function DatePickerInput({ name, value, onChange, required }) {
  const parsed = value ? new Date(value) : null

  function handleChange(date) {
    const iso = date instanceof Date && !isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : ''
    onChange({ target: { name, value: iso } })
  }

  return (
    <DatePicker
      selected={parsed}
      onChange={handleChange}
      dateFormat="yyyy-MM-dd"
      placeholderText="YYYY-MM-DD"
      required={required}
      className="react-datepicker-input"
      showMonthDropdown
      showYearDropdown
      dropdownMode="select"
      isClearable
    />
  )
}


