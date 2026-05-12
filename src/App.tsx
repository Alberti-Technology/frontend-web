import { useState, useCallback } from 'react'
import LoginScreen from './components/LoginScreen'
import FileManager from './components/FileManager'

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => !!localStorage.getItem('access_token')
  )

  const handleLogin = useCallback(() => {
    setIsLoggedIn(true)
  }, [])

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
          gridTemplateColumns: 'minmax(0, 25fr) minmax(0, 55fr) minmax(0, 20fr)',
          gridTemplateRows: 'minmax(0, 1fr) minmax(0, 1fr)',
          gridTemplateAreas: `"dir gallery reports" "dir gallery reports"`,
          gap: '12px',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <FileManager />
      </div>
    </div>
  )
}
