
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
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = 6

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

  // Navigation functions
  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

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
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/submissions`, {
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
        <div>
          <form onSubmit={handleSubmit} className="form">
            {/* Page 1: Personal Information */}
            {currentPage === 1 && (
              <PersonalInfoSection values={personalInfo} onChange={handlePersonalChange} />
            )}

            {/* Page 2: Employment Information */}
            {currentPage === 2 && (
              <EmploymentInfoSection values={employmentInfo} onChange={handleEmploymentChange} />
            )}

            {/* Page 3: Pension Benefits */}
            {currentPage === 3 && (
              <PensionBenefitsSection values={pensionBenefits} onChange={handlePensionChange} />
            )}

            {/* Page 4: Verification Documents */}
            {currentPage === 4 && (
              <VerificationDocumentsSection
                values={verificationDocs}
                onChange={handleVerificationChange}
                onFileChange={handleVerificationFileChange}
              />
            )}

            {/* Page 5: Declaration/Consent */}
            {currentPage === 5 && (
              <DeclarationConsentSection
                values={declarationValues}
                onChange={handleDeclarationChange}
                onFileChange={handleDeclarationFileChange}
              />
            )}

            {/* Page 6: Optional Questions */}
            {currentPage === 6 && (
              <OptionalQuestionsSection values={optionalQuestions} onChange={handleOptionalChange} />
            )}

            {/* Navigation Buttons with Pagination */}
            <div className="form-navigation" style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: '2rem',
              padding: '1rem 0',
              gap: '2rem'
            }}>
              {/* Previous Button */}
              <button
                type="button"
                onClick={prevPage}
                disabled={currentPage === 1}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: currentPage === 1 ? '#e5e7eb' : '#f3f4f6',
                  color: currentPage === 1 ? '#9ca3af' : '#374151',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  transition: 'all 0.3s ease',
                  opacity: currentPage === 1 ? 0.5 : 1
                }}
              >
                ←
              </button>

              {/* Pagination Dots */}
              <div className="page-dots" style={{ 
                display: 'flex', 
                gap: '0.5rem',
                alignItems: 'center',
                backgroundColor: '#f3f4f6',
                padding: '0.5rem 1rem',
                borderRadius: '20px',
               
              }}>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => goToPage(i + 1)}
                    style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      border: 'none',
                      backgroundColor: currentPage === i + 1 ? '#000000' : '#9ca3af',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      padding: "0px"
                    }}
                  />
                ))}
              </div>

              {/* Next/Submit Button */}
              {currentPage === totalPages ? (
                <button
                  type="submit"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    transition: 'all 0.3s ease'
                  }}
                >
                  ✓
                </button>
              ) : (
                <button
                  type="button"
                  onClick={nextPage}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    transition: 'all 0.3s ease'
                  }}
                >
                  →
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default App
