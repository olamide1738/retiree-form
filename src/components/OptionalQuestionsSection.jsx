export default function OptionalQuestionsSection({ values, onChange }) {
  return (
    <fieldset className="section">
      <legend>Optional Questions</legend>

      <div className="grid">
        <label>
          <span>Preferred Mode of Communication</span>
          <select
            name="preferredCommunication"
            value={values.preferredCommunication}
            onChange={onChange}
            required
          >
            <option value="">Select</option>
            <option value="Email">Email</option>
            <option value="Phone">Phone</option>
            <option value="SMS">SMS</option>
          </select>
        </label>

        <label>
          <span>Health Status (optional)</span>
          <input
            type="text"
            name="healthStatus"
            value={values.healthStatus}
            onChange={onChange}
            placeholder="Optional"
          />
        </label>

        <label className="full">
          <span>Any Additional Comments or Clarifications</span>
          <textarea
            name="additionalComments"
            value={values.additionalComments}
            onChange={onChange}
            rows={4}
          />
        </label>
      </div>
    </fieldset>
  );
}


