import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getOrders, downloadReport, showSuccess, showWarning, showError } = vi.hoisted(() => ({
  getOrders: vi.fn(),
  downloadReport: vi.fn(),
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
  showError: vi.fn(),
}))

vi.mock('@/api/admin/payment', () => ({
  adminPaymentAPI: { getOrders },
  default: { getOrders },
}))

vi.mock('@/utils/reportExport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/reportExport')>()
  return { ...actual, downloadReport }
})

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showSuccess, showWarning, showError }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/admin/orders', query: { status: 'PAID' } }),
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

import AdminOrdersView from '../AdminOrdersView.vue'

function order(id: number) {
  return {
    id,
    user_id: 100 + id,
    amount: 10,
    pay_amount: 10,
    fee_rate: 0,
    payment_type: 'alipay',
    out_trade_no: `SO${id}`,
    status: 'COMPLETED',
    order_type: 'balance',
    created_at: '2026-11-08T10:00:00Z',
    expires_at: '2026-11-08T11:00:00Z',
    refund_amount: 0,
  }
}

function mountView() {
  return mount(AdminOrdersView, {
    global: {
      plugins: [createPinia()],
      stubs: {
        Pagination: true,
        BaseDialog: true,
        Select: true,
        Icon: true,
        AdminRefundDialog: true,
        OrderStatusBadge: true,

        OrderTable: { props: ['orders'], template: '<table><tr v-for="o in orders" :key="o.id"><td>{{ o.out_trade_no }}</td></tr></table>' },
      },
    },
  })
}

describe('AdminOrdersView export', () => {
  beforeEach(() => {
    getOrders.mockReset()
    downloadReport.mockReset()
    downloadReport.mockResolvedValue(undefined)
    showSuccess.mockReset()
    showWarning.mockReset()
    showError.mockReset()
  })

  it('reads the status deep link on first load', async () => {
    getOrders.mockResolvedValue({ data: { items: [], total: 0 } })
    const wrapper = mountView()
    ;(wrapper.vm as unknown as { init: () => void }).init()
    await flushPromises()
    expect(getOrders).toHaveBeenCalledWith(expect.objectContaining({ status: 'PAID', page: 1 }))
  })

  it('exports every page of the current filter, not just the visible one', async () => {
    const firstPage = Array.from({ length: 100 }, (_, i) => order(i + 1))
    // Answer by page number, so the initial list load cannot consume a queued response.
    getOrders.mockImplementation(({ page, page_size }: { page: number; page_size: number }) => Promise.resolve({
      data: page_size === 100
        ? { items: page === 1 ? firstPage : Array.from({ length: 50 }, (_, i) => order(i + 101)), total: 150 }
        : { items: firstPage.slice(0, 20), total: 150 },
    }))
    const wrapper = mountView()
    ;(wrapper.vm as unknown as { init: () => void }).init()
    await flushPromises()

    await wrapper.get('[data-testid="report-export-trigger"]').trigger('click')
    await wrapper.get('[data-export-format="csv"]').trigger('click')
    await flushPromises()

    const exportCalls = getOrders.mock.calls.filter(call => call[0].page_size === 100)
    expect(exportCalls.map(call => call[0].page)).toEqual([1, 2])
    // The filter on screen is the filter exported.
    expect(exportCalls[0][0]).toMatchObject({ status: 'PAID', keyword: undefined })

    expect(downloadReport).toHaveBeenCalledTimes(1)
    const payload = downloadReport.mock.calls[0][0]
    expect(payload.format).toBe('csv')
    expect(payload.sheets[0].rows).toHaveLength(151) // header + 150 orders
    expect(payload.sheets[0].rows[1][0]).toBe('SO1')
    expect(payload.fileName).toMatch(/^orders_\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2}$/)
    expect(showSuccess).toHaveBeenCalledWith('reportExport.success')
  })

  it('refuses to write a header-only file', async () => {
    getOrders.mockResolvedValue({ data: { items: [], total: 0 } })
    const wrapper = mountView()
    ;(wrapper.vm as unknown as { init: () => void }).init()
    await flushPromises()

    await wrapper.get('[data-testid="report-export-trigger"]').trigger('click')
    await wrapper.get('[data-export-format="csv"]').trigger('click')
    await flushPromises()
    expect(downloadReport).not.toHaveBeenCalled()
    expect(showWarning).toHaveBeenCalledWith('reportExport.empty')
  })

  it('reports a failed page instead of saving a partial file', async () => {
    getOrders.mockImplementation(({ page }: { page: number }) => page === 2
      ? Promise.reject(new Error('boom'))
      : Promise.resolve({ data: { items: Array.from({ length: 100 }, (_, i) => order(i + 1)), total: 200 } }))
    const wrapper = mountView()
    ;(wrapper.vm as unknown as { init: () => void }).init()
    await flushPromises()

    await wrapper.get('[data-testid="report-export-trigger"]').trigger('click')
    await wrapper.get('[data-export-format="csv"]').trigger('click')
    await flushPromises()
    expect(downloadReport).not.toHaveBeenCalled()
    expect(showError).toHaveBeenCalled()
  })
})
