import { Group, Panel, Separator, usePanelCallbackRef } from 'react-resizable-panels'
import { ReactNode, useEffect, useRef, useCallback } from 'react'
import type { PanelImperativeHandle, PanelSize } from 'react-resizable-panels'

interface PanelLayoutProps {
  leftPanel: ReactNode
  centerPanel: ReactNode
  rightPanel: ReactNode
  isLeftCollapsed: boolean
  isRightCollapsed: boolean
  onLeftCollapseChange?: (collapsed: boolean) => void
  onRightCollapseChange?: (collapsed: boolean) => void
}

export function PanelLayout({
  leftPanel,
  centerPanel,
  rightPanel,
  isLeftCollapsed,
  isRightCollapsed,
  onLeftCollapseChange,
  onRightCollapseChange
}: PanelLayoutProps) {
  const [leftPanelHandle, setLeftPanelHandle] = usePanelCallbackRef()
  const [rightPanelHandle, setRightPanelHandle] = usePanelCallbackRef()

  // Track previous values to only react to changes, not initial mount
  const prevLeftCollapsed = useRef(isLeftCollapsed)
  const prevRightCollapsed = useRef(isRightCollapsed)

  // Handle collapse state changes (only when state actually changes)
  useEffect(() => {
    if (!leftPanelHandle) return
    if (prevLeftCollapsed.current === isLeftCollapsed) return

    prevLeftCollapsed.current = isLeftCollapsed
    if (isLeftCollapsed) {
      leftPanelHandle.collapse()
    } else {
      leftPanelHandle.expand()
    }
  }, [isLeftCollapsed, leftPanelHandle])

  useEffect(() => {
    if (!rightPanelHandle) return
    if (prevRightCollapsed.current === isRightCollapsed) return

    prevRightCollapsed.current = isRightCollapsed
    if (isRightCollapsed) {
      rightPanelHandle.collapse()
    } else {
      rightPanelHandle.expand()
    }
  }, [isRightCollapsed, rightPanelHandle])

  // Track collapse state from user dragging panels
  const handleLeftResize = useCallback((size: PanelSize) => {
    const collapsed = size.inPixels === 0
    if (collapsed !== isLeftCollapsed) {
      onLeftCollapseChange?.(collapsed)
    }
  }, [isLeftCollapsed, onLeftCollapseChange])

  const handleRightResize = useCallback((size: PanelSize) => {
    const collapsed = size.inPixels === 0
    if (collapsed !== isRightCollapsed) {
      onRightCollapseChange?.(collapsed)
    }
  }, [isRightCollapsed, onRightCollapseChange])

  return (
    <Group
      orientation="horizontal"
      id="tilda-sidebar-layout"
      className="h-full w-full"
    >
      {/* Left: Tilda Chat Sidebar */}
      <Panel
        panelRef={setLeftPanelHandle as React.Ref<PanelImperativeHandle>}
        id="tilda-sidebar"
        defaultSize="20%"
        minSize="180px"
        maxSize="480px"
        collapsible
        collapsedSize="0px"
        onResize={handleLeftResize}
      >
        <div className="h-full overflow-hidden">
          {leftPanel}
        </div>
      </Panel>

      <Separator className="w-1 bg-border-light hover:bg-accent-blue transition-colors cursor-col-resize" />

      {/* Center: Main Content */}
      <Panel
        id="main-content"
        defaultSize="60%"
        minSize="30%"
      >
        <div className="h-full overflow-hidden">
          {centerPanel}
        </div>
      </Panel>

      <Separator className="w-1 bg-border-light hover:bg-accent-blue transition-colors cursor-col-resize" />

      {/* Right: Navigation Sidebar */}
      <Panel
        panelRef={setRightPanelHandle as React.Ref<PanelImperativeHandle>}
        id="nav-sidebar"
        defaultSize="13%"
        minSize="180px"
        maxSize="320px"
        collapsible
        collapsedSize="0px"
        onResize={handleRightResize}
      >
        <div className="h-full overflow-hidden">
          {rightPanel}
        </div>
      </Panel>
    </Group>
  )
}
