import { describe, expect, it } from 'vitest'
import { cacheHitRate, formatCacheHitRate } from '@/utils/formatters'

describe('cacheHitRate', () => {
  it('计算 缓存读取 / (输入 + 缓存创建 + 缓存读取)', () => {
    expect(cacheHitRate({ input_tokens: 100, cache_creation_tokens: 100, cache_read_tokens: 800 })).toBeCloseTo(0.8)
  })

  it('没有缓存读取时返回 null（调用方隐藏 0%）', () => {
    expect(cacheHitRate({ input_tokens: 100, cache_creation_tokens: 0, cache_read_tokens: 0 })).toBeNull()
    expect(cacheHitRate({ input_tokens: 100 })).toBeNull()
  })

  it('分母为 0 或字段缺失时返回 null', () => {
    expect(cacheHitRate({})).toBeNull()
    expect(cacheHitRate({ input_tokens: null, cache_creation_tokens: null, cache_read_tokens: null })).toBeNull()
  })
})

describe('formatCacheHitRate', () => {
  it('常规命中率保留 1 位小数', () => {
    expect(formatCacheHitRate(0.783)).toBe('78.3%')
    expect(formatCacheHitRate(0.5)).toBe('50.0%')
  })

  it('接近满命中率时保留 2 位小数', () => {
    // 输入 218 + 缓存读取 705664 -> 99.969%
    expect(formatCacheHitRate(705_664 / (218 + 705_664))).toBe('99.97%')
  })

  it('未达 100% 时即使四舍五入到满值也只显示 99.99%', () => {
    expect(formatCacheHitRate(0.999999)).toBe('99.99%')
    expect(formatCacheHitRate(0.99996)).toBe('99.99%')
    expect(formatCacheHitRate(0.999999)).not.toContain('100')
  })

  it('只有精确 100% 才显示 100%', () => {
    expect(formatCacheHitRate(1)).toBe('100%')
  })

  it('极小但非零的值不被显示成 0%', () => {
    expect(formatCacheHitRate(0.00001)).toBe('<0.01%')
  })

  it('没有缓存读取时返回空字符串', () => {
    expect(formatCacheHitRate(null)).toBe('')
  })
})
