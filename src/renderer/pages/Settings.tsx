import React, { useState, useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'

interface SettingsProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

const isElectron = typeof window !== 'undefined' && (window as any).require
const ipcRenderer = isElectron ? (window as any).require('electron').ipcRenderer : null

const Settings: React.FC<SettingsProps> = ({ showToast }) => {
  const { darkMode, toggleDarkMode, prompts, loadPrompts, localMode } = useAppStore()
  const { user, profile, signOut, skippedAuth } = useAuthStore()
  const [activeSection, setActiveSection] = useState('profile')
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    if (ipcRenderer) {
      ipcRenderer.invoke('get-app-version').then((v: string) => setAppVersion(v))
    }
  }, [])

  const handleSignOut = async () => {
    await signOut()
    showToast('已退出登录', 'info')
  }

  const handleExportAll = () => {
    const data = JSON.stringify(prompts, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `promptcraft-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('已导出全部数据', 'success')
  }

  const handleImportData = async () => {
    if (ipcRenderer) {
      const data = await ipcRenderer.invoke('import-prompt')
      if (data) {
        if (Array.isArray(data)) {
          // Import all prompts
          for (const p of data) {
            useAppStore.getState().addPrompt(p)
          }
          showToast(`已导入 ${data.length} 条提示词`, 'success')
        } else {
          useAppStore.getState().addPrompt(data)
          showToast('已导入 1 条提示词', 'success')
        }
      }
    } else {
      showToast('浏览器模式下暂不支持文件导入', 'info')
    }
  }

  const handleClearCache = () => {
    if (window.confirm('确定要清除本地缓存吗？这不会影响云端数据。')) {
      localStorage.removeItem('promptcraft-prompts')
      showToast('本地缓存已清除', 'success')
    }
  }

  const handleOpenGithub = () => {
    const url = 'https://github.com/iAcc01/PromptCraft'
    if (ipcRenderer) {
      ipcRenderer.invoke('open-external', url)
    } else {
      window.open(url, '_blank')
    }
  }

  const sections = [
    { id: 'profile', label: '个人资料', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
    { id: 'appearance', label: '外观', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> },
    { id: 'data', label: '数据管理', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> },
    { id: 'shortcuts', label: '快捷键', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg> },
    { id: 'about', label: '关于', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> }
  ]

  const renderSection = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div className="settings-section-content">
            <h3 className="settings-section-heading">个人资料</h3>
            {user && !skippedAuth ? (
              <div className="settings-card">
                <div className="settings-profile-row">
                  <div className="user-avatar-lg" style={{ width: 48, height: 48, fontSize: 18 }}>
                    {(profile?.display_name || user.email || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {profile?.display_name || user.email?.split('@')[0]}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{user.email}</div>
                  </div>
                </div>
                <div className="settings-divider" />
                <button className="editor-action-btn danger" onClick={handleSignOut}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  退出登录
                </button>
              </div>
            ) : (
              <div className="settings-card">
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>当前为本地模式</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                  登录后可启用云同步，在多设备间同步提示词数据。
                </div>
              </div>
            )}
          </div>
        )

      case 'appearance':
        return (
          <div className="settings-section-content">
            <h3 className="settings-section-heading">外观</h3>
            <div className="settings-card">
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">主题</div>
                  <div className="settings-row-desc">切换浅色或深色模式</div>
                </div>
                <button className="settings-toggle" onClick={toggleDarkMode}>
                  <div className={`settings-toggle-track ${darkMode ? 'active' : ''}`}>
                    <div className="settings-toggle-thumb" />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{darkMode ? '深色' : '浅色'}</span>
                </button>
              </div>
            </div>
          </div>
        )

      case 'data':
        return (
          <div className="settings-section-content">
            <h3 className="settings-section-heading">数据管理</h3>
            <div className="settings-card">
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">导出全部数据</div>
                  <div className="settings-row-desc">将 {prompts.length} 条提示词导出为 JSON 文件</div>
                </div>
                <button className="share-btn secondary" style={{ fontSize: 12, padding: '6px 14px' }} onClick={handleExportAll}>导出</button>
              </div>
              <div className="settings-divider" />
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">导入数据</div>
                  <div className="settings-row-desc">从 JSON 文件导入提示词</div>
                </div>
                <button className="share-btn secondary" style={{ fontSize: 12, padding: '6px 14px' }} onClick={handleImportData}>导入</button>
              </div>
              <div className="settings-divider" />
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">清除本地缓存</div>
                  <div className="settings-row-desc">清除浏览器本地存储的数据</div>
                </div>
                <button className="share-btn secondary" style={{ fontSize: 12, padding: '6px 14px', color: 'var(--error)' }} onClick={handleClearCache}>清除</button>
              </div>
            </div>
          </div>
        )

      case 'shortcuts':
        return (
          <div className="settings-section-content">
            <h3 className="settings-section-heading">快捷键</h3>
            <div className="settings-card">
              {[
                { key: '⌘ N', desc: '新建提示词' },
                { key: '⌘ F', desc: '搜索' },
                { key: '⌘ D', desc: '切换深色模式' },
                { key: '⌘ ,', desc: '打开设置' },
                { key: '⌘ ⏎', desc: '渲染并复制' },
              ].map(s => (
                <div key={s.key} className="settings-row" style={{ padding: '10px 0' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.desc}</span>
                  <kbd className="settings-kbd">{s.key}</kbd>
                </div>
              ))}
            </div>
          </div>
        )

      case 'about':
        return (
          <div className="settings-section-content">
            <h3 className="settings-section-heading">关于</h3>
            <div className="settings-card" style={{ textAlign: 'center', padding: 32 }}>
              <div className="sidebar-logo-icon" style={{ width: 48, height: 48, fontSize: 20, margin: '0 auto 12px' }}>P</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>PromptCraft</div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
                版本 {appVersion || '1.0.7'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16, maxWidth: 320, margin: '0 auto 16px' }}>
                优雅的提示词创作、管理、调试与分享工具。
                为创作者和开发者打造。
              </div>
              <button className="share-btn secondary" style={{ fontSize: 12, padding: '8px 16px' }} onClick={handleOpenGithub}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 4, verticalAlign: 'middle' }}>
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub 仓库
              </button>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="content-area">
      <div className="settings-container">
        <div className="settings-nav">
          {sections.map(s => (
            <button
              key={s.id}
              className={`settings-nav-item ${activeSection === s.id ? 'active' : ''}`}
              onClick={() => setActiveSection(s.id)}
            >
              {s.icon}
              <span>{s.label}</span>
            </button>
          ))}
        </div>
        <div className="settings-content">
          {renderSection()}
        </div>
      </div>
    </div>
  )
}

export default Settings
