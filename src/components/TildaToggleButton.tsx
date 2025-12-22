interface TildaToggleButtonProps {
  isOpen: boolean
  onToggle: () => void
}

export function TildaToggleButton({ isOpen, onToggle }: TildaToggleButtonProps) {
  return (
    <button
      onClick={onToggle}
      className="titlebar-no-drag absolute top-3 right-4 p-2 rounded-lg text-text-secondary hover:text-text hover:bg-surface-secondary transition-colors z-10"
      title={isOpen ? 'Close Tilda (⌘⇧T)' : 'Open Tilda (⌘⇧T)'}
    >
      {isOpen ? (
        // X icon when open
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        // Chat bubble icon when closed
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )}
    </button>
  )
}
