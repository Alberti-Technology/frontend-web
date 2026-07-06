import { useState } from 'react'
import altechLogo from '../../images/altech-logo-sin-fondo.svg'

interface SidebarProps {
  onLogoutConfirm: () => void;
}

export default function Sidebar({ onLogoutConfirm }: SidebarProps) {
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showLegendModal, setShowLegendModal] = useState(false)

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

        {/* Middle: Info/Legend Button */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button 
            onClick={() => setShowLegendModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'transparent',
              color: '#339eea',
              border: 'none',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
            }}
            title="Leyenda de iconos"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#eef8ff';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </button>
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

      {/* Legend Modal */}
      {showLegendModal && (
        <div style={styles.modalOverlay} onClick={() => setShowLegendModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Leyenda de Íconos</h3>
              <button 
                style={styles.closeBtn} 
                onClick={() => setShowLegendModal(false)}
                onMouseEnter={(e) => Object.assign(e.currentTarget.style, { background: 'var(--bg-accent)' })}
                onMouseLeave={(e) => Object.assign(e.currentTarget.style, { background: 'transparent' })}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div style={{ ...styles.modalBody, padding: '20px 28px', maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h4 style={{ margin: '0 0 12px 0', color: '#10243f', fontSize: '0.95rem', fontWeight: 700 }}>Administrador de archivos</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '3px 5px', borderRadius: 4, background: 'rgba(22,163,74,0.15)', border: '1px solid #16a34a', color: '#16a34a', lineHeight: 1 }}>IA</span>
                      <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Autocalibración exitosa</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '3px 5px', borderRadius: 4, background: 'rgba(232,163,23,0.15)', border: '1px solid #e8a317', color: '#e8a317', lineHeight: 1 }}>IA</span>
                      <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Autocalibrando (o en cola)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '3px 5px', borderRadius: 4, background: 'rgba(248,113,113,0.15)', border: '1px solid #f87171', color: '#f87171', lineHeight: 1 }}>IA</span>
                      <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Error en autocalibración</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ color: '#16a34a', padding: '2px 4px', display: 'flex' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </span>
                      <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Calibración Manual exitosa</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ display: "flex", padding: "2px", borderRadius: 4, background: "rgba(22,163,74,0.15)", border: "1px solid #16a34a", color: "#16a34a", lineHeight: 1 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 16l4-4 3 3 6-7" /></svg>
                      </span>
                      <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Gráfico de medición disponible</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ display: "flex", padding: "2px", borderRadius: 4, background: "rgba(232,163,23,0.15)", border: "1px solid #e8a317", color: "#e8a317", lineHeight: 1 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 16l4-4 3 3 6-7" /></svg>
                      </span>
                      <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Procesando gráfico...</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ display: "flex", padding: "2px", borderRadius: 4, background: "rgba(248,113,113,0.15)", border: "1px solid #f87171", color: "#f87171", lineHeight: 1 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 16l4-4 3 3 6-7" /></svg>
                      </span>
                      <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Fallo al generar gráfico</span>
                    </div>
                  </div>
                </div>
                
                <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                
                <div>
                  <h4 style={{ margin: '0 0 12px 0', color: '#10243f', fontSize: '0.95rem', fontWeight: 700 }}>Galería de imágenes</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: 'rgba(22, 163, 74, 0.92)', color: 'white', fontSize: '0.66rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> IA
                      </div>
                      <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Autocalibración exitosa</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: 'rgba(232, 163, 23, 0.92)', color: 'white', fontSize: '0.66rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <div style={{width:6,height:6,borderRadius:"50%",background:"white"}}/> IA
                      </div>
                      <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Autocalibrando (o en cola)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: 'rgba(220, 38, 38, 0.92)', color: 'white', fontSize: '0.66rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> IA
                      </div>
                      <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Error en autocalibración</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: 'rgba(22, 163, 74, 0.92)', color: 'white', fontSize: '0.66rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> CM
                      </div>
                      <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Calibración Manual exitosa</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: 'rgba(22, 163, 74, 0.92)', color: 'white', fontSize: '0.66rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 16l4-4 3 3 6-7" /></svg>
                      </div>
                      <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Gráfico de medición disponible</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: 'rgba(232, 163, 23, 0.92)', color: 'white', fontSize: '0.66rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 16l4-4 3 3 6-7" /></svg>
                      </div>
                      <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Procesando gráfico...</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: 'rgba(220, 38, 38, 0.92)', color: 'white', fontSize: '0.66rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 16l4-4 3 3 6-7" /></svg>
                      </div>
                      <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Fallo al generar gráfico</span>
                    </div>
                  </div>
                </div>
              </div>
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
