import { useState, useCallback, useEffect } from 'react'
import LoginScreen from './components/LoginScreen'
import FileManager from './components/FileManager'
import Sidebar from './components/Sidebar'
import * as api from './services/api'
import {
  connectNotificationsWebSocket,
  disconnectNotificationsWebSocket,
} from './services/notifications'

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => !!localStorage.getItem('access_token')
  )
  
  const [showAdmin, setShowAdmin] = useState(() => {
    const val = localStorage.getItem('altech_show_admin');
    return val ? val === 'true' : true;
  });
  const [showGallery, setShowGallery] = useState(() => {
    const val = localStorage.getItem('altech_show_gallery');
    return val ? val === 'true' : true;
  });
  const [showReports, setShowReports] = useState(() => {
    const val = localStorage.getItem('altech_show_reports');
    return val ? val === 'true' : true;
  });
  const [showAssistant, setShowAssistant] = useState(() => {
    const val = localStorage.getItem('altech_show_assistant');
    return val ? val === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('altech_show_admin', String(showAdmin));
  }, [showAdmin]);
  useEffect(() => {
    localStorage.setItem('altech_show_gallery', String(showGallery));
  }, [showGallery]);
  useEffect(() => {
    localStorage.setItem('altech_show_reports', String(showReports));
  }, [showReports]);
  useEffect(() => {
    localStorage.setItem('altech_show_assistant', String(showAssistant));
  }, [showAssistant]);

  const handleLogin = useCallback(() => {
    setIsLoggedIn(true)
  }, [])

  const handleLogout = useCallback(() => {
    disconnectNotificationsWebSocket()
    setIsLoggedIn(false)
  }, [])

  useEffect(() => {
    window.addEventListener('auth_logout', handleLogout)
    return () => window.removeEventListener('auth_logout', handleLogout)
  }, [handleLogout])



  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: '12px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          width: '100%',
          gap: '12px',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div style={{ width: '60px', flexShrink: 0, height: '100%', overflow: 'hidden' }}>
          <Sidebar 
            onLogoutConfirm={() => api.logout()} 
            showAdmin={showAdmin}
            onToggleAdmin={() => setShowAdmin(!showAdmin)}
            showGallery={showGallery}
            onToggleGallery={() => setShowGallery(!showGallery)}
            showReports={showReports}
            onToggleReports={() => setShowReports(!showReports)}
            showAssistant={showAssistant}
            onToggleAssistant={() => setShowAssistant(!showAssistant)}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
          <FileManager 
            onLogout={handleLogout} 
            showAdmin={showAdmin}
            showGallery={showGallery}
            showReports={showReports}
            showAssistant={showAssistant}
          />
        </div>
      </div>
    </div>
  )
}
