import {
  sendMessage as sendToClaudeCode,
  killProcess,
  getProcessStatus as getClaudeCodeStatus
} from './claude-code'
import { getTaskById, createMessage, setUnreadAgentMessage, getMessagesByTask } from './database'
import { logger } from './logger'

const activeRequests = new Map<string, boolean>()

export async function sendMessage(
  taskId: string,
  userMessage: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  logger.log('LLM sendMessage called for task:', taskId)

  const task = getTaskById(taskId)
  if (!task) throw new Error(`Task ${taskId} not found`)

  // Mark as active
  activeRequests.set(taskId, true)

  // Save user message to database
  createMessage(taskId, userMessage, 'user')

  try {
    logger.log('Calling sendToClaudeCode...')
    // Send to Claude Code and stream response
    const response = await sendToClaudeCode(taskId, userMessage, onChunk)
    logger.log('Got response from Claude Code:', response?.substring(0, 100))

    // Save agent response to database
    createMessage(taskId, response, 'agent')

    return response
  } catch (error) {
    // Check if this was a cancellation
    if (!activeRequests.get(taskId)) {
      throw new Error('Request cancelled')
    }
    throw error
  } finally {
    activeRequests.delete(taskId)
  }
}

export function cancelRequest(taskId: string): void {
  activeRequests.set(taskId, false)
  killProcess(taskId)
}

/**
 * Regenerate a response for a task without creating a new user message.
 * Used for retry functionality where the user message already exists.
 */
export async function regenerateResponse(
  taskId: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const task = getTaskById(taskId)
  if (!task) throw new Error(`Task ${taskId} not found`)

  // Get conversation history - the user message should already be the last one
  const conversationHistory = getMessagesByTask(taskId)
  if (conversationHistory.length === 0) {
    throw new Error('No messages to regenerate from')
  }

  const lastMessage = conversationHistory[conversationHistory.length - 1]
  if (lastMessage.sender !== 'user') {
    throw new Error('Last message is not from user')
  }

  // Mark as active
  activeRequests.set(taskId, true)

  try {
    // Send the last user message again to Claude Code
    const response = await sendToClaudeCode(taskId, lastMessage.content, onChunk)

    // Save agent response to database
    createMessage(taskId, response, 'agent')

    return response
  } catch (error) {
    if (!activeRequests.get(taskId)) {
      throw new Error('Request cancelled')
    }
    throw error
  } finally {
    activeRequests.delete(taskId)
  }
}

export function markTaskUnread(taskId: string): void {
  setUnreadAgentMessage(taskId)
}

export function getProcessStatus(taskId: string): 'idle' | 'processing' | 'not_running' {
  return getClaudeCodeStatus(taskId)
}
