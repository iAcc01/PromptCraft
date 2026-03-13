import React, { useState } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { v4 as uuidv4 } from 'uuid'

interface ShareProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

const Share: React.FC<ShareProps> = ({ showToast }) => {
  const { getSelectedPrompt, updatePrompt, addPrompt } = useAppStore()
  const prompt = getSelectedPrompt()
  const [newCollaborator, setNewCollaborator] = useState('')
  const [importCode, setImportCode] = useState('')

  if (!prompt) return null

  const handleGenerateShareCode = () => {
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
    if (prompt.shareCode) {
      navigator.clipboard.writeText(prompt.shareCode)
      showToast('分享码已复制到剪贴板', 'success')
    }
  }

  const handleImport = () => {
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

  const handleAddCollaborator = () => {
    if (!newCollaborator.trim()) return
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
    updatePrompt(prompt.id, {
      collaborators: prompt.collaborators.filter(c => c !== name)
    })
    showToast('协作者已移除', 'success')
  }

  const handleExportJson = () => {
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

  const getAvatarColor = (name: string) => {
    const colors = [
      'linear-gradient(135deg, #667eea, #764ba2)',
      'linear-gradient(135deg, #f093fb, #f5576c)',
      'linear-gradient(135deg, #4facfe, #00f2fe)',
      'linear-gradient(135deg, #43e97b, #38f9d7)',
      'linear-gradient(135deg, #fa709a, #fee140)',
      'linear-gradient(135deg, #a18cd1, #fbc2eb)'
    ]
    const index = name.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) % colors.length
    return colors[index]
  }

  return (
    <div className="content-area">
      <div className="share-container">
        {/* Share Code */}
        <div className="share-card">
          <div className="share-card-title">分享提示词</div>
          <div className="share-card-desc">
            生成一个分享码，其他人可以通过分享码导入你的提示词。分享码中包含提示词的内容、变量定义等完整信息。
          </div>

          {prompt.shareCode ? (
            <div>
              <div className="share-code-wrapper">
                <input
                  className="share-code-input"
                  value={prompt.shareCode}
                  readOnly
                />
                <button className="share-btn" onClick={handleCopyShareCode}>
                  复制
                </button>
              </div>
              <div style={{ marginTop: 10 }}>
                <button
                  className="share-btn secondary"
                  style={{ fontSize: 12 }}
                  onClick={handleGenerateShareCode}
                >
                  重新生成
                </button>
              </div>
            </div>
          ) : (
            <button className="share-btn" onClick={handleGenerateShareCode}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4, verticalAlign: 'middle' }}>
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              生成分享码
            </button>
          )}
        </div>

        {/* Import */}
        <div className="share-card">
          <div className="share-card-title">导入提示词</div>
          <div className="share-card-desc">
            粘贴他人的分享码来导入提示词。导入后会在你的提示词库中创建一个新的副本。
          </div>
          <div className="share-code-wrapper">
            <input
              className="share-code-input"
              value={importCode}
              onChange={e => setImportCode(e.target.value)}
              placeholder="粘贴分享码..."
            />
            <button className="share-btn" onClick={handleImport}>
              导入
            </button>
          </div>
        </div>

        {/* Export */}
        <div className="share-card">
          <div className="share-card-title">导出</div>
          <div className="share-card-desc">
            将提示词导出为 JSON 文件，便于备份或在其他工具中使用。
          </div>
          <button className="share-btn secondary" onClick={handleExportJson}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4, verticalAlign: 'middle' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            导出 JSON
          </button>
        </div>

        {/* Collaborators */}
        <div className="share-card">
          <div className="share-card-title">协作者</div>
          <div className="share-card-desc">
            添加协作者共同编辑和改进提示词。协作者可以修改内容、添加版本、提供反馈。
          </div>

          <div className="share-code-wrapper" style={{ marginBottom: 16 }}>
            <input
              className="share-code-input"
              value={newCollaborator}
              onChange={e => setNewCollaborator(e.target.value)}
              placeholder="输入协作者名称..."
              onKeyDown={e => e.key === 'Enter' && handleAddCollaborator()}
            />
            <button className="share-btn" onClick={handleAddCollaborator}>
              添加
            </button>
          </div>

          <div className="collab-list">
            {/* Author */}
            <div className="collab-item">
              <div className="collab-avatar" style={{ background: getAvatarColor(prompt.author) }}>
                {prompt.author.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="collab-name">{prompt.author}</div>
                <div className="collab-role">创建者</div>
              </div>
            </div>

            {/* Collaborators */}
            {prompt.collaborators.map(name => (
              <div key={name} className="collab-item">
                <div className="collab-avatar" style={{ background: getAvatarColor(name) }}>
                  {name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="collab-name">{name}</div>
                  <div className="collab-role">协作者</div>
                </div>
                <button className="collab-remove" onClick={() => handleRemoveCollaborator(name)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}

            {prompt.collaborators.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '8px 0', textAlign: 'center' }}>
                暂无协作者
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Share
