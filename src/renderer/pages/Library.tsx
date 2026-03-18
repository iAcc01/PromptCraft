import React, { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { Prompt, DEFAULT_CATEGORIES, CATEGORY_ICONS } from '../types'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface LibraryProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

const Library: React.FC<LibraryProps> = ({ showToast }) => {
  const {
    viewMode,
    selectedPromptId,
    selectedCategory,
    sortBy,
    searchQuery,
    selectPrompt,
    setActiveView,
    setSelectedCategory,
    setSortBy,
    setSearchQuery,
    toggleFavorite,
    deletePrompt,
    duplicatePrompt,
    getFilteredPrompts,
    prompts
  } = useAppStore()

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; prompt: Prompt } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const filteredPrompts = getFilteredPrompts()

  useEffect(() => {
    const handler = () => setContextMenu(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [])

  const handleCardClick = (prompt: Prompt) => {
    selectPrompt(prompt.id)
    setActiveView('editor')
  }

  const handleContextMenu = (e: React.MouseEvent, prompt: Prompt) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, prompt })
  }

  const handleContextAction = (action: string) => {
    if (!contextMenu) return
    const { prompt } = contextMenu

    switch (action) {
      case 'edit':
        selectPrompt(prompt.id)
        setActiveView('editor')
        break
      case 'debug':
        selectPrompt(prompt.id)
        setActiveView('editor')
        useAppStore.getState().setRightPanelTab('debug')
        break
      case 'share':
        selectPrompt(prompt.id)
        setActiveView('editor')
        useAppStore.getState().setRightPanelTab('share')
        break
      case 'duplicate':
        duplicatePrompt(prompt.id)
        showToast('提示词已复制', 'success')
        break
      case 'favorite':
        toggleFavorite(prompt.id)
        showToast(prompt.isFavorite ? '已取消收藏' : '已收藏', 'success')
        break
      case 'delete':
        deletePrompt(prompt.id)
        showToast('提示词已删除', 'success')
        break
    }
    setContextMenu(null)
  }

  const formatDate = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: zhCN })
    } catch {
      return ''
    }
  }

  // 是否为特殊筛选视图（收藏/最近使用/已分享）
  const isSpecialFilter = ['收藏', '最近使用', '已分享'].includes(selectedCategory)

  return (
    <div className="content-area">
      {/* Search Bar - inline in library */}
      <div className="library-toolbar">
        <div className="library-search-bar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="library-search-input"
            type="text"
            placeholder="搜索提示词..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="library-search-clear" onClick={() => setSearchQuery('')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Sort Controls */}
        <div className="library-sort-controls">
          <button
            className={`library-sort-btn ${sortBy === 'updatedAt' ? 'active' : ''}`}
            onClick={() => setSortBy('updatedAt')}
          >
            最新
          </button>
          <button
            className={`library-sort-btn ${sortBy === 'useCount' ? 'active' : ''}`}
            onClick={() => setSortBy('useCount')}
          >
            最热
          </button>
          <button
            className={`library-sort-btn ${sortBy === 'title' ? 'active' : ''}`}
            onClick={() => setSortBy('title')}
          >
            名称
          </button>
        </div>
      </div>

      {/* Category Filter Buttons */}
      {!isSpecialFilter && (
        <div className="library-category-bar">
          {DEFAULT_CATEGORIES.map(cat => {
            const count = cat === '全部' ? prompts.length : prompts.filter(p => p.category === cat).length
            const isActive = selectedCategory === cat
            return (
              <button
                key={cat}
                className={`library-category-chip ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                <span className="category-chip-icon">{CATEGORY_ICONS[cat] || '📁'}</span>
                <span>{cat}</span>
                {count > 0 && <span className="category-chip-count">{count}</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* Results info */}
      <div className="library-results-info">
        <span className="library-results-count">
          {isSpecialFilter ? selectedCategory : (selectedCategory === '全部' ? '全部分类' : selectedCategory)}
          {' · '}
          {filteredPrompts.length} 个提示词
        </span>
      </div>

      {/* Content */}
      {filteredPrompts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <div className="empty-state-title">没有找到匹配的提示词</div>
          <div className="empty-state-desc">尝试调整搜索条件或选择其他分类</div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="prompt-grid">
          {filteredPrompts.map(prompt => (
            <div
              key={prompt.id}
              className={`prompt-card ${selectedPromptId === prompt.id ? 'selected' : ''}`}
              onClick={() => handleCardClick(prompt)}
              onContextMenu={e => handleContextMenu(e, prompt)}
            >
              <div className="prompt-card-header">
                <span className="prompt-card-category">
                  {CATEGORY_ICONS[prompt.category] || '📁'} {prompt.category}
                </span>
                <button
                  className={`prompt-card-fav ${prompt.isFavorite ? 'active' : ''}`}
                  onClick={e => {
                    e.stopPropagation()
                    toggleFavorite(prompt.id)
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={prompt.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
              </div>
              <div className="prompt-card-title">{prompt.title}</div>
              <div className="prompt-card-desc">{prompt.description || prompt.content.slice(0, 80) + '...'}</div>
              <div className="prompt-card-footer">
                <div className="prompt-card-tags">
                  {prompt.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="prompt-tag">{tag}</span>
                  ))}
                </div>
                <span className="prompt-card-meta">
                  {prompt.useCount > 0 && `${prompt.useCount}次使用 · `}
                  {formatDate(prompt.updatedAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="prompt-list">
          {filteredPrompts.map(prompt => (
            <div
              key={prompt.id}
              className={`prompt-list-item ${selectedPromptId === prompt.id ? 'selected' : ''}`}
              onClick={() => handleCardClick(prompt)}
              onContextMenu={e => handleContextMenu(e, prompt)}
            >
              <button
                className={`prompt-card-fav ${prompt.isFavorite ? 'active' : ''}`}
                onClick={e => {
                  e.stopPropagation()
                  toggleFavorite(prompt.id)
                }}
                style={{ flexShrink: 0 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={prompt.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
              <span className="prompt-list-item-title">{prompt.title}</span>
              <span className="prompt-list-item-category">{CATEGORY_ICONS[prompt.category] || '📁'} {prompt.category}</span>
              <span className="prompt-list-item-date">{formatDate(prompt.updatedAt)}</span>
            </div>
          ))}
        </div>
      )}

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          <button className="context-menu-item" onClick={() => handleContextAction('edit')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            编辑
          </button>
          <button className="context-menu-item" onClick={() => handleContextAction('debug')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
            调试
          </button>
          <button className="context-menu-item" onClick={() => handleContextAction('share')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            分享
          </button>
          <div className="context-menu-divider" />
          <button className="context-menu-item" onClick={() => handleContextAction('duplicate')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            复制
          </button>
          <button className="context-menu-item" onClick={() => handleContextAction('favorite')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            {contextMenu.prompt.isFavorite ? '取消收藏' : '收藏'}
          </button>
          <div className="context-menu-divider" />
          <button className="context-menu-item danger" onClick={() => handleContextAction('delete')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            删除
          </button>
        </div>
      )}
    </div>
  )
}

export default Library
