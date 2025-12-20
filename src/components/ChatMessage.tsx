import { format } from 'date-fns'
import type { Message } from '../types'

interface ChatMessageProps {
  message: Message
  isStreaming?: boolean
}

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const isUser = message.sender === 'user'

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
    >
      <div
        className={`
          max-w-[80%] px-4 py-2.5 rounded-2xl
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
