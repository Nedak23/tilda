import { useTaskStore } from '../stores/taskStore'
import type { ViewType } from '../types'

const navItems: { id: ViewType; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '☀️' },
  { id: 'upcoming', label: 'Upcoming', icon: '📅' },
  { id: 'archive', label: 'Archive', icon: '📁' }
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
    <aside className="w-56 bg-surface-secondary border-r border-border-light flex flex-col h-full">
      {/* Titlebar drag area */}
      <div className="h-12 titlebar-drag" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-1">
          {navItems.map(item => {
            const count = getCounts(item.id)
            const isActive = currentView === item.id

            return (
              <li key={item.id}>
                <button
                  onClick={() => setCurrentView(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left
                    transition-colors duration-100 titlebar-no-drag
                    ${isActive
                      ? 'bg-accent/10 text-accent font-medium'
                      : 'text-text hover:bg-surface-tertiary'
                    }
                  `}
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="flex-1 text-sm">{item.label}</span>
                  {count !== undefined && (
                    <span
                      className={`
                        text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center
                        ${isActive ? 'bg-accent/20 text-accent' : 'bg-surface-tertiary text-text-secondary'}
                      `}
                    >
                      {count}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* App info */}
      <div className="px-4 py-3 border-t border-border-light">
        <p className="text-2xs text-text-tertiary">Tilda v0.1.0</p>
      </div>
    </aside>
  )
}
