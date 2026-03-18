import React from 'react'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface WorkspaceProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

const Workspace: React.FC<WorkspaceProps> = ({ showToast }) => {
  const {
    prompts,
    addPrompt,
    selectPrompt,
    setActiveView,
    setSelectedCategory,
    getRecentPrompts
  } = useAppStore()
  const { profile, user } = useAuthStore()

  const recentPrompts = getRecentPrompts(6)
  const favoritePrompts = prompts.filter(p => p.isFavorite).slice(0, 6)
  const totalVersions = prompts.reduce((sum, p) => sum + p.versions.length, 0)
  const totalDebug = prompts.reduce((sum, p) => sum + p.debugRecords.length, 0)
  const categories = new Set(prompts.map(p => p.category)).size

  const displayName = profile?.display_name || user?.email?.split('@')[0] || '用户'

  const handleNewPrompt = () => {
    addPrompt()
  }

  const handleOpenPrompt = (id: string) => {
    selectPrompt(id)
    setActiveView('editor')
  }

  const handleViewAll = () => {
    setSelectedCategory('全部')
    setActiveView('library')
  }

  const handleViewFavorites = () => {
    setSelectedCategory('收藏')
    setActiveView('library')
  }

  const formatDate = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: zhCN })
    } catch {
      return ''
    }
  }

  return (
    <div className="content-area">
      <div className="workspace-container">
        {/* Greeting */}
        <div className="workspace-greeting">
          <h1 className="workspace-greeting-title">
            你好，{displayName}
          </h1>
          <p className="workspace-greeting-sub">开始创建和管理你的提示词</p>
        </div>

        {/* Quick Actions */}
        <div className="workspace-quick-actions">
          <button className="workspace-quick-btn" onClick={handleNewPrompt}>
            <div className="workspace-quick-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <span>新建提示词</span>
          </button>
          <button className="workspace-quick-btn" onClick={handleViewAll}>
            <div className="workspace-quick-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
              </svg>
            </div>
            <span>浏览全部</span>
          </button>
          <button className="workspace-quick-btn" onClick={handleViewFavorites}>
            <div className="workspace-quick-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <span>我的收藏</span>
          </button>
        </div>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-number">{prompts.length}</div>
            <div className="stat-label">提示词</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{totalDebug}</div>
            <div className="stat-label">调试次数</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{totalVersions}</div>
            <div className="stat-label">版本</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{categories}</div>
            <div className="stat-label">分类</div>
          </div>
        </div>

        {/* Recent Prompts */}
        {recentPrompts.length > 0 && (
          <div className="workspace-section">
            <div className="workspace-section-header">
              <span className="workspace-section-title">最近使用</span>
            </div>
            <div className="workspace-card-row">
              {recentPrompts.map(p => (
                <div key={p.id} className="workspace-card" onClick={() => handleOpenPrompt(p.id)}>
                  <div className="prompt-card-category" style={{ marginBottom: 6 }}>{p.category}</div>
                  <div className="prompt-card-title" style={{ fontSize: 14 }}>{p.title}</div>
                  <div className="prompt-card-meta" style={{ marginTop: 6 }}>{formatDate(p.lastUsedAt || p.updatedAt)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Favorite Prompts */}
        {favoritePrompts.length > 0 && (
          <div className="workspace-section">
            <div className="workspace-section-header">
              <span className="workspace-section-title">我的收藏</span>
              <button className="workspace-view-all" onClick={handleViewFavorites}>查看全部</button>
            </div>
            <div className="workspace-card-row">
              {favoritePrompts.map(p => (
                <div key={p.id} className="workspace-card" onClick={() => handleOpenPrompt(p.id)}>
                  <div className="prompt-card-category" style={{ marginBottom: 6 }}>{p.category}</div>
                  <div className="prompt-card-title" style={{ fontSize: 14 }}>{p.title}</div>
                  <div className="prompt-card-desc" style={{ fontSize: 12, marginBottom: 0, WebkitLineClamp: 1 }}>{p.description || '暂无描述'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state for new users */}
        {prompts.length === 0 && (
          <div className="empty-state" style={{ marginTop: 40 }}>
            <div className="empty-state-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </div>
            <div className="empty-state-title">创建你的第一个提示词</div>
            <div className="empty-state-desc">开始构建你的个人提示词库</div>
            <button className="sidebar-new-btn" style={{ marginTop: 16, maxWidth: 200 }} onClick={handleNewPrompt}>
              + 新建提示词
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Workspace
