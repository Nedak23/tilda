// Fixed ID for the General context
export const GENERAL_CONTEXT_ID = 'general'

export type TaskStatus = 'upcoming' | 'today' | 'archived'
export type MessageSender = 'user' | 'agent'
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type ModelType = 'claude-sonnet-4-5-20250929' | 'claude-haiku-4-5-20251001' | 'claude-opus-4-5-20251101'
export type AILearningNoteCategory = 'preference' | 'domain_knowledge' | 'workflow' | 'technical_decision'

export interface Settings {
  apiKey: string
  model: ModelType
}

export interface RecurrenceRule {
  frequency: RecurrenceFrequency
  interval: number
  endDate?: string
  daysOfWeek?: number[]
}

export interface Task {
  id: string
  name: string
  dateToWorkOn: string
  deadline?: string
  description?: string
  status: TaskStatus
  completionDate?: string
  sortPosition: number
  hasUnreadAgentMessage: boolean
  recurrenceRule?: RecurrenceRule
  createdAt: string
}

export interface Message {
  id: string
  taskId: string
  sender: MessageSender
  content: string
  timestamp: string
}

export interface Attachment {
  id: string
  taskId: string
  filename: string
  content: string
  mimeType: string
  createdAt: string
}

export type ViewType = 'today' | 'upcoming' | 'archive' | `context:${string}`

export interface CreateTaskInput {
  name: string
  dateToWorkOn: string
  deadline?: string
  description?: string
  recurrenceRule?: RecurrenceRule
  contextIds?: string[]
}

export interface UpdateTaskInput {
  name?: string
  dateToWorkOn?: string
  deadline?: string
  description?: string
  sortPosition?: number
  contextIds?: string[]
}

// IPC API types
export interface TasksAPI {
  getAll: () => Promise<Task[]>
  create: (input: CreateTaskInput) => Promise<Task>
  update: (id: string, input: UpdateTaskInput) => Promise<Task>
  complete: (id: string) => Promise<Task>
  reopen: (id: string) => Promise<Task>
  delete: (id: string) => Promise<void>
  reorder: (id: string, newPosition: number) => Promise<void>
  clearUnread: (id: string) => Promise<void>
  migrateTasks: () => Promise<void>
}

export interface MessagesAPI {
  getByTask: (taskId: string) => Promise<Message[]>
  create: (taskId: string, content: string, sender: MessageSender) => Promise<Message>
}

export interface AttachmentsAPI {
  getByTask: (taskId: string) => Promise<Attachment[]>
  create: (taskId: string, filename: string, content: string, mimeType: string) => Promise<Attachment>
  delete: (id: string) => Promise<void>
}

export interface LLMAPI {
  sendMessage: (
    taskId: string,
    userMessage: string,
    onChunk: (chunk: string) => void
  ) => Promise<string>
  cancelRequest: (taskId: string) => void
}

export interface SettingsAPI {
  get: () => Promise<Settings>
  save: (settings: Settings) => Promise<void>
}

export interface TildaMessage {
  id: string
  sender: MessageSender
  content: string
  timestamp: string
}

export interface TildaAttachment {
  id: string
  filename: string
  content: string
  mimeType: string
  createdAt: string
}

export interface TildaAttachmentsAPI {
  getAll: () => Promise<TildaAttachment[]>
  create: (filename: string, content: string, mimeType: string) => Promise<TildaAttachment>
  delete: (id: string) => Promise<void>
  clear: () => Promise<void>
}

export interface TildaAPI {
  getMessages: () => Promise<TildaMessage[]>
  sendMessage: (
    userMessage: string,
    onChunk: (chunk: string) => void
  ) => Promise<string>
  cancelRequest: () => void
  clearHistory: () => Promise<void>
}

// Context types
export interface Context {
  id: string
  name: string
  description?: string
  sortPosition: number
  createdAt: string
}

export interface ContextDocument {
  id: string
  contextId: string
  filename: string
  content: string
  mimeType: string
  fileSize: number
  createdAt: string
}

export interface CreateContextInput {
  name: string
  description?: string
}

export interface UpdateContextInput {
  name?: string
  description?: string
}

export interface ContextsAPI {
  getAll: () => Promise<Context[]>
  getById: (id: string) => Promise<Context | undefined>
  create: (input: CreateContextInput) => Promise<Context>
  update: (id: string, input: UpdateContextInput) => Promise<Context>
  delete: (id: string) => Promise<void>
  reorder: (id: string, newPosition: number) => Promise<void>
  getTaskContexts: (taskId: string) => Promise<Context[]>
  setTaskContexts: (taskId: string, contextIds: string[]) => Promise<void>
  getTasksByContext: (contextId: string) => Promise<Task[]>
}

export interface ContextDocumentsAPI {
  getByContext: (contextId: string) => Promise<ContextDocument[]>
  create: (contextId: string, filename: string, content: string, mimeType: string, fileSize: number) => Promise<ContextDocument>
  delete: (id: string) => Promise<void>
}

// AI Learning Notes types
export interface AILearningNote {
  id: string
  contextId: string
  title: string
  content: string
  category: AILearningNoteCategory
  sourceTaskId: string | null
  sourceTaskName: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateAILearningNoteInput {
  contextId: string
  title: string
  content: string
  category: AILearningNoteCategory
  sourceTaskId?: string
  sourceTaskName?: string
}

export interface UpdateAILearningNoteInput {
  title?: string
  content?: string
  category?: AILearningNoteCategory
}

export interface AINotesAPI {
  getByContext: (contextId: string) => Promise<AILearningNote[]>
  getAll: () => Promise<AILearningNote[]>
  create: (input: CreateAILearningNoteInput) => Promise<AILearningNote>
  update: (id: string, input: UpdateAILearningNoteInput) => Promise<AILearningNote>
  delete: (id: string) => Promise<void>
  onNoteSaved: (callback: (note: AILearningNote) => void) => () => void
}

export interface ElectronAPI {
  tasks: TasksAPI
  messages: MessagesAPI
  attachments: AttachmentsAPI
  llm: LLMAPI
  settings: SettingsAPI
  tilda: TildaAPI
  tildaAttachments: TildaAttachmentsAPI
  contexts: ContextsAPI
  contextDocuments: ContextDocumentsAPI
  aiNotes: AINotesAPI
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
