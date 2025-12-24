import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TaskItem } from './TaskItem'
import type { Task, Context } from '../types'

interface SortableTaskItemProps {
  task: Task
  onSelect: () => void
  onComplete: () => void
  onOpenChat?: () => void
  onDateChange?: (date: string) => void
  isSelected?: boolean
  contexts?: Context[]
}

export function SortableTaskItem({
  task,
  onSelect,
  onComplete,
  onOpenChat,
  onDateChange,
  isSelected,
  contexts
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
    >
      <TaskItem
        task={task}
        onSelect={onSelect}
        onComplete={onComplete}
        onOpenChat={onOpenChat}
        onDateChange={onDateChange}
        isSelected={isSelected}
        contexts={contexts}
      />
    </div>
  )
}
