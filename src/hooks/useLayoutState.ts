import { useState, useEffect, useCallback } from 'react'

interface LayoutState {
  isTildaCollapsed: boolean
  isNavCollapsed: boolean
}

const STORAGE_KEY = 'tilda-layout-state'
const DEFAULT_STATE: LayoutState = {
  isTildaCollapsed: false,
  isNavCollapsed: false
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

  return {
    ...state,
    toggleTilda,
    toggleNav,
    setTildaCollapsed,
    setNavCollapsed
  }
}
