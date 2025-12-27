import { useState } from 'react'
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths } from 'date-fns'

interface CalendarPickerProps {
  selectedDate: string | undefined
  onDateChange: (date: string) => void
  onClose: () => void
  showQuickOptions?: boolean
  showClearButton?: boolean
  onClear?: () => void
}

export function CalendarPicker({
  selectedDate,
  onDateChange,
  onClose,
  showQuickOptions = true,
  showClearButton = false,
  onClear
}: CalendarPickerProps) {
  const [pickerMonth, setPickerMonth] = useState(new Date())
  const todayDate = new Date()

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
    </div>
  )
}
