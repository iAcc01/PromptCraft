import React, { useState } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { DEFAULT_CATEGORIES } from '../types'

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

  const categoryIcons: Record<string, React.ReactNode> = {
    '全部': <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>,
    '写作': <><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></>,
    '编程': <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>,
    '翻译': <><path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></>,
    '分析': <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    '创意': <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>,
    '角色扮演': <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    '工具': <><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></>,
    '自定义': <><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></>
  }

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
        {/* Quick Nav */}
        <div className="nav-section-title">导航</div>

        <button
          className={`nav-item ${activeView === 'workspace' ? 'active' : ''}`}
          onClick={() => handleNavClick('workspace')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>工作台</span>
        </button>

        <button
          className={`nav-item ${activeView === 'explore' ? 'active' : ''}`}
          onClick={() => handleNavClick('explore')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>探索</span>
          <span className="nav-item-badge">Soon</span>
        </button>

        {/* My Library */}
        <div className="nav-section-title" style={{ marginTop: 8 }}>我的库</div>

        <button
          className={`nav-item ${activeView === 'library' && selectedCategory === '全部' ? 'active' : ''}`}
          onClick={() => handleCategoryClick('全部')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          </svg>
          <span>全部提示词</span>
          <span className="nav-item-count">{prompts.length}</span>
        </button>

        <button
          className={`nav-item ${activeView === 'library' && selectedCategory === '收藏' ? 'active' : ''}`}
          onClick={() => handleCategoryClick('收藏')}
        >
          <svg viewBox="0 0 24 24" fill={selectedCategory === '收藏' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span>收藏</span>
          <span className="nav-item-count">{getCategoryCount('收藏')}</span>
        </button>

        <button
          className={`nav-item ${activeView === 'library' && selectedCategory === '最近使用' ? 'active' : ''}`}
          onClick={() => { setSelectedCategory('最近使用'); setActiveView('library') }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>最近使用</span>
          <span className="nav-item-count">{recentCount}</span>
        </button>

        <button
          className={`nav-item ${activeView === 'library' && selectedCategory === '已分享' ? 'active' : ''}`}
          onClick={() => { setSelectedCategory('已分享'); setActiveView('library') }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          <span>已分享</span>
          <span className="nav-item-count">{sharedCount}</span>
        </button>

        {/* Categories (Collapsible) */}
        <button
          className="nav-section-title"
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', fontFamily: 'var(--font-sans)', marginTop: 8 }}
          onClick={() => setCategoriesCollapsed(!categoriesCollapsed)}
        >
          <span>分类</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: categoriesCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {!categoriesCollapsed && DEFAULT_CATEGORIES.filter(c => c !== '全部').map(cat => (
          <button
            key={cat}
            className={`nav-item ${activeView === 'library' && selectedCategory === cat ? 'active' : ''}`}
            onClick={() => handleCategoryClick(cat)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {categoryIcons[cat]}
            </svg>
            <span>{cat}</span>
            <span className="nav-item-count">{getCategoryCount(cat)}</span>
          </button>
        ))}
      </div>

      {/* Bottom section */}
      <div className="sidebar-bottom">
        <button
          className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
          onClick={() => handleNavClick('settings')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
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
