import { create } from 'zustand'
import type { Task, Message, Attachment, ViewType, CreateTaskInput, UpdateTaskInput, TildaMessage } from '../types'

interface TaskStore {
  // State
  tasks: Task[]
  activeTaskId: string | null
  examiningTaskId: string | null
  currentView: ViewType
  isLoading: boolean
  error: string | null

  // Messages state per task
  messagesByTask: Record<string, Message[]>
  attachmentsByTask: Record<string, Attachment[]>

  // Pending responses
  pendingResponses: Set<string>

  // Tilda state
  tildaMessages: TildaMessage[]
  isTildaPending: boolean
  tildaStreamingContent: string

  // View actions
  setCurrentView: (view: ViewType) => void
  setActiveTask: (taskId: string | null) => void
  setExaminingTask: (taskId: string | null) => void

  // Task actions
  loadTasks: () => Promise<void>
  createTask: (input: CreateTaskInput) => Promise<Task>
  updateTask: (id: string, input: UpdateTaskInput) => Promise<void>
  completeTask: (id: string) => Promise<void>
  reopenTask: (id: string) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  reorderTask: (id: string, newPosition: number) => Promise<void>
  clearUnread: (id: string) => Promise<void>

  // Message actions
  loadMessages: (taskId: string) => Promise<void>
  sendMessage: (taskId: string, content: string) => Promise<void>

  // Attachment actions
  loadAttachments: (taskId: string) => Promise<void>
  addAttachment: (taskId: string, file: File) => Promise<void>
  removeAttachment: (id: string, taskId: string) => Promise<void>

  // Helpers
  getTodayTasks: () => Task[]
  getUpcomingTasks: () => Task[]
  getArchivedTasks: () => Task[]

  // Tilda actions
  loadTildaMessages: () => Promise<void>
  sendTildaMessage: (content: string) => Promise<void>
  clearTildaHistory: () => Promise<void>
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  // Initial state
  tasks: [],
  activeTaskId: null,
  examiningTaskId: null,
  currentView: 'today',
  isLoading: false,
  error: null,
  messagesByTask: {},
  attachmentsByTask: {},
  pendingResponses: new Set(),
  tildaMessages: [],
  isTildaPending: false,
  tildaStreamingContent: '',

  // View actions
  setCurrentView: (view) => {
    set({ currentView: view, activeTaskId: null, examiningTaskId: null })
  },

  setExaminingTask: async (taskId) => {
    set({ examiningTaskId: taskId })

    if (taskId) {
      // Load attachments if not loaded (needed for detail view)
      if (!get().attachmentsByTask[taskId]) {
        await get().loadAttachments(taskId)
      }
    }
  },

  setActiveTask: async (taskId) => {
    set({ activeTaskId: taskId, examiningTaskId: null })

    if (taskId) {
      // Clear unread indicator
      const task = get().tasks.find(t => t.id === taskId)
      if (task?.hasUnreadAgentMessage) {
        await get().clearUnread(taskId)
      }

      // Load messages and attachments if not loaded
      if (!get().messagesByTask[taskId]) {
        await get().loadMessages(taskId)
      }
      if (!get().attachmentsByTask[taskId]) {
        await get().loadAttachments(taskId)
      }
    }
  },

  // Task actions
  loadTasks: async () => {
    set({ isLoading: true, error: null })
    try {
      await window.api.tasks.migrateTasks()
      const tasks = await window.api.tasks.getAll()
      set({ tasks, isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  createTask: async (input) => {
    try {
      const task = await window.api.tasks.create(input)
      set(state => ({ tasks: [...state.tasks, task] }))
      return task
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  updateTask: async (id, input) => {
    try {
      const updatedTask = await window.api.tasks.update(id, input)
      set(state => ({
        tasks: state.tasks.map(t => t.id === id ? updatedTask : t)
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  completeTask: async (id) => {
    try {
      const completedTask = await window.api.tasks.complete(id)
      // Reload tasks to get any new recurring instances
      await get().loadTasks()
      // Update the specific task
      set(state => ({
        tasks: state.tasks.map(t => t.id === id ? completedTask : t)
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  reopenTask: async (id) => {
    try {
      const reopenedTask = await window.api.tasks.reopen(id)
      set(state => ({
        tasks: state.tasks.map(t => t.id === id ? reopenedTask : t)
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  deleteTask: async (id) => {
    try {
      await window.api.tasks.delete(id)
      set(state => ({
        tasks: state.tasks.filter(t => t.id !== id),
        activeTaskId: state.activeTaskId === id ? null : state.activeTaskId
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  reorderTask: async (id, newPosition) => {
    try {
      await window.api.tasks.reorder(id, newPosition)
      await get().loadTasks()
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  clearUnread: async (id) => {
    try {
      await window.api.tasks.clearUnread(id)
      set(state => ({
        tasks: state.tasks.map(t =>
          t.id === id ? { ...t, hasUnreadAgentMessage: false } : t
        )
      }))
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  // Message actions
  loadMessages: async (taskId) => {
    try {
      const messages = await window.api.messages.getByTask(taskId)
      set(state => ({
        messagesByTask: { ...state.messagesByTask, [taskId]: messages }
      }))
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  sendMessage: async (taskId, content) => {
    const { pendingResponses, activeTaskId } = get()

    // Mark as pending
    const newPending = new Set(pendingResponses)
    newPending.add(taskId)
    set({ pendingResponses: newPending })

    // Optimistically add user message
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      taskId,
      sender: 'user',
      content,
      timestamp: new Date().toISOString()
    }

    set(state => ({
      messagesByTask: {
        ...state.messagesByTask,
        [taskId]: [...(state.messagesByTask[taskId] || []), tempUserMessage]
      }
    }))

    // Track streaming response
    let streamedContent = ''
    const streamingMessageId = `streaming-${Date.now()}`

    try {
      await window.api.llm.sendMessage(taskId, content, (chunk) => {
        streamedContent += chunk

        // Update streaming message
        set(state => {
          const messages = state.messagesByTask[taskId] || []
          const existingStreamIndex = messages.findIndex(m => m.id === streamingMessageId)

          const streamingMessage: Message = {
            id: streamingMessageId,
            taskId,
            sender: 'agent',
            content: streamedContent,
            timestamp: new Date().toISOString()
          }

          if (existingStreamIndex >= 0) {
            const newMessages = [...messages]
            newMessages[existingStreamIndex] = streamingMessage
            return {
              messagesByTask: { ...state.messagesByTask, [taskId]: newMessages }
            }
          } else {
            return {
              messagesByTask: {
                ...state.messagesByTask,
                [taskId]: [...messages, streamingMessage]
              }
            }
          }
        })
      })

      // Reload messages to get persisted versions
      await get().loadMessages(taskId)

      // If user navigated away, task might have unread flag
      if (activeTaskId !== taskId) {
        await get().loadTasks()
      }
    } catch (error) {
      const errorMessage = (error as Error).message
      set({ error: errorMessage })

      // Show error as a message in the chat
      const errorDisplayMessage: Message = {
        id: crypto.randomUUID(),
        taskId,
        sender: 'agent',
        content: `Error: ${errorMessage}`,
        timestamp: new Date().toISOString()
      }

      set(state => ({
        messagesByTask: {
          ...state.messagesByTask,
          [taskId]: [...(state.messagesByTask[taskId] || []), errorDisplayMessage]
        }
      }))
    } finally {
      // Remove from pending
      const updatedPending = new Set(get().pendingResponses)
      updatedPending.delete(taskId)
      set({ pendingResponses: updatedPending })
    }
  },

  // Attachment actions
  loadAttachments: async (taskId) => {
    try {
      const attachments = await window.api.attachments.getByTask(taskId)
      set(state => ({
        attachmentsByTask: { ...state.attachmentsByTask, [taskId]: attachments }
      }))
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  addAttachment: async (taskId, file) => {
    try {
      const content = await file.text()
      const attachment = await window.api.attachments.create(
        taskId,
        file.name,
        content,
        file.type || 'text/plain'
      )
      set(state => ({
        attachmentsByTask: {
          ...state.attachmentsByTask,
          [taskId]: [...(state.attachmentsByTask[taskId] || []), attachment]
        }
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  removeAttachment: async (id, taskId) => {
    try {
      await window.api.attachments.delete(id)
      set(state => ({
        attachmentsByTask: {
          ...state.attachmentsByTask,
          [taskId]: (state.attachmentsByTask[taskId] || []).filter(a => a.id !== id)
        }
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  // Helpers
  getTodayTasks: () => {
    return get()
      .tasks.filter(t => t.status === 'today')
      .sort((a, b) => a.sortPosition - b.sortPosition)
  },

  getUpcomingTasks: () => {
    return get()
      .tasks.filter(t => t.status === 'upcoming')
      .sort((a, b) => a.dateToWorkOn.localeCompare(b.dateToWorkOn))
  },

  getArchivedTasks: () => {
    return get()
      .tasks.filter(t => t.status === 'archived')
      .sort((a, b) => (b.completionDate || '').localeCompare(a.completionDate || ''))
  },

  // Tilda actions
  loadTildaMessages: async () => {
    try {
      const messages = await window.api.tilda.getMessages()
      set({ tildaMessages: messages })
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  sendTildaMessage: async (content) => {
    set({ isTildaPending: true, tildaStreamingContent: '' })

    // Optimistically add user message
    const tempUserMessage: TildaMessage = {
      id: `temp-${Date.now()}`,
      sender: 'user',
      content,
      timestamp: new Date().toISOString()
    }

    set(state => ({
      tildaMessages: [...state.tildaMessages, tempUserMessage]
    }))

    // Track streaming response
    let streamedContent = ''

    try {
      await window.api.tilda.sendMessage(content, (chunk) => {
        streamedContent += chunk
        set({ tildaStreamingContent: streamedContent })
      })

      // Reload messages to get persisted versions and refresh tasks (tools may have modified them)
      await get().loadTildaMessages()
      await get().loadTasks()
    } catch (error) {
      const errorMessage = (error as Error).message
      set({ error: errorMessage })

      // Show error as a message
      const errorDisplayMessage: TildaMessage = {
        id: crypto.randomUUID(),
        sender: 'agent',
        content: `Error: ${errorMessage}`,
        timestamp: new Date().toISOString()
      }

      set(state => ({
        tildaMessages: [...state.tildaMessages, errorDisplayMessage]
      }))
    } finally {
      set({ isTildaPending: false, tildaStreamingContent: '' })
    }
  },

  clearTildaHistory: async () => {
    try {
      await window.api.tilda.clearHistory()
      set({ tildaMessages: [] })
    } catch (error) {
      set({ error: (error as Error).message })
    }
  }
}))
