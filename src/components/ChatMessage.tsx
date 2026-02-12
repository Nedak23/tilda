import { useState, useRef, useEffect } from 'react'
import type { Message, Attachment } from '../types'
import { MarkdownContent } from './MarkdownContent'

const MAX_CHARS_BEFORE_TRUNCATE = 500

interface TooltipButtonProps {
  onClick: () => void
  tooltip: string
  children: React.ReactNode
}

function TooltipButton({ onClick, tooltip, children }: TooltipButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="p-1 text-text-tertiary hover:text-text-secondary transition-colors"
      >
        {children}
      </button>
      {showTooltip && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-0.5 bg-surface-tertiary text-text text-xs rounded whitespace-nowrap z-50 shadow-lg">
          {tooltip}
        </div>
      )}
    </div>
  )
}

interface CopyButtonProps {
  onCopy: () => void
  children: React.ReactNode
}

function CopyButton({ onCopy, children }: CopyButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleClick = () => {
    onCopy()
    setCopied(true)
    setShowTooltip(true)
    setTimeout(() => {
      setCopied(false)
      setShowTooltip(false)
    }, 1500)
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        onMouseEnter={() => !copied && setShowTooltip(true)}
        onMouseLeave={() => !copied && setShowTooltip(false)}
        className="p-1 text-text-tertiary hover:text-text-secondary transition-colors"
      >
        {children}
      </button>
      {showTooltip && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-0.5 bg-surface-tertiary text-text text-xs rounded whitespace-nowrap z-50 shadow-lg">
          {copied ? 'Copied!' : 'Copy'}
        </div>
      )}
    </div>
  )
}

interface ChatMessageProps {
  message: Message
  attachments?: Attachment[]
  isStreaming?: boolean
  onRetry?: (messageId: string) => void
  onEdit?: (messageId: string, newContent: string) => void
  onCopy?: (content: string) => void
}

export function ChatMessage({
  message,
  attachments = [],
  isStreaming = false,
  onRetry,
  onEdit,
  onCopy
}: ChatMessageProps) {
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
    onCopy?.(message.content)
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
    // User message - grey box aligned right with hover action buttons
    return (
      <div
        className="flex justify-end animate-fade-in relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="max-w-[80%] relative">
          {/* Hover action bar */}
          {isHovered && !isEditing && (
            <div className="absolute -top-7 right-0 flex items-center gap-1 bg-surface-secondary rounded-lg px-2 py-1 shadow-lg z-10">
              <CopyButton onCopy={handleCopy}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </CopyButton>
              <TooltipButton onClick={handleEditStart} tooltip="Edit">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </TooltipButton>
            </div>
          )}

          {/* Message content */}
          <div className="bg-surface-tertiary px-4 py-2.5 rounded-2xl rounded-br-md">
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

  // LLM message - no background, with hover action buttons
  return (
    <div
      className="flex justify-start animate-fade-in relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="max-w-[80%] relative">
        <div className="text-sm text-text break-words">
          <MarkdownContent content={message.content} />
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-current ml-0.5 animate-pulse" />
          )}
        </div>

        {/* Hover action bar */}
        {isHovered && !isStreaming && (
          <div className="absolute -bottom-7 left-0 flex items-center gap-1 bg-surface-secondary rounded-lg px-2 py-1 shadow-lg z-10">
            <CopyButton onCopy={handleCopy}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </CopyButton>
            <TooltipButton onClick={handleRetry} tooltip="Retry">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </TooltipButton>
          </div>
        )}
      </div>
    </div>
  )
}
