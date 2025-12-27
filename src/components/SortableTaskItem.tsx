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

  // Intercept pointer down to prevent dnd-kit from capturing when modifier keys are pressed
  const handlePointerDown = (e: React.PointerEvent) => {
    // When shift/cmd/ctrl is pressed, don't let dnd-kit handle the event at all
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      // Don't call dnd-kit's handler - let the event propagate naturally to onClick
      return
    }
    // Otherwise, call dnd-kit's handler
    listeners?.onPointerDown?.(e)
  }

  // Spread listeners but override onPointerDown with our custom handler
  const { onPointerDown: _originalPointerDown, ...restListeners } = listeners || {}

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...restListeners}
      onPointerDown={handlePointerDown}
      tabIndex={-1}
      className="outline-none"
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
