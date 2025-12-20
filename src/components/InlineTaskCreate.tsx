import { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { useTaskStore } from '../stores/taskStore'

interface InlineTaskCreateProps {
  onClose: () => void
  defaultDate?: string
}

export function InlineTaskCreate({ onClose, defaultDate }: InlineTaskCreateProps) {
  const { createTask } = useTaskStore()
  const today = format(new Date(), 'yyyy-MM-dd')

  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [dateToWorkOn, setDateToWorkOn] = useState(defaultDate || today)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Handle click outside to save and close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleSaveAndClose()
      }
    }

    // Delay adding listener to prevent immediate trigger
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [name, notes, dateToWorkOn])

  const handleSaveAndClose = async () => {
    if (name.trim() && !isSubmitting) {
      setIsSubmitting(true)
      try {
        await createTask({
          name: name.trim(),
          dateToWorkOn,
          description: notes.trim() || undefined
        })
      } catch (error) {
        console.error('Failed to create task:', error)
      } finally {
        setIsSubmitting(false)
      }
    }
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSaveAndClose()
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }

  const isToday = dateToWorkOn === today

  return (
    <div
      ref={containerRef}
      className="mx-4 my-2 bg-surface-tertiary rounded-xl p-4 shadow-card animate-fade-in"
    >
      {/* Task name input */}
      <div className="flex items-start gap-3">
        <div className="checkbox mt-0.5" />
        <div className="flex-1">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="New To-Do"
            className="w-full bg-transparent text-text text-sm placeholder-text-tertiary focus:outline-none"
          />
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Notes"
            className="w-full bg-transparent text-text-secondary text-sm placeholder-text-tertiary focus:outline-none mt-1"
          />
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        {/* Date selector */}
        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          className="flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover transition-colors"
        >
          <span>★</span>
          <span>{isToday ? 'Today' : format(new Date(dateToWorkOn), 'MMM d')}</span>
        </button>

        {showDatePicker && (
          <div className="absolute mt-1 bg-surface-elevated rounded-lg shadow-elevated p-2 z-10">
            <input
              type="date"
              value={dateToWorkOn}
              onChange={e => {
                setDateToWorkOn(e.target.value)
                setShowDatePicker(false)
              }}
              className="bg-surface-tertiary rounded px-2 py-1 text-sm"
            />
          </div>
        )}

        {/* Action buttons - icons only like Things */}
        <div className="flex items-center gap-2">
          {/* Tags icon placeholder */}
          <button className="p-1.5 text-text-tertiary hover:text-text-secondary transition-colors" title="Tags">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </button>

          {/* Checklist icon placeholder */}
          <button className="p-1.5 text-text-tertiary hover:text-text-secondary transition-colors" title="Checklist">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </button>

          {/* Deadline icon */}
          <button className="p-1.5 text-text-tertiary hover:text-text-secondary transition-colors" title="Deadline">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
