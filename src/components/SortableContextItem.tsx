import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ContextSidebarItem } from './ContextSidebarItem'
import type { Context } from '../types'

interface SortableContextItemProps {
  context: Context
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  onRename: (newName: string) => void
}

export function SortableContextItem({
  context,
  isActive,
  onSelect,
  onDelete,
  onRename
}: SortableContextItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: context.id })

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
      <ContextSidebarItem
        context={context}
        isActive={isActive}
        onSelect={onSelect}
        onDelete={onDelete}
        onRename={onRename}
      />
    </div>
  )
}
