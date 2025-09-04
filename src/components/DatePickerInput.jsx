import DatePicker from 'react-datepicker'
import { useState, useEffect } from 'react'

export default function DatePickerInput({ name, value, onChange, required }) {
  const parsed = value ? new Date(value) : null
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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
      // Mobile optimizations
      withPortal={isMobile}
      shouldCloseOnSelect={true}
      popperClassName="react-datepicker-popper"
      popperPlacement="bottom-center"
      popperModifiers={[
        {
          name: 'preventOverflow',
          options: {
            boundary: 'viewport',
          },
        },
        {
          name: 'flip',
          options: {
            fallbackPlacements: ['top-center', 'bottom-center'],
          },
        },
        {
          name: 'offset',
          options: {
            offset: [0, 10],
          },
        },
      ]}
      // Additional mobile-friendly props
      fixedHeight={isMobile}
      inline={false}
      autoFocus={false}
      showPopperArrow={false}
    />
  )
}


