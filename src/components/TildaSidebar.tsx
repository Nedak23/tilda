import { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { useTaskStore } from '../stores/taskStore'
import type { TildaMessage } from '../types'

interface TildaSidebarProps {
  isOpen: boolean
  onClose: () => void
}

function TildaChatMessage({ message, isStreaming = false }: { message: TildaMessage; isStreaming?: boolean }) {
  const isUser = message.sender === 'user'

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
    >
      <div
        className={`
          max-w-[85%] px-3 py-2 rounded-2xl
          ${isUser
            ? 'bg-accent-blue text-white rounded-br-md'
            : 'bg-surface-tertiary text-text rounded-bl-md'
          }
        `}
      >
        <div className="text-sm whitespace-pre-wrap break-words">
          {message.content}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-current ml-0.5 animate-pulse" />
          )}
        </div>
        <div
          className={`
            text-2xs mt-1
            ${isUser ? 'text-white/70' : 'text-text-tertiary'}
          `}
        >
          {format(new Date(message.timestamp), 'h:mm a')}
        </div>
      </div>
    </div>
  )
}

export function TildaSidebar({ isOpen, onClose }: TildaSidebarProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const {
    tildaMessages,
    isTildaPending,
    tildaStreamingContent,
    loadTildaMessages,
    sendTildaMessage,
    clearTildaHistory
  } = useTaskStore()

  // Load messages when sidebar opens
  useEffect(() => {
    if (isOpen) {
      loadTildaMessages()
    }
  }, [isOpen, loadTildaMessages])

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

  return (
    <div
      className={`
        fixed top-0 right-0 h-full w-80 bg-surface border-l border-border-light
        flex flex-col z-40
        transform transition-transform duration-200 ease-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border-light">
        <div className="flex items-center gap-2">
          <span className="text-lg">💬</span>
          <h2 className="font-semibold text-text">Tilda</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearTildaHistory}
            className="p-1.5 rounded text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary transition-colors"
            title="Clear history"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary transition-colors"
            title="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {tildaMessages.length === 0 && !tildaStreamingContent && (
          <div className="h-full flex flex-col items-center justify-center text-text-tertiary text-sm">
            <span className="text-3xl mb-2">👋</span>
            <p>Hi! I'm Tilda.</p>
            <p>I can help you manage your tasks.</p>
            <p className="mt-2 text-text-tertiary/70 text-xs">
              Try "Create a task to buy groceries"
            </p>
          </div>
        )}

        {tildaMessages.map((message) => (
          <TildaChatMessage key={message.id} message={message} />
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

        {/* Typing indicator */}
        {isTildaPending && !tildaStreamingContent && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-surface-tertiary px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
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
      <div className="flex-shrink-0 p-3 border-t border-border-light">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Tilda..."
            className="flex-1 bg-surface-secondary text-text text-sm rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-accent-blue/50 min-h-[40px] max-h-[120px]"
            rows={1}
            disabled={isTildaPending}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isTildaPending}
            className="p-2 rounded-lg bg-accent-blue text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-blue/90 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
