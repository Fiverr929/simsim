"use client"

import { useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { AppProvider } from "@/components/app/AppContext"
import { TopNav } from "@/components/app/TopNav"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { BaseSidebar } from "@/components/app/BaseSidebar"
import { TableView } from "@/components/table/TableView"

function OAuthCallbackHandler() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const connected = searchParams.get("etsy_connected")
    const error = searchParams.get("etsy_error")
    if (connected) {
      router.replace("/")
      window.dispatchEvent(new CustomEvent("etsy:store-updated"))
      toast.success("Etsy store connected!")
    } else if (error) {
      toast.error(`Etsy connection failed: ${error.replace(/_/g, " ")}`)
      router.replace("/")
    }
  }, [searchParams, router])

  return null
}

export function AppShell() {
  return (
    <AppProvider>
      <OAuthCallbackHandler />
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
