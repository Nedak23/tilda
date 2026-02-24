import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { Resend } from 'resend'
import { logger, isDev } from './logger'
import { initAutoUpdater } from './auto-updater'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
import {
  initDatabase,
  closeDatabase,
  getAllTasks,
  createTask,
  updateTask,
  reopenTask,
  deleteTask,
  reorderTask,
  clearUnreadAgentMessage,
  migrateTasksToToday,
  getMessagesByTask,
  getMessagesByChat,
  createMessage,
  deleteMessage,
  deleteMessagesFromId,
  deleteMessagesFromChatId,
  updateMessageContent,
  getAttachmentsByTask,
  getPendingTaskAttachments,
  createAttachment,
  deleteAttachment,
  setUnreadAgentMessage,
  getChatsByTask,
  createChat,
  updateChatName,
  deleteChat,
  ensureDefaultChat,
  getTildaMessages,
  clearTildaMessages,
  deleteTildaMessage,
  deleteTildaMessagesFromId,
  updateTildaMessageContent,
  getTildaAttachments,
  getPendingTildaAttachments,
  createTildaAttachment,
  deleteTildaAttachment,
  clearTildaAttachments,
  getAllContexts,
  getContextById,
  createContext,
  updateContext,
  deleteContext,
  reorderContext,
  getContextForTask,
  setTaskContext,
  getTasksByContext,
  getDocumentsByContext,
  createContextDocument,
  deleteContextDocument,
  getAILearningNotesByContext,
  getAllAILearningNotes,
  createAILearningNote,
  updateAILearningNote,
  deleteAILearningNote
} from './database'
import { completeTaskWithLearning } from './learning-check'
import { sendMessage, cancelRequest, regenerateResponse, getProcessStatus } from './llm'
import { extractAndCleanup, cleanupOrphanedFolders, getWorkingFolder } from './claude-code'
import { getSettings, saveSettings, type Settings } from './settings'
import type { CreateTaskInput, UpdateTaskInput, MessageSender, CreateContextInput, UpdateContextInput, CreateAILearningNoteInput, UpdateAILearningNoteInput, FeedbackInput } from '../src/types'

// Lazy-initialized Resend client (only created when needed in production)
let resend: Resend | null = null
function getResendClient(): Resend | null {
  if (isDev) return null
  if (!process.env.RESEND_API_KEY) return null
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

// Rate limiting for feedback
let lastFeedbackTime = 0
const FEEDBACK_COOLDOWN_MS = 60000 // 1 minute

// HTML escaping helper to prevent injection
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 10 },
    backgroundColor: '#1C1C1E',
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Load the app
  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// IPC Handlers for Tasks
ipcMain.handle('tasks:getAll', () => {
  return getAllTasks()
})

ipcMain.handle('tasks:create', (_event, input: CreateTaskInput) => {
  return createTask(input)
})

ipcMain.handle('tasks:update', (_event, id: string, input: UpdateTaskInput) => {
  return updateTask(id, input)
})

ipcMain.handle('tasks:complete', async (_event, id: string) => {
  const { task, learningCheckPromise } = completeTaskWithLearning(id)

  // Handle learning check result asynchronously (don't block completion)
  learningCheckPromise
    .then(result => {
      if (result.noteSaved && result.note && mainWindow) {
        // Notify renderer about saved note
        mainWindow.webContents.send('ai-note:saved', result.note)
      }
    })
    .catch(err => logger.error('Learning check error:', err))

  // Extract useful content and cleanup working folder asynchronously
  extractAndCleanup(id).catch(err => logger.error('Extract and cleanup error:', err))

  return task
})

ipcMain.handle('tasks:reopen', (_event, id: string) => {
  return reopenTask(id)
})

ipcMain.handle('tasks:delete', (_event, id: string) => {
  deleteTask(id)
})

ipcMain.handle('tasks:reorder', (_event, id: string, newPosition: number) => {
  reorderTask(id, newPosition)
})

ipcMain.handle('tasks:clearUnread', (_event, id: string) => {
  clearUnreadAgentMessage(id)
})

ipcMain.handle('tasks:migrate', () => {
  migrateTasksToToday()
})

// IPC Handlers for Messages
ipcMain.handle('messages:getByTask', (_event, taskId: string) => {
  return getMessagesByTask(taskId)
})

ipcMain.handle('messages:getByChat', (_event, chatId: string) => {
  return getMessagesByChat(chatId)
})

ipcMain.handle('messages:create', (_event, taskId: string, content: string, sender: MessageSender, attachmentIds?: string[], chatId?: string) => {
  return createMessage(taskId, content, sender, attachmentIds, chatId)
})

ipcMain.handle('messages:delete', (_event, id: string) => {
  deleteMessage(id)
})

ipcMain.handle('messages:deleteFromId', (_event, taskId: string, messageId: string) => {
  deleteMessagesFromId(taskId, messageId)
})

ipcMain.handle('messages:deleteFromChatId', (_event, chatId: string, messageId: string) => {
  deleteMessagesFromChatId(chatId, messageId)
})

ipcMain.handle('messages:update', (_event, id: string, content: string) => {
  updateMessageContent(id, content)
})

// IPC Handlers for Chats
ipcMain.handle('chats:getByTask', (_event, taskId: string) => {
  return getChatsByTask(taskId)
})

ipcMain.handle('chats:create', (_event, taskId: string, name: string) => {
  return createChat(taskId, name)
})

ipcMain.handle('chats:updateName', (_event, id: string, name: string) => {
  updateChatName(id, name)
})

ipcMain.handle('chats:delete', (_event, id: string) => {
  deleteChat(id)
})

ipcMain.handle('chats:ensureDefault', (_event, taskId: string) => {
  return ensureDefaultChat(taskId)
})

// IPC Handlers for Attachments
ipcMain.handle('attachments:getByTask', (_event, taskId: string) => {
  return getAttachmentsByTask(taskId)
})

ipcMain.handle('attachments:getPending', (_event, taskId: string) => {
  return getPendingTaskAttachments(taskId)
})

ipcMain.handle('attachments:create', (_event, taskId: string, filename: string, content: string, mimeType: string, relativePath?: string) => {
  return createAttachment(taskId, filename, content, mimeType, relativePath)
})

ipcMain.handle('attachments:delete', (_event, id: string) => {
  deleteAttachment(id)
})

// IPC Handlers for LLM
// Track which task the user is currently viewing
let activeTaskId: string | null = null

ipcMain.handle('llm:sendMessage', async (event, taskId: string, chatId: string, userMessage: string, channel: string, attachmentIds?: string[]) => {
  try {
    const response = await sendMessage(taskId, chatId, userMessage, (chunk: string) => {
      event.sender.send(channel, chunk)
    }, attachmentIds)

    // If user navigated away during processing, mark as unread
    if (activeTaskId !== taskId) {
      setUnreadAgentMessage(taskId)
    }

    return response
  } catch (error) {
    throw error
  }
})

ipcMain.on('llm:cancel', (_event, chatId: string) => {
  cancelRequest(chatId)
})

ipcMain.handle('llm:regenerateResponse', async (event, taskId: string, chatId: string, channel: string) => {
  try {
    const response = await regenerateResponse(taskId, chatId, (chunk: string) => {
      event.sender.send(channel, chunk)
    })

    // If user navigated away during processing, mark as unread
    if (activeTaskId !== taskId) {
      setUnreadAgentMessage(taskId)
    }

    return response
  } catch (error) {
    throw error
  }
})

// Track active task from renderer
ipcMain.on('task:setActive', (_event, taskId: string | null) => {
  activeTaskId = taskId
})

// IPC Handlers for Settings
ipcMain.handle('settings:get', () => {
  return getSettings()
})

ipcMain.handle('settings:save', (_event, settings: Settings) => {
  saveSettings(settings)
})

// IPC Handlers for Contexts
ipcMain.handle('contexts:getAll', () => {
  return getAllContexts()
})

ipcMain.handle('contexts:getById', (_event, id: string) => {
  return getContextById(id)
})

ipcMain.handle('contexts:create', (_event, input: CreateContextInput) => {
  return createContext(input)
})

ipcMain.handle('contexts:update', (_event, id: string, input: UpdateContextInput) => {
  return updateContext(id, input)
})

ipcMain.handle('contexts:delete', (_event, id: string) => {
  deleteContext(id)
})

ipcMain.handle('contexts:reorder', (_event, id: string, newPosition: number) => {
  reorderContext(id, newPosition)
})

ipcMain.handle('contexts:getTaskContext', (_event, taskId: string) => {
  return getContextForTask(taskId)
})

ipcMain.handle('contexts:setTaskContext', (_event, taskId: string, contextId: string | null) => {
  setTaskContext(taskId, contextId)
})

ipcMain.handle('contexts:getTasksByContext', (_event, contextId: string) => {
  return getTasksByContext(contextId)
})

// IPC Handlers for Context Documents
ipcMain.handle('contextDocuments:getByContext', (_event, contextId: string) => {
  return getDocumentsByContext(contextId)
})

ipcMain.handle('contextDocuments:create', (_event, contextId: string, filename: string, content: string, mimeType: string, fileSize: number, relativePath?: string) => {
  return createContextDocument(contextId, filename, content, mimeType, fileSize, relativePath)
})

ipcMain.handle('contextDocuments:delete', (_event, id: string) => {
  deleteContextDocument(id)
})

// IPC Handler for directory selection
ipcMain.handle('dialog:selectDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  const dirPath = result.filePaths[0]
  const supportedExtensions = /\.(txt|md|markdown|pdf|png|jpg|jpeg|gif|webp)$/i
  const hiddenPattern = /(?:^|[/\\])\./

  const files: { filename: string; relativePath: string; content: string; mimeType: string; fileSize: number }[] = []

  function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.markdown': 'text/markdown',
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    }
    return mimeTypes[ext] || 'text/plain'
  }

  function isTextMime(mimeType: string): boolean {
    return mimeType.startsWith('text/')
  }

  function readDirectoryRecursive(currentPath: string, basePath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name)
      const relPath = path.relative(basePath, fullPath)

      // Skip hidden files/directories
      if (hiddenPattern.test(entry.name)) continue

      if (entry.isDirectory()) {
        readDirectoryRecursive(fullPath, basePath)
      } else if (entry.isFile() && supportedExtensions.test(entry.name)) {
        const stat = fs.statSync(fullPath)
        const mimeType = getMimeType(fullPath)
        let content: string

        if (isTextMime(mimeType)) {
          content = fs.readFileSync(fullPath, 'utf-8')
        } else {
          const buffer = fs.readFileSync(fullPath)
          content = `data:${mimeType};base64,${buffer.toString('base64')}`
        }

        files.push({
          filename: entry.name,
          relativePath: relPath,
          content,
          mimeType,
          fileSize: stat.size
        })
      }
    }
  }

  readDirectoryRecursive(dirPath, dirPath)
  return files
})

// IPC Handlers for AI Learning Notes
ipcMain.handle('aiNotes:getByContext', (_event, contextId: string) => {
  return getAILearningNotesByContext(contextId)
})

ipcMain.handle('aiNotes:getAll', () => {
  return getAllAILearningNotes()
})

ipcMain.handle('aiNotes:create', (_event, input: CreateAILearningNoteInput) => {
  return createAILearningNote(input)
})

ipcMain.handle('aiNotes:update', (_event, id: string, input: UpdateAILearningNoteInput) => {
  return updateAILearningNote(id, input)
})

ipcMain.handle('aiNotes:delete', (_event, id: string) => {
  deleteAILearningNote(id)
})

// IPC Handler for LLM process status
ipcMain.handle('llm:getProcessStatus', (_event, taskId: string) => {
  return getProcessStatus(taskId)
})

// IPC Handler for opening working folder in Finder
ipcMain.handle('shell:openWorkingFolder', async (_event, taskId: string) => {
  const folder = getWorkingFolder(taskId)
  if (fs.existsSync(folder)) {
    await shell.openPath(folder)
  }
})

// IPC Handler for listing working folder contents
ipcMain.handle('shell:listWorkingFolder', async (_event, taskId: string) => {
  const folder = getWorkingFolder(taskId)
  if (!fs.existsSync(folder)) {
    return []
  }

  interface WorkingFolderEntry {
    name: string
    relativePath: string
    isDirectory: boolean
    size?: number
    mimeType?: string
  }

  function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.markdown': 'text/markdown',
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.json': 'application/json',
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.html': 'text/html',
      '.css': 'text/css',
      '.py': 'text/x-python',
      '.rb': 'text/x-ruby',
      '.go': 'text/x-go',
      '.rs': 'text/x-rust',
      '.java': 'text/x-java',
      '.c': 'text/x-c',
      '.cpp': 'text/x-c++',
      '.h': 'text/x-c',
      '.sh': 'text/x-shellscript',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
      '.xml': 'text/xml',
      '.csv': 'text/csv',
      '.svg': 'image/svg+xml'
    }
    return mimeTypes[ext] || 'application/octet-stream'
  }

  const entries: WorkingFolderEntry[] = []

  function readDirectoryRecursive(currentPath: string, basePath: string) {
    const dirEntries = fs.readdirSync(currentPath, { withFileTypes: true })
    for (const entry of dirEntries) {
      // Skip hidden files/directories
      if (entry.name.startsWith('.')) continue

      const fullPath = path.join(currentPath, entry.name)
      const relPath = path.relative(basePath, fullPath)

      if (entry.isDirectory()) {
        entries.push({
          name: entry.name,
          relativePath: relPath,
          isDirectory: true
        })
        readDirectoryRecursive(fullPath, basePath)
      } else if (entry.isFile()) {
        const stat = fs.statSync(fullPath)
        entries.push({
          name: entry.name,
          relativePath: relPath,
          isDirectory: false,
          size: stat.size,
          mimeType: getMimeType(fullPath)
        })
      }
    }
  }

  readDirectoryRecursive(folder, folder)

  // Sort: folders first, then alphabetically
  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return entries
})

// IPC Handler for Feedback
ipcMain.handle('feedback:send', async (_event, input: FeedbackInput) => {
  // Disable feedback in development builds
  if (isDev) {
    logger.log('Feedback disabled in development mode')
    return { success: false, error: 'Feedback is disabled in development mode' }
  }

  // Get Resend client (returns null if not configured)
  const resendClient = getResendClient()
  if (!resendClient) {
    logger.error('RESEND_API_KEY environment variable is not set')
    return { success: false, error: 'Feedback service is not configured' }
  }

  // Rate limiting check
  const now = Date.now()
  if (now - lastFeedbackTime < FEEDBACK_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((FEEDBACK_COOLDOWN_MS - (now - lastFeedbackTime)) / 1000)
    return { success: false, error: `Please wait ${remainingSeconds} seconds before sending more feedback` }
  }

  try {
    const escapedMessage = escapeHtml(input.message)
    const escapedEmail = input.email ? escapeHtml(input.email) : null

    const { data, error } = await resendClient.emails.send({
      from: 'Tilda Feedback <onboarding@resend.dev>',
      to: ['kadenhyatt@gmail.com'],
      subject: 'Tilda Feedback',
      text: `Feedback from user:\n\n${input.message}${input.email ? `\n\nUser email: ${input.email}` : ''}`,
      html: `
        <h2>Tilda Feedback</h2>
        <p><strong>Message:</strong></p>
        <p>${escapedMessage.replace(/\n/g, '<br>')}</p>
        ${escapedEmail ? `<p><strong>User email:</strong> ${escapedEmail}</p>` : ''}
      `
    })

    if (error) {
      logger.error('Failed to send feedback email:', error)
      return { success: false, error: error.message }
    }

    lastFeedbackTime = now
    logger.log('Feedback sent successfully:', data)
    return { success: true }
  } catch (error) {
    logger.error('Failed to send feedback:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send feedback'
    }
  }
})

// App lifecycle
app.whenReady().then(() => {
  initDatabase()
  migrateTasksToToday()

  // Clean up orphaned working folders on startup
  cleanupOrphanedFolders().catch(err => logger.error('Failed to cleanup orphaned folders:', err))

  createWindow()

  // Initialize auto-updater in production mode only
  if (!isDev && mainWindow) {
    initAutoUpdater(mainWindow)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      initDatabase()  // Reinitialize database after window was closed
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  closeDatabase()
})
