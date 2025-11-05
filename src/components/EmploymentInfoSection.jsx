import DatePickerInput from "./DatePickerInput";

export default function EmploymentInfoSection({ values, onChange, errors }) {
  return (
    <fieldset className="section">
      <legend>Employment Information</legend>

      <div className="grid">
        <label className="full">
          <span>Name of Organization / Parastatal / Agency or Government Owned Company retired from</span>
          <input
            type="text"
            name="organization"
            value={values.organization}
            onChange={onChange}
            required
          />
        </label>

        <label>
          <span>Job Title at Retirement</span>
          <input
            type="text"
            name="jobTitle"
            value={values.jobTitle}
            onChange={onChange}
            required
          />
        </label>

        <label>
          <span>Department / Unit</span>
          <input
            type="text"
            name="department"
            value={values.department}
            onChange={onChange}
            required
          />
        </label>

        <label>
          <span>Date of Employment</span>
          <DatePickerInput name="dateOfEmployment" value={values.dateOfEmployment} onChange={onChange} required />
        </label>

        <label>
          <span>Date of Retirement</span>
          <DatePickerInput name="dateOfRetirement" value={values.dateOfRetirement} onChange={onChange} required />
        </label>

        <label>
          <span>Reason for Retirement</span>
          <select
            name="retirementReason"
            value={values.retirementReason}
            onChange={onChange}
            required
          >
            <option value="">Select reason</option>
            <option value="Age">Age</option>
            <option value="Voluntary">Voluntary</option>
            <option value="Medical">Medical</option>
          </select>
        </label>

        <label>
          <span>Last Salary</span>
          <input
            type="text"
            name="lastSalary"
            value={values.lastSalary}
            onChange={onChange}
            required
          />
        </label>

        <label>
          <span>Grade Level</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            name="gradeLevel"
            value={values.gradeLevel}
            onChange={onChange}
            required
            className="number-input"
            title="Enter digits only"
          />
          {errors?.gradeLevel && (
            <div className="field-error">{errors.gradeLevel}</div>
          )}
        </label>
      </div>
    </fieldset>
  );
}


