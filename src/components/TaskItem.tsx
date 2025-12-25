import { useState, useRef, useEffect } from 'react'
import { format, differenceInDays, startOfDay } from 'date-fns'
import type { Task, Context } from '../types'

interface TaskItemProps {
  task: Task
  onSelect: () => void
  onComplete: () => void
  onOpenChat?: () => void
  onDateChange?: (date: string) => void
  isSelected?: boolean
  showCompletionDate?: boolean
  showDate?: boolean
  contexts?: Context[]
}

export function TaskItem({
  task,
  onSelect,
  onComplete,
  onOpenChat,
  onDateChange,
  isSelected = false,
  showCompletionDate = false,
  showDate = false,
  contexts = []
}: TaskItemProps) {
  const [showDatePicker, setShowDatePicker] = useState(false)
  const datePickerRef = useRef<HTMLDivElement>(null)

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onComplete()
  }

  const handleChatClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onOpenChat?.()
  }

  const handleCalendarClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDatePicker(!showDatePicker)
  }

  const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    onDateChange?.(e.target.value)
    setShowDatePicker(false)
  }

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false)
      }
    }

    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDatePicker])

  return (
    <div
      onClick={onSelect}
      className={`
        group mx-4 mb-2 p-4 rounded-lg border cursor-pointer transition-all max-w-sm
        ${isSelected
          ? 'bg-surface-selected border-border-selected'
          : 'bg-surface-secondary border-border hover:border-border-selected'
        }
      `}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        {task.status !== 'archived' ? (
          <button
            onClick={handleCheckboxClick}
            className="checkbox mt-0.5"
            aria-label="Complete task"
          />
        ) : (
          <div className="checkbox checked mt-0.5">
            <svg
              className="w-2.5 h-2.5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {/* Task content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`
                text-sm
                ${task.status === 'archived' ? 'text-text-secondary' : 'text-text'}
              `}
            >
              {task.name}
            </span>

            {/* Blue dot for unread */}
            {task.hasUnreadAgentMessage && (
              <span className="w-2 h-2 rounded-full bg-accent-blue animate-pulse-dot flex-shrink-0" />
            )}
          </div>

          {/* Deadline or completion date */}
          {task.deadline && task.status !== 'archived' && (() => {
            const today = startOfDay(new Date())
            const deadlineDate = startOfDay(new Date(task.deadline))
            const daysLeft = differenceInDays(deadlineDate, today)

            let displayText: string
            let colorClass: string

            if (daysLeft < 0) {
              displayText = `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''}`
              colorClass = 'text-error'
            } else if (daysLeft === 0) {
              displayText = 'Due today'
              colorClass = 'text-warning'
            } else if (daysLeft === 1) {
              displayText = 'Due tomorrow'
              colorClass = 'text-warning'
            } else if (daysLeft <= 7) {
              displayText = `${daysLeft} days left`
              colorClass = 'text-accent-blue'
            } else {
              displayText = `${daysLeft} days left`
              colorClass = 'text-text-tertiary'
            }

            return (
              <p className={`text-xs mt-1 ${colorClass}`}>
                {displayText}
              </p>
            )
          })()}
          {showCompletionDate && task.completionDate && (
            <p className="text-xs text-text-tertiary mt-1">
              {format(new Date(task.completionDate), 'MMM d')}
            </p>
          )}
          {showDate && task.dateToWorkOn && task.status !== 'archived' && (
            <p className="text-xs text-text-tertiary mt-1">
              {format(new Date(task.dateToWorkOn), 'MMM d')}
            </p>
          )}
          {/* Context badges */}
          {contexts.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {contexts.map(context => (
                <span
                  key={context.id}
                  className="inline-flex items-center px-1.5 py-0.5 text-xs bg-surface-tertiary text-text-secondary rounded"
                >
                  #{context.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right side - menu and indicators */}
        <div className="flex items-center gap-1">
          {/* Recurring indicator */}
          {task.recurrenceRule && (
            <span className="text-text-tertiary text-xs" title="Recurring task">
              ↻
            </span>
          )}

          {/* Chat button */}
          {onOpenChat && (
            <button
              onClick={handleChatClick}
              className="p-1.5 text-text-tertiary hover:text-accent-blue transition-colors"
              title="Open chat"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
          )}

          {/* Calendar button for date reassignment */}
          {onDateChange && task.status !== 'archived' && (
            <div className="relative" ref={datePickerRef}>
              <button
                onClick={handleCalendarClick}
                className="p-1.5 text-text-tertiary hover:text-accent-blue transition-colors"
                title="Change date"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              {showDatePicker && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 bg-surface-secondary border border-border rounded-lg shadow-elevated p-2"
                  onClick={e => e.stopPropagation()}
                >
                  <input
                    type="date"
                    value={task.dateToWorkOn}
                    onChange={handleDateSelect}
                    className="bg-surface-tertiary text-text text-sm rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent-blue"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
