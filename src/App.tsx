import { useEffect, useState, useCallback, useRef } from 'react'
import { useTaskStore } from './stores/taskStore'
import { Sidebar } from './components/Sidebar'
import { TaskList } from './components/TaskList'
import { TaskChat } from './components/TaskChat'
import { InlineTaskEdit } from './components/InlineTaskEdit'
import { SettingsModal } from './components/SettingsModal'
import { FeedbackModal } from './components/FeedbackModal'
import { FileManagerSidebar } from './components/FileManagerSidebar'
import { ContextDetailView, ContextDetailViewRef } from './components/ContextDetailView'
import { PanelLayout } from './components/PanelLayout'
import { ControlBar } from './components/ControlBar'
import { CalendarPicker } from './components/CalendarPicker'
import { useLayoutState } from './hooks/useLayoutState'
import { logger } from './utils/logger'
import type { AILearningNote } from './types'

function App() {
  const {
    currentView,
    activeTaskId,
    tasks,
    isLoading,
    loadTasks,
    loadContexts,
    completeTask,
    setActiveTask,
    contexts,
    updateTask,
    deleteTasks,
    restoreDeletedTasks,
    clearDeletedTasks
  } = useTaskStore()

  const {
    isTildaCollapsed,
    isNavCollapsed,
    tildaSize,
    navSize,
    toggleTilda,
    toggleNav,
    setTildaCollapsed,
    setNavCollapsed,
    setTildaSize,
    setNavSize
  } = useLayoutState()

  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const [notification, setNotification] = useState<{ message: string; contextId: string } | null>(null)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [deleteNotification, setDeleteNotification] = useState<{ count: number } | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const lastSelectedTaskId = useRef<string | null>(null)
  const datePickerRef = useRef<HTMLDivElement>(null)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contextDetailRef = useRef<ContextDetailViewRef>(null)

  useEffect(() => {
    loadTasks()
    loadContexts()
  }, [loadTasks, loadContexts])

  // Listen for AI note saved events
  useEffect(() => {
    const unsubscribe = window.api.aiNotes.onNoteSaved((note: AILearningNote) => {
      setNotification({
        message: `AI saved a learning note: "${note.title}"`,
        contextId: note.contextId
      })
      // Auto-dismiss after 5 seconds
      setTimeout(() => setNotification(null), 5000)
    })
    return unsubscribe
  }, [])

  const activeTask = tasks.find(t => t.id === activeTaskId)

  // Expand file manager sidebar when viewing a task, collapse when not
  useEffect(() => {
    if (activeTaskId) {
      setTildaCollapsed(false)
    } else {
      setTildaCollapsed(true)
    }
  }, [activeTaskId, setTildaCollapsed])

  // Get visible tasks for range selection
  const getVisibleTasks = useCallback(() => {
    if (currentView === 'today') {
      return tasks.filter(t => {
        const today = new Date().toISOString().split('T')[0]
        return t.status !== 'archived' && t.dateToWorkOn?.split('T')[0] === today
      })
    } else if (currentView === 'upcoming') {
      return tasks.filter(t => {
        const today = new Date().toISOString().split('T')[0]
        return t.status !== 'archived' && t.dateToWorkOn && t.dateToWorkOn.split('T')[0] > today
      })
    } else if (currentView.startsWith('context:')) {
      const contextId = currentView.replace('context:', '')
      return tasks.filter(t => {
        if (t.status === 'archived') return false
        return t.contextId === contextId
      })
    } else {
      return tasks.filter(t => t.status === 'archived')
    }
  }, [currentView, tasks])

  // Handle task click with selection logic
  const handleTaskClick = useCallback((taskId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const visibleTasks = getVisibleTasks()

    if (e.shiftKey && lastSelectedTaskId.current) {
      // Shift-click: range select
      const lastIndex = visibleTasks.findIndex(t => t.id === lastSelectedTaskId.current)
      const currentIndex = visibleTasks.findIndex(t => t.id === taskId)
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex)
        const end = Math.max(lastIndex, currentIndex)
        const newSelection = new Set(selectedTaskIds)
        for (let i = start; i <= end; i++) {
          newSelection.add(visibleTasks[i].id)
        }
        setSelectedTaskIds(newSelection)
        lastSelectedTaskId.current = taskId
      }
    } else if (e.metaKey || e.ctrlKey) {
      // Cmd/Ctrl-click: toggle selection
      const newSelection = new Set(selectedTaskIds)
      if (newSelection.has(taskId)) {
        newSelection.delete(taskId)
      } else {
        newSelection.add(taskId)
      }
      setSelectedTaskIds(newSelection)
      lastSelectedTaskId.current = taskId
    } else {
      // Regular click: select only this task (double-click opens inline edit via TaskItem)
      setSelectedTaskIds(new Set([taskId]))
      lastSelectedTaskId.current = taskId
    }
  }, [getVisibleTasks, selectedTaskIds])

  // Clear selection when clicking empty space
  const handleClearSelection = useCallback(() => {
    setSelectedTaskIds(new Set())
  }, [])

  // Handle delete selected tasks
  const handleDeleteSelected = useCallback(async () => {
    if (selectedTaskIds.size === 0) return

    // Clear any existing delete timer
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current)
    }

    const count = selectedTaskIds.size
    await deleteTasks(Array.from(selectedTaskIds))
    setSelectedTaskIds(new Set())

    // Show notification
    setDeleteNotification({ count })

    // Clear deleted tasks after 10 seconds
    deleteTimerRef.current = setTimeout(() => {
      clearDeletedTasks()
      setDeleteNotification(null)
    }, 10000)
  }, [selectedTaskIds, deleteTasks, clearDeletedTasks])

  // Handle undo delete
  const handleUndoDelete = useCallback(async () => {
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current)
    }

    await restoreDeletedTasks()
    setDeleteNotification(null)
  }, [restoreDeletedTasks])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + N to create new task
      // Note: If InlineTaskEdit is open, it handles Cmd+N with stopPropagation, so this won't fire
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        if (currentView !== 'archive' && !editingTaskId && !isCreatingTask) {
          // If we're in a context view, use the ref to trigger task creation
          if (currentView.startsWith('context:') && contextDetailRef.current) {
            contextDetailRef.current.startCreatingTask()
          } else {
            setIsCreatingTask(true)
          }
        }
      }
      // Escape to go back or cancel creation or clear selection
      if (e.key === 'Escape') {
        if (isCreatingTask) {
          setIsCreatingTask(false)
        } else if (selectedTaskIds.size > 0) {
          setSelectedTaskIds(new Set())
        } else if (activeTaskId) {
          setActiveTask(null)
        }
      }
      // Cmd/Ctrl + B to toggle Navigation (left sidebar)
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.code === 'KeyB') {
        e.preventDefault()
        toggleNav()
      }
      // Cmd/Ctrl + Option/Alt + B to toggle Tilda (right sidebar)
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.code === 'KeyB') {
        e.preventDefault()
        toggleTilda()
      }
      // Delete or Backspace to delete selected tasks
      // Only trigger if not focused on an input element
      const activeElement = document.activeElement
      const isInputFocused = activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute('contenteditable') === 'true'
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTaskIds.size > 0 && !isCreatingTask && !editingTaskId && !isInputFocused) {
        e.preventDefault()
        handleDeleteSelected()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTaskId, isCreatingTask, currentView, selectedTaskIds.size, setActiveTask, toggleTilda, toggleNav, handleDeleteSelected, editingTaskId])

  // Handle date change for selected tasks
  const handleBulkDateChange = useCallback(async (date: string) => {
    try {
      await Promise.all(
        Array.from(selectedTaskIds).map(taskId =>
          updateTask(taskId, { dateToWorkOn: date })
        )
      )
    } catch (error) {
      logger.error('Failed to update some tasks:', error)
    }
    setShowDatePicker(false)
    setSelectedTaskIds(new Set())
  }, [selectedTaskIds, updateTask])

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false)
      }
    }

    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDatePicker])

  // Cleanup delete timer on unmount
  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    }
  }, [])

  // Check if we're viewing a context
  const isContextView = currentView.startsWith('context:')
  const currentContextId = isContextView ? currentView.replace('context:', '') : null
  const currentContext = currentContextId ? contexts.find(c => c.id === currentContextId) : null

  const getViewTitle = () => {
    if (isContextView && currentContext) {
      return currentContext.name
    }
    switch (currentView) {
      case 'today':
        return 'Inbox'
      case 'upcoming':
        return 'Upcoming'
      case 'archive':
        return 'Logbook'
      default:
        return 'Tasks'
    }
  }

  const getViewIcon = () => {
    if (isContextView) {
      return <span className="text-text-secondary text-2xl">#</span>
    }
    return null
  }

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <div className="text-text-secondary">Loading...</div>
      </div>
    )
  }

  // Main content component
  const mainContent = (
    <main className="flex-1 flex flex-col min-w-0 h-full relative bg-surface">
      {activeTask ? (
        <TaskChat
          task={activeTask}
          onBack={() => setActiveTask(null)}
        />
      ) : isContextView && currentContextId ? (
        <>
          <ContextDetailView
            ref={contextDetailRef}
            contextId={currentContextId}
            onTaskSelect={(task) => setActiveTask(task.id)}
            onTaskComplete={(id) => completeTask(id)}
            selectedTaskIds={selectedTaskIds}
            onTaskClick={handleTaskClick}
          />
          {/* Bottom Action Bar for context view */}
          <div className="flex-shrink-0 border-t border-border-light bg-surface h-12">
            <div className="flex items-center justify-center gap-6 h-full">
              {/* New Task Button */}
              <button
                onClick={() => contextDetailRef.current?.startCreatingTask()}
                className="p-1.5 transition-colors text-text-tertiary hover:text-text"
                title="New task (⌘N)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>

              {/* Assign Date Button */}
              <div className="relative" ref={datePickerRef}>
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className={`p-1.5 transition-colors ${
                    selectedTaskIds.size === 0
                      ? 'text-text-tertiary opacity-50 cursor-not-allowed'
                      : 'text-text-tertiary hover:text-text'
                  }`}
                  title="Assign to date"
                  disabled={selectedTaskIds.size === 0}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
                {showDatePicker && selectedTaskIds.size > 0 && (
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50"
                    onClick={e => e.stopPropagation()}
                  >
                    <CalendarPicker
                      selectedDate={undefined}
                      onDateChange={handleBulkDateChange}
                      onClose={() => setShowDatePicker(false)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Header */}
          <header className="flex-shrink-0 relative">
            {/* View Header */}
            <div className={`flex items-center gap-3 py-4 ${isContextView ? 'px-6' : 'pl-4 pr-6'}`}>
              {getViewIcon()}
              <h1 className="text-2xl font-bold text-text">
                {getViewTitle()}
              </h1>
            </div>
          </header>

          {/* Inline task creation */}
          {isCreatingTask && (
            <InlineTaskEdit
              onClose={() => setIsCreatingTask(false)}
              onSaveAndCreateNew={() => setIsCreatingTask(true)}
            />
          )}

          {/* Task List */}
          <div className="flex-1 overflow-y-auto" onClick={handleClearSelection}>
            <TaskList
              onCreateTask={() => setIsCreatingTask(true)}
              selectedTaskIds={selectedTaskIds}
              onTaskClick={handleTaskClick}
              onClearSelection={handleClearSelection}
              editingTaskId={editingTaskId}
              onEditingTaskIdChange={setEditingTaskId}
              onSaveAndCreateNew={() => {
                setEditingTaskId(null)
                setIsCreatingTask(true)
              }}
            />
          </div>

          {/* Bottom Action Bar */}
          <div className="flex-shrink-0 border-t border-border-light bg-surface h-12">
            <div className="flex items-center justify-center gap-6 h-full">
              {/* New Task Button */}
              <button
                onClick={() => setIsCreatingTask(true)}
                className={`p-1.5 transition-colors ${
                  currentView === 'archive'
                    ? 'text-text-tertiary opacity-50 cursor-not-allowed'
                    : 'text-text-tertiary hover:text-text'
                }`}
                title={currentView === 'archive' ? 'Cannot create tasks in archive' : 'New task (⌘N)'}
                disabled={currentView === 'archive'}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>

              {/* Assign Date Button - hidden in archive view */}
              {currentView !== 'archive' && (
                <div className="relative" ref={datePickerRef}>
                  <button
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className={`p-1.5 transition-colors ${
                      selectedTaskIds.size === 0
                        ? 'text-text-tertiary opacity-50 cursor-not-allowed'
                        : 'text-text-tertiary hover:text-text'
                    }`}
                    title="Assign to date"
                    disabled={selectedTaskIds.size === 0}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                  {showDatePicker && selectedTaskIds.size > 0 && (
                    <div
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50"
                      onClick={e => e.stopPropagation()}
                    >
                      <CalendarPicker
                        selectedDate={undefined}
                        onDateChange={handleBulkDateChange}
                        onClose={() => setShowDatePicker(false)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  )

  return (
    <div className="h-screen flex flex-col bg-surface overflow-hidden">
      {/* Control bar with toggle buttons - always visible at top */}
      <ControlBar
        isTildaCollapsed={isTildaCollapsed}
        isNavCollapsed={isNavCollapsed}
        onToggleTilda={toggleTilda}
        onToggleNav={toggleNav}
        hasActiveTask={!!activeTaskId}
      />

      {/* Main layout with resizable panels */}
      <div className="flex-1 min-h-0 flex">
        <PanelLayout
          leftPanel={
            <Sidebar
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenFeedback={() => setIsFeedbackOpen(true)}
            />
          }
          centerPanel={mainContent}
          rightPanel={activeTaskId ? <FileManagerSidebar taskId={activeTaskId} /> : null}
          isLeftCollapsed={isNavCollapsed}
          isRightCollapsed={isTildaCollapsed}
          onLeftCollapseChange={setNavCollapsed}
          onRightCollapseChange={setTildaCollapsed}
          leftSize={navSize}
          rightSize={tildaSize}
          onLeftSizeChange={setNavSize}
          onRightSizeChange={setTildaSize}
        />
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}

      {/* Feedback Modal */}
      {isFeedbackOpen && (
        <FeedbackModal onClose={() => setIsFeedbackOpen(false)} />
      )}

      {/* AI Note Saved Notification */}
      {notification && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-surface-secondary border border-border-light rounded-lg shadow-xl animate-slide-up">
          <span className="text-sm text-text">{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="p-1 text-text-secondary hover:text-text"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Delete Undo Notification */}
      {deleteNotification && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-secondary border border-border-light rounded-lg shadow-xl animate-slide-up">
          <span className="text-sm text-text">
            {deleteNotification.count === 1 ? '1 task deleted' : `${deleteNotification.count} tasks deleted`}
          </span>
          <button
            onClick={handleUndoDelete}
            className="text-sm text-accent-blue hover:text-accent-blue/80 font-medium"
          >
            Undo
          </button>
          <button
            onClick={() => {
              if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
              clearDeletedTasks()
              setDeleteNotification(null)
            }}
            className="p-0.5 text-text-secondary hover:text-text"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

export default App
