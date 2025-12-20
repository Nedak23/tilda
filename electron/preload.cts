const { contextBridge, ipcRenderer } = require('electron')

const api = {
  tasks: {
    getAll: () => ipcRenderer.invoke('tasks:getAll'),
    create: (input) => ipcRenderer.invoke('tasks:create', input),
    update: (id, input) => ipcRenderer.invoke('tasks:update', id, input),
    complete: (id) => ipcRenderer.invoke('tasks:complete', id),
    reopen: (id) => ipcRenderer.invoke('tasks:reopen', id),
    delete: (id) => ipcRenderer.invoke('tasks:delete', id),
    reorder: (id, newPosition) => ipcRenderer.invoke('tasks:reorder', id, newPosition),
    clearUnread: (id) => ipcRenderer.invoke('tasks:clearUnread', id),
    migrateTasks: () => ipcRenderer.invoke('tasks:migrate')
  },
  messages: {
    getByTask: (taskId) => ipcRenderer.invoke('messages:getByTask', taskId),
    create: (taskId, content, sender) =>
      ipcRenderer.invoke('messages:create', taskId, content, sender)
  },
  attachments: {
    getByTask: (taskId) => ipcRenderer.invoke('attachments:getByTask', taskId),
    create: (taskId, filename, content, mimeType) =>
      ipcRenderer.invoke('attachments:create', taskId, filename, content, mimeType),
    delete: (id) => ipcRenderer.invoke('attachments:delete', id)
  },
  llm: {
    sendMessage: (taskId, userMessage, onChunk) => {
      const channel = `llm:chunk:${taskId}:${Date.now()}`
      const listener = (_event, chunk) => onChunk(chunk)
      ipcRenderer.on(channel, listener)
      return ipcRenderer.invoke('llm:sendMessage', taskId, userMessage, channel).finally(() => {
        ipcRenderer.removeListener(channel, listener)
      })
    },
    cancelRequest: (taskId) => ipcRenderer.send('llm:cancel', taskId)
  }
}

contextBridge.exposeInMainWorld('api', api)
