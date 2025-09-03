export default function PensionBenefitsSection({ values, onChange }) {
  return (
    <fieldset className="section">
      <legend>Pension / Benefits Information</legend>

      <div className="grid">
        <label>
          <span>Pension Number (if already issued) - optional</span>
          <input
            type="text"
            name="pensionNumber"
            value={values.pensionNumber}
            onChange={onChange}
            placeholder="Optional"
          />
        </label>

        <label>
          <span>Bank Name</span>
          <input
            type="text"
            name="bankName"
            value={values.bankName}
            onChange={onChange}
            required
          />
        </label>

        <label>
          <span>Account Number</span>
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            name="accountNumber"
            value={values.accountNumber}
            onChange={onChange}
            required
            min="0"
          />
        </label>

        <label>
          <span>Mode of Pension Payment</span>
          <select
            name="pensionPaymentMode"
            value={values.pensionPaymentMode}
            onChange={onChange}
            required
          >
            <option value="">Select mode</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cheque">Cheque</option>
            <option value="Cash Pickup">Cash Pickup</option>
            <option value="Mobile Wallet">Mobile Wallet</option>
            <option value="Other">Other</option>
          </select>
        </label>
      </div>
    </fieldset>
  );
}


