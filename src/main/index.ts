import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { join, dirname } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { autoUpdater, UpdateInfo } from 'electron-updater'
import { spawn } from 'child_process'
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
    log.info('[install-update] User requested install-update')
    isQuittingForUpdate = true

    // Stop periodic update checks
    if (updateCheckInterval) {
      clearInterval(updateCheckInterval)
      updateCheckInterval = null
    }

    try {
      // 1. Find the downloaded zip in electron-updater's cache
      const updaterCacheDir = join(app.getPath('home'), 'Library', 'Caches', 'promptcraft-updater', 'pending')
      log.info(`[install-update] Looking for update zip in: ${updaterCacheDir}`)

      if (!existsSync(updaterCacheDir)) {
        log.error('[install-update] Updater cache directory not found')
        isQuittingForUpdate = false
        return { success: false, error: '未找到已下载的更新文件' }
      }

      const files = readdirSync(updaterCacheDir)
      log.info(`[install-update] Files in cache: ${files.join(', ')}`)
      const zipFile = files.find(f => f.endsWith('.zip'))
      if (!zipFile) {
        log.error('[install-update] No zip file found in updater cache')
        isQuittingForUpdate = false
        return { success: false, error: '未找到更新包' }
      }

      const zipPath = join(updaterCacheDir, zipFile)
      log.info(`[install-update] Found update zip: ${zipPath}`)

      // 2. Determine the current app bundle path
      const appPath = app.getAppPath()
      log.info(`[install-update] app.getAppPath() = ${appPath}`)

      let appBundlePath = appPath
      const contentsIndex = appPath.indexOf('.app/Contents')
      if (contentsIndex !== -1) {
        appBundlePath = appPath.substring(0, contentsIndex + 4)
      } else {
        let current = appPath
        while (current !== '/' && !current.endsWith('.app')) {
          current = dirname(current)
        }
        if (current.endsWith('.app')) {
          appBundlePath = current
        }
      }
      log.info(`[install-update] App bundle path: ${appBundlePath}`)

      const appBundleParent = dirname(appBundlePath)
      log.info(`[install-update] App bundle parent: ${appBundleParent}`)

      const pid = process.pid
      log.info(`[install-update] Current PID: ${pid}`)

      // 3. Create a shell script that:
      //    - Waits for this process to fully exit (by PID)
      //    - Removes the old app bundle
      //    - Extracts the new app from the zip
      //    - Removes quarantine xattr
      //    - Launches the new app
      //    - Logs everything for debugging
      const scriptPath = join(app.getPath('temp'), 'promptcraft-update.sh')
      const logPath = join(app.getPath('temp'), 'promptcraft-update.log')
      const script = `#!/bin/bash
exec > "${logPath}" 2>&1
echo "=== PromptCraft Update Script ==="
echo "Started at: $(date)"
echo "Waiting for PID ${pid} to exit..."

# Wait for the Electron process to fully exit (up to 10 seconds)
for i in $(seq 1 20); do
  if ! kill -0 ${pid} 2>/dev/null; then
    echo "PID ${pid} has exited after $((i * 500))ms"
    break
  fi
  sleep 0.5
done

# Double check
if kill -0 ${pid} 2>/dev/null; then
  echo "WARNING: PID ${pid} still alive after 10s, proceeding anyway"
fi

echo "Removing old app bundle: ${appBundlePath}"
rm -rf "${appBundlePath}"
echo "rm result: $?"

echo "Extracting zip: ${zipPath} -> ${appBundleParent}"
/usr/bin/ditto -xk "${zipPath}" "${appBundleParent}"
echo "ditto result: $?"

echo "Removing quarantine attribute"
xattr -rd com.apple.quarantine "${appBundlePath}" 2>/dev/null

echo "Verifying new app exists:"
ls -la "${appBundlePath}/Contents/Info.plist" 2>/dev/null
NEW_VERSION=$(/usr/libexec/PlistBuddy -c "Print CFBundleShortVersionString" "${appBundlePath}/Contents/Info.plist" 2>/dev/null)
echo "New version: $NEW_VERSION"

echo "Launching new app: ${appBundlePath}"
open "${appBundlePath}"
echo "open result: $?"

echo "Cleaning up script"
rm -f "${scriptPath}"
echo "=== Update complete at: $(date) ==="
`

      writeFileSync(scriptPath, script, { mode: 0o755 })
      log.info(`[install-update] Created update script at: ${scriptPath}`)
      log.info(`[install-update] Update log will be at: ${logPath}`)

      // 4. Spawn the script as a fully detached process
      const child = spawn('/bin/bash', [scriptPath], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env }
      })
      child.unref()
      log.info(`[install-update] Script spawned with PID: ${child.pid}, exiting app now...`)

      // 5. Exit the app — the script will wait for us to die, then replace + relaunch
      setTimeout(() => {
        app.exit(0)
      }, 200)

      return { success: true }
    } catch (error: any) {
      log.error('[install-update] Install update failed:', error)
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
