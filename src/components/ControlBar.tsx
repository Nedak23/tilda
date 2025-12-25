interface ControlBarProps {
  isTildaCollapsed: boolean
  isNavCollapsed: boolean
  onToggleTilda: () => void
  onToggleNav: () => void
}

export function ControlBar({
  isTildaCollapsed,
  isNavCollapsed,
  onToggleTilda,
  onToggleNav
}: ControlBarProps) {
  return (
    <div className="h-8 bg-surface flex items-center justify-end px-3 border-b border-border-light flex-shrink-0 relative">
      {/* Titlebar drag area - fills the whole bar */}
      <div className="absolute inset-0 titlebar-drag" />

      {/* Toggle buttons on the right */}
      <div className="relative flex items-center gap-1">
        {/* Tilda (Chat) Toggle - Left sidebar */}
        <button
          onClick={onToggleTilda}
          className="titlebar-no-drag p-1.5 rounded text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary transition-colors"
          title={isTildaCollapsed ? 'Show Tilda (Cmd+Shift+T)' : 'Hide Tilda (Cmd+Shift+T)'}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {/* Left panel - filled when open */}
            <rect x="4" y="4" width="5" height="16" rx="1" fill={isTildaCollapsed ? 'none' : 'currentColor'} />
            {/* Right panel - always outline */}
            <rect x="9" y="4" width="11" height="16" rx="1" fill="none" />
          </svg>
        </button>

        {/* Navigation Toggle - Right sidebar */}
        <button
          onClick={onToggleNav}
          className="titlebar-no-drag p-1.5 rounded text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary transition-colors"
          title={isNavCollapsed ? 'Show Navigation' : 'Hide Navigation'}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {/* Left panel - always outline */}
            <rect x="4" y="4" width="11" height="16" rx="1" fill="none" />
            {/* Right panel - filled when open */}
            <rect x="15" y="4" width="5" height="16" rx="1" fill={isNavCollapsed ? 'none' : 'currentColor'} />
          </svg>
        </button>
      </div>
    </div>
  )
}
