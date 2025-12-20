import { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { useTaskStore } from '../stores/taskStore'
import { ChatMessage } from './ChatMessage'
import type { Task } from '../types'

interface TaskChatProps {
  task: Task
  onBack: () => void
}

export function TaskChat({ task, onBack }: TaskChatProps) {
  const {
    messagesByTask,
    attachmentsByTask,
    pendingResponses,
    sendMessage,
    completeTask,
    reopenTask,
    addAttachment,
    removeAttachment,
    updateTask
  } = useTaskStore()

  const messages = messagesByTask[task.id] || []
  const attachments = attachmentsByTask[task.id] || []
  const isPending = pendingResponses.has(task.id)

  const [input, setInput] = useState('')
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(task.name)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isPending) return

    const message = input.trim()
    setInput('')
    await sendMessage(task.id, message)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTaskAction = async () => {
    if (task.status === 'archived') {
      await reopenTask(task.id)
    } else {
      await completeTask(task.id)
    }
    onBack()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return

    for (const file of files) {
      if (!file.type.match(/^text\//) && !file.name.match(/\.(txt|md|markdown)$/i)) {
        console.warn(`Skipping unsupported file: ${file.name}`)
        continue
      }
      await addAttachment(task.id, file)
    }

    e.target.value = ''
  }

  const handleNameSave = async () => {
    if (editedName.trim() && editedName !== task.name) {
      await updateTask(task.id, { name: editedName.trim() })
    }
    setIsEditingName(false)
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave()
    } else if (e.key === 'Escape') {
      setEditedName(task.name)
      setIsEditingName(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border-light">
        {/* Titlebar drag area */}
        <div className="h-12 titlebar-drag" />

        <div className="flex items-center justify-between px-4 pb-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-text-secondary hover:text-text transition-colors titlebar-no-drag"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="text-sm">Back</span>
          </button>

          <button
            onClick={handleTaskAction}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-lg transition-colors titlebar-no-drag
              ${task.status === 'archived'
                ? 'bg-surface-tertiary text-text hover:bg-surface-elevated'
                : 'bg-success/20 text-success hover:bg-success/30'
              }
            `}
          >
            {task.status === 'archived' ? 'Reopen' : 'Complete'}
          </button>
        </div>

        {/* Task Info */}
        <div className="px-4 pb-4">
          {isEditingName ? (
            <input
              type="text"
              value={editedName}
              onChange={e => setEditedName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={handleNameKeyDown}
              className="text-lg font-semibold text-text bg-transparent border-b border-accent-blue focus:outline-none w-full"
              autoFocus
            />
          ) : (
            <h2
              onClick={() => setIsEditingName(true)}
              className="text-lg font-semibold text-text cursor-pointer hover:text-accent-blue transition-colors"
            >
              {task.name}
            </h2>
          )}
          {task.deadline && (
            <p className="text-sm text-text-secondary mt-1">
              Due {format(new Date(task.deadline), 'MMMM d, yyyy')}
            </p>
          )}
          {task.description && (
            <p className="text-sm text-text-secondary mt-2 whitespace-pre-wrap">
              {task.description}
            </p>
          )}
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="px-4 pb-3">
            <div className="flex flex-wrap gap-2">
              {attachments.map(attachment => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-2 px-2 py-1 bg-surface-tertiary rounded text-xs text-text-secondary"
                >
                  <span className="truncate max-w-[150px]">{attachment.filename}</span>
                  <button
                    onClick={() => removeAttachment(attachment.id, task.id)}
                    className="text-text-tertiary hover:text-error transition-colors"
                    aria-label="Remove attachment"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-tertiary">
            <p className="text-center text-sm">
              Start a conversation to work on this task
            </p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isLastAgentMessage =
                message.sender === 'agent' &&
                index === messages.length - 1

              return (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isStreaming={isPending && isLastAgentMessage}
                />
              )
            })}
          </>
        )}

        {isPending && messages[messages.length - 1]?.sender === 'user' && (
          <div className="flex justify-start">
            <div className="bg-surface-tertiary px-4 py-2.5 rounded-2xl rounded-bl-md">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-border-light p-4">
        <div className="flex items-end gap-3">
          {/* Attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-text-tertiary hover:text-text-secondary rounded-lg transition-colors"
            title="Attach file"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.markdown,text/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Message input */}
          <div className="flex-1">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-4 py-2.5 bg-surface-tertiary rounded-xl text-sm text-text placeholder-text-tertiary resize-none focus:outline-none focus:ring-1 focus:ring-accent-blue max-h-32"
              style={{
                minHeight: '42px',
                height: Math.min(input.split('\n').length * 24 + 18, 128) + 'px'
              }}
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || isPending}
            className="p-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
