import React, { useState } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { DEFAULT_CATEGORIES, CATEGORY_ICONS } from '../types'

const Sidebar: React.FC = () => {
  const {
    prompts,
    selectedCategory,
    sidebarCollapsed,
    activeView,
    setSelectedCategory,
    addPrompt,
    setActiveView,
    getSharedPrompts,
    getRecentPrompts
  } = useAppStore()
  const { profile, user, skippedAuth } = useAuthStore()
  const [categoriesCollapsed, setCategoriesCollapsed] = useState(false)

  const getCategoryCount = (cat: string) => {
    if (cat === '全部') return prompts.length
    if (cat === '收藏') return prompts.filter(p => p.isFavorite).length
    return prompts.filter(p => p.category === cat).length
  }

  const recentCount = getRecentPrompts().length
  const sharedCount = getSharedPrompts().length

  const handleNewPrompt = () => {
    addPrompt()
  }

  const handleCategoryClick = (cat: string) => {
    setSelectedCategory(cat)
    setActiveView('library')
  }

  const handleNavClick = (view: 'workspace' | 'library' | 'explore' | 'settings') => {
    setActiveView(view)
  }

  const displayName = profile?.display_name || user?.email?.split('@')[0] || '本地用户'
  const initial = displayName[0]?.toUpperCase() || 'U'

  return (
    <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">P</div>
          <span>PromptCraft</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="sidebar-actions">
        <button className="sidebar-new-btn" onClick={handleNewPrompt}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          新建提示词
        </button>
      </div>

      <div className="sidebar-nav">
        {/* Primary Navigation */}
        <div className="nav-section-title">导航</div>

        <button
          className={`nav-item ${activeView === 'workspace' ? 'active' : ''}`}
          onClick={() => handleNavClick('workspace')}
        >
          <span className="nav-item-emoji">🏠</span>
          <span>工作台</span>
        </button>

        <button
          className={`nav-item ${activeView === 'explore' ? 'active' : ''}`}
          onClick={() => handleNavClick('explore')}
        >
          <span className="nav-item-emoji">🔍</span>
          <span>探索</span>
        </button>

        {/* My Library */}
        <div className="nav-section-title" style={{ marginTop: 8 }}>我的库</div>

        <button
          className={`nav-item ${activeView === 'library' && selectedCategory === '全部' ? 'active' : ''}`}
          onClick={() => handleCategoryClick('全部')}
        >
          <span className="nav-item-emoji">📋</span>
          <span>全部提示词</span>
          <span className="nav-item-count">{prompts.length}</span>
        </button>

        <button
          className={`nav-item ${activeView === 'library' && selectedCategory === '收藏' ? 'active' : ''}`}
          onClick={() => handleCategoryClick('收藏')}
        >
          <span className="nav-item-emoji">❤️</span>
          <span>收藏</span>
          <span className="nav-item-count">{getCategoryCount('收藏')}</span>
        </button>

        <button
          className={`nav-item ${activeView === 'library' && selectedCategory === '最近使用' ? 'active' : ''}`}
          onClick={() => { setSelectedCategory('最近使用'); setActiveView('library') }}
        >
          <span className="nav-item-emoji">🕐</span>
          <span>最近使用</span>
          <span className="nav-item-count">{recentCount}</span>
        </button>

        <button
          className={`nav-item ${activeView === 'library' && selectedCategory === '已分享' ? 'active' : ''}`}
          onClick={() => { setSelectedCategory('已分享'); setActiveView('library') }}
        >
          <span className="nav-item-emoji">🔗</span>
          <span>已分享</span>
          <span className="nav-item-count">{sharedCount}</span>
        </button>

        {/* Categories (Collapsible) */}
        <button
          className="nav-section-title nav-section-toggle"
          onClick={() => setCategoriesCollapsed(!categoriesCollapsed)}
        >
          <span>分类</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: categoriesCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {!categoriesCollapsed && DEFAULT_CATEGORIES.filter(c => c !== '全部').map(cat => {
          const count = getCategoryCount(cat)
          return (
            <button
              key={cat}
              className={`nav-item ${activeView === 'library' && selectedCategory === cat ? 'active' : ''}`}
              onClick={() => handleCategoryClick(cat)}
            >
              <span className="nav-item-emoji">{CATEGORY_ICONS[cat] || '📁'}</span>
              <span>{cat}</span>
              {count > 0 && <span className="nav-item-count">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Bottom section */}
      <div className="sidebar-bottom">
        <button
          className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
          onClick={() => handleNavClick('settings')}
        >
          <span className="nav-item-emoji">⚙️</span>
          <span>设置</span>
        </button>
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{initial}</div>
          <span className="sidebar-user-name">{displayName}</span>
        </div>
      </div>
    </div>
  )
}

export default Sidebar
