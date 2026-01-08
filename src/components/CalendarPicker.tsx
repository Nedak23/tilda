import { useState, useEffect, useRef } from 'react'
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, parseISO, isValid } from 'date-fns'
import type { RecurrenceRule, RecurrenceFrequency } from '../types'

interface CalendarPickerProps {
  selectedDate: string | undefined
  onDateChange: (date: string) => void
  onClose: () => void
  showQuickOptions?: boolean
  showClearButton?: boolean
  onClear?: () => void
  defaultMonth?: Date
  recurrenceRule?: RecurrenceRule
  onRecurrenceChange?: (rule: RecurrenceRule | null) => void
}

export function CalendarPicker({
  selectedDate,
  onDateChange,
  onClose,
  showQuickOptions = true,
  showClearButton = false,
  onClear,
  defaultMonth,
  recurrenceRule,
  onRecurrenceChange
}: CalendarPickerProps) {
  const [pickerMonth, setPickerMonth] = useState(defaultMonth || new Date())
  const [showEndDatePicker, setShowEndDatePicker] = useState(false)
  const [endDatePickerMonth, setEndDatePickerMonth] = useState(new Date())
  const endDatePickerRef = useRef<HTMLDivElement>(null)
  const todayDate = new Date()

  // Handle click outside to close end date picker
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (endDatePickerRef.current && !endDatePickerRef.current.contains(e.target as Node)) {
        setShowEndDatePicker(false)
      }
    }

    if (showEndDatePicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showEndDatePicker])

  // Quick date options
  const tomorrow = addDays(todayDate, 1)
  const nextWeekMonday = addDays(todayDate, ((8 - todayDate.getDay()) % 7) || 7)

  // Calendar helper
  const getCalendarDays = (month: Date) => {
    const monthStart = startOfMonth(month)
    const monthEnd = endOfMonth(month)
    const calendarStart = startOfWeek(monthStart)
    const calendarEnd = endOfWeek(monthEnd)
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }

  const handleDateSelect = (date: string) => {
    onDateChange(date)
    onClose()
  }

  // Recurrence helpers
  const frequencyOptions: { value: RecurrenceFrequency | 'none'; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' }
  ]

  const frequencyLabels: Record<RecurrenceFrequency, { singular: string; plural: string }> = {
    daily: { singular: 'day', plural: 'days' },
    weekly: { singular: 'week', plural: 'weeks' },
    monthly: { singular: 'month', plural: 'months' },
    yearly: { singular: 'year', plural: 'years' }
  }

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  const handleFrequencyChange = (freq: RecurrenceFrequency | 'none') => {
    if (!onRecurrenceChange) return
    if (freq === 'none') {
      onRecurrenceChange(null)
    } else {
      onRecurrenceChange({
        frequency: freq,
        interval: recurrenceRule?.interval || 1,
        endDate: recurrenceRule?.endDate,
        daysOfWeek: freq === 'weekly' ? (recurrenceRule?.daysOfWeek || []) : undefined
      })
    }
  }

  const handleIntervalChange = (interval: number) => {
    if (!onRecurrenceChange || !recurrenceRule) return
    onRecurrenceChange({
      ...recurrenceRule,
      interval: Math.max(1, interval)
    })
  }

  const handleDayOfWeekToggle = (day: number) => {
    if (!onRecurrenceChange || !recurrenceRule) return
    const currentDays = recurrenceRule.daysOfWeek || []
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day].sort()
    onRecurrenceChange({
      ...recurrenceRule,
      daysOfWeek: newDays
    })
  }

  const handleEndDateChange = (date: string) => {
    if (!onRecurrenceChange || !recurrenceRule) return
    onRecurrenceChange({
      ...recurrenceRule,
      endDate: date
    })
    setShowEndDatePicker(false)
  }

  const handleClearEndDate = () => {
    if (!onRecurrenceChange || !recurrenceRule) return
    onRecurrenceChange({
      ...recurrenceRule,
      endDate: undefined
    })
    setShowEndDatePicker(false)
  }

  const getEndDateCalendarDays = (month: Date) => {
    const monthStart = startOfMonth(month)
    const monthEnd = endOfMonth(month)
    const calendarStart = startOfWeek(monthStart)
    const calendarEnd = endOfWeek(monthEnd)
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }

  const formatEndDate = (dateStr: string | undefined): string => {
    if (!dateStr) return 'Never'
    const parsed = parseISO(dateStr)
    if (!isValid(parsed)) return 'Never'
    return format(parsed, 'MMM d, yyyy')
  }

  return (
    <div className="bg-surface-tertiary rounded-lg shadow-elevated p-3 w-64">
      {/* Quick options */}
      {showQuickOptions && (
        <div className="space-y-1 mb-3 border-b border-border pb-3">
          <button
            onClick={() => handleDateSelect(format(tomorrow, 'yyyy-MM-dd'))}
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
            onClick={() => handleDateSelect(format(nextWeekMonday, 'yyyy-MM-dd'))}
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
      )}

      {/* Calendar header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text">{format(pickerMonth, 'MMM yyyy')}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPickerMonth(addMonths(pickerMonth, -1))}
            className="p-1 text-text-tertiary hover:text-text transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setPickerMonth(new Date())}
            className="w-2 h-2 rounded-full bg-text-tertiary hover:bg-text transition-colors"
          />
          <button
            onClick={() => setPickerMonth(addMonths(pickerMonth, 1))}
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
        {getCalendarDays(pickerMonth).map((day, i) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const isCurrentMonth = isSameMonth(day, pickerMonth)
          const isSelected = dateStr === selectedDate
          const isTodayDate = isSameDay(day, todayDate)
          return (
            <button
              key={i}
              onClick={() => handleDateSelect(dateStr)}
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

      {/* Clear button */}
      {showClearButton && onClear && (
        <button
          onClick={() => {
            onClear()
            onClose()
          }}
          className="mt-3 text-xs text-text-tertiary hover:text-error transition-colors w-full text-left"
        >
          Clear deadline
        </button>
      )}

      {/* Recurrence section */}
      {onRecurrenceChange && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          {/* Frequency selector */}
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <select
              value={recurrenceRule?.frequency || 'none'}
              onChange={(e) => handleFrequencyChange(e.target.value as RecurrenceFrequency | 'none')}
              className="flex-1 bg-surface-secondary text-text text-sm rounded px-2 py-1 border border-border focus:outline-none focus:border-accent-blue"
            >
              {frequencyOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Interval and additional options (only when frequency is set) */}
          {recurrenceRule && (
            <>
              {/* Interval */}
              <div className="flex items-center gap-2 text-sm text-text">
                <span>Every</span>
                <input
                  type="number"
                  min={1}
                  value={recurrenceRule.interval}
                  onChange={(e) => handleIntervalChange(parseInt(e.target.value) || 1)}
                  className="w-12 bg-surface-secondary text-text text-sm rounded px-2 py-1 border border-border focus:outline-none focus:border-accent-blue text-center"
                />
                <span>
                  {recurrenceRule.interval === 1
                    ? frequencyLabels[recurrenceRule.frequency].singular
                    : frequencyLabels[recurrenceRule.frequency].plural}
                </span>
              </div>

              {/* Days of week selector (weekly only) */}
              {recurrenceRule.frequency === 'weekly' && (
                <div className="space-y-1">
                  <span className="text-xs text-text-tertiary">On days</span>
                  <div className="flex gap-1">
                    {dayLabels.map((label, i) => {
                      const isSelected = recurrenceRule.daysOfWeek?.includes(i) || false
                      return (
                        <button
                          key={i}
                          onClick={() => handleDayOfWeekToggle(i)}
                          className={`
                            w-7 h-7 text-xs rounded transition-colors
                            ${isSelected
                              ? 'bg-accent-blue text-white'
                              : 'bg-surface-secondary text-text hover:bg-surface'}
                          `}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* End date */}
              <div className="space-y-1">
                <span className="text-xs text-text-tertiary">Ends</span>
                <div className="relative" ref={endDatePickerRef}>
                  <button
                    onClick={() => setShowEndDatePicker(!showEndDatePicker)}
                    className="w-full flex items-center justify-between px-2 py-1 bg-surface-secondary text-sm text-text rounded border border-border hover:border-accent-blue transition-colors"
                  >
                    <span>{formatEndDate(recurrenceRule.endDate)}</span>
                    <svg className="w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>

                  {/* End date mini calendar */}
                  {showEndDatePicker && (
                    <div className="absolute top-full left-0 mt-1 bg-surface-tertiary rounded-lg shadow-elevated p-2 z-30 w-full">
                      {/* Mini calendar header */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-text">{format(endDatePickerMonth, 'MMM yyyy')}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEndDatePickerMonth(addMonths(endDatePickerMonth, -1))}
                            className="p-0.5 text-text-tertiary hover:text-text transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setEndDatePickerMonth(addMonths(endDatePickerMonth, 1))}
                            className="p-0.5 text-text-tertiary hover:text-text transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Day headers */}
                      <div className="grid grid-cols-7 gap-0.5 mb-1">
                        {dayLabels.map((day, i) => (
                          <div key={i} className="text-center text-[10px] text-text-tertiary py-0.5">{day}</div>
                        ))}
                      </div>

                      {/* Calendar grid */}
                      <div className="grid grid-cols-7 gap-0.5">
                        {getEndDateCalendarDays(endDatePickerMonth).map((day, i) => {
                          const dateStr = format(day, 'yyyy-MM-dd')
                          const isCurrentMonth = isSameMonth(day, endDatePickerMonth)
                          const isSelected = dateStr === recurrenceRule.endDate
                          return (
                            <button
                              key={i}
                              onClick={() => handleEndDateChange(dateStr)}
                              className={`
                                text-[10px] py-0.5 rounded transition-colors
                                ${!isCurrentMonth ? 'text-text-tertiary/50' : 'text-text'}
                                ${isSelected ? 'bg-accent-blue text-white' : 'hover:bg-surface'}
                              `}
                            >
                              {format(day, 'd')}
                            </button>
                          )
                        })}
                      </div>

                      {/* Clear end date */}
                      {recurrenceRule.endDate && (
                        <button
                          onClick={handleClearEndDate}
                          className="mt-2 text-xs text-text-tertiary hover:text-error transition-colors w-full text-left"
                        >
                          Clear end date
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
