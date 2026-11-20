import type {
  IQDetectionBenchmarkType,
  IQDetectionIntervalMinutes,
  IQDetectionVerdict
} from './types'

export type DisplayVerdict = IQDetectionVerdict | 'untested' | 'inFlight'

export const IQ_DETECTION_BENCHMARK_OPTIONS: readonly IQDetectionBenchmarkType[] = [
  'candy_logic',
  'pelican_svg'
]

export const IQ_DETECTION_INTERVAL_OPTIONS: readonly IQDetectionIntervalMinutes[] = [
  30,
  60,
  360,
  720,
  1440
]

export function normalizeBenchmarkType(raw?: string | null): IQDetectionBenchmarkType {
  return raw === 'pelican_svg' ? 'pelican_svg' : 'candy_logic'
}

export function resolveConfigBenchmarkTypes(cfg?: {
  benchmark_types?: readonly string[] | null
  benchmark_type?: string | null
} | null): IQDetectionBenchmarkType[] {
  if (cfg?.benchmark_types && cfg.benchmark_types.length > 0) {
    const selected = new Set<IQDetectionBenchmarkType>()
    for (const raw of cfg.benchmark_types) {
      if (raw === 'candy_logic' || raw === 'pelican_svg') {
        selected.add(raw)
      }
    }
    const ordered = IQ_DETECTION_BENCHMARK_OPTIONS.filter((b) => selected.has(b))
    if (ordered.length > 0) {
      return ordered
    }
  }
  return [normalizeBenchmarkType(cfg?.benchmark_type)]
}

export function benchmarkBadgeClasses(type: IQDetectionBenchmarkType): string {
  if (type === 'pelican_svg') {
    return 'bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-500/25'
  }
  return 'bg-surface-3 text-ink-2 ring-1 ring-inset ring-edge-strong'
}

export function scoreTextClasses(score: number): string {
  if (score >= 70) return 'text-emerald-700 dark:text-emerald-300'
  if (score >= 45) return 'text-amber-700 dark:text-amber-300'
  return 'text-rose-700 dark:text-rose-300'
}

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
      return 'bg-emerald-500/10 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25'
    case 'warning':
      return 'bg-amber-500/10 text-amber-700 ring-1 ring-inset ring-amber-600/25 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25'
    case 'degraded':
      return 'bg-rose-500/10 text-rose-700 ring-1 ring-inset ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/25'
    case 'error':
      return 'bg-red-500/10 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/25'
    case 'inFlight':
      return 'bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-500/25'
    default:
      return 'bg-surface-3 text-ink-2 ring-1 ring-inset ring-edge-strong'
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
      return 'bg-primary-500 animate-pulse'
    default:
      return 'bg-ink-3'
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
