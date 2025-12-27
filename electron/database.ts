import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import {
  GENERAL_CONTEXT_ID,
  type Task,
  type Message,
  type Attachment,
  type CreateTaskInput,
  type UpdateTaskInput,
  type MessageSender,
  type RecurrenceRule,
  type TildaMessage,
  type TildaAttachment,
  type Context,
  type ContextDocument,
  type CreateContextInput,
  type UpdateContextInput,
  type AILearningNote,
  type CreateAILearningNoteInput,
  type UpdateAILearningNoteInput
} from '../src/types'

// Re-export for convenience
export { GENERAL_CONTEXT_ID }

let db: Database.Database

function getDbPath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'tilda.db')
}

export function initDatabase(): void {
  db = new Database(getDbPath())
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date_to_work_on TEXT NOT NULL,
      deadline TEXT,
      description TEXT,
      status TEXT CHECK(status IN ('upcoming', 'today', 'archived')) NOT NULL,
      completion_date TEXT,
      sort_position INTEGER NOT NULL DEFAULT 0,
      has_unread_agent_message INTEGER NOT NULL DEFAULT 0,
      recurrence_frequency TEXT,
      recurrence_interval INTEGER,
      recurrence_end_date TEXT,
      recurrence_days_of_week TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      sender TEXT CHECK(sender IN ('user', 'agent')) NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      content TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date_to_work_on);
    CREATE INDEX IF NOT EXISTS idx_messages_task ON messages(task_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_task ON attachments(task_id);

    CREATE TABLE IF NOT EXISTS tilda_messages (
      id TEXT PRIMARY KEY,
      sender TEXT CHECK(sender IN ('user', 'agent')) NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tilda_messages_timestamp ON tilda_messages(timestamp);

    CREATE TABLE IF NOT EXISTS tilda_attachments (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      content TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contexts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      sort_position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_contexts_sort ON contexts(sort_position);

    CREATE TABLE IF NOT EXISTS task_contexts (
      task_id TEXT NOT NULL,
      context_id TEXT NOT NULL,
      PRIMARY KEY (task_id, context_id),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_task_contexts_task ON task_contexts(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_contexts_context ON task_contexts(context_id);

    CREATE TABLE IF NOT EXISTS context_documents (
      id TEXT PRIMARY KEY,
      context_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      content TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_context_documents_context ON context_documents(context_id);

    CREATE TABLE IF NOT EXISTS ai_learning_notes (
      id TEXT PRIMARY KEY,
      context_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT CHECK(category IN ('preference', 'domain_knowledge', 'workflow', 'technical_decision')) NOT NULL,
      source_task_id TEXT,
      source_task_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE,
      FOREIGN KEY (source_task_id) REFERENCES tasks(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ai_learning_notes_context ON ai_learning_notes(context_id);
  `)

  // Ensure the General context exists
  ensureGeneralContext()
}

function ensureGeneralContext(): void {
  const existing = db.prepare('SELECT id FROM contexts WHERE id = ?').get(GENERAL_CONTEXT_ID)
  if (!existing) {
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO contexts (id, name, description, sort_position, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      GENERAL_CONTEXT_ID,
      'General',
      'Default context for all tasks. AI learning notes without a specific context are saved here.',
      -1, // Ensure it appears first
      now
    )
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close()
  }
}

// Task operations

function rowToTask(row: Record<string, unknown>): Task {
  let recurrenceRule: RecurrenceRule | undefined
  if (row.recurrence_frequency) {
    recurrenceRule = {
      frequency: row.recurrence_frequency as RecurrenceRule['frequency'],
      interval: row.recurrence_interval as number,
      endDate: row.recurrence_end_date as string | undefined,
      daysOfWeek: row.recurrence_days_of_week
        ? JSON.parse(row.recurrence_days_of_week as string)
        : undefined
    }
  }

  return {
    id: row.id as string,
    name: row.name as string,
    dateToWorkOn: row.date_to_work_on as string,
    deadline: row.deadline as string | undefined,
    description: row.description as string | undefined,
    status: row.status as Task['status'],
    completionDate: row.completion_date as string | undefined,
    sortPosition: row.sort_position as number,
    hasUnreadAgentMessage: Boolean(row.has_unread_agent_message),
    recurrenceRule,
    createdAt: row.created_at as string
  }
}

export function getAllTasks(): Task[] {
  const rows = db.prepare('SELECT * FROM tasks ORDER BY sort_position ASC').all()
  return rows.map(row => rowToTask(row as Record<string, unknown>))
}

export function getTaskById(id: string): Task | undefined {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  return row ? rowToTask(row as Record<string, unknown>) : undefined
}

function getMaxSortPosition(status: string): number {
  const result = db.prepare(
    'SELECT MAX(sort_position) as max FROM tasks WHERE status = ?'
  ).get(status) as { max: number | null }
  return result.max ?? -1
}

function getMinSortPosition(status: string): number {
  const result = db.prepare(
    'SELECT MIN(sort_position) as min FROM tasks WHERE status = ?'
  ).get(status) as { min: number | null }
  return result.min ?? 1
}

function getTodayDateString(): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today.toISOString().split('T')[0]
}

function determineStatus(dateToWorkOn: string): 'today' | 'upcoming' {
  const today = getTodayDateString()
  return dateToWorkOn <= today ? 'today' : 'upcoming'
}

export function createTask(input: CreateTaskInput): Task {
  const id = uuidv4()
  const now = new Date().toISOString()
  const status = determineStatus(input.dateToWorkOn)
  const sortPosition = getMinSortPosition(status) - 1

  db.prepare(`
    INSERT INTO tasks (
      id, name, date_to_work_on, deadline, description, status,
      sort_position, has_unread_agent_message,
      recurrence_frequency, recurrence_interval, recurrence_end_date, recurrence_days_of_week,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.name,
    input.dateToWorkOn,
    input.deadline ?? null,
    input.description ?? null,
    status,
    sortPosition,
    input.recurrenceRule?.frequency ?? null,
    input.recurrenceRule?.interval ?? null,
    input.recurrenceRule?.endDate ?? null,
    input.recurrenceRule?.daysOfWeek ? JSON.stringify(input.recurrenceRule.daysOfWeek) : null,
    now
  )

  return getTaskById(id)!
}

export function updateTask(id: string, input: UpdateTaskInput): Task {
  const task = getTaskById(id)
  if (!task) throw new Error(`Task ${id} not found`)

  const updates: string[] = []
  const values: unknown[] = []

  if (input.name !== undefined) {
    updates.push('name = ?')
    values.push(input.name)
  }
  if (input.dateToWorkOn !== undefined) {
    updates.push('date_to_work_on = ?')
    values.push(input.dateToWorkOn)

    // Update status if date changed
    const newStatus = determineStatus(input.dateToWorkOn)
    if (newStatus !== task.status && task.status !== 'archived') {
      updates.push('status = ?')
      values.push(newStatus)
      updates.push('sort_position = ?')
      values.push(getMaxSortPosition(newStatus) + 1)
    }
  }
  if (input.deadline !== undefined) {
    updates.push('deadline = ?')
    values.push(input.deadline)
  }
  if (input.description !== undefined) {
    updates.push('description = ?')
    values.push(input.description)
  }
  if (input.sortPosition !== undefined) {
    updates.push('sort_position = ?')
    values.push(input.sortPosition)
  }

  if (updates.length > 0) {
    values.push(id)
    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  }

  return getTaskById(id)!
}

export function completeTask(id: string): Task {
  const task = getTaskById(id)
  if (!task) throw new Error(`Task ${id} not found`)

  const now = new Date().toISOString()

  db.prepare(`
    UPDATE tasks SET status = 'archived', completion_date = ? WHERE id = ?
  `).run(now, id)

  // Handle recurring tasks
  if (task.recurrenceRule) {
    createNextRecurrence(task)
  }

  return getTaskById(id)!
}

function calculateNextDate(currentDate: string, rule: RecurrenceRule): string {
  const date = new Date(currentDate)

  switch (rule.frequency) {
    case 'daily':
      date.setDate(date.getDate() + rule.interval)
      break
    case 'weekly':
      if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        // Find next matching day of week
        const currentDay = date.getDay()
        const sortedDays = [...rule.daysOfWeek].sort((a, b) => a - b)
        const nextDay = sortedDays.find(d => d > currentDay)
        if (nextDay !== undefined) {
          date.setDate(date.getDate() + (nextDay - currentDay))
        } else {
          // Wrap to next week
          const daysUntilNextWeek = 7 - currentDay + sortedDays[0]
          date.setDate(date.getDate() + daysUntilNextWeek + (rule.interval - 1) * 7)
        }
      } else {
        date.setDate(date.getDate() + 7 * rule.interval)
      }
      break
    case 'monthly':
      date.setMonth(date.getMonth() + rule.interval)
      break
    case 'yearly':
      date.setFullYear(date.getFullYear() + rule.interval)
      break
  }

  return date.toISOString().split('T')[0]
}

function createNextRecurrence(completedTask: Task): void {
  if (!completedTask.recurrenceRule) return

  const nextDate = calculateNextDate(completedTask.dateToWorkOn, completedTask.recurrenceRule)

  // Don't create if past end date
  if (completedTask.recurrenceRule.endDate && nextDate > completedTask.recurrenceRule.endDate) {
    return
  }

  // Copy attachments from original task
  const attachments = getAttachmentsByTask(completedTask.id)

  // Copy context assignments from original task
  const contexts = getContextsByTask(completedTask.id)

  const newTask = createTask({
    name: completedTask.name,
    dateToWorkOn: nextDate,
    deadline: completedTask.deadline,
    description: completedTask.description,
    recurrenceRule: completedTask.recurrenceRule
  })

  // Copy attachments to new task
  for (const attachment of attachments) {
    createAttachment(newTask.id, attachment.filename, attachment.content, attachment.mimeType)
  }

  // Copy context assignments to new task
  if (contexts.length > 0) {
    setTaskContexts(newTask.id, contexts.map(c => c.id))
  }
}

export function reopenTask(id: string): Task {
  const task = getTaskById(id)
  if (!task) throw new Error(`Task ${id} not found`)

  const today = getTodayDateString()
  const sortPosition = getMaxSortPosition('today') + 1

  db.prepare(`
    UPDATE tasks SET status = 'today', completion_date = NULL, date_to_work_on = ?, sort_position = ? WHERE id = ?
  `).run(today, sortPosition, id)

  return getTaskById(id)!
}

export function deleteTask(id: string): void {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
}

export function reorderTask(id: string, newPosition: number): void {
  const task = getTaskById(id)
  if (!task) throw new Error(`Task ${id} not found`)

  const oldPosition = task.sortPosition

  if (newPosition === oldPosition) return

  if (newPosition < oldPosition) {
    // Moving up: increment positions of tasks between new and old position
    db.prepare(`
      UPDATE tasks
      SET sort_position = sort_position + 1
      WHERE status = ? AND sort_position >= ? AND sort_position < ?
    `).run(task.status, newPosition, oldPosition)
  } else {
    // Moving down: decrement positions of tasks between old and new position
    db.prepare(`
      UPDATE tasks
      SET sort_position = sort_position - 1
      WHERE status = ? AND sort_position > ? AND sort_position <= ?
    `).run(task.status, oldPosition, newPosition)
  }

  db.prepare('UPDATE tasks SET sort_position = ? WHERE id = ?').run(newPosition, id)
}

export function clearUnreadAgentMessage(id: string): void {
  db.prepare('UPDATE tasks SET has_unread_agent_message = 0 WHERE id = ?').run(id)
}

export function setUnreadAgentMessage(id: string): void {
  db.prepare('UPDATE tasks SET has_unread_agent_message = 1 WHERE id = ?').run(id)
}

export function migrateTasksToToday(): void {
  const today = getTodayDateString()

  // Get tasks that need migration
  const tasksToMigrate = db.prepare(`
    SELECT id FROM tasks WHERE status = 'upcoming' AND date_to_work_on <= ?
  `).all(today) as { id: string }[]

  for (const { id } of tasksToMigrate) {
    const sortPosition = getMaxSortPosition('today') + 1
    db.prepare(`
      UPDATE tasks SET status = 'today', sort_position = ? WHERE id = ?
    `).run(sortPosition, id)
  }
}

// Message operations

function rowToMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    sender: row.sender as MessageSender,
    content: row.content as string,
    timestamp: row.timestamp as string
  }
}

export function getMessagesByTask(taskId: string): Message[] {
  const rows = db.prepare(
    'SELECT * FROM messages WHERE task_id = ? ORDER BY timestamp ASC'
  ).all(taskId)
  return rows.map(row => rowToMessage(row as Record<string, unknown>))
}

export function createMessage(taskId: string, content: string, sender: MessageSender): Message {
  const id = uuidv4()
  const timestamp = new Date().toISOString()

  db.prepare(`
    INSERT INTO messages (id, task_id, sender, content, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, taskId, sender, content, timestamp)

  return { id, taskId, sender, content, timestamp }
}

export function deleteMessage(id: string): void {
  db.prepare('DELETE FROM messages WHERE id = ?').run(id)
}

export function deleteMessagesFromId(taskId: string, messageId: string): void {
  // Get the target message to find its position
  const targetMessage = db.prepare('SELECT id, timestamp FROM messages WHERE id = ?').get(messageId) as { id: string; timestamp: string } | undefined
  if (!targetMessage) return

  // Delete all messages in this task that come at or after this message
  // Use timestamp AND (id comparison for same-timestamp messages via rowid ordering)
  db.prepare(`
    DELETE FROM messages
    WHERE task_id = ? AND (
      timestamp > ? OR
      (timestamp = ? AND rowid >= (SELECT rowid FROM messages WHERE id = ?))
    )
  `).run(taskId, targetMessage.timestamp, targetMessage.timestamp, messageId)
}

export function updateMessageContent(id: string, content: string): void {
  db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(content, id)
}

// Attachment operations

function rowToAttachment(row: Record<string, unknown>): Attachment {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    filename: row.filename as string,
    content: row.content as string,
    mimeType: row.mime_type as string,
    createdAt: row.created_at as string
  }
}

export function getAttachmentsByTask(taskId: string): Attachment[] {
  const rows = db.prepare(
    'SELECT * FROM attachments WHERE task_id = ? ORDER BY created_at ASC'
  ).all(taskId)
  return rows.map(row => rowToAttachment(row as Record<string, unknown>))
}

export function createAttachment(
  taskId: string,
  filename: string,
  content: string,
  mimeType: string
): Attachment {
  const id = uuidv4()
  const createdAt = new Date().toISOString()

  db.prepare(`
    INSERT INTO attachments (id, task_id, filename, content, mime_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, taskId, filename, content, mimeType, createdAt)

  return { id, taskId, filename, content, mimeType, createdAt }
}

export function deleteAttachment(id: string): void {
  db.prepare('DELETE FROM attachments WHERE id = ?').run(id)
}

// Tilda message operations

function rowToTildaMessage(row: Record<string, unknown>): TildaMessage {
  return {
    id: row.id as string,
    sender: row.sender as MessageSender,
    content: row.content as string,
    timestamp: row.timestamp as string
  }
}

export function getTildaMessages(): TildaMessage[] {
  const rows = db.prepare(
    'SELECT * FROM tilda_messages ORDER BY timestamp ASC'
  ).all()
  return rows.map(row => rowToTildaMessage(row as Record<string, unknown>))
}

export function createTildaMessage(content: string, sender: MessageSender): TildaMessage {
  const id = uuidv4()
  const timestamp = new Date().toISOString()

  db.prepare(`
    INSERT INTO tilda_messages (id, sender, content, timestamp)
    VALUES (?, ?, ?, ?)
  `).run(id, sender, content, timestamp)

  return { id, sender, content, timestamp }
}

export function clearTildaMessages(): void {
  db.prepare('DELETE FROM tilda_messages').run()
}

export function deleteTildaMessage(id: string): void {
  db.prepare('DELETE FROM tilda_messages WHERE id = ?').run(id)
}

export function deleteTildaMessagesFromId(messageId: string): void {
  // Get the target message to find its position
  const targetMessage = db.prepare('SELECT id, timestamp FROM tilda_messages WHERE id = ?').get(messageId) as { id: string; timestamp: string } | undefined
  if (!targetMessage) return

  // Delete all messages that come at or after this message
  // Use timestamp AND (rowid comparison for same-timestamp messages)
  db.prepare(`
    DELETE FROM tilda_messages
    WHERE timestamp > ? OR
      (timestamp = ? AND rowid >= (SELECT rowid FROM tilda_messages WHERE id = ?))
  `).run(targetMessage.timestamp, targetMessage.timestamp, messageId)
}

export function updateTildaMessageContent(id: string, content: string): void {
  db.prepare('UPDATE tilda_messages SET content = ? WHERE id = ?').run(content, id)
}

// Tilda attachment operations

function rowToTildaAttachment(row: Record<string, unknown>): TildaAttachment {
  return {
    id: row.id as string,
    filename: row.filename as string,
    content: row.content as string,
    mimeType: row.mime_type as string,
    createdAt: row.created_at as string
  }
}

export function getTildaAttachments(): TildaAttachment[] {
  const rows = db.prepare(
    'SELECT * FROM tilda_attachments ORDER BY created_at ASC'
  ).all()
  return rows.map(row => rowToTildaAttachment(row as Record<string, unknown>))
}

export function createTildaAttachment(
  filename: string,
  content: string,
  mimeType: string
): TildaAttachment {
  const id = uuidv4()
  const createdAt = new Date().toISOString()

  db.prepare(`
    INSERT INTO tilda_attachments (id, filename, content, mime_type, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, filename, content, mimeType, createdAt)

  return { id, filename, content, mimeType, createdAt }
}

export function deleteTildaAttachment(id: string): void {
  db.prepare('DELETE FROM tilda_attachments WHERE id = ?').run(id)
}

export function clearTildaAttachments(): void {
  db.prepare('DELETE FROM tilda_attachments').run()
}

// Search tasks for Tilda tool

export interface SearchTasksCriteria {
  status?: 'today' | 'upcoming' | 'archived' | 'all'
  searchQuery?: string
  dateFrom?: string
  dateTo?: string
  contextId?: string
}

export function searchTasks(criteria: SearchTasksCriteria): Task[] {
  let query = 'SELECT DISTINCT t.* FROM tasks t'
  const params: unknown[] = []

  // Join with task_contexts if filtering by context
  if (criteria.contextId) {
    query += ' INNER JOIN task_contexts tc ON t.id = tc.task_id'
  }

  query += ' WHERE 1=1'

  if (criteria.contextId) {
    query += ' AND tc.context_id = ?'
    params.push(criteria.contextId)
  }

  if (criteria.status && criteria.status !== 'all') {
    query += ' AND t.status = ?'
    params.push(criteria.status)
  }

  if (criteria.searchQuery) {
    query += ' AND (t.name LIKE ? OR t.description LIKE ?)'
    const searchPattern = `%${criteria.searchQuery}%`
    params.push(searchPattern, searchPattern)
  }

  if (criteria.dateFrom) {
    query += ' AND t.date_to_work_on >= ?'
    params.push(criteria.dateFrom)
  }

  if (criteria.dateTo) {
    query += ' AND t.date_to_work_on <= ?'
    params.push(criteria.dateTo)
  }

  query += ' ORDER BY t.sort_position ASC'

  const rows = db.prepare(query).all(...params)
  return rows.map(row => rowToTask(row as Record<string, unknown>))
}

// Context operations

function rowToContext(row: Record<string, unknown>): Context {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    sortPosition: row.sort_position as number,
    createdAt: row.created_at as string
  }
}

export function getAllContexts(): Context[] {
  const rows = db.prepare('SELECT * FROM contexts ORDER BY sort_position ASC').all()
  return rows.map(row => rowToContext(row as Record<string, unknown>))
}

export function getContextById(id: string): Context | undefined {
  const row = db.prepare('SELECT * FROM contexts WHERE id = ?').get(id)
  return row ? rowToContext(row as Record<string, unknown>) : undefined
}

function getMaxContextSortPosition(): number {
  const result = db.prepare(
    'SELECT MAX(sort_position) as max FROM contexts'
  ).get() as { max: number | null }
  return result.max ?? -1
}

export function createContext(input: CreateContextInput): Context {
  const id = uuidv4()
  const now = new Date().toISOString()
  const sortPosition = getMaxContextSortPosition() + 1

  db.prepare(`
    INSERT INTO contexts (id, name, description, sort_position, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, input.name, input.description ?? null, sortPosition, now)

  return getContextById(id)!
}

export function updateContext(id: string, input: UpdateContextInput): Context {
  const context = getContextById(id)
  if (!context) throw new Error(`Context ${id} not found`)

  const updates: string[] = []
  const values: unknown[] = []

  if (input.name !== undefined) {
    updates.push('name = ?')
    values.push(input.name)
  }
  if (input.description !== undefined) {
    updates.push('description = ?')
    values.push(input.description)
  }

  if (updates.length > 0) {
    values.push(id)
    db.prepare(`UPDATE contexts SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  }

  return getContextById(id)!
}

export function deleteContext(id: string): void {
  db.prepare('DELETE FROM contexts WHERE id = ?').run(id)
}

export function reorderContext(id: string, newPosition: number): void {
  const context = getContextById(id)
  if (!context) throw new Error(`Context ${id} not found`)

  const oldPosition = context.sortPosition

  if (newPosition === oldPosition) return

  if (newPosition < oldPosition) {
    db.prepare(`
      UPDATE contexts
      SET sort_position = sort_position + 1
      WHERE sort_position >= ? AND sort_position < ?
    `).run(newPosition, oldPosition)
  } else {
    db.prepare(`
      UPDATE contexts
      SET sort_position = sort_position - 1
      WHERE sort_position > ? AND sort_position <= ?
    `).run(oldPosition, newPosition)
  }

  db.prepare('UPDATE contexts SET sort_position = ? WHERE id = ?').run(newPosition, id)
}

// Task-Context relationship operations

export function getContextsByTask(taskId: string): Context[] {
  const rows = db.prepare(`
    SELECT c.* FROM contexts c
    INNER JOIN task_contexts tc ON c.id = tc.context_id
    WHERE tc.task_id = ?
    ORDER BY c.sort_position ASC
  `).all(taskId)
  return rows.map(row => rowToContext(row as Record<string, unknown>))
}

export function getTasksByContext(contextId: string): Task[] {
  const rows = db.prepare(`
    SELECT t.* FROM tasks t
    INNER JOIN task_contexts tc ON t.id = tc.task_id
    WHERE tc.context_id = ?
    ORDER BY t.sort_position ASC
  `).all(contextId)
  return rows.map(row => rowToTask(row as Record<string, unknown>))
}

export function addTaskToContext(taskId: string, contextId: string): void {
  db.prepare(`
    INSERT OR IGNORE INTO task_contexts (task_id, context_id)
    VALUES (?, ?)
  `).run(taskId, contextId)
}

export function removeTaskFromContext(taskId: string, contextId: string): void {
  db.prepare('DELETE FROM task_contexts WHERE task_id = ? AND context_id = ?').run(taskId, contextId)
}

export function setTaskContexts(taskId: string, contextIds: string[]): void {
  // Remove all existing associations
  db.prepare('DELETE FROM task_contexts WHERE task_id = ?').run(taskId)

  // Add new associations
  const insert = db.prepare('INSERT INTO task_contexts (task_id, context_id) VALUES (?, ?)')
  for (const contextId of contextIds) {
    insert.run(taskId, contextId)
  }
}

// Context document operations

function rowToContextDocument(row: Record<string, unknown>): ContextDocument {
  return {
    id: row.id as string,
    contextId: row.context_id as string,
    filename: row.filename as string,
    content: row.content as string,
    mimeType: row.mime_type as string,
    fileSize: row.file_size as number,
    createdAt: row.created_at as string
  }
}

export function getDocumentsByContext(contextId: string): ContextDocument[] {
  const rows = db.prepare(
    'SELECT * FROM context_documents WHERE context_id = ? ORDER BY created_at ASC'
  ).all(contextId)
  return rows.map(row => rowToContextDocument(row as Record<string, unknown>))
}

export function createContextDocument(
  contextId: string,
  filename: string,
  content: string,
  mimeType: string,
  fileSize: number
): ContextDocument {
  const id = uuidv4()
  const createdAt = new Date().toISOString()

  db.prepare(`
    INSERT INTO context_documents (id, context_id, filename, content, mime_type, file_size, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, contextId, filename, content, mimeType, fileSize, createdAt)

  return { id, contextId, filename, content, mimeType, fileSize, createdAt }
}

export function deleteContextDocument(id: string): void {
  db.prepare('DELETE FROM context_documents WHERE id = ?').run(id)
}

// AI Learning Notes operations

function rowToAILearningNote(row: Record<string, unknown>): AILearningNote {
  return {
    id: row.id as string,
    contextId: row.context_id as string,
    title: row.title as string,
    content: row.content as string,
    category: row.category as AILearningNote['category'],
    sourceTaskId: row.source_task_id as string | null,
    sourceTaskName: row.source_task_name as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }
}

export function getAILearningNotesByContext(contextId: string): AILearningNote[] {
  const rows = db.prepare(
    'SELECT * FROM ai_learning_notes WHERE context_id = ? ORDER BY created_at DESC'
  ).all(contextId)
  return rows.map(row => rowToAILearningNote(row as Record<string, unknown>))
}

export function getAllAILearningNotes(): AILearningNote[] {
  const rows = db.prepare('SELECT * FROM ai_learning_notes ORDER BY created_at DESC').all()
  return rows.map(row => rowToAILearningNote(row as Record<string, unknown>))
}

export function getAILearningNoteById(id: string): AILearningNote | undefined {
  const row = db.prepare('SELECT * FROM ai_learning_notes WHERE id = ?').get(id)
  return row ? rowToAILearningNote(row as Record<string, unknown>) : undefined
}

export function createAILearningNote(input: CreateAILearningNoteInput): AILearningNote {
  const id = uuidv4()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO ai_learning_notes (id, context_id, title, content, category, source_task_id, source_task_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.contextId,
    input.title,
    input.content,
    input.category,
    input.sourceTaskId ?? null,
    input.sourceTaskName ?? null,
    now,
    now
  )

  return getAILearningNoteById(id)!
}

export function updateAILearningNote(id: string, input: UpdateAILearningNoteInput): AILearningNote {
  const note = getAILearningNoteById(id)
  if (!note) throw new Error(`AI Learning Note ${id} not found`)

  const updates: string[] = ['updated_at = ?']
  const values: unknown[] = [new Date().toISOString()]

  if (input.title !== undefined) {
    updates.push('title = ?')
    values.push(input.title)
  }
  if (input.content !== undefined) {
    updates.push('content = ?')
    values.push(input.content)
  }
  if (input.category !== undefined) {
    updates.push('category = ?')
    values.push(input.category)
  }

  values.push(id)
  db.prepare(`UPDATE ai_learning_notes SET ${updates.join(', ')} WHERE id = ?`).run(...values)

  return getAILearningNoteById(id)!
}

export function deleteAILearningNote(id: string): void {
  db.prepare('DELETE FROM ai_learning_notes WHERE id = ?').run(id)
}
