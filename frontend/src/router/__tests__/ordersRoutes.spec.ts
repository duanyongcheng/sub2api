import { describe, expect, it } from 'vitest'
import type { RouteRecordRaw } from 'vue-router'

/**
 * 订单三页合并（原型 08）的路由契约。
 *
 * 这些断言存在的理由：旧地址是别人书签里的东西。合并页面可以改，
 * 但 /admin/orders/dashboard 这类入口一旦 404，用户会以为系统坏了。
 */
const { routes } = await import('@/router')

function find(path: string): RouteRecordRaw | undefined {
  return routes.find(route => route.path === path)
}

describe('orders route merge', () => {
  it('serves one orders page and keeps no duplicate list routes', () => {
    const orders = routes.filter(route => route.path.startsWith('/admin/orders') && !('redirect' in route && route.redirect))
    expect(orders).toHaveLength(1)
    expect(orders[0].path).toBe('/admin/orders')
    expect(orders[0].name).toBe('AdminOrders')
    expect(orders[0].meta?.requiresPayment).toBe(true)
    expect(orders[0].meta?.requiresAdmin).toBe(true)
  })

  it('redirects every legacy orders path onto the matching tab', () => {
    const expected: Record<string, string> = {
      '/admin/orders/dashboard': 'overview',
      '/admin/orders/plans': 'plans',
      '/admin/orders/list': 'list',
    }
    for (const [path, tab] of Object.entries(expected)) {
      const record = find(path)
      expect(record, path).toBeDefined()
      expect(record?.redirect).toMatchObject({ path: '/admin/orders', query: { tab } })
    }
  })

  it('does not leave duplicate route names behind', () => {
    const names = routes.map(route => route.name).filter(Boolean)
    expect(new Set(names).size).toBe(names.length)
  })
})
