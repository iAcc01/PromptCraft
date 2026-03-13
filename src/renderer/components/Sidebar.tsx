import React from 'react'
import { useAppStore } from '../stores/useAppStore'
import { DEFAULT_CATEGORIES } from '../types'

const Sidebar: React.FC = () => {
  const {
    prompts,
    searchQuery,
    selectedCategory,
    sidebarCollapsed,
    setSearchQuery,
    setSelectedCategory,
    addPrompt,
    setActiveView
  } = useAppStore()

  const getCategoryCount = (cat: string) => {
    if (cat === '全部') return prompts.length
    if (cat === '收藏') return prompts.filter(p => p.isFavorite).length
    return prompts.filter(p => p.category === cat).length
  }

  const handleNewPrompt = () => {
    addPrompt()
  }

  const handleCategoryClick = (cat: string) => {
    setSelectedCategory(cat)
    setActiveView('library')
  }

  return (
    <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">P</div>
          <span>PromptCraft</span>
        </div>
      </div>

      <div className="sidebar-search">
        <div className="search-input-wrapper">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="search-input"
            type="text"
            placeholder="搜索提示词..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="sidebar-nav">
        <div className="nav-section-title">分类</div>

        {/* Favorites */}
        <button
          className={`nav-item ${selectedCategory === '收藏' ? 'active' : ''}`}
          onClick={() => handleCategoryClick('收藏')}
        >
          <svg viewBox="0 0 24 24" fill={selectedCategory === '收藏' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span>收藏</span>
          <span className="nav-item-count">{getCategoryCount('收藏')}</span>
        </button>

        {DEFAULT_CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`nav-item ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => handleCategoryClick(cat)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {cat === '全部' && <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>}
              {cat === '写作' && <><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></>}
              {cat === '编程' && <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>}
              {cat === '翻译' && <><path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></>}
              {cat === '分析' && <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>}
              {cat === '创意' && <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>}
              {cat === '角色扮演' && <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>}
              {cat === '工具' && <><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></>}
              {cat === '自定义' && <><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></>}
            </svg>
            <span>{cat}</span>
            <span className="nav-item-count">{getCategoryCount(cat)}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="sidebar-footer-btn" onClick={handleNewPrompt}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          新建提示词
        </button>
      </div>
    </div>
  )
}

export default Sidebar
