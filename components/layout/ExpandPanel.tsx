"use client"

import {
  useCallback, useEffect, useMemo, useRef, useState,
  type FC, type PropsWithChildren,
} from "react"
import { cn } from "@/lib/utils"

const MIN_SIZE = 300
const DEFAULT_SIZE = 600
const STORAGE_KEY = "expand-panel-size"

export const ExpandPanel: FC<PropsWithChildren<{ className?: string; visible?: boolean }>> = ({
  children, visible, className,
}) => {
  const [size, setSize] = useState(DEFAULT_SIZE)

  useEffect(() => {
    const stored = Number(localStorage.getItem(STORAGE_KEY))
    if (stored && stored >= MIN_SIZE) setSize(stored)
  }, [])
  const [sashSize, setSashSize] = useState(0)
  const sashRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  useEffect(() => {
    setSashSize(sashRef.current?.offsetWidth ?? 0)
  }, [])

  const right = useMemo(() => (size ? size - sashSize / 2 : 0), [size, sashSize])

  const onPointerMove = useCallback((e: PointerEvent) => {
    e.preventDefault()
    if (!draggingRef.current) return
    const newSize = Math.max(document.body.clientWidth - e.pageX, MIN_SIZE)
    setSize(newSize)
    localStorage.setItem(STORAGE_KEY, String(newSize))
  }, [])

  const onPointerUp = useCallback(() => {
    draggingRef.current = false
    window.removeEventListener("pointermove", onPointerMove)
    window.removeEventListener("pointerup", onPointerUp)
  }, [onPointerMove])

  const onPointerDown = useCallback(() => {
    draggingRef.current = true
    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
  }, [onPointerMove, onPointerUp])

  if (!visible) return <>{children}</>

  return (
    <div
      className={cn(
        "absolute h-full top-0 right-0 bg-background z-20",
        "before:absolute before:w-px before:h-full before:top-0 before:bg-[var(--separator-border)]",
        className
      )}
      style={{ width: size + "px" }}
    >
      <div
        ref={sashRef}
        className={cn(
          "absolute w-[var(--sash-size)] h-full top-0 cursor-col-resize z-10",
          "before:absolute before:w-[var(--sash-hover-size)] before:h-full",
          "before:left-[calc(50%-(var(--sash-hover-size)/2))]",
          "before:transition-colors before:duration-100",
          "before:hover:bg-[var(--focus-border)]"
        )}
        style={{ right: right + "px" }}
        onPointerDown={onPointerDown}
      />
      {children}
    </div>
  )
}
