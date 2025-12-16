import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TaskItem } from './TaskItem'
import type { Task } from '../types'

interface SortableTaskItemProps {
  task: Task
  onSelect: () => void
  onComplete: () => void
  isSelected?: boolean
}

export function SortableTaskItem({
  task,
  onSelect,
  onComplete,
  isSelected
}: SortableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={isDragging ? 'bg-surface shadow-elevated rounded-lg' : ''}
    >
      <TaskItem
        task={task}
        onSelect={onSelect}
        onComplete={onComplete}
        isSelected={isSelected}
      />
    </div>
  )
}
