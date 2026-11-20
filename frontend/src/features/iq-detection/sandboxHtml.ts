import type { IQDetectionRun, IQDetectionSample } from './types'

/**
 * 严格断网与隔离 CSP：禁止任何外部网络请求、图片外链、字体外链、表单提交与框架嵌套，
 * 仅允许内联样式与内联脚本在无 allow-same-origin 的 iframe 沙箱中运行 2D SVG 动画。
 */
export const PELICAN_SANDBOX_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:;"

const SANDBOX_GUARD_HEAD = `<meta http-equiv="Content-Security-Policy" content="${PELICAN_SANDBOX_CSP}"><style data-iq-stage>html,body{margin:0!important;padding:0!important;width:100%!important;height:100%!important;overflow:hidden!important;display:flex!important;align-items:center!important;justify-content:center!important;}svg{max-width:100%!important;max-height:100%!important;width:auto;height:auto;}</style>`

/**
 * 将模型生成的 HTML/SVG 工件封装为带强制断网 CSP 与自适应居中舞台样式的 iframe srcdoc。
 */
export function buildSandboxedPelicanSrcdoc(rawHtml: string): string {
  const trimmed = (rawHtml || '').trim()
  if (!trimmed) {
    return ''
  }

  // 移除可能劫持相对 URL 的 <base> 标签
  const cleaned = trimmed.replace(/<base\b[^>]*>/gi, '')

  if (/<head\b[^>]*>/i.test(cleaned)) {
    return cleaned.replace(/<head\b[^>]*>/i, (match) => `${match}${SANDBOX_GUARD_HEAD}`)
  }
  if (/<html\b[^>]*>/i.test(cleaned)) {
    return cleaned.replace(/<html\b[^>]*>/i, (match) => `${match}<head>${SANDBOX_GUARD_HEAD}</head>`)
  }
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">${SANDBOX_GUARD_HEAD}</head><body>${cleaned}</body></html>`
}

export function pickPrimaryPelicanSample(run: IQDetectionRun | null | undefined): IQDetectionSample | null {
  if (!run || !Array.isArray(run.samples) || run.samples.length === 0) {
    return null
  }
  const withArtifact = run.samples.find((s) => Boolean(s.artifact_html && s.artifact_html.trim()))
  return withArtifact ?? run.samples[0] ?? null
}
