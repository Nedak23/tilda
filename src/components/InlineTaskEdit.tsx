import { useState, useRef, useEffect } from 'react'
import { format, parseISO, isValid } from 'date-fns'
import { useTaskStore } from '../stores/taskStore'
import { CalendarPicker } from './CalendarPicker'
import { isFileSupported, FILE_INPUT_ACCEPT } from '../utils/fileUtils'
import { logger } from '../utils/logger'
import { GENERAL_CONTEXT_ID } from '../types'
import type { Task, RecurrenceRule } from '../types'

interface InlineTaskEditProps {
  task?: Task
  onClose: () => void
  onComplete?: () => void
  defaultDate?: string
  defaultContextId?: string
  onSaveAndCreateNew?: () => void
  onStartWorking?: () => void
  showStartWorking?: boolean
}

export function InlineTaskEdit({ task, onClose, onComplete, defaultDate, defaultContextId, onSaveAndCreateNew, onStartWorking, showStartWorking = false }: InlineTaskEditProps) {
  const {
    attachmentsByTask,
    updateTask,
    createTask,
    loadAttachments,
    addAttachment,
    addAttachmentFromData,
    removeAttachment,
    contexts,
    setTaskContext
  } = useTaskStore()

  const today = format(new Date(), 'yyyy-MM-dd')
  const isCreateMode = !task

  // For create mode, we track local state until task is created
  const [createdTask, setCreatedTask] = useState<Task | null>(null)
  const activeTask = task || createdTask

  const attachments = activeTask ? (attachmentsByTask[activeTask.id] || []) : []

  const [editedName, setEditedName] = useState(task?.name || '')
  const [editedDescription, setEditedDescription] = useState(task?.description || '')
  const [localDate, setLocalDate] = useState(task?.dateToWorkOn || defaultDate || today)
  const [localDeadline, setLocalDeadline] = useState(task?.deadline || '')
  const [localContextId, setLocalContextId] = useState<string | undefined>(defaultContextId)
  const [localRecurrenceRule, setLocalRecurrenceRule] = useState<RecurrenceRule | undefined>(task?.recurrenceRule)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false)
  const [showContextPicker, setShowContextPicker] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const datePickerRef = useRef<HTMLDivElement>(null)
  const deadlinePickerRef = useRef<HTMLDivElement>(null)
  const contextPickerRef = useRef<HTMLDivElement>(null)
  const attachMenuRef = useRef<HTMLDivElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  // Load attachments when component mounts (edit mode only)
  useEffect(() => {
    if (activeTask && !attachmentsByTask[activeTask.id]) {
      loadAttachments(activeTask.id)
    }
  }, [activeTask?.id, attachmentsByTask, loadAttachments])

  // Get context from task or local state
  const taskContextId = activeTask?.contextId || localContextId

  // Focus name input on mount
  useEffect(() => {
    nameInputRef.current?.focus()
  }, [])

  // Auto-resize description textarea
  const autoResizeDescription = () => {
    const textarea = descriptionRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }

  useEffect(() => {
    autoResizeDescription()
  }, [editedDescription])

  // Handle click outside to close and save
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Don't close when clicking on control bar buttons (sidebar toggles)
        const target = e.target as HTMLElement
        if (target.closest('.titlebar-no-drag')) {
          return
        }
        handleSaveAndClose()
      }
    }

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [editedName, editedDescription, localDate, localDeadline, localContextId, activeTask])

  // Handle escape key and Cmd+N (save before switching to new task)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSaveAndClose()
      }
      // Cmd/Ctrl + N: save current task, then signal to create new one
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        e.stopPropagation()
        await handleSaveAndClose()
        onSaveAndCreateNew?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editedName, editedDescription, localDate, localDeadline, localContextId, activeTask, onSaveAndCreateNew])

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false)
      }
      if (deadlinePickerRef.current && !deadlinePickerRef.current.contains(e.target as Node)) {
        setShowDeadlinePicker(false)
      }
      if (contextPickerRef.current && !contextPickerRef.current.contains(e.target as Node)) {
        setShowContextPicker(false)
      }
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Create task if needed, then return the task
  const ensureTask = async (): Promise<Task | null> => {
    if (activeTask) return activeTask

    if (!editedName.trim()) return null

    try {
      const newTask = await createTask({
        name: editedName.trim(),
        dateToWorkOn: localDate,
        deadline: localDeadline || undefined,
        description: editedDescription.trim() || undefined,
        recurrenceRule: localRecurrenceRule,
        contextId: localContextId
      })
      setCreatedTask(newTask)
      return newTask
    } catch (error) {
      logger.error('Failed to create task:', error)
      return null
    }
  }

  const handleSaveAndClose = async () => {
    if (isCreateMode && !createdTask) {
      // Create mode: create the task if we have a name
      if (editedName.trim()) {
        await ensureTask()
      }
    } else if (activeTask) {
      // Edit mode: save any pending changes
      const updates: Partial<Task> = {}
      if (editedName.trim() && editedName !== activeTask.name) {
        updates.name = editedName.trim()
      }
      if (editedDescription !== (activeTask.description || '')) {
        updates.description = editedDescription.trim() || undefined
      }
      if (Object.keys(updates).length > 0) {
        await updateTask(activeTask.id, updates)
      }
    }
    onClose()
  }

  const handleNameKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isCreateMode && !createdTask && editedName.trim()) {
        await ensureTask()
      }
    }
  }

  const handleNameBlur = async () => {
    if (activeTask && editedName.trim() && editedName !== activeTask.name) {
      await updateTask(activeTask.id, { name: editedName.trim() })
    }
  }

  const handleDescriptionBlur = async () => {
    if (activeTask && editedDescription !== (activeTask.description || '')) {
      await updateTask(activeTask.id, { description: editedDescription.trim() || undefined })
    }
  }

  const handleDateChange = async (newDate: string) => {
    setLocalDate(newDate)
    if (activeTask) {
      await updateTask(activeTask.id, { dateToWorkOn: newDate })
    }
    setShowDatePicker(false)
  }

  const handleDeadlineChange = async (newDeadline: string) => {
    setLocalDeadline(newDeadline)
    if (activeTask) {
      await updateTask(activeTask.id, { deadline: newDeadline || undefined })
    }
    setShowDeadlinePicker(false)
  }

  const handleClearDeadline = async () => {
    setLocalDeadline('')
    if (activeTask) {
      await updateTask(activeTask.id, { deadline: undefined })
    }
    setShowDeadlinePicker(false)
  }

  const handleRecurrenceChange = async (rule: RecurrenceRule | null) => {
    const previousRule = localRecurrenceRule
    setLocalRecurrenceRule(rule || undefined)
    if (activeTask) {
      try {
        await updateTask(activeTask.id, { recurrenceRule: rule })
      } catch (error) {
        logger.error('Failed to update recurrence rule:', error)
        setLocalRecurrenceRule(previousRule)
      }
    }
  }

  const handleSelectContext = async (contextId: string | undefined) => {
    if (activeTask) {
      await setTaskContext(activeTask.id, contextId || null)
    } else {
      // Create mode: update local state
      setLocalContextId(contextId)
    }
  }

  const handleClearContext = async () => {
    if (activeTask) {
      await setTaskContext(activeTask.id, null)
    } else {
      setLocalContextId(undefined)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return

    // Ensure task exists before adding attachments
    const taskToUse = await ensureTask()
    if (!taskToUse) return

    for (const file of files) {
      if (!isFileSupported(file)) {
        logger.warn(`Skipping unsupported file: ${file.name}`)
        continue
      }
      await addAttachment(taskToUse.id, file)
    }

    e.target.value = ''
  }

  const handleDirectorySelect = async () => {
    const files = await window.api.dialog.selectDirectory()
    if (!files) return

    const taskToUse = await ensureTask()
    if (!taskToUse) return

    for (const file of files) {
      await addAttachmentFromData(taskToUse.id, file)
    }
  }

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onComplete && activeTask) {
      onComplete()
    }
  }

  const currentDate = activeTask?.dateToWorkOn || localDate
  const currentDeadline = activeTask?.deadline || localDeadline
  const currentRecurrenceRule = activeTask?.recurrenceRule || localRecurrenceRule
  const isToday = currentDate === today

  const filteredContexts = contexts.filter(c => c.id !== GENERAL_CONTEXT_ID)
  const selectedContext = taskContextId ? filteredContexts.find(c => c.id === taskContextId) : undefined
  const availableContexts = filteredContexts.filter(c => c.id !== taskContextId)

  return (
    <div
      ref={containerRef}
      className="mx-1 my-4 rounded-lg border border-border bg-surface-secondary animate-fade-in"
    >
      {/* Header section with checkbox, name, description */}
      <div className="pl-2 pr-4 pt-4 pb-4">
        <div className="group/edit flex items-start gap-3">
          {/* Start Working button */}
          {showStartWorking && (
            <div className="w-4 flex items-center justify-center flex-shrink-0 mt-0.5">
              {activeTask && activeTask.status !== 'archived' && !activeTask.isStarted && onStartWorking ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onStartWorking()
                  }}
                  className="text-text-tertiary hover:text-accent-blue transition-colors opacity-0 group-hover/edit:opacity-100"
                  title="Start working"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 5v14L5 12z" />
                  </svg>
                </button>
              ) : null}
            </div>
          )}

          {/* Checkbox */}
          {isCreateMode ? (
            <div className="checkbox flex-shrink-0 mt-0.5 opacity-50 cursor-not-allowed" />
          ) : activeTask?.status !== 'archived' ? (
            <button
              onClick={handleCheckboxClick}
              className="checkbox flex-shrink-0 mt-0.5"
              aria-label="Complete task"
            />
          ) : (
            <div className="checkbox checked flex-shrink-0 mt-0.5">
              <svg
                className="w-2.5 h-2.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}

          {/* Name and description */}
          <div className="flex-1 min-w-0">
            <input
              ref={nameInputRef}
              type="text"
              value={editedName}
              onChange={e => setEditedName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              placeholder="Task name"
              className="w-full bg-transparent text-text text-sm font-medium placeholder-text-tertiary focus:outline-none"
            />
            <div className="flex items-start gap-2 mt-1">
              <textarea
                ref={descriptionRef}
                value={editedDescription}
                onChange={e => setEditedDescription(e.target.value)}
                onBlur={handleDescriptionBlur}
                placeholder="Notes"
                rows={1}
                className="flex-1 bg-transparent text-text-secondary text-sm placeholder-text-tertiary focus:outline-none resize-none overflow-hidden"
              />
              <div className="relative flex-shrink-0" ref={attachMenuRef}>
                <button
                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                  className="p-1 text-text-tertiary hover:text-text transition-colors"
                  title="Attach"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
                {showAttachMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-surface-tertiary rounded-lg shadow-elevated p-1 z-20 w-36">
                    <button
                      onClick={() => {
                        fileInputRef.current?.click()
                        setShowAttachMenu(false)
                      }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-text hover:bg-surface rounded transition-colors"
                    >
                      <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      Files
                    </button>
                    <button
                      onClick={() => {
                        handleDirectorySelect()
                        setShowAttachMenu(false)
                      }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-text hover:bg-surface rounded transition-colors"
                    >
                      <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" />
                      </svg>
                      Folder
                    </button>
                  </div>
                )}
              </div>
            </div>
            {/* Attachments display */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {attachments.map(attachment => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-2 px-2 py-1 bg-surface-tertiary rounded text-xs text-text-secondary"
                  >
                    <span className="truncate max-w-[120px]">{attachment.filename}</span>
                    {activeTask && (
                      <button
                        onClick={() => removeAttachment(attachment.id, activeTask.id)}
                        className="text-text-tertiary hover:text-error transition-colors"
                        aria-label="Remove attachment"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Date row with context pills and deadline */}
        <div className={`flex items-center justify-between mt-4 ${showStartWorking ? 'ml-14' : 'ml-7'}`}>
          {/* Left side: Date picker and context pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date picker */}
            <div className="relative" ref={datePickerRef}>
              <button
                onClick={() => {
                  setShowDatePicker(!showDatePicker)
                  setShowDeadlinePicker(false)
                  setShowContextPicker(false)
                }}
                className="flex items-center gap-1.5 text-sm text-text hover:text-accent-blue transition-colors"
              >
                <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <span>{isToday ? 'Today' : format(parseISO(currentDate), 'MMM d')}</span>
                {currentRecurrenceRule && (
                  <span className="text-accent-blue" title="Repeating task">↻</span>
                )}
              </button>
              {showDatePicker && (
                <div className="absolute top-full left-0 mt-2 z-20">
                  <CalendarPicker
                    selectedDate={currentDate}
                    onDateChange={handleDateChange}
                    onClose={() => setShowDatePicker(false)}
                    showQuickOptions={true}
                    recurrenceRule={currentRecurrenceRule}
                    onRecurrenceChange={handleRecurrenceChange}
                  />
                </div>
              )}
            </div>

            {/* Context selector */}
            <div className="relative" ref={contextPickerRef}>
              {selectedContext ? (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-tertiary rounded text-xs text-text-secondary cursor-pointer hover:bg-surface transition-colors"
                  onClick={() => {
                    setShowContextPicker(!showContextPicker)
                    setShowDatePicker(false)
                    setShowDeadlinePicker(false)
                  }}
                >
                  #{selectedContext.name}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleClearContext()
                    }}
                    className="text-text-tertiary hover:text-text transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => {
                    setShowContextPicker(!showContextPicker)
                    setShowDatePicker(false)
                    setShowDeadlinePicker(false)
                  }}
                  className="inline-flex items-center justify-center w-5 h-5 rounded bg-surface-tertiary text-text-tertiary hover:text-text hover:bg-surface transition-colors"
                  title="Add context"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
              {showContextPicker && (
                <div className="absolute top-full left-0 mt-2 bg-surface-tertiary rounded-lg shadow-elevated p-2 z-20 w-48 max-h-40 overflow-y-auto">
                  {availableContexts.length === 0 ? (
                    <p className="text-xs text-text-tertiary italic px-2 py-1">
                      {filteredContexts.length === 0 ? 'No contexts' : 'No other contexts'}
                    </p>
                  ) : (
                    availableContexts.map(context => (
                      <button
                        key={context.id}
                        onClick={() => {
                          handleSelectContext(context.id)
                          setShowContextPicker(false)
                        }}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-surface text-sm text-text transition-colors"
                      >
                        #{context.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right side: Deadline and expand button */}
          <div className="flex items-center gap-2">
            {/* Deadline picker */}
            <div className="relative" ref={deadlinePickerRef}>
              <button
                onClick={() => {
                  setShowDeadlinePicker(!showDeadlinePicker)
                  setShowDatePicker(false)
                  setShowContextPicker(false)
                }}
                className={`flex items-center gap-1.5 text-sm transition-colors ${
                  currentDeadline ? 'text-text-secondary' : 'text-text-tertiary hover:text-text'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {currentDeadline && <span>{format(parseISO(currentDeadline), 'MMM d')}</span>}
              </button>
              {showDeadlinePicker && (
                <div className="absolute top-full right-0 mt-2 z-20">
                  <CalendarPicker
                    selectedDate={currentDeadline}
                    onDateChange={handleDeadlineChange}
                    onClose={() => setShowDeadlinePicker(false)}
                    showQuickOptions={false}
                    showClearButton={!!currentDeadline}
                    onClear={handleClearDeadline}
                    defaultMonth={currentDate && isValid(parseISO(currentDate)) ? parseISO(currentDate) : undefined}
                  />
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={FILE_INPUT_ACCEPT}
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}
