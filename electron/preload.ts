import { contextBridge, ipcRenderer } from 'electron'
import type {
  CreateTaskInput,
  UpdateTaskInput,
  MessageSender,
  ElectronAPI
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
      ipcRenderer.invoke('messages:create', taskId, content, sender)
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
    cancelRequest: (taskId: string) => ipcRenderer.send('llm:cancel', taskId)
  }
}

contextBridge.exposeInMainWorld('api', api)
