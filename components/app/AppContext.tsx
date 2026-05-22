"use client"

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"

interface AppState {
  activeSpaceId: string | null
  activeBaseId: string | null
  activeTableId: string | null
  activeViewId: string | null
  activeBaseIntegration: string | null
  setActiveSpaceId: (id: string | null) => void
  setActiveBaseId: (id: string | null) => void
  setActiveTableId: (id: string | null) => void
  setActiveViewId: (id: string | null) => void
  setActiveBaseIntegration: (integration: string | null) => void
  openTable: (tableId: string, viewId?: string, baseId?: string) => void
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null)
  const [activeBaseId, setActiveBaseId] = useState<string | null>(null)
  const [activeTableId, setActiveTableId] = useState<string | null>(null)
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [activeBaseIntegration, setActiveBaseIntegration] = useState<string | null>(null)

  const openTable = useCallback((tableId: string, viewId?: string, baseId?: string) => {
    setActiveTableId(tableId)
    setActiveViewId(viewId ?? null)
    if (baseId) setActiveBaseId(baseId)
  }, [])

  return (
    <AppContext.Provider value={{
      activeSpaceId, activeBaseId, activeTableId, activeViewId, activeBaseIntegration,
      setActiveSpaceId, setActiveBaseId, setActiveTableId, setActiveViewId, setActiveBaseIntegration,
      openTable,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used inside AppProvider")
  return ctx
}
