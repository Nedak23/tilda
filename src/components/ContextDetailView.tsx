import { useState, useEffect } from 'react'
import { useTaskStore } from '../stores/taskStore'
import { ContextDocumentList } from './ContextDocumentList'
import { AILearningNotesList } from './AILearningNotesList'
import { AILearningNoteEditor } from './AILearningNoteEditor'
import { TaskItem } from './TaskItem'
import { GENERAL_CONTEXT_ID } from '../types'
import type { Task, AILearningNote } from '../types'

interface ContextDetailViewProps {
  contextId: string
  onTaskSelect: (task: Task) => void
  onTaskComplete: (id: string) => void
}

export function ContextDetailView({ contextId, onTaskSelect, onTaskComplete }: ContextDetailViewProps) {
  const {
    contexts,
    tasks,
    taskContextsByTask,
    contextDocumentsByContext,
    aiNotesByContext,
    updateContext,
    updateTask,
    loadContextDocuments,
    addContextDocument,
    removeContextDocument,
    loadTaskContexts,
    loadAINotes,
    updateAINote,
    deleteAINote
  } = useTaskStore()

  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [editingNote, setEditingNote] = useState<AILearningNote | null>(null)

  const context = contexts.find(c => c.id === contextId)
  const documents = contextDocumentsByContext[contextId] || []
  const aiNotes = aiNotesByContext[contextId] || []

  // Load context documents and AI notes on mount
  useEffect(() => {
    loadContextDocuments(contextId)
    loadAINotes(contextId)
  }, [contextId, loadContextDocuments, loadAINotes])

  // Load task contexts for all tasks in this context
  useEffect(() => {
    tasks.forEach(task => {
      if (!taskContextsByTask[task.id]) {
        loadTaskContexts(task.id)
      }
    })
  }, [tasks, taskContextsByTask, loadTaskContexts])

  // Get tasks that belong to this context (excluding archived)
  const contextTasks = tasks.filter(task => {
    if (task.status === 'archived') return false
    const contexts = taskContextsByTask[task.id] || []
    return contexts.includes(contextId)
  }).sort((a, b) => {
    // Sort by date, then by sort position
    const dateCompare = a.dateToWorkOn.localeCompare(b.dateToWorkOn)
    if (dateCompare !== 0) return dateCompare
    return a.sortPosition - b.sortPosition
  })

  if (!context) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-secondary">
        Context not found
      </div>
    )
  }

  const handleStartEditDescription = () => {
    setDescriptionDraft(context.description || '')
    setIsEditingDescription(true)
  }

  const handleSaveDescription = async () => {
    try {
      await updateContext(contextId, { description: descriptionDraft || undefined })
      setIsEditingDescription(false)
    } catch (error) {
      console.error('Failed to update description:', error)
    }
  }

  const handleUploadDocument = async (file: File) => {
    try {
      await addContextDocument(contextId, file)
    } catch (error) {
      console.error('Failed to upload document:', error)
    }
  }

  const handleDeleteDocument = async (id: string) => {
    try {
      await removeContextDocument(id, contextId)
    } catch (error) {
      console.error('Failed to delete document:', error)
    }
  }

  const handleEditAINote = (note: AILearningNote) => {
    setEditingNote(note)
  }

  const handleSaveAINote = async (id: string, input: Parameters<typeof updateAINote>[2]) => {
    try {
      await updateAINote(id, contextId, input)
    } catch (error) {
      console.error('Failed to update AI note:', error)
    }
  }

  const handleDeleteAINote = async (id: string) => {
    try {
      await deleteAINote(id, contextId)
    } catch (error) {
      console.error('Failed to delete AI note:', error)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border-light">
        <div className="flex items-center gap-3">
          <span className="text-2xl text-text-secondary">#</span>
          <h1 className="text-xl font-semibold text-text">{context.name}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-4 space-y-6">
          {/* Description section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-text-secondary">Description</h2>
              {!isEditingDescription && (
                <button
                  onClick={handleStartEditDescription}
                  className="text-xs text-text-secondary hover:text-text"
                >
                  Edit
                </button>
              )}
            </div>
            {isEditingDescription ? (
              <div className="space-y-2">
                <textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  placeholder="What is this context for?"
                  className="w-full px-3 py-2 bg-surface-tertiary border border-border-light rounded-md text-text placeholder-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveDescription}
                    className="px-3 py-1 text-sm bg-accent text-white rounded hover:bg-accent/90"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditingDescription(false)}
                    className="px-3 py-1 text-sm text-text-secondary hover:text-text"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-secondary/80">
                {context.description || 'No description'}
              </p>
            )}
          </div>

          {/* Documents section */}
          <ContextDocumentList
            documents={documents}
            onUpload={handleUploadDocument}
            onDelete={handleDeleteDocument}
          />

          {/* AI Learning Notes section */}
          <AILearningNotesList
            notes={aiNotes}
            onEdit={handleEditAINote}
            onDelete={handleDeleteAINote}
          />

          {/* Tasks section - hidden for General context since it applies to all tasks */}
          {contextId !== GENERAL_CONTEXT_ID && (
            <div>
              <h2 className="text-sm font-medium text-text-secondary mb-2">
                Tasks ({contextTasks.length})
              </h2>
              {contextTasks.length === 0 ? (
                <p className="text-sm text-text-secondary/70 italic py-2">
                  No tasks in this context
                </p>
              ) : (
                <div className="space-y-1">
                  {contextTasks.map(task => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onComplete={() => onTaskComplete(task.id)}
                      onSelect={() => onTaskSelect(task)}
                      onClick={() => onTaskSelect(task)}
                      onDateChange={(date) => updateTask(task.id, { dateToWorkOn: date })}
                      showDate
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Note Editor Modal */}
      <AILearningNoteEditor
        note={editingNote}
        isOpen={editingNote !== null}
        onClose={() => setEditingNote(null)}
        onSave={handleSaveAINote}
      />
    </div>
  )
}
