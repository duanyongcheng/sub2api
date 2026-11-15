import type { IQDetectionIntervalMinutes, IQDetectionVerdict } from './types'

export type DisplayVerdict = IQDetectionVerdict | 'untested' | 'inFlight'

export const IQ_DETECTION_INTERVAL_OPTIONS: readonly IQDetectionIntervalMinutes[] = [
  30,
  60,
  360,
  720,
  1440
]

export function isValidIntervalMinutes(val: unknown): val is IQDetectionIntervalMinutes {
  return (
    typeof val === 'number' &&
    (IQ_DETECTION_INTERVAL_OPTIONS as readonly number[]).includes(val)
  )
}

export function resolveConfigIntervalMinutes(cfg: {
  interval_minutes?: number
  interval_hours?: number
}): IQDetectionIntervalMinutes {
  if (isValidIntervalMinutes(cfg.interval_minutes)) {
    return cfg.interval_minutes
  }
  if (typeof cfg.interval_hours === 'number') {
    const converted = cfg.interval_hours * 60
    if (isValidIntervalMinutes(converted)) {
      return converted
    }
  }
  return 720
}

export function verdictBadgeClasses(verdict: DisplayVerdict): string {
  switch (verdict) {
    case 'normal':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-900/25 dark:text-emerald-300 dark:ring-emerald-500/30'
    case 'warning':
      return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-900/25 dark:text-amber-300 dark:ring-amber-500/30'
    case 'degraded':
      return 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20 dark:bg-rose-900/25 dark:text-rose-300 dark:ring-rose-500/30'
    case 'error':
      return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/25 dark:text-red-300 dark:ring-red-500/30'
    case 'inFlight':
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/25 dark:text-blue-300 dark:ring-blue-500/30'
    default:
      return 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-500/15 dark:bg-dark-700 dark:text-gray-300 dark:ring-dark-600'
  }
}

export function verdictDotClasses(verdict: DisplayVerdict): string {
  switch (verdict) {
    case 'normal':
      return 'bg-emerald-500'
    case 'warning':
      return 'bg-amber-500'
    case 'degraded':
      return 'bg-rose-500'
    case 'error':
      return 'bg-red-500'
    case 'inFlight':
      return 'bg-blue-500 animate-pulse'
    default:
      return 'bg-gray-400 dark:bg-gray-500'
  }
}

export function formatLatencyMs(ms: number | null | undefined): string {
  if (ms == null || ms <= 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function formatTps(tps: number | null | undefined): string {
  if (tps == null || tps <= 0) return '—'
  return `${tps.toFixed(1)} t/s`
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}
