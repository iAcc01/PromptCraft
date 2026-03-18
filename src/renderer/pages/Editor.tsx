import React, { useState, useCallback, useMemo } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { DEFAULT_CATEGORIES, PromptVariable, RightPanelTab } from '../types'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { v4 as uuidv4 } from 'uuid'

interface EditorProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

const Editor: React.FC<EditorProps> = ({ showToast }) => {
  const {
    updatePrompt,
    deletePrompt,
    duplicatePrompt,
    addVersion,
    restoreVersion,
    addDebugRecord,
    trackUsage,
    addPrompt,
    getSelectedPrompt,
    setActiveView,
    selectPrompt,
    rightPanelTab,
    setRightPanelTab
  } = useAppStore()

  const prompt = getSelectedPrompt()
  const [versionNote, setVersionNote] = useState('')
  const [showVersionModal, setShowVersionModal] = useState(false)
  const [newCollaborator, setNewCollaborator] = useState('')
  const [importCode, setImportCode] = useState('')

  // Debug variable values
  const [variableValues, setVariableValues] = useState<Record<string, string>>(() => {
    if (!prompt) return {}
    const values: Record<string, string> = {}
    prompt.variables.forEach(v => {
      values[v.name] = v.defaultValue
    })
    return values
  })

  // Extract variables from content
  const extractedVars = useMemo(() => {
    if (!prompt) return []
    const regex = /\{\{(\w+)\}\}/g
    const vars: string[] = []
    let match
    while ((match = regex.exec(prompt.content)) !== null) {
      if (!vars.includes(match[1])) vars.push(match[1])
    }
    return vars
  }, [prompt?.content])

  // Rendered content for debug preview
  const renderedContent = useMemo(() => {
    if (!prompt) return ''
    let content = prompt.content
    Object.entries(variableValues).forEach(([key, value]) => {
      content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `{{${key}}}`)
    })
    return content
  }, [prompt?.content, variableValues])

  const highlightedContent = useMemo(() => {
    if (!prompt) return ''
    let content = prompt.content
    Object.entries(variableValues).forEach(([key, value]) => {
      if (value) {
        content = content.replace(
          new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
          `<span class="highlight">${value}</span>`
        )
      }
    })
    return content
  }, [prompt?.content, variableValues])

  const handleContentChange = useCallback((content: string) => {
    if (!prompt) return
    const regex = /\{\{(\w+)\}\}/g
    const foundVars: string[] = []
    let match
    while ((match = regex.exec(content)) !== null) {
      if (!foundVars.includes(match[1])) foundVars.push(match[1])
    }
    const newVariables = foundVars.map(name => {
      const existing = prompt.variables.find(v => v.name === name)
      return existing || { name, description: '', defaultValue: '' }
    })
    updatePrompt(prompt.id, { content, variables: newVariables })
  }, [prompt?.id, prompt?.variables])

  const handleVariableUpdate = (index: number, updates: Partial<PromptVariable>) => {
    if (!prompt) return
    const newVars = [...prompt.variables]
    newVars[index] = { ...newVars[index], ...updates }
    updatePrompt(prompt.id, { variables: newVars })
  }

  const handleRemoveVariable = (index: number) => {
    if (!prompt) return
    const varName = prompt.variables[index].name
    const newVars = prompt.variables.filter((_, i) => i !== index)
    const newContent = prompt.content.replace(new RegExp(`\\{\\{${varName}\\}\\}`, 'g'), varName)
    updatePrompt(prompt.id, { variables: newVars, content: newContent })
  }

  const handleAddVariable = () => {
    if (!prompt) return
    const name = `var${prompt.variables.length + 1}`
    const newVars = [...prompt.variables, { name, description: '', defaultValue: '' }]
    const newContent = prompt.content + `\n{{${name}}}`
    updatePrompt(prompt.id, { variables: newVars, content: newContent })
  }

  const handleSaveVersion = () => {
    if (!prompt) return
    addVersion(prompt.id, versionNote || `版本 ${prompt.versions.length + 1}`)
    setVersionNote('')
    setShowVersionModal(false)
    showToast('版本已保存', 'success')
  }

  const handleRestoreVersion = (versionId: string) => {
    if (!prompt) return
    restoreVersion(prompt.id, versionId)
    showToast('已恢复到该版本', 'success')
  }

  const handleDelete = () => {
    if (!prompt) return
    if (window.confirm('确定要删除这个提示词吗？')) {
      deletePrompt(prompt.id)
      selectPrompt(null)
      setActiveView('workspace')
      showToast('提示词已删除', 'success')
    }
  }

  const handleCopyContent = () => {
    if (!prompt) return
    navigator.clipboard.writeText(prompt.content)
    showToast('已复制到剪贴板', 'success')
  }

  const handleTagsChange = (tagsStr: string) => {
    if (!prompt) return
    const tags = tagsStr.split(/[,，\s]+/).filter(Boolean)
    updatePrompt(prompt.id, { tags })
  }

  // Debug actions
  const handleRun = () => {
    if (!prompt) return
    addDebugRecord(prompt.id, {
      variables: { ...variableValues },
      renderedContent,
      response: '',
      rating: 0
    })
    trackUsage(prompt.id)
    navigator.clipboard.writeText(renderedContent)
    showToast('已渲染并复制到剪贴板', 'success')
  }

  const handleCopyRendered = () => {
    navigator.clipboard.writeText(renderedContent)
    trackUsage(prompt!.id)
    showToast('已复制渲染结果', 'success')
  }

  const handleRating = (recordId: string, rating: number) => {
    if (!prompt) return
    const updatedRecords = prompt.debugRecords.map(r =>
      r.id === recordId ? { ...r, rating } : r
    )
    updatePrompt(prompt.id, { debugRecords: updatedRecords })
  }

  const handleLoadHistory = (recordId: string) => {
    const record = prompt?.debugRecords.find(r => r.id === recordId)
    if (record) {
      setVariableValues(record.variables)
      showToast('已加载历史变量', 'info')
    }
  }

  // Share actions
  const handleGenerateShareCode = () => {
    if (!prompt) return
    const shareData = {
      id: uuidv4().slice(0, 8),
      title: prompt.title,
      description: prompt.description,
      content: prompt.content,
      category: prompt.category,
      tags: prompt.tags,
      variables: prompt.variables,
      author: prompt.author,
      version: 1
    }
    const code = btoa(encodeURIComponent(JSON.stringify(shareData)))
    updatePrompt(prompt.id, { isShared: true, shareCode: code })
    showToast('分享码已生成', 'success')
  }

  const handleCopyShareCode = () => {
    if (prompt?.shareCode) {
      navigator.clipboard.writeText(prompt.shareCode)
      showToast('分享码已复制到剪贴板', 'success')
    }
  }

  const handleImportShareCode = () => {
    if (!importCode.trim()) {
      showToast('请输入分享码', 'error')
      return
    }
    try {
      const data = JSON.parse(decodeURIComponent(atob(importCode.trim())))
      addPrompt({
        title: data.title,
        description: data.description,
        content: data.content,
        category: data.category || '自定义',
        tags: data.tags || [],
        variables: data.variables || [],
        author: data.author || 'Unknown'
      })
      setImportCode('')
      showToast('提示词已导入成功', 'success')
    } catch (e) {
      showToast('分享码格式错误，请检查后重试', 'error')
    }
  }

  const handleExportJson = () => {
    if (!prompt) return
    const data = JSON.stringify({
      title: prompt.title,
      description: prompt.description,
      content: prompt.content,
      category: prompt.category,
      tags: prompt.tags,
      variables: prompt.variables,
      author: prompt.author
    }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${prompt.title || 'prompt'}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('已导出为 JSON 文件', 'success')
  }

  const handleAddCollaborator = () => {
    if (!prompt || !newCollaborator.trim()) return
    if (prompt.collaborators.includes(newCollaborator.trim())) {
      showToast('该协作者已存在', 'error')
      return
    }
    updatePrompt(prompt.id, {
      collaborators: [...prompt.collaborators, newCollaborator.trim()]
    })
    setNewCollaborator('')
    showToast('协作者已添加', 'success')
  }

  const handleRemoveCollaborator = (name: string) => {
    if (!prompt) return
    updatePrompt(prompt.id, {
      collaborators: prompt.collaborators.filter(c => c !== name)
    })
    showToast('协作者已移除', 'success')
  }

  const charCount = prompt?.content.length || 0
  const wordCount = prompt?.content.split(/\s+/).filter(Boolean).length || 0
  const varCount = prompt?.variables.length || 0

  if (!prompt) return null

  const tabItems: { key: RightPanelTab; label: string }[] = [
    { key: 'debug', label: '调试' },
    { key: 'versions', label: `版本 (${prompt.versions.length})` },
    { key: 'share', label: '分享' },
    { key: 'info', label: '信息' }
  ]

  const getAvatarColor = (name: string) => {
    const colors = [
      'linear-gradient(135deg, #667eea, #764ba2)',
      'linear-gradient(135deg, #f093fb, #f5576c)',
      'linear-gradient(135deg, #4facfe, #00f2fe)',
      'linear-gradient(135deg, #43e97b, #38f9d7)',
      'linear-gradient(135deg, #fa709a, #fee140)',
    ]
    const index = name.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) % colors.length
    return colors[index]
  }

  const renderRightPanel = () => {
    switch (rightPanelTab) {
      case 'debug':
        return (
          <div className="right-panel-body">
            {prompt.variables.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <div className="empty-state-icon" style={{ width: 48, height: 48 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                  </svg>
                </div>
                <div className="empty-state-title">无可调试变量</div>
                <div className="empty-state-desc">在编辑器中使用 {'{{变量名}}'} 语法定义变量</div>
              </div>
            ) : (
              <>
                {prompt.variables.map(v => (
                  <div key={v.name} className="debug-var-group">
                    <label className="debug-var-label">
                      <span className="variable-badge">{`{{${v.name}}}`}</span>
                      {v.description && <span style={{ color: 'var(--text-tertiary)' }}>{v.description}</span>}
                    </label>
                    {v.defaultValue.length > 50 || v.name.toLowerCase().includes('code') || v.name.toLowerCase().includes('text') ? (
                      <textarea
                        className="debug-var-input"
                        value={variableValues[v.name] || ''}
                        onChange={e => setVariableValues(prev => ({ ...prev, [v.name]: e.target.value }))}
                        placeholder={v.defaultValue || '输入值...'}
                      />
                    ) : (
                      <input
                        className="debug-var-input"
                        value={variableValues[v.name] || ''}
                        onChange={e => setVariableValues(prev => ({ ...prev, [v.name]: e.target.value }))}
                        placeholder={v.defaultValue || '输入值...'}
                      />
                    )}
                  </div>
                ))}
                <button className="debug-run-btn" onClick={handleRun}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  渲染并复制
                </button>
              </>
            )}

            {/* Rendered Preview */}
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>渲染预览</span>
                <button
                  className="share-btn secondary"
                  style={{ padding: '4px 10px', fontSize: 11 }}
                  onClick={handleCopyRendered}
                >
                  复制
                </button>
              </div>
              <div
                className="debug-rendered"
                style={{ maxHeight: 240, overflowY: 'auto' }}
                dangerouslySetInnerHTML={{ __html: highlightedContent }}
              />
            </div>

            {/* Debug History */}
            {prompt.debugRecords.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 8 }}>
                  调试历史 ({prompt.debugRecords.length})
                </div>
                {prompt.debugRecords.slice(0, 5).map(record => (
                  <div
                    key={record.id}
                    className="debug-history-item"
                    onClick={() => handleLoadHistory(record.id)}
                  >
                    <div className="debug-history-time">
                      {(() => {
                        try { return formatDistanceToNow(new Date(record.timestamp), { addSuffix: true, locale: zhCN }) } catch { return '' }
                      })()}
                    </div>
                    <div className="debug-history-preview">{record.renderedContent}</div>
                    <div className="debug-history-rating">
                      {[1, 2, 3, 4, 5].map(star => (
                        <svg
                          key={star}
                          className={`rating-star ${star <= record.rating ? 'active' : ''}`}
                          viewBox="0 0 24 24"
                          fill={star <= record.rating ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          strokeWidth="2"
                          onClick={e => { e.stopPropagation(); handleRating(record.id, star) }}
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      case 'versions':
        return (
          <div className="right-panel-body">
            <button className="save-version-btn" onClick={() => setShowVersionModal(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              保存当前版本
            </button>
            {prompt.versions.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '24px 0', textAlign: 'center' }}>
                暂无版本记录
              </div>
            ) : (
              [...prompt.versions].reverse().map(v => (
                <div key={v.id} className="version-item">
                  <div className="version-info">
                    <div className="version-note">{v.note}</div>
                    <div className="version-date">
                      {(() => {
                        try { return formatDistanceToNow(new Date(v.createdAt), { addSuffix: true, locale: zhCN }) } catch { return '' }
                      })()}
                    </div>
                  </div>
                  <button className="version-restore-btn" onClick={() => handleRestoreVersion(v.id)}>恢复</button>
                </div>
              ))
            )}
          </div>
        )

      case 'share':
        return (
          <div className="right-panel-body">
            {/* Share Code */}
            <div className="right-panel-section">
              <div className="right-panel-section-title">分享码</div>
              {prompt.shareCode ? (
                <div>
                  <div className="share-code-wrapper" style={{ marginBottom: 8 }}>
                    <input className="share-code-input" value={prompt.shareCode} readOnly style={{ fontSize: 11 }} />
                    <button className="share-btn" style={{ padding: '8px 12px', fontSize: 12 }} onClick={handleCopyShareCode}>复制</button>
                  </div>
                  <button className="share-btn secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={handleGenerateShareCode}>重新生成</button>
                </div>
              ) : (
                <button className="share-btn" style={{ fontSize: 12, padding: '8px 14px' }} onClick={handleGenerateShareCode}>生成分享码</button>
              )}
            </div>

            {/* Import */}
            <div className="right-panel-section">
              <div className="right-panel-section-title">导入分享码</div>
              <div className="share-code-wrapper">
                <input
                  className="share-code-input"
                  value={importCode}
                  onChange={e => setImportCode(e.target.value)}
                  placeholder="粘贴分享码..."
                  style={{ fontSize: 12 }}
                />
                <button className="share-btn" style={{ padding: '8px 12px', fontSize: 12 }} onClick={handleImportShareCode}>导入</button>
              </div>
            </div>

            {/* Export */}
            <div className="right-panel-section">
              <div className="right-panel-section-title">导出</div>
              <button className="share-btn secondary" style={{ fontSize: 12, padding: '8px 14px' }} onClick={handleExportJson}>
                导出 JSON
              </button>
            </div>

            {/* Collaborators */}
            <div className="right-panel-section">
              <div className="right-panel-section-title">协作者</div>
              <div className="share-code-wrapper" style={{ marginBottom: 10 }}>
                <input
                  className="share-code-input"
                  value={newCollaborator}
                  onChange={e => setNewCollaborator(e.target.value)}
                  placeholder="协作者名称..."
                  style={{ fontSize: 12 }}
                  onKeyDown={e => e.key === 'Enter' && handleAddCollaborator()}
                />
                <button className="share-btn" style={{ padding: '8px 12px', fontSize: 12 }} onClick={handleAddCollaborator}>添加</button>
              </div>
              <div className="collab-list">
                <div className="collab-item">
                  <div className="collab-avatar" style={{ background: getAvatarColor(prompt.author), width: 24, height: 24, fontSize: 10 }}>
                    {prompt.author.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="collab-name" style={{ fontSize: 12 }}>{prompt.author}</div>
                    <div className="collab-role" style={{ fontSize: 10 }}>创建者</div>
                  </div>
                </div>
                {prompt.collaborators.map(name => (
                  <div key={name} className="collab-item">
                    <div className="collab-avatar" style={{ background: getAvatarColor(name), width: 24, height: 24, fontSize: 10 }}>
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="collab-name" style={{ fontSize: 12 }}>{name}</div>
                      <div className="collab-role" style={{ fontSize: 10 }}>协作者</div>
                    </div>
                    <button className="collab-remove" onClick={() => handleRemoveCollaborator(name)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      case 'info':
        return (
          <div className="right-panel-body">
            <div className="right-panel-section">
              <div className="right-panel-section-title">统计</div>
              <div className="info-stats">
                <div className="info-stat-row"><span>字符数</span><span>{charCount}</span></div>
                <div className="info-stat-row"><span>词数</span><span>{wordCount}</span></div>
                <div className="info-stat-row"><span>变量</span><span>{varCount}</span></div>
                <div className="info-stat-row"><span>版本</span><span>{prompt.versions.length}</span></div>
                <div className="info-stat-row"><span>调试次数</span><span>{prompt.debugRecords.length}</span></div>
                <div className="info-stat-row"><span>使用次数</span><span>{prompt.useCount || 0}</span></div>
              </div>
            </div>

            <div className="right-panel-section">
              <div className="right-panel-section-title">时间</div>
              <div className="info-stats">
                <div className="info-stat-row">
                  <span>创建</span>
                  <span>{(() => { try { return formatDistanceToNow(new Date(prompt.createdAt), { addSuffix: true, locale: zhCN }) } catch { return '' } })()}</span>
                </div>
                <div className="info-stat-row">
                  <span>修改</span>
                  <span>{(() => { try { return formatDistanceToNow(new Date(prompt.updatedAt), { addSuffix: true, locale: zhCN }) } catch { return '' } })()}</span>
                </div>
                {prompt.lastUsedAt && (
                  <div className="info-stat-row">
                    <span>使用</span>
                    <span>{(() => { try { return formatDistanceToNow(new Date(prompt.lastUsedAt), { addSuffix: true, locale: zhCN }) } catch { return '' } })()}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="right-panel-section">
              <div className="right-panel-section-title">操作</div>
              <div className="editor-actions">
                <button className="editor-action-btn" onClick={handleCopyContent}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  复制内容
                </button>
                <button className="editor-action-btn" onClick={() => duplicatePrompt(prompt.id)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                  创建副本
                </button>
                <button className="editor-action-btn danger" onClick={handleDelete}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  删除提示词
                </button>
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="editor-container">
      <div className="editor-main">
        <div className="editor-header">
          <input
            className="editor-title-input"
            value={prompt.title}
            onChange={e => updatePrompt(prompt.id, { title: e.target.value })}
            placeholder="提示词标题"
          />
          <input
            className="editor-desc-input"
            value={prompt.description}
            onChange={e => updatePrompt(prompt.id, { description: e.target.value })}
            placeholder="添加描述..."
          />
          <div className="editor-meta">
            <div className="editor-meta-item">
              <span className="editor-meta-label">分类</span>
              <select
                className="editor-meta-select"
                value={prompt.category}
                onChange={e => updatePrompt(prompt.id, { category: e.target.value })}
              >
                {DEFAULT_CATEGORIES.filter(c => c !== '全部').map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="editor-meta-item">
              <span className="editor-meta-label">标签</span>
              <input
                className="editor-tags-input"
                value={prompt.tags.join(', ')}
                onChange={e => handleTagsChange(e.target.value)}
                placeholder="逗号分隔..."
              />
            </div>
          </div>
        </div>

        <div className="editor-body">
          <div className="editor-section">
            <div className="editor-section-title">提示词内容</div>
            <textarea
              className="editor-textarea"
              value={prompt.content}
              onChange={e => handleContentChange(e.target.value)}
              placeholder={'在此输入提示词内容...\n\n使用 {{变量名}} 定义可替换变量\n例如：请将 {{text}} 翻译成 {{language}}'}
            />
            <div className="char-count">
              <span className="char-count-item">{charCount} 字符</span>
              <span className="char-count-item">{wordCount} 词</span>
              <span className="char-count-item">{varCount} 变量</span>
            </div>
          </div>

          <div className="editor-section">
            <div className="editor-section-title">变量定义 ({prompt.variables.length})</div>
            <div className="variables-list">
              {prompt.variables.map((v, idx) => (
                <div key={v.name} className="variable-row">
                  <span className="variable-badge">{`{{${v.name}}}`}</span>
                  <input
                    className="variable-input"
                    value={v.description}
                    onChange={e => handleVariableUpdate(idx, { description: e.target.value })}
                    placeholder="变量描述"
                  />
                  <input
                    className="variable-input"
                    value={v.defaultValue}
                    onChange={e => handleVariableUpdate(idx, { defaultValue: e.target.value })}
                    placeholder="默认值"
                    style={{ maxWidth: 150 }}
                  />
                  <button className="variable-remove" onClick={() => handleRemoveVariable(idx)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ))}
            </div>
            <button className="add-variable-btn" onClick={handleAddVariable}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              添加变量
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel with Tabs */}
      <div className="editor-sidebar">
        <div className="right-panel-tabs">
          {tabItems.map(tab => (
            <button
              key={tab.key}
              className={`right-panel-tab ${rightPanelTab === tab.key ? 'active' : ''}`}
              onClick={() => setRightPanelTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {renderRightPanel()}
      </div>

      {/* Version Modal */}
      {showVersionModal && (
        <div className="modal-overlay" onClick={() => setShowVersionModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">保存版本</div>
            </div>
            <div className="modal-body">
              <input
                className="modal-input"
                value={versionNote}
                onChange={e => setVersionNote(e.target.value)}
                placeholder="版本备注 (可选)"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleSaveVersion()}
              />
            </div>
            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={() => setShowVersionModal(false)}>取消</button>
              <button className="modal-btn primary" onClick={handleSaveVersion}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Editor
