import { useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import { useTaskStore } from '../stores/taskStore'
import { ContextDocumentList } from './ContextDocumentList'
import { AILearningNotesList } from './AILearningNotesList'
import { AILearningNoteEditor } from './AILearningNoteEditor'
import { TaskItem } from './TaskItem'
import { InlineTaskEdit } from './InlineTaskEdit'
import { logger } from '../utils/logger'
import { GENERAL_CONTEXT_ID } from '../types'
import type { Task, AILearningNote } from '../types'

interface ContextDetailViewProps {
  contextId: string
  onTaskSelect: (task: Task) => void
  onTaskComplete: (id: string) => void
  selectedTaskIds?: Set<string>
  onTaskClick?: (taskId: string, e: React.MouseEvent) => void
}

export interface ContextDetailViewRef {
  startCreatingTask: () => void
}

export const ContextDetailView = forwardRef<ContextDetailViewRef, ContextDetailViewProps>(
  function ContextDetailView({ contextId, onTaskSelect, onTaskComplete, selectedTaskIds, onTaskClick }, ref) {
  const {
    contexts,
    tasks,
    contextDocumentsByContext,
    aiNotesByContext,
    updateContext,
    loadContextDocuments,
    addContextDocument,
    removeContextDocument,
    loadAINotes,
    updateAINote,
    deleteAINote,
    startWorking
  } = useTaskStore()

  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [editingNote, setEditingNote] = useState<AILearningNote | null>(null)
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [isCreatingTask, setIsCreatingTask] = useState(false)

  // Expose startCreatingTask to parent via ref
  useImperativeHandle(ref, () => ({
    startCreatingTask: () => setIsCreatingTask(true)
  }), [])

  const context = contexts.find(c => c.id === contextId)
  const documents = contextDocumentsByContext[contextId] || []
  const aiNotes = aiNotesByContext[contextId] || []

  // Load context documents and AI notes on mount
  useEffect(() => {
    loadContextDocuments(contextId)
    loadAINotes(contextId)
  }, [contextId, loadContextDocuments, loadAINotes])

  // Get tasks that belong to this context (excluding archived)
  const contextTasks = tasks.filter(task => {
    if (task.status === 'archived') return false
    return task.contextId === contextId
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
      logger.error('Failed to update description:', error)
    }
  }

  const handleStartEditName = () => {
    setNameDraft(context?.name || '')
    setIsEditingName(true)
  }

  const handleSaveName = async () => {
    if (nameDraft.trim() && nameDraft.trim() !== context?.name) {
      try {
        await updateContext(contextId, { name: nameDraft.trim() })
      } catch (error) {
        logger.error('Failed to update name:', error)
      }
    }
    setIsEditingName(false)
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveName()
    } else if (e.key === 'Escape') {
      setIsEditingName(false)
    }
  }

  const handleUploadDocument = async (file: File) => {
    try {
      await addContextDocument(contextId, file)
    } catch (error) {
      logger.error('Failed to upload document:', error)
    }
  }

  const handleDeleteDocument = async (id: string) => {
    try {
      await removeContextDocument(id, contextId)
    } catch (error) {
      logger.error('Failed to delete document:', error)
    }
  }

  const handleEditAINote = (note: AILearningNote) => {
    setEditingNote(note)
  }

  const handleSaveAINote = async (id: string, input: Parameters<typeof updateAINote>[2]) => {
    try {
      await updateAINote(id, contextId, input)
    } catch (error) {
      logger.error('Failed to update AI note:', error)
    }
  }

  const handleDeleteAINote = async (id: string) => {
    try {
      await deleteAINote(id, contextId)
    } catch (error) {
      logger.error('Failed to delete AI note:', error)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border-light">
        <div className="flex items-center gap-3 group">
          <span className="text-2xl text-text-secondary">#</span>
          {isEditingName ? (
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={handleNameKeyDown}
              onBlur={handleSaveName}
              autoFocus
              className="text-xl font-semibold text-text bg-surface-tertiary border border-border-light rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-border-selected focus:border-border-selected"
            />
          ) : (
            <>
              <h1 className="text-xl font-semibold text-text">{context.name}</h1>
              {contextId !== GENERAL_CONTEXT_ID && (
                <button
                  onClick={handleStartEditName}
                  className="p-1 text-text-secondary hover:text-text opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Rename context"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                </button>
              )}
            </>
          )}
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
                  className="w-full px-3 py-2 bg-surface-tertiary border border-border-light rounded-md text-text placeholder-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-border-selected focus:border-border-selected resize-none"
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
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-medium text-text-secondary">
                  Tasks ({contextTasks.length})
                </h2>
                {!isCreatingTask && (
                  <button
                    onClick={() => setIsCreatingTask(true)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-text hover:bg-surface-tertiary rounded transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add task
                  </button>
                )}
              </div>

              {/* Inline task creation */}
              {isCreatingTask && (
                <InlineTaskEdit
                  onClose={() => setIsCreatingTask(false)}
                  defaultContextId={contextId}
                />
              )}

              {contextTasks.length === 0 && !isCreatingTask ? (
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
                      onClick={(e) => onTaskClick ? onTaskClick(task.id, e) : onTaskSelect(task)}
                      isSelected={selectedTaskIds?.has(task.id)}
                      showDate
                      onStartWorking={() => startWorking(task.id)}
                      showStartWorking
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
})
