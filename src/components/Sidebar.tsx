import { useState } from 'react'
import altechLogo from '../../images/altech-logo-sin-fondo.svg'
import packageJson from '../../package.json'

interface SidebarProps {
  onLogoutConfirm: () => void;
  showAdmin: boolean;
  onToggleAdmin: () => void;
  showGallery: boolean;
  onToggleGallery: () => void;
  showReports: boolean;
  onToggleReports: () => void;
  showAssistant: boolean;
  onToggleAssistant: () => void;
}

export default function Sidebar({ 
  onLogoutConfirm, 
  showAdmin, onToggleAdmin,
  showGallery, onToggleGallery,
  showReports, onToggleReports,
  showAssistant, onToggleAssistant
}: SidebarProps) {
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  const [showAboutModal, setShowAboutModal] = useState(false)

  return (
    <>
      <div style={styles.sidebar}>
        {/* Top: Brand Button */}
        <button 
          onClick={() => setShowAboutModal(true)}
          style={styles.brandBtn}
          title="Alberti Technology"
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.btnHover)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, styles.btnNormal)}
        >
          <img src={altechLogo} alt="Alberti Technology" style={{ width: '60%', height: 'auto', minWidth: '16px' }} />
        </button>

        {/* Middle Buttons */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
          {/* Admin Button */}
          <button 
            onClick={onToggleAdmin}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: showAdmin ? '#eef8ff' : 'transparent',
              color: '#339eea',
              border: 'none',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
              boxShadow: showAdmin ? 'inset 0 2px 4px rgba(0,0,0,0.05)' : 'none'
            }}
            title="Administrador"
            onMouseEnter={(e) => {
              if (!showAdmin) e.currentTarget.style.background = '#eef8ff';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              if (!showAdmin) e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
          </button>

          {/* Gallery Button */}
          <button 
            onClick={onToggleGallery}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: showGallery ? '#eef8ff' : 'transparent',
              color: '#339eea',
              border: 'none',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
              boxShadow: showGallery ? 'inset 0 2px 4px rgba(0,0,0,0.05)' : 'none'
            }}
            title="Galería"
            onMouseEnter={(e) => {
              if (!showGallery) e.currentTarget.style.background = '#eef8ff';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              if (!showGallery) e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </button>

          {/* Reports Button */}
          <button 
            onClick={onToggleReports}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: showReports ? '#eef8ff' : 'transparent',
              color: '#339eea',
              border: 'none',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
              boxShadow: showReports ? 'inset 0 2px 4px rgba(0,0,0,0.05)' : 'none'
            }}
            title="Informes"
            onMouseEnter={(e) => {
              if (!showReports) e.currentTarget.style.background = '#eef8ff';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              if (!showReports) e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </button>

          {/* Assistant Button */}
          <button 
            onClick={onToggleAssistant}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: showAssistant ? '#eef8ff' : 'transparent',
              color: '#339eea',
              border: 'none',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
              boxShadow: showAssistant ? 'inset 0 2px 4px rgba(0,0,0,0.05)' : 'none'
            }}
            title="Chat Asistente"
            onMouseEnter={(e) => {
              if (!showAssistant) e.currentTarget.style.background = '#eef8ff';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              if (!showAssistant) e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </button>

          {/* Info/Legend Button */}
        <div>

        </div>
        </div>

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

      {/* About Modal */}
      {showAboutModal && (
        <div style={styles.modalOverlay} onClick={() => setShowAboutModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Acerca de MIA</h3>
              <button 
                style={styles.closeBtn} 
                onClick={() => setShowAboutModal(false)}
                onMouseEnter={(e) => Object.assign(e.currentTarget.style, { background: 'var(--bg-accent)' })}
                onMouseLeave={(e) => Object.assign(e.currentTarget.style, { background: 'transparent' })}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div style={{ ...styles.modalBody, padding: '36px 28px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
              
              {/* Logo */}
              <div style={{ width: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0 16px' }}>
                <img src={altechLogo} alt="Alberti Technology" style={{ width: '100%', height: 'auto' }} />
              </div>

              {/* Version */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.95rem', color: '#4d6684', fontWeight: 500 }}>
                  Versión de la aplicación: <span style={{ background: '#eef8ff', color: '#339eea', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>{packageJson.version}</span>
                </div>
              </div>

              <div style={{ height: '1px', width: '100%', background: 'var(--border)' }}></div>

              {/* Powered By */}
              <div style={{ 
                textAlign: 'center', 
                fontSize: '0.95rem',
                marginTop: '8px',
                padding: '12px 24px',
                background: 'linear-gradient(to right, rgba(51,158,234,0.05), rgba(51,158,234,0.1), rgba(51,158,234,0.05))',
                borderRadius: '16px',
                color: '#4d6684',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                Powered by
                <a 
                  href="https://alberti-technology.vercel.app/metalurgia"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ 
                    color: '#339eea', 
                    textDecoration: 'none', 
                    fontWeight: 800,
                    position: 'relative',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textShadow = '0 0 12px rgba(51,158,234,0.6)';
                    e.currentTarget.style.color = '#0d5a91';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textShadow = 'none';
                    e.currentTarget.style.color = '#339eea';
                  }}
                >
                  Alberti Technology
                  <div style={{ position: 'absolute', bottom: '-2px', left: 0, width: '100%', height: '2px', background: 'currentColor', borderRadius: '2px' }}></div>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

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
