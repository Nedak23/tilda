import { useState } from 'react'
import type { AILearningNote, AILearningNoteCategory } from '../types'

interface AILearningNotesListProps {
  notes: AILearningNote[]
  onEdit: (note: AILearningNote) => void
  onDelete: (id: string) => void
}

function getCategoryIcon(category: AILearningNoteCategory): string {
  switch (category) {
    case 'preference':
      return '💡'
    case 'domain_knowledge':
      return '📚'
    case 'workflow':
      return '🔄'
    case 'technical_decision':
      return '⚙️'
    default:
      return '📝'
  }
}

function getCategoryLabel(category: AILearningNoteCategory): string {
  switch (category) {
    case 'preference':
      return 'Preference'
    case 'domain_knowledge':
      return 'Domain'
    case 'workflow':
      return 'Workflow'
    case 'technical_decision':
      return 'Technical'
    default:
      return category
  }
}

function getCategoryColor(category: AILearningNoteCategory): string {
  switch (category) {
    case 'preference':
      return 'bg-yellow-500/20 text-yellow-400'
    case 'domain_knowledge':
      return 'bg-blue-500/20 text-blue-400'
    case 'workflow':
      return 'bg-green-500/20 text-green-400'
    case 'technical_decision':
      return 'bg-purple-500/20 text-purple-400'
    default:
      return 'bg-gray-500/20 text-gray-400'
  }
}

export function AILearningNotesList({ notes, onEdit, onDelete }: AILearningNotesListProps) {
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)

  if (notes.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <h3 className="text-sm font-medium text-text-secondary">AI Learning Notes</h3>
        </div>
        <p className="text-xs text-text-secondary/70 italic py-2">
          The AI will automatically save useful information here when you complete tasks in this context.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-base">🤖</span>
        <h3 className="text-sm font-medium text-text-secondary">
          AI Learning Notes ({notes.length})
        </h3>
      </div>

      <ul className="space-y-2">
        {notes.map(note => {
          const isExpanded = expandedNoteId === note.id

          return (
            <li
              key={note.id}
              className="bg-surface-tertiary/50 rounded-lg overflow-hidden"
            >
              {/* Header - always visible */}
              <div
                className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-surface-tertiary/70 transition-colors group"
                onClick={() => setExpandedNoteId(isExpanded ? null : note.id)}
              >
                <span className="text-sm mt-0.5">{getCategoryIcon(note.category)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text truncate">
                      {note.title}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getCategoryColor(note.category)}`}>
                      {getCategoryLabel(note.category)}
                    </span>
                  </div>
                  {!isExpanded && (
                    <p className="text-xs text-text-secondary/80 truncate mt-0.5">
                      {note.content}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(note)
                    }}
                    className="p-1 text-text-secondary hover:text-text"
                    title="Edit note"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(note.id)
                    }}
                    className="p-1 text-text-secondary hover:text-red-400"
                    title="Delete note"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <svg
                  className={`w-4 h-4 text-text-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-border-light/30">
                  <p className="text-sm text-text/90 whitespace-pre-wrap mt-2">
                    {note.content}
                  </p>
                  {note.sourceTaskName && (
                    <p className="text-xs text-text-secondary/60 mt-2">
                      From task: {note.sourceTaskName}
                    </p>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
