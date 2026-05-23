import type { ListingSettings } from "@/types/listing-settings"
import type { Automation } from "@/types/automation"

export type FieldType =
  | "text"
  | "longText"
  | "number"
  | "singleSelect"
  | "multiSelect"
  | "date"
  | "checkbox"
  | "attachment"
  | "url"

export interface SelectOption {
  id: string
  label: string
  color: string
}

export interface FieldConfig {
  options?: SelectOption[]
  dateFormat?: string
  numberFormat?: "integer" | "decimal" | "currency" | "percent"
  currency?: string
}

export interface Field {
  id: string
  name: string
  type: FieldType
  config: FieldConfig
  order: number
  isPrimary: boolean
  tableId: string
}

export type CellValue = string | number | boolean | string[] | null

export interface AppRecord {
  id: string
  createdAt: string
  updatedAt: string
  order: number
  data: Record<string, CellValue>
  tableId: string
}

export type ViewType = "grid" | "gallery" | "kanban" | "calendar" | "form"

export type FilterOperator =
  | "is"
  | "isNot"
  | "contains"
  | "doesNotContain"
  | "isEmpty"
  | "isNotEmpty"
  | "gt"
  | "lt"

export interface Filter {
  fieldId: string
  operator: FilterOperator
  value: CellValue
}

export interface Sort {
  fieldId: string
  direction: "asc" | "desc"
}

export interface ViewConfig {
  hiddenFields?: string[]
  filters?: Filter[]
  sorts?: Sort[]
  groupFieldId?: string
  coverFieldId?: string
  dateFieldId?: string
  colorFieldId?: string
  rowHeight?: number
  fieldOrder?: string[]
  formTitle?: string
  formDescription?: string
  requiredFieldIds?: string[]
}

export interface View {
  id: string
  name: string
  type: ViewType
  config: ViewConfig
  order: number
  tableId: string
}

export interface AppTable {
  id: string
  name: string
  order: number
  baseId: string
  fields: Field[]
  views: View[]
}

export interface BaseConfig {
  integration?: "etsy" | string
  listingSettings?: ListingSettings
  automations?: Automation[]
}

export interface Base {
  id: string
  name: string
  icon: string
  config: BaseConfig
  spaceId: string
  tables: AppTable[]
  etsyConnected?: boolean
  etsyShopName?: string | null
}

export interface Space {
  id: string
  name: string
  icon: string
  createdAt: string
}
