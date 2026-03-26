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

  const [editModal, setEditModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editingDisplayId, setEditingDisplayId] = useState(null)
  const [editData, setEditData] = useState({})
  const [sortBy, setSortBy] = useState('dateDesc')

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

  const openEditModal = (submission) => {
    setEditingId(submission.id)
    setEditingDisplayId(submission.displayId)
    setEditData(submission.data || {})
    setEditModal(true)
  }

  const handleEditChange = (e) => {
    const { name, value } = e.target
    setEditData(prev => ({ ...prev, [name]: value }))
  }

  const saveEdit = async () => {
    try {
      const res = await fetch(`/api/submissions/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      if (!res.ok) throw new Error('Failed to update submission');
      await loadSubmissions();
      setEditModal(false);
      showModal('success', 'Update Successful', 'The submission has been updated.');
    } catch (e) {
      showModal('error', 'Update Failed', e.message);
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

  if (loading) return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '200px',
      flexDirection: 'column',
      gap: '1rem'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '4px solid #f3f4f6',
        borderTop: '4px solid var(--brand-gold)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }}></div>
      <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>Loading submissions...</p>
    </div>
  )
  if (error) return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '200px',
      flexDirection: 'column',
      gap: '1rem'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        backgroundColor: '#fef2f2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px solid #fecaca'
      }}>
        <span style={{ color: '#dc2626', fontSize: '20px', fontWeight: 'bold' }}>!</span>
      </div>
      <p style={{ margin: 0, color: '#dc2626', fontSize: '0.9rem', textAlign: 'center' }}>Error: {error}</p>
    </div>
  )

  if (!rows.length) return (
    <div style={{
      textAlign: 'center',
      padding: '60px 20px',
      backgroundColor: 'white',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
    }}>
      <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📝</div>
      <h3 style={{ margin: '0 0 10px 0', color: 'var(--brand-brown)' }}>No Submissions Yet</h3>
      <p style={{ margin: '0', color: 'var(--muted)', fontSize: '1rem' }}>
        When users submit the retiree form, their submissions will appear here.
      </p>
    </div>
  )

  // Compute display IDs and sorted rows
  const chronological = [...rows].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  const rowsWithDisplayId = chronological.map((r, index) => ({ ...r, displayId: index + 1 }))

  const sortedRows = [...rowsWithDisplayId].sort((a, b) => {
    if (sortBy === 'dateDesc') return new Date(b.createdAt) - new Date(a.createdAt)
    if (sortBy === 'dateAsc') return new Date(a.createdAt) - new Date(b.createdAt)
    if (sortBy === 'alphabetical') {
      const nameA = String(a.data?.fullName || '').toLowerCase()
      const nameB = String(b.data?.fullName || '').toLowerCase()
      return nameA.localeCompare(nameB)
    }
    if (sortBy === 'id') return a.displayId - b.displayId
    return 0
  })

  const allKeys = Array.from(
    sortedRows.reduce((set, r) => {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Submissions Dashboard</h2>
          <div style={{
            backgroundColor: 'var(--brand-gold)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '0.9rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <span>📊</span>
            <span>{rows.length} {rows.length === 1 ? 'Submission' : 'Submissions'}</span>
          </div>
        </div>
        <div className="dashboard-actions" style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          alignItems: 'center'
        }}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '14px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontWeight: '500',
              color: 'var(--brand-brown)'
            }}
          >
            <option value="dateDesc">Newest First</option>
            <option value="dateAsc">Oldest First</option>
            <option value="alphabetical">Alphabetical (A-Z)</option>
            <option value="id">By ID (Sequential)</option>
          </select>
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
            onClick={loadSubmissions}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#3b82f6'}
          >
            🔄 Refresh
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

      {/* Statistics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px',
        marginBottom: '25px'
      }}>
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📝</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--brand-brown)', marginBottom: '4px' }}>
            {rows.length}
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
            Total Submissions
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📁</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--brand-brown)', marginBottom: '4px' }}>
            {rows.reduce((total, r) => total + (r.files?.length || 0), 0)}
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
            Files Uploaded
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📅</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--brand-brown)', marginBottom: '4px' }}>
            {rows.length > 0 ? new Date(Math.max(...rows.map(r => new Date(r.createdAt).getTime()))).toLocaleDateString() : '—'}
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
            Latest Submission
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚡</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--brand-brown)', marginBottom: '4px' }}>
            {rows.length > 0 ? Math.round(rows.length / Math.max(1, Math.ceil((Date.now() - new Date(Math.min(...rows.map(r => new Date(r.createdAt).getTime()))).getTime()) / (1000 * 60 * 60 * 24)))) : 0}
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
            Avg/Day
          </div>
        </div>
      </div>

      {isMobile ? (
        // Mobile Card Layout
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {sortedRows.map(r => (
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
                  Submission #{r.displayId}
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => openEditModal(r)}
                    style={{
                      backgroundColor: '#f59e0b',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    Edit
                  </button>
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
              {sortedRows.map(r => (
                <tr key={r.id}>
                  {allKeys.map(k => {
                    if (k === 'id') return <td key={k} style={{
                      borderBottom: '1px solid #f1f5f9',
                      padding: '8px',
                      fontSize: '0.85rem'
                    }}>{r.displayId}</td>
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
                      onClick={() => openEditModal(r)}
                      style={{
                        backgroundColor: '#f59e0b',
                        color: 'white',
                        border: 'none',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        minWidth: '50px',
                        marginRight: '8px'
                      }}
                    >
                      Edit
                    </button>
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

      {editModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--brand-brown)' }}>Edit Submission #{editingDisplayId}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px', marginBottom: '20px' }}>
              {Object.keys(editData).map(key => (
                <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text)' }}>
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </span>
                  <input
                    type="text"
                    name={key}
                    value={editData[key] || ''}
                    onChange={handleEditChange}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                  />
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '30px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
              <button
                onClick={() => setEditModal(false)}
                style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontWeight: '500' }}
              >Cancel</button>
              <button
                onClick={saveEdit}
                style={{ padding: '8px 20px', background: 'var(--brand-gold)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
              >Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


