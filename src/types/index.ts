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
  tildaDirectory?: string
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
  contextId?: string
  claudeSessionId?: string
  isStarted?: boolean
}

export interface Message {
  id: string
  taskId: string
  sender: MessageSender
  content: string
  timestamp: string
  attachmentIds?: string[]
  chatId?: string
}

export interface Chat {
  id: string
  taskId: string
  name: string
  sortPosition: number
  claudeSessionId?: string
  createdAt: string
}

export interface Attachment {
  id: string
  taskId: string
  filename: string
  content: string
  mimeType: string
  createdAt: string
  relativePath?: string
}

export interface FileTreeItem {
  id: string
  filename: string
  content: string
  mimeType: string
  fileSize?: number
  relativePath?: string
}

export type ViewType = 'today' | 'upcoming' | 'archive' | `context:${string}`

export interface CreateTaskInput {
  name: string
  dateToWorkOn: string
  deadline?: string
  description?: string
  recurrenceRule?: RecurrenceRule
  contextId?: string
}

export interface UpdateTaskInput {
  name?: string
  dateToWorkOn?: string
  deadline?: string
  description?: string
  sortPosition?: number
  contextId?: string | null
  recurrenceRule?: RecurrenceRule | null
  isStarted?: boolean
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
  setActive: (id: string | null) => void
  migrateTasks: () => Promise<void>
}

export interface MessagesAPI {
  getByTask: (taskId: string) => Promise<Message[]>
  getByChat: (chatId: string) => Promise<Message[]>
  create: (taskId: string, content: string, sender: MessageSender, attachmentIds?: string[], chatId?: string) => Promise<Message>
  delete: (id: string) => Promise<void>
  deleteFromId: (taskId: string, messageId: string) => Promise<void>
  deleteFromChatId: (chatId: string, messageId: string) => Promise<void>
  update: (id: string, content: string) => Promise<void>
}

export interface ChatsAPI {
  getByTask: (taskId: string) => Promise<Chat[]>
  create: (taskId: string, name: string) => Promise<Chat>
  updateName: (id: string, name: string) => Promise<void>
  delete: (id: string) => Promise<void>
  ensureDefault: (taskId: string) => Promise<Chat>
}

export interface AttachmentsAPI {
  getByTask: (taskId: string) => Promise<Attachment[]>
  getPending: (taskId: string) => Promise<Attachment[]>
  create: (taskId: string, filename: string, content: string, mimeType: string, relativePath?: string) => Promise<Attachment>
  delete: (id: string) => Promise<void>
}

export interface LLMAPI {
  sendMessage: (
    taskId: string,
    chatId: string,
    userMessage: string,
    onChunk: (chunk: string) => void,
    attachmentIds?: string[]
  ) => Promise<string>
  regenerateResponse: (
    taskId: string,
    chatId: string,
    onChunk: (chunk: string) => void
  ) => Promise<string>
  cancelRequest: (chatId: string) => void
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
  attachmentIds?: string[]
}

export interface TildaAttachment {
  id: string
  filename: string
  content: string
  mimeType: string
  createdAt: string
  relativePath?: string
}

export interface TildaAttachmentsAPI {
  getAll: () => Promise<TildaAttachment[]>
  getPending: () => Promise<TildaAttachment[]>
  create: (filename: string, content: string, mimeType: string, relativePath?: string) => Promise<TildaAttachment>
  delete: (id: string) => Promise<void>
  clear: () => Promise<void>
}

export interface TildaAPI {
  getMessages: () => Promise<TildaMessage[]>
  sendMessage: (
    userMessage: string,
    onChunk: (chunk: string) => void
  ) => Promise<string>
  regenerateResponse: (
    onChunk: (chunk: string) => void
  ) => Promise<string>
  cancelRequest: () => void
  clearHistory: () => Promise<void>
  deleteMessage: (id: string) => Promise<void>
  deleteMessagesFromId: (messageId: string) => Promise<void>
  updateMessage: (id: string, content: string) => Promise<void>
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
  relativePath?: string
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
  getTaskContext: (taskId: string) => Promise<Context | null>
  setTaskContext: (taskId: string, contextId: string | null) => Promise<void>
  getTasksByContext: (contextId: string) => Promise<Task[]>
}

export interface ContextDocumentsAPI {
  getByContext: (contextId: string) => Promise<ContextDocument[]>
  create: (contextId: string, filename: string, content: string, mimeType: string, fileSize: number, relativePath?: string) => Promise<ContextDocument>
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

export interface UpdateInfo {
  version: string
  releaseNotes?: string
}

export interface DownloadProgress {
  percent: number
  bytesPerSecond: number
}

export interface UpdateCheckResult {
  updateInfo: UpdateInfo
}

export interface UpdaterAPI {
  checkForUpdates: () => Promise<UpdateCheckResult | null>
  downloadUpdate: () => Promise<void>
  installUpdate: () => void
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => () => void
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => () => void
  onUpdateReady: (callback: () => void) => () => void
}

// Directory upload types
export interface DirectoryFile {
  filename: string
  relativePath: string
  content: string
  mimeType: string
  fileSize: number
}

export interface DialogAPI {
  selectDirectory: () => Promise<DirectoryFile[] | null>
}

// Feedback types
export interface FeedbackInput {
  message: string
  email?: string
}

export interface FeedbackAPI {
  send: (input: FeedbackInput) => Promise<{ success: boolean; error?: string }>
}

export interface ShellAPI {
  openWorkingFolder: (taskId: string) => Promise<void>
}

export interface ElectronAPI {
  tasks: TasksAPI
  messages: MessagesAPI
  chats: ChatsAPI
  attachments: AttachmentsAPI
  llm: LLMAPI
  settings: SettingsAPI
  tilda: TildaAPI
  tildaAttachments: TildaAttachmentsAPI
  contexts: ContextsAPI
  contextDocuments: ContextDocumentsAPI
  aiNotes: AINotesAPI
  updater: UpdaterAPI
  feedback: FeedbackAPI
  dialog: DialogAPI
  shell: ShellAPI
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
