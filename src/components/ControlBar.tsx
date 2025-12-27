import { useState } from 'react'

interface ControlBarProps {
  isTildaCollapsed: boolean
  isNavCollapsed: boolean
  onToggleTilda: () => void
  onToggleNav: () => void
  onOpenSettings: () => void
}

interface TooltipButtonProps {
  onClick: () => void
  tooltip: string
  children: React.ReactNode
  className?: string
}

function TooltipButton({ onClick, tooltip, children, className = '' }: TooltipButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={className}
      >
        {children}
      </button>
      {showTooltip && (
        <div className="absolute top-full right-0 mt-2 px-2 py-1 bg-surface-tertiary text-text text-xs rounded whitespace-nowrap z-50 shadow-lg">
          {tooltip}
        </div>
      )}
    </div>
  )
}

export function ControlBar({
  isTildaCollapsed,
  isNavCollapsed,
  onToggleTilda,
  onToggleNav,
  onOpenSettings
}: ControlBarProps) {
  return (
    <div className="h-9 bg-surface flex items-center justify-end px-3 border-b border-border-light flex-shrink-0 relative">
      {/* Titlebar drag area - fills the whole bar */}
      <div className="absolute inset-0 titlebar-drag" />

      {/* Settings and toggle buttons on the right */}
      <div className="relative flex items-center gap-1">
        {/* Settings button */}
        <TooltipButton
          onClick={onOpenSettings}
          tooltip="Settings"
          className="titlebar-no-drag p-1.5 rounded text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </TooltipButton>

        {/* Navigation Toggle - Left sidebar */}
        <TooltipButton
          onClick={onToggleNav}
          tooltip="Toggle Navigation (⌘B)"
          className="titlebar-no-drag p-1.5 rounded text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {/* Left panel - filled when open */}
            <rect x="4" y="4" width="5" height="16" rx="1" fill={isNavCollapsed ? 'none' : 'currentColor'} />
            {/* Right panel - always outline */}
            <rect x="9" y="4" width="11" height="16" rx="1" fill="none" />
          </svg>
        </TooltipButton>

        {/* Tilda (Chat) Toggle - Right sidebar */}
        <TooltipButton
          onClick={onToggleTilda}
          tooltip="Toggle Tilda (⌥⌘B)"
          className="titlebar-no-drag p-1.5 rounded text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {/* Left panel - always outline */}
            <rect x="4" y="4" width="11" height="16" rx="1" fill="none" />
            {/* Right panel - filled when open */}
            <rect x="15" y="4" width="5" height="16" rx="1" fill={isTildaCollapsed ? 'none' : 'currentColor'} />
          </svg>
        </TooltipButton>
      </div>
    </div>
  )
}
