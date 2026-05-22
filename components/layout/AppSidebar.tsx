"use client"

import { ChevronsLeft, ChevronsRight } from "lucide-react"
import { Resizable } from "re-resizable"
import { useCallback, useState, type FC, type PropsWithChildren } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const MIN_WIDTH = 180
const MAX_WIDTH = 400
const DEFAULT_WIDTH = 220

export const AppSidebar: FC<PropsWithChildren<{ className?: string }>> = ({
  children,
  className,
}) => {
  const [visible, setVisible] = useState(true)
  const [width, setWidth] = useState(DEFAULT_WIDTH)

  const toggle = useCallback(() => setVisible((v) => !v), [])
  useHotkeys("mod+b", toggle)

  if (!visible) {
    return (
      <div className="relative shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="fixed left-0 top-6 z-40 rounded-none rounded-r-full px-1 h-7"
          onClick={toggle}
          title="Show sidebar (Mod+B)"
        >
          <ChevronsRight size={14} />
        </Button>
      </div>
    )
  }

  return (
    <Resizable
      className="h-full shrink-0 border-r bg-background"
      size={{ width, height: "100%" }}
      defaultSize={{ width: DEFAULT_WIDTH, height: "100%" }}
      minWidth={MIN_WIDTH}
      maxWidth={MAX_WIDTH}
      enable={{ right: true }}
      onResizeStop={(_e, _d, ref) => {
        const w = parseInt(ref.style.width, 10)
        if (!isNaN(w)) {
          if (w < MIN_WIDTH) setVisible(false)
          else setWidth(w)
        }
      }}
      handleClasses={{ right: "group" }}
      handleStyles={{ right: { width: "6px", right: "-6px" } }}
      handleComponent={{
        right: (
          <div className="h-full w-px bg-transparent transition-colors group-hover:bg-primary/50 group-active:bg-primary" />
        ),
      }}
    >
      <div className={cn("flex h-full flex-col overflow-hidden", className)}>
        <div className="flex h-10 items-center justify-end px-3 border-b shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-neutral-400"
            onClick={toggle}
            title="Hide sidebar (Mod+B)"
          >
            <ChevronsLeft size={14} />
          </Button>
        </div>
        {children}
      </div>
    </Resizable>
  )
}
