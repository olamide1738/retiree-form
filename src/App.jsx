
import { useState } from 'react'
import './App.css'
import PersonalInfoSection from './components/PersonalInfoSection'
import EmploymentInfoSection from './components/EmploymentInfoSection'
import PensionBenefitsSection from './components/PensionBenefitsSection'
import VerificationDocumentsSection from './components/VerificationDocumentsSection'
import DeclarationConsentSection from './components/DeclarationConsentSection'
import OptionalQuestionsSection from './components/OptionalQuestionsSection'
import Dashboard from './components/Dashboard'
import LogoHeader from './components/LogoHeader'

function App() {
  const [personalInfo, setPersonalInfo] = useState({
    fullName: '',
    dateOfBirth: '',
    gender: '',
    nationality: '',
    residentialAddress: '',
    phoneNumber: '',
    emailAddress: '',
    nextOfKinName: '',
    nextOfKinPhone: ''
  })

  const [employmentInfo, setEmploymentInfo] = useState({
    organization: '',
    jobTitle: '',
    department: '',
    dateOfEmployment: '',
    dateOfRetirement: '',
    retirementReason: '',
    lastSalaryOrGrade: ''
  })

  const [pensionBenefits, setPensionBenefits] = useState({
    pensionNumber: '',
    bankName: '',
    accountNumber: '',
    pensionPaymentMode: ''
  })

  const [verificationDocs, setVerificationDocs] = useState({
    bvn: ''
  })
  const [verificationFiles, setVerificationFiles] = useState({
    retirementLetter: null,
    birthCertOrId: null,
    passportPhoto: null,
    otherDocuments: []
  })

  const [declarationValues, setDeclarationValues] = useState({
    confirmAccuracy: '',
    declarationDate: '',
    witnessName: '',
    witnessDate: ''
  })
  const [declarationFiles, setDeclarationFiles] = useState({
    declarantSignature: null,
    witnessSignature: null
  })

  const [optionalQuestions, setOptionalQuestions] = useState({
    preferredCommunication: '',
    healthStatus: '',
    additionalComments: ''
  })

  const [showDashboard, setShowDashboard] = useState(false)

  function handlePersonalChange(event) {
    const { name, value } = event.target
    setPersonalInfo(prev => ({ ...prev, [name]: value }))
  }

  function handleEmploymentChange(event) {
    const { name, value } = event.target
    setEmploymentInfo(prev => ({ ...prev, [name]: value }))
  }

  function handlePensionChange(event) {
    const { name, value } = event.target
    setPensionBenefits(prev => ({ ...prev, [name]: value }))
  }

  function handleVerificationChange(event) {
    const { name, value } = event.target
    setVerificationDocs(prev => ({ ...prev, [name]: value }))
  }

  function handleVerificationFileChange(event) {
    const { name, files } = event.target
    if (name === 'otherDocuments') {
      setVerificationFiles(prev => ({ ...prev, [name]: Array.from(files) }))
    } else {
      setVerificationFiles(prev => ({ ...prev, [name]: files && files[0] ? files[0] : null }))
    }
  }

  function handleDeclarationChange(event) {
    const { name, value } = event.target
    setDeclarationValues(prev => ({ ...prev, [name]: value }))
  }

  function handleDeclarationFileChange(event) {
    const { name, files } = event.target
    setDeclarationFiles(prev => ({ ...prev, [name]: files && files[0] ? files[0] : null }))
  }

  function handleOptionalChange(event) {
    const { name, value } = event.target
    setOptionalQuestions(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const formData = new FormData()

    // Append text fields
    const allText = {
      ...personalInfo,
      ...employmentInfo,
      ...pensionBenefits,
      ...verificationDocs,
      ...declarationValues,
      ...optionalQuestions
    }
    Object.entries(allText).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value)
      }
    })

    // Append files
    if (verificationFiles.retirementLetter) formData.append('retirementLetter', verificationFiles.retirementLetter)
    if (verificationFiles.birthCertOrId) formData.append('birthCertOrId', verificationFiles.birthCertOrId)
    if (verificationFiles.passportPhoto) formData.append('passportPhoto', verificationFiles.passportPhoto)
    verificationFiles.otherDocuments.forEach(file => formData.append('otherDocuments', file))
    if (declarationFiles.declarantSignature) formData.append('declarantSignature', declarationFiles.declarantSignature)
    if (declarationFiles.witnessSignature) formData.append('witnessSignature', declarationFiles.witnessSignature)

    try {
      const res = await fetch('http://localhost:4000/api/submissions', {
        method: 'POST',
        body: formData
      })
      if (!res.ok) throw new Error('Failed to submit')
      const json = await res.json()
      alert('Form Successfully Filled')

      // Reset form state for a fresh submission
      setPersonalInfo({
        fullName: '',
        dateOfBirth: '',
        gender: '',
        nationality: '',
        residentialAddress: '',
        phoneNumber: '',
        emailAddress: '',
        nextOfKinName: '',
        nextOfKinPhone: ''
      })
      setEmploymentInfo({
        organization: '',
        jobTitle: '',
        department: '',
        dateOfEmployment: '',
        dateOfRetirement: '',
        retirementReason: '',
        lastSalaryOrGrade: ''
      })
      setPensionBenefits({
        pensionNumber: '',
        bankName: '',
        accountNumber: '',
        pensionPaymentMode: ''
      })
      setVerificationDocs({ bvn: '' })
      setVerificationFiles({
        retirementLetter: null,
        birthCertOrId: null,
        passportPhoto: null,
        otherDocuments: []
      })
      setDeclarationValues({
        confirmAccuracy: '',
        declarationDate: '',
        witnessName: '',
        witnessDate: ''
      })
      setDeclarationFiles({ declarantSignature: null, witnessSignature: null })
      setOptionalQuestions({
        preferredCommunication: '',
        healthStatus: '',
        additionalComments: ''
      })
      // Clear native file inputs in the DOM
      if (event.target && typeof event.target.reset === 'function') {
        event.target.reset()
      }
    } catch (e) {
      console.error(e)
      alert('Submission failed')
    }
  }

  return (
    <div className="container">
      <LogoHeader />
      <h1>Retiree Verification Form</h1>
      <div className="actions" style={{ marginBottom: '1rem' }}>
        <button type="button" onClick={() => setShowDashboard(false)}>Form</button>
        <button type="button" onClick={() => setShowDashboard(true)}>Dashboard</button>
      </div>

      {showDashboard ? (
        <Dashboard />
      ) : (
      <form onSubmit={handleSubmit} className="form">
        <PersonalInfoSection values={personalInfo} onChange={handlePersonalChange} />
        <EmploymentInfoSection values={employmentInfo} onChange={handleEmploymentChange} />
        <PensionBenefitsSection values={pensionBenefits} onChange={handlePensionChange} />
        <VerificationDocumentsSection
          values={verificationDocs}
          onChange={handleVerificationChange}
          onFileChange={handleVerificationFileChange}
        />
        <DeclarationConsentSection
          values={declarationValues}
          onChange={handleDeclarationChange}
          onFileChange={handleDeclarationFileChange}
        />
        <OptionalQuestionsSection values={optionalQuestions} onChange={handleOptionalChange} />
        <div className="actions">
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <a className="button" href="http://localhost:4000/api/submissions/export" target="_blank" rel="noreferrer">Export to Excel</a>
            <a className="button" href="http://localhost:4000/api/submissions/export.pdf" target="_blank" rel="noreferrer">Export to PDF</a>
          </div>
          <button type="submit">Submit</button>
        </div>
      </form>
      )}
    </div>
  )
}

export default App
