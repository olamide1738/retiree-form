import { useEffect, useState, useRef } from 'react'
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
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const fileInputRef = useRef(null)
  const [restoreFile, setRestoreFile] = useState(null)

  // Merge Backups state
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [mergeFiles, setMergeFiles] = useState([])
  const [deduplicateMerge, setDeduplicateMerge] = useState(false)
  const [isMerging, setIsMerging] = useState(false)
  const [isRestoringMerged, setIsRestoringMerged] = useState(false)
  const [confirmRestoreMerged, setConfirmRestoreMerged] = useState(false)
  const mergeFileInputRef = useRef(null)

  // Restore Progress and Error state
  const [restoreProgress, setRestoreProgress] = useState({
    active: false,
    percent: 0,
    stage: '',
    detail: '',
    error: null
  })

  // Loading states for actions
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  const loadSubmissions = async (showGlobalSpinner = true) => {
    try {
      if (showGlobalSpinner) setLoading(true)
      const res = await fetch('/api/submissions')
      if (!res.ok) throw new Error('Failed to load submissions')
      const json = await res.json()
      setRows(json)
    } catch (e) {
      setError(e.message)
    } finally {
      if (showGlobalSpinner) setLoading(false)
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

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/submissions?id=${confirmDeleteId}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete submission')
      await loadSubmissions(false) // Reload silently
      setConfirmDeleteId(null)
      showModal('success', 'Submission Deleted', 'The submission has been successfully deleted.')
    } catch (e) {
      setConfirmDeleteId(null)
      showModal('error', 'Delete Failed', 'Error deleting submission: ' + e.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const deleteSubmission = (id) => {
    setConfirmDeleteId(id)
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
    setIsSaving(true)
    try {
      const res = await fetch(`/api/submissions?id=${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      if (!res.ok) throw new Error('Failed to update submission');
      await loadSubmissions(false); // Reload silently
      setEditModal(false);
      showModal('success', 'Update Successful', 'The submission has been updated.');
    } catch (e) {
      showModal('error', 'Update Failed', e.message);
    } finally {
      setIsSaving(false)
    }
  }

  const confirmClearAllSubmissions = async () => {
    setIsClearing(true)
    try {
      const res = await fetch('/api/submissions', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to clear submissions')
      await loadSubmissions(false) // Reload silently
      setConfirmClearAll(false)
      showModal('success', 'All Submissions Cleared', 'All submissions have been successfully cleared.')
    } catch (e) {
      setConfirmClearAll(false)
      showModal('error', 'Clear Failed', 'Error clearing submissions: ' + e.message)
    } finally {
      setIsClearing(false)
    }
  }

  const clearAllSubmissions = () => {
    setConfirmClearAll(true)
  }

  const handleRestoreClick = () => {
    if (fileInputRef.current) fileInputRef.current.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) setRestoreFile(file)
    e.target.value = ''
  }

  const confirmRestore = () => {
    if (!restoreFile) return
    const fileToRestore = restoreFile
    setRestoreFile(null)

    setRestoreProgress({
      active: true,
      percent: 15,
      stage: 'Reading Backup File',
      detail: `Reading "${fileToRestore.name}" (${(fileToRestore.size / 1024).toFixed(1)} KB)...`,
      error: null
    })

    const reader = new FileReader()

    reader.onerror = () => {
      setRestoreProgress(prev => ({
        ...prev,
        percent: 100,
        stage: 'Read Failed',
        detail: 'Failed to read file from disk. The file may be corrupt or inaccessible.',
        error: 'Failed to read file from disk.'
      }))
    }

    reader.onload = async (e) => {
      try {
        setRestoreProgress(prev => ({
          ...prev,
          percent: 35,
          stage: 'Validating & Parsing Data',
          detail: 'Parsing JSON structure and validating records...'
        }))

        let parsed
        try {
          parsed = JSON.parse(e.target.result)
        } catch (jsonErr) {
          throw new Error(`Invalid JSON syntax in backup file: ${jsonErr.message}`)
        }

        let submissions = []
        let files = []

        if (Array.isArray(parsed)) {
          submissions = parsed
        } else if (parsed && typeof parsed === 'object') {
          submissions = Array.isArray(parsed.submissions) ? parsed.submissions : []
          files = Array.isArray(parsed.files) ? parsed.files : []
        } else {
          throw new Error('Unrecognized backup format: File does not contain valid submissions.')
        }

        if (submissions.length === 0 && files.length === 0) {
          throw new Error('Backup file contains 0 submissions and 0 files.')
        }

        const normalizedSubmissions = submissions.map((sub, index) => ({
          id: sub.id !== undefined ? sub.id : index + 1,
          created_at: sub.created_at || sub.createdAt || new Date().toISOString(),
          data_json: sub.data_json !== undefined
            ? (typeof sub.data_json === 'string' ? sub.data_json : JSON.stringify(sub.data_json))
            : (sub.data !== undefined ? (typeof sub.data === 'string' ? sub.data : JSON.stringify(sub.data)) : JSON.stringify(sub))
        }))

        const payload = {
          version: parsed.version || '1.0',
          timestamp: parsed.timestamp || new Date().toISOString(),
          submissions: normalizedSubmissions,
          files: files
        }

        const payloadString = JSON.stringify(payload)
        const payloadSizeMB = (new Blob([payloadString]).size / (1024 * 1024)).toFixed(2)

        setRestoreProgress(prev => ({
          ...prev,
          percent: 65,
          stage: 'Restoring Database Records',
          detail: `Transmitting ${normalizedSubmissions.length} submissions and ${files.length} attached documents (${payloadSizeMB} MB)...`
        }))

        const res = await fetch('/api/submissions/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payloadString
        })

        if (!res.ok) {
          let errorMsg = `Server error ${res.status}: ${res.statusText}`
          try {
            const errData = await res.json()
            if (errData.error || errData.details) {
              errorMsg = `${errData.error || 'Restore failed'}${errData.details ? `: ${errData.details}` : ''}`
            }
          } catch (parseErr) {
            if (res.status === 413) {
              errorMsg = `Backup payload is too large (${payloadSizeMB} MB) for the serverless function limit.`
            } else if (res.status === 504) {
              errorMsg = 'Database connection timed out during restore.'
            }
          }
          throw new Error(errorMsg)
        }

        setRestoreProgress(prev => ({
          ...prev,
          percent: 90,
          stage: 'Refreshing Dashboard View',
          detail: 'Database restore committed. Reloading live records...'
        }))

        await loadSubmissions(false) // Reload silently

        setRestoreProgress(prev => ({
          ...prev,
          percent: 100,
          stage: 'Restore Completed Successfully!',
          detail: `Successfully restored ${normalizedSubmissions.length} submissions and ${files.length} attached files into the database.`,
          error: null
        }))

        setTimeout(() => {
          setRestoreProgress(prev => prev.error ? prev : { ...prev, active: false })
          showModal('success', 'Restore Successful', `The database has been successfully restored (${normalizedSubmissions.length} submissions restored).`)
        }, 1200)

      } catch (err) {
        setRestoreProgress(prev => ({
          ...prev,
          percent: 100,
          stage: 'Restore Failed',
          detail: err.message,
          error: err.message
        }))
      }
    }
    reader.readAsText(fileToRestore)
  }

  const handleMergeFilesSelect = (e) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length === 0) return

    selectedFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result)
          let submissions = []
          let files = []

          if (Array.isArray(parsed)) {
            submissions = parsed
          } else if (parsed && typeof parsed === 'object') {
            submissions = Array.isArray(parsed.submissions) ? parsed.submissions : []
            files = Array.isArray(parsed.files) ? parsed.files : []
          }

          setMergeFiles(prev => {
            const exists = prev.some(f => f.name === file.name && f.size === file.size)
            if (exists) return prev
            return [
              ...prev,
              {
                id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                name: file.name,
                size: file.size,
                submissions,
                files,
                timestamp: parsed.timestamp || null,
                version: parsed.version || '1.0'
              }
            ]
          })
        } catch (err) {
          setMergeFiles(prev => [
            ...prev,
            {
              id: `${file.name}-${file.size}-${Date.now()}`,
              name: file.name,
              size: file.size,
              error: 'Invalid JSON backup file: ' + err.message
            }
          ])
        }
      }
      reader.readAsText(file)
    })

    e.target.value = ''
  }

  const removeMergeFile = (id) => {
    setMergeFiles(prev => prev.filter(f => f.id !== id))
  }

  const clearMergeFiles = () => {
    setMergeFiles([])
  }

  const computeMergedData = (filesList, deduplicate = false) => {
    const validFiles = filesList.filter(f => !f.error && Array.isArray(f.submissions))
    const mergedSubmissions = []
    const mergedFiles = []
    let subCounter = 1
    let fileCounter = 1
    const seenSubmissions = new Set()

    validFiles.forEach(fileObj => {
      const idMap = new Map()

      fileObj.submissions.forEach(sub => {
        let subData = sub.data_json
        if (typeof subData === 'string') {
          try { subData = JSON.parse(subData) } catch (e) { }
        }

        if (deduplicate && subData && typeof subData === 'object') {
          const dedupeKey = `${(subData.fullName || '').toLowerCase().trim()}_${(subData.phoneNumber || subData.pensionNumber || subData.emailAddress || '').trim()}`
          if (dedupeKey && dedupeKey !== '_' && seenSubmissions.has(dedupeKey)) {
            return
          }
          if (dedupeKey && dedupeKey !== '_') {
            seenSubmissions.add(dedupeKey)
          }
        }

        const newSubId = subCounter++
        idMap.set(sub.id, newSubId)

        mergedSubmissions.push({
          id: newSubId,
          created_at: sub.created_at || new Date().toISOString(),
          data_json: typeof sub.data_json === 'string' ? sub.data_json : JSON.stringify(sub.data_json)
        })
      })

      if (Array.isArray(fileObj.files)) {
        fileObj.files.forEach(f => {
          const mappedSubId = idMap.get(f.submission_id)
          if (mappedSubId) {
            const newFileId = fileCounter++
            mergedFiles.push({
              id: newFileId,
              submission_id: mappedSubId,
              field_name: f.field_name,
              original_name: f.original_name,
              stored_path: f.stored_path
            })
          }
        })
      }
    })

    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      merged_sources_count: validFiles.length,
      source_files: validFiles.map(f => f.name),
      submissions: mergedSubmissions,
      files: mergedFiles
    }
  }

  const downloadMergedBackup = () => {
    setIsMerging(true)
    try {
      const merged = computeMergedData(mergeFiles, deduplicateMerge)
      if (merged.submissions.length === 0) {
        showModal('error', 'Merge Failed', 'No valid submissions found to merge.')
        return
      }

      const jsonStr = JSON.stringify(merged, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const dateStr = new Date().toISOString().slice(0, 10)
      a.download = `retiree-db-backup-merged-${dateStr}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      showModal(
        'success',
        'Merged Backup Created!',
        `Successfully merged ${mergeFiles.filter(f => !f.error).length} backup files into 1 backup containing ${merged.submissions.length} submissions and ${merged.files.length} attached documents.`
      )
    } catch (err) {
      showModal('error', 'Merge Failed', err.message)
    } finally {
      setIsMerging(false)
    }
  }

  const executeRestoreMerged = async () => {
    setConfirmRestoreMerged(false)
    setMergeModalOpen(false)

    setRestoreProgress({
      active: true,
      percent: 20,
      stage: 'Preparing Merged Dataset',
      detail: 'Consolidating and validating backup files...',
      error: null
    })

    try {
      const merged = computeMergedData(mergeFiles, deduplicateMerge)
      if (merged.submissions.length === 0) {
        throw new Error('No valid submissions found to restore across selected files.')
      }

      const payloadString = JSON.stringify(merged)
      const payloadSizeMB = (new Blob([payloadString]).size / (1024 * 1024)).toFixed(2)

      setRestoreProgress(prev => ({
        ...prev,
        percent: 60,
        stage: 'Restoring Database Records',
        detail: `Transmitting ${merged.submissions.length} merged submissions and ${merged.files.length} attached documents (${payloadSizeMB} MB)...`
      }))

      const res = await fetch('/api/submissions/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadString
      })

      if (!res.ok) {
        let errorMsg = `Server error ${res.status}: ${res.statusText}`
        try {
          const errData = await res.json()
          if (errData.error || errData.details) {
            errorMsg = `${errData.error || 'Restore failed'}${errData.details ? `: ${errData.details}` : ''}`
          }
        } catch (parseErr) {
          if (res.status === 413) {
            errorMsg = `Merged backup payload is too large (${payloadSizeMB} MB) for the serverless limit.`
          } else if (res.status === 504) {
            errorMsg = 'Database connection timed out during restore.'
          }
        }
        throw new Error(errorMsg)
      }

      setRestoreProgress(prev => ({
        ...prev,
        percent: 90,
        stage: 'Refreshing Dashboard View',
        detail: 'Database restore committed. Updating submissions view...'
      }))

      await loadSubmissions(false)
      clearMergeFiles()

      setRestoreProgress(prev => ({
        ...prev,
        percent: 100,
        stage: 'Merged Restore Completed!',
        detail: `Successfully restored ${merged.submissions.length} submissions and ${merged.files.length} attached files into the database.`,
        error: null
      }))

      setTimeout(() => {
        setRestoreProgress(prev => prev.error ? prev : { ...prev, active: false })
        showModal(
          'success',
          'Database Restored with Merged Data!',
          `Successfully restored ${merged.submissions.length} submissions and ${merged.files.length} attached files into the database.`
        )
      }, 1200)

    } catch (err) {
      setRestoreProgress(prev => ({
        ...prev,
        percent: 100,
        stage: 'Restore Failed',
        detail: err.message,
        error: err.message
      }))
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
          <button
            onClick={handleRestoreClick}
            style={{
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '500'
            }}
          >
            ⬆️ Restore Backup
          </button>
          <input
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <button
            onClick={() => setMergeModalOpen(true)}
            style={{
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '500'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#7c3aed'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#8b5cf6'}
          >
            🔀 Merge Backups
          </button>
          <input
            type="file"
            accept=".json"
            multiple
            style={{ display: 'none' }}
            ref={mergeFileInputRef}
            onChange={handleMergeFilesSelect}
          />
          <a
            href="/api/submissions/backup"
            target="_blank"
            rel="noreferrer"
            style={{
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '500'
            }}
          >
            💾 Download Backup
          </a>
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

      {!rows.length ? (
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
      ) : isMobile ? (
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
                disabled={isSaving}
                style={{ opacity: isSaving ? 0.7 : 1, padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'transparent', cursor: isSaving ? 'not-allowed' : 'pointer', fontWeight: '500' }}
              >Cancel</button>
              <button
                onClick={saveEdit}
                disabled={isSaving}
                style={{ opacity: isSaving ? 0.8 : 1, padding: '8px 20px', background: 'var(--brand-gold)', color: 'white', border: 'none', borderRadius: '6px', cursor: isSaving ? 'not-allowed' : 'pointer', fontWeight: '600' }}
              >{isSaving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Submission Modal */}
      {confirmDeleteId && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>⚠️</div>
            <h3 style={{ marginTop: 0, color: 'var(--brand-brown)', marginBottom: '10px' }}>Confirm Deletion</h3>
            <p style={{ color: 'var(--text)', marginBottom: '25px', lineHeight: '1.5' }}>Are you sure you want to delete this submission? This action cannot be undone.</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={isDeleting}
                style={{ opacity: isDeleting ? 0.7 : 1, padding: '8px 20px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'transparent', cursor: isDeleting ? 'not-allowed' : 'pointer', fontWeight: '500' }}
              >Cancel</button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                style={{ opacity: isDeleting ? 0.8 : 1, padding: '8px 20px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: isDeleting ? 'not-allowed' : 'pointer', fontWeight: '600' }}
              >{isDeleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Submissions Modal */}
      {confirmClearAll && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🚨</div>
            <h3 style={{ marginTop: 0, color: '#dc2626', marginBottom: '10px' }}>Clear All Submissions</h3>
            <p style={{ color: 'var(--text)', marginBottom: '25px', lineHeight: '1.5' }}>Are you sure you want to PERMANENTLY delete ALL submissions and files? This action cannot be undone.</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                onClick={() => setConfirmClearAll(false)}
                disabled={isClearing}
                style={{ opacity: isClearing ? 0.7 : 1, padding: '8px 20px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'transparent', cursor: isClearing ? 'not-allowed' : 'pointer', fontWeight: '500' }}
              >Cancel</button>
              <button
                onClick={confirmClearAllSubmissions}
                disabled={isClearing}
                style={{ opacity: isClearing ? 0.8 : 1, padding: '8px 20px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: isClearing ? 'not-allowed' : 'pointer', fontWeight: '600' }}
              >{isClearing ? 'Deleting All...' : 'Delete All'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Backup Modal */}
      {restoreFile && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>⚠️</div>
            <h3 style={{ marginTop: 0, color: '#dc2626', marginBottom: '10px' }}>Confirm Restore</h3>
            <p style={{ color: 'var(--text)', marginBottom: '25px', lineHeight: '1.5' }}>
              Are you sure you want to restore from <strong>{restoreFile.name}</strong>?<br /><br />This will permanently wipe all current data and replace it entirely with the backup contents!
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                onClick={() => {
                  setRestoreFile(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                disabled={isRestoring}
                style={{ opacity: isRestoring ? 0.7 : 1, padding: '8px 20px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'transparent', cursor: isRestoring ? 'not-allowed' : 'pointer', fontWeight: '500' }}
              >Cancel</button>
              <button
                onClick={confirmRestore}
                disabled={isRestoring}
                style={{ opacity: isRestoring ? 0.8 : 1, padding: '8px 20px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: isRestoring ? 'not-allowed' : 'pointer', fontWeight: '600' }}
              >{isRestoring ? 'Restoring Database...' : 'Overwrite Database'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Backups Modal */}
      {mergeModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.5rem' }}>🔀</span>
                <h3 style={{ margin: 0, color: 'var(--brand-brown)', fontSize: '1.25rem' }}>Merge JSON Backups</h3>
              </div>
              <button
                onClick={() => setMergeModalOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}
              >✕</button>
            </div>

            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem', lineHeight: '1.4' }}>
              Combine multiple backup files (.json) into a single consolidated backup. Submissions and their document attachments will have their identifiers cleanly remapped without conflicts.
            </p>

            {/* Drop Zone / File Picker Trigger */}
            <div
              onClick={() => mergeFileInputRef.current && mergeFileInputRef.current.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleMergeFilesSelect({ target: { files: e.dataTransfer.files } });
                }
              }}
              style={{
                border: '2px dashed #8b5cf6',
                borderRadius: '8px',
                padding: '24px 16px',
                textAlign: 'center',
                backgroundColor: '#f5f3ff',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📂</div>
              <div style={{ fontWeight: '600', color: '#6d28d9', marginBottom: '4px' }}>
                Click to select JSON backup files or drag & drop them here
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                Select 2 or more .json backup files (multiple selection supported)
              </div>
            </div>

            {/* Selected files list */}
            {mergeFiles.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--brand-brown)' }}>
                    Selected Backup Files ({mergeFiles.length})
                  </span>
                  <button
                    onClick={clearMergeFiles}
                    style={{ background: 'transparent', border: 'none', color: '#dc2626', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Remove All
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                  {mergeFiles.map(file => (
                    <div key={file.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      backgroundColor: file.error ? '#fef2f2' : '#f8fafc',
                      border: file.error ? '1px solid #fecaca' : '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '0.85rem'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', marginRight: '8px' }}>
                        <div style={{ fontWeight: '600', color: file.error ? '#dc2626' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {file.name}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                          {(file.size / 1024).toFixed(1)} KB {file.error ? `• ${file.error}` : `• ${file.submissions?.length || 0} submissions • ${file.files?.length || 0} files`}
                        </div>
                      </div>
                      <button
                        onClick={() => removeMergeFile(file.id)}
                        style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }}
                        title="Remove file"
                      >✕</button>
                    </div>
                  ))}
                </div>

                {/* Summary Box */}
                {(() => {
                  const preview = computeMergedData(mergeFiles, deduplicateMerge)
                  return (
                    <div style={{
                      backgroundColor: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      marginTop: '4px',
                      display: 'flex',
                      justifyContent: 'space-around',
                      alignItems: 'center',
                      textAlign: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#065f46' }}>
                          {mergeFiles.filter(f => !f.error).length}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#047857' }}>Valid Backups</div>
                      </div>
                      <div style={{ width: '1px', height: '30px', backgroundColor: '#a7f3d0' }}></div>
                      <div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#065f46' }}>
                          {preview.submissions.length}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#047857' }}>Total Submissions</div>
                      </div>
                      <div style={{ width: '1px', height: '30px', backgroundColor: '#a7f3d0' }}></div>
                      <div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#065f46' }}>
                          {preview.files.length}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#047857' }}>Attached Files</div>
                      </div>
                    </div>
                  )
                })()}

                {/* Merge Options */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text)' }}>
                  <input
                    type="checkbox"
                    checked={deduplicateMerge}
                    onChange={(e) => setDeduplicateMerge(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Deduplicate matching submissions (identifies duplicate full name & contact details)</span>
                </label>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '8px', flexWrap: 'wrap', gap: '10px' }}>
              <button
                onClick={() => setMergeModalOpen(false)}
                style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontWeight: '500', fontSize: '14px' }}
              >
                Close
              </button>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={downloadMergedBackup}
                  disabled={isMerging || mergeFiles.filter(f => !f.error).length === 0}
                  style={{
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: (isMerging || mergeFiles.filter(f => !f.error).length === 0) ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    opacity: (isMerging || mergeFiles.filter(f => !f.error).length === 0) ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>📥</span>
                  <span>{isMerging ? 'Merging...' : 'Download Merged Backup'}</span>
                </button>

                <button
                  onClick={() => setConfirmRestoreMerged(true)}
                  disabled={isRestoringMerged || mergeFiles.filter(f => !f.error).length === 0}
                  style={{
                    backgroundColor: '#8b5cf6',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: (isRestoringMerged || mergeFiles.filter(f => !f.error).length === 0) ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    opacity: (isRestoringMerged || mergeFiles.filter(f => !f.error).length === 0) ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>🚀</span>
                  <span>Restore Directly to DB</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Restore Merged Modal */}
      {confirmRestoreMerged && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '420px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>⚠️</div>
            <h3 style={{ marginTop: 0, color: '#dc2626', marginBottom: '10px' }}>Confirm Database Overwrite</h3>
            <p style={{ color: 'var(--text)', marginBottom: '20px', lineHeight: '1.5', fontSize: '0.9rem' }}>
              Restoring this merged backup will <strong>replace all existing database records</strong> with the merged content from <strong>{mergeFiles.filter(f => !f.error).length} backup files</strong>.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                onClick={() => setConfirmRestoreMerged(false)}
                disabled={isRestoringMerged}
                style={{ opacity: isRestoringMerged ? 0.7 : 1, padding: '8px 20px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'transparent', cursor: isRestoringMerged ? 'not-allowed' : 'pointer', fontWeight: '500' }}
              >Cancel</button>
              <button
                onClick={executeRestoreMerged}
                disabled={isRestoringMerged}
                style={{ opacity: isRestoringMerged ? 0.8 : 1, padding: '8px 20px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: isRestoringMerged ? 'not-allowed' : 'pointer', fontWeight: '600' }}
              >{isRestoringMerged ? 'Restoring...' : 'Yes, Overwrite & Restore'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Progress & Error Alert Modal */}
      {restoreProgress.active && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: '20px',
          backdropFilter: 'blur(3px)'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '28px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            border: restoreProgress.error ? '2px solid #ef4444' : '1px solid #e2e8f0'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: restoreProgress.error ? '#fef2f2' : (restoreProgress.percent === 100 ? '#ecfdf5' : '#eff6ff'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.6rem',
                flexShrink: 0
              }}>
                {restoreProgress.error ? '⚠️' : (restoreProgress.percent === 100 ? '✅' : '⏳')}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <h3 style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  color: restoreProgress.error ? '#dc2626' : 'var(--brand-brown)',
                  fontWeight: '700'
                }}>
                  {restoreProgress.error ? 'Restore Problem Encountered' : restoreProgress.stage}
                </h3>
                <div style={{
                  color: '#64748b',
                  fontSize: '0.85rem',
                  marginTop: '3px'
                }}>
                  {restoreProgress.error ? 'An error interrupted the database restore process.' : `Status: ${restoreProgress.percent}% completed`}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{
              width: '100%',
              backgroundColor: '#f1f5f9',
              height: '10px',
              borderRadius: '5px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${restoreProgress.percent}%`,
                backgroundColor: restoreProgress.error ? '#ef4444' : (restoreProgress.percent === 100 ? '#10b981' : '#8b5cf6'),
                transition: 'width 0.4s ease-in-out',
                borderRadius: '5px'
              }}></div>
            </div>

            {/* Detail message or Error Box */}
            {restoreProgress.error ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  color: '#991b1b',
                  fontSize: '0.9rem',
                  lineHeight: '1.45',
                  wordBreak: 'break-word',
                  fontFamily: 'monospace'
                }}>
                  <strong>Error details:</strong><br />
                  {restoreProgress.detail}
                </div>

                <div style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  fontSize: '0.8rem',
                  color: '#475569',
                  lineHeight: '1.4'
                }}>
                  <strong style={{ color: '#1e293b' }}>Troubleshooting Suggestions:</strong>
                  <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                    <li>Ensure the uploaded JSON file is a valid backup created by this system.</li>
                    <li>If the backup contains very large base64 attachments, serverless payload limits (4.5 MB) may be exceeded.</li>
                    <li>Verify your database connection in your environment settings.</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '0.85rem',
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '1.1rem' }}>ℹ️</span>
                <span>{restoreProgress.detail}</span>
              </div>
            )}

            {/* Action buttons on error */}
            {restoreProgress.error && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  onClick={() => setRestoreProgress(prev => ({ ...prev, active: false, error: null }))}
                  style={{
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                    padding: '9px 20px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#b91c1c'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#dc2626'}
                >
                  Dismiss Alert
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
