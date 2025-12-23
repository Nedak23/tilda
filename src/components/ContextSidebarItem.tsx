import { useState } from 'react'
import { GENERAL_CONTEXT_ID, type Context } from '../types'

interface ContextSidebarItemProps {
  context: Context
  isActive: boolean
  taskCount: number
  onSelect: () => void
  onDelete: () => void
}

export function ContextSidebarItem({ context, isActive, taskCount, onSelect, onDelete }: ContextSidebarItemProps) {
  const [showMenu, setShowMenu] = useState(false)
  const isGeneralContext = context.id === GENERAL_CONTEXT_ID

  return (
    <div className="relative group">
      <button
        onClick={onSelect}
        className={`
          w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left
          transition-colors duration-100 titlebar-no-drag
          ${isActive
            ? 'bg-surface-tertiary text-text'
            : 'text-text-secondary hover:bg-surface-tertiary/50 hover:text-text'
          }
        `}
      >
        <span className="text-sm text-text-secondary">#</span>
        <span className="flex-1 text-sm font-medium truncate">{context.name}</span>
        {taskCount > 0 && (
          <span className="text-xs text-text-secondary">
            {taskCount}
          </span>
        )}
      </button>

      {/* Menu button - shows on hover, but not for General context */}
      {!isGeneralContext && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowMenu(!showMenu)
          }}
          className={`
            absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded
            opacity-0 group-hover:opacity-100 transition-opacity
            hover:bg-surface-tertiary text-text-secondary hover:text-text
            ${showMenu ? 'opacity-100' : ''}
          `}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
        </button>
      )}

      {/* Dropdown menu */}
      {showMenu && !isGeneralContext && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 bg-surface-secondary border border-border-light rounded-md shadow-lg py-1 min-w-[120px]">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(false)
                onDelete()
              }}
              className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-surface-tertiary"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}
