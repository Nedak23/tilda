import { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { useTaskStore } from '../stores/taskStore'
import { ChatMessage } from './ChatMessage'
import { isFileSupported, FILE_INPUT_ACCEPT } from '../utils/fileUtils'
import type { Task } from '../types'

interface TaskModalProps {
  task: Task
  onClose: () => void
  onExpandChat: () => void
}

export function TaskModal({ task, onClose, onExpandChat }: TaskModalProps) {
  const {
    messagesByTask,
    attachmentsByTask,
    pendingResponses,
    updateTask,
    sendMessage,
    loadMessages,
    loadAttachments,
    addAttachment,
    removeAttachment,
    contexts,
    taskContextsByTask,
    setTaskContexts,
    loadTaskContexts
  } = useTaskStore()

  const attachments = attachmentsByTask[task.id] || []

  const messages = messagesByTask[task.id] || []
  const isPending = pendingResponses.has(task.id)

  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(task.name)
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editedDescription, setEditedDescription] = useState(task.description || '')
  const [chatInput, setChatInput] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false)
  const [showContextPicker, setShowContextPicker] = useState(false)

  const modalRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load messages when modal opens
  useEffect(() => {
    if (!messagesByTask[task.id]) {
      loadMessages(task.id)
    }
  }, [task.id, messagesByTask, loadMessages])

  // Load attachments when modal opens
  useEffect(() => {
    if (!attachmentsByTask[task.id]) {
      loadAttachments(task.id)
    }
  }, [task.id, attachmentsByTask, loadAttachments])

  // Load task contexts when modal opens
  useEffect(() => {
    if (!taskContextsByTask[task.id]) {
      loadTaskContexts(task.id)
    }
  }, [task.id, taskContextsByTask, loadTaskContexts])

  const taskContexts = taskContextsByTask[task.id] || []

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleNameSave = async () => {
    if (editedName.trim() && editedName !== task.name) {
      await updateTask(task.id, { name: editedName.trim() })
    }
    setIsEditingName(false)
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave()
    } else if (e.key === 'Escape') {
      setEditedName(task.name)
      setIsEditingName(false)
    }
  }

  const handleDescriptionSave = async () => {
    if (editedDescription !== (task.description || '')) {
      await updateTask(task.id, { description: editedDescription.trim() || undefined })
    }
    setIsEditingDescription(false)
  }

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isPending) return
    const message = chatInput.trim()
    setChatInput('')
    await sendMessage(task.id, message)
  }

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleDateChange = async (newDate: string) => {
    await updateTask(task.id, { dateToWorkOn: newDate })
    setShowDatePicker(false)
  }

  const handleDeadlineChange = async (newDeadline: string) => {
    await updateTask(task.id, { deadline: newDeadline || undefined })
    setShowDeadlinePicker(false)
  }

  const handleClearDeadline = async () => {
    await updateTask(task.id, { deadline: undefined })
    setShowDeadlinePicker(false)
  }

  const handleToggleContext = async (contextId: string) => {
    const newContexts = taskContexts.includes(contextId)
      ? taskContexts.filter(id => id !== contextId)
      : [...taskContexts, contextId]
    await setTaskContexts(task.id, newContexts)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return

    for (const file of files) {
      if (!isFileSupported(file)) {
        console.warn(`Skipping unsupported file: ${file.name}`)
        continue
      }
      await addAttachment(task.id, file)
    }

    e.target.value = ''
  }

  const today = format(new Date(), 'yyyy-MM-dd')
  const isToday = task.dateToWorkOn === today

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
      <div
        ref={modalRef}
        className="bg-surface rounded-xl shadow-elevated w-full max-w-3xl max-h-[80vh] flex overflow-hidden animate-slide-up"
      >
        {/* Left side - Task details and chat */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header with breadcrumb */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <span>★</span>
              <span>{task.status === 'today' ? 'Today' : task.status === 'upcoming' ? 'Upcoming' : 'Logbook'}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-text-tertiary hover:text-text transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Task name and description */}
          <div className="px-4 py-4">
            <div className="flex items-start gap-3">
              <div className={`checkbox mt-1 ${task.status === 'archived' ? 'checked' : ''}`}>
                {task.status === 'archived' && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                {isEditingName ? (
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={editedName}
                    onChange={e => setEditedName(e.target.value)}
                    onBlur={handleNameSave}
                    onKeyDown={handleNameKeyDown}
                    className="w-full bg-transparent text-text text-lg font-semibold focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <h2
                    onClick={() => setIsEditingName(true)}
                    className="text-lg font-semibold text-text cursor-pointer hover:text-accent-blue transition-colors"
                  >
                    {task.name}
                  </h2>
                )}

                {isEditingDescription ? (
                  <textarea
                    value={editedDescription}
                    onChange={e => setEditedDescription(e.target.value)}
                    onBlur={handleDescriptionSave}
                    placeholder="Description"
                    className="w-full bg-transparent text-text-secondary text-sm placeholder-text-tertiary focus:outline-none mt-2 resize-none"
                    rows={2}
                    autoFocus
                  />
                ) : (
                  <p
                    onClick={() => setIsEditingDescription(true)}
                    className="text-sm text-text-secondary mt-1 cursor-pointer hover:text-text-secondary/80 transition-colors"
                  >
                    {task.description || <span className="text-text-tertiary">Description</span>}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="px-4 pb-3">
              <div className="flex flex-wrap gap-2">
                {attachments.map(attachment => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-2 px-2 py-1 bg-surface-tertiary rounded text-xs text-text-secondary"
                  >
                    <span className="truncate max-w-[120px]">{attachment.filename}</span>
                    <button
                      onClick={() => removeAttachment(attachment.id, task.id)}
                      className="text-text-tertiary hover:text-error transition-colors"
                      aria-label="Remove attachment"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat area */}
          <div className="flex-1 flex flex-col border-t border-border min-h-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center text-text-tertiary text-sm py-8">
                  Start a conversation about this task
                </div>
              ) : (
                <>
                  {messages.map((message, index) => {
                    const isLastAgentMessage = message.sender === 'agent' && index === messages.length - 1
                    return (
                      <ChatMessage
                        key={message.id}
                        message={message}
                        isStreaming={isPending && isLastAgentMessage}
                      />
                    )
                  })}
                </>
              )}

              {isPending && messages[messages.length - 1]?.sender === 'user' && (
                <div className="flex justify-start">
                  <div className="bg-surface-tertiary px-4 py-2.5 rounded-2xl rounded-bl-md">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Chat input */}
            <div className="px-4 py-3 border-t border-border flex items-center gap-3">
              {/* Attach button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-text-tertiary hover:text-text transition-colors"
                title="Attach file"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={FILE_INPUT_ACCEPT}
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder="Comment"
                className="flex-1 bg-transparent text-sm text-text placeholder-text-tertiary focus:outline-none"
              />
              <button
                onClick={onExpandChat}
                className="p-1.5 text-text-tertiary hover:text-text transition-colors"
                title="Expand chat"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Right side - Properties */}
        <div className="w-56 border-l border-border bg-surface-secondary p-4 space-y-4">
          {/* Date */}
          <div>
            <label className="text-xs text-text-tertiary uppercase tracking-wide">Date</label>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="mt-1 flex items-center gap-2 text-sm text-text hover:text-accent-blue transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{isToday ? 'Today' : format(new Date(task.dateToWorkOn), 'MMM d, yyyy')}</span>
            </button>
            {showDatePicker && (
              <input
                type="date"
                value={task.dateToWorkOn}
                onChange={e => handleDateChange(e.target.value)}
                className="mt-2 bg-surface-tertiary rounded px-2 py-1 text-sm w-full"
              />
            )}
          </div>

          {/* Deadline */}
          <div>
            <label className="text-xs text-text-tertiary uppercase tracking-wide">Deadline</label>
            <button
              onClick={() => setShowDeadlinePicker(!showDeadlinePicker)}
              className="mt-1 flex items-center gap-2 text-sm text-text hover:text-accent-blue transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{task.deadline ? format(new Date(task.deadline), 'MMM d, yyyy') : 'None'}</span>
            </button>
            {showDeadlinePicker && (
              <div className="mt-2 space-y-2">
                <input
                  type="date"
                  value={task.deadline || ''}
                  onChange={e => handleDeadlineChange(e.target.value)}
                  className="bg-surface-tertiary rounded px-2 py-1 text-sm w-full"
                />
                {task.deadline && (
                  <button
                    onClick={handleClearDeadline}
                    className="text-xs text-text-tertiary hover:text-error transition-colors"
                  >
                    Clear deadline
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Contexts */}
          <div>
            <label className="text-xs text-text-tertiary uppercase tracking-wide">Contexts</label>
            <button
              onClick={() => setShowContextPicker(!showContextPicker)}
              className="mt-1 flex items-center gap-2 text-sm text-text hover:text-accent-blue transition-colors"
            >
              <span className="text-text-secondary">#</span>
              <span>
                {taskContexts.length === 0
                  ? 'None'
                  : contexts.filter(c => taskContexts.includes(c.id)).map(c => c.name).join(', ')}
              </span>
            </button>
            {showContextPicker && (
              <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {contexts.length === 0 ? (
                  <p className="text-xs text-text-tertiary italic">No contexts created</p>
                ) : (
                  contexts.map(context => (
                    <label
                      key={context.id}
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-surface-tertiary cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={taskContexts.includes(context.id)}
                        onChange={() => handleToggleContext(context.id)}
                        className="rounded border-border-light text-accent focus:ring-accent"
                      />
                      <span className="text-sm text-text">#{context.name}</span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
