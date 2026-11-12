import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DataTable from '../DataTable.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

const stubDesktopMatchMedia = () => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
}

const stubMobileMatchMedia = () => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
}

describe('DataTable', () => {
  beforeEach(() => {
    stubDesktopMatchMedia()
    localStorage.clear()
  })

  it('uses explicit widths without letting long content shrink operational columns', async () => {
    const wrapper = mount(DataTable, { props: {
      columns: [{ key: 'name', label: 'Name', width: '240px' }, { key: 'status', label: 'Status', width: '120px' }],
      data: [{ id: 1, name: 'A long account name', status: 'error' }],
      fixedLayout: true, selectable: true, rowClass: () => 'bg-red-500/5'
    } })
    await wrapper.vm.$nextTick()
    expect(wrapper.get('table').classes()).toContain('table-fixed')
    expect(wrapper.get('table').attributes('style')).toContain('min-width: 404px')
    expect(wrapper.findAll('col').map(column => column.attributes('style'))).toEqual(['width: 44px;', 'width: 240px;', 'width: 120px;'])
    expect(wrapper.get('tbody tr').classes()).toContain('bg-red-500/5')
    wrapper.unmount()
  })

  it('renders paired sort arrows and highlights the active direction', async () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: [
          { key: 'name', label: 'Name', sortable: true },
          { key: 'created_at', label: 'Created', sortable: true }
        ],
        data: [
          { id: 1, name: 'Beta', created_at: '2026-01-02T00:00:00Z' },
          { id: 2, name: 'Alpha', created_at: '2026-01-01T00:00:00Z' }
        ],
        defaultSortKey: 'name',
        defaultSortOrder: 'asc'
      },
      slots: {
        'header-name': '<span data-test="custom-name-header">Name</span>'
      }
    })

    await wrapper.vm.$nextTick()

    const nameHeader = wrapper.findAll('th')[0]
    expect(nameHeader.find('[data-test="custom-name-header"]').exists()).toBe(true)
    expect(nameHeader.attributes('aria-sort')).toBe('ascending')
    expect(nameHeader.findAll('svg')).toHaveLength(2)
    expect(nameHeader.findAll('svg')[0].classes()).toContain('text-primary-600')
    expect(nameHeader.findAll('svg')[1].classes()).toContain('text-gray-300')

    await nameHeader.trigger('click')
    await wrapper.vm.$nextTick()

    expect(nameHeader.attributes('aria-sort')).toBe('descending')
    expect(nameHeader.findAll('svg')[0].classes()).toContain('text-gray-300')
    expect(nameHeader.findAll('svg')[1].classes()).toContain('text-primary-600')
  })

  it.each(['priority', 'upstream_billing_rate'])(
    'preserves the accepted server sort on %s when columns are hidden or reset',
    async (key) => {
      const columns = [
        { key: 'name', label: 'Name', sortable: true },
        { key, label: key, sortable: true }
      ]
      const wrapper = mount(DataTable, {
        props: {
          columns,
          data: [{ id: 1, name: 'Beta' }, { id: 2, name: 'Alpha' }],
          serverSideSort: true,
          acceptedSortKeys: [key],
          sortStorageKey: 'account-table-sort',
          defaultSortKey: 'name'
        }
      })
      await wrapper.vm.$nextTick()

      await wrapper.findAll('th')[1].trigger('click')
      await wrapper.findAll('th')[1].trigger('click')
      const expectedSort = { key, order: 'desc' }
      expect(wrapper.emitted('sort')).toEqual([[key, 'asc'], [key, 'desc']])
      expect(JSON.parse(localStorage.getItem('account-table-sort')!)).toEqual(expectedSort)

      // Hiding the active column must not persist a fallback or emit another server sort.
      await wrapper.setProps({ columns: [columns[0]] })
      expect(wrapper.get('th').attributes('aria-sort')).toBe('none')
      expect(JSON.parse(localStorage.getItem('account-table-sort')!)).toEqual(expectedSort)
      expect(wrapper.emitted('sort')).toHaveLength(2)

      await wrapper.setProps({ columns })
      expect(wrapper.findAll('th')[1].attributes('aria-sort')).toBe('descending')

      // Restoring compact columns removes it again, and the next mount must retain it.
      await wrapper.setProps({ columns: [columns[0]] })
      expect(JSON.parse(localStorage.getItem('account-table-sort')!)).toEqual(expectedSort)
      wrapper.unmount()
      const restored = mount(DataTable, {
        props: {
          columns,
          data: [{ id: 1, name: 'Beta' }, { id: 2, name: 'Alpha' }],
          serverSideSort: true,
          acceptedSortKeys: [key],
          sortStorageKey: 'account-table-sort',
          defaultSortKey: 'name'
        }
      })
      await restored.vm.$nextTick()
      expect(restored.findAll('th')[1].attributes('aria-sort')).toBe('descending')
      expect(restored.emitted('sort')).toBeUndefined()
      expect(restored.findAll('tbody tr[data-index]').map(row => row.attributes('data-row-id'))).toEqual(['1', '2'])
      restored.unmount()
    }
  )

  it.each(['priority', 'upstream_billing_rate'])(
    'loads a persisted server sort on initially hidden %s',
    async (key) => {
      const expectedSort = { key, order: 'desc' }
      localStorage.setItem('account-table-sort', JSON.stringify(expectedSort))
      const columns = [{ key: 'name', label: 'Name', sortable: true }]
      const wrapper = mount(DataTable, {
        props: {
          columns,
          data: [{ id: 1, name: 'Account' }],
          serverSideSort: true,
          acceptedSortKeys: [key],
          sortStorageKey: 'account-table-sort',
          defaultSortKey: 'name'
        }
      })
      await wrapper.vm.$nextTick()

      expect(wrapper.get('th').attributes('aria-sort')).toBe('none')
      expect(JSON.parse(localStorage.getItem('account-table-sort')!)).toEqual(expectedSort)
      await wrapper.setProps({ columns: [...columns, { key, label: key, sortable: true }] })
      expect(wrapper.findAll('th')[1].attributes('aria-sort')).toBe('descending')
      expect(wrapper.emitted('sort')).toBeUndefined()
      wrapper.unmount()
    }
  )

  it('normalizes the order of an accepted hidden server sort', async () => {
    localStorage.setItem('account-table-sort', JSON.stringify({ key: 'priority', order: 'invalid' }))
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name', sortable: true }],
        data: [{ id: 1, name: 'Account' }],
        serverSideSort: true,
        acceptedSortKeys: ['priority'],
        sortStorageKey: 'account-table-sort',
        defaultSortKey: 'name'
      }
    })
    await wrapper.vm.$nextTick()

    expect(JSON.parse(localStorage.getItem('account-table-sort')!)).toEqual({ key: 'priority', order: 'asc' })
    wrapper.unmount()
  })

  it('accepts a hidden default server sort without persisted state', async () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name', sortable: true }],
        data: [{ id: 1, name: 'Account' }],
        serverSideSort: true,
        acceptedSortKeys: ['priority'],
        sortStorageKey: 'account-table-sort',
        defaultSortKey: 'priority',
        defaultSortOrder: 'desc'
      }
    })
    await wrapper.vm.$nextTick()

    expect(JSON.parse(localStorage.getItem('account-table-sort')!)).toEqual({ key: 'priority', order: 'desc' })
    expect(wrapper.get('th').attributes('aria-sort')).toBe('none')
    wrapper.unmount()
  })

  it.each([
    { mode: 'server sorting without accepted keys', props: { serverSideSort: true } },
    { mode: 'default client sorting', props: {} },
    { mode: 'client sorting with accepted keys', props: { serverSideSort: false, acceptedSortKeys: ['priority'] } },
    { mode: 'server sorting with a different accepted key', props: { serverSideSort: true, acceptedSortKeys: ['upstream_billing_rate'] } }
  ])('rejects a hidden persisted sort for $mode', async ({ props }) => {
    localStorage.setItem('table-sort', JSON.stringify({ key: 'priority', order: 'desc' }))
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name', sortable: true }],
        data: [{ id: 1, name: 'Beta', priority: 9 }, { id: 2, name: 'Alpha', priority: 1 }],
        sortStorageKey: 'table-sort',
        defaultSortKey: 'name',
        ...props
      }
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('th').attributes('aria-sort')).toBe('ascending')
    expect(JSON.parse(localStorage.getItem('table-sort')!)).toEqual({ key: 'name', order: 'asc' })
    expect(wrapper.emitted('sort')).toBeUndefined()
    expect(wrapper.findAll('tbody tr[data-index]').map(row => row.attributes('data-row-id'))).toEqual(
      props.serverSideSort ? ['1', '2'] : ['2', '1']
    )
    wrapper.unmount()
  })

  it.each([
    { mode: 'server sorting without accepted keys', props: { serverSideSort: true } },
    { mode: 'client sorting with accepted keys', props: { serverSideSort: false, acceptedSortKeys: ['priority'] } }
  ])('rejects a hidden default sort for $mode', async ({ props }) => {
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name', sortable: true }],
        data: [{ id: 1, name: 'Beta', priority: 1 }, { id: 2, name: 'Alpha', priority: 9 }],
        sortStorageKey: 'table-sort',
        defaultSortKey: 'priority',
        defaultSortOrder: 'desc',
        ...props
      }
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('th').attributes('aria-sort')).toBe('none')
    expect(localStorage.getItem('table-sort')).toBeNull()
    expect(wrapper.findAll('tbody tr[data-index]').map(row => row.attributes('data-row-id'))).toEqual(['1', '2'])
    wrapper.unmount()
  })

  it.each([
    { mode: 'server sorting without accepted keys', props: { serverSideSort: true } },
    { mode: 'client sorting with accepted keys', props: { serverSideSort: false, acceptedSortKeys: ['priority'] } }
  ])('falls back when the sorted column is hidden for $mode', async ({ props }) => {
    const columns = [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'priority', label: 'Priority', sortable: true }
    ]
    const wrapper = mount(DataTable, {
      props: {
        columns,
        data: [{ id: 1, name: 'Beta', priority: 9 }, { id: 2, name: 'Alpha', priority: 1 }],
        sortStorageKey: 'table-sort',
        defaultSortKey: 'name',
        ...props
      }
    })
    await wrapper.vm.$nextTick()
    await wrapper.findAll('th')[1].trigger('click')
    await wrapper.findAll('th')[1].trigger('click')
    expect(JSON.parse(localStorage.getItem('table-sort')!)).toEqual({ key: 'priority', order: 'desc' })

    await wrapper.setProps({ columns: [columns[0]] })
    expect(wrapper.get('th').attributes('aria-sort')).toBe('ascending')
    expect(JSON.parse(localStorage.getItem('table-sort')!)).toEqual({ key: 'name', order: 'asc' })
    expect(wrapper.findAll('tbody tr[data-index]').map(row => row.attributes('data-row-id'))).toEqual(
      props.serverSideSort ? ['1', '2'] : ['2', '1']
    )
    wrapper.unmount()
  })

  it('revalidates a hidden server sort when accepted keys are removed in place', async () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name', sortable: true }],
        data: [{ id: 1, name: 'Account' }],
        serverSideSort: true,
        acceptedSortKeys: ['priority', 'upstream_billing_rate'],
        sortStorageKey: 'table-sort',
        defaultSortKey: 'priority',
        defaultSortOrder: 'desc'
      }
    })
    await wrapper.vm.$nextTick()
    expect(JSON.parse(localStorage.getItem('table-sort')!)).toEqual({ key: 'priority', order: 'desc' })

    await wrapper.setProps({ defaultSortKey: 'name', defaultSortOrder: 'asc' })
    wrapper.props('acceptedSortKeys')!.splice(0, 1)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('th').attributes('aria-sort')).toBe('ascending')
    expect(JSON.parse(localStorage.getItem('table-sort')!)).toEqual({ key: 'name', order: 'asc' })
    wrapper.unmount()
  })

  it('revalidates a hidden accepted sort when switching to client sorting', async () => {
    localStorage.setItem('table-sort', JSON.stringify({ key: 'priority', order: 'desc' }))
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name', sortable: true }],
        data: [{ id: 1, name: 'Beta', priority: 9 }, { id: 2, name: 'Alpha', priority: 1 }],
        serverSideSort: true,
        acceptedSortKeys: ['priority'],
        sortStorageKey: 'table-sort',
        defaultSortKey: 'name'
      }
    })
    await wrapper.vm.$nextTick()
    expect(JSON.parse(localStorage.getItem('table-sort')!)).toEqual({ key: 'priority', order: 'desc' })

    await wrapper.setProps({ serverSideSort: false })
    expect(wrapper.get('th').attributes('aria-sort')).toBe('ascending')
    expect(JSON.parse(localStorage.getItem('table-sort')!)).toEqual({ key: 'name', order: 'asc' })
    expect(wrapper.findAll('tbody tr[data-index]').map(row => row.attributes('data-row-id'))).toEqual(['2', '1'])
    wrapper.unmount()
  })

  it('renders every row with no virtual padding spacer for small datasets (virtualization off)', async () => {
    const data = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }))
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data
      }
    })

    await wrapper.vm.$nextTick()

    // Virtualization is OFF for a small list…
    expect((wrapper.vm as any).shouldVirtualize).toBe(false)
    // …every row is in the DOM…
    expect(wrapper.findAll('tbody tr[data-index]')).toHaveLength(data.length)
    // …and there are no aria-hidden virtual padding spacer rows.
    expect(wrapper.findAll('tbody tr[aria-hidden="true"]')).toHaveLength(0)
  })

  it('switches to windowed rendering once row count exceeds virtualizeThreshold', async () => {
    const data = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }))
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data,
        virtualizeThreshold: 3
      }
    })

    await wrapper.vm.$nextTick()

    // Virtualization is ON: the mode-switch decision flipped…
    expect((wrapper.vm as any).shouldVirtualize).toBe(true)
    // …and the virtualizer drives off the full row count.
    const exposed = (wrapper.vm as any).virtualizer
    const instance = exposed?.value ?? exposed
    expect(instance.options.count).toBe(data.length)
  })

  it('keys the virtualizer size cache by row identity, not index (avoids stale heights on sort/filter)', async () => {
    const data = Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, name: `Row ${i + 1}` }))
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data,
        rowKey: 'id',
        virtualizeThreshold: 3
      }
    })

    await wrapper.vm.$nextTick()

    const exposed = (wrapper.vm as any).virtualizer
    const instance = exposed?.value ?? exposed
    // getItemKey must resolve to the row's stable key (id), not the positional index.
    expect(instance.options.getItemKey(0)).toBe(100)
    expect(instance.options.getItemKey(5)).toBe(105)
  })

  it('clears stale row and element caches when pagination replaces the row ID set', async () => {
    const firstPage = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, name: `First ${i + 1}` }))
    const secondPage = Array.from({ length: 100 }, (_, i) => ({ id: i + 101, name: `Second ${i + 1}` }))
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: firstPage,
        rowKey: 'id',
        virtualizeThreshold: 1
      }
    })

    await wrapper.vm.$nextTick()

    const exposed = (wrapper.vm as any).virtualizer
    const instance = exposed?.value ?? exposed
    const firstPageIDs = firstPage.map(row => row.id)
    ;(instance as any).itemSizeCache = new Map(firstPageIDs.map(id => [id, 156]))
    instance.elementsCache.clear()
    for (const id of firstPageIDs) {
      instance.elementsCache.set(id, document.createElement('tr'))
    }
    const measureElementSpy = vi.spyOn(instance, 'measureElement')

    await wrapper.setProps({ data: secondPage })
    await wrapper.vm.$nextTick()

    const sizeCache = (instance as any).itemSizeCache as Map<number, number>
    expect(sizeCache.size).toBeLessThanOrEqual(secondPage.length)
    expect(instance.elementsCache.size).toBeLessThanOrEqual(secondPage.length)
    expect(firstPageIDs.some(id => sizeCache.has(id))).toBe(false)
    expect(firstPageIDs.some(id => instance.elementsCache.has(id))).toBe(false)
    expect(measureElementSpy.mock.calls.some(([node]) => node === null)).toBe(true)
  })

  it('clears stale caches when equal-length pages replace rows without stable keys', async () => {
    const firstPage = Array.from({ length: 12 }, (_, i) => ({ name: `First ${i + 1}` }))
    const secondPage = Array.from({ length: 12 }, (_, i) => ({ name: `Second ${i + 1}` }))
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: firstPage,
        virtualizeThreshold: 1
      }
    })

    await wrapper.vm.$nextTick()

    const exposed = (wrapper.vm as any).virtualizer
    const instance = exposed?.value ?? exposed
    const measureElementSpy = vi.spyOn(instance, 'measureElement')

    await wrapper.setProps({ data: secondPage })
    await wrapper.vm.$nextTick()

    expect(measureElementSpy.mock.calls.some(([node]) => node === null)).toBe(true)
  })

  it('conservatively clears caches when duplicate row-key multiplicity changes', async () => {
    const firstPage = [
      { id: 1, name: 'First A' },
      { id: 1, name: 'First B' },
      { id: 2, name: 'First C' }
    ]
    const secondPage = [
      { id: 1, name: 'Second A' },
      { id: 2, name: 'Second B' },
      { id: 2, name: 'Second C' }
    ]
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: firstPage,
        rowKey: 'id',
        virtualizeThreshold: 1
      }
    })

    await wrapper.vm.$nextTick()

    const exposed = (wrapper.vm as any).virtualizer
    const instance = exposed?.value ?? exposed
    const measureElementSpy = vi.spyOn(instance, 'measureElement')

    await wrapper.setProps({ data: secondPage })
    await wrapper.vm.$nextTick()

    expect(measureElementSpy.mock.calls.some(([node]) => node === null)).toBe(true)
  })

  it('preserves cache when rows without stable keys only reorder the same objects', async () => {
    const data = Array.from({ length: 12 }, (_, i) => ({ name: `Row ${i + 1}` }))
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data,
        virtualizeThreshold: 1
      }
    })

    await wrapper.vm.$nextTick()

    const exposed = (wrapper.vm as any).virtualizer
    const instance = exposed?.value ?? exposed
    const measureSpy = vi.spyOn(instance, 'measure')

    await wrapper.setProps({ data: [...data].reverse() })
    await wrapper.vm.$nextTick()

    expect(measureSpy).not.toHaveBeenCalled()
  })

  it('preserves stable row height cache when the same row IDs are only reordered', async () => {
    const data = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }))
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data,
        rowKey: 'id',
        virtualizeThreshold: 1
      }
    })

    await wrapper.vm.$nextTick()

    const exposed = (wrapper.vm as any).virtualizer
    const instance = exposed?.value ?? exposed
    ;(instance as any).itemSizeCache = new Map(data.map(row => [row.id, 156]))
    const measureSpy = vi.spyOn(instance, 'measure')

    await wrapper.setProps({ data: [...data].reverse() })
    await wrapper.vm.$nextTick()

    const sizeCache = (instance as any).itemSizeCache as Map<number, number>
    expect(measureSpy).not.toHaveBeenCalled()
    expect(sizeCache.size).toBe(100)
  })

  it('emits controlled current-page selection while preserving off-page keys', async () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: [
          { id: 1, name: 'One' },
          { id: 2, name: 'Two' }
        ],
        rowKey: 'id',
        selectable: true,
        selectedKeys: [99]
      }
    })

    await wrapper.get('[data-test="select-all"]').setValue(true)

    const selectedAll = wrapper.emitted('update:selectedKeys')?.at(-1)?.[0]
    expect(selectedAll).toEqual([99, 1, 2])

    await wrapper.setProps({ selectedKeys: selectedAll as number[] })
    const rowCheckboxes = wrapper.findAll<HTMLInputElement>('[data-test="select-row"]')
    expect(rowCheckboxes.every((checkbox) => checkbox.element.checked)).toBe(true)

    await rowCheckboxes[0].setValue(false)

    expect(wrapper.emitted('update:selectedKeys')?.at(-1)?.[0]).toEqual([99, 2])
    expect(wrapper.emitted('selectionChange')?.at(-1)?.[0]).toEqual([99, 2])
  })

  it('keeps the single usage field shrinkable in a 320px mobile card', () => {
    stubMobileMatchMedia()
    const viewport = document.createElement('div')
    viewport.style.width = '320px'
    document.body.appendChild(viewport)
    const wrapper = mount(DataTable, {
      attachTo: viewport,
      props: {
        columns: [{ key: 'usage', label: 'Usage' }],
        data: [{ id: 1, usage: 'snapshot' }],
        rowKey: 'id'
      },
      slots: {
        'cell-usage': '<div data-test="usage-cell">snapshot</div>'
      }
    })

    expect(viewport.style.width).toBe('320px')
    // A single column becomes the card title, so it renders once and is shrinkable.
    expect(wrapper.findAll('[data-test="usage-cell"]')).toHaveLength(1)
    expect(wrapper.find('[data-field="ollama_cloud_usage"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="mobile-primary"]').classes()).toContain('min-w-0')
    // Nothing else to collapse, so no expand affordance is offered.
    expect(wrapper.find('[data-test="mobile-expand"]').exists()).toBe(false)

    wrapper.unmount()
    viewport.remove()
  })

  it('offers current-page select all in the mobile card layout', async () => {
    stubMobileMatchMedia()
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: [
          { id: 1, name: 'One' },
          { id: 2, name: 'Two' }
        ],
        rowKey: 'id',
        selectable: true,
        selectedKeys: [99]
      }
    })

    await wrapper.get('[data-test="select-all-mobile"]').setValue(true)

    expect(wrapper.emitted('update:selectedKeys')?.at(-1)?.[0]).toEqual([99, 1, 2])
  })

  it('collapses secondary columns behind one tap on a phone', async () => {
    stubMobileMatchMedia()
    const columns = [
      { key: 'name', label: 'Name', mobilePrimary: true },
      { key: 'status', label: 'Status', mobileAlways: true },
      { key: 'today', label: 'Today' },
      { key: 'proxy', label: 'Proxy' },
      { key: 'created', label: 'Created' }
    ]
    const wrapper = mount(DataTable, {
      props: { columns, data: [{ id: 1, name: 'claude-pro-01', status: 'ok', today: 42, proxy: 'US', created: '2026-01-01' }], rowKey: 'id' }
    })

    // Identity first, always-on fields next; the rest is hidden until asked for.
    expect(wrapper.get('[data-test="mobile-primary"]').text()).toContain('claude-pro-01')
    expect(wrapper.find('[data-field="status"]').exists()).toBe(true)
    expect(wrapper.find('[data-field="today"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="mobile-details"]').exists()).toBe(false)
    const toggle = wrapper.get('[data-test="mobile-expand"]')
    expect(toggle.attributes('aria-expanded')).toBe('false')

    await toggle.trigger('click')
    expect(wrapper.findAll('[data-test="mobile-details"]')).toHaveLength(1)
    expect(wrapper.get('[data-field="today"]').text()).toContain('42')
    expect(wrapper.get('[data-field="proxy"]').text()).toContain('US')
    expect(wrapper.get('[data-test="mobile-expand"]').attributes('aria-expanded')).toBe('true')

    await wrapper.get('[data-test="mobile-expand"]').trigger('click')
    expect(wrapper.find('[data-test="mobile-details"]').exists()).toBe(false)
  })

  it('expands cards independently', async () => {
    stubMobileMatchMedia()
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }, { key: 'today', label: 'Today' }],
        data: [{ id: 1, name: 'a', today: 1 }, { id: 2, name: 'b', today: 2 }],
        rowKey: 'id'
      }
    })
    const toggles = wrapper.findAll('[data-test="mobile-expand"]')
    await toggles[1].trigger('click')
    expect(wrapper.findAll('[data-test="mobile-details"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-test="mobile-details"]')[0].text()).toContain('2')
  })

  it('falls back to the first real column as the card title', () => {
    stubMobileMatchMedia()
    const wrapper = mount(DataTable, {
      props: {
        // 'select' is a placeholder with no cell slot and must never become the title.
        columns: [{ key: 'select', label: '' }, { key: 'name', label: 'Name' }, { key: 'id', label: 'ID' }],
        data: [{ id: 7, name: 'group-a' }],
        rowKey: 'id'
      }
    })
    expect(wrapper.get('[data-test="mobile-primary"]').text()).toContain('group-a')
    expect(wrapper.find('[data-field="select"]').exists()).toBe(false)
  })

  it('switches to card layout below the lg breakpoint', () => {
    stubMobileMatchMedia() // reports no match for any query, i.e. narrow viewport
    const wrapper = mount(DataTable, {
      props: { columns: [{ key: 'name', label: 'Name' }], data: [{ id: 1, name: 'x' }], rowKey: 'id' }
    })
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.find('[data-test="mobile-primary"]').exists()).toBe(true)
  })
})
