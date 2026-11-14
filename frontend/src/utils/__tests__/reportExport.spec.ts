import { describe, expect, it, vi } from 'vitest'

const { saveAsMock } = vi.hoisted(() => ({ saveAsMock: vi.fn() }))
vi.mock('file-saver', () => ({ saveAs: saveAsMock }))

const writeMock = vi.fn(() => new Uint8Array([1, 2, 3]))
vi.mock('xlsx', () => ({
  utils: {
    book_new: () => ({ SheetNames: [], Sheets: {} }),
    aoa_to_sheet: (rows: unknown[][]) => ({ rows }),
    book_append_sheet: vi.fn(),
  },
  write: writeMock,
}))

import {
  buildExportBlob,
  csvBlob,
  downloadReport,
  escapeCsvValue,
  reportFileStem,
  sanitizeSheetName,
  toCsv,
} from '../reportExport'

describe('report export primitives', () => {
  it('quotes CSV values that would break the table or execute as a formula', () => {
    expect(escapeCsvValue(null)).toBe('')
    expect(escapeCsvValue(undefined)).toBe('')
    expect(escapeCsvValue('plain')).toBe('plain')
    expect(escapeCsvValue('a,b')).toBe('"a,b"')
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""')
    expect(escapeCsvValue('line\nbreak')).toBe('"line\nbreak"')
    // Formula injection guard, without touching our own "-" placeholder.
    expect(escapeCsvValue('=SUM(A1)')).toBe(`"'=SUM(A1)"`)
    expect(escapeCsvValue('-')).toBe('-')
  })

  it('joins rows with CRLF and prefixes a UTF-8 BOM for Excel', async () => {
    expect(toCsv([['a', 1], ['b', 2]])).toBe('a,1\r\nb,2')
    // jsdom's Blob has no .text(); read it the way an <a download> would.
    const blob = csvBlob([['中文']])
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsText(blob)
    })
    // The BOM is consumed as an encoding marker on read, so verify it on the raw bytes:
    // 3-byte BOM + "中文" (6 UTF-8 bytes).
    expect(blob.size).toBe(9)
    expect(text).toBe('中文')
  })

  it('clamps sheet names to Excel limits', () => {
    expect(sanitizeSheetName('Groups')).toBe('Groups')
    expect(sanitizeSheetName('a/b:c*d?[e]')).toBe('a b c d  e')
    expect(sanitizeSheetName('')).toBe('Sheet')
    expect(sanitizeSheetName('x'.repeat(40))).toHaveLength(31)
  })

  it('builds CSV from the first sheet and xlsx through the lazy import', async () => {
    const csv = await buildExportBlob([{ name: 'Summary', rows: [['a', 1]] }], 'csv')
    expect(csv.type).toContain('text/csv')
    const xlsx = await buildExportBlob([{ name: 'Summary', rows: [['a', 1]] }], 'xlsx')
    expect(xlsx.type).toContain('spreadsheetml')
    expect(writeMock).toHaveBeenCalled()
  })

  it('names files after the exported range', async () => {
    saveAsMock.mockClear()
    await downloadReport({ sheets: [{ name: 'Summary', rows: [] }], format: 'csv', fileName: 'dashboard_2026-11-02_to_2026-11-08' })
    expect(saveAsMock).toHaveBeenCalledWith(expect.any(Blob), 'dashboard_2026-11-02_to_2026-11-08.csv')
    expect(reportFileStem('dashboard', '2026-11-02', '2026-11-08')).toBe('dashboard_2026-11-02_to_2026-11-08')
    expect(reportFileStem('channel-monitor', '2026-11-08_1400', '2026-11-08_1430', 'grok')).toBe('channel-monitor_2026-11-08_1400_to_2026-11-08_1430_grok')
  })
})
