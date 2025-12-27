import { format, differenceInDays, startOfDay, parseISO } from 'date-fns'
import { GENERAL_CONTEXT_ID } from '../types'
import { InlineTaskEdit } from './InlineTaskEdit'
import type { Task, Context } from '../types'

interface TaskItemProps {
  task: Task
  onSelect?: () => void
  onClick: (e: React.MouseEvent) => void
  onComplete: () => void
  isSelected?: boolean
  showCompletionDate?: boolean
  showDate?: boolean
  contexts?: Context[]
  isEditing?: boolean
  onStartEdit?: () => void
  onCloseEdit?: () => void
  onExpandChat?: () => void
}

export function TaskItem({
  task,
  onSelect,
  onClick,
  onComplete,
  isSelected = false,
  showCompletionDate = false,
  showDate = false,
  contexts = [],
  isEditing = false,
  onStartEdit,
  onCloseEdit,
  onExpandChat
}: TaskItemProps) {
  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onComplete()
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClick(e)
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onStartEdit) {
      onStartEdit()
    } else if (onSelect) {
      onSelect()
    }
  }

  // Compute deadline display text and color
  const deadlineInfo = (() => {
    if (!task.deadline || task.status === 'archived') return null
    const today = startOfDay(new Date())
    const deadlineDate = startOfDay(parseISO(task.deadline))
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

  // If editing, render InlineTaskEdit instead
  if (isEditing && onCloseEdit && onExpandChat) {
    return (
      <InlineTaskEdit
        task={task}
        onClose={onCloseEdit}
        onExpandChat={onExpandChat}
        onComplete={onComplete}
      />
    )
  }

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`
        group flex items-center gap-3 pl-4 pr-4 py-1 mx-2 cursor-pointer rounded-lg select-none
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
        <button
          onClick={handleCheckboxClick}
          className="checkbox checked flex-shrink-0"
          aria-label="Uncheck task"
        >
          <svg
            className="w-2.5 h-2.5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>
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

      {/* Context pills - inline with name (filter out General context) */}
      {(() => {
        const filteredContexts = contexts.filter(c => c.id !== GENERAL_CONTEXT_ID)
        return filteredContexts.length > 0 && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {filteredContexts.map(context => (
            <span
              key={context.id}
              className="inline-flex items-center px-2 py-0.5 text-xs text-text-secondary border border-border rounded-full"
            >
              {context.name}
            </span>
          ))}
        </div>
        )
      })()}

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
          {format(parseISO(task.completionDate), 'MMM d')}
        </span>
      )}

      {/* Date to work on - for context detail view */}
      {showDate && task.dateToWorkOn && task.status !== 'archived' && (
        <span className="text-xs text-text-tertiary flex-shrink-0">
          {format(parseISO(task.dateToWorkOn), 'MMM d')}
        </span>
      )}

      {/* Recurring indicator */}
      {task.recurrenceRule && (
        <span className="text-text-tertiary text-xs flex-shrink-0" title="Recurring task">
          ↻
        </span>
      )}
    </div>
  )
}
