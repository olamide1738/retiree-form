import { useState } from 'react'
import './App.css'
import PersonalInfoSection from './components/PersonalInfoSection'
import EmploymentInfoSection from './components/EmploymentInfoSection'
import PensionBenefitsSection from './components/PensionBenefitsSection'
import VerificationDocumentsSection from './components/VerificationDocumentsSection'
import OptionalQuestionsSection from './components/OptionalQuestionsSection'
import Dashboard from './components/Dashboard'
import LogoHeader from './components/LogoHeader'
import Modal from './components/Modal'

function App() {
  // Form type: 'physical' or 'online'
  const [formType, setFormType] = useState('physical')
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = 5

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
    lastSalary: '',
    gradeLevel: ''
  })

  const [pensionBenefits, setPensionBenefits] = useState({
    pensionNumber: '',
    bankName: '',
    accountNumber: '',
    pensionPaymentMode: ''
  })

  const [verificationDocs, setVerificationDocs] = useState({})
  const [verificationFiles, setVerificationFiles] = useState({
    retirementLetter: null,
    birthCertOrId: null,
    passportPhoto: null,
    otherDocuments: []
  })

  const [optionalQuestions, setOptionalQuestions] = useState({
    preferredCommunication: '',
    healthStatus: '',
    additionalComments: ''
  })

  const [errors, setErrors] = useState({})

  const [showDashboard, setShowDashboard] = useState(false)
  
  // Modal state
  const [modal, setModal] = useState({
    isOpen: false,
    type: 'success', // 'success' or 'error'
    title: '',
    message: ''
  })

  // Modal functions
  const showModal = (type, title, message) => {
    setModal({
      isOpen: true,
      type,
      title,
      message
    })
  }

  const closeModal = () => {
    setModal(prev => ({ ...prev, isOpen: false }))
  }

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

  function setFieldError(field, message) {
    setErrors(prev => ({ ...prev, [field]: message }))
  }

  function clearFieldError(field) {
    setErrors(prev => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function handlePersonalChange(event) {
    const { name, value } = event.target
    
    // Validate numeric inputs
    if ((name === 'phoneNumber' || name === 'nextOfKinPhone')) {
      if (value && !/^\d*$/.test(value)) {
        setFieldError(name, 'Digits only (0-9) are allowed')
        return
      }
      clearFieldError(name)
      if (value.length > 11) return
    }
    
    setPersonalInfo(prev => ({ ...prev, [name]: value }))
  }

  function handleEmploymentChange(event) {
    const { name, value } = event.target
    
    // Grade level should be numeric digits only
    if (name === 'gradeLevel') {
      if (value && !/^\d*$/.test(value)) {
        setFieldError(name, 'Grade level must contain digits only')
        return
      }
      clearFieldError(name)
    }
    
    setEmploymentInfo(prev => ({ ...prev, [name]: value }))
  }

  function handlePensionChange(event) {
    const { name, value } = event.target
    
    // Validate numeric inputs
    if (name === 'pensionNumber' || name === 'accountNumber') {
      if (value && !/^\d*$/.test(value)) {
        setFieldError(name, 'Digits only (0-9) are allowed')
        return
      }
      clearFieldError(name)
      if (name === 'accountNumber' && value.length > 10) return
    }
    
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
      ...optionalQuestions,
      formType
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

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      if (!res.ok) throw new Error('Failed to submit')
      const json = await res.json()
      showModal('success', 'Form Submitted Successfully!', 'Your retiree verification form has been submitted successfully. Thank you for your submission.')

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
        lastSalary: '',
        gradeLevel: ''
      })
      setPensionBenefits({
        pensionNumber: '',
        bankName: '',
        accountNumber: '',
        pensionPaymentMode: ''
      })
      setVerificationDocs({})
      setVerificationFiles({
        retirementLetter: null,
        birthCertOrId: null,
        passportPhoto: null,
        otherDocuments: []
      })
      setOptionalQuestions({
        preferredCommunication: '',
        healthStatus: '',
        additionalComments: ''
      })
      setErrors({})
      // Clear native file inputs in the DOM
      if (event.target && typeof event.target.reset === 'function') {
        event.target.reset()
      }
      // For physical registration, return to the beginning for next user
      if (formType === 'physical') {
        setCurrentPage(1)
      }
    } catch (e) {
      console.error(e)
      showModal('error', 'Submission Failed', 'There was an error submitting your form. Please try again or contact support if the problem persists.')
    }
  }

  return (
    <div className="container">
      <LogoHeader />
      <h1>Retiree Verification Form</h1>
      <div className="actions" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'center' }}>
        <button type="button" onClick={() => setShowDashboard(false)} className="nav-button" title="Form">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10,9 9,9 8,9"/>
          </svg>
        </button>
        {/* Form type dropdown */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <select
            value={formType}
            onChange={e => setFormType(e.target.value)}
            className="form-type-dropdown"
          >
            <option value="physical">Physical Registration</option>
            <option value="online">Online Registration</option>
          </select>
        </div>
        <button type="button" onClick={() => setShowDashboard(true)} className="nav-button" title="Dashboard">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
        </button>
      </div>

      {showDashboard ? (
        <Dashboard />
      ) : (
        <div>
          <form onSubmit={handleSubmit} className="form">
            {/* Hidden field to track form type */}
            <input type="hidden" name="formType" value={formType} />

            {/* Page 1: Personal Information */}
            {currentPage === 1 && (
              <div className="form-section">
                <PersonalInfoSection values={personalInfo} onChange={handlePersonalChange} errors={errors} />
              </div>
            )}

            {/* Page 2: Employment Information */}
            {currentPage === 2 && (
              <div className="form-section">
                <EmploymentInfoSection values={employmentInfo} onChange={handleEmploymentChange} errors={errors} />
              </div>
            )}

            {/* Page 3: Pension Benefits */}
            {currentPage === 3 && (
              <div className="form-section">
                <PensionBenefitsSection values={pensionBenefits} onChange={handlePensionChange} errors={errors} />
              </div>
            )}

            {/* Page 4: Verification Documents */}
            {currentPage === 4 && (
              <div className="form-section">
                <VerificationDocumentsSection
                  values={verificationDocs}
                  onChange={handleVerificationChange}
                  onFileChange={handleVerificationFileChange}
                />
              </div>
            )}

            {/* Page 5: Optional Questions */}
            {currentPage === 5 && (
              <div className="form-section">
                <OptionalQuestionsSection values={optionalQuestions} onChange={handleOptionalChange} />
              </div>
            )}

            {/* Navigation Buttons with Pagination */}
            <div className="form-navigation" style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: '0.5rem',
              padding: '0.5rem 0',
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
                      backgroundColor: currentPage === i + 1 ? '#c5ab11' : '#6b7280',
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
      
      {/* Modal */}
      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        duration={5000}
      />
    </div>
  )
}

export default App
