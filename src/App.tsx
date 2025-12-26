import { useEffect, useState } from 'react'
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
    taskContextsByTask
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
      // Escape to go back or cancel creation
      if (e.key === 'Escape') {
        if (isCreatingTask) {
          setIsCreatingTask(false)
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
  }, [activeTaskId, examiningTaskId, isCreatingTask, currentView, setActiveTask, setExaminingTask, toggleTilda, toggleNav])

  const activeTask = tasks.find(t => t.id === activeTaskId)
  const examiningTask = tasks.find(t => t.id === examiningTaskId)

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
          <div className="flex-1 overflow-y-auto">
            <TaskList onCreateTask={() => setIsCreatingTask(true)} />
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
