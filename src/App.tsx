import { useEffect, useState, useCallback, useRef } from 'react'
import { useTaskStore } from './stores/taskStore'
import { Sidebar } from './components/Sidebar'
import { TaskList } from './components/TaskList'
import { TaskChat } from './components/TaskChat'
import { TaskModal } from './components/TaskModal'
import { InlineTaskCreate } from './components/InlineTaskCreate'
import { SettingsModal } from './components/SettingsModal'
import { TildaSidebar } from './components/TildaSidebar'
import { ContextDetailView } from './components/ContextDetailView'
import { PanelLayout } from './components/PanelLayout'
import { ControlBar } from './components/ControlBar'
import { useLayoutState } from './hooks/useLayoutState'
import type { AILearningNote } from './types'

function App() {
  const {
    currentView,
    activeTaskId,
    examiningTaskId,
    tasks,
    isLoading,
    loadTasks,
    loadContexts,
    completeTask,
    setActiveTask,
    setExaminingTask,
    contexts,
    loadTaskContexts,
    taskContextsByTask,
    updateTask
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
  const [notification, setNotification] = useState<{ message: string; contextId: string } | null>(null)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const lastSelectedTaskId = useRef<string | null>(null)
  const datePickerRef = useRef<HTMLDivElement>(null)

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

  // Load task contexts for all tasks
  useEffect(() => {
    tasks.forEach(task => {
      if (!taskContextsByTask[task.id]) {
        loadTaskContexts(task.id)
      }
    })
  }, [tasks, taskContextsByTask, loadTaskContexts])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + N to create new task
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        if (!activeTaskId && currentView !== 'archive') {
          setIsCreatingTask(true)
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
        } else if (examiningTaskId) {
          setExaminingTask(null)
        }
      }
      // Cmd/Ctrl + B to toggle Tilda (left sidebar)
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key === 'b') {
        e.preventDefault()
        toggleTilda()
      }
      // Cmd/Ctrl + Option/Alt + B to toggle Navigation (right sidebar)
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key === 'b') {
        e.preventDefault()
        toggleNav()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTaskId, examiningTaskId, isCreatingTask, currentView, selectedTaskIds.size, setActiveTask, setExaminingTask, toggleTilda, toggleNav])

  const activeTask = tasks.find(t => t.id === activeTaskId)
  const examiningTask = tasks.find(t => t.id === examiningTaskId)

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
      // Regular click on already-selected task: open detail view
      if (selectedTaskIds.has(taskId) && selectedTaskIds.size === 1) {
        setExaminingTask(taskId)
        setSelectedTaskIds(new Set())
      } else {
        // Regular click: select only this task
        setSelectedTaskIds(new Set([taskId]))
        lastSelectedTaskId.current = taskId
      }
    }
  }, [getVisibleTasks, selectedTaskIds, setExaminingTask])

  // Clear selection when clicking empty space
  const handleClearSelection = useCallback(() => {
    setSelectedTaskIds(new Set())
  }, [])

  // Handle date change for selected tasks
  const handleBulkDateChange = useCallback(async (date: string) => {
    try {
      await Promise.all(
        Array.from(selectedTaskIds).map(taskId =>
          updateTask(taskId, { dateToWorkOn: date })
        )
      )
    } catch (error) {
      console.error('Failed to update some tasks:', error)
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
        return 'Today'
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
    switch (currentView) {
      case 'today':
        return <span className="text-accent text-2xl">★</span>
      case 'upcoming':
        return <span className="text-2xl">📅</span>
      case 'archive':
        return <span className="text-success text-2xl">✓</span>
      default:
        return null
    }
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
            contextId={currentContextId}
            onTaskSelect={(task) => setExaminingTask(task.id)}
            onTaskComplete={(id) => completeTask(id)}
          />
        </>
      ) : (
        <>
          {/* Header */}
          <header className="flex-shrink-0 relative">
            {/* View Header */}
            <div className="flex items-center gap-3 px-6 py-4">
              {getViewIcon()}
              <h1 className="text-2xl font-bold text-text">
                {getViewTitle()}
              </h1>
            </div>
          </header>

          {/* Inline task creation */}
          {isCreatingTask && (
            <InlineTaskCreate
              onClose={() => setIsCreatingTask(false)}
            />
          )}

          {/* Task List */}
          <div className="flex-1 overflow-y-auto" onClick={handleClearSelection}>
            <TaskList
              onCreateTask={() => setIsCreatingTask(true)}
              selectedTaskIds={selectedTaskIds}
              onTaskClick={handleTaskClick}
              onClearSelection={handleClearSelection}
            />
          </div>

          {/* Bottom Action Bar */}
          <div className="flex-shrink-0 border-t border-border-light bg-surface">
            <div className="flex items-center justify-center gap-8 py-3">
              {/* New Task Button */}
              <button
                onClick={() => setIsCreatingTask(true)}
                className={`p-2 transition-colors ${
                  currentView === 'archive'
                    ? 'text-text-tertiary opacity-50 cursor-not-allowed'
                    : 'text-text-tertiary hover:text-text'
                }`}
                title={currentView === 'archive' ? 'Cannot create tasks in archive' : 'New task (⌘N)'}
                disabled={currentView === 'archive'}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>

              {/* Assign Date Button - hidden in archive view */}
              {currentView !== 'archive' && (
                <div className="relative" ref={datePickerRef}>
                  <button
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className={`p-2 transition-colors ${
                      selectedTaskIds.size === 0
                        ? 'text-text-tertiary opacity-50 cursor-not-allowed'
                        : 'text-text-tertiary hover:text-text'
                    }`}
                    title="Assign to date"
                    disabled={selectedTaskIds.size === 0}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                  {showDatePicker && selectedTaskIds.size > 0 && (
                    <div
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-surface-secondary border border-border rounded-lg shadow-elevated p-2"
                      onClick={e => e.stopPropagation()}
                    >
                      <input
                        type="date"
                        onChange={(e) => handleBulkDateChange(e.target.value)}
                        className="bg-surface-tertiary text-text text-sm rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent-blue"
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
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main layout with resizable panels */}
      <div className="flex-1 min-h-0 flex">
        <PanelLayout
          leftPanel={
            <TildaSidebar isOpen={!isTildaCollapsed} />
          }
          centerPanel={mainContent}
          rightPanel={
            <Sidebar />
          }
          isLeftCollapsed={isTildaCollapsed}
          isRightCollapsed={isNavCollapsed}
          onLeftCollapseChange={setTildaCollapsed}
          onRightCollapseChange={setNavCollapsed}
          leftSize={tildaSize}
          rightSize={navSize}
          onLeftSizeChange={setTildaSize}
          onRightSizeChange={setNavSize}
        />
      </div>

      {/* Task Modal */}
      {examiningTask && (
        <TaskModal
          task={examiningTask}
          onClose={() => setExaminingTask(null)}
          onExpandChat={() => setActiveTask(examiningTask.id)}
        />
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}

      {/* AI Note Saved Notification */}
      {notification && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-surface-secondary border border-border-light rounded-lg shadow-xl animate-slide-up">
          <span className="text-lg">🤖</span>
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
    </div>
  )
}

export default App
