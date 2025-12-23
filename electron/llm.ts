import Anthropic from '@anthropic-ai/sdk'
import { getTaskById, getMessagesByTask, getAttachmentsByTask, createMessage, setUnreadAgentMessage, getContextsByTask, getDocumentsByContext, getAILearningNotesByContext, getContextById, GENERAL_CONTEXT_ID } from './database'
import { getApiKey, getModel } from './settings'
import type { Message, Attachment, Context, ContextDocument, AILearningNote } from '../src/types'

let anthropic: Anthropic | null = null
let currentApiKey: string | null = null

function getClient(): Anthropic {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('Please configure your API key in Settings')
  }

  // Recreate client if API key changed
  if (anthropic && currentApiKey === apiKey) {
    return anthropic
  }

  currentApiKey = apiKey
  anthropic = new Anthropic({ apiKey })
  return anthropic
}

const activeRequests = new Map<string, AbortController>()

interface ContextInfo {
  context: Context
  documents: ContextDocument[]
  learningNotes: AILearningNote[]
}

function formatCategory(category: string): string {
  const categoryLabels: Record<string, string> = {
    'preference': 'PREFERENCE',
    'domain_knowledge': 'DOMAIN KNOWLEDGE',
    'workflow': 'WORKFLOW',
    'technical_decision': 'TECHNICAL DECISION'
  }
  return categoryLabels[category] || category.toUpperCase()
}

function buildSystemPrompt(taskName: string, description?: string, contextInfos?: ContextInfo[]): string {
  let prompt = `You are a helpful AI assistant helping the user complete this task: "${taskName}".`
  if (description) {
    prompt += `\n\nTask description:\n${description}`
  }

  // Add context info if available
  if (contextInfos && contextInfos.length > 0) {
    prompt += '\n\n--- Task Contexts ---'
    for (const { context, documents, learningNotes } of contextInfos) {
      prompt += `\n\nContext: ${context.name}`
      if (context.description) {
        prompt += `\nDescription: ${context.description}`
      }
      if (documents.length > 0) {
        prompt += '\n\nContext Documents:'
        for (const doc of documents) {
          prompt += `\n\n--- ${doc.filename} ---\n${doc.content}`
        }
      }
      // Add AI learning notes
      if (learningNotes.length > 0) {
        prompt += '\n\nLearned Information (from previous tasks):'
        for (const note of learningNotes) {
          prompt += `\n\n[${formatCategory(note.category)}] ${note.title}:\n${note.content}`
        }
      }
    }
    prompt += '\n\n--- End of Context Info ---'
  }

  prompt += '\n\nBe concise, helpful, and focused on helping the user accomplish this specific task. If they ask for help with something unrelated to the task, you can still assist but gently remind them of the task context.'
  return prompt
}

function buildMessages(
  conversationHistory: Message[],
  attachments: Attachment[],
  userMessage: string
): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = []

  // Add conversation history
  for (const msg of conversationHistory) {
    messages.push({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.content
    })
  }

  // Build current user message with attachments
  let currentMessage = userMessage

  // Include attachment contents in the message
  if (attachments.length > 0) {
    const attachmentContext = attachments
      .map(a => `--- File: ${a.filename} ---\n${a.content}`)
      .join('\n\n')

    // Only include if this is the first message or user explicitly references files
    if (conversationHistory.length === 0) {
      currentMessage = `Context files attached to this task:\n\n${attachmentContext}\n\n---\n\n${userMessage}`
    }
  }

  messages.push({
    role: 'user',
    content: currentMessage
  })

  return messages
}

export async function sendMessage(
  taskId: string,
  userMessage: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const task = getTaskById(taskId)
  if (!task) throw new Error(`Task ${taskId} not found`)

  // Save user message
  createMessage(taskId, userMessage, 'user')

  // Get conversation history and attachments
  const conversationHistory = getMessagesByTask(taskId)
  // Remove the message we just added from history (it's the current message)
  conversationHistory.pop()

  const attachments = getAttachmentsByTask(taskId)

  // Get context info (contexts, their documents, and learning notes)
  const taskContexts = getContextsByTask(taskId)

  // Always include General context for its learning notes
  const generalContext = getContextById(GENERAL_CONTEXT_ID)
  const allContexts = [...taskContexts]
  if (generalContext && !taskContexts.some(c => c.id === GENERAL_CONTEXT_ID)) {
    allContexts.push(generalContext)
  }

  const contextInfos: ContextInfo[] = allContexts.map(context => ({
    context,
    documents: getDocumentsByContext(context.id),
    learningNotes: getAILearningNotesByContext(context.id)
  }))

  const client = getClient()
  const abortController = new AbortController()
  activeRequests.set(taskId, abortController)

  try {
    const systemPrompt = buildSystemPrompt(task.name, task.description, contextInfos)
    const messages = buildMessages(conversationHistory, attachments, userMessage)

    let fullResponse = ''

    const model = getModel()
    const stream = await client.messages.stream({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages
    }, {
      signal: abortController.signal
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const text = event.delta.text
        fullResponse += text
        onChunk(text)
      }
    }

    // Save agent response
    createMessage(taskId, fullResponse, 'agent')

    return fullResponse
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error('Request cancelled')
    }
    throw error
  } finally {
    activeRequests.delete(taskId)
  }
}

export function cancelRequest(taskId: string): void {
  const controller = activeRequests.get(taskId)
  if (controller) {
    controller.abort()
    activeRequests.delete(taskId)
  }
}

export function markTaskUnread(taskId: string): void {
  setUnreadAgentMessage(taskId)
}
