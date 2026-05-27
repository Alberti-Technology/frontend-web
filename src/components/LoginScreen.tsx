import { useState, useRef } from 'react'
import * as api from '../services/api'
import altechLogo from '../../images/altech-logo-sin-fondo.svg'

export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const passwordRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Usuario y contraseña son requeridos.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await api.login(username, password)
      onLogin()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error de conexión. Verificá que el servidor esté activo.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Left Side: Form */}
        <div style={styles.leftPanel}>
          <form onSubmit={handleSubmit} style={styles.form}>
            <h2 style={styles.formTitle}>Iniciar Sesión</h2>
            <p style={styles.formDesc}>
              Ingresá tus credenciales para acceder al panel de trabajo.
            </p>

            {error && (
              <div style={styles.errorBox}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="login-username">Usuario</label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(null) }}
                placeholder="ej: diego"
                autoFocus
                style={styles.input}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    passwordRef.current?.focus()
                  }
                }}
                onFocus={(e) => Object.assign(e.target.style, styles.inputFocus)}
                onBlur={(e) => Object.assign(e.target.style, { borderColor: 'var(--border)', boxShadow: 'none' })}
              />
            </div>

            <div style={styles.fieldGroup}>
            <label htmlFor="password" style={styles.label}>Contraseña</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                ref={passwordRef}
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Ingresá tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...styles.input, paddingRight: '40px' }}
                onFocus={(e) => Object.assign(e.currentTarget.style, styles.inputFocus)}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#4d6684',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.submitBtn,
                ...(loading ? styles.submitBtnDisabled : {}),
              }}
            >
              {loading ? (
                <span style={styles.loadingContent}>
                  <span style={styles.spinner} />
                  Conectando...
                </span>
              ) : (
                'Ingresar al Panel'
              )}
            </button>
          </form>
        </div>

        {/* Vertical Divider */}
        <div style={styles.verticalDivider} />

        {/* Right Side: Brand */}
        <div style={styles.rightPanel}>
          <div style={styles.logoWrapper}>
            <img src={altechLogo} alt="Alberti Technology Logo" style={styles.bigLogo} />
          </div>
          <div style={styles.brandTextWrapper}>
            <h1 style={styles.brandName}>Alberti</h1>
            <h1 style={styles.brandNameSecondary}>Technology</h1>
          </div>
          
          <p style={styles.footer}>
            © 2026 Alberti Technology.
          </p>
        </div>
      </div>

      {/* Spinner keyframe (injected once) */}
      <style>{`
        @keyframes login-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background: 'radial-gradient(1100px 760px at 10% 8%, #d8eeff 0%, transparent 62%), radial-gradient(980px 700px at 90% 10%, #c8e6ff 0%, transparent 64%), linear-gradient(180deg, #edf8ff 0%, #dff1ff 52%, #d3ebff 100%)',
  },
  card: {
    width: '100%',
    maxWidth: '860px',
    background: 'white',
    borderRadius: '28px',
    border: '1px solid rgba(16, 36, 63, 0.08)',
    boxShadow: '0 22px 48px rgba(16, 36, 63, 0.12)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'row',
    minHeight: '480px',
  },
  leftPanel: {
    flex: 1,
    padding: '48px 40px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  rightPanel: {
    position: 'relative',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 40px',
    background: '#fafcff',
  },
  verticalDivider: {
    width: '1px',
    background: 'rgba(16, 36, 63, 0.06)',
    margin: '36px 0',
  },
  logoWrapper: {
    width: '110px',
    height: '110px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  bigLogo: {
    width: '90px',
    height: 'auto',
  },
  brandTextWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  brandName: {
    margin: 0,
    fontSize: '2.5rem',
    fontWeight: 300,
    color: '#339eea',
    letterSpacing: '-0.02em',
    lineHeight: 1,
  },
  brandNameSecondary: {
    margin: 0,
    fontSize: '2.5rem',
    fontWeight: 800,
    color: '#10243f',
    letterSpacing: '-0.02em',
    lineHeight: 1,
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formTitle: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#339eea',
  },
  formDesc: {
    margin: 0,
    fontSize: '0.9rem',
    color: '#4d6684',
    lineHeight: 1.5,
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    background: '#fff5f5',
    border: '1px solid #fed7d7',
    borderRadius: '12px',
    color: '#e53e3e',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#10243f',
  },
  input: {
    padding: '12px 16px',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    fontFamily: 'inherit',
    fontSize: '1rem',
    color: '#10243f',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  inputFocus: {
    borderColor: '#339eea',
    boxShadow: '0 0 0 3px rgba(51, 158, 234, 0.15)',
  },
  submitBtn: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #339eea, #0d5a91)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontWeight: 700,
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    marginTop: '8px',
  },
  submitBtnDisabled: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  loadingContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  spinner: {
    display: 'inline-block',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '2px solid rgba(255, 255, 255, 0.35)',
    borderTopColor: '#fff',
    animation: 'login-spin 0.9s linear infinite',
  },
  footer: {
    position: 'absolute',
    bottom: '32px',
    margin: 0,
    fontSize: '0.78rem',
    color: '#8a99ad',
    textAlign: 'center' as const,
  },
}
