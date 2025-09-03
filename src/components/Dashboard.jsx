import { useEffect, useState } from 'react'

export default function Dashboard() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('http://localhost:4000/api/submissions')
        if (!res.ok) throw new Error('Failed to load submissions')
        const json = await res.json()
        setRows(json)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <p>Loading submissions...</p>
  if (error) return <p>Error: {error}</p>

  if (!rows.length) return <p>No submissions yet.</p>

  const allKeys = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r.data || {}).forEach(k => set.add(k))
      return set
    }, new Set(['id', 'createdAt', 'files']))
  )

  return (
    <div>
      <h2>Submissions Dashboard</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {allKeys.map(k => (
                <th key={k} style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: '8px' }}>{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                {allKeys.map(k => {
                  if (k === 'id') return <td key={k} style={{ borderBottom: '1px solid #f1f5f9', padding: '8px' }}>{r.id}</td>
                  if (k === 'createdAt') {
                    const dateOnly = (() => {
                      const d = new Date(r.createdAt)
                      return isNaN(d.getTime()) ? String(r.createdAt) : d.toISOString().slice(0, 10)
                    })()
                    return <td key={k} style={{ borderBottom: '1px solid #f1f5f9', padding: '8px' }}>{dateOnly}</td>
                  }
                  if (k === 'files') {
                    return (
                      <td key={k} style={{ borderBottom: '1px solid #f1f5f9', padding: '8px' }}>
                        {Array.isArray(r.files) && r.files.length ? (
                          <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                            {r.files.map(f => (
                              <li key={f.id}>
                                <a className="file-link" href={`http://localhost:4000/api/files/${f.id}`} target="_blank" rel="noreferrer">
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
                  return <td key={k} style={{ borderBottom: '1px solid #f1f5f9', padding: '8px', verticalAlign: 'top' }}>{String(value)}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


