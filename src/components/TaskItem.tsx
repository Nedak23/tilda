import { useState, useRef, useEffect } from 'react'
import { format, differenceInDays, startOfDay } from 'date-fns'
import type { Task, Context } from '../types'

interface TaskItemProps {
  task: Task
  onSelect: () => void
  onClick: (e: React.MouseEvent) => void
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
  onClick,
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

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClick(e)
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect()
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

  // Compute deadline display text and color
  const deadlineInfo = (() => {
    if (!task.deadline || task.status === 'archived') return null
    const today = startOfDay(new Date())
    const deadlineDate = startOfDay(new Date(task.deadline))
    const daysLeft = differenceInDays(deadlineDate, today)

    let displayText: string
    let isUrgent = false

    if (daysLeft < 0) {
      displayText = `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''}`
      isUrgent = true
    } else if (daysLeft === 0) {
      displayText = 'Due today'
      isUrgent = true
    } else if (daysLeft === 1) {
      displayText = 'Due tomorrow'
    } else {
      displayText = `${daysLeft} days left`
    }

    return { displayText, isUrgent }
  })()

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`
        group flex items-center gap-3 pl-4 pr-4 py-2 mx-2 cursor-pointer rounded-lg
        ${isSelected ? 'bg-accent-blue/30' : ''}
      `}
    >
      {/* Checkbox */}
      {task.status !== 'archived' ? (
        <button
          onClick={handleCheckboxClick}
          className="checkbox flex-shrink-0"
          aria-label="Complete task"
        />
      ) : (
        <div className="checkbox checked flex-shrink-0">
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

      {/* Task name */}
      <span
        className={`
          text-sm flex-shrink-0
          ${task.status === 'archived' ? 'text-text-secondary' : 'text-text'}
        `}
      >
        {task.name}
      </span>

      {/* Context pills - inline with name */}
      {contexts.length > 0 && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {contexts.map(context => (
            <span
              key={context.id}
              className="inline-flex items-center px-2 py-0.5 text-xs text-text-secondary border border-border rounded-full"
            >
              {context.name}
            </span>
          ))}
        </div>
      )}

      {/* Blue dot for unread */}
      {task.hasUnreadAgentMessage && (
        <span className="w-2 h-2 rounded-full bg-accent-blue animate-pulse-dot flex-shrink-0" />
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Deadline display - far right, inline */}
      {deadlineInfo && (
        <div className={`flex items-center gap-1.5 flex-shrink-0 text-xs ${deadlineInfo.isUrgent ? 'text-error' : 'text-text-tertiary'}`}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span>{deadlineInfo.displayText}</span>
        </div>
      )}

      {/* Completion date - for archive view */}
      {showCompletionDate && task.completionDate && (
        <span className="text-xs text-text-tertiary flex-shrink-0">
          {format(new Date(task.completionDate), 'MMM d')}
        </span>
      )}

      {/* Date to work on - for context detail view */}
      {showDate && task.dateToWorkOn && task.status !== 'archived' && (
        <span className="text-xs text-text-tertiary flex-shrink-0">
          {format(new Date(task.dateToWorkOn), 'MMM d')}
        </span>
      )}

      {/* Right side - indicators and buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Recurring indicator */}
        {task.recurrenceRule && (
          <span className="text-text-tertiary text-xs" title="Recurring task">
            ↻
          </span>
        )}

        {/* Hover buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Chat button */}
          {onOpenChat && (
            <button
              onClick={handleChatClick}
              className="p-1 text-text-tertiary hover:text-accent-blue transition-colors"
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
                className="p-1 text-text-tertiary hover:text-accent-blue transition-colors"
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
