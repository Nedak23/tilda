import { useEffect, useState } from 'react'
import { useTaskStore } from './stores/taskStore'
import { Sidebar } from './components/Sidebar'
import { TaskList } from './components/TaskList'
import { TaskChat } from './components/TaskChat'
import { TaskModal } from './components/TaskModal'
import { InlineTaskCreate } from './components/InlineTaskCreate'
import { SettingsModal } from './components/SettingsModal'

function App() {
  const {
    currentView,
    activeTaskId,
    examiningTaskId,
    tasks,
    isLoading,
    loadTasks,
    setActiveTask,
    setExaminingTask
  } = useTaskStore()

  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

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
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTaskId, examiningTaskId, isCreatingTask, currentView, setActiveTask, setExaminingTask])

  const activeTask = tasks.find(t => t.id === activeTaskId)
  const examiningTask = tasks.find(t => t.id === examiningTaskId)

  const getViewTitle = () => {
    switch (currentView) {
      case 'today':
        return 'Today'
      case 'upcoming':
        return 'Upcoming'
      case 'archive':
        return 'Logbook'
    }
  }

  const getViewIcon = () => {
    switch (currentView) {
      case 'today':
        return <span className="text-accent text-2xl">★</span>
      case 'upcoming':
        return <span className="text-2xl">📅</span>
      case 'archive':
        return <span className="text-success text-2xl">✓</span>
    }
  }

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <div className="text-text-secondary">Loading...</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex bg-surface overflow-hidden">
      {/* Sidebar */}
      <Sidebar onOpenSettings={() => setIsSettingsOpen(true)} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {activeTask ? (
          <TaskChat
            task={activeTask}
            onBack={() => setActiveTask(null)}
          />
        ) : (
          <>
            {/* Header */}
            <header className="flex-shrink-0">
              {/* Titlebar drag area */}
              <div className="h-12 titlebar-drag" />

              {/* View Header */}
              <div className="flex items-center gap-3 px-6 pb-6">
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

            {/* Bottom toolbar - Things style */}
            {currentView !== 'archive' && (
              <footer className="flex-shrink-0 border-t border-border-light px-4 py-3">
                <div className="flex items-center justify-center gap-8">
                  <button
                    onClick={() => setIsCreatingTask(true)}
                    className="p-2 text-text-secondary hover:text-text transition-colors"
                    title="New To-Do (⌘N)"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button
                    className="p-2 text-text-secondary hover:text-text transition-colors"
                    title="Calendar"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    className="p-2 text-text-secondary hover:text-text transition-colors"
                    title="Move"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                  <button
                    className="p-2 text-text-secondary hover:text-text transition-colors"
                    title="Search"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </div>
              </footer>
            )}
          </>
        )}
      </main>

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
    </div>
  )
}

export default App
