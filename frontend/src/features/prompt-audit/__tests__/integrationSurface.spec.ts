import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import en from '@/i18n/locales/en'
import zh from '@/i18n/locales/zh'
import { routes } from '@/router'

const here = dirname(fileURLToPath(import.meta.url))
const read = (path: string) => readFileSync(resolve(here, path), 'utf8')

describe('Prompt Audit integration surface', () => {
  it.each(['', '?search=blocked&tag=policy&tag=review#events'])(
    'redirects the security audit parent to content moderation with URL state "%s"',
    async (suffix) => {
      const router = createRouter({
        history: createMemoryHistory(),
        // Keep production route records while avoiding lazy view imports.
        routes: routes.map(route => ({ ...route, component: { render: () => null } }))
      })

      await router.push(`/admin/security-audit${suffix}`)

      expect(router.currentRoute.value).toMatchObject({
        fullPath: `/admin/risk-control${suffix}`,
        name: 'AdminRiskControl',
        meta: {
          requiresAuth: true,
          requiresAdmin: true,
          requiresRiskControl: true
        }
      })
    }
  )

  it('registers an admin and risk-control guarded route', () => {
    const router = read('../../../router/index.ts')
    expect(router).toContain("path: '/admin/prompt-audit'")
    const route = router.slice(router.indexOf("path: '/admin/prompt-audit'"), router.indexOf("path: '/admin/usage'"))
    expect(route).toContain('requiresAuth: true')
    expect(route).toContain('requiresAdmin: true')
    expect(route).toContain('requiresRiskControl: true')
  })

  it('keeps the legacy content moderation route and adds both pages under the security system group', () => {
    const sidebar = read('../../../components/layout/AppSidebar.vue')
    // The redesigned sidebar no longer nests security pages under a separate
    // "redeem" sibling: 安全审计 lives in the `system` group's item list.
    const start = sidebar.indexOf("path: '/admin/security-audit'")
    const group = sidebar.slice(start, sidebar.indexOf('NavItem[] = [', start))
    expect(group).toContain("path: '/admin/risk-control'")
    expect(group).toContain("path: '/admin/prompt-audit'")
  })

  it('keeps Prompt Audit locale trees symmetric and all operational controls named', () => {
    expect(Object.keys(zh.admin.promptAudit)).toEqual(Object.keys(en.admin.promptAudit))
    expect(zh.nav.securityAudit).toBeTruthy()
    expect(en.nav.securityAudit).toBeTruthy()
    const endpoint = read('../components/EndpointPool.vue')
    const events = read('../components/EventWorkspace.vue')
    expect(endpoint).toContain('aria-label')
    expect(events).toContain('aria-label')
    expect(events).toContain('overflow-x-auto')
    expect(events).toContain('sm:grid-cols-2')
  })
})
