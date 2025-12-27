import { useState, useRef, useEffect } from 'react'
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, parseISO } from 'date-fns'
import { useTaskStore } from '../stores/taskStore'
import { ChatMessage } from './ChatMessage'
import { isFileSupported, FILE_INPUT_ACCEPT } from '../utils/fileUtils'
import { GENERAL_CONTEXT_ID } from '../types'
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
  const [datePickerMonth, setDatePickerMonth] = useState(new Date())
  const [deadlinePickerMonth, setDeadlinePickerMonth] = useState(new Date())

  const modalRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const datePickerRef = useRef<HTMLDivElement>(null)
  const deadlinePickerRef = useRef<HTMLDivElement>(null)
  const contextPickerRef = useRef<HTMLDivElement>(null)
  const contextDropdownRef = useRef<HTMLDivElement>(null)

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

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false)
      }
      if (deadlinePickerRef.current && !deadlinePickerRef.current.contains(e.target as Node)) {
        setShowDeadlinePicker(false)
      }
      // For context picker, only check the dropdown itself (not the whole area)
      if (contextDropdownRef.current && !contextDropdownRef.current.contains(e.target as Node)) {
        setShowContextPicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
  const todayDate = new Date()
  const isToday = task.dateToWorkOn === today

  // Quick date options
  const tomorrow = addDays(todayDate, 1)
  const nextWeekMonday = addDays(todayDate, ((8 - todayDate.getDay()) % 7) || 7) // Next Monday

  // Calendar helper
  const getCalendarDays = (month: Date) => {
    const monthStart = startOfMonth(month)
    const monthEnd = endOfMonth(month)
    const calendarStart = startOfWeek(monthStart)
    const calendarEnd = endOfWeek(monthEnd)
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
      <div
        ref={modalRef}
        className="bg-surface rounded-xl shadow-elevated w-full max-w-3xl max-h-[80vh] flex animate-slide-up relative"
      >
        {/* Top right buttons - Expand and Close */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
          <button
            onClick={onExpandChat}
            className="p-1 text-text-tertiary hover:text-text transition-colors"
            title="Expand chat"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-1 text-text-tertiary hover:text-text transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Left side - Task details and chat */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
                    className="text-lg font-semibold text-text cursor-pointer"
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
                placeholder="Message"
                className="flex-1 bg-transparent text-sm text-text placeholder-text-tertiary focus:outline-none"
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || isPending}
                className="p-1.5 text-text-tertiary hover:text-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Send message"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Right side - Properties */}
        <div className="w-56 border-l border-border bg-surface-secondary p-4 space-y-4 overflow-visible">
          {/* Date */}
          <div className="relative" ref={datePickerRef}>
            <label className="text-xs text-text-tertiary uppercase tracking-wide">Date</label>
            <button
              onClick={() => {
                setShowDatePicker(!showDatePicker)
                setDatePickerMonth(new Date())
              }}
              className="mt-1 flex items-center gap-2 text-sm text-text hover:text-accent-blue transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{isToday ? 'Today' : format(parseISO(task.dateToWorkOn), 'MMM d, yyyy')}</span>
            </button>
            {showDatePicker && (
              <div className="absolute top-full left-0 mt-2 bg-surface-tertiary rounded-lg shadow-elevated p-3 z-20 w-64">
                {/* Quick options */}
                <div className="space-y-1 mb-3 border-b border-border pb-3">
                  <button
                    onClick={() => handleDateChange(format(tomorrow, 'yyyy-MM-dd'))}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-surface text-sm text-text transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                      </svg>
                      <span>Tomorrow</span>
                    </div>
                    <span className="text-text-tertiary">{format(tomorrow, 'EEE')}</span>
                  </button>
                  <button
                    onClick={() => handleDateChange(format(nextWeekMonday, 'yyyy-MM-dd'))}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-surface text-sm text-text transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />
                      </svg>
                      <span>Next week</span>
                    </div>
                    <span className="text-text-tertiary">{format(nextWeekMonday, 'EEE MMM d')}</span>
                  </button>
                </div>

                {/* Calendar header */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-text">{format(datePickerMonth, 'MMM yyyy')}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setDatePickerMonth(addMonths(datePickerMonth, -1))}
                      className="p-1 text-text-tertiary hover:text-text transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDatePickerMonth(new Date())}
                      className="w-2 h-2 rounded-full bg-text-tertiary hover:bg-text transition-colors"
                    />
                    <button
                      onClick={() => setDatePickerMonth(addMonths(datePickerMonth, 1))}
                      className="p-1 text-text-tertiary hover:text-text transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <div key={i} className="text-center text-xs text-text-tertiary py-1">{day}</div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {getCalendarDays(datePickerMonth).map((day, i) => {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const isCurrentMonth = isSameMonth(day, datePickerMonth)
                    const isSelected = dateStr === task.dateToWorkOn
                    const isTodayDate = isSameDay(day, todayDate)
                    return (
                      <button
                        key={i}
                        onClick={() => handleDateChange(dateStr)}
                        className={`
                          text-xs py-1 rounded transition-colors
                          ${!isCurrentMonth ? 'text-text-tertiary/50' : 'text-text'}
                          ${isSelected ? 'bg-error text-white' : 'hover:bg-surface'}
                          ${isTodayDate && !isSelected ? 'ring-1 ring-error' : ''}
                        `}
                      >
                        {format(day, 'd')}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Deadline */}
          <div className="relative" ref={deadlinePickerRef}>
            <label className="text-xs text-text-tertiary uppercase tracking-wide">Deadline</label>
            <button
              onClick={() => {
                setShowDeadlinePicker(!showDeadlinePicker)
                setDeadlinePickerMonth(task.deadline ? parseISO(task.deadline) : new Date())
              }}
              className="mt-1 flex items-center gap-2 text-sm text-text hover:text-accent-blue transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{task.deadline ? format(parseISO(task.deadline), 'MMM d, yyyy') : 'None'}</span>
            </button>
            {showDeadlinePicker && (
              <div className="absolute top-full left-0 mt-2 bg-surface-tertiary rounded-lg shadow-elevated p-3 z-20 w-64">
                {/* Calendar header */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-text">{format(deadlinePickerMonth, 'MMM yyyy')}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setDeadlinePickerMonth(addMonths(deadlinePickerMonth, -1))}
                      className="p-1 text-text-tertiary hover:text-text transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeadlinePickerMonth(new Date())}
                      className="w-2 h-2 rounded-full bg-text-tertiary hover:bg-text transition-colors"
                    />
                    <button
                      onClick={() => setDeadlinePickerMonth(addMonths(deadlinePickerMonth, 1))}
                      className="p-1 text-text-tertiary hover:text-text transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <div key={i} className="text-center text-xs text-text-tertiary py-1">{day}</div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {getCalendarDays(deadlinePickerMonth).map((day, i) => {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const isCurrentMonth = isSameMonth(day, deadlinePickerMonth)
                    const isSelected = dateStr === task.deadline
                    const isTodayDate = isSameDay(day, todayDate)
                    return (
                      <button
                        key={i}
                        onClick={() => handleDeadlineChange(dateStr)}
                        className={`
                          text-xs py-1 rounded transition-colors
                          ${!isCurrentMonth ? 'text-text-tertiary/50' : 'text-text'}
                          ${isSelected ? 'bg-error text-white' : 'hover:bg-surface'}
                          ${isTodayDate && !isSelected ? 'ring-1 ring-error' : ''}
                        `}
                      >
                        {format(day, 'd')}
                      </button>
                    )
                  })}
                </div>

                {/* Clear deadline */}
                {task.deadline && (
                  <button
                    onClick={handleClearDeadline}
                    className="mt-3 text-xs text-text-tertiary hover:text-error transition-colors w-full text-left"
                  >
                    Clear deadline
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Contexts */}
          {(() => {
            const filteredContexts = contexts.filter(c => c.id !== GENERAL_CONTEXT_ID)
            const selectedContexts = filteredContexts.filter(c => taskContexts.includes(c.id))
            const availableContexts = filteredContexts.filter(c => !taskContexts.includes(c.id))
            return (
          <div className="relative" ref={contextPickerRef}>
            <label className="text-xs text-text-tertiary uppercase tracking-wide">Contexts</label>

            {/* Selected contexts as pills with + button */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {selectedContexts.map(context => (
                <span
                  key={context.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-tertiary rounded text-sm text-text"
                >
                  {context.name}
                  <button
                    onClick={() => handleToggleContext(context.id)}
                    className="text-text-tertiary hover:text-text transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
              <button
                onClick={() => setShowContextPicker(!showContextPicker)}
                className="inline-flex items-center justify-center w-6 h-6 rounded bg-surface-tertiary text-text-tertiary hover:text-text transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {/* Context picker dropdown */}
            {showContextPicker && (
              <div ref={contextDropdownRef} className="absolute top-full left-0 mt-2 bg-surface-tertiary rounded-lg shadow-elevated p-2 z-20 w-48 max-h-40 overflow-y-auto">
                {availableContexts.length === 0 ? (
                  <p className="text-xs text-text-tertiary italic px-2 py-1">No more contexts</p>
                ) : (
                  availableContexts.map(context => (
                    <button
                      key={context.id}
                      onClick={() => {
                        handleToggleContext(context.id)
                        if (availableContexts.length === 1) {
                          setShowContextPicker(false)
                        }
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
            )
          })()}

        </div>
      </div>
    </div>
  )
}
