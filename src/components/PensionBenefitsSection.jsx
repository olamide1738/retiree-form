export default function PensionBenefitsSection({ values, onChange, errors }) {
  return (
    <fieldset className="section">
      <legend>Pension / Benefits Information</legend>

      <div className="grid">
        <label>
          <span>Pension Number</span>
          <input
            type="text"
            name="pensionNumber"
            value={values.pensionNumber}
            onChange={onChange}
            required
            pattern="[A-Za-z0-9]*"
            title="Letters and numbers only"
          />
        </label>

        <label>
          <span>Pension Fund Administrator</span>
          <input
            type="text"
            name="pensionFundAdministrator"
            value={values.pensionFundAdministrator}
            onChange={onChange}
            required
          />
          {errors?.pensionFundAdministrator && (
            <div className="field-error">{errors.pensionFundAdministrator}</div>
          )}
        </label>
      </div>
    </fieldset>
  );
}


