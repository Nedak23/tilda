import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { useTaskStore } from '../stores/taskStore'
import { SortableContextItem } from './SortableContextItem'
import { CreateContextModal } from './CreateContextModal'
import { logger } from '../utils/logger'
import type { ViewType } from '../types'

const navItems: { id: ViewType; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'archive', label: 'Logbook' }
]

const NavIcon = ({ id }: { id: ViewType }) => {
  switch (id) {
    case 'today':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      )
    case 'upcoming':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    case 'archive':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )
    default:
      return null
  }
}

export function Sidebar() {
  const {
    currentView,
    setCurrentView,
    getTodayTasks,
    getUpcomingTasks,
    contexts,
    createContext,
    deleteContext,
    reorderContext,
    tasks,
    taskContextsByTask
  } = useTaskStore()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const [isContextsExpanded, setIsContextsExpanded] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const todayCount = getTodayTasks().length
  const upcomingCount = getUpcomingTasks().length

  const getCounts = (id: ViewType): number | undefined => {
    if (id === 'today') return todayCount > 0 ? todayCount : undefined
    if (id === 'upcoming') return upcomingCount > 0 ? upcomingCount : undefined
    return undefined
  }

  // Count tasks in each context (only non-archived tasks)
  const getContextTaskCount = (contextId: string): number => {
    return tasks.filter(task => {
      if (task.status === 'archived') return false
      const taskContexts = taskContextsByTask[task.id] || []
      return taskContexts.includes(contextId)
    }).length
  }

  const handleCreateContext = async (name: string, description?: string) => {
    try {
      await createContext({ name, description })
    } catch (error) {
      logger.error('Failed to create context:', error)
    }
  }

  const handleDeleteContext = async (contextId: string) => {
    if (confirm('Are you sure you want to delete this context? Tasks in this context will not be deleted.')) {
      try {
        await deleteContext(contextId)
      } catch (error) {
        logger.error('Failed to delete context:', error)
      }
    }
  }

  const handleContextDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = contexts.findIndex(c => c.id === active.id)
      const newIndex = contexts.findIndex(c => c.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        try {
          await reorderContext(active.id as string, newIndex)
        } catch (error) {
          logger.error('Failed to reorder context:', error)
        }
      }
    }
  }

  return (
    <aside className="w-full bg-surface flex flex-col h-full">
      {/* Navigation */}
      <nav className="flex-1 px-2 pt-2 pb-1 overflow-y-auto">
        <ul className="space-y-0.5">
          {navItems.map(item => {
            const count = getCounts(item.id)
            const isActive = currentView === item.id

            return (
              <li key={item.id}>
                <button
                  onClick={() => setCurrentView(item.id)}
                  className={`
                    w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left
                    transition-colors duration-100 titlebar-no-drag
                    ${isActive
                      ? 'bg-surface-tertiary text-text'
                      : 'text-text-secondary hover:bg-surface-tertiary/50 hover:text-text'
                    }
                  `}
                >
                  <NavIcon id={item.id} />
                  <span className="flex-1 text-sm font-medium">{item.label}</span>
                  {count !== undefined && (
                    <span className="text-xs text-text-secondary">
                      {count}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        {/* My Contexts section */}
        <div className="mt-4">
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <button
              onClick={() => setIsContextsExpanded(!isContextsExpanded)}
              className="flex items-center gap-1 text-xs font-semibold text-text-secondary uppercase tracking-wider hover:text-text transition-colors"
            >
              <svg
                className={`w-3 h-3 transition-transform ${isContextsExpanded ? 'rotate-90' : ''}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              My Contexts
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="p-0.5 text-text-secondary hover:text-text hover:bg-surface-tertiary rounded transition-colors"
              title="Create context"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {isContextsExpanded && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleContextDragEnd}
            >
              <SortableContext
                items={contexts.map(c => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-0.5 mt-1">
                  {contexts.map(context => (
                    <li key={context.id}>
                      <SortableContextItem
                        context={context}
                        isActive={currentView === `context:${context.id}`}
                        taskCount={getContextTaskCount(context.id)}
                        onSelect={() => setCurrentView(`context:${context.id}`)}
                        onDelete={() => handleDeleteContext(context.id)}
                      />
                    </li>
                  ))}
                  {contexts.length === 0 && (
                    <li className="px-2.5 py-2 text-xs text-text-secondary/70 italic">
                      No contexts yet
                    </li>
                  )}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </nav>

      {/* Create Context Modal */}
      <CreateContextModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateContext}
      />
    </aside>
  )
}
