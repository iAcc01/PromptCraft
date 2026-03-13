import React, { useState, useCallback, useMemo } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { DEFAULT_CATEGORIES, PromptVariable } from '../types'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

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
    getSelectedPrompt,
    setActiveView,
    selectPrompt
  } = useAppStore()

  const prompt = getSelectedPrompt()
  const [versionNote, setVersionNote] = useState('')
  const [showVersionModal, setShowVersionModal] = useState(false)

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

  const handleContentChange = useCallback((content: string) => {
    if (!prompt) return
    // Auto-detect variables
    const regex = /\{\{(\w+)\}\}/g
    const foundVars: string[] = []
    let match
    while ((match = regex.exec(content)) !== null) {
      if (!foundVars.includes(match[1])) foundVars.push(match[1])
    }

    // Merge with existing variables (preserve existing info)
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
    // Also remove from content
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
      setActiveView('library')
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

  const charCount = prompt?.content.length || 0
  const wordCount = prompt?.content.split(/\s+/).filter(Boolean).length || 0
  const varCount = prompt?.variables.length || 0

  if (!prompt) return null

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
              placeholder="在此输入提示词内容...&#10;&#10;使用 {{变量名}} 定义可替换变量&#10;例如：请将 {{text}} 翻译成 {{language}}"
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
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <button className="add-variable-btn" onClick={handleAddVariable}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              添加变量
            </button>
          </div>
        </div>
      </div>

      {/* Editor Sidebar */}
      <div className="editor-sidebar">
        <div className="editor-sidebar-section">
          <div className="editor-sidebar-title">操作</div>
          <div className="editor-actions">
            <button className="editor-action-btn" onClick={handleCopyContent}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              复制内容
            </button>
            <button className="editor-action-btn" onClick={() => duplicatePrompt(prompt.id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
              创建副本
            </button>
            <button className="editor-action-btn" onClick={() => setActiveView('debug')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
              进入调试
            </button>
            <button className="editor-action-btn danger" onClick={handleDelete}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              删除提示词
            </button>
          </div>
        </div>

        <div className="editor-sidebar-section">
          <div className="editor-sidebar-title">版本历史 ({prompt.versions.length})</div>
          <button className="save-version-btn" onClick={() => setShowVersionModal(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            保存当前版本
          </button>

          {prompt.versions.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '12px 0', textAlign: 'center' }}>
              暂无版本记录
            </div>
          ) : (
            [...prompt.versions].reverse().map(v => (
              <div key={v.id} className="version-item">
                <div className="version-info">
                  <div className="version-note">{v.note}</div>
                  <div className="version-date">
                    {(() => {
                      try {
                        return formatDistanceToNow(new Date(v.createdAt), { addSuffix: true, locale: zhCN })
                      } catch {
                        return ''
                      }
                    })()}
                  </div>
                </div>
                <button className="version-restore-btn" onClick={() => handleRestoreVersion(v.id)}>
                  恢复
                </button>
              </div>
            ))
          )}
        </div>
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
