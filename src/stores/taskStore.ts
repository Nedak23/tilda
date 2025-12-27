import { create } from 'zustand'
import type { Task, Message, Attachment, ViewType, CreateTaskInput, UpdateTaskInput, TildaMessage, TildaAttachment, Context, ContextDocument, CreateContextInput, UpdateContextInput, AILearningNote, UpdateAILearningNoteInput } from '../types'
import { readFileContent, getFileMimeType } from '../utils/fileUtils'

interface TaskStore {
  // State
  tasks: Task[]
  activeTaskId: string | null
  currentView: ViewType
  isLoading: boolean
  error: string | null

  // Deleted tasks for undo (with their original indices)
  deletedTasks: { task: Task; index: number }[]

  // Messages state per task
  messagesByTask: Record<string, Message[]>
  attachmentsByTask: Record<string, Attachment[]>

  // Pending responses
  pendingResponses: Set<string>

  // Tilda state
  tildaMessages: TildaMessage[]
  tildaAttachments: TildaAttachment[]
  isTildaPending: boolean
  tildaStreamingContent: string

  // Context state
  contexts: Context[]
  contextDocumentsByContext: Record<string, ContextDocument[]>
  taskContextsByTask: Record<string, string[]>

  // AI Learning Notes state
  aiNotesByContext: Record<string, AILearningNote[]>

  // View actions
  setCurrentView: (view: ViewType) => void
  setActiveTask: (taskId: string | null) => void

  // Task actions
  loadTasks: () => Promise<void>
  createTask: (input: CreateTaskInput) => Promise<Task>
  updateTask: (id: string, input: UpdateTaskInput) => Promise<void>
  completeTask: (id: string) => Promise<void>
  reopenTask: (id: string) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  deleteTasks: (ids: string[]) => Promise<Task[]>
  restoreDeletedTasks: () => Promise<void>
  clearDeletedTasks: () => void
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
  loadTildaAttachments: () => Promise<void>
  addTildaAttachment: (file: File) => Promise<void>
  removeTildaAttachment: (id: string) => Promise<void>

  // Context actions
  loadContexts: () => Promise<void>
  createContext: (input: CreateContextInput) => Promise<Context>
  updateContext: (id: string, input: UpdateContextInput) => Promise<void>
  deleteContext: (id: string) => Promise<void>
  reorderContext: (id: string, newPosition: number) => Promise<void>

  // Task-Context relationship actions
  loadTaskContexts: (taskId: string) => Promise<void>
  setTaskContexts: (taskId: string, contextIds: string[]) => Promise<void>

  // Context document actions
  loadContextDocuments: (contextId: string) => Promise<void>
  addContextDocument: (contextId: string, file: File) => Promise<void>
  removeContextDocument: (id: string, contextId: string) => Promise<void>

  // Context helpers
  getContextsForTask: (taskId: string) => Context[]
  getContextById: (id: string) => Context | undefined

  // AI Learning Notes actions
  loadAINotes: (contextId: string) => Promise<void>
  updateAINote: (id: string, contextId: string, input: UpdateAILearningNoteInput) => Promise<void>
  deleteAINote: (id: string, contextId: string) => Promise<void>
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  // Initial state
  tasks: [],
  activeTaskId: null,
  currentView: 'today',
  isLoading: false,
  error: null,
  deletedTasks: [],
  messagesByTask: {},
  attachmentsByTask: {},
  pendingResponses: new Set(),
  tildaMessages: [],
  tildaAttachments: [],
  isTildaPending: false,
  tildaStreamingContent: '',
  contexts: [],
  contextDocumentsByContext: {},
  taskContextsByTask: {},
  aiNotesByContext: {},

  // View actions
  setCurrentView: (view) => {
    set({ currentView: view, activeTaskId: null })
  },

  setActiveTask: async (taskId) => {
    set({ activeTaskId: taskId })

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
      set(state => ({ tasks: [task, ...state.tasks] }))
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

  deleteTasks: async (ids) => {
    try {
      // Store tasks with their original indices before deleting for undo
      const currentTasks = get().tasks
      const tasksToDelete: { task: Task; index: number }[] = []
      currentTasks.forEach((task, index) => {
        if (ids.includes(task.id)) {
          tasksToDelete.push({ task, index })
        }
      })

      // Delete all tasks
      await Promise.all(ids.map(id => window.api.tasks.delete(id)))

      set(state => ({
        tasks: state.tasks.filter(t => !ids.includes(t.id)),
        activeTaskId: ids.includes(state.activeTaskId || '') ? null : state.activeTaskId,
        deletedTasks: tasksToDelete
      }))

      return tasksToDelete.map(t => t.task)
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  restoreDeletedTasks: async () => {
    const { deletedTasks } = get()
    if (deletedTasks.length === 0) return

    try {
      // Recreate each deleted task with its original sortPosition
      for (const { task } of deletedTasks) {
        const restored = await window.api.tasks.create({
          name: task.name,
          description: task.description,
          dateToWorkOn: task.dateToWorkOn,
          deadline: task.deadline,
          recurrenceRule: task.recurrenceRule
        })
        // Restore the original sort position
        if (task.sortPosition !== undefined) {
          await window.api.tasks.reorder(restored.id, task.sortPosition)
        }
      }

      // Reload all tasks to get correct sort positions from database
      await get().loadTasks()
      set({ deletedTasks: [] })
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  clearDeletedTasks: () => {
    set({ deletedTasks: [] })
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
      const content = await readFileContent(file)
      const mimeType = getFileMimeType(file)

      const attachment = await window.api.attachments.create(
        taskId,
        file.name,
        content,
        mimeType
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
      set({ tildaMessages: [], tildaAttachments: [] })
    } catch (error) {
      console.error('Failed to clear Tilda history:', error)
      set({ error: (error as Error).message })
    }
  },

  loadTildaAttachments: async () => {
    try {
      const attachments = await window.api.tildaAttachments.getAll()
      set({ tildaAttachments: attachments })
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  addTildaAttachment: async (file) => {
    try {
      const content = await readFileContent(file)
      const mimeType = getFileMimeType(file)

      const attachment = await window.api.tildaAttachments.create(
        file.name,
        content,
        mimeType
      )
      set(state => ({
        tildaAttachments: [...state.tildaAttachments, attachment]
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  removeTildaAttachment: async (id) => {
    try {
      await window.api.tildaAttachments.delete(id)
      set(state => ({
        tildaAttachments: state.tildaAttachments.filter(a => a.id !== id)
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  // Context actions
  loadContexts: async () => {
    try {
      const contexts = await window.api.contexts.getAll()
      set({ contexts })
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  createContext: async (input) => {
    try {
      const context = await window.api.contexts.create(input)
      set(state => ({ contexts: [...state.contexts, context] }))
      return context
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  updateContext: async (id, input) => {
    try {
      const updatedContext = await window.api.contexts.update(id, input)
      set(state => ({
        contexts: state.contexts.map(c => c.id === id ? updatedContext : c)
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  deleteContext: async (id) => {
    try {
      await window.api.contexts.delete(id)
      set(state => ({
        contexts: state.contexts.filter(c => c.id !== id),
        currentView: state.currentView === `context:${id}` ? 'today' : state.currentView
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  reorderContext: async (id, newPosition) => {
    try {
      await window.api.contexts.reorder(id, newPosition)
      // Reload contexts to get updated sort positions
      await get().loadContexts()
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  // Task-Context relationship actions
  loadTaskContexts: async (taskId) => {
    try {
      const contexts = await window.api.contexts.getTaskContexts(taskId)
      set(state => ({
        taskContextsByTask: { ...state.taskContextsByTask, [taskId]: contexts.map(c => c.id) }
      }))
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  setTaskContexts: async (taskId, contextIds) => {
    try {
      await window.api.contexts.setTaskContexts(taskId, contextIds)
      set(state => ({
        taskContextsByTask: { ...state.taskContextsByTask, [taskId]: contextIds }
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  // Context document actions
  loadContextDocuments: async (contextId) => {
    try {
      const documents = await window.api.contextDocuments.getByContext(contextId)
      set(state => ({
        contextDocumentsByContext: { ...state.contextDocumentsByContext, [contextId]: documents }
      }))
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  addContextDocument: async (contextId, file) => {
    try {
      const content = await file.text()
      const document = await window.api.contextDocuments.create(
        contextId,
        file.name,
        content,
        file.type || 'text/plain',
        file.size
      )
      set(state => ({
        contextDocumentsByContext: {
          ...state.contextDocumentsByContext,
          [contextId]: [...(state.contextDocumentsByContext[contextId] || []), document]
        }
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  removeContextDocument: async (id, contextId) => {
    try {
      await window.api.contextDocuments.delete(id)
      set(state => ({
        contextDocumentsByContext: {
          ...state.contextDocumentsByContext,
          [contextId]: (state.contextDocumentsByContext[contextId] || []).filter(d => d.id !== id)
        }
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  // Context helpers
  getContextsForTask: (taskId) => {
    const contextIds = get().taskContextsByTask[taskId] || []
    return get().contexts.filter(c => contextIds.includes(c.id))
  },

  getContextById: (id) => {
    return get().contexts.find(c => c.id === id)
  },

  // AI Learning Notes actions
  loadAINotes: async (contextId) => {
    try {
      const notes = await window.api.aiNotes.getByContext(contextId)
      set(state => ({
        aiNotesByContext: { ...state.aiNotesByContext, [contextId]: notes }
      }))
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  updateAINote: async (id, contextId, input) => {
    try {
      const updatedNote = await window.api.aiNotes.update(id, input)
      set(state => ({
        aiNotesByContext: {
          ...state.aiNotesByContext,
          [contextId]: (state.aiNotesByContext[contextId] || []).map(n =>
            n.id === id ? updatedNote : n
          )
        }
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  deleteAINote: async (id, contextId) => {
    try {
      await window.api.aiNotes.delete(id)
      set(state => ({
        aiNotesByContext: {
          ...state.aiNotesByContext,
          [contextId]: (state.aiNotesByContext[contextId] || []).filter(n => n.id !== id)
        }
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  }
}))
