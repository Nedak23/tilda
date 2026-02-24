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

interface SidebarProps {
  onOpenSettings: () => void
  onOpenFeedback: () => void
}

export function Sidebar({ onOpenSettings, onOpenFeedback }: SidebarProps) {
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
        <div className="flex items-center gap-1">
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

          {/* Feedback button */}
          <button
            onClick={onOpenFeedback}
            className="p-1.5 text-text-tertiary hover:text-text hover:bg-surface-tertiary rounded transition-colors titlebar-no-drag"
            title="Send Feedback"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
          </button>

          {/* Settings button */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 text-text-tertiary hover:text-text hover:bg-surface-tertiary rounded transition-colors titlebar-no-drag"
            title="Settings"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
