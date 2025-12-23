import Anthropic from '@anthropic-ai/sdk'
import {
  getTildaMessages,
  createTildaMessage,
  createTask,
  updateTask,
  completeTask,
  reopenTask,
  deleteTask,
  searchTasks,
  getAllContexts,
  createContext,
  setTaskContexts,
  getContextsByTask,
  type SearchTasksCriteria
} from './database'
import { getApiKey, getModel } from './settings'
import type { TildaMessage, CreateTaskInput, UpdateTaskInput } from '../src/types'

let anthropic: Anthropic | null = null
let currentApiKey: string | null = null
let abortController: AbortController | null = null

function getClient(): Anthropic {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('Please configure your API key in Settings')
  }

  if (anthropic && currentApiKey === apiKey) {
    return anthropic
  }

  currentApiKey = apiKey
  anthropic = new Anthropic({ apiKey })
  return anthropic
}

function getTodayDateString(): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today.toISOString().split('T')[0]
}

const TILDA_SYSTEM_PROMPT = `You are Tilda, a helpful AI assistant integrated into a task management app. Your role is to help users manage their tasks efficiently.

You have access to tools for task management:
- create_task: Create new tasks with name, date, deadline, description, recurrence, and contexts
- update_task: Modify existing tasks (including context assignments)
- complete_task: Mark tasks as complete
- reopen_task: Reopen completed tasks
- delete_task: Remove tasks
- search_tasks: Find tasks by status, date range, text search, or context
- create_context: Create a new organizational context
- list_contexts: Show all available contexts

When users ask about their tasks or want to manage them, use the appropriate tools. Be proactive in suggesting task organization and time management strategies.

Current date: ${getTodayDateString()}

Guidelines:
- Be concise and helpful
- When creating tasks, if the user doesn't specify a date, use today's date
- When the user says "tomorrow", calculate that relative to the current date
- Confirm actions after tool execution
- Provide task summaries when users ask about their tasks
- Suggest using contexts to organize related tasks (e.g., work, personal, projects)
- Suggest next steps when appropriate
- If a task operation fails, explain what went wrong`

const TILDA_TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_task',
    description: 'Create a new task. If no dateToWorkOn is specified, defaults to today.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'The name/title of the task'
        },
        dateToWorkOn: {
          type: 'string',
          description: 'Date to work on the task in YYYY-MM-DD format. Defaults to today if not specified.'
        },
        deadline: {
          type: 'string',
          description: 'Optional deadline date in YYYY-MM-DD format'
        },
        description: {
          type: 'string',
          description: 'Optional detailed description of the task'
        },
        recurrence: {
          type: 'object',
          description: 'Optional recurrence rule for repeating tasks',
          properties: {
            frequency: {
              type: 'string',
              enum: ['daily', 'weekly', 'monthly', 'yearly'],
              description: 'How often the task repeats'
            },
            interval: {
              type: 'number',
              description: 'The interval between recurrences (e.g., 2 for every 2 days/weeks/etc)'
            }
          },
          required: ['frequency', 'interval']
        },
        contextIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional array of context IDs to assign this task to. Use list_contexts to get available context IDs.'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'update_task',
    description: 'Update an existing task. You must first search for the task to get its ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        taskId: {
          type: 'string',
          description: 'The ID of the task to update'
        },
        name: {
          type: 'string',
          description: 'New name for the task'
        },
        dateToWorkOn: {
          type: 'string',
          description: 'New date to work on the task in YYYY-MM-DD format'
        },
        deadline: {
          type: 'string',
          description: 'New deadline date in YYYY-MM-DD format'
        },
        description: {
          type: 'string',
          description: 'New description for the task'
        },
        contextIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'New array of context IDs for this task (replaces existing contexts). Use list_contexts to get available context IDs.'
        }
      },
      required: ['taskId']
    }
  },
  {
    name: 'complete_task',
    description: 'Mark a task as complete/done. You must first search for the task to get its ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        taskId: {
          type: 'string',
          description: 'The ID of the task to complete'
        }
      },
      required: ['taskId']
    }
  },
  {
    name: 'reopen_task',
    description: 'Reopen a completed/archived task. You must first search for the task to get its ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        taskId: {
          type: 'string',
          description: 'The ID of the task to reopen'
        }
      },
      required: ['taskId']
    }
  },
  {
    name: 'delete_task',
    description: 'Permanently delete a task. You must first search for the task to get its ID. Use with caution.',
    input_schema: {
      type: 'object' as const,
      properties: {
        taskId: {
          type: 'string',
          description: 'The ID of the task to delete'
        }
      },
      required: ['taskId']
    }
  },
  {
    name: 'search_tasks',
    description: 'Search and list tasks. Use this to find tasks before updating, completing, or deleting them.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['today', 'upcoming', 'archived', 'all'],
          description: 'Filter by task status. "today" shows tasks due today, "upcoming" shows future tasks, "archived" shows completed tasks, "all" shows everything.'
        },
        searchQuery: {
          type: 'string',
          description: 'Text to search for in task names and descriptions'
        },
        dateFrom: {
          type: 'string',
          description: 'Filter tasks with dateToWorkOn >= this date (YYYY-MM-DD)'
        },
        dateTo: {
          type: 'string',
          description: 'Filter tasks with dateToWorkOn <= this date (YYYY-MM-DD)'
        },
        contextId: {
          type: 'string',
          description: 'Filter tasks assigned to a specific context. Use list_contexts to get available context IDs.'
        }
      }
    }
  },
  {
    name: 'create_context',
    description: 'Create a new organizational context for grouping tasks.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'The name of the context (e.g., "Work", "Personal", "Project X")'
        },
        description: {
          type: 'string',
          description: 'Optional description of what this context is for'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'list_contexts',
    description: 'List all available contexts. Use this to find context IDs before creating or updating tasks with context assignments.',
    input_schema: {
      type: 'object' as const,
      properties: {}
    }
  }
]

interface ToolInput {
  name?: string
  dateToWorkOn?: string
  deadline?: string
  description?: string
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
    interval: number
  }
  taskId?: string
  status?: 'today' | 'upcoming' | 'archived' | 'all'
  searchQuery?: string
  dateFrom?: string
  dateTo?: string
  contextIds?: string[]
  contextId?: string
}

function executeToolCall(toolName: string, toolInput: ToolInput): string {
  try {
    switch (toolName) {
      case 'create_task': {
        const input: CreateTaskInput = {
          name: toolInput.name!,
          dateToWorkOn: toolInput.dateToWorkOn || getTodayDateString(),
          deadline: toolInput.deadline,
          description: toolInput.description,
          recurrenceRule: toolInput.recurrence
        }
        const task = createTask(input)
        // Assign contexts if provided
        if (toolInput.contextIds && toolInput.contextIds.length > 0) {
          setTaskContexts(task.id, toolInput.contextIds)
        }
        const taskContexts = getContextsByTask(task.id)
        return JSON.stringify({
          success: true,
          message: `Created task "${task.name}" for ${task.dateToWorkOn}${taskContexts.length > 0 ? ` in contexts: ${taskContexts.map(c => c.name).join(', ')}` : ''}`,
          task: {
            id: task.id,
            name: task.name,
            dateToWorkOn: task.dateToWorkOn,
            status: task.status,
            contexts: taskContexts.map(c => ({ id: c.id, name: c.name }))
          }
        })
      }

      case 'update_task': {
        const input: UpdateTaskInput = {}
        if (toolInput.name) input.name = toolInput.name
        if (toolInput.dateToWorkOn) input.dateToWorkOn = toolInput.dateToWorkOn
        if (toolInput.deadline) input.deadline = toolInput.deadline
        if (toolInput.description) input.description = toolInput.description

        const task = updateTask(toolInput.taskId!, input)
        // Update contexts if provided
        if (toolInput.contextIds) {
          setTaskContexts(task.id, toolInput.contextIds)
        }
        const taskContexts = getContextsByTask(task.id)
        return JSON.stringify({
          success: true,
          message: `Updated task "${task.name}"${toolInput.contextIds ? ` (contexts: ${taskContexts.length > 0 ? taskContexts.map(c => c.name).join(', ') : 'none'})` : ''}`,
          task: {
            id: task.id,
            name: task.name,
            dateToWorkOn: task.dateToWorkOn,
            status: task.status,
            contexts: taskContexts.map(c => ({ id: c.id, name: c.name }))
          }
        })
      }

      case 'complete_task': {
        const task = completeTask(toolInput.taskId!)
        return JSON.stringify({
          success: true,
          message: `Completed task "${task.name}"`,
          task: {
            id: task.id,
            name: task.name,
            completionDate: task.completionDate
          }
        })
      }

      case 'reopen_task': {
        const task = reopenTask(toolInput.taskId!)
        return JSON.stringify({
          success: true,
          message: `Reopened task "${task.name}"`,
          task: {
            id: task.id,
            name: task.name,
            dateToWorkOn: task.dateToWorkOn,
            status: task.status
          }
        })
      }

      case 'delete_task': {
        deleteTask(toolInput.taskId!)
        return JSON.stringify({
          success: true,
          message: 'Task deleted successfully'
        })
      }

      case 'search_tasks': {
        const criteria: SearchTasksCriteria = {}
        if (toolInput.status) criteria.status = toolInput.status
        if (toolInput.searchQuery) criteria.searchQuery = toolInput.searchQuery
        if (toolInput.dateFrom) criteria.dateFrom = toolInput.dateFrom
        if (toolInput.dateTo) criteria.dateTo = toolInput.dateTo
        if (toolInput.contextId) criteria.contextId = toolInput.contextId

        const tasks = searchTasks(criteria)
        return JSON.stringify({
          success: true,
          count: tasks.length,
          tasks: tasks.map(t => {
            const taskContexts = getContextsByTask(t.id)
            return {
              id: t.id,
              name: t.name,
              dateToWorkOn: t.dateToWorkOn,
              deadline: t.deadline,
              status: t.status,
              description: t.description,
              contexts: taskContexts.map(c => ({ id: c.id, name: c.name }))
            }
          })
        })
      }

      case 'create_context': {
        const context = createContext({
          name: toolInput.name!,
          description: toolInput.description
        })
        return JSON.stringify({
          success: true,
          message: `Created context "${context.name}"`,
          context: {
            id: context.id,
            name: context.name,
            description: context.description
          }
        })
      }

      case 'list_contexts': {
        const contexts = getAllContexts()
        return JSON.stringify({
          success: true,
          count: contexts.length,
          contexts: contexts.map(c => ({
            id: c.id,
            name: c.name,
            description: c.description
          }))
        })
      }

      default:
        return JSON.stringify({
          success: false,
          error: `Unknown tool: ${toolName}`
        })
    }
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: (error as Error).message
    })
  }
}

function buildMessages(history: TildaMessage[], userMessage: string): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = []

  for (const msg of history) {
    messages.push({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.content
    })
  }

  messages.push({
    role: 'user',
    content: userMessage
  })

  return messages
}

export async function sendTildaMessage(
  userMessage: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  // Save user message
  createTildaMessage(userMessage, 'user')

  // Get conversation history (excluding the message we just added)
  const history = getTildaMessages()
  history.pop()

  const client = getClient()
  abortController = new AbortController()

  try {
    let messages = buildMessages(history, userMessage)
    const model = getModel()

    // Tool-calling loop
    while (true) {
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        system: TILDA_SYSTEM_PROMPT,
        messages,
        tools: TILDA_TOOLS
      }, {
        signal: abortController.signal
      })

      // Check if we need to handle tool calls
      if (response.stop_reason === 'tool_use') {
        // Find all tool use blocks
        const toolUseBlocks = response.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
        )

        // Also capture any text that came before tool use
        const textBlocks = response.content.filter(
          (block): block is Anthropic.TextBlock => block.type === 'text'
        )

        // Stream any text content
        for (const textBlock of textBlocks) {
          onChunk(textBlock.text)
        }

        // Add assistant message with tool use to conversation
        messages.push({
          role: 'assistant',
          content: response.content
        })

        // Execute tools and add results
        const toolResults: Anthropic.ToolResultBlockParam[] = []
        for (const toolUse of toolUseBlocks) {
          const result = executeToolCall(toolUse.name, toolUse.input as ToolInput)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: result
          })
        }

        messages.push({
          role: 'user',
          content: toolResults
        })

        // Continue the loop to get the next response
        continue
      }

      // No more tool calls - extract and return final text response
      let fullResponse = ''
      for (const block of response.content) {
        if (block.type === 'text') {
          fullResponse += block.text
          onChunk(block.text)
        }
      }

      // Save agent response
      createTildaMessage(fullResponse, 'agent')

      return fullResponse
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error('Request cancelled')
    }
    throw error
  } finally {
    abortController = null
  }
}

export function cancelTildaRequest(): void {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
}
