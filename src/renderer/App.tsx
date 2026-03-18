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
        return (
          <div className="content-area">
            <div className="empty-state" style={{ marginTop: 80 }}>
              <div className="empty-state-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <div className="empty-state-title">探索 · 即将上线</div>
              <div className="empty-state-desc">社区模板市场正在开发中，敬请期待</div>
            </div>
          </div>
        )
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
