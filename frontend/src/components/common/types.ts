/**
 * Common component types
 */

export interface Column {
  key: string
  label: string
  sortable?: boolean
  width?: string
  class?: string
  formatter?: (value: any, row: any) => string
}
