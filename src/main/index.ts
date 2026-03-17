import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { join, dirname } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { autoUpdater, UpdateInfo } from 'electron-updater'
import { execFile } from 'child_process'
import * as log from 'electron-log'

// ─── Logging Setup ───────────────────────────────────────────────
log.transports.file.level = 'info'
autoUpdater.logger = log

// ─── Auto-Update Configuration ──────────────────────────────────
autoUpdater.autoDownload = false          // Don't auto-download; wait for user confirmation
autoUpdater.autoInstallOnAppQuit = false  // We handle install ourselves (Squirrel fails on unsigned apps)
autoUpdater.allowPrerelease = false

// ─── Data Paths ─────────────────────────────────────────────────
const DATA_DIR = join(app.getPath('userData'), 'promptcraft-data')
const PROMPTS_FILE = join(DATA_DIR, 'prompts.json')

let isQuittingForUpdate = false
let updateCheckInterval: ReturnType<typeof setInterval> | null = null

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
    // Stop periodic checks to avoid interfering with Squirrel's install process
    if (updateCheckInterval) {
      clearInterval(updateCheckInterval)
      updateCheckInterval = null
      log.info('Stopped periodic update checks after download completed')
    }
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

  ipcMain.handle('install-update', async () => {
    log.info('User requested install-update')
    isQuittingForUpdate = true

    // Stop periodic update checks
    if (updateCheckInterval) {
      clearInterval(updateCheckInterval)
      updateCheckInterval = null
    }

    try {
      // 1. Find the downloaded zip in electron-updater's cache
      //    electron-updater stores downloads in ~/Library/Caches/<updaterCacheDirName>/pending/
      const updaterCacheDir = join(app.getPath('home'), 'Library', 'Caches', 'promptcraft-updater', 'pending')
      log.info(`Looking for update zip in: ${updaterCacheDir}`)

      if (!existsSync(updaterCacheDir)) {
        log.error('Updater cache directory not found')
        return { success: false, error: '未找到已下载的更新文件' }
      }

      const files = readdirSync(updaterCacheDir)
      const zipFile = files.find(f => f.endsWith('.zip'))
      if (!zipFile) {
        log.error('No zip file found in updater cache')
        return { success: false, error: '未找到更新包' }
      }

      const zipPath = join(updaterCacheDir, zipFile)
      log.info(`Found update zip: ${zipPath}`)

      // 2. Determine the current app bundle path
      //    app.getAppPath() returns something like /Applications/PromptCraft.app/Contents/Resources/app.asar
      //    We need the .app directory
      const appPath = app.getAppPath()
      let appBundlePath = appPath
      const contentsIndex = appPath.indexOf('.app/Contents')
      if (contentsIndex !== -1) {
        appBundlePath = appPath.substring(0, contentsIndex + 4) // include '.app'
      } else {
        // Fallback: try to find the .app parent
        let current = appPath
        while (current !== '/' && !current.endsWith('.app')) {
          current = dirname(current)
        }
        if (current.endsWith('.app')) {
          appBundlePath = current
        }
      }
      log.info(`Current app bundle: ${appBundlePath}`)

      const appBundleParent = dirname(appBundlePath)

      // 3. Create a shell script that will:
      //    - Wait for the current process to exit
      //    - Remove the old app bundle
      //    - Unzip the new app to the same location
      //    - Launch the new app
      //    - Clean up itself
      const scriptPath = join(app.getPath('temp'), 'promptcraft-update.sh')
      const script = `#!/bin/bash
# Wait for the old app process to exit
sleep 1

# Remove old app bundle
rm -rf "${appBundlePath}"

# Unzip new app to the parent directory
/usr/bin/ditto -xk "${zipPath}" "${appBundleParent}"

# Remove quarantine attribute (unsigned app)
xattr -rd com.apple.quarantine "${appBundlePath}" 2>/dev/null

# Launch the new app
open "${appBundlePath}"

# Clean up
rm -f "${scriptPath}"
`

      writeFileSync(scriptPath, script, { mode: 0o755 })
      log.info(`Created update script at: ${scriptPath}`)

      // 4. Execute the script in background (detached)
      const child = execFile('/bin/bash', [scriptPath], {
        detached: true,
        stdio: 'ignore'
      })
      child.unref()
      log.info('Update script launched, exiting app...')

      // 5. Quit the app
      app.exit(0)

      return { success: true }
    } catch (error: any) {
      log.error('Install update failed:', error)
      isQuittingForUpdate = false
      return { success: false, error: error?.message || '安装更新失败' }
    }
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
    updateCheckInterval = setInterval(() => {
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
