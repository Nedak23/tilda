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
        task-item flex items-center gap-3 px-4 py-2.5 cursor-pointer
        ${isSelected ? 'bg-surface-tertiary' : ''}
      `}
    >
      {/* Checkbox */}
      {task.status !== 'archived' ? (
        <button
          onClick={handleCheckboxClick}
          className="checkbox"
          aria-label="Complete task"
        />
      ) : (
        <div className="checkbox checked">
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
        {task.deadline && task.status !== 'archived' && (
          <p className="text-xs text-text-tertiary mt-0.5">
            Due {format(new Date(task.deadline), 'MMM d')}
          </p>
        )}
        {showCompletionDate && task.completionDate && (
          <p className="text-xs text-text-tertiary mt-0.5">
            {format(new Date(task.completionDate), 'MMM d')}
          </p>
        )}
      </div>

      {/* Recurring indicator */}
      {task.recurrenceRule && (
        <span className="text-text-tertiary text-xs flex-shrink-0" title="Recurring task">
          ↻
        </span>
      )}
    </div>
  )
}
