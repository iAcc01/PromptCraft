import React, { useState, useEffect } from 'react'

// Access electron ipcRenderer via nodeIntegration
const { ipcRenderer } = window.require('electron')

interface UpdateInfo {
  version: string
  releaseDate?: string
  releaseNotes?: string
}

interface DownloadProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

const UpdateNotification: React.FC = () => {
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    // Get current app version
    ipcRenderer.invoke('get-app-version').then((v: string) => setAppVersion(v))

    // Listen for update events from main process
    const onChecking = () => {
      // Only show 'checking' if we're not already in a meaningful state
      // Prevents periodic check from dismissing an active update prompt
      setStatus((prev) => {
        if (prev === 'available' || prev === 'downloading' || prev === 'downloaded') {
          return prev
        }
        return 'checking'
      })
      setError(null)
    }

    const onAvailable = (_e: any, info: UpdateInfo) => {
      setStatus('available')
      setUpdateInfo(info)
      setDismissed(false)
    }

    const onNotAvailable = (_e: any, info: { version: string }) => {
      // Don't override if we already have a download ready
      setStatus((prev) => {
        if (prev === 'downloaded') return prev
        return 'not-available'
      })
      setUpdateInfo({ version: info.version })
    }

    const onProgress = (_e: any, prog: DownloadProgress) => {
      setStatus('downloading')
      setProgress(prog)
      setDismissed(false)
    }

    const onDownloaded = (_e: any, info: UpdateInfo) => {
      setStatus('downloaded')
      setUpdateInfo(info)
      setProgress(null)
      setDismissed(false)
    }

    const onError = (_e: any, data: { message: string }) => {
      // Don't override 'downloaded' state with error from periodic re-check
      setStatus((prev) => {
        if (prev === 'downloaded') return prev
        return 'error'
      })
      setError(data?.message || '更新检查失败')
    }

    ipcRenderer.on('update-checking', onChecking)
    ipcRenderer.on('update-available', onAvailable)
    ipcRenderer.on('update-not-available', onNotAvailable)
    ipcRenderer.on('update-download-progress', onProgress)
    ipcRenderer.on('update-downloaded', onDownloaded)
    ipcRenderer.on('update-error', onError)

    return () => {
      ipcRenderer.removeListener('update-checking', onChecking)
      ipcRenderer.removeListener('update-available', onAvailable)
      ipcRenderer.removeListener('update-not-available', onNotAvailable)
      ipcRenderer.removeListener('update-download-progress', onProgress)
      ipcRenderer.removeListener('update-downloaded', onDownloaded)
      ipcRenderer.removeListener('update-error', onError)
    }
  }, [])

  const handleInstall = () => {
    ipcRenderer.invoke('install-update')
  }

  const handleStartDownload = () => {
    ipcRenderer.invoke('start-download')
  }

  const handleCheckUpdate = () => {
    ipcRenderer.invoke('check-for-updates')
  }

  const handleDismiss = () => {
    setDismissed(true)
  }

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Don't show anything if idle, not-available, checking, or user dismissed
  if (status === 'idle' || status === 'not-available' || status === 'checking') {
    return null
  }

  if (dismissed) {
    return null
  }

  // Error state — show briefly then auto-hide
  if (status === 'error') {
    return null // Errors are silent — logged but not shown to user
  }

  return (
    <div className="update-notification">
      {/* Downloading */}
      {status === 'downloading' && progress && (
        <div className="update-banner update-banner-downloading">
          <div className="update-banner-content">
            <div className="update-banner-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sync-spin">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </div>
            <div className="update-banner-text">
              <span className="update-banner-title">
                正在下载更新 v{updateInfo?.version}
              </span>
              <span className="update-banner-detail">
                {progress.percent.toFixed(0)}% · {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
              </span>
            </div>
          </div>
          <div className="update-progress-bar">
            <div
              className="update-progress-fill"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Update available — ask user to confirm download */}
      {status === 'available' && (
        <div className="update-banner update-banner-available">
          <div className="update-banner-content">
            <div className="update-banner-icon update-banner-icon-info">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div className="update-banner-text">
              <span className="update-banner-title">
                发现新版本 v{updateInfo?.version}
              </span>
              <span className="update-banner-detail">
                有新版本可供更新，是否立即下载？
              </span>
            </div>
          </div>
          <div className="update-banner-actions">
            <button className="update-later-btn" onClick={handleDismiss}>
              稍后
            </button>
            <button className="update-install-btn" onClick={handleStartDownload}>
              立即更新
            </button>
          </div>
        </div>
      )}

      {/* Downloaded — ready to install */}
      {status === 'downloaded' && (
        <div className="update-banner update-banner-ready">
          <div className="update-banner-content">
            <div className="update-banner-icon update-banner-icon-success">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div className="update-banner-text">
              <span className="update-banner-title">
                v{updateInfo?.version} 已下载完成
              </span>
              <span className="update-banner-detail">
                重启应用即可完成更新
              </span>
            </div>
          </div>
          <div className="update-banner-actions">
            <button className="update-later-btn" onClick={handleDismiss}>
              稍后
            </button>
            <button className="update-install-btn" onClick={handleInstall}>
              立即重启
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UpdateNotification
