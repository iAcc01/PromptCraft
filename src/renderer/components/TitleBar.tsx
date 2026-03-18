import React, { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'

interface TitleBarProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

const TitleBar: React.FC<TitleBarProps> = ({ showToast }) => {
  const {
    activeView,
    selectedPromptId,
    viewMode,
    darkMode,
    syncing,
    sidebarCollapsed,
    searchQuery,
    toggleSidebar,
    setActiveView,
    setViewMode,
    toggleDarkMode,
    getSelectedPrompt,
    addPrompt,
    selectPrompt,
    setSearchQuery
  } = useAppStore()

  const { user, profile, signOut, skippedAuth } = useAuthStore()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const selectedPrompt = getSelectedPrompt()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showUserMenu])

  const getTitleText = () => {
    if (activeView === 'workspace') return '工作台'
    if (activeView === 'library') return '提示词库'
    if (activeView === 'settings') return '设置'
    if (activeView === 'explore') return '探索发现'
    if (activeView === 'editor' && selectedPrompt) return selectedPrompt.title || '未命名提示词'
    return '提示词库'
  }

  const handleSignOut = async () => {
    setShowUserMenu(false)
    await signOut()
    showToast('已退出登录', 'info')
  }

  const handleBack = () => {
    selectPrompt(null)
    setActiveView('workspace')
  }

  const getInitial = () => {
    if (profile?.display_name) return profile.display_name[0].toUpperCase()
    if (user?.email) return user.email[0].toUpperCase()
    return 'U'
  }

  const getDisplayName = () => {
    if (profile?.display_name) return profile.display_name
    if (user?.email) return user.email.split('@')[0]
    return '本地用户'
  }

  return (
    <div className="titlebar">
      <div className="titlebar-left" style={sidebarCollapsed ? { paddingLeft: 56 } : undefined}>
        <button className="titlebar-toggle" onClick={toggleSidebar} title="切换侧边栏">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>

        {activeView === 'editor' && selectedPromptId && (
          <button className="titlebar-btn" onClick={handleBack} title="返回" style={{ marginRight: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}

        <span className="titlebar-title">{getTitleText()}</span>
        {syncing && (
          <span className="sync-indicator" title="正在同步...">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sync-spin">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </span>
        )}
      </div>

      <div className="titlebar-right">
        {/* Search in library/workspace */}
        {(activeView === 'library' || activeView === 'workspace') && (
          <div className="titlebar-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="titlebar-search-input"
              type="text"
              placeholder="搜索..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        )}

        {activeView === 'library' && (
          <>
            <div className="tab-bar" style={{ marginRight: 8 }}>
              <button
                className={`tab-item ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                </svg>
              </button>
              <button
                className={`tab-item ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </button>
            </div>
            <button className="titlebar-btn" onClick={() => addPrompt()} title="新建">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </>
        )}

        <button className="titlebar-btn" onClick={toggleDarkMode} title="切换主题">
          {darkMode ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {/* User Avatar & Menu */}
        <div className="user-menu-wrapper" ref={userMenuRef}>
          <button
            className="user-avatar-btn"
            onClick={() => setShowUserMenu(!showUserMenu)}
            title={getDisplayName()}
          >
            <span className="user-avatar-sm">{getInitial()}</span>
          </button>
          {showUserMenu && (
            <div className="user-dropdown">
              <div className="user-dropdown-header">
                <span className="user-avatar-lg">{getInitial()}</span>
                <div className="user-dropdown-info">
                  <div className="user-dropdown-name">{getDisplayName()}</div>
                  <div className="user-dropdown-email">{user?.email || '本地模式'}</div>
                </div>
              </div>
              <div className="user-dropdown-divider" />
              <button className="user-dropdown-item" onClick={() => { setShowUserMenu(false); setActiveView('settings') }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                设置
              </button>
              {user && !skippedAuth && (
                <button className="user-dropdown-item" onClick={handleSignOut}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  退出登录
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TitleBar
