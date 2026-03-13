import React, { useState, useMemo } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface DebugProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

const Debug: React.FC<DebugProps> = ({ showToast }) => {
  const { getSelectedPrompt, addDebugRecord, updatePrompt } = useAppStore()
  const prompt = getSelectedPrompt()

  const [variableValues, setVariableValues] = useState<Record<string, string>>(() => {
    if (!prompt) return {}
    const values: Record<string, string> = {}
    prompt.variables.forEach(v => {
      values[v.name] = v.defaultValue
    })
    return values
  })

  const [activeTab, setActiveTab] = useState<'variables' | 'history'>('variables')
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)

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
    // Replace filled variables with highlighted spans
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

  const handleRun = () => {
    if (!prompt) return
    addDebugRecord(prompt.id, {
      variables: { ...variableValues },
      renderedContent,
      response: '',
      rating: 0
    })
    navigator.clipboard.writeText(renderedContent)
    showToast('已渲染并复制到剪贴板，可粘贴到 AI 对话中测试', 'success')
  }

  const handleRating = (recordId: string, rating: number) => {
    if (!prompt) return
    const updatedRecords = prompt.debugRecords.map(r =>
      r.id === recordId ? { ...r, rating } : r
    )
    updatePrompt(prompt.id, { debugRecords: updatedRecords })
  }

  const handleCopyRendered = () => {
    navigator.clipboard.writeText(renderedContent)
    showToast('已复制渲染结果', 'success')
  }

  const handleLoadHistory = (recordId: string) => {
    const record = prompt?.debugRecords.find(r => r.id === recordId)
    if (record) {
      setVariableValues(record.variables)
      setSelectedHistoryId(recordId)
      setActiveTab('variables')
      showToast('已加载历史变量', 'info')
    }
  }

  if (!prompt) return null

  return (
    <div className="debug-container">
      {/* Left Panel: Variables Input */}
      <div className="debug-left">
        <div className="debug-panel-header">
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="tab-bar">
              <button
                className={`tab-item ${activeTab === 'variables' ? 'active' : ''}`}
                onClick={() => setActiveTab('variables')}
              >
                变量输入
              </button>
              <button
                className={`tab-item ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                调试历史 ({prompt.debugRecords.length})
              </button>
            </div>
          </div>
        </div>

        <div className="debug-panel-body">
          {activeTab === 'variables' ? (
            <>
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
                </>
              )}

              <button className="debug-run-btn" onClick={handleRun}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                渲染并复制
              </button>
            </>
          ) : (
            <>
              {prompt.debugRecords.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 20px' }}>
                  <div className="empty-state-icon" style={{ width: 48, height: 48 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                  </div>
                  <div className="empty-state-title">暂无调试记录</div>
                  <div className="empty-state-desc">点击"渲染并复制"生成第一条调试记录</div>
                </div>
              ) : (
                prompt.debugRecords.map(record => (
                  <div
                    key={record.id}
                    className={`debug-history-item ${selectedHistoryId === record.id ? 'selected' : ''}`}
                    onClick={() => handleLoadHistory(record.id)}
                  >
                    <div className="debug-history-time">
                      {(() => {
                        try {
                          return formatDistanceToNow(new Date(record.timestamp), { addSuffix: true, locale: zhCN })
                        } catch {
                          return ''
                        }
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
                          onClick={e => {
                            e.stopPropagation()
                            handleRating(record.id, star)
                          }}
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* Right Panel: Preview */}
      <div className="debug-right">
        <div className="debug-panel-header">
          <span className="debug-panel-title">渲染预览</span>
          <button
            className="share-btn secondary"
            style={{ padding: '6px 14px', fontSize: 12 }}
            onClick={handleCopyRendered}
          >
            复制
          </button>
        </div>
        <div className="debug-panel-body">
          <div
            className="debug-rendered"
            dangerouslySetInnerHTML={{ __html: highlightedContent }}
          />
        </div>
      </div>
    </div>
  )
}

export default Debug
