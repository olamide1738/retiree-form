import { useState } from 'react'

export default function LoginForm({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (username === 'admin' && password === 'lagosstateretirees2025') {
      onLogin(true)
      setError('')
    } else {
      setError('Invalid username or password')
    }
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '50vh',
      padding: '20px'
    }}>
      <div className="login-form-container" style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h2 style={{
          textAlign: 'center',
          marginBottom: '30px',
          color: 'var(--text)',
          fontSize: '24px',
          fontWeight: '600'
        }}>
          Dashboard Login
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: 'var(--text)',
              fontWeight: '500'
            }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '16px',
                color: 'var(--text)',
                backgroundColor: 'white',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--brand-gold)'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: 'var(--text)',
              fontWeight: '500'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '16px',
                color: 'var(--text)',
                backgroundColor: 'white',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--brand-gold)'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>

          {error && (
            <div style={{
              color: '#dc2626',
              fontSize: '14px',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

                     <button
             type="submit"
             style={{
               width: '100%',
               padding: '12px',
               backgroundColor: 'var(--brand-gold)',
               color: 'white',
               border: 'none',
               borderRadius: '8px',
               fontSize: '16px',
               fontWeight: '600',
               cursor: 'pointer',
               transition: 'background-color 0.2s',
               display: 'flex',
               justifyContent: 'center',
               alignItems: 'center'
             }}
             onMouseOver={(e) => e.target.style.backgroundColor = '#b8860b'}
             onMouseOut={(e) => e.target.style.backgroundColor = 'var(--brand-gold)'}
           >
             Login
           </button>
        </form>
      </div>
    </div>
  )
}
