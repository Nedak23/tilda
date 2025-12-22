import { useEffect, useState } from 'react'
import { useTaskStore } from './stores/taskStore'
import { Sidebar } from './components/Sidebar'
import { TaskList } from './components/TaskList'
import { TaskChat } from './components/TaskChat'
import { TaskModal } from './components/TaskModal'
import { InlineTaskCreate } from './components/InlineTaskCreate'
import { SettingsModal } from './components/SettingsModal'
import { TildaToggleButton } from './components/TildaToggleButton'
import { TildaSidebar } from './components/TildaSidebar'

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
  const [isTildaOpen, setIsTildaOpen] = useState(false)

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
        if (isTildaOpen) {
          setIsTildaOpen(false)
        } else if (isCreatingTask) {
          setIsCreatingTask(false)
        } else if (activeTaskId) {
          setActiveTask(null)
        } else if (examiningTaskId) {
          setExaminingTask(null)
        }
      }
      // Cmd/Ctrl + Shift + T to toggle Tilda
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 't') {
        e.preventDefault()
        setIsTildaOpen(!isTildaOpen)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTaskId, examiningTaskId, isCreatingTask, currentView, setActiveTask, setExaminingTask, isTildaOpen])

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
      <main className="flex-1 flex flex-col min-w-0 relative">
        {activeTask ? (
          <TaskChat
            task={activeTask}
            onBack={() => setActiveTask(null)}
          />
        ) : (
          <>
            {/* Header */}
            <header className="flex-shrink-0 relative">
              {/* Titlebar drag area */}
              <div className="h-12 titlebar-drag" />

              {/* Tilda Toggle Button */}
              <TildaToggleButton
                isOpen={isTildaOpen}
                onToggle={() => setIsTildaOpen(!isTildaOpen)}
              />

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

      {/* Tilda Sidebar */}
      <TildaSidebar
        isOpen={isTildaOpen}
        onClose={() => setIsTildaOpen(false)}
      />
    </div>
  )
}

export default App
