import { useState } from 'react'

interface ControlBarProps {
  isTildaCollapsed: boolean
  isNavCollapsed: boolean
  onToggleTilda: () => void
  onToggleNav: () => void
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
  onToggleNav
}: ControlBarProps) {
  return (
    <div className="h-9 bg-surface flex items-center justify-between px-3 border-b border-border-light flex-shrink-0 relative">
      {/* Titlebar drag area - fills the whole bar */}
      <div className="absolute inset-0 titlebar-drag" />

      {/* Nav toggle on the left (with margin for macOS traffic lights) */}
      <div className="relative flex items-center ml-[60px]">
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
      </div>

      {/* Tilda toggle on the right */}
      <div className="relative flex items-center">
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
