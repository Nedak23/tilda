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
import { SidebarTaskItem } from './SidebarTaskItem'
import { CreateContextModal } from './CreateContextModal'
import { logger } from '../utils/logger'
import type { ViewType } from '../types'

const navItems: { id: ViewType; label: string }[] = [
  { id: 'today', label: 'Inbox' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'archive', label: 'Logbook' }
]

const NavIcon = ({ id }: { id: ViewType }) => {
  switch (id) {
    case 'today':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
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
    activeTaskId,
    getTodayTasks,
    contexts,
    createContext,
    reorderContext,
    updateContext,
    addContextDocument,
    addContextDocumentFromData,
    getStartedTasksByContext,
    setActiveTask,
    completeTask,
    stopWorking
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

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const todayCount = getTodayTasks().length

  const getCounts = (id: ViewType): number | undefined => {
    if (id === 'today') return todayCount > 0 ? todayCount : undefined
    return undefined
  }

  const handleCreateContext = async (name: string, description?: string, files?: File[], directoryFiles?: import('../types').DirectoryFile[]) => {
    try {
      const context = await createContext({ name, description })
      if (files && files.length > 0 && context) {
        const results = await Promise.allSettled(
          files.map(file => addContextDocument(context.id, file))
        )
        const failures = results.filter(r => r.status === 'rejected')
        if (failures.length > 0) {
          logger.error(`Failed to upload ${failures.length} of ${files.length} files`)
        }
      }
      if (directoryFiles && directoryFiles.length > 0 && context) {
        const results = await Promise.allSettled(
          directoryFiles.map(file => addContextDocumentFromData(context.id, file))
        )
        const failures = results.filter(r => r.status === 'rejected')
        if (failures.length > 0) {
          logger.error(`Failed to upload ${failures.length} of ${directoryFiles.length} directory files`)
        }
      }
    } catch (error) {
      logger.error('Failed to create context:', error)
    }
  }

  const handleRenameContext = async (contextId: string, newName: string) => {
    try {
      await updateContext(contextId, { name: newName })
    } catch (error) {
      logger.error('Failed to rename context:', error)
    }
  }

  const handleContextDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const sortedContexts = [...contexts].sort((a, b) => a.sortPosition - b.sortPosition)
      const oldIndex = sortedContexts.findIndex(c => c.id === active.id)
      const newIndex = sortedContexts.findIndex(c => c.id === over.id)

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
            const isActive = currentView === item.id && !activeTaskId

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

        {/* Contexts section - each context is individually collapsible */}
        <div className="mt-4">
          <div className="border-t border-border-light mb-2" />
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleContextDragEnd}
          >
            <SortableContext
              items={contexts.map(c => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-0.5">
                {contexts.map(context => {
                  const startedTasks = getStartedTasksByContext(context.id)
                  return (
                    <li key={context.id}>
                      <SortableContextItem
                        context={context}
                        isActive={currentView === `context:${context.id}` && !activeTaskId}
                        onSelect={() => setCurrentView(`context:${context.id}`)}
                        onRename={(newName) => handleRenameContext(context.id, newName)}
                        startedTaskCount={startedTasks.length}
                      >
                        {startedTasks.map(task => (
                          <SidebarTaskItem
                            key={task.id}
                            task={task}
                            isActive={activeTaskId === task.id}
                            onSelect={() => setActiveTask(task.id)}
                            onComplete={() => completeTask(task.id)}
                            onUnstart={() => stopWorking(task.id)}
                          />
                        ))}
                      </SortableContextItem>
                    </li>
                  )
                })}
                {contexts.length === 0 && (
                  <li className="px-2.5 py-2 text-xs text-text-secondary/70 italic">
                    No contexts yet
                  </li>
                )}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      </nav>

      {/* Bottom bar */}
      <div className="flex-shrink-0 border-t border-border-light px-2 py-2">
        <div className="flex items-center">
          {/* New Context */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="p-1.5 text-text-tertiary hover:text-text hover:bg-surface-tertiary rounded transition-colors titlebar-no-drag"
            title="New context"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Create Context Modal */}
      <CreateContextModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateContext}
      />
    </aside>
  )
}
