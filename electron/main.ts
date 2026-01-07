import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
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
  createMessage,
  deleteMessage,
  deleteMessagesFromId,
  updateMessageContent,
  getAttachmentsByTask,
  createAttachment,
  deleteAttachment,
  setUnreadAgentMessage,
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
  getContextsByTask,
  setTaskContexts,
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
import { sendMessage, cancelRequest, regenerateResponse } from './llm'
import { sendTildaMessage, cancelTildaRequest, regenerateTildaResponse } from './tilda'
import { getSettings, saveSettings, type Settings } from './settings'
import type { CreateTaskInput, UpdateTaskInput, MessageSender, CreateContextInput, UpdateContextInput, CreateAILearningNoteInput, UpdateAILearningNoteInput } from '../src/types'

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

ipcMain.handle('messages:create', (_event, taskId: string, content: string, sender: MessageSender) => {
  return createMessage(taskId, content, sender)
})

ipcMain.handle('messages:delete', (_event, id: string) => {
  deleteMessage(id)
})

ipcMain.handle('messages:deleteFromId', (_event, taskId: string, messageId: string) => {
  deleteMessagesFromId(taskId, messageId)
})

ipcMain.handle('messages:update', (_event, id: string, content: string) => {
  updateMessageContent(id, content)
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

ipcMain.handle('llm:regenerateResponse', async (event, taskId: string, channel: string) => {
  try {
    const response = await regenerateResponse(taskId, (chunk: string) => {
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
    clearTildaAttachments()
    return { success: true }
  } catch (error) {
    logger.error('Failed to clear Tilda history:', error)
    throw error
  }
})

ipcMain.handle('tilda:deleteMessage', (_event, id: string) => {
  deleteTildaMessage(id)
})

ipcMain.handle('tilda:deleteMessagesFromId', (_event, messageId: string) => {
  deleteTildaMessagesFromId(messageId)
})

ipcMain.handle('tilda:updateMessage', (_event, id: string, content: string) => {
  updateTildaMessageContent(id, content)
})

ipcMain.handle('tilda:regenerateResponse', async (event, channel: string) => {
  try {
    const response = await regenerateTildaResponse((chunk: string) => {
      event.sender.send(channel, chunk)
    })
    return response
  } catch (error) {
    throw error
  }
})

// IPC Handlers for Tilda Attachments
ipcMain.handle('tildaAttachments:getAll', () => {
  return getTildaAttachments()
})

ipcMain.handle('tildaAttachments:getPending', () => {
  return getPendingTildaAttachments()
})

ipcMain.handle('tildaAttachments:create', (_event, filename: string, content: string, mimeType: string) => {
  return createTildaAttachment(filename, content, mimeType)
})

ipcMain.handle('tildaAttachments:delete', (_event, id: string) => {
  deleteTildaAttachment(id)
})

ipcMain.handle('tildaAttachments:clear', () => {
  clearTildaAttachments()
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

// App lifecycle
app.whenReady().then(() => {
  initDatabase()
  migrateTasksToToday()
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
