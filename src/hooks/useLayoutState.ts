import { useState, useEffect, useCallback } from 'react'

// Default panel sizes as percentages
export const DEFAULT_TILDA_SIZE = 40
export const DEFAULT_NAV_SIZE = 13

interface LayoutState {
  isTildaCollapsed: boolean
  isNavCollapsed: boolean
  tildaSize: number
  navSize: number
}

const STORAGE_KEY = 'tilda-layout-state'
const DEFAULT_STATE: LayoutState = {
  isTildaCollapsed: false,
  isNavCollapsed: false,
  tildaSize: DEFAULT_TILDA_SIZE,
  navSize: DEFAULT_NAV_SIZE
}

export function useLayoutState() {
  const [state, setState] = useState<LayoutState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? { ...DEFAULT_STATE, ...JSON.parse(stored) } : DEFAULT_STATE
    } catch {
      return DEFAULT_STATE
    }
  })

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const toggleTilda = useCallback(() => {
    setState(s => ({ ...s, isTildaCollapsed: !s.isTildaCollapsed }))
  }, [])

  const toggleNav = useCallback(() => {
    setState(s => ({ ...s, isNavCollapsed: !s.isNavCollapsed }))
  }, [])

  const setTildaCollapsed = useCallback((collapsed: boolean) => {
    setState(s => ({ ...s, isTildaCollapsed: collapsed }))
  }, [])

  const setNavCollapsed = useCallback((collapsed: boolean) => {
    setState(s => ({ ...s, isNavCollapsed: collapsed }))
  }, [])

  const setTildaSize = useCallback((size: number) => {
    setState(s => ({ ...s, tildaSize: size }))
  }, [])

  const setNavSize = useCallback((size: number) => {
    setState(s => ({ ...s, navSize: size }))
  }, [])

  return {
    ...state,
    toggleTilda,
    toggleNav,
    setTildaCollapsed,
    setNavCollapsed,
    setTildaSize,
    setNavSize
  }
}
