import { useState, useEffect } from 'react'
import type { Context } from '../types'

interface ContextSidebarItemProps {
  context: Context
  isActive: boolean
  onSelect: () => void
  onRename: (newName: string) => void
  startedTaskCount: number
  children?: React.ReactNode
}

export function ContextSidebarItem({ context, isActive, onSelect, onRename, startedTaskCount, children }: ContextSidebarItemProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameDraft, setRenameDraft] = useState('')

  // Persist expand/collapse state in sessionStorage
  const storageKey = `sidebar-context-expanded:${context.id}`
  const [isExpanded, setIsExpanded] = useState(() => {
    const stored = sessionStorage.getItem(storageKey)
    return stored !== null ? stored === 'true' : false
  })

  useEffect(() => {
    sessionStorage.setItem(storageKey, String(isExpanded))
  }, [isExpanded, storageKey])

  const handleSubmitRename = () => {
    if (renameDraft.trim() && renameDraft.trim() !== context.name) {
      onRename(renameDraft.trim())
    }
    setIsRenaming(false)
  }

  const handleCancelRename = () => {
    setIsRenaming(false)
    setRenameDraft('')
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmitRename()
    } else if (e.key === 'Escape') {
      handleCancelRename()
    }
  }

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  if (isRenaming) {
    return (
      <div className="relative px-2.5 py-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">#</span>
          <input
            type="text"
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleSubmitRename}
            autoFocus
            className="flex-1 text-sm font-medium bg-surface-tertiary border border-border-light rounded px-2 py-0.5 text-text focus:outline-none focus:ring-1 focus:ring-border-selected focus:border-border-selected"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="relative group">
      <div
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
        className={`
          w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-left cursor-pointer
          transition-colors duration-100 titlebar-no-drag
          ${isActive
            ? 'bg-surface-tertiary text-text'
            : 'text-text-secondary hover:bg-surface-tertiary/50 hover:text-text'
          }
        `}
      >
        <span className="text-sm text-text-secondary">#</span>
        <span className="text-sm font-medium truncate">{context.name}</span>

        {/* Collapse/Expand toggle - directly right of name, visible on hover */}
        <button
          onClick={handleToggleExpand}
          className="flex-shrink-0 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-text-tertiary hover:text-text"
        >
          <svg
            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Started task count badge - right-aligned */}
        {startedTaskCount > 0 && (
          <span className="text-xs text-text-tertiary flex-shrink-0">
            {startedTaskCount}
          </span>
        )}
      </div>

      {/* Expanded started tasks */}
      {isExpanded && children}
    </div>
  )
}
