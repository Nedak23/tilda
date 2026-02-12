import {
  sendMessage as sendToClaudeCode,
  killProcess,
  getProcessStatus as getClaudeCodeStatus
} from './claude-code'
import { getTaskById, createMessage, setUnreadAgentMessage, getMessagesByChat, getChatById } from './database'
import { logger } from './logger'

const activeRequests = new Map<string, boolean>()

export async function sendMessage(
  taskId: string,
  chatId: string,
  userMessage: string,
  onChunk: (chunk: string) => void,
  attachmentIds?: string[]
): Promise<string> {
  logger.log('LLM sendMessage called for task:', taskId, 'chat:', chatId)

  const task = getTaskById(taskId)
  if (!task) throw new Error(`Task ${taskId} not found`)

  // Mark as active
  activeRequests.set(chatId, true)

  // Save user message to database (with attachment IDs if present)
  createMessage(taskId, userMessage, 'user', attachmentIds, chatId)

  try {
    logger.log('Calling sendToClaudeCode...')
    // Send to Claude Code and stream response
    const response = await sendToClaudeCode(chatId, taskId, userMessage, onChunk)
    logger.log('Got response from Claude Code:', response?.substring(0, 100))

    // Save agent response to database
    createMessage(taskId, response, 'agent', undefined, chatId)

    return response
  } catch (error) {
    // Check if this was a cancellation
    if (!activeRequests.get(chatId)) {
      throw new Error('Request cancelled')
    }
    throw error
  } finally {
    activeRequests.delete(chatId)
  }
}

export function cancelRequest(chatId: string): void {
  activeRequests.set(chatId, false)
  killProcess(chatId)
}

/**
 * Regenerate a response for a chat without creating a new user message.
 * Used for retry functionality where the user message already exists.
 */
export async function regenerateResponse(
  taskId: string,
  chatId: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const task = getTaskById(taskId)
  if (!task) throw new Error(`Task ${taskId} not found`)

  // Get conversation history for this chat
  const conversationHistory = getMessagesByChat(chatId)
  if (conversationHistory.length === 0) {
    throw new Error('No messages to regenerate from')
  }

  const lastMessage = conversationHistory[conversationHistory.length - 1]
  if (lastMessage.sender !== 'user') {
    throw new Error('Last message is not from user')
  }

  // Mark as active
  activeRequests.set(chatId, true)

  try {
    // Send the last user message again to Claude Code
    const response = await sendToClaudeCode(chatId, taskId, lastMessage.content, onChunk)

    // Save agent response to database
    createMessage(taskId, response, 'agent', undefined, chatId)

    return response
  } catch (error) {
    if (!activeRequests.get(chatId)) {
      throw new Error('Request cancelled')
    }
    throw error
  } finally {
    activeRequests.delete(chatId)
  }
}

export function markTaskUnread(taskId: string): void {
  setUnreadAgentMessage(taskId)
}

export function getProcessStatus(chatId: string): 'idle' | 'processing' | 'not_running' {
  return getClaudeCodeStatus(chatId)
}
