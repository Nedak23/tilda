import { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { useTaskStore } from '../stores/taskStore'

interface InlineTaskCreateProps {
  onClose: () => void
  defaultDate?: string
  defaultContextId?: string
}

export function InlineTaskCreate({ onClose, defaultDate, defaultContextId }: InlineTaskCreateProps) {
  const { createTask, contexts, setTaskContexts } = useTaskStore()
  const today = format(new Date(), 'yyyy-MM-dd')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [dateToWorkOn, setDateToWorkOn] = useState(defaultDate || today)
  const [deadline, setDeadline] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false)
  const [showContextPicker, setShowContextPicker] = useState(false)
  const [selectedContextIds, setSelectedContextIds] = useState<string[]>(defaultContextId ? [defaultContextId] : [])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Handle click outside to close (without saving)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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

  const handleSubmit = async () => {
    if (!name.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const task = await createTask({
        name: name.trim(),
        dateToWorkOn,
        deadline: deadline || undefined,
        description: description.trim() || undefined
      })
      // Assign contexts if any selected
      if (selectedContextIds.length > 0 && task) {
        await setTaskContexts(task.id, selectedContextIds)
      }
      onClose()
    } catch (error) {
      console.error('Failed to create task:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }

  const clearDate = () => {
    setDateToWorkOn(today)
  }

  const clearDeadline = () => {
    setDeadline('')
    setShowDeadlinePicker(false)
  }

  const handleToggleContext = (contextId: string) => {
    setSelectedContextIds(prev =>
      prev.includes(contextId)
        ? prev.filter(id => id !== contextId)
        : [...prev, contextId]
    )
  }

  const isToday = dateToWorkOn === today

  return (
    <div
      ref={containerRef}
      className="mx-4 mb-2 p-4 rounded-lg border border-border bg-surface-secondary max-w-sm animate-fade-in"
    >
      {/* Task name */}
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Task name"
        className="w-full bg-transparent text-text text-sm placeholder-text-tertiary focus:outline-none"
      />

      {/* Description */}
      <input
        type="text"
        value={description}
        onChange={e => setDescription(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Description"
        className="w-full bg-transparent text-text-secondary text-sm placeholder-text-tertiary focus:outline-none mt-2"
      />

      {/* Action buttons row */}
      <div className="flex items-center gap-2 mt-4">
        {/* Date button */}
        <div className="relative">
          <button
            onClick={() => {
              setShowDatePicker(!showDatePicker)
              setShowDeadlinePicker(false)
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm border transition-colors ${
              isToday
                ? 'border-success/50 text-success'
                : 'border-border-light text-text-secondary hover:text-text hover:border-border'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{isToday ? 'Today' : format(new Date(dateToWorkOn), 'MMM d')}</span>
            {!isToday && (
              <button
                onClick={e => {
                  e.stopPropagation()
                  clearDate()
                }}
                className="ml-0.5 hover:text-text"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </button>
          {showDatePicker && (
            <div className="absolute top-full left-0 mt-1 bg-surface-elevated rounded-lg shadow-elevated p-2 z-10">
              <input
                type="date"
                value={dateToWorkOn}
                onChange={e => {
                  setDateToWorkOn(e.target.value)
                  setShowDatePicker(false)
                }}
                className="bg-surface-tertiary rounded px-2 py-1 text-sm"
              />
            </div>
          )}
        </div>

        {/* Deadline button */}
        <div className="relative">
          <button
            onClick={() => {
              setShowDeadlinePicker(!showDeadlinePicker)
              setShowDatePicker(false)
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm border transition-colors ${
              deadline
                ? 'border-warning/50 text-warning'
                : 'border-border-light text-text-tertiary hover:text-text-secondary hover:border-border'
            }`}
            title="Set deadline"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {deadline && (
              <>
                <span>{format(new Date(deadline), 'MMM d')}</span>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    clearDeadline()
                  }}
                  className="ml-0.5 hover:text-text"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            )}
          </button>
          {showDeadlinePicker && (
            <div className="absolute top-full left-0 mt-1 bg-surface-elevated rounded-lg shadow-elevated p-2 z-10">
              <input
                type="date"
                value={deadline}
                onChange={e => {
                  setDeadline(e.target.value)
                  setShowDeadlinePicker(false)
                }}
                className="bg-surface-tertiary rounded px-2 py-1 text-sm"
              />
            </div>
          )}
        </div>

        {/* Context picker button */}
        <div className="relative">
          <button
            onClick={() => {
              setShowContextPicker(!showContextPicker)
              setShowDatePicker(false)
              setShowDeadlinePicker(false)
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm border transition-colors ${
              selectedContextIds.length > 0
                ? 'border-accent/50 text-accent'
                : 'border-border-light text-text-tertiary hover:text-text-secondary hover:border-border'
            }`}
            title="Assign to contexts"
          >
            <span className="text-sm">#</span>
            {selectedContextIds.length > 0 && (
              <span>{selectedContextIds.length}</span>
            )}
          </button>
          {showContextPicker && (
            <div className="absolute top-full left-0 mt-1 bg-surface-elevated rounded-lg shadow-elevated p-2 z-10 min-w-[150px] max-h-48 overflow-y-auto">
              {contexts.length === 0 ? (
                <p className="text-xs text-text-tertiary italic px-2 py-1">No contexts created</p>
              ) : (
                contexts.map(context => (
                  <label
                    key={context.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-tertiary cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedContextIds.includes(context.id)}
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

        {/* Spacer */}
        <div className="flex-1" />

        {/* Cancel button */}
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg border border-border-light text-text-secondary hover:text-text hover:border-border transition-colors"
          title="Cancel"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Submit button - blue */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!name.trim() || isSubmitting}
          className="p-2 rounded-lg bg-accent-blue text-white hover:bg-accent-blue/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Add task"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
