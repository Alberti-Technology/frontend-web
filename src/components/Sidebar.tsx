import { useState } from 'react'
import altechLogo from '../../images/altech-logo-sin-fondo.svg'

interface SidebarProps {
  onLogoutConfirm: () => void;
}

export default function Sidebar({ onLogoutConfirm }: SidebarProps) {
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  return (
    <>
      <div style={styles.sidebar}>
        {/* Top: Brand Button */}
        <a 
          href="https://alberti-technology.vercel.app/metalurgia" 
          target="_blank" 
          rel="noopener noreferrer"
          style={styles.brandBtn}
          title="Alberti Technology"
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.btnHover)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, styles.btnNormal)}
        >
          <img src={altechLogo} alt="Alberti Technology" style={{ width: '60%', height: 'auto', minWidth: '16px' }} />
        </a>

        {/* Bottom: Logout Button */}
        <button 
          onClick={() => setShowLogoutModal(true)}
          style={styles.logoutBtn}
          title="Cerrar sesión"
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.logoutHover)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, styles.logoutNormal)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </div>

      {/* Logout Modal */}
      {showLogoutModal && (
        <div style={styles.modalOverlay} onClick={() => setShowLogoutModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Cerrar sesión</h3>
              <button 
                style={styles.closeBtn} 
                onClick={() => setShowLogoutModal(false)}
                onMouseEnter={(e) => Object.assign(e.currentTarget.style, { background: 'var(--bg-accent)' })}
                onMouseLeave={(e) => Object.assign(e.currentTarget.style, { background: 'transparent' })}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div style={styles.modalBody}>
              <p style={{ margin: 0, color: '#4d6684', fontSize: '0.95rem' }}>
                ¿Deseas cerrar tu sesión actual?
              </p>
            </div>
            <div style={styles.modalActions}>
              <button 
                style={styles.btnSecondary} 
                onClick={() => setShowLogoutModal(false)}
                onMouseEnter={(e) => Object.assign(e.currentTarget.style, { background: '#eef8ff' })}
                onMouseLeave={(e) => Object.assign(e.currentTarget.style, { background: '#f8fbff' })}
              >
                Cancelar
              </button>
              <button 
                style={styles.btnPrimary} 
                onClick={() => {
                  setShowLogoutModal(false);
                  onLogoutConfirm();
                }}
                onMouseEnter={(e) => Object.assign(e.currentTarget.style, { opacity: 0.92 })}
                onMouseLeave={(e) => Object.assign(e.currentTarget.style, { opacity: 1 })}
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 4px 16px rgba(16, 36, 63, 0.08)',
    border: '1px solid rgba(16, 36, 63, 0.14)',
    borderBottom: '5px solid #339eea',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 0',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
  },
  brandBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: '42px',
    aspectRatio: '1 / 1',
    height: 'auto',
    borderRadius: '12px',
    background: 'transparent',
    border: 'none',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  },
  btnHover: {
    transform: 'translateY(-2px)',
    boxShadow: '0 6px 16px rgba(51, 158, 234, 0.4)',
  },
  btnNormal: {
    transform: 'none',
    boxShadow: '0 4px 12px rgba(51, 158, 234, 0.3)',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    background: 'transparent',
    color: '#e53e3e',
    border: 'none',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  },
  logoutHover: {
    background: '#fff5f5',
    transform: 'translateY(-2px)',
  },
  logoutNormal: {
    background: 'transparent',
    transform: 'none',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: 'rgba(16, 36, 63, 0.4)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  modalContent: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow)',
    overflow: 'hidden',
    width: '100%',
    maxWidth: '420px',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 28px 12px',
    borderBottom: '1px solid var(--border)',
  },
  modalTitle: {
    margin: 0,
    color: 'var(--primary-strong)',
    fontSize: '1.12rem',
    fontWeight: 700,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--muted)',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  modalBody: {
    padding: '20px 28px 8px',
  },
  modalActions: {
    padding: '16px 28px 24px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
  },
  btnSecondary: {
    border: '1px solid rgba(16, 36, 63, 0.1)',
    borderRadius: '12px',
    padding: '8px 14px',
    fontWeight: 700,
    fontSize: '0.85rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    background: '#f8fbff',
    color: '#4d6684',
  },
  btnPrimary: {
    border: 'none',
    borderRadius: '12px',
    padding: '8px 14px',
    fontWeight: 700,
    fontSize: '0.85rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    color: '#fff',
    background: 'linear-gradient(135deg, #339eea, #0d5a91)',
  }
}
