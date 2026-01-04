import { autoUpdater } from 'electron-updater'
import { BrowserWindow, ipcMain } from 'electron'
import { logger } from './logger'

// Helper to safely send messages to the window
function safeSend(window: BrowserWindow, channel: string, ...args: unknown[]): void {
  if (!window.isDestroyed()) {
    window.webContents.send(channel, ...args)
  }
}

export function initAutoUpdater(mainWindow: BrowserWindow): void {
  // Disable auto-download, let user confirm
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  // Event handlers
  autoUpdater.on('checking-for-update', () => {
    logger.log('Checking for updates...')
  })

  autoUpdater.on('update-available', (info) => {
    logger.log('Update available:', info.version)
    safeSend(mainWindow, 'update:available', {
      version: info.version,
      releaseNotes: info.releaseNotes
    })
  })

  autoUpdater.on('update-not-available', () => {
    logger.log('No updates available')
  })

  autoUpdater.on('download-progress', (progress) => {
    safeSend(mainWindow, 'update:progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond
    })
  })

  autoUpdater.on('update-downloaded', () => {
    logger.log('Update downloaded')
    safeSend(mainWindow, 'update:ready')
  })

  autoUpdater.on('error', (error) => {
    logger.error('Auto-updater error:', error)
  })

  // IPC handlers
  ipcMain.handle('update:check', async () => {
    try {
      return await autoUpdater.checkForUpdates()
    } catch (error) {
      logger.error('Update check failed:', error)
      return null
    }
  })

  ipcMain.handle('update:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      logger.error('Update download failed:', error)
      throw error
    }
  })

  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall()
  })

  // Check for updates on startup after a short delay to allow the app to fully initialize
  setTimeout(() => {
    if (!mainWindow.isDestroyed()) {
      autoUpdater.checkForUpdates().catch((err) => {
        logger.error('Initial update check failed:', err)
      })
    }
  }, 5000)
}
