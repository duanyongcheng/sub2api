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
  /**
   * Narrow screens: this column becomes the card title (avatar/name/status row),
   * and the remaining columns collapse behind "show details".
   * When omitted, DataTable falls back to the first non-empty column, because
   * that is the identity column on every list page in this app.
   */
  mobilePrimary?: boolean
  /** Narrow screens: keep this column visible in the collapsed card body. */
  mobileAlways?: boolean
}
