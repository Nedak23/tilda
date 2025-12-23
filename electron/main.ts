import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
import {
  initDatabase,
  closeDatabase,
  getAllTasks,
  createTask,
  updateTask,
  completeTask,
  reopenTask,
  deleteTask,
  reorderTask,
  clearUnreadAgentMessage,
  migrateTasksToToday,
  getMessagesByTask,
  createMessage,
  getAttachmentsByTask,
  createAttachment,
  deleteAttachment,
  setUnreadAgentMessage,
  getTildaMessages,
  clearTildaMessages,
  getAllContexts,
  getContextById,
  createContext,
  updateContext,
  deleteContext,
  reorderContext,
  getContextsByTask,
  setTaskContexts,
  getTasksByContext,
  getDocumentsByContext,
  createContextDocument,
  deleteContextDocument
} from './database'
import { sendMessage, cancelRequest } from './llm'
import { sendTildaMessage, cancelTildaRequest } from './tilda'
import { getSettings, saveSettings, type Settings } from './settings'
import type { CreateTaskInput, UpdateTaskInput, MessageSender, CreateContextInput, UpdateContextInput } from '../src/types'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
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

ipcMain.handle('tasks:complete', (_event, id: string) => {
  return completeTask(id)
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

ipcMain.handle('messages:create', (_event, taskId: string, content: string, sender: MessageSender) => {
  return createMessage(taskId, content, sender)
})

// IPC Handlers for Attachments
ipcMain.handle('attachments:getByTask', (_event, taskId: string) => {
  return getAttachmentsByTask(taskId)
})

ipcMain.handle('attachments:create', (_event, taskId: string, filename: string, content: string, mimeType: string) => {
  return createAttachment(taskId, filename, content, mimeType)
})

ipcMain.handle('attachments:delete', (_event, id: string) => {
  deleteAttachment(id)
})

// IPC Handlers for LLM
// Track which task the user is currently viewing
let activeTaskId: string | null = null

ipcMain.handle('llm:sendMessage', async (event, taskId: string, userMessage: string, channel: string) => {
  try {
    const response = await sendMessage(taskId, userMessage, (chunk: string) => {
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

ipcMain.on('llm:cancel', (_event, taskId: string) => {
  cancelRequest(taskId)
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

// IPC Handlers for Tilda
ipcMain.handle('tilda:getMessages', () => {
  return getTildaMessages()
})

ipcMain.handle('tilda:sendMessage', async (event, userMessage: string, channel: string) => {
  try {
    const response = await sendTildaMessage(userMessage, (chunk: string) => {
      event.sender.send(channel, chunk)
    })
    return response
  } catch (error) {
    throw error
  }
})

ipcMain.on('tilda:cancel', () => {
  cancelTildaRequest()
})

ipcMain.handle('tilda:clearHistory', async () => {
  try {
    clearTildaMessages()
    return { success: true }
  } catch (error) {
    console.error('Failed to clear Tilda history:', error)
    throw error
  }
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

ipcMain.handle('contexts:getTaskContexts', (_event, taskId: string) => {
  return getContextsByTask(taskId)
})

ipcMain.handle('contexts:setTaskContexts', (_event, taskId: string, contextIds: string[]) => {
  setTaskContexts(taskId, contextIds)
})

ipcMain.handle('contexts:getTasksByContext', (_event, contextId: string) => {
  return getTasksByContext(contextId)
})

// IPC Handlers for Context Documents
ipcMain.handle('contextDocuments:getByContext', (_event, contextId: string) => {
  return getDocumentsByContext(contextId)
})

ipcMain.handle('contextDocuments:create', (_event, contextId: string, filename: string, content: string, mimeType: string, fileSize: number) => {
  return createContextDocument(contextId, filename, content, mimeType, fileSize)
})

ipcMain.handle('contextDocuments:delete', (_event, id: string) => {
  deleteContextDocument(id)
})

// App lifecycle
app.whenReady().then(() => {
  initDatabase()
  migrateTasksToToday()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
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
