import { useState } from 'react'
import * as api from '../services/api'

export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
        {/* Logo / Brand */}
        <div style={styles.brandSection}>
          <div style={styles.logoIcon}>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
          </div>
          <h1 style={styles.brandTitle}>Alberti Technology</h1>
          <p style={styles.brandSubtitle}>Panel de Análisis Metalográfico</p>
        </div>

        {/* Divider */}
        <div style={styles.divider} />

        {/* Form */}
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
              onFocus={(e) => Object.assign(e.target.style, styles.inputFocus)}
              onBlur={(e) => Object.assign(e.target.style, { borderColor: 'var(--border)', boxShadow: 'none' })}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label} htmlFor="login-password">Contraseña</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null) }}
              placeholder="••••••••"
              style={styles.input}
              onFocus={(e) => Object.assign(e.target.style, styles.inputFocus)}
              onBlur={(e) => Object.assign(e.target.style, { borderColor: 'var(--border)', boxShadow: 'none' })}
            />
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

        {/* Footer */}
        <p style={styles.footer}>
          © 2026 Alberti Technology. Todos los derechos reservados.
        </p>
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
    maxWidth: '440px',
    background: 'white',
    borderRadius: '28px',
    border: '1px solid rgba(16, 36, 63, 0.08)',
    boxShadow: '0 22px 48px rgba(16, 36, 63, 0.12)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 36px 28px',
  },
  brandSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  logoIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #339eea, #0d5a91)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(51, 158, 234, 0.3)',
    marginBottom: '4px',
  },
  brandTitle: {
    margin: 0,
    fontSize: '1.4rem',
    fontWeight: 800,
    color: '#10243f',
    letterSpacing: '0.02em',
    textTransform: 'uppercase' as const,
  },
  brandSubtitle: {
    margin: 0,
    fontSize: '0.88rem',
    color: '#4d6684',
    fontWeight: 500,
  },
  divider: {
    width: '100%',
    height: '1px',
    background: 'rgba(16, 36, 63, 0.1)',
    margin: '24px 0',
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
    marginTop: '24px',
    fontSize: '0.78rem',
    color: '#8a99ad',
    textAlign: 'center' as const,
  },
}
