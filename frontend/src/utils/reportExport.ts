/**
 * Shared report export for admin pages (运营概览 / 渠道监控下钻).
 *
 * Two rules that matter more than the file format:
 *   1. Every number carries its basis in the header (口径写进表头), because a
 *      spreadsheet is read away from the UI that explained it.
 *   2. Unknown is written as "数据不足" / "not covered yet", never as 0 or 100%.
 *      A silent zero in a CSV becomes a wrong decision in a meeting.
 */
import { saveAs } from 'file-saver'

export interface WorkbookSheet {
  /** Sheet name; Excel caps this at 31 characters. */
  name: string
  rows: Array<Array<string | number | null | undefined>>
}

/** Excel rejects sheet names over 31 chars and the characters : \ / ? * [ ]. */
export function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, ' ').trim()
  return (cleaned || 'Sheet').slice(0, 31)
}

/**
 * RFC 4180 quoting plus the spreadsheet formula guard: a cell starting with
 * = + - @ would execute on open, so those are prefixed with a quote.
 */
export function escapeCsvValue(value: unknown): string {
  if (value == null) return ''
  const str = String(value)
  const escaped = str.replace(/"/g, '""')
  // A lone "-" is our own "not available" marker, not a formula.
  if (str === '-') return str
  if (/^[=+\-@\t\r]/.test(str)) return `"\'${escaped}"`
  if (/[,"\n\r]/.test(str)) return `"${escaped}"`
  return str
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map(row => row.map(escapeCsvValue).join(',')).join('\r\n')
}

export function csvBlob(rows: Array<Array<string | number | null | undefined>>): Blob {
  // BOM so Excel on Windows detects UTF-8 instead of mojibake.
  return new Blob(['\uFEFF' + toCsv(rows)], { type: 'text/csv;charset=utf-8;' })
}

export type ExportFormat = 'xlsx' | 'csv'

/** Builds a Blob for either format; xlsx is imported lazily so the page stays light. */
export async function buildExportBlob(sheets: WorkbookSheet[], format: ExportFormat): Promise<Blob> {
  if (format === 'csv') {
    const first = sheets[0]
    return csvBlob(first ? first.rows : [])
  }
  const XLSX = await import('xlsx')
  const book = XLSX.utils.book_new()
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(sheet.rows), sanitizeSheetName(sheet.name))
  }
  return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' })], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export async function downloadReport(options: {
  sheets: WorkbookSheet[]
  format: ExportFormat
  /** Base file name without extension; the report date range is appended by the caller. */
  fileName: string
}): Promise<void> {
  const blob = await buildExportBlob(options.sheets, options.format)
  const extension = options.format === 'csv' ? 'csv' : 'xlsx'
  saveAs(blob, `${options.fileName}.${extension}`)
}

/** `2026-11-02_to_2026-11-08` — stable, sortable, no locale surprises. */
export function reportFileStem(prefix: string, start: string, end: string, extra?: string): string {
  const suffix = extra ? `_${extra}` : ''
  return `${prefix}_${start}_to_${end}${suffix}`
}
