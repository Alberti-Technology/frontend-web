import { useState, useCallback, useEffect } from 'react'
import LoginScreen from './components/LoginScreen'
import FileManager from './components/FileManager'
import Sidebar from './components/Sidebar'
import * as api from './services/api'

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => !!localStorage.getItem('access_token')
  )

  const handleLogin = useCallback(() => {
    setIsLoggedIn(true)
  }, [])

  const handleLogout = useCallback(() => {
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
          display: 'grid',
          width: '100%',
          gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 22fr) minmax(0, 55fr) minmax(0, 20fr)',
          gridTemplateRows: 'minmax(0, 1fr) minmax(0, 1fr)',
          gridTemplateAreas: `"sidebar dir gallery reports" "sidebar dir gallery reports"`,
          gap: '12px',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div style={{ gridArea: 'sidebar', height: '100%', overflow: 'hidden' }}>
          <Sidebar onLogoutConfirm={() => api.logout()} />
        </div>
        <FileManager onLogout={handleLogout} />
      </div>
    </div>
  )
}
