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
  AILearningNote
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
    migrateTasks: () => ipcRenderer.invoke('tasks:migrate')
  },
  messages: {
    getByTask: (taskId: string) => ipcRenderer.invoke('messages:getByTask', taskId),
    create: (taskId: string, content: string, sender: MessageSender) =>
      ipcRenderer.invoke('messages:create', taskId, content, sender),
    delete: (id: string) => ipcRenderer.invoke('messages:delete', id),
    deleteFromId: (taskId: string, messageId: string) =>
      ipcRenderer.invoke('messages:deleteFromId', taskId, messageId),
    update: (id: string, content: string) =>
      ipcRenderer.invoke('messages:update', id, content)
  },
  attachments: {
    getByTask: (taskId: string) => ipcRenderer.invoke('attachments:getByTask', taskId),
    create: (taskId: string, filename: string, content: string, mimeType: string) =>
      ipcRenderer.invoke('attachments:create', taskId, filename, content, mimeType),
    delete: (id: string) => ipcRenderer.invoke('attachments:delete', id)
  },
  llm: {
    sendMessage: (taskId: string, userMessage: string, onChunk: (chunk: string) => void) => {
      // Create a unique channel for this request
      const channel = `llm:chunk:${taskId}:${Date.now()}`

      // Set up listener for chunks
      const listener = (_event: unknown, chunk: string) => onChunk(chunk)
      ipcRenderer.on(channel, listener)

      // Send the request
      return ipcRenderer.invoke('llm:sendMessage', taskId, userMessage, channel).finally(() => {
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
  tilda: {
    getMessages: () => ipcRenderer.invoke('tilda:getMessages'),
    sendMessage: (userMessage: string, onChunk: (chunk: string) => void) => {
      // Create a unique channel for this request
      const channel = `tilda:chunk:${Date.now()}`

      // Set up listener for chunks
      const listener = (_event: unknown, chunk: string) => onChunk(chunk)
      ipcRenderer.on(channel, listener)

      // Send the request
      return ipcRenderer.invoke('tilda:sendMessage', userMessage, channel).finally(() => {
        ipcRenderer.removeListener(channel, listener)
      })
    },
    cancelRequest: () => ipcRenderer.send('tilda:cancel'),
    clearHistory: () => ipcRenderer.invoke('tilda:clearHistory'),
    deleteMessage: (id: string) => ipcRenderer.invoke('tilda:deleteMessage', id),
    deleteMessagesFromId: (messageId: string) =>
      ipcRenderer.invoke('tilda:deleteMessagesFromId', messageId),
    updateMessage: (id: string, content: string) =>
      ipcRenderer.invoke('tilda:updateMessage', id, content),
    regenerateResponse: (onChunk: (chunk: string) => void) => {
      // Create a unique channel for this request
      const channel = `tilda:chunk:${Date.now()}`

      // Set up listener for chunks
      const listener = (_event: unknown, chunk: string) => onChunk(chunk)
      ipcRenderer.on(channel, listener)

      // Send the request
      return ipcRenderer.invoke('tilda:regenerateResponse', channel).finally(() => {
        ipcRenderer.removeListener(channel, listener)
      })
    }
  },
  tildaAttachments: {
    getAll: () => ipcRenderer.invoke('tildaAttachments:getAll'),
    create: (filename: string, content: string, mimeType: string) =>
      ipcRenderer.invoke('tildaAttachments:create', filename, content, mimeType),
    delete: (id: string) => ipcRenderer.invoke('tildaAttachments:delete', id),
    clear: () => ipcRenderer.invoke('tildaAttachments:clear')
  },
  contexts: {
    getAll: () => ipcRenderer.invoke('contexts:getAll'),
    getById: (id: string) => ipcRenderer.invoke('contexts:getById', id),
    create: (input: CreateContextInput) => ipcRenderer.invoke('contexts:create', input),
    update: (id: string, input: UpdateContextInput) => ipcRenderer.invoke('contexts:update', id, input),
    delete: (id: string) => ipcRenderer.invoke('contexts:delete', id),
    reorder: (id: string, newPosition: number) => ipcRenderer.invoke('contexts:reorder', id, newPosition),
    getTaskContexts: (taskId: string) => ipcRenderer.invoke('contexts:getTaskContexts', taskId),
    setTaskContexts: (taskId: string, contextIds: string[]) => ipcRenderer.invoke('contexts:setTaskContexts', taskId, contextIds),
    getTasksByContext: (contextId: string) => ipcRenderer.invoke('contexts:getTasksByContext', contextId)
  },
  contextDocuments: {
    getByContext: (contextId: string) => ipcRenderer.invoke('contextDocuments:getByContext', contextId),
    create: (contextId: string, filename: string, content: string, mimeType: string, fileSize: number) =>
      ipcRenderer.invoke('contextDocuments:create', contextId, filename, content, mimeType, fileSize),
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
  }
}

contextBridge.exposeInMainWorld('api', api)
