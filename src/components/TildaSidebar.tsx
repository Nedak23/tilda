import { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { useTaskStore } from '../stores/taskStore'
import { isFileSupported, FILE_INPUT_ACCEPT } from '../utils/fileUtils'
import type { TildaMessage } from '../types'

interface TildaSidebarProps {
  isOpen: boolean
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
        {!isUser && (
          <div className="text-2xs mt-1 text-text-tertiary">
            {format(new Date(message.timestamp), 'h:mm a')}
          </div>
        )}
      </div>
    </div>
  )
}

export function TildaSidebar({ isOpen }: TildaSidebarProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    tildaMessages,
    tildaAttachments,
    isTildaPending,
    tildaStreamingContent,
    loadTildaMessages,
    loadTildaAttachments,
    sendTildaMessage,
    clearTildaHistory,
    addTildaAttachment,
    removeTildaAttachment
  } = useTaskStore()

  // Load messages and attachments when sidebar opens
  useEffect(() => {
    if (isOpen) {
      loadTildaMessages()
      loadTildaAttachments()
    }
  }, [isOpen, loadTildaMessages, loadTildaAttachments])

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return

    for (const file of files) {
      if (!isFileSupported(file)) {
        console.warn(`Skipping unsupported file: ${file.name}`)
        continue
      }
      await addTildaAttachment(file)
    }

    e.target.value = ''
  }

  return (
    <div className="h-full w-full bg-surface border-r border-border-light flex flex-col">
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
      <div className="flex-1 overflow-y-auto p-3 space-y-3 hide-scrollbar">
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

      {/* Attachments */}
      {tildaAttachments.length > 0 && (
        <div className="flex-shrink-0 px-3 pb-2 border-t border-border-light pt-2">
          <div className="flex flex-wrap gap-1.5">
            {tildaAttachments.map(attachment => (
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
      <div className={`flex-shrink-0 p-3 ${tildaAttachments.length === 0 ? 'border-t border-border-light' : ''}`}>
        <div className="flex items-end gap-2">
          {/* Attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-text-tertiary hover:text-text-secondary rounded-lg transition-colors"
            title="Attach file"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
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
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Tilda..."
            className="flex-1 bg-[#1a1a1a] text-text text-sm rounded-2xl px-4 py-2.5 resize-none focus:outline-none min-h-[40px] max-h-[120px]"
            rows={1}
            disabled={isTildaPending}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isTildaPending}
            className="p-2 rounded-lg bg-surface-button text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-buttonHover transition-colors"
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
