import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TaskItem } from './TaskItem'
import type { Task, Context } from '../types'

interface SortableTaskItemProps {
  task: Task
  onSelect: () => void
  onClick: (e: React.MouseEvent) => void
  onComplete: () => void
  onOpenChat?: () => void
  onDateChange?: (date: string) => void
  isSelected?: boolean
  showCompletionDate?: boolean
  showDate?: boolean
  contexts?: Context[]
}

export function SortableTaskItem({
  task,
  onSelect,
  onClick,
  onComplete,
  onOpenChat,
  onDateChange,
  isSelected,
  showCompletionDate,
  showDate,
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
        onClick={onClick}
        onComplete={onComplete}
        onOpenChat={onOpenChat}
        onDateChange={onDateChange}
        isSelected={isSelected}
        showCompletionDate={showCompletionDate}
        showDate={showDate}
        contexts={contexts}
      />
    </div>
  )
}
