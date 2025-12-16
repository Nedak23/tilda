import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { useTaskStore } from './stores/taskStore'
import { Sidebar } from './components/Sidebar'
import { TaskList } from './components/TaskList'
import { TaskChat } from './components/TaskChat'
import { CreateTaskModal } from './components/CreateTaskModal'

function App() {
  const {
    currentView,
    activeTaskId,
    tasks,
    isLoading,
    loadTasks,
    setActiveTask
  } = useTaskStore()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + N to create new task
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        setIsCreateModalOpen(true)
      }
      // Escape to go back
      if (e.key === 'Escape' && activeTaskId) {
        setActiveTask(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTaskId, setActiveTask])

  const activeTask = tasks.find(t => t.id === activeTaskId)

  const getViewTitle = () => {
    switch (currentView) {
      case 'today':
        return format(new Date(), 'EEEE, MMMM d')
      case 'upcoming':
        return 'Upcoming'
      case 'archive':
        return 'Archive'
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
      <Sidebar />

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
            <header className="flex-shrink-0 border-b border-border-light">
              {/* Titlebar drag area */}
              <div className="h-12 titlebar-drag" />

              {/* View Header */}
              <div className="flex items-center justify-between px-6 pb-4">
                <h1 className="text-2xl font-bold text-text">
                  {currentView === 'today' ? 'Today' : getViewTitle()}
                </h1>

                {currentView !== 'archive' && (
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors titlebar-no-drag"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    New Task
                  </button>
                )}
              </div>

              {currentView === 'today' && (
                <p className="px-6 pb-4 text-sm text-text-secondary">
                  {getViewTitle()}
                </p>
              )}
            </header>

            {/* Task List */}
            <div className="flex-1 overflow-y-auto">
              <TaskList />
            </div>
          </>
        )}
      </main>

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  )
}

export default App
