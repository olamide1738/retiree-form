import { useEffect, useState } from 'react'
import LoginForm from './LoginForm'
import Modal from './Modal'

export default function Dashboard() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Check if user is already authenticated from session storage
    return sessionStorage.getItem('dashboardAuthenticated') === 'true'
  })

  // Modal state
  const [modal, setModal] = useState({
    isOpen: false,
    type: 'success',
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

  const loadSubmissions = async () => {
    try {
      const res = await fetch('/api/submissions')
      if (!res.ok) throw new Error('Failed to load submissions')
      const json = await res.json()
      setRows(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      loadSubmissions()
    }
  }, [isAuthenticated])

  // Function to handle login and persist session
  const handleLogin = (authenticated) => {
    setIsAuthenticated(authenticated)
    if (authenticated) {
      sessionStorage.setItem('dashboardAuthenticated', 'true')
    } else {
      sessionStorage.removeItem('dashboardAuthenticated')
    }
  }

  // Function to handle logout and clear session
  const handleLogout = () => {
    setIsAuthenticated(false)
    sessionStorage.removeItem('dashboardAuthenticated')
  }

  const deleteSubmission = async (id) => {
    showModal('error', 'Confirm Deletion', 'Are you sure you want to delete this submission? This action cannot be undone.')
    
    // For now, we'll use a simple approach - in a real app you'd want a confirmation modal
    if (window.confirm('Are you sure you want to delete this submission? This action cannot be undone.')) {
      try {
        const res = await fetch(`/api/submissions/${id}`, {
          method: 'DELETE'
        })
        if (!res.ok) throw new Error('Failed to delete submission')
        await loadSubmissions() // Reload the list
        showModal('success', 'Submission Deleted', 'The submission has been successfully deleted.')
      } catch (e) {
        showModal('error', 'Delete Failed', 'Error deleting submission: ' + e.message)
      }
    }
  }

  const clearAllSubmissions = async () => {
    if (!confirm('Are you sure you want to delete ALL submissions? This action cannot be undone.')) {
      return
    }

    try {
      const res = await fetch('/api/submissions', {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to clear submissions')
      await loadSubmissions() // Reload the list
      showModal('success', 'All Submissions Cleared', 'All submissions have been successfully cleared.')
    } catch (e) {
      showModal('error', 'Clear Failed', 'Error clearing submissions: ' + e.message)
    }
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />
  }

  if (loading) return <p>Loading submissions...</p>
  if (error) return <p>Error: {error}</p>

  if (!rows.length) return <p>No submissions yet.</p>

  const allKeys = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r.data || {}).forEach(k => set.add(k))
      return set
    }, new Set(['id', 'createdAt', 'files']))
  )

  // Check if we're on mobile
  const isMobile = window.innerWidth <= 768

  return (
    <div className="dashboard-container">
      <div className="dashboard-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Submissions Dashboard</h2>
        <div className="dashboard-actions" style={{ 
          display: 'flex', 
          gap: '10px',
          flexWrap: 'wrap',
          justifyContent: 'flex-end'
        }}>
          <a 
            href="/api/submissions/export" 
            target="_blank" 
            rel="noreferrer"
            style={{
              backgroundColor: 'var(--brand-gold)',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#b8860b'}
            onMouseOut={(e) => e.target.style.backgroundColor = 'var(--brand-gold)'}
          >
            Export to Excel
          </a>
          <a 
            href="/api/submissions/export.pdf" 
            target="_blank" 
            rel="noreferrer"
            style={{
              backgroundColor: 'var(--brand-gold)',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#b8860b'}
            onMouseOut={(e) => e.target.style.backgroundColor = 'var(--brand-gold)'}
          >
            Export to PDF
          </a>
          <button 
            onClick={handleLogout}
            style={{
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#4b5563'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#6b7280'}
          >
            Logout
          </button>
          <button 
            onClick={clearAllSubmissions}
            style={{
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#b91c1c'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#dc2626'}
          >
            Clear All Submissions
          </button>
        </div>
      </div>

      {isMobile ? (
        // Mobile Card Layout
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {rows.map(r => (
            <div key={r.id} style={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1rem',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '0.75rem',
                paddingBottom: '0.5rem',
                borderBottom: '1px solid #f1f5f9'
              }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--brand-brown)' }}>
                  Submission #{r.id}
                </h3>
                <button 
                  onClick={() => deleteSubmission(r.id)}
                  style={{
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#b91c1c'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#dc2626'}
                >
                  Delete
                </button>
              </div>
              
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {allKeys.filter(k => k !== 'id' && k !== 'files').map(k => {
                  if (k === 'createdAt') {
                    const dateOnly = (() => {
                      const d = new Date(r.createdAt)
                      return isNaN(d.getTime()) ? String(r.createdAt) : d.toISOString().slice(0, 10)
                    })()
                    return (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: '600', color: 'var(--text)' }}>{k}:</span>
                        <span style={{ color: 'var(--muted)' }}>{dateOnly}</span>
                      </div>
                    )
                  }
                  const value = r.data?.[k] ?? ''
                  if (value) {
                    return (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: '600', color: 'var(--text)', minWidth: '120px' }}>{k}:</span>
                        <span style={{ color: 'var(--muted)', textAlign: 'right', wordBreak: 'break-word', maxWidth: '200px' }}>
                          {String(value)}
                        </span>
                      </div>
                    )
                  }
                  return null
                })}
                
                {Array.isArray(r.files) && r.files.length > 0 && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ fontWeight: '600', color: 'var(--text)', marginBottom: '0.25rem' }}>Files:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {r.files.map(f => (
                        <a 
                          key={f.id}
                          className="file-link" 
                          href={`/api/files/${f.id}`} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{ fontSize: '0.85rem', wordBreak: 'break-word' }}
                        >
                          {f.field}: {f.original}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Desktop Table Layout
        <div className="dashboard-table-container" style={{ 
          overflowX: 'auto', 
          WebkitOverflowScrolling: 'touch',
          margin: '0 -1rem',
          padding: '0 1rem'
        }}>
          <table className="dashboard-table" style={{ 
            width: '100%', 
            borderCollapse: 'collapse'
          }}>
            <thead>
              <tr>
                {allKeys.map(k => (
                  <th key={k} style={{ 
                    textAlign: 'left', 
                    borderBottom: '1px solid #e2e8f0', 
                    padding: '8px',
                    fontSize: '0.9rem',
                    fontWeight: '600'
                  }}>{k}</th>
                ))}
                <th style={{ 
                  textAlign: 'left', 
                  borderBottom: '1px solid #e2e8f0', 
                  padding: '8px',
                  fontSize: '0.9rem',
                  fontWeight: '600'
                }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  {allKeys.map(k => {
                    if (k === 'id') return <td key={k} style={{ 
                      borderBottom: '1px solid #f1f5f9', 
                      padding: '8px',
                      fontSize: '0.85rem'
                    }}>{r.id}</td>
                    if (k === 'createdAt') {
                      const dateOnly = (() => {
                        const d = new Date(r.createdAt)
                        return isNaN(d.getTime()) ? String(r.createdAt) : d.toISOString().slice(0, 10)
                      })()
                      return <td key={k} style={{ 
                        borderBottom: '1px solid #f1f5f9', 
                        padding: '8px',
                        fontSize: '0.85rem'
                      }}>{dateOnly}</td>
                    }
                    if (k === 'files') {
                      return (
                        <td key={k} style={{ 
                          borderBottom: '1px solid #f1f5f9', 
                          padding: '8px',
                          fontSize: '0.85rem'
                        }}>
                          {Array.isArray(r.files) && r.files.length ? (
                            <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                              {r.files.map(f => (
                                <li key={f.id} style={{ marginBottom: '2px' }}>
                                  <a 
                                    className="file-link" 
                                    href={`/api/files/${f.id}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    style={{ fontSize: '0.8rem' }}
                                  >
                                    {f.field}: {f.original}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          ) : '—'}
                        </td>
                      )
                    }
                    const value = r.data?.[k] ?? ''
                    return <td key={k} style={{ 
                      borderBottom: '1px solid #f1f5f9', 
                      padding: '8px', 
                      verticalAlign: 'top',
                      fontSize: '0.85rem',
                      wordBreak: 'break-word',
                      maxWidth: '150px'
                    }}>{String(value)}</td>
                  })}
                  <td style={{ 
                    borderBottom: '1px solid #f1f5f9', 
                    padding: '8px',
                    whiteSpace: 'nowrap'
                  }}>
                    <button 
                      onClick={() => deleteSubmission(r.id)}
                      style={{
                        backgroundColor: '#dc2626',
                        color: 'white',
                        border: 'none',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        minWidth: '60px'
                      }}
                      onMouseOver={(e) => e.target.style.backgroundColor = '#b91c1c'}
                      onMouseOut={(e) => e.target.style.backgroundColor = '#dc2626'}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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


