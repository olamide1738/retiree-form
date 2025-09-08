import FileInput from './FileInput'

export default function VerificationDocumentsSection({ values, onFileChange, onChange }) {
  return (
    <fieldset className="section">
      <legend>Verification Documents</legend>

      <div className="grid">
        <label className="full">
          <span>Copy of Retirement Letter / Service Certificate</span>
          <FileInput
            name="retirementLetter"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={onFileChange}
            required
          />
        </label>

        <label className="full">
          <span>Birth Certificate / National ID</span>
          <FileInput
            name="birthCertOrId"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={onFileChange}
            required
          />
        </label>

        <label className="full">
          <span>Passport Photograph</span>
          <FileInput
            name="passportPhoto"
            accept="image/*"
            onChange={onFileChange}
            required
          />
        </label>

        <label className="full">
          <span>Any other relevant document (you can select multiple)</span>
          <FileInput
            name="otherDocuments"
            multiple
            onChange={onFileChange}
          />
        </label>
      </div>
    </fieldset>
  );
}


