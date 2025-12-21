import { format, differenceInDays, startOfDay } from 'date-fns'
import type { Task } from '../types'

interface TaskItemProps {
  task: Task
  onSelect: () => void
  onComplete: () => void
  onOpenChat?: () => void
  isSelected?: boolean
  showCompletionDate?: boolean
}

export function TaskItem({
  task,
  onSelect,
  onComplete,
  onOpenChat,
  isSelected = false,
  showCompletionDate = false
}: TaskItemProps) {
  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onComplete()
  }

  const handleChatClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onOpenChat?.()
  }

  return (
    <div
      onClick={onSelect}
      className={`
        group mx-4 mb-2 p-4 rounded-lg border cursor-pointer transition-all max-w-sm
        ${isSelected
          ? 'bg-surface-tertiary border-border'
          : 'bg-surface-secondary border-border hover:border-border-light'
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
              className="p-1.5 text-accent-blue hover:text-accent-blue/80 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Open chat"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
          )}

          {/* Three-dot menu (shows on hover) */}
          <button
            onClick={e => e.stopPropagation()}
            className="p-1 text-text-tertiary hover:text-text opacity-0 group-hover:opacity-100 transition-opacity"
            title="More options"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="6" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="18" r="1.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
