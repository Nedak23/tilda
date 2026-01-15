import { useState, useEffect, useRef } from 'react'
import { logger } from '../utils/logger'

interface FeedbackModalProps {
  onClose: () => void
}

export function FeedbackModal({ onClose }: FeedbackModalProps) {
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const modalRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSubmit = async () => {
    if (!message.trim()) {
      setError('Please enter your feedback')
      return
    }

    setIsSending(true)
    setError(null)

    try {
      const result = await window.api.feedback.send({
        message: message.trim(),
        email: email.trim() || undefined
      })

      if (result.success) {
        setSuccess(true)
        setTimeout(() => onClose(), 1500)
      } else {
        setError(result.error || 'Failed to send feedback')
      }
    } catch (err) {
      logger.error('Failed to send feedback:', err)
      setError(err instanceof Error ? err.message : 'Failed to send feedback')
    } finally {
      setIsSending(false)
    }
  }

  // Handle Cmd+Enter to submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isSending && message.trim()) {
      handleSubmit()
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
        <div className="bg-surface rounded-xl shadow-elevated p-6 text-center">
          <svg className="w-12 h-12 text-success mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-text">Thank you for your feedback!</span>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
      <div
        ref={modalRef}
        className="bg-surface rounded-xl shadow-elevated w-full max-w-md overflow-hidden animate-slide-up"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">Send Feedback</h2>
          <button
            onClick={onClose}
            className="p-1 text-text-tertiary hover:text-text transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Feedback message */}
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              Your Feedback
            </label>
            <textarea
              ref={textareaRef}
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell us what you think, report a bug, or suggest a feature..."
              rows={5}
              className="w-full px-3 py-2 bg-surface-tertiary rounded-lg text-sm text-text placeholder-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-blue resize-none"
            />
          </div>

          {/* Email (optional) */}
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              Your Email <span className="text-text-tertiary font-normal">(optional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="your@email.com"
              className="w-full px-3 py-2 bg-surface-tertiary rounded-lg text-sm text-text placeholder-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-blue"
            />
            <p className="mt-1 text-xs text-text-tertiary">
              Include if you'd like us to follow up with you
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <div className="flex-1 mr-4">
            {error && (
              <p className="text-sm text-error">{error}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary hidden sm:block">Cmd+Enter to send</span>
            <button
              onClick={handleSubmit}
              disabled={isSending || !message.trim()}
              className="px-4 py-2 bg-accent-blue text-white text-sm font-medium rounded-lg hover:bg-accent-blue/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? 'Sending...' : 'Send Feedback'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
