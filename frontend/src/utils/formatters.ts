/**
 * 格式化缓存 token 数量（1K/1M 缩写）
 */
export function formatCacheTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
  return tokens.toLocaleString()
}

/**
 * 缓存命中率 = 缓存读取 / (输入 + 缓存创建 + 缓存读取)
 * 分母为 0 或没有读到缓存时返回 null（调用方据此隐藏展示）。
 */
export function cacheHitRate(row: {
  input_tokens?: number | null
  cache_creation_tokens?: number | null
  cache_read_tokens?: number | null
}): number | null {
  const cacheRead = row.cache_read_tokens || 0
  const total = (row.input_tokens || 0) + (row.cache_creation_tokens || 0) + cacheRead
  if (cacheRead <= 0 || total <= 0) return null
  return cacheRead / total
}

/**
 * 格式化缓存命中率（入参为 0~1 的比例），返回带 % 的字符串。
 * - 只有精确等于 1 时才显示 "100%"，其余最多显示到 "99.99%"（不做 >99.99% 之类的修饰）
 * - 精度自适应：≥99.9% 保留 2 位小数，其余保留 1 位
 * - 四舍五入到 0% 的极小非零值显示 "<0.01%"，避免被误读成没有命中
 * - 传 null（没有缓存读取）时返回空字符串，调用方应自行隐藏
 */
export function formatCacheHitRate(rate: number | null): string {
  if (rate == null) return ''
  const percent = rate * 100
  if (percent <= 0) return '<0.01%'
  if (rate >= 1) return '100%'
  const digits = percent >= 99.9 ? 2 : 1
  // 未达 100% 的命中率哪怕四舍五入到 100.00 也封顶为 99.99%
  const rounded = Math.min(Number(percent.toFixed(digits)), 99.99)
  if (rounded === 0) return '<0.01%'
  return `${rounded.toFixed(digits)}%`
}

/**
 * 自适应精度格式化倍率：保留至多 4 位小数并去掉末尾多余的 0，
 * 但至少保留 2 位小数（0.035 -> "0.035"，0.3 -> "0.30"，1 -> "1.00"）
 */
export function formatMultiplier(val: number): string {
  if (val < 0.0001) return val.toPrecision(2)
  return val.toFixed(4).replace(/(\.\d{2}\d*?)0+$/, '$1')
}
