import { format } from 'date-fns'
import type { Task } from '../types'

interface TaskItemProps {
  task: Task
  onSelect: () => void
  onComplete: () => void
  isSelected?: boolean
  showCompletionDate?: boolean
}

export function TaskItem({
  task,
  onSelect,
  onComplete,
  isSelected = false,
  showCompletionDate = false
}: TaskItemProps) {
  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onComplete()
  }

  return (
    <div
      onClick={onSelect}
      className={`
        task-item flex items-center gap-3 px-4 py-3 cursor-pointer rounded-lg
        ${isSelected ? 'bg-accent/5 ring-1 ring-accent/20' : ''}
      `}
    >
      {/* Checkbox */}
      {task.status !== 'archived' ? (
        <button
          onClick={handleCheckboxClick}
          className="checkbox-circle flex-shrink-0"
          aria-label="Complete task"
        >
          <span className="sr-only">Complete</span>
        </button>
      ) : (
        <div className="checkbox-circle checked flex-shrink-0">
          <svg
            className="w-3 h-3 text-white"
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
              text-sm truncate
              ${task.status === 'archived' ? 'text-text-secondary line-through' : 'text-text'}
            `}
          >
            {task.name}
          </span>

          {/* Blue dot for unread */}
          {task.hasUnreadAgentMessage && (
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse-dot flex-shrink-0" />
          )}
        </div>

        {/* Deadline or completion date */}
        {task.deadline && task.status !== 'archived' && (
          <p className="text-xs text-text-tertiary mt-0.5">
            Due {format(new Date(task.deadline), 'MMM d')}
          </p>
        )}
        {showCompletionDate && task.completionDate && (
          <p className="text-xs text-text-tertiary mt-0.5">
            Completed {format(new Date(task.completionDate), 'MMM d')}
          </p>
        )}
      </div>

      {/* Recurring indicator */}
      {task.recurrenceRule && (
        <span className="text-text-tertiary text-sm flex-shrink-0" title="Recurring task">
          ↻
        </span>
      )}
    </div>
  )
}
