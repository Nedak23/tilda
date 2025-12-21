export type TaskStatus = 'upcoming' | 'today' | 'archived'
export type MessageSender = 'user' | 'agent'
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type ModelType = 'claude-sonnet-4-5-20250929' | 'claude-haiku-4-5-20251001' | 'claude-opus-4-5-20251101'

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

export type ViewType = 'today' | 'upcoming' | 'archive'

export interface CreateTaskInput {
  name: string
  dateToWorkOn: string
  deadline?: string
  description?: string
  recurrenceRule?: RecurrenceRule
}

export interface UpdateTaskInput {
  name?: string
  dateToWorkOn?: string
  deadline?: string
  description?: string
  sortPosition?: number
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

export interface ElectronAPI {
  tasks: TasksAPI
  messages: MessagesAPI
  attachments: AttachmentsAPI
  llm: LLMAPI
  settings: SettingsAPI
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
