import { useState, useEffect } from 'react'
import type { AILearningNote, AILearningNoteCategory, UpdateAILearningNoteInput } from '../types'

interface AILearningNoteEditorProps {
  note: AILearningNote | null
  isOpen: boolean
  onClose: () => void
  onSave: (id: string, input: UpdateAILearningNoteInput) => void
}

const CATEGORY_OPTIONS: { value: AILearningNoteCategory; label: string }[] = [
  { value: 'preference', label: 'Preference' },
  { value: 'domain_knowledge', label: 'Domain Knowledge' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'technical_decision', label: 'Technical Decision' }
]

export function AILearningNoteEditor({ note, isOpen, onClose, onSave }: AILearningNoteEditorProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<AILearningNoteCategory>('domain_knowledge')

  // Reset form when note changes
  useEffect(() => {
    if (note) {
      setTitle(note.title)
      setContent(note.content)
      setCategory(note.category)
    }
  }, [note])

  if (!isOpen || !note) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim() && content.trim()) {
      onSave(note.id, {
        title: title.trim(),
        content: content.trim(),
        category
      })
      onClose()
    }
  }

  const handleClose = () => {
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-surface-secondary border border-border-light rounded-lg shadow-xl w-full max-w-lg mx-4">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-border-light flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <h2 className="text-lg font-semibold text-text">Edit AI Learning Note</h2>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            <div>
              <label htmlFor="note-title" className="block text-sm font-medium text-text-secondary mb-1">
                Title
              </label>
              <input
                id="note-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title"
                autoFocus
                className="w-full px-3 py-2 bg-surface-tertiary border border-border-light rounded-md text-text placeholder-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label htmlFor="note-category" className="block text-sm font-medium text-text-secondary mb-1">
                Category
              </label>
              <select
                id="note-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as AILearningNoteCategory)}
                className="w-full px-3 py-2 bg-surface-tertiary border border-border-light rounded-md text-text focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {CATEGORY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="note-content" className="block text-sm font-medium text-text-secondary mb-1">
                Content
              </label>
              <textarea
                id="note-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Note content"
                rows={6}
                className="w-full px-3 py-2 bg-surface-tertiary border border-border-light rounded-md text-text placeholder-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent resize-none"
              />
            </div>

            {note.sourceTaskName && (
              <p className="text-xs text-text-secondary/60">
                Originally created from task: {note.sourceTaskName}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border-light flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text rounded-md hover:bg-surface-tertiary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !content.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-md hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
