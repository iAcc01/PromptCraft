import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { autoUpdater, UpdateInfo } from 'electron-updater'
import * as log from 'electron-log'

// ─── Logging Setup ───────────────────────────────────────────────
log.transports.file.level = 'info'
autoUpdater.logger = log

// ─── Auto-Update Configuration ──────────────────────────────────
autoUpdater.autoDownload = false          // Don't auto-download; wait for user confirmation
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.allowPrerelease = false

// ─── Data Paths ─────────────────────────────────────────────────
const DATA_DIR = join(app.getPath('userData'), 'promptcraft-data')
const PROMPTS_FILE = join(DATA_DIR, 'prompts.json')

let isQuittingForUpdate = false

let mainWindow: BrowserWindow | null = null

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
  if (!existsSync(PROMPTS_FILE)) {
    writeFileSync(PROMPTS_FILE, JSON.stringify([]))
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow = win

  win.on('closed', () => {
    mainWindow = null
  })

  return win
}

// ─── Send update status to renderer ─────────────────────────────
function sendUpdateStatus(channel: string, data?: any) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

// ─── Auto-Updater Events ────────────────────────────────────────
function setupAutoUpdater() {
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...')
    sendUpdateStatus('update-checking')
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    log.info('Update available:', info.version)
    sendUpdateStatus('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    })
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    log.info('Update not available. Current is latest:', info.version)
    sendUpdateStatus('update-not-available', {
      version: info.version
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    log.info(`Download progress: ${progress.percent.toFixed(1)}%`)
    sendUpdateStatus('update-download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    log.info('Update downloaded:', info.version)
    sendUpdateStatus('update-downloaded', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    })
  })

  autoUpdater.on('error', (error) => {
    log.error('Update error:', error)
    sendUpdateStatus('update-error', {
      message: error?.message || '更新检查失败'
    })
  })
}

// ─── App Lifecycle ──────────────────────────────────────────────
app.whenReady().then(() => {
  ensureDataDir()

  // ── Data IPC Handlers ──────────────────────────────────────
  ipcMain.handle('load-prompts', () => {
    const data = readFileSync(PROMPTS_FILE, 'utf-8')
    return JSON.parse(data)
  })

  ipcMain.handle('save-prompts', (_event, prompts) => {
    writeFileSync(PROMPTS_FILE, JSON.stringify(prompts, null, 2))
    return true
  })

  ipcMain.handle('export-prompt', async (_event, prompt) => {
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: `${prompt.title || 'prompt'}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (filePath) {
      writeFileSync(filePath, JSON.stringify(prompt, null, 2))
      return true
    }
    return false
  })

  ipcMain.handle('import-prompt', async () => {
    const { filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (filePaths.length > 0) {
      const data = readFileSync(filePaths[0], 'utf-8')
      return JSON.parse(data)
    }
    return null
  })

  ipcMain.handle('open-external', (_event, url: string) => {
    shell.openExternal(url)
  })

  // ── Auto-Update IPC Handlers ───────────────────────────────
  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { success: true, version: result?.updateInfo?.version }
    } catch (error: any) {
      log.error('Manual update check failed:', error)
      return { success: false, error: error?.message || '检查更新失败' }
    }
  })

  ipcMain.handle('install-update', () => {
    log.info('User requested install-update, quitting and installing...')
    isQuittingForUpdate = true

    // On macOS, quitAndInstall may not relaunch the app reliably.
    // Register a relaunch first so the OS restarts us after exit.
    app.relaunch()

    // Now quit and install the update.
    // autoInstallOnAppQuit=true ensures the update is applied on exit.
    autoUpdater.quitAndInstall(true, true)

    // If quitAndInstall didn't actually exit (known macOS issue), force it.
    // app.relaunch() was already registered, so app.exit() will trigger restart.
    setTimeout(() => {
      log.warn('quitAndInstall did not exit, forcing app.exit(0)')
      app.exit(0)
    }, 1500)
  })

  ipcMain.handle('start-download', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error: any) {
      log.error('Download update failed:', error)
      return { success: false, error: error?.message || '下载更新失败' }
    }
  })

  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
  })

  // ── Create Window & Setup Updater ──────────────────────────
  createWindow()
  setupAutoUpdater()

  // Check for updates after launch (delay 3s to let the app settle)
  if (!process.env.VITE_DEV_SERVER_URL) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        log.error('Auto update check on launch failed:', err)
      })
    }, 3000)

    // Periodic update check every 30 minutes
    setInterval(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        log.error('Periodic update check failed:', err)
      })
    }, 30 * 60 * 1000)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || isQuittingForUpdate) app.quit()
})
