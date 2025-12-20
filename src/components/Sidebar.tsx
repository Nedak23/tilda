import { useTaskStore } from '../stores/taskStore'
import type { ViewType } from '../types'

const navItems: { id: ViewType; label: string; icon: string; color?: string }[] = [
  { id: 'today', label: 'Today', icon: '★', color: 'text-accent' },
  { id: 'upcoming', label: 'Upcoming', icon: '📅' },
  { id: 'archive', label: 'Logbook', icon: '✓', color: 'text-success' }
]

export function Sidebar() {
  const { currentView, setCurrentView, getTodayTasks, getUpcomingTasks } = useTaskStore()

  const todayCount = getTodayTasks().length
  const upcomingCount = getUpcomingTasks().length

  const getCounts = (id: ViewType): number | undefined => {
    if (id === 'today') return todayCount > 0 ? todayCount : undefined
    if (id === 'upcoming') return upcomingCount > 0 ? upcomingCount : undefined
    return undefined
  }

  return (
    <aside className="w-52 bg-surface-secondary flex flex-col h-full border-r border-border-light">
      {/* Titlebar drag area */}
      <div className="h-12 titlebar-drag" />

      {/* Navigation */}
      <nav className="flex-1 px-2 py-1">
        <ul className="space-y-0.5">
          {navItems.map(item => {
            const count = getCounts(item.id)
            const isActive = currentView === item.id

            return (
              <li key={item.id}>
                <button
                  onClick={() => setCurrentView(item.id)}
                  className={`
                    w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left
                    transition-colors duration-100 titlebar-no-drag
                    ${isActive
                      ? 'bg-surface-tertiary text-text'
                      : 'text-text-secondary hover:bg-surface-tertiary/50 hover:text-text'
                    }
                  `}
                >
                  <span className={`text-sm ${item.color || ''}`}>{item.icon}</span>
                  <span className="flex-1 text-sm font-medium">{item.label}</span>
                  {count !== undefined && (
                    <span className="text-xs text-text-secondary">
                      {count}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
