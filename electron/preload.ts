import { contextBridge, ipcRenderer } from 'electron'
import type {
  CreateTaskInput,
  UpdateTaskInput,
  MessageSender,
  ElectronAPI,
  Settings,
  CreateContextInput,
  UpdateContextInput,
  CreateAILearningNoteInput,
  UpdateAILearningNoteInput,
  AILearningNote,
  FeedbackInput
} from '../src/types'

const api: ElectronAPI = {
  tasks: {
    getAll: () => ipcRenderer.invoke('tasks:getAll'),
    create: (input: CreateTaskInput) => ipcRenderer.invoke('tasks:create', input),
    update: (id: string, input: UpdateTaskInput) => ipcRenderer.invoke('tasks:update', id, input),
    complete: (id: string) => ipcRenderer.invoke('tasks:complete', id),
    reopen: (id: string) => ipcRenderer.invoke('tasks:reopen', id),
    delete: (id: string) => ipcRenderer.invoke('tasks:delete', id),
    reorder: (id: string, newPosition: number) => ipcRenderer.invoke('tasks:reorder', id, newPosition),
    clearUnread: (id: string) => ipcRenderer.invoke('tasks:clearUnread', id),
    setActive: (id: string | null) => ipcRenderer.send('task:setActive', id),
    migrateTasks: () => ipcRenderer.invoke('tasks:migrate')
  },
  messages: {
    getByTask: (taskId: string) => ipcRenderer.invoke('messages:getByTask', taskId),
    create: (taskId: string, content: string, sender: MessageSender, attachmentIds?: string[]) =>
      ipcRenderer.invoke('messages:create', taskId, content, sender, attachmentIds),
    delete: (id: string) => ipcRenderer.invoke('messages:delete', id),
    deleteFromId: (taskId: string, messageId: string) =>
      ipcRenderer.invoke('messages:deleteFromId', taskId, messageId),
    update: (id: string, content: string) =>
      ipcRenderer.invoke('messages:update', id, content)
  },
  attachments: {
    getByTask: (taskId: string) => ipcRenderer.invoke('attachments:getByTask', taskId),
    getPending: (taskId: string) => ipcRenderer.invoke('attachments:getPending', taskId),
    create: (taskId: string, filename: string, content: string, mimeType: string, relativePath?: string) =>
      ipcRenderer.invoke('attachments:create', taskId, filename, content, mimeType, relativePath),
    delete: (id: string) => ipcRenderer.invoke('attachments:delete', id)
  },
  llm: {
    sendMessage: (taskId: string, userMessage: string, onChunk: (chunk: string) => void, attachmentIds?: string[]) => {
      // Create a unique channel for this request
      const channel = `llm:chunk:${taskId}:${Date.now()}`

      // Set up listener for chunks
      const listener = (_event: unknown, chunk: string) => onChunk(chunk)
      ipcRenderer.on(channel, listener)

      // Send the request
      return ipcRenderer.invoke('llm:sendMessage', taskId, userMessage, channel, attachmentIds).finally(() => {
        ipcRenderer.removeListener(channel, listener)
      })
    },
    regenerateResponse: (taskId: string, onChunk: (chunk: string) => void) => {
      // Create a unique channel for this request
      const channel = `llm:chunk:${taskId}:${Date.now()}`

      // Set up listener for chunks
      const listener = (_event: unknown, chunk: string) => onChunk(chunk)
      ipcRenderer.on(channel, listener)

      // Send the request
      return ipcRenderer.invoke('llm:regenerateResponse', taskId, channel).finally(() => {
        ipcRenderer.removeListener(channel, listener)
      })
    },
    cancelRequest: (taskId: string) => ipcRenderer.send('llm:cancel', taskId)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (settings: Settings) => ipcRenderer.invoke('settings:save', settings)
  },
  contexts: {
    getAll: () => ipcRenderer.invoke('contexts:getAll'),
    getById: (id: string) => ipcRenderer.invoke('contexts:getById', id),
    create: (input: CreateContextInput) => ipcRenderer.invoke('contexts:create', input),
    update: (id: string, input: UpdateContextInput) => ipcRenderer.invoke('contexts:update', id, input),
    delete: (id: string) => ipcRenderer.invoke('contexts:delete', id),
    reorder: (id: string, newPosition: number) => ipcRenderer.invoke('contexts:reorder', id, newPosition),
    getTaskContext: (taskId: string) => ipcRenderer.invoke('contexts:getTaskContext', taskId),
    setTaskContext: (taskId: string, contextId: string | null) => ipcRenderer.invoke('contexts:setTaskContext', taskId, contextId),
    getTasksByContext: (contextId: string) => ipcRenderer.invoke('contexts:getTasksByContext', contextId)
  },
  contextDocuments: {
    getByContext: (contextId: string) => ipcRenderer.invoke('contextDocuments:getByContext', contextId),
    create: (contextId: string, filename: string, content: string, mimeType: string, fileSize: number, relativePath?: string) =>
      ipcRenderer.invoke('contextDocuments:create', contextId, filename, content, mimeType, fileSize, relativePath),
    delete: (id: string) => ipcRenderer.invoke('contextDocuments:delete', id)
  },
  aiNotes: {
    getByContext: (contextId: string) => ipcRenderer.invoke('aiNotes:getByContext', contextId),
    getAll: () => ipcRenderer.invoke('aiNotes:getAll'),
    create: (input: CreateAILearningNoteInput) => ipcRenderer.invoke('aiNotes:create', input),
    update: (id: string, input: UpdateAILearningNoteInput) => ipcRenderer.invoke('aiNotes:update', id, input),
    delete: (id: string) => ipcRenderer.invoke('aiNotes:delete', id),
    onNoteSaved: (callback: (note: AILearningNote) => void) => {
      const listener = (_event: unknown, note: AILearningNote) => callback(note)
      ipcRenderer.on('ai-note:saved', listener)
      // Return unsubscribe function
      return () => ipcRenderer.removeListener('ai-note:saved', listener)
    }
  },
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('update:check'),
    downloadUpdate: () => ipcRenderer.invoke('update:download'),
    installUpdate: () => ipcRenderer.invoke('update:install'),
    onUpdateAvailable: (callback: (info: { version: string; releaseNotes?: string }) => void) => {
      const listener = (_event: unknown, info: { version: string; releaseNotes?: string }) => callback(info)
      ipcRenderer.on('update:available', listener)
      return () => ipcRenderer.removeListener('update:available', listener)
    },
    onDownloadProgress: (callback: (progress: { percent: number; bytesPerSecond: number }) => void) => {
      const listener = (_event: unknown, progress: { percent: number; bytesPerSecond: number }) => callback(progress)
      ipcRenderer.on('update:progress', listener)
      return () => ipcRenderer.removeListener('update:progress', listener)
    },
    onUpdateReady: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('update:ready', listener)
      return () => ipcRenderer.removeListener('update:ready', listener)
    }
  },
  feedback: {
    send: (input: FeedbackInput) => ipcRenderer.invoke('feedback:send', input)
  },
  dialog: {
    selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory')
  },
  shell: {
    openWorkingFolder: (taskId: string) => ipcRenderer.invoke('shell:openWorkingFolder', taskId),
    listWorkingFolder: (taskId: string) => ipcRenderer.invoke('shell:listWorkingFolder', taskId)
  }
}

contextBridge.exposeInMainWorld('api', api)
