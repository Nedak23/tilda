import { Group, Panel, Separator, usePanelCallbackRef } from 'react-resizable-panels'
import { ReactNode, useEffect, useRef, useCallback } from 'react'
import type { PanelImperativeHandle, PanelSize } from 'react-resizable-panels'
import { DEFAULT_TILDA_SIZE, DEFAULT_NAV_SIZE } from '../hooks/useLayoutState'

interface PanelLayoutProps {
  leftPanel: ReactNode
  centerPanel: ReactNode
  rightPanel: ReactNode
  isLeftCollapsed: boolean
  isRightCollapsed: boolean
  onLeftCollapseChange?: (collapsed: boolean) => void
  onRightCollapseChange?: (collapsed: boolean) => void
  leftSize?: number
  rightSize?: number
  onLeftSizeChange?: (size: number) => void
  onRightSizeChange?: (size: number) => void
}

export function PanelLayout({
  leftPanel,
  centerPanel,
  rightPanel,
  isLeftCollapsed,
  isRightCollapsed,
  onLeftCollapseChange,
  onRightCollapseChange,
  leftSize = DEFAULT_TILDA_SIZE,
  rightSize = DEFAULT_NAV_SIZE,
  onLeftSizeChange,
  onRightSizeChange
}: PanelLayoutProps) {
  const [leftPanelHandle, setLeftPanelHandle] = usePanelCallbackRef()
  const [rightPanelHandle, setRightPanelHandle] = usePanelCallbackRef()

  // Track previous values to only react to changes, not initial mount
  const prevLeftCollapsed = useRef(isLeftCollapsed)
  const prevRightCollapsed = useRef(isRightCollapsed)
  const initializedRef = useRef(false)

  // Restore saved sizes on initial mount.
  // We capture the current values in refs to avoid stale closure issues,
  // since this effect only runs once when panel handles become available.
  const leftSizeRef = useRef(leftSize)
  const rightSizeRef = useRef(rightSize)
  leftSizeRef.current = leftSize
  rightSizeRef.current = rightSize

  useEffect(() => {
    if (initializedRef.current) return
    if (!leftPanelHandle || !rightPanelHandle) return

    initializedRef.current = true

    // Defer resize to next frame to ensure the panel library has finished
    // its internal layout calculations after mounting
    requestAnimationFrame(() => {
      if (leftSizeRef.current !== DEFAULT_TILDA_SIZE && !isLeftCollapsed) {
        leftPanelHandle.resize(`${leftSizeRef.current}%`)
      }
      if (rightSizeRef.current !== DEFAULT_NAV_SIZE && !isRightCollapsed) {
        rightPanelHandle.resize(`${rightSizeRef.current}%`)
      }
    })
  }, [leftPanelHandle, rightPanelHandle, isLeftCollapsed, isRightCollapsed])

  // Handle collapse state changes (only when state actually changes)
  useEffect(() => {
    if (!leftPanelHandle) return
    if (prevLeftCollapsed.current === isLeftCollapsed) return

    prevLeftCollapsed.current = isLeftCollapsed
    if (isLeftCollapsed) {
      leftPanelHandle.collapse()
    } else {
      // Expand first, then resize in next frame after expand animation completes
      leftPanelHandle.expand()
      requestAnimationFrame(() => {
        leftPanelHandle.resize(`${leftSize}%`)
      })
    }
  }, [isLeftCollapsed, leftPanelHandle, leftSize])

  useEffect(() => {
    if (!rightPanelHandle) return
    if (prevRightCollapsed.current === isRightCollapsed) return

    prevRightCollapsed.current = isRightCollapsed
    if (isRightCollapsed) {
      rightPanelHandle.collapse()
    } else {
      // Expand first, then resize in next frame after expand animation completes
      rightPanelHandle.expand()
      requestAnimationFrame(() => {
        rightPanelHandle.resize(`${rightSize}%`)
      })
    }
  }, [isRightCollapsed, rightPanelHandle, rightSize])

  // Track collapse state and size from user dragging panels
  const handleLeftResize = useCallback((size: PanelSize) => {
    const collapsed = size.inPixels === 0
    if (collapsed !== isLeftCollapsed) {
      onLeftCollapseChange?.(collapsed)
    }
    if (!collapsed && size.asPercentage > 0) {
      onLeftSizeChange?.(size.asPercentage)
    }
  }, [isLeftCollapsed, onLeftCollapseChange, onLeftSizeChange])

  const handleRightResize = useCallback((size: PanelSize) => {
    const collapsed = size.inPixels === 0
    if (collapsed !== isRightCollapsed) {
      onRightCollapseChange?.(collapsed)
    }
    if (!collapsed && size.asPercentage > 0) {
      onRightSizeChange?.(size.asPercentage)
    }
  }, [isRightCollapsed, onRightCollapseChange, onRightSizeChange])

  return (
    <Group
      orientation="horizontal"
      id="tilda-sidebar-layout"
      className="h-full w-full"
    >
      {/* Left: Navigation Sidebar */}
      <Panel
        panelRef={setLeftPanelHandle as React.Ref<PanelImperativeHandle>}
        id="nav-sidebar"
        defaultSize="13%"
        minSize="180px"
        maxSize="320px"
        collapsible
        collapsedSize="0px"
        onResize={handleLeftResize}
        className="overflow-hidden"
      >
        {leftPanel}
      </Panel>

      <Separator className="w-1 bg-border-light hover:bg-accent-blue transition-colors cursor-col-resize" />

      {/* Center: Main Content */}
      <Panel
        id="main-content"
        defaultSize="60%"
        minSize="30%"
        className="overflow-hidden"
      >
        {centerPanel}
      </Panel>

      <Separator className="w-1 bg-border-light hover:bg-accent-blue transition-colors cursor-col-resize" />

      {/* Right: Tilda Chat Sidebar */}
      <Panel
        panelRef={setRightPanelHandle as React.Ref<PanelImperativeHandle>}
        id="tilda-sidebar"
        defaultSize="40%"
        minSize="260px"
        maxSize="480px"
        collapsible
        collapsedSize="0px"
        onResize={handleRightResize}
        className="overflow-hidden"
      >
        {rightPanel}
      </Panel>
    </Group>
  )
}
