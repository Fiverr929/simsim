"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, RefreshCw, CheckCircle2, ShoppingBag, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  baseId: string
  shopName?: string | null
  onConnected: (shopName: string) => void
  onDisconnected: () => void
  onClose: () => void
}

export function EtsyConnectDialog({ baseId, shopName, onConnected, onDisconnected, onClose }: Props) {
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const handleConnect = () => {
    window.location.href = `/api/etsy/oauth/start?baseId=${baseId}`
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch(`/api/etsy/sync/${baseId}`, { method: "POST" })
      if (!res.ok) throw new Error()
      toast.success("Store data synced")
      window.dispatchEvent(new CustomEvent("etsy:store-updated"))
      onConnected(shopName ?? "")
    } catch {
      toast.error("Sync failed — try again")
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      const res = await fetch(`/api/etsy/disconnect?baseId=${baseId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Store disconnected")
      window.dispatchEvent(new CustomEvent("etsy:store-updated"))
      onDisconnected()
    } catch {
      toast.error("Failed to disconnect")
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl border p-5 w-80 flex flex-col gap-4">

        <div>
          <p className="text-sm font-semibold text-neutral-900">Etsy Store</p>
          <p className="text-xs text-neutral-500 mt-1">
            {shopName ? "Manage your connected store." : "Connect your Etsy store to enable automations and publishing."}
          </p>
        </div>

        {shopName ? (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle2 size={14} className="text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-green-800 truncate">{shopName}</p>
              <p className="text-[11px] text-green-600">Connected</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-orange-50 border border-orange-200 rounded-lg">
            <ShoppingBag size={14} className="text-orange-400 shrink-0" />
            <p className="text-xs text-orange-700">No store connected yet</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button
            onClick={handleConnect}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white text-xs gap-2"
          >
            <ShoppingBag size={13} />
            {shopName ? "Reconnect with Etsy" : "Connect with Etsy"}
          </Button>

          {shopName && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              className="w-full text-xs gap-1.5 text-neutral-600"
            >
              {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Sync store data
            </Button>
          )}

          {shopName && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="w-full text-xs gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              {disconnecting ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
              Disconnect store
            </Button>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}
