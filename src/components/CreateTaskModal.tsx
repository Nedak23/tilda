import { useState } from 'react'
import { format } from 'date-fns'
import { useTaskStore } from '../stores/taskStore'
import { logger } from '../utils/logger'
import type { RecurrenceFrequency, RecurrenceRule } from '../types'

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateTaskModal({ isOpen, onClose }: CreateTaskModalProps) {
  const { createTask } = useTaskStore()

  const today = format(new Date(), 'yyyy-MM-dd')

  const [name, setName] = useState('')
  const [dateToWorkOn, setDateToWorkOn] = useState(today)
  const [deadline, setDeadline] = useState('')
  const [description, setDescription] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('weekly')
  const [interval, setInterval] = useState(1)
  const [endDate, setEndDate] = useState('')
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetForm = () => {
    setName('')
    setDateToWorkOn(today)
    setDeadline('')
    setDescription('')
    setIsRecurring(false)
    setFrequency('weekly')
    setInterval(1)
    setEndDate('')
    setDaysOfWeek([])
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) return

    setIsSubmitting(true)

    try {
      let recurrenceRule: RecurrenceRule | undefined

      if (isRecurring) {
        recurrenceRule = {
          frequency,
          interval,
          endDate: endDate || undefined,
          daysOfWeek: frequency === 'weekly' && daysOfWeek.length > 0 ? daysOfWeek : undefined
        }
      }

      await createTask({
        name: name.trim(),
        dateToWorkOn,
        deadline: deadline || undefined,
        description: description.trim() || undefined,
        recurrenceRule
      })

      handleClose()
    } catch (error) {
      logger.error('Failed to create task:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleDayOfWeek = (day: number) => {
    setDaysOfWeek(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    )
  }

  if (!isOpen) return null

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="modal-backdrop animate-fade-in" onClick={handleClose}>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        onClick={e => e.stopPropagation()}
      >
        <div
          className="bg-surface rounded-xl shadow-modal w-full max-w-md animate-slide-up"
          onClick={e => e.stopPropagation()}
        >
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-border-light">
              <h2 className="text-lg font-semibold text-text">Create New Task</h2>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4">
              {/* Task Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-text mb-1">
                  Task Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="What do you need to do?"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                  autoFocus
                  required
                />
              </div>

              {/* Date to Work On */}
              <div>
                <label htmlFor="dateToWorkOn" className="block text-sm font-medium text-text mb-1">
                  Date to Work On
                </label>
                <input
                  id="dateToWorkOn"
                  type="date"
                  value={dateToWorkOn}
                  onChange={e => setDateToWorkOn(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                  required
                />
              </div>

              {/* Deadline */}
              <div>
                <label htmlFor="deadline" className="block text-sm font-medium text-text mb-1">
                  Deadline <span className="text-text-tertiary font-normal">(optional)</span>
                </label>
                <input
                  id="deadline"
                  type="date"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-text mb-1">
                  Description <span className="text-text-tertiary font-normal">(optional)</span>
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Add any details or context..."
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                />
              </div>

              {/* Recurring Toggle */}
              <div className="flex items-center gap-2">
                <input
                  id="recurring"
                  type="checkbox"
                  checked={isRecurring}
                  onChange={e => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                />
                <label htmlFor="recurring" className="text-sm text-text">
                  Recurring Task
                </label>
              </div>

              {/* Recurrence Options */}
              {isRecurring && (
                <div className="pl-6 space-y-3 border-l-2 border-border-light">
                  {/* Frequency */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text">Every</span>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={interval}
                      onChange={e => setInterval(parseInt(e.target.value) || 1)}
                      className="w-16 px-2 py-1 border border-border rounded text-sm text-center"
                    />
                    <select
                      value={frequency}
                      onChange={e => setFrequency(e.target.value as RecurrenceFrequency)}
                      className="px-2 py-1 border border-border rounded text-sm"
                    >
                      <option value="daily">day(s)</option>
                      <option value="weekly">week(s)</option>
                      <option value="monthly">month(s)</option>
                      <option value="yearly">year(s)</option>
                    </select>
                  </div>

                  {/* Days of Week (for weekly) */}
                  {frequency === 'weekly' && (
                    <div>
                      <p className="text-xs text-text-secondary mb-2">On these days:</p>
                      <div className="flex gap-1">
                        {dayLabels.map((label, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => toggleDayOfWeek(index)}
                            className={`
                              w-8 h-8 rounded-full text-xs font-medium transition-colors
                              ${daysOfWeek.includes(index)
                                ? 'bg-accent text-white'
                                : 'bg-surface-secondary text-text-secondary hover:bg-surface-tertiary'
                              }
                            `}
                          >
                            {label[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* End Date */}
                  <div>
                    <label htmlFor="endDate" className="block text-xs text-text-secondary mb-1">
                      End date (optional)
                    </label>
                    <input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      min={dateToWorkOn}
                      className="w-full px-2 py-1 border border-border rounded text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border-light flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || isSubmitting}
                className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
