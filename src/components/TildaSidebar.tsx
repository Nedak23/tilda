import { useState, useRef, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { useTaskStore } from '../stores/taskStore'
import { isFileSupported, FILE_INPUT_ACCEPT } from '../utils/fileUtils'
import { logger } from '../utils/logger'
import { MarkdownContent } from './MarkdownContent'
import type { TildaMessage, TildaAttachment } from '../types'

const MAX_CHARS_BEFORE_TRUNCATE = 500

interface TildaSidebarProps {
  isOpen: boolean
}

interface TildaChatMessageProps {
  message: TildaMessage
  attachments?: TildaAttachment[]
  isStreaming?: boolean
  onRetry?: (messageId: string) => void
  onEdit?: (messageId: string, newContent: string) => void
}

function TildaChatMessage({ message, attachments = [], isStreaming = false, onRetry, onEdit }: TildaChatMessageProps) {
  const isUser = message.sender === 'user'
  const [isExpanded, setIsExpanded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const shouldTruncate = isUser && message.content.length > MAX_CHARS_BEFORE_TRUNCATE && !isExpanded
  const displayContent = shouldTruncate
    ? message.content.slice(0, MAX_CHARS_BEFORE_TRUNCATE) + '...'
    : message.content

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [isEditing])

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
  }

  const handleRetry = () => {
    onRetry?.(message.id)
  }

  const handleEditStart = () => {
    setEditContent(message.content)
    setIsEditing(true)
  }

  const handleEditCancel = () => {
    setIsEditing(false)
    setEditContent(message.content)
  }

  const handleEditSubmit = () => {
    if (editContent.trim() && editContent !== message.content) {
      onEdit?.(message.id, editContent.trim())
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEditSubmit()
    } else if (e.key === 'Escape') {
      handleEditCancel()
    }
  }

  if (isUser) {
    // User message - grey box with hover actions
    return (
      <div
        className="flex justify-start animate-fade-in relative group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="max-w-[85%] relative">
          {/* Hover action bar */}
          {isHovered && !isEditing && (
            <div className="absolute -top-7 right-0 flex items-center gap-1 bg-surface-secondary rounded-lg px-2 py-1 shadow-lg z-10">
              <span className="text-2xs text-text-tertiary mr-1">
                {format(new Date(message.timestamp), 'MMM d')}
              </span>
              <button
                onClick={handleEditStart}
                className="p-1 text-text-tertiary hover:text-text-secondary transition-colors"
                title="Edit"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={handleCopy}
                className="p-1 text-text-tertiary hover:text-text-secondary transition-colors"
                title="Copy"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          )}

          {/* Message content */}
          <div className="bg-surface-tertiary px-3 py-2 rounded-2xl rounded-bl-md">
            {isEditing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={(e) => {
                    setEditContent(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = e.target.scrollHeight + 'px'
                  }}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-surface-secondary text-text text-sm rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-accent-blue min-h-[60px]"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleEditCancel}
                    className="text-xs text-text-tertiary hover:text-text-secondary px-2 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditSubmit}
                    className="text-xs bg-accent-blue text-white px-3 py-1 rounded-md hover:bg-blue-600 transition-colors"
                  >
                    Save & Resend
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Attachments display */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {attachments.map(attachment => (
                      <div
                        key={attachment.id}
                        className="flex items-center gap-1 px-2 py-0.5 bg-surface-secondary rounded text-2xs text-text-tertiary"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <span className="truncate max-w-[80px]">{attachment.filename}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-sm text-text break-words">
                  <MarkdownContent content={displayContent} />
                </div>
                {message.content.length > MAX_CHARS_BEFORE_TRUNCATE && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-xs text-accent-blue hover:underline mt-1"
                  >
                    {isExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // LLM message - no background, with action buttons at bottom
  return (
    <div className="flex justify-start animate-fade-in">
      <div className="max-w-[85%]">
        <div className="text-sm text-text break-words">
          <MarkdownContent content={message.content} />
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-current ml-0.5 animate-pulse" />
          )}
        </div>

        {/* Bottom action bar - always visible for completed messages */}
        {!isStreaming && (
          <div className="flex items-center gap-3 mt-2">
            <span className="text-2xs text-text-tertiary">
              {format(new Date(message.timestamp), 'h:mm a')}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-2xs text-text-tertiary hover:text-text-secondary transition-colors"
              title="Copy"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy</span>
            </button>
            <button
              onClick={handleRetry}
              className="flex items-center gap-1 text-2xs text-text-tertiary hover:text-text-secondary transition-colors"
              title="Retry"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Retry</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function TildaSidebar({ isOpen }: TildaSidebarProps) {
  const [input, setInput] = useState('')
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    tildaMessages,
    tildaAttachments,
    pendingTildaAttachments,
    isTildaPending,
    tildaStreamingContent,
    loadTildaMessages,
    loadTildaAttachments,
    loadPendingTildaAttachments,
    sendTildaMessage,
    clearTildaHistory,
    addTildaAttachment,
    addTildaAttachmentFromData,
    removeTildaAttachment,
    retryTildaMessage,
    editAndResendTildaMessage
  } = useTaskStore()

  // Load messages and attachments when sidebar opens
  useEffect(() => {
    if (isOpen) {
      loadTildaMessages()
      loadTildaAttachments()
      loadPendingTildaAttachments()
    }
  }, [isOpen, loadTildaMessages, loadTildaAttachments, loadPendingTildaAttachments])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [tildaMessages, tildaStreamingContent])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }, [input])

  // Create a map of attachments by ID for quick lookup when rendering messages
  const attachmentsById = useMemo(() => {
    const map = new Map<string, TildaAttachment>()
    for (const attachment of tildaAttachments) {
      map.set(attachment.id, attachment)
    }
    return map
  }, [tildaAttachments])

  // Helper to get attachments for a message
  const getMessageAttachments = (message: TildaMessage): TildaAttachment[] => {
    if (!message.attachmentIds || message.attachmentIds.length === 0) return []
    return message.attachmentIds
      .map(id => attachmentsById.get(id))
      .filter((a): a is TildaAttachment => a !== undefined)
  }

  const handleSubmit = async () => {
    if (!input.trim() || isTildaPending) return

    const message = input.trim()
    setInput('')
    await sendTildaMessage(message)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return

    for (const file of files) {
      if (!isFileSupported(file)) {
        logger.warn(`Skipping unsupported file: ${file.name}`)
        continue
      }
      await addTildaAttachment(file)
    }

    e.target.value = ''
  }

  const handleDirectorySelect = async () => {
    const files = await window.api.dialog.selectDirectory()
    if (!files) return

    for (const file of files) {
      await addTildaAttachmentFromData(file)
    }
  }

  return (
    <div className="h-full w-full bg-surface flex flex-col">
      {/* Clear chat bar */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-border-light">
        <button
          onClick={clearTildaHistory}
          className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
          title="Clear chat history"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span>Clear chat</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-visible p-3 pt-8 space-y-3 hide-scrollbar">
        {tildaMessages.length === 0 && !tildaStreamingContent && (
          <div className="h-full flex flex-col items-center justify-center text-text-tertiary text-sm">
            <span className="text-5xl font-bold text-text-secondary mb-2">~</span>
            <p>Hi! I'm Tilda.</p>
            <p>I can help you manage your tasks.</p>
            <p className="mt-2 text-text-tertiary/70 text-xs">
              Try "Create a task to buy groceries"
            </p>
          </div>
        )}

        {tildaMessages.map((message) => (
          <TildaChatMessage
            key={message.id}
            message={message}
            attachments={getMessageAttachments(message)}
            onRetry={retryTildaMessage}
            onEdit={editAndResendTildaMessage}
          />
        ))}

        {/* Streaming response */}
        {isTildaPending && tildaStreamingContent && (
          <TildaChatMessage
            message={{
              id: 'streaming',
              sender: 'agent',
              content: tildaStreamingContent,
              timestamp: new Date().toISOString()
            }}
            isStreaming
          />
        )}

        {/* Loading spinner */}
        {isTildaPending && !tildaStreamingContent && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-surface-tertiary px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="w-4 h-4 border-2 border-text-tertiary border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Pending Attachments (for input area) */}
      {pendingTildaAttachments.length > 0 && (
        <div className="flex-shrink-0 px-3 pb-2 border-t border-border-light pt-2">
          <div className="flex flex-wrap gap-1.5">
            {pendingTildaAttachments.map(attachment => (
              <div
                key={attachment.id}
                className="flex items-center gap-1.5 px-2 py-1 bg-surface-tertiary rounded text-xs text-text-secondary"
              >
                <span className="truncate max-w-[100px]">{attachment.filename}</span>
                <button
                  onClick={() => removeTildaAttachment(attachment.id)}
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

      {/* Input */}
      <div className={`flex-shrink-0 px-3 h-12 flex items-center ${pendingTildaAttachments.length === 0 ? 'border-t border-border-light' : ''}`}>
        <div className="flex items-center gap-2 w-full">
          {/* Attach button */}
          <div className="relative">
            <button
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="p-1.5 text-text-tertiary hover:text-text-secondary rounded-lg transition-colors"
              title="Attach"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            {showAttachMenu && (
              <div className="absolute left-0 bottom-full mb-1 bg-surface-tertiary rounded-lg shadow-elevated p-1 z-20 w-36">
                <button
                  onClick={() => {
                    fileInputRef.current?.click()
                    setShowAttachMenu(false)
                  }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-text hover:bg-surface rounded transition-colors"
                >
                  <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  Files
                </button>
                <button
                  onClick={() => {
                    handleDirectorySelect()
                    setShowAttachMenu(false)
                  }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-text hover:bg-surface rounded transition-colors"
                >
                  <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" />
                  </svg>
                  Folder
                </button>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={FILE_INPUT_ACCEPT}
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Tilda..."
            className="flex-1 bg-[#1a1a1a] text-text text-sm rounded-xl px-3 py-1 resize-none focus:outline-none h-7 max-h-[120px]"
            rows={1}
            disabled={isTildaPending}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isTildaPending}
            className="p-1.5 rounded-lg bg-surface-button text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-buttonHover transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
