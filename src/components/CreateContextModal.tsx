import { useState } from 'react'

interface CreateContextModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string, description?: string) => void
}

export function CreateContextModal({ isOpen, onClose, onCreate }: CreateContextModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onCreate(name.trim(), description.trim() || undefined)
      setName('')
      setDescription('')
      onClose()
    }
  }

  const handleClose = () => {
    setName('')
    setDescription('')
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
      <div className="relative bg-surface-secondary border border-border-light rounded-lg shadow-xl w-full max-w-md mx-4">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-border-light">
            <h2 className="text-lg font-semibold text-text">Create Context</h2>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            <div>
              <label htmlFor="context-name" className="block text-sm font-medium text-text-secondary mb-1">
                Name
              </label>
              <input
                id="context-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Context name"
                autoFocus
                className="w-full px-3 py-2 bg-surface-tertiary border border-border-light rounded-md text-text placeholder-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label htmlFor="context-description" className="block text-sm font-medium text-text-secondary mb-1">
                Description (optional)
              </label>
              <textarea
                id="context-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this context for?"
                rows={3}
                className="w-full px-3 py-2 bg-surface-tertiary border border-border-light rounded-md text-text placeholder-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent resize-none"
              />
            </div>
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
              disabled={!name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-md hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
