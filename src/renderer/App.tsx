import React, { useEffect, useState, useCallback } from 'react'
import { useAppStore } from './stores/useAppStore'
import { useAuthStore } from './stores/useAuthStore'
import Sidebar from './components/Sidebar'
import TitleBar from './components/TitleBar'
import Library from './pages/Library'
import Editor from './pages/Editor'
import Workspace from './pages/Workspace'
import Settings from './pages/Settings'
import Auth from './pages/Auth'
import Toast from './components/Toast'
import UpdateNotification from './components/UpdateNotification'

const App: React.FC = () => {
  const { darkMode, activeView, selectedPromptId, loadPrompts } = useAppStore()
  const { user, loading: authLoading, initialize, skippedAuth } = useAuthStore()
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' }[]>([])
  const [appReady, setAppReady] = useState(false)

  // Initialize auth on mount
  useEffect(() => {
    initialize().then(() => setAppReady(true))
  }, [])

  // Load prompts when user changes (login/logout) or local mode
  useEffect(() => {
    if (appReady) {
      loadPrompts()
    }
  }, [appReady, user, skippedAuth])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  // Show loading screen while auth initializes
  if (authLoading || !appReady) {
    return (
      <div className="app-loading">
        <div className="app-loading-content">
          <div className="auth-logo-icon" style={{ width: 48, height: 48, fontSize: 22, marginBottom: 16 }}>P</div>
          <div className="app-loading-text">PromptCraft</div>
          <div className="auth-spinner" style={{ marginTop: 20 }} />
        </div>
      </div>
    )
  }

  // Show auth page if not logged in and not skipped
  if (!user && !skippedAuth) {
    return (
      <>
        <Auth />
        <Toast toasts={toasts} />
      </>
    )
  }

  const renderView = () => {
    switch (activeView) {
      case 'workspace':
        return <Workspace showToast={showToast} />
      case 'editor':
        if (!selectedPromptId) return <Workspace showToast={showToast} />
        return <Editor showToast={showToast} />
      case 'settings':
        return <Settings showToast={showToast} />
      case 'explore':
        return <Library showToast={showToast} />
      case 'library':
      default:
        return <Library showToast={showToast} />
    }
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TitleBar showToast={showToast} />
        {renderView()}
      </div>
      <Toast toasts={toasts} />
      <UpdateNotification />
    </div>
  )
}

export default App
