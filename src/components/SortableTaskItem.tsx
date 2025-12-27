import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TaskItem } from './TaskItem'
import type { Task, Context } from '../types'

interface SortableTaskItemProps {
  task: Task
  onSelect?: () => void
  onClick: (e: React.MouseEvent) => void
  onComplete: () => void
  isSelected?: boolean
  showCompletionDate?: boolean
  showDate?: boolean
  contexts?: Context[]
  isEditing?: boolean
  onStartEdit?: () => void
  onCloseEdit?: () => void
  onExpandChat?: () => void
}

export function SortableTaskItem({
  task,
  onSelect,
  onClick,
  onComplete,
  isSelected,
  showCompletionDate,
  showDate,
  contexts,
  isEditing,
  onStartEdit,
  onCloseEdit,
  onExpandChat
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
        isSelected={isSelected}
        showCompletionDate={showCompletionDate}
        showDate={showDate}
        contexts={contexts}
        isEditing={isEditing}
        onStartEdit={onStartEdit}
        onCloseEdit={onCloseEdit}
        onExpandChat={onExpandChat}
      />
    </div>
  )
}
