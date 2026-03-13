import React, { useState } from 'react'
import { useAuthStore } from '../stores/useAuthStore'

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const { signIn, signUp, authError, clearError } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setSuccessMessage('')
    clearError()

    if (isLogin) {
      const result = await signIn(email, password)
      if (!result.success) {
        setLoading(false)
      }
    } else {
      const result = await signUp(email, password, displayName)
      if (result.success) {
        setSuccessMessage('注册成功！请检查您的邮箱完成验证，然后登录。')
        setIsLogin(true)
        setPassword('')
      }
      setLoading(false)
    }
  }

  const switchMode = () => {
    setIsLogin(!isLogin)
    clearError()
    setSuccessMessage('')
    setPassword('')
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-logo">
            <div className="auth-logo-icon">P</div>
            <h1 className="auth-logo-text">PromptCraft</h1>
          </div>
          <p className="auth-subtitle">
            {isLogin ? '登录以同步您的提示词' : '创建账户开始使用'}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="auth-field">
              <label className="auth-label">显示名称</label>
              <input
                className="auth-input"
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="输入您的名称"
                autoComplete="name"
              />
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label">邮箱地址</label>
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">密码</label>
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={isLogin ? '输入密码' : '至少 6 个字符'}
              required
              minLength={6}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
          </div>

          {authError && (
            <div className="auth-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span>{authError}</span>
            </div>
          )}

          {successMessage && (
            <div className="auth-success">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>{successMessage}</span>
            </div>
          )}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? (
              <span className="auth-spinner" />
            ) : (
              isLogin ? '登录' : '注册'
            )}
          </button>
        </form>

        <div className="auth-switch">
          <span className="auth-switch-text">
            {isLogin ? '还没有账户？' : '已有账户？'}
          </span>
          <button className="auth-switch-btn" onClick={switchMode} type="button">
            {isLogin ? '立即注册' : '立即登录'}
          </button>
        </div>

        <div className="auth-divider">
          <span>或</span>
        </div>

        <p className="auth-offline-hint">
          您也可以在未登录时使用本地模式，数据仅保存在本设备。
        </p>
      </div>
    </div>
  )
}

export default Auth
