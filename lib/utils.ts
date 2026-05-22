import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { FieldConfig } from "@/types/core"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value: number, config?: FieldConfig): string {
  const fmt = config?.numberFormat ?? "decimal"
  const currency = config?.currency ?? "$"
  switch (fmt) {
    case "integer":
      return Math.round(value).toLocaleString()
    case "currency":
      return `${currency}${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`
    case "percent":
      return `${(value * 100).toFixed(1)}%`
    default:
      return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  }
}

export function formatDate(value: string, config?: FieldConfig): string {
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  const fmt = config?.dateFormat ?? "MMM d, yyyy"
  const pad = (n: number) => String(n).padStart(2, "0")
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const fullMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

  return fmt
    .replace("yyyy", String(d.getFullYear()))
    .replace("yy", String(d.getFullYear()).slice(-2))
    .replace("MMMM", fullMonthNames[d.getMonth()])
    .replace("MMM", monthNames[d.getMonth()])
    .replace("MM", pad(d.getMonth() + 1))
    .replace("dd", pad(d.getDate()))
    .replace("d", String(d.getDate()))
}
