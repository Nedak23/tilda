import { spawn, ChildProcess, execSync } from 'child_process'
import os from 'os'
import path from 'path'
import { mkdir, writeFile, readdir, readFile, rm, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { getTildaDirectory, getModel } from './settings'
import {
  getTaskById,
  getContextById,
  getContextForTask,
  getDocumentsByContext,
  getAILearningNotesByContext,
  getAttachmentsByTask,
  createContextDocument,
  createAILearningNote,
  setTaskClaudeSessionId,
  GENERAL_CONTEXT_ID
} from './database'
import type { Task, Context, ContextDocument, AILearningNote, AILearningNoteCategory } from '../src/types'
import { logger } from './logger'

// Cache the resolved Claude CLI path to avoid repeated lookups
let cachedClaudePath: string | null = null

function getClaudePath(): string {
  if (cachedClaudePath) return cachedClaudePath

  // Try to find claude in PATH first (works cross-platform)
  try {
    const cmd = process.platform === 'win32' ? 'where claude' : 'which claude'
    const result = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim()
    if (result) {
      // 'where' on Windows can return multiple lines; take the first
      cachedClaudePath = result.split('\n')[0].trim()
      return cachedClaudePath
    }
  } catch {
    // Command failed, fall back to known locations
  }

  // Fall back to common installation paths
  const home = os.homedir()
  const candidates = [
    path.join(home, '.local', 'bin', 'claude'),      // Linux/Mac default
    '/opt/homebrew/bin/claude',                       // Homebrew Apple Silicon
    '/usr/local/bin/claude',                          // Homebrew Intel / manual
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      cachedClaudePath = candidate
      return cachedClaudePath
    }
  }

  // Last resort: return 'claude' and let spawn find it in PATH
  // This provides a clear error if not found
  cachedClaudePath = 'claude'
  return cachedClaudePath
}

// Process registry
interface ClaudeCodeProcess {
  taskId: string
  process: ChildProcess
  workingFolder: string
  sessionId: string | null
  isProcessing: boolean
  outputBuffer: string
  resolveResponse: ((value: string) => void) | null
  rejectResponse: ((reason: Error) => void) | null
}

const processRegistry = new Map<string, ClaudeCodeProcess>()

// Parsed output types
export type ParsedOutputType = 'init' | 'assistant' | 'user' | 'result' | 'error'

export interface ParsedOutput {
  type: ParsedOutputType
  content: string
  sessionId?: string
  isComplete?: boolean
  isError?: boolean
}

// Get the working folder path for a task
export function getWorkingFolder(taskId: string): string {
  const tildaDir = getTildaDirectory()
  return path.join(tildaDir, taskId)
}

// Generate CLAUDE.md content for a task
function generateClaudeMd(task: Task, context: Context | null, generalContext: Context | null): string {
  let content = `# Task: ${task.name}\n\n`

  if (task.description) {
    content += `## Description\n${task.description}\n\n`
  }

  if (task.deadline) {
    content += `## Deadline\n${task.deadline}\n\n`
  }

  if (context) {
    content += `## Context: ${context.name}\n`
    if (context.description) {
      content += `${context.description}\n`
    }
    content += '\n'
  }

  content += `## Important Files
- \`.tilda-notes/\` contains relevant learning notes from previous tasks
- Context documents are in this folder root

## Working Directory Rules
- You MUST only read, write, and execute within this working directory
- NEVER access, modify, or reference files outside this folder
- All file paths should be relative to the current directory
- Do not use absolute paths or navigate to parent directories

## Asking the User Questions
When you need to ask the user a question with specific options, format it like this:

:::question
Your question text here?
:::option Option A
:::option Option B
:::option Option C
:::endquestion

The user will see clickable buttons for each option. Always use this format when you have specific choices to offer. You can include normal text before or after the question block.

## Guidelines
- Focus on helping complete this specific task
- Reference context documents and learning notes as needed
- Be concise and helpful
`

  return content
}

// Slugify a title for use in filenames
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50)
}

// Initialize working folder for a task
export async function initializeWorkingFolder(taskId: string): Promise<string> {
  const task = getTaskById(taskId)
  if (!task) throw new Error(`Task ${taskId} not found`)

  const workingFolder = getWorkingFolder(taskId)

  // Create working folder if it doesn't exist
  if (!existsSync(workingFolder)) {
    await mkdir(workingFolder, { recursive: true })
  }

  // Get task's context and General context
  const taskContext = task.contextId ? getContextById(task.contextId) : null
  const generalContext = getContextById(GENERAL_CONTEXT_ID)

  // Generate and write CLAUDE.md
  const claudeMd = generateClaudeMd(task, taskContext || null, generalContext || null)
  await writeFile(path.join(workingFolder, 'CLAUDE.md'), claudeMd, 'utf-8')

  // Create .tilda-notes directory
  const notesDir = path.join(workingFolder, '.tilda-notes')
  if (!existsSync(notesDir)) {
    await mkdir(notesDir, { recursive: true })
  }

  // Copy learning notes from task's context
  if (taskContext) {
    const notes = getAILearningNotesByContext(taskContext.id)
    for (const note of notes) {
      const filename = `${note.id}-${slugify(note.title)}.md`
      const noteContent = `# ${note.title}\n\n**Category:** ${note.category}\n\n${note.content}`
      await writeFile(path.join(notesDir, filename), noteContent, 'utf-8')
    }
  }

  // Always copy General context's learning notes
  if (generalContext) {
    const generalNotes = getAILearningNotesByContext(generalContext.id)
    for (const note of generalNotes) {
      const filename = `${note.id}-${slugify(note.title)}.md`
      // Skip if already written (in case task context is General)
      const notePath = path.join(notesDir, filename)
      if (!existsSync(notePath)) {
        const noteContent = `# ${note.title}\n\n**Category:** ${note.category}\n**Source:** General\n\n${note.content}`
        await writeFile(notePath, noteContent, 'utf-8')
      }
    }
  }

  // Copy context documents from task's context
  if (taskContext) {
    const documents = getDocumentsByContext(taskContext.id)
    for (const doc of documents) {
      const filePath = doc.relativePath
        ? path.join(workingFolder, ...doc.relativePath.split('/'))
        : path.join(workingFolder, doc.filename)

      // Ensure parent directory exists for files with relative paths
      const dir = path.dirname(filePath)
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true })
      }

      // Binary files are stored as data URLs — extract base64 and write as binary
      const base64Match = doc.content.match(/^data:([^;]+);base64,(.+)$/)
      if (base64Match) {
        await writeFile(filePath, Buffer.from(base64Match[2], 'base64'))
      } else {
        await writeFile(filePath, doc.content, 'utf-8')
      }
    }
  }

  // Copy task-specific attachments
  const taskAttachments = getAttachmentsByTask(taskId)
  for (const attachment of taskAttachments) {
    const filePath = attachment.relativePath
      ? path.join(workingFolder, ...attachment.relativePath.split('/'))
      : path.join(workingFolder, attachment.filename)

    // Ensure parent directory exists for files with relative paths
    const dir = path.dirname(filePath)
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }

    // Binary files are stored as data URLs — extract base64 and write as binary
    const base64Match = attachment.content.match(/^data:([^;]+);base64,(.+)$/)
    if (base64Match) {
      await writeFile(filePath, Buffer.from(base64Match[2], 'base64'))
    } else {
      await writeFile(filePath, attachment.content, 'utf-8')
    }
  }

  return workingFolder
}

// Parse a line of JSON output from Claude CLI
function parseOutputLine(line: string): ParsedOutput | null {
  if (!line.trim()) return null

  try {
    const parsed = JSON.parse(line)

    switch (parsed.type) {
      case 'system':
        return {
          type: 'init',
          content: '',
          sessionId: parsed.session_id
        }

      case 'assistant':
        // Extract text content from the message
        const message = parsed.message
        if (message?.content) {
          const textContent = message.content
            .filter((block: { type: string }) => block.type === 'text')
            .map((block: { text: string }) => block.text)
            .join('')
          return {
            type: 'assistant',
            content: textContent,
            sessionId: parsed.session_id
          }
        }
        return null

      case 'user':
        // Tool result - not displayed to user
        return {
          type: 'user',
          content: '',
          sessionId: parsed.session_id
        }

      case 'result':
        return {
          type: 'result',
          content: parsed.result || '',
          sessionId: parsed.session_id,
          isComplete: true,
          isError: parsed.is_error
        }

      default:
        return null
    }
  } catch {
    // Not valid JSON, might be an error message
    return {
      type: 'error',
      content: line,
      isError: true
    }
  }
}

// Extract JSON from text using balanced brace matching
// More robust than regex for finding valid JSON objects
interface ExtractedJson {
  documents?: Array<{ filename: string; reason: string }>
  notes?: Array<{ title: string; content: string; category: AILearningNoteCategory }>
}

function extractJson(text: string): ExtractedJson | null {
  let depth = 0
  let start = -1

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (char === '{') {
      if (depth === 0) start = i
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        // Found a complete object, try to parse it
        const candidate = text.slice(start, i + 1)
        try {
          const parsed = JSON.parse(candidate)
          // Validate it has the expected structure
          if (parsed && typeof parsed === 'object' &&
              ('documents' in parsed || 'notes' in parsed)) {
            return parsed as ExtractedJson
          }
        } catch {
          // Not valid JSON, continue searching
        }
        start = -1
      }
    }
  }

  return null
}

// Send a message to Claude Code using the same approach as Conductor
export async function sendMessage(
  taskId: string,
  message: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  // Initialize working folder
  const workingFolder = await initializeWorkingFolder(taskId)

  // Check if we have an existing session to resume
  // First check in-memory registry, then fall back to database
  const existing = processRegistry.get(taskId)
  const task = getTaskById(taskId)
  const sessionId = existing?.sessionId || task?.claudeSessionId || null

  // Get the Claude CLI path
  const claudePath = getClaudePath()

  // Build args for Claude Code CLI
  const args = [
    '--output-format', 'stream-json',
    '--verbose',
    '--input-format', 'stream-json',
    '--max-turns', '100',
    '--model', getModel(),
    '--allowedTools',
      // Standard tools
      'Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch',
      'NotebookEdit', 'Task', 'TodoWrite',
      // Write/Edit scoped to working directory
      `Edit(//${workingFolder.replace(/^\//, '')}/**)`,
      `Write(//${workingFolder.replace(/^\//, '')}/**)`,
      // Bash restricted to safe commands
      'Bash(cd *)', 'Bash(ls *)', 'Bash(cat *)', 'Bash(find *)',
      'Bash(mkdir *)', 'Bash(cp *)', 'Bash(mv *)', 'Bash(rm *)',
      'Bash(touch *)', 'Bash(head *)', 'Bash(tail *)', 'Bash(wc *)',
      'Bash(sort *)', 'Bash(grep *)', 'Bash(python *)', 'Bash(python3 *)',
      'Bash(node *)', 'Bash(npm *)', 'Bash(npx *)',
    '--append-system-prompt', 'When you need to ask the user a question with specific options, you MUST format it like this:\n\n:::question\nYour question text here?\n:::option Option A\n:::option Option B\n:::option Option C\n:::endquestion\n\nThe user will see clickable buttons for each option. Always use this format when you have specific choices to offer. You can include normal text before or after the question block.'
  ]

  // Resume existing session if we have one
  if (sessionId) {
    args.push('--resume', sessionId)
  }

  logger.log(`Spawning Claude Code for task ${taskId}`)
  logger.log(`Args: ${args.join(' ')}`)
  logger.log(`Working folder: ${workingFolder}`)

  const proc = spawn(claudePath, args, {
    cwd: workingFolder,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env }
  })

  logger.log(`Claude Code process spawned with PID: ${proc.pid}`)

  // Register process immediately so it can be killed during execution
  processRegistry.set(taskId, {
    taskId,
    process: proc,
    workingFolder,
    sessionId,
    isProcessing: true,
    outputBuffer: '',
    resolveResponse: null,
    rejectResponse: null
  })

  return new Promise((resolve, reject) => {
    let outputBuffer = ''
    let currentResponse = ''
    let lastAssistantContent = ''
    let capturedSessionId = sessionId
    let hasReceivedData = false
    let resolved = false
    let cancelled = false

    // Check if process was killed
    const checkCancelled = () => {
      if (!processRegistry.has(taskId)) {
        cancelled = true
        return true
      }
      return false
    }

    // Set a timeout to detect if the process fails to start (no output at all)
    const startupTimeoutId = setTimeout(() => {
      if (!hasReceivedData) {
        logger.error('Claude Code process timeout - no output received after 30 seconds')
        proc.kill('SIGTERM')
        reject(new Error('Timeout waiting for Claude Code to start'))
      }
    }, 30000)

    // Rolling inactivity timeout - resets on every stdout data
    const INACTIVITY_WARNING_MS = 120_000
    const INACTIVITY_KILL_MS = 300_000
    let inactivityWarningId: ReturnType<typeof setTimeout> | null = null
    let inactivityKillId: ReturnType<typeof setTimeout> | null = null

    const resetInactivityTimers = () => {
      if (inactivityWarningId) clearTimeout(inactivityWarningId)
      if (inactivityKillId) clearTimeout(inactivityKillId)
      inactivityWarningId = setTimeout(() => {
        logger.error(`Claude Code inactivity warning - no output for ${INACTIVITY_WARNING_MS / 1000}s (task ${taskId})`)
      }, INACTIVITY_WARNING_MS)
      inactivityKillId = setTimeout(() => {
        logger.error(`Claude Code inactivity timeout - killing process after ${INACTIVITY_KILL_MS / 1000}s (task ${taskId})`)
        proc.kill('SIGTERM')
        if (!resolved) {
          resolved = true
          reject(new Error('Claude Code process timed out due to inactivity'))
        }
      }, INACTIVITY_KILL_MS)
    }

    const clearInactivityTimers = () => {
      if (inactivityWarningId) clearTimeout(inactivityWarningId)
      if (inactivityKillId) clearTimeout(inactivityKillId)
    }

    proc.stdout?.on('data', (data: Buffer) => {
      // Check if we were cancelled
      if (checkCancelled()) return

      hasReceivedData = true
      resetInactivityTimers()
      const text = data.toString()
      logger.log(`Claude Code stdout:`, text.substring(0, 300))
      outputBuffer += text

      // Process complete lines
      const lines = outputBuffer.split('\n')
      outputBuffer = lines.pop() || '' // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue

        try {
          const parsed = JSON.parse(line)

          if (parsed.type === 'system' && parsed.session_id) {
            capturedSessionId = parsed.session_id
            // Update registry with session ID
            const entry = processRegistry.get(taskId)
            if (entry) {
              entry.sessionId = capturedSessionId
            }
            logger.log(`Claude Code session ID: ${capturedSessionId}`)
          } else if (parsed.type === 'assistant' && parsed.message?.content) {
            const textContent = parsed.message.content
              .filter((block: { type: string }) => block.type === 'text')
              .map((block: { text: string }) => block.text)
              .join('')

            // Stream only the new content
            if (textContent.length > lastAssistantContent.length) {
              const newContent = textContent.slice(lastAssistantContent.length)
              lastAssistantContent = textContent
              currentResponse = textContent
              onChunk(newContent)
            }
          } else if (parsed.type === 'result') {
            clearTimeout(startupTimeoutId)
            clearInactivityTimers()
            // Update registry: mark as not processing, keep session for future use
            const entry = processRegistry.get(taskId)
            if (entry) {
              entry.isProcessing = false
              entry.sessionId = capturedSessionId
            }
            // Persist session ID to database for app restart recovery
            if (capturedSessionId) {
              setTaskClaudeSessionId(taskId, capturedSessionId)
            }
            if (!resolved) {
              resolved = true
              resolve(currentResponse || parsed.result || '')
            }
          } else {
            logger.log(`Claude Code unknown message type: ${parsed.type}`, JSON.stringify(parsed).substring(0, 200))
          }
        } catch {
          // Not JSON, skip
        }
      }
    })

    proc.stderr?.on('data', (data: Buffer) => {
      hasReceivedData = true
      const error = data.toString()
      logger.error(`Claude Code stderr:`, error)
    })

    proc.on('spawn', () => {
      logger.log(`Claude Code process spawned successfully`)

      // Send the message as JSON to stdin
      // Format: {"type":"user","message":{"role":"user","content":"..."}}
      const inputMessage = JSON.stringify({
        type: 'user',
        message: {
          role: 'user',
          content: message
        }
      })
      logger.log(`Sending to stdin: ${inputMessage}`)

      // Write with error callback
      proc.stdin?.write(inputMessage + '\n', (err) => {
        if (err) {
          logger.error('Failed to write to Claude Code stdin:', err)
          if (!resolved) {
            resolved = true
            clearTimeout(startupTimeoutId)
            clearInactivityTimers()
            reject(new Error(`Failed to send message to Claude Code: ${err.message}`))
          }
        }
      })
    })

    proc.on('exit', (code, signal) => {
      clearTimeout(startupTimeoutId)
      clearInactivityTimers()
      logger.log(`Claude Code process exited with code ${code}, signal ${signal}`)

      // Update registry: mark as not processing
      const entry = processRegistry.get(taskId)
      if (entry) {
        entry.isProcessing = false
      }

      // If cancelled, reject with cancellation error
      if (cancelled || checkCancelled()) {
        if (!resolved) {
          resolved = true
          reject(new Error('Request cancelled'))
        }
        return
      }
      if (!resolved) {
        if (code !== 0 && code !== null) {
          reject(new Error(`Process exited with code ${code}`))
        } else {
          // Process exited cleanly but no result message — resolve with whatever we have
          resolved = true
          if (currentResponse) {
            resolve(currentResponse)
          } else {
            reject(new Error('Claude Code process exited without producing a response'))
          }
        }
      }
    })

    proc.on('error', (err) => {
      clearTimeout(startupTimeoutId)
      clearInactivityTimers()
      logger.error(`Claude Code process error:`, err)
      reject(err)
    })
  })
}

// Kill a Claude Code process (clears session info)
export function killProcess(taskId: string): void {
  const ccProcess = processRegistry.get(taskId)
  if (ccProcess) {
    // Try to kill if process is still running
    try {
      ccProcess.process.kill('SIGTERM')
    } catch {
      // Process may already be dead
    }
    processRegistry.delete(taskId)
  }
}

// Get process status
export function getProcessStatus(taskId: string): 'idle' | 'processing' | 'not_running' {
  const ccProcess = processRegistry.get(taskId)
  if (!ccProcess) {
    return 'not_running'
  }
  return ccProcess.isProcessing ? 'processing' : 'idle'
}

// Extract useful content and cleanup working folder on task completion
export async function extractAndCleanup(taskId: string): Promise<void> {
  const task = getTaskById(taskId)
  if (!task) return

  const workingFolder = getWorkingFolder(taskId)

  // Kill process if running
  killProcess(taskId)

  // Clear session ID since we're cleaning up
  setTaskClaudeSessionId(taskId, null)

  // Check if working folder exists
  if (!existsSync(workingFolder)) {
    return
  }

  try {
    // Get list of files in working folder (excluding CLAUDE.md and .tilda-notes)
    const entries = await readdir(workingFolder, { withFileTypes: true })
    const filesToAnalyze: { name: string; content: string; isNew: boolean }[] = []

    // Gather files that were created/modified during the task
    for (const entry of entries) {
      if (entry.name === 'CLAUDE.md' || entry.name === '.tilda-notes') {
        continue
      }

      if (entry.isFile()) {
        const filePath = path.join(workingFolder, entry.name)
        try {
          const content = await readFile(filePath, 'utf-8')
          // Check if this is a new file (not from context documents)
          const taskContext = task.contextId ? getContextById(task.contextId) : null
          const existingDocs = taskContext ? getDocumentsByContext(taskContext.id) : []
          const isNew = !existingDocs.some(d => d.filename === entry.name)

          filesToAnalyze.push({
            name: entry.name,
            content,
            isNew
          })
        } catch {
          // Skip files that can't be read
        }
      }
    }

    // If there are new files, ask Claude Code to analyze what's worth keeping
    if (filesToAnalyze.some(f => f.isNew)) {
      const targetContextId = task.contextId || GENERAL_CONTEXT_ID

      // Use Claude Code for extraction analysis
      const analysisPrompt = `The following files were created during the task "${task.name}".
Please analyze them and determine:
1. Which files should be saved as context documents (useful for future tasks)
2. What learning notes should be captured (key insights, decisions, preferences)

Files to analyze:
${filesToAnalyze.filter(f => f.isNew).map(f => `\n--- ${f.name} ---\n${f.content.substring(0, 2000)}${f.content.length > 2000 ? '...(truncated)' : ''}`).join('\n')}

Respond with a JSON object in this format:
{
  "documents": [
    {"filename": "name.ext", "reason": "why it's useful"}
  ],
  "notes": [
    {"title": "brief title", "content": "detailed note", "category": "preference|domain_knowledge|workflow|technical_decision"}
  ]
}

Only include items that would genuinely be useful for future tasks. If nothing is worth keeping, return empty arrays.`

      try {
        // Run a one-time Claude Code process for extraction
        const extractionFolder = workingFolder
        let extractionResult = ''

        const claudePath = getClaudePath()

        const tempProcess = spawn(claudePath, [
          '--print',
          '--output-format', 'stream-json',
          '--verbose',
          '--model', 'haiku',
          analysisPrompt
        ], {
          cwd: extractionFolder,
          stdio: ['pipe', 'pipe', 'pipe']
        })

        await new Promise<void>((resolve, reject) => {
          let buffer = ''

          tempProcess.stdout?.on('data', (data: Buffer) => {
            buffer += data.toString()
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const parsed = parseOutputLine(line)
              if (parsed?.type === 'result') {
                extractionResult = parsed.content
              }
            }
          })

          tempProcess.on('exit', () => resolve())
          tempProcess.on('error', reject)
        })

        // Try to parse the extraction result
        try {
          // Extract JSON using balanced brace matching
          const extracted = extractJson(extractionResult)
          if (extracted) {
            // Save documents
            if (extracted.documents && Array.isArray(extracted.documents)) {
              for (const doc of extracted.documents) {
                const fileToSave = filesToAnalyze.find(f => f.name === doc.filename)
                if (fileToSave) {
                  createContextDocument(
                    targetContextId,
                    doc.filename,
                    fileToSave.content,
                    'text/plain',
                    fileToSave.content.length
                  )
                }
              }
            }

            // Save learning notes
            if (extracted.notes && Array.isArray(extracted.notes)) {
              for (const note of extracted.notes) {
                if (note.title && note.content && note.category) {
                  createAILearningNote({
                    contextId: targetContextId,
                    title: note.title,
                    content: note.content,
                    category: note.category,
                    sourceTaskId: taskId,
                    sourceTaskName: task.name
                  })
                }
              }
            }
          }
        } catch (parseError) {
          logger.error('Failed to parse extraction result:', parseError)
        }
      } catch (extractionError) {
        logger.error('Failed to run extraction analysis:', extractionError)
      }
    }

    // Delete working folder
    await rm(workingFolder, { recursive: true, force: true })
  } catch (error) {
    logger.error(`Failed to extract and cleanup for task ${taskId}:`, error)
  }
}

// UUID v4 regex pattern for identifying task folders
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Clean up orphaned working folders (folders without matching tasks)
export async function cleanupOrphanedFolders(): Promise<void> {
  const tildaDir = getTildaDirectory()

  if (!existsSync(tildaDir)) {
    return
  }

  try {
    const entries = await readdir(tildaDir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Only consider folders that look like UUIDs (task IDs)
        if (!UUID_PATTERN.test(entry.name)) {
          continue
        }

        const task = getTaskById(entry.name)
        if (!task) {
          // No matching task - this is an orphaned folder
          const folderPath = path.join(tildaDir, entry.name)
          logger.log(`Cleaning up orphaned folder: ${folderPath}`)
          await rm(folderPath, { recursive: true, force: true })
        }
      }
    }
  } catch (error) {
    logger.error('Failed to cleanup orphaned folders:', error)
  }
}
