import { useState, useRef, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { useTaskStore } from '../stores/taskStore'
import { ChatMessage } from './ChatMessage'
import { isFileSupported, FILE_INPUT_ACCEPT } from '../utils/fileUtils'
import { logger } from '../utils/logger'
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
    updateTask,
    retryMessage,
    editAndResendMessage
  } = useTaskStore()

  const messages = messagesByTask[task.id] || []
  const attachments = attachmentsByTask[task.id] || []
  const isPending = pendingResponses.has(task.id)

  const [input, setInput] = useState('')
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(task.name)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }, [input])

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
      if (!isFileSupported(file)) {
        logger.warn(`Skipping unsupported file: ${file.name}`)
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
        <div className="px-4 py-3">
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
        </div>

        {/* Task Info */}
        <div className="px-4 pb-4">
          <div className="flex items-center gap-3">
            {/* Checkbox */}
            {task.status !== 'archived' ? (
              <button
                onClick={handleTaskAction}
                className="w-5 h-5 rounded border-2 border-text-tertiary flex items-center justify-center cursor-pointer transition-all duration-150 flex-shrink-0 hover:border-text-secondary titlebar-no-drag"
                aria-label="Complete task"
              />
            ) : (
              <button
                onClick={handleTaskAction}
                className="w-5 h-5 rounded bg-success border-2 border-success flex items-center justify-center cursor-pointer transition-all duration-150 flex-shrink-0 hover:opacity-80 titlebar-no-drag"
                aria-label="Reopen task"
              >
                <svg
                  className="w-3 h-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            )}

            {/* Task name */}
            {isEditingName ? (
              <input
                type="text"
                value={editedName}
                onChange={e => setEditedName(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={handleNameKeyDown}
                className="text-lg font-semibold text-text bg-transparent border-b border-accent-blue focus:outline-none flex-1"
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
          </div>
          {task.deadline && (
            <p className="text-sm text-text-secondary mt-1">
              Due {format(parseISO(task.deadline), 'MMMM d, yyyy')}
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
                  onRetry={(id) => retryMessage(task.id, id)}
                  onEdit={(id, content) => editAndResendMessage(task.id, id, content)}
                />
              )
            })}
          </>
        )}

        {isPending && messages[messages.length - 1]?.sender === 'user' && (
          <div className="flex justify-start">
            <div className="bg-surface-tertiary px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="w-4 h-4 border-2 border-text-tertiary border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-border-light p-3">
        <div className="bg-[#1a1a1a] rounded-xl p-3">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Reply..."
            rows={1}
            className="w-full bg-transparent text-text text-sm resize-none focus:outline-none focus:ring-0 border-none min-h-[24px] max-h-[120px]"
            disabled={isPending}
          />

          {/* Bottom row */}
          <div className="flex items-center justify-between mt-2">
            {/* Left side - action buttons */}
            <div className="flex items-center gap-1">
              {/* Add file button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1 text-text-tertiary hover:text-text-secondary rounded transition-colors"
                title="Attach file"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={FILE_INPUT_ACCEPT}
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Right side - send button */}
            <button
              onClick={handleSend}
              disabled={!input.trim() || isPending}
              className="p-1.5 rounded-lg bg-surface-button text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-buttonHover transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
