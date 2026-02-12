import { create } from 'zustand'
import type { Task, Message, Attachment, ViewType, CreateTaskInput, UpdateTaskInput, TildaMessage, TildaAttachment, Context, ContextDocument, CreateContextInput, UpdateContextInput, AILearningNote, UpdateAILearningNoteInput, DirectoryFile } from '../types'
import { GENERAL_CONTEXT_ID } from '../types'
import { readFileContent, getFileMimeType } from '../utils/fileUtils'
import { logger } from '../utils/logger'

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
  pendingAttachmentsByTask: Record<string, Attachment[]>

  // Pending responses
  pendingResponses: Set<string>

  // Tilda state
  tildaMessages: TildaMessage[]
  tildaAttachments: TildaAttachment[]  // All attachments (for message display lookup)
  pendingTildaAttachments: TildaAttachment[]  // Pending attachments (for input area)
  isTildaPending: boolean
  tildaStreamingContent: string

  // Context state
  contexts: Context[]
  contextDocumentsByContext: Record<string, ContextDocument[]>

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
  reorderTask: (id: string, newIndex: number) => Promise<void>
  clearUnread: (id: string) => Promise<void>

  // Message actions
  loadMessages: (taskId: string) => Promise<void>
  sendMessage: (taskId: string, content: string) => Promise<void>
  retryMessage: (taskId: string, messageId: string) => Promise<void>
  editAndResendMessage: (taskId: string, messageId: string, newContent: string) => Promise<void>

  // Attachment actions
  loadAttachments: (taskId: string) => Promise<void>
  loadPendingAttachments: (taskId: string) => Promise<void>
  addAttachment: (taskId: string, file: File) => Promise<void>
  addAttachmentFromData: (taskId: string, data: DirectoryFile) => Promise<void>
  addPendingAttachment: (taskId: string, file: File) => Promise<void>
  addPendingAttachmentFromData: (taskId: string, data: DirectoryFile) => Promise<void>
  removePendingAttachment: (id: string, taskId: string) => Promise<void>
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
  loadPendingTildaAttachments: () => Promise<void>
  addTildaAttachment: (file: File) => Promise<void>
  addTildaAttachmentFromData: (data: DirectoryFile) => Promise<void>
  removeTildaAttachment: (id: string) => Promise<void>
  retryTildaMessage: (messageId: string) => Promise<void>
  editAndResendTildaMessage: (messageId: string, newContent: string) => Promise<void>

  // Context actions
  loadContexts: () => Promise<void>
  createContext: (input: CreateContextInput) => Promise<Context>
  updateContext: (id: string, input: UpdateContextInput) => Promise<void>
  deleteContext: (id: string) => Promise<void>
  reorderContext: (id: string, newIndex: number) => Promise<void>

  // Start/Stop working actions
  startWorking: (taskId: string) => Promise<void>
  stopWorking: (taskId: string) => Promise<void>
  getStartedTasksByContext: (contextId: string) => Task[]

  // Task-Context relationship actions
  setTaskContext: (taskId: string, contextId: string | null) => Promise<void>

  // Context document actions
  loadContextDocuments: (contextId: string) => Promise<void>
  addContextDocument: (contextId: string, file: File) => Promise<void>
  addContextDocumentFromData: (contextId: string, data: DirectoryFile) => Promise<void>
  removeContextDocument: (id: string, contextId: string) => Promise<void>

  // Context helpers
  getContextForTask: (taskId: string) => Context | undefined
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
  pendingAttachmentsByTask: {},
  pendingResponses: new Set(),
  tildaMessages: [],
  tildaAttachments: [],
  pendingTildaAttachments: [],
  isTildaPending: false,
  tildaStreamingContent: '',
  contexts: [],
  contextDocumentsByContext: {},
  aiNotesByContext: {},

  // View actions
  setCurrentView: (view) => {
    set({ currentView: view, activeTaskId: null })
    window.api.tasks.setActive(null)
  },

  setActiveTask: async (taskId) => {
    set({ activeTaskId: taskId })

    // Notify main process so it knows which task is being viewed
    window.api.tasks.setActive(taskId)

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
      // Always load pending attachments when entering a task
      await get().loadPendingAttachments(taskId)
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
      // Clear isStarted before completing
      await get().updateTask(id, { isStarted: false })
      const completedTask = await window.api.tasks.complete(id)
      // Fetch updated tasks to get any new recurring instances
      // without triggering isLoading state change
      const tasks = await window.api.tasks.getAll()
      set({ tasks: tasks.map(t => t.id === id ? completedTask : t) })
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

  reorderTask: async (id, newIndex) => {
    const { tasks } = get()

    // Get today's tasks sorted by sortPosition
    const todayTasks = tasks
      .filter(t => t.status === 'today')
      .sort((a, b) => a.sortPosition - b.sortPosition)

    const currentIndex = todayTasks.findIndex(t => t.id === id)
    if (currentIndex === -1 || currentIndex === newIndex) return

    // Optimistically reorder in memory
    const reordered = [...todayTasks]
    const [removed] = reordered.splice(currentIndex, 1)
    reordered.splice(newIndex, 0, removed)

    // Update sortPositions to match new order
    const updatedTodayTasks = reordered.map((task, idx) => ({
      ...task,
      sortPosition: idx
    }))

    // Merge back with other tasks (upcoming, archived)
    const otherTasks = tasks.filter(t => t.status !== 'today')
    set({ tasks: [...updatedTodayTasks, ...otherTasks] })

    try {
      await window.api.tasks.reorder(id, newIndex)
      // Refresh from backend to ensure consistency
      const freshTasks = await window.api.tasks.getAll()
      set({ tasks: freshTasks })
    } catch (error) {
      // Revert on error - reload from backend
      const freshTasks = await window.api.tasks.getAll()
      set({ tasks: freshTasks, error: (error as Error).message })
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
    const { pendingResponses } = get()

    // Capture current pending attachments before sending
    const currentPendingAttachments = get().pendingAttachmentsByTask[taskId] || []
    const attachmentIds = currentPendingAttachments.map(a => a.id)

    // Mark as pending
    const newPending = new Set(pendingResponses)
    newPending.add(taskId)
    set({ pendingResponses: newPending })

    // Optimistically add user message with attachment IDs
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      taskId,
      sender: 'user',
      content,
      timestamp: new Date().toISOString(),
      attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined
    }

    set(state => ({
      messagesByTask: {
        ...state.messagesByTask,
        [taskId]: [...(state.messagesByTask[taskId] || []), tempUserMessage]
      },
      // Clear pending attachments optimistically
      pendingAttachmentsByTask: {
        ...state.pendingAttachmentsByTask,
        [taskId]: []
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
      }, attachmentIds.length > 0 ? attachmentIds : undefined)

      // Reload messages and pending attachments to get persisted versions
      await get().loadMessages(taskId)
      await get().loadPendingAttachments(taskId)

      // If user navigated away, mark the task as unread locally
      if (get().activeTaskId !== taskId) {
        set(state => ({
          tasks: state.tasks.map(t =>
            t.id === taskId ? { ...t, hasUnreadAgentMessage: true } : t
          )
        }))
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

  retryMessage: async (taskId, messageId) => {
    const { pendingResponses } = get()
    const messages = get().messagesByTask[taskId] || []
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) return

    const message = messages[messageIndex]

    // Only retry LLM messages
    if (message.sender !== 'agent') return

    // Delete from the LLM message onwards (keeps the user message)
    await window.api.messages.deleteFromId(taskId, messageId)

    // Reload messages to reflect deletion
    await get().loadMessages(taskId)

    // Mark as pending
    const newPending = new Set(pendingResponses)
    newPending.add(taskId)
    set({ pendingResponses: newPending })

    // Track streaming response
    let streamedContent = ''
    const streamingMessageId = `streaming-${Date.now()}`

    try {
      // Regenerate response without creating a new user message
      await window.api.llm.regenerateResponse(taskId, (chunk) => {
        streamedContent += chunk

        // Update streaming message
        set(state => {
          const msgs = state.messagesByTask[taskId] || []
          const existingStreamIndex = msgs.findIndex(m => m.id === streamingMessageId)

          const streamingMessage: Message = {
            id: streamingMessageId,
            taskId,
            sender: 'agent',
            content: streamedContent,
            timestamp: new Date().toISOString()
          }

          if (existingStreamIndex >= 0) {
            const newMessages = [...msgs]
            newMessages[existingStreamIndex] = streamingMessage
            return {
              messagesByTask: { ...state.messagesByTask, [taskId]: newMessages }
            }
          } else {
            return {
              messagesByTask: {
                ...state.messagesByTask,
                [taskId]: [...msgs, streamingMessage]
              }
            }
          }
        })
      })

      // Reload messages to get persisted versions
      await get().loadMessages(taskId)

      // If user navigated away, mark the task as unread locally
      if (get().activeTaskId !== taskId) {
        set(state => ({
          tasks: state.tasks.map(t =>
            t.id === taskId ? { ...t, hasUnreadAgentMessage: true } : t
          )
        }))
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

  editAndResendMessage: async (taskId, messageId, newContent) => {
    const { pendingResponses } = get()
    const messages = get().messagesByTask[taskId] || []
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) return

    const message = messages[messageIndex]
    if (message.sender !== 'user') return

    // Update the user message content
    await window.api.messages.update(messageId, newContent)

    // Find and delete any messages after this one (the LLM response and any subsequent messages)
    const nextMessageIndex = messageIndex + 1
    if (nextMessageIndex < messages.length) {
      const nextMessage = messages[nextMessageIndex]
      await window.api.messages.deleteFromId(taskId, nextMessage.id)
    }

    // Reload messages to reflect changes
    await get().loadMessages(taskId)

    // Mark as pending
    const newPending = new Set(pendingResponses)
    newPending.add(taskId)
    set({ pendingResponses: newPending })

    // Track streaming response
    let streamedContent = ''
    const streamingMessageId = `streaming-${Date.now()}`

    try {
      // Regenerate response without creating a new user message
      await window.api.llm.regenerateResponse(taskId, (chunk) => {
        streamedContent += chunk

        // Update streaming message
        set(state => {
          const msgs = state.messagesByTask[taskId] || []
          const existingStreamIndex = msgs.findIndex(m => m.id === streamingMessageId)

          const streamingMessage: Message = {
            id: streamingMessageId,
            taskId,
            sender: 'agent',
            content: streamedContent,
            timestamp: new Date().toISOString()
          }

          if (existingStreamIndex >= 0) {
            const newMessages = [...msgs]
            newMessages[existingStreamIndex] = streamingMessage
            return {
              messagesByTask: { ...state.messagesByTask, [taskId]: newMessages }
            }
          } else {
            return {
              messagesByTask: {
                ...state.messagesByTask,
                [taskId]: [...msgs, streamingMessage]
              }
            }
          }
        })
      })

      // Reload messages to get persisted versions
      await get().loadMessages(taskId)

      // If user navigated away, mark the task as unread locally
      if (get().activeTaskId !== taskId) {
        set(state => ({
          tasks: state.tasks.map(t =>
            t.id === taskId ? { ...t, hasUnreadAgentMessage: true } : t
          )
        }))
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

  loadPendingAttachments: async (taskId) => {
    try {
      const attachments = await window.api.attachments.getPending(taskId)
      set(state => ({
        pendingAttachmentsByTask: { ...state.pendingAttachmentsByTask, [taskId]: attachments }
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

  addAttachmentFromData: async (taskId, data) => {
    try {
      const attachment = await window.api.attachments.create(
        taskId,
        data.filename,
        data.content,
        data.mimeType,
        data.relativePath
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

  addPendingAttachment: async (taskId, file) => {
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
        },
        pendingAttachmentsByTask: {
          ...state.pendingAttachmentsByTask,
          [taskId]: [...(state.pendingAttachmentsByTask[taskId] || []), attachment]
        }
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  addPendingAttachmentFromData: async (taskId, data) => {
    try {
      const attachment = await window.api.attachments.create(
        taskId,
        data.filename,
        data.content,
        data.mimeType,
        data.relativePath
      )
      set(state => ({
        attachmentsByTask: {
          ...state.attachmentsByTask,
          [taskId]: [...(state.attachmentsByTask[taskId] || []), attachment]
        },
        pendingAttachmentsByTask: {
          ...state.pendingAttachmentsByTask,
          [taskId]: [...(state.pendingAttachmentsByTask[taskId] || []), attachment]
        }
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  removePendingAttachment: async (id, taskId) => {
    try {
      await window.api.attachments.delete(id)
      set(state => ({
        attachmentsByTask: {
          ...state.attachmentsByTask,
          [taskId]: (state.attachmentsByTask[taskId] || []).filter(a => a.id !== id)
        },
        pendingAttachmentsByTask: {
          ...state.pendingAttachmentsByTask,
          [taskId]: (state.pendingAttachmentsByTask[taskId] || []).filter(a => a.id !== id)
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
      .tasks.filter(t => t.status === 'today' && !t.isStarted)
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

    // Capture current pending attachments before sending (they will be linked to the message)
    const currentAttachments = get().pendingTildaAttachments
    const attachmentIds = currentAttachments.map(a => a.id)

    // Optimistically add user message with attachment IDs
    const tempUserMessage: TildaMessage = {
      id: `temp-${Date.now()}`,
      sender: 'user',
      content,
      timestamp: new Date().toISOString(),
      attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined
    }

    set(state => ({
      tildaMessages: [...state.tildaMessages, tempUserMessage],
      // Clear pending attachments optimistically since they're now part of the message
      pendingTildaAttachments: []
      // Note: currentAttachments are already in tildaAttachments from addTildaAttachment,
      // so no need to add them again here
    }))

    // Track streaming response
    let streamedContent = ''

    try {
      await window.api.tilda.sendMessage(content, (chunk) => {
        streamedContent += chunk
        set({ tildaStreamingContent: streamedContent })
      })

      // Reload messages and attachments to get persisted versions, refresh tasks (tools may have modified them)
      await get().loadTildaMessages()
      await get().loadTildaAttachments()
      await get().loadPendingTildaAttachments()
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
      set({ tildaMessages: [], tildaAttachments: [], pendingTildaAttachments: [] })
    } catch (error) {
      logger.error('Failed to clear Tilda history:', error)
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

  loadPendingTildaAttachments: async () => {
    try {
      const attachments = await window.api.tildaAttachments.getPending()
      set({ pendingTildaAttachments: attachments })
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
        // Add to both: all attachments (for lookup) and pending (for input area)
        tildaAttachments: [...state.tildaAttachments, attachment],
        pendingTildaAttachments: [...state.pendingTildaAttachments, attachment]
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  addTildaAttachmentFromData: async (data) => {
    try {
      const attachment = await window.api.tildaAttachments.create(
        data.filename,
        data.content,
        data.mimeType,
        data.relativePath
      )
      set(state => ({
        tildaAttachments: [...state.tildaAttachments, attachment],
        pendingTildaAttachments: [...state.pendingTildaAttachments, attachment]
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
        tildaAttachments: state.tildaAttachments.filter(a => a.id !== id),
        pendingTildaAttachments: state.pendingTildaAttachments.filter(a => a.id !== id)
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  retryTildaMessage: async (messageId) => {
    const messages = get().tildaMessages
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) return

    const message = messages[messageIndex]

    // Only retry LLM messages
    if (message.sender !== 'agent') return

    // Delete from the LLM message onwards (keeps the user message)
    await window.api.tilda.deleteMessagesFromId(messageId)

    // Reload messages to reflect deletion
    await get().loadTildaMessages()

    // Mark as pending
    set({ isTildaPending: true, tildaStreamingContent: '' })

    // Track streaming response
    let streamedContent = ''

    try {
      // Regenerate response without creating a new user message
      await window.api.tilda.regenerateResponse((chunk) => {
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

  editAndResendTildaMessage: async (messageId, newContent) => {
    const messages = get().tildaMessages
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) return

    const message = messages[messageIndex]
    if (message.sender !== 'user') return

    // Update the user message content
    await window.api.tilda.updateMessage(messageId, newContent)

    // Find and delete any messages after this one
    const nextMessageIndex = messageIndex + 1
    if (nextMessageIndex < messages.length) {
      const nextMessage = messages[nextMessageIndex]
      await window.api.tilda.deleteMessagesFromId(nextMessage.id)
    }

    // Reload messages to reflect changes
    await get().loadTildaMessages()

    // Mark as pending
    set({ isTildaPending: true, tildaStreamingContent: '' })

    // Track streaming response
    let streamedContent = ''

    try {
      // Regenerate response without creating a new user message
      await window.api.tilda.regenerateResponse((chunk) => {
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

  reorderContext: async (id, newIndex) => {
    const { contexts } = get()

    // Get contexts sorted by sortPosition
    const sortedContexts = [...contexts].sort((a, b) => a.sortPosition - b.sortPosition)

    const currentIndex = sortedContexts.findIndex(c => c.id === id)
    if (currentIndex === -1 || currentIndex === newIndex) return

    // Optimistically reorder in memory
    const reordered = [...sortedContexts]
    const [removed] = reordered.splice(currentIndex, 1)
    reordered.splice(newIndex, 0, removed)

    // Update sortPositions to match new order
    const updatedContexts = reordered.map((ctx, idx) => ({
      ...ctx,
      sortPosition: idx
    }))

    set({ contexts: updatedContexts })

    try {
      await window.api.contexts.reorder(id, newIndex)
      // Reload contexts to ensure consistency
      await get().loadContexts()
    } catch (error) {
      // Revert on error - reload from backend
      await get().loadContexts()
      set({ error: (error as Error).message })
      throw error
    }
  },

  // Start/Stop working actions
  startWorking: async (taskId) => {
    const task = get().tasks.find(t => t.id === taskId)
    if (!task) return

    // If task has no context, assign to General
    if (!task.contextId) {
      await get().setTaskContext(taskId, GENERAL_CONTEXT_ID)
    }

    // If task is upcoming, move it to today
    if (task.status === 'upcoming') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString().split('T')[0]
      await get().updateTask(taskId, { dateToWorkOn: todayStr })
    }

    // Mark as started
    await get().updateTask(taskId, { isStarted: true })
  },

  stopWorking: async (taskId) => {
    await get().updateTask(taskId, { isStarted: false })
  },

  getStartedTasksByContext: (contextId) => {
    return get().tasks.filter(
      t => t.isStarted && t.contextId === contextId && t.status !== 'archived'
    )
  },

  // Task-Context relationship actions
  setTaskContext: async (taskId, contextId) => {
    try {
      await window.api.contexts.setTaskContext(taskId, contextId)
      // Update the task's contextId in local state
      set(state => ({
        tasks: state.tasks.map(t =>
          t.id === taskId ? { ...t, contextId: contextId || undefined } : t
        )
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

  addContextDocumentFromData: async (contextId, data) => {
    try {
      const document = await window.api.contextDocuments.create(
        contextId,
        data.filename,
        data.content,
        data.mimeType,
        data.fileSize,
        data.relativePath
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
  getContextForTask: (taskId) => {
    const task = get().tasks.find(t => t.id === taskId)
    if (!task?.contextId) return undefined
    return get().contexts.find(c => c.id === task.contextId)
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
