import { useState, useRef, useEffect } from 'react'
import type { Task } from '../types'

const COMPLETION_ANIMATION_DURATION = 500

interface SidebarTaskItemProps {
  task: Task
  isActive: boolean
  onSelect: () => void
  onComplete: () => void
  onUnstart: () => void
}

export function SidebarTaskItem({ task, isActive, onSelect, onComplete, onUnstart }: SidebarTaskItemProps) {
  const [isCompleting, setIsCompleting] = useState(false)
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current)
      }
    }
  }, [])

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isCompleting) {
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current)
        completionTimerRef.current = null
      }
      setIsCompleting(false)
      return
    }
    setIsCompleting(true)
    completionTimerRef.current = setTimeout(() => {
      onComplete()
    }, COMPLETION_ANIMATION_DURATION)
  }

  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
      className={`
        group/task w-full flex items-center gap-2 pl-7 pr-2 py-1 rounded-md text-left cursor-pointer
        transition-colors duration-100 titlebar-no-drag
        ${isActive
          ? 'bg-surface-tertiary text-text'
          : 'text-text-secondary hover:bg-surface-tertiary/50 hover:text-text'
        }
        ${isCompleting ? 'animate-complete-out' : ''}
      `}
    >
      {/* Checkbox */}
      {!isCompleting ? (
        <button
          onClick={handleCheckboxClick}
          className="checkbox flex-shrink-0 scale-75"
          aria-label="Complete task"
        />
      ) : (
        <button
          onClick={handleCheckboxClick}
          className="checkbox checked flex-shrink-0 scale-75"
          aria-label="Completing task"
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
      <span className="text-xs truncate flex-1">{task.name}</span>

      {/* Unread blue dot */}
      {task.hasUnreadAgentMessage && (
        <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse-dot flex-shrink-0" />
      )}

      {/* Un-start button on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onUnstart()
        }}
        className="opacity-0 group-hover/task:opacity-100 p-0.5 text-text-tertiary hover:text-text transition-opacity flex-shrink-0"
        title="Stop working on this task"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
