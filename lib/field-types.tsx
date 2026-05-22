import { Type, AlignLeft, Hash, ChevronDown, List, Calendar, CheckSquare, Paperclip, Link } from "lucide-react"
import type { FieldType } from "@/types/core"

export const FIELD_TYPE_META: { type: FieldType; label: string; icon: React.ReactNode }[] = [
  { type: "text", label: "Text", icon: <Type size={13} /> },
  { type: "longText", label: "Long text", icon: <AlignLeft size={13} /> },
  { type: "number", label: "Number", icon: <Hash size={13} /> },
  { type: "singleSelect", label: "Single select", icon: <ChevronDown size={13} /> },
  { type: "multiSelect", label: "Multi select", icon: <List size={13} /> },
  { type: "date", label: "Date", icon: <Calendar size={13} /> },
  { type: "checkbox", label: "Checkbox", icon: <CheckSquare size={13} /> },
  { type: "url", label: "URL", icon: <Link size={13} /> },
  { type: "attachment", label: "Attachment", icon: <Paperclip size={13} /> },
]
