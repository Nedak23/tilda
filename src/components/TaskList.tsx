import { useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { format, parseISO } from 'date-fns'
import { useTaskStore } from '../stores/taskStore'
import { TaskItem } from './TaskItem'
import { SortableTaskItem } from './SortableTaskItem'
import type { Task } from '../types'

interface TaskListProps {
  onCreateTask?: () => void
  selectedTaskIds: Set<string>
  onTaskClick: (taskId: string, e: React.MouseEvent) => void
  onClearSelection: () => void
  editingTaskId: string | null
  onEditingTaskIdChange: (taskId: string | null) => void
}

interface DateGroup {
  date: string
  label: string
  tasks: Task[]
}

function formatDateLabel(dateStr: string): string {
  const date = parseISO(dateStr)
  return format(date, 'EEEE, MMM d')
}

function groupTasksByDate(tasks: Task[], dateField: 'dateToWorkOn' | 'completionDate'): DateGroup[] {
  const groups: Record<string, Task[]> = {}

  for (const task of tasks) {
    const date = task[dateField]
    if (!date) continue
    const dateKey = date.split('T')[0]
    if (!groups[dateKey]) groups[dateKey] = []
    groups[dateKey].push(task)
  }

  return Object.entries(groups)
    .sort(([a], [b]) => dateField === 'completionDate' ? b.localeCompare(a) : a.localeCompare(b))
    .map(([date, tasks]) => ({
      date,
      label: formatDateLabel(date),
      tasks
    }))
}

export function TaskList({ onCreateTask, selectedTaskIds, onTaskClick, onClearSelection, editingTaskId, onEditingTaskIdChange }: TaskListProps) {
  const {
    currentView,
    setActiveTask,
    getTodayTasks,
    getUpcomingTasks,
    getArchivedTasks,
    completeTask,
    reopenTask,
    reorderTask,
    contexts,
    taskContextsByTask
  } = useTaskStore()

  // Helper to get contexts for a task
  const getTaskContexts = (taskId: string) => {
    const contextIds = taskContextsByTask[taskId] || []
    return contexts.filter(c => contextIds.includes(c.id))
  }

  const todayTasks = getTodayTasks()
  const upcomingGroups = useMemo(
    () => groupTasksByDate(getUpcomingTasks(), 'dateToWorkOn'),
    [getUpcomingTasks()]
  )
  const archiveGroups = useMemo(
    () => groupTasksByDate(getArchivedTasks(), 'completionDate'),
    [getArchivedTasks()]
  )

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = todayTasks.findIndex(t => t.id === active.id)
      const newIndex = todayTasks.findIndex(t => t.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        await reorderTask(active.id as string, newIndex)
      }
    }
  }

  const handleTaskAction = async (task: Task) => {
    if (task.status === 'archived') {
      await reopenTask(task.id)
    } else {
      await completeTask(task.id)
    }
  }

  // Today View - with drag and drop
  if (currentView === 'today') {
    if (todayTasks.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center text-text-tertiary px-4">
          <div className="text-center">
            <p className="text-sm">No tasks for today</p>
            {onCreateTask && (
              <button
                onClick={onCreateTask}
                className="mt-2 text-sm text-accent-blue hover:underline"
              >
                Create a task
              </button>
            )}
          </div>
        </div>
      )
    }

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={todayTasks.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div onClick={onClearSelection}>
            {todayTasks.map(task => (
              <SortableTaskItem
                key={task.id}
                task={task}
                onClick={(e) => onTaskClick(task.id, e)}
                onComplete={() => handleTaskAction(task)}
                isSelected={selectedTaskIds.has(task.id)}
                contexts={getTaskContexts(task.id)}
                isEditing={editingTaskId === task.id}
                onStartEdit={() => onEditingTaskIdChange(task.id)}
                onCloseEdit={() => onEditingTaskIdChange(null)}
                onExpandChat={() => setActiveTask(task.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    )
  }

  // Upcoming View - grouped by date
  if (currentView === 'upcoming') {
    if (upcomingGroups.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center text-text-tertiary px-4">
          <div className="text-center">
            <p className="text-sm">No upcoming tasks</p>
            {onCreateTask && (
              <button
                onClick={onCreateTask}
                className="mt-2 text-sm text-accent-blue hover:underline"
              >
                Schedule a task
              </button>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-4" onClick={onClearSelection}>
        {upcomingGroups.map(group => (
          <div key={group.date}>
            <h3 className="text-xs font-medium text-text-secondary px-4 mb-1">
              {group.label}
            </h3>
            <div>
              {group.tasks.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onClick={(e) => onTaskClick(task.id, e)}
                  onComplete={() => handleTaskAction(task)}
                  isSelected={selectedTaskIds.has(task.id)}
                  contexts={getTaskContexts(task.id)}
                  isEditing={editingTaskId === task.id}
                  onStartEdit={() => onEditingTaskIdChange(task.id)}
                  onCloseEdit={() => onEditingTaskIdChange(null)}
                  onExpandChat={() => setActiveTask(task.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Archive View - grouped by completion date
  if (archiveGroups.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-tertiary px-4">
        <div className="text-center">
          <p className="text-sm">No completed tasks yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4" onClick={onClearSelection}>
      {archiveGroups.map(group => (
        <div key={group.date}>
          <h3 className="text-xs font-medium text-text-secondary px-4 mb-1">
            {group.label}
          </h3>
          <div>
            {group.tasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                onClick={(e) => onTaskClick(task.id, e)}
                onComplete={() => handleTaskAction(task)}
                isSelected={selectedTaskIds.has(task.id)}
                showCompletionDate
                contexts={getTaskContexts(task.id)}
                isEditing={editingTaskId === task.id}
                onStartEdit={() => onEditingTaskIdChange(task.id)}
                onCloseEdit={() => onEditingTaskIdChange(null)}
                onExpandChat={() => setActiveTask(task.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
