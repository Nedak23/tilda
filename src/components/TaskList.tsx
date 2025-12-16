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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { format, isToday, isTomorrow, parseISO } from 'date-fns'
import { useTaskStore } from '../stores/taskStore'
import { TaskItem } from './TaskItem'
import { SortableTaskItem } from './SortableTaskItem'
import type { Task } from '../types'

interface DateGroup {
  date: string
  label: string
  tasks: Task[]
}

function formatDateLabel(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
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

export function TaskList() {
  const {
    currentView,
    activeTaskId,
    setActiveTask,
    getTodayTasks,
    getUpcomingTasks,
    getArchivedTasks,
    completeTask,
    reopenTask,
    reorderTask
  } = useTaskStore()

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
        <div className="flex-1 flex items-center justify-center text-text-tertiary">
          <div className="text-center">
            <p className="text-lg mb-1">No tasks for today</p>
            <p className="text-sm">Create a new task to get started</p>
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
          <div className="divide-y divide-border-light">
            {todayTasks.map(task => (
              <SortableTaskItem
                key={task.id}
                task={task}
                onSelect={() => setActiveTask(task.id)}
                onComplete={() => handleTaskAction(task)}
                isSelected={activeTaskId === task.id}
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
        <div className="flex-1 flex items-center justify-center text-text-tertiary">
          <div className="text-center">
            <p className="text-lg mb-1">No upcoming tasks</p>
            <p className="text-sm">Tasks scheduled for future dates will appear here</p>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {upcomingGroups.map(group => (
          <div key={group.date}>
            <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wide px-4 mb-2">
              {group.label}
            </h3>
            <div className="divide-y divide-border-light">
              {group.tasks.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onSelect={() => setActiveTask(task.id)}
                  onComplete={() => handleTaskAction(task)}
                  isSelected={activeTaskId === task.id}
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
      <div className="flex-1 flex items-center justify-center text-text-tertiary">
        <div className="text-center">
          <p className="text-lg mb-1">No completed tasks</p>
          <p className="text-sm">Completed tasks will appear here</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {archiveGroups.map(group => (
        <div key={group.date}>
          <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wide px-4 mb-2">
            {group.label}
          </h3>
          <div className="divide-y divide-border-light">
            {group.tasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                onSelect={() => setActiveTask(task.id)}
                onComplete={() => handleTaskAction(task)}
                isSelected={activeTaskId === task.id}
                showCompletionDate
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
