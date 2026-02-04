import Anthropic from '@anthropic-ai/sdk'
import { logger } from './logger'
import {
  getDocumentsByContext,
  getAILearningNotesByContext,
  createAILearningNote,
  getAllContexts,
  getContextById,
  GENERAL_CONTEXT_ID,
  getTaskById,
  getMessagesByTask,
  completeTask
} from './database'
import { getApiKey, getModel } from './settings'
import type { Task, Message, Context, AILearningNote, AILearningNoteCategory } from '../src/types'

export interface LearningCheckResult {
  noteSaved: boolean
  note?: AILearningNote
}

const LEARNING_CHECK_PROMPT = `You are analyzing a completed task to determine if there is any useful information worth saving for future reference.

Review the task details and conversation history. Look for:
1. **User Preferences**: Stated preferences about how they like things done, formats they prefer, tools they use, communication style
2. **Domain Knowledge**: Project-specific information, technical details, business rules, key contacts or resources, terminology
3. **Workflow Patterns**: Recurring processes, preferred approaches, sequences of steps, how tasks are typically handled
4. **Technical Decisions**: Architecture choices, technology selections, implementation approaches with rationale

IMPORTANT GUIDELINES:
- Only save information that would be genuinely useful for future tasks in this context
- Be concise - notes should be actionable reference material, not verbose documentation
- Avoid saving generic or obvious information that wouldn't help with future tasks
- If the conversation was purely transactional with no learnable insights, respond with no note
- Choose the most relevant context for the note based on the content

Respond with ONLY a valid JSON object (no markdown code blocks, no extra text):

If you identify useful information:
{
  "shouldSave": true,
  "note": {
    "title": "Brief descriptive title (1-10 words)",
    "content": "Detailed but concise content of what was learned. Should be specific and actionable.",
    "category": "preference|domain_knowledge|workflow|technical_decision",
    "contextId": "the-context-id-to-save-to"
  }
}

If there's nothing worth saving:
{
  "shouldSave": false
}`

interface LearningCheckResponse {
  shouldSave: boolean
  note?: {
    title: string
    content: string
    category: AILearningNoteCategory
    contextId: string
  }
}

export async function performLearningCheck(
  task: Task,
  conversationHistory: Message[],
  taskContext: Context | null
): Promise<LearningCheckResult> {
  const apiKey = getApiKey()
  if (!apiKey) {
    logger.log('Learning check skipped: No API key configured')
    return { noteSaved: false }
  }

  // Always include General context as an option
  const allContexts = getAllContexts()
  const generalContext = allContexts.find(c => c.id === GENERAL_CONTEXT_ID)

  // Build available contexts: task's context + General
  const availableContexts: Context[] = []
  if (taskContext) {
    availableContexts.push(taskContext)
  }
  if (generalContext && (!taskContext || taskContext.id !== GENERAL_CONTEXT_ID)) {
    availableContexts.push(generalContext)
  }

  // If no contexts at all (shouldn't happen with General), skip
  if (availableContexts.length === 0) {
    logger.log('Learning check skipped: No contexts available')
    return { noteSaved: false }
  }

  // Build context info for AI to choose from
  const contextInfo = availableContexts.map(ctx => {
    const docs = getDocumentsByContext(ctx.id)
    const existingNotes = getAILearningNotesByContext(ctx.id)
    return {
      id: ctx.id,
      name: ctx.name,
      description: ctx.description || 'No description',
      documentCount: docs.length,
      existingNoteTitles: existingNotes.map(n => n.title)
    }
  })

  const prompt = `
TASK DETAILS:
- Name: ${task.name}
- Description: ${task.description || 'No description'}
- Deadline: ${task.deadline || 'None'}

AVAILABLE CONTEXTS TO SAVE TO:
${JSON.stringify(contextInfo, null, 2)}

CONVERSATION HISTORY:
${conversationHistory.map(m => `[${m.sender.toUpperCase()}]: ${m.content}`).join('\n\n')}

Based on the above, analyze what (if anything) should be saved as a learning note.
If saving, choose the most relevant context from the available options.
Consider the existing note titles to avoid saving duplicate information.
`

  try {
    const client = new Anthropic({ apiKey })
    const model = getModel()

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: LEARNING_CHECK_PROMPT,
      messages: [{ role: 'user', content: prompt }]
    })

    const responseText = response.content[0].type === 'text' ? response.content[0].text : ''

    // Parse the JSON response
    let parsed: LearningCheckResponse
    try {
      // Clean up response - remove markdown code blocks if present (handles json, JSON, etc.)
      let cleanedResponse = responseText.trim()
      if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\w*\n?/, '').replace(/\n?```$/, '')
      }
      parsed = JSON.parse(cleanedResponse)
    } catch (parseError) {
      logger.error('Failed to parse learning check response:', responseText, parseError)
      return { noteSaved: false }
    }

    if (parsed.shouldSave && parsed.note) {
      // Validate the contextId is one of the available contexts
      const validContextId = availableContexts.some(c => c.id === parsed.note!.contextId)
        ? parsed.note.contextId
        : GENERAL_CONTEXT_ID // Fallback to General

      const note = createAILearningNote({
        contextId: validContextId,
        title: parsed.note.title,
        content: parsed.note.content,
        category: parsed.note.category,
        sourceTaskId: task.id,
        sourceTaskName: task.name
      })

      logger.log(`Learning note saved: "${note.title}" to context ${validContextId}`)
      return { noteSaved: true, note }
    }

    logger.log('Learning check completed: Nothing to save')
    return { noteSaved: false }
  } catch (error) {
    logger.error('Learning check failed:', error)
    return { noteSaved: false }
  }
}

export interface CompleteTaskWithLearningResult {
  task: Task
  learningCheckPromise: Promise<LearningCheckResult>
}

/**
 * Completes a task and triggers learning check asynchronously.
 * Use this from both main.ts and tilda.ts to avoid code duplication.
 */
export function completeTaskWithLearning(taskId: string): CompleteTaskWithLearningResult {
  // Get task info and conversation history before completion
  const task = getTaskById(taskId)
  if (!task) throw new Error(`Task ${taskId} not found`)

  const conversationHistory = getMessagesByTask(taskId)
  const taskContext = task.contextId ? getContextById(task.contextId) : null

  // Complete the task
  const completedTask = completeTask(taskId)

  // Create learning check promise (runs asynchronously)
  let learningCheckPromise: Promise<LearningCheckResult>
  if (conversationHistory.length > 0) {
    learningCheckPromise = performLearningCheck(task, conversationHistory, taskContext || null)
  } else {
    learningCheckPromise = Promise.resolve({ noteSaved: false })
  }

  return {
    task: completedTask,
    learningCheckPromise
  }
}
