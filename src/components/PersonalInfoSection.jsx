import { countries } from "../data/countries";
import DatePickerInput from "./DatePickerInput";

export default function PersonalInfoSection({ values, onChange }) {
  return (
    <fieldset className="section">
      <legend>Personal Information</legend>

      <div className="grid">
        <label>
          <span>Full Name</span>
          <input
            type="text"
            name="fullName"
            value={values.fullName}
            onChange={onChange}
            required
          />
        </label>

        <label>
          <span>Date of Birth</span>
          <DatePickerInput name="dateOfBirth" value={values.dateOfBirth} onChange={onChange} required />
        </label>

        <label>
          <span>Gender</span>
          <select
            name="gender"
            value={values.gender}
            onChange={onChange}
            required
          >
            <option value="">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </label>

        <label>
          <span>Nationality</span>
          <select
            name="nationality"
            value={values.nationality}
            onChange={onChange}
            required
          >
            <option value="">Select a country</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </label>

        <label className="full">
          <span>Residential Address</span>
          <input
            type="text"
            name="residentialAddress"
            value={values.residentialAddress}
            onChange={onChange}
            required
          />
        </label>

        <label>
          <span>Phone Number</span>
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            name="phoneNumber"
            value={values.phoneNumber}
            onChange={onChange}
            required
            min="0"
          />
        </label>

        <label>
          <span>Email Address (optional)</span>
          <input
            type="email"
            name="emailAddress"
            value={values.emailAddress}
            onChange={onChange}
            placeholder="name@example.com"
          />
        </label>

        <label>
          <span>Next of Kin Name</span>
          <input
            type="text"
            name="nextOfKinName"
            value={values.nextOfKinName}
            onChange={onChange}
            required
          />
        </label>

        <label>
          <span>Next of Kin Phone Number</span>
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            name="nextOfKinPhone"
            value={values.nextOfKinPhone}
            onChange={onChange}
            required
            min="0"
          />
        </label>
      </div>
    </fieldset>
  );
}


