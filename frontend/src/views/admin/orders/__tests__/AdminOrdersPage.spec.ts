import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { replace, route, getOrders } = vi.hoisted(() => ({
  replace: vi.fn(),
  route: { path: '/admin/orders', query: {} as Record<string, string> },
  getOrders: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ replace, push: vi.fn() }),
}))

// Other API modules import the default export while pulling this file in, so both must exist.
vi.mock('@/api/admin/payment', () => ({
  adminPaymentAPI: { getOrders },
  default: { getOrders },
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

// The three panels are separate pages with their own data needs; stub them so this
// spec only covers the tab shell (mount, load-once, deep links, attention strip).
// vi.mock is hoisted, so the stubs and spies must come from vi.hoisted.
const { panelInit, OverviewStub, ListStub, PlansStub } = vi.hoisted(() => {
  const init = { overview: vi.fn(), list: vi.fn(), plans: vi.fn() }
  const panel = (name: 'overview' | 'list' | 'plans') => ({
    setup(_props: unknown, { expose }: { expose: (value: unknown) => void }) {
      expose({ init: init[name] })
      return () => null
    },
  })
  return { panelInit: init, OverviewStub: panel('overview'), ListStub: panel('list'), PlansStub: panel('plans') }
})
vi.mock('../AdminPaymentDashboardView.vue', () => ({ default: OverviewStub }))
vi.mock('../AdminOrdersView.vue', () => ({ default: ListStub }))
vi.mock('../AdminPaymentPlansView.vue', () => ({ default: PlansStub }))

import AdminOrdersPage from '../AdminOrdersPage.vue'

function mountPage() {
  return mount(AdminOrdersPage, {
    global: {
      plugins: [createPinia()],
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        PageHeader: { template: '<div><slot name="actions" /></div>' },
        ActionStrip: { props: ['items', 'count', 'title'], template: '<div data-testid="action-strip">{{ count }}</div>' },
        Icon: true,
      },
    },
  })
}

describe('AdminOrdersPage (merged orders tabs)', () => {
  beforeEach(() => {
    route.path = '/admin/orders'
    route.query = {}
    replace.mockReset()
    getOrders.mockReset()
    getOrders.mockResolvedValue({ data: { items: [], total: 0 } })
    for (const fn of Object.values(panelInit)) fn.mockReset()
  })

  it('opens on the order list and loads only that panel', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.get('[data-orders-tab="list"]').attributes('aria-selected')).toBe('true')
    expect(panelInit.list).toHaveBeenCalledTimes(1)
    expect(panelInit.overview).not.toHaveBeenCalled()
    expect(panelInit.plans).not.toHaveBeenCalled()
    // Panels are mounted lazily, so only the active one exists.
    expect(wrapper.findComponent(ListStub).exists()).toBe(true)
    expect(wrapper.findComponent(OverviewStub).exists()).toBe(false)
  })

  it('loads a tab on first visit and keeps state by not refetching on return', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('[data-orders-tab="plans"]').trigger('click')
    await flushPromises()
    expect(panelInit.plans).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenLastCalledWith({ query: { tab: 'plans' } })

    await wrapper.get('[data-orders-tab="list"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-orders-tab="plans"]').trigger('click')
    await flushPromises()
    // Still one request: switching tabs is not a refresh.
    expect(panelInit.plans).toHaveBeenCalledTimes(1)
    expect(panelInit.list).toHaveBeenCalledTimes(1)
  })

  it('honours ?tab= deep links from the old routes', async () => {
    route.query = { tab: 'overview' }
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.get('[data-orders-tab="overview"]').attributes('aria-selected')).toBe('true')
    expect(panelInit.overview).toHaveBeenCalledTimes(1)
    expect(panelInit.list).not.toHaveBeenCalled()
  })

  it('falls back to the list for an unknown tab value', async () => {
    route.query = { tab: 'nope' }
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.get('[data-orders-tab="list"]').attributes('aria-selected')).toBe('true')
  })

  it('surfaces paid-but-uncredited and refund requests from real counts', async () => {
    getOrders.mockImplementation(({ status }: { status?: string }) => Promise.resolve({
      data: { items: [], total: status === 'PAID' ? 12 : status === 'REFUND_REQUESTED' ? 4 : 0 },
    }))
    const wrapper = mountPage()
    await flushPromises()

    expect(getOrders).toHaveBeenCalledWith(expect.objectContaining({ status: 'PAID', page_size: 1 }))
    expect(getOrders).toHaveBeenCalledWith(expect.objectContaining({ status: 'REFUND_REQUESTED', page_size: 1 }))
    expect(wrapper.get('[data-testid="action-strip"]').text()).toBe('16')
  })

  it('hides the attention strip when counting fails instead of guessing', async () => {
    getOrders.mockRejectedValue(new Error('network'))
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.find('[data-testid="action-strip"]').exists()).toBe(false)
  })

  it('refreshes the active panel only', async () => {
    const wrapper = mountPage()
    await flushPromises()
    panelInit.list.mockClear()
    panelInit.overview.mockClear()

    await wrapper.get('[data-orders-tab="overview"]').trigger('click')
    await flushPromises()
    panelInit.overview.mockClear()

    // The header refresh button is the only button with the common.refresh label.
    const refresh = wrapper.findAll('button').find(button => button.text() === 'common.refresh')!
    await refresh.trigger('click')
    await flushPromises()
    expect(panelInit.overview).toHaveBeenCalledTimes(1)
    expect(panelInit.list).not.toHaveBeenCalled()
  })
})
