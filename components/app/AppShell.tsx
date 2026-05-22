"use client"

import { AppProvider } from "@/components/app/AppContext"
import { TopNav } from "@/components/app/TopNav"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { BaseSidebar } from "@/components/app/BaseSidebar"
import { TableView } from "@/components/table/TableView"

export function AppShell() {
  return (
    <AppProvider>
      <div className="h-full flex flex-col overflow-hidden">
        <TopNav />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <AppSidebar>
            <BaseSidebar />
          </AppSidebar>
          <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <TableView />
          </main>
        </div>
      </div>
    </AppProvider>
  )
}
