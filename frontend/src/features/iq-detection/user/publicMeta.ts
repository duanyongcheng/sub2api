import type { IQDetectionBenchmarkType, IQDetectionVerdict } from '../types'
import { IQ_DETECTION_BENCHMARK_OPTIONS } from '../verdictMeta'
import type { DisplayVerdict } from '../verdictMeta'
import type { IQDetectionPublicOverview, IQDetectionPublicRun } from './publicTypes'

const KNOWN_VERDICTS: readonly IQDetectionVerdict[] = ['normal', 'warning', 'degraded', 'error']

export function isKnownBenchmark(raw: unknown): raw is IQDetectionBenchmarkType {
  return typeof raw === 'string' && (IQ_DETECTION_BENCHMARK_OPTIONS as readonly string[]).includes(raw)
}

export function toDisplayVerdict(raw: unknown): DisplayVerdict {
  return typeof raw === 'string' && (KNOWN_VERDICTS as readonly string[]).includes(raw)
    ? (raw as IQDetectionVerdict)
    : 'untested'
}

/**
 * Benchmarks to present, in canonical order: the enabled ones first, plus any
 * benchmark that still has a latest run (e.g. disabled after it ran).
 */
export function resolvePublicBenchmarks(
  overview: Pick<IQDetectionPublicOverview, 'benchmark_types' | 'groups'> | null
): IQDetectionBenchmarkType[] {
  if (!overview) return []
  const selected = new Set<IQDetectionBenchmarkType>()
  for (const raw of overview.benchmark_types ?? []) {
    if (isKnownBenchmark(raw)) selected.add(raw)
  }
  for (const group of overview.groups ?? []) {
    for (const key of Object.keys(group.latest_runs_by_benchmark ?? {})) {
      if (isKnownBenchmark(key)) selected.add(key)
    }
  }
  return IQ_DETECTION_BENCHMARK_OPTIONS.filter((b) => selected.has(b))
}

/** 0..100 score for a run, or null when the run produced nothing gradable. */
export function resolvePublicRunScore(run: IQDetectionPublicRun): number | null {
  if (run.benchmark_type === 'pelican_svg') {
    if (typeof run.avg_score === 'number' && Number.isFinite(run.avg_score)) {
      return clampScore(run.avg_score)
    }
    const artifact = run.artifacts?.[0]
    if (artifact && Number.isFinite(artifact.score)) return clampScore(artifact.score)
    return null
  }
  const graded = run.graded_count > 0 ? run.graded_count : 0
  if (graded <= 0) return null
  return clampScore((run.correct_count / graded) * 100)
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, n))
}

export type ResultTextKey = 'correct' | 'score' | 'none'

export interface PublicRunResult {
  key: ResultTextKey
  params: Record<string, number>
}

export function describePublicRunResult(run: IQDetectionPublicRun): PublicRunResult {
  if (run.benchmark_type === 'pelican_svg') {
    const score = resolvePublicRunScore(run)
    return score == null
      ? { key: 'none', params: {} }
      : { key: 'score', params: { score: Math.round(score) } }
  }
  const total = run.graded_count || run.tests_count
  if (!total || run.graded_count <= 0) return { key: 'none', params: {} }
  return { key: 'correct', params: { correct: run.correct_count, total } }
}

export function pickPublicArtifactHtml(run: IQDetectionPublicRun | null | undefined): string {
  if (!run || !Array.isArray(run.artifacts)) return ''
  const withHtml = run.artifacts.find((a) => typeof a?.html === 'string' && a.html.trim() !== '')
  return withHtml?.html.trim() ?? ''
}

export function runTimestamp(run: IQDetectionPublicRun): string {
  return run.completed_at || run.started_at
}
