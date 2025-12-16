import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import type {
  Task,
  Message,
  Attachment,
  CreateTaskInput,
  UpdateTaskInput,
  MessageSender,
  RecurrenceRule
} from '../src/types'

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
  `)
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
  const sortPosition = getMaxSortPosition(status) + 1

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
}

export function reopenTask(id: string): Task {
  const task = getTaskById(id)
  if (!task) throw new Error(`Task ${id} not found`)

  const status = determineStatus(task.dateToWorkOn)
  const sortPosition = getMaxSortPosition(status) + 1

  db.prepare(`
    UPDATE tasks SET status = ?, completion_date = NULL, sort_position = ? WHERE id = ?
  `).run(status, sortPosition, id)

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
