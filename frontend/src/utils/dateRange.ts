const DAY_MS = 86_400_000

export function getLast24HoursRange(): { start: string; end: string } {
  const end = new Date()
  return {
    start: new Date(end.getTime() - DAY_MS).toISOString(),
    end: end.toISOString(),
  }
}

export function isLast24HoursRange(start: string, end: string): boolean {
  return start.includes('T') && end.includes('T')
    && new Date(end).getTime() - new Date(start).getTime() === DAY_MS
}

export function getDateRangeGranularity(start: string, end: string): 'day' | 'hour' {
  const startTime = new Date(start.includes('T') ? start : `${start}T00:00:00`).getTime()
  const endTime = new Date(end.includes('T') ? end : `${end}T00:00:00`).getTime()
  return Math.ceil((endTime - startTime) / DAY_MS) <= 1 ? 'hour' : 'day'
}
