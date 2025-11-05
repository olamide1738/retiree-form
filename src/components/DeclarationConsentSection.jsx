
import DatePickerInput from "./DatePickerInput";
import FileInput from "./FileInput";

export default function DeclarationConsentSection({ values, onChange, onFileChange }) {
  return (
    <fieldset className="section">
      <legend>Declaration / Consent</legend>

      <div className="grid">
        <label className="full">
          <span>I confirm that the information provided is accurate</span>
          <select
            name="confirmAccuracy"
            value={values.confirmAccuracy}
            onChange={onChange}
            required
          >
            <option value="">Select</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </label>

        <label className="full">
          <span>Your Signature (upload an image)</span>
          <FileInput
            name="declarantSignature"
            accept="image/*"
            onChange={onFileChange}
            required
          />
        </label>

        <label>
          <span>Date</span>
          <DatePickerInput name="declarationDate" value={values.declarationDate} onChange={onChange} required />
        </label>

        <label>
          <span>Witness / HR Officer Name</span>
          <input
            type="text"
            name="witnessName"
            value={values.witnessName}
            onChange={onChange}
            required
          />
        </label>

        <label className="full">
          <span>Witness / HR Officer Signature (upload an image)</span>
          <FileInput
            name="witnessSignature"
            accept="image/*"
            onChange={onFileChange}
            required
          />
        </label>

        <label>
          <span>Witness / HR Officer Date</span>
          <DatePickerInput name="witnessDate" value={values.witnessDate} onChange={onChange} required />
        </label>
      </div>
    </fieldset>
  );
}


