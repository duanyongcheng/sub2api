<template>
  <AppLayout>
    <div class="page-body">
      <PageHeader :title="t('payment.admin.ordersTitle')" :description="t('payment.admin.ordersSubtitle')">
        <template #actions>
          <button type="button" class="btn btn-secondary" :disabled="refreshing" @click="refreshActive">
            <Icon name="refresh" size="sm" :class="refreshing ? 'animate-spin' : ''" />
            {{ t('common.refresh') }}
          </button>
        </template>
      </PageHeader>

      <!-- 概览 / 全部订单 / 套餐：同一路由内切换，菜单只保留一个入口（原型 08） -->
      <div class="flex flex-wrap items-center gap-3">
        <div class="tabs inline-flex" role="tablist" :aria-label="t('payment.admin.ordersTabs')">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            role="tab"
            class="tab"
            :class="active === tab.value ? 'tab-active' : ''"
            :aria-selected="active === tab.value"
            :data-orders-tab="tab.value"
            @click="selectTab(tab.value)"
          >
            {{ tab.label }}
          </button>
        </div>
        <p class="text-xs text-ink-3">{{ activeHint }}</p>
      </div>

      <!-- 需要一个决策的订单置顶：已支付但额度没到账是最贵的一种失败 -->
      <ActionStrip
        v-if="attentionItems.length"
        :title="t('payment.admin.needsAttention')"
        :count="attentionCount"
        :items="attentionItems"
        :max-items="3"
      />

      <!-- Tabs stay mounted so filters survive switching; each only loads on first visit. -->
      <div v-show="active === 'overview'" role="tabpanel">
        <AdminPaymentDashboardView v-if="mounted.overview" ref="overviewRef" />
      </div>
      <div v-show="active === 'list'" role="tabpanel">
        <AdminOrdersView v-if="mounted.list" ref="listRef" />
      </div>
      <div v-show="active === 'plans'" role="tabpanel">
        <AdminPaymentPlansView v-if="mounted.plans" ref="plansRef" />
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
/**
 * 订单（合并页 · 原型 08）。
 *
 * 原来 /admin/orders、/admin/orders/dashboard、/admin/orders/plans 是三个
 * 独立页面、三个侧边栏子项。合并后菜单只有「订单」一项，页内用 Tab 切换：
 *   - 概览：经营指标（原 dashboard）
 *   - 全部订单：筛选 + 列表 + 退款 / 重试（原 orders）
 *   - 套餐：订阅套餐（原 plans）
 * 旧路径由 router 重定向到对应的 Tab，书签与外部链接不失效。
 *
 * Tab 用 v-show + 首次访问才挂载：来回切换不丢筛选条件，也不重复请求。
 * 「需要处理」的数字来自接口真实计数，拿不到就整条不显示，不猜。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { adminPaymentAPI } from '@/api/admin/payment'
import AppLayout from '@/components/layout/AppLayout.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import ActionStrip from '@/components/common/ActionStrip.vue'
import Icon from '@/components/icons/Icon.vue'
import type { ActionStripItem } from '@/components/common/ActionStrip.vue'
import AdminPaymentDashboardView from './AdminPaymentDashboardView.vue'
import AdminOrdersView from './AdminOrdersView.vue'
import AdminPaymentPlansView from './AdminPaymentPlansView.vue'

type OrdersTab = 'overview' | 'list' | 'plans'
const TAB_VALUES: OrdersTab[] = ['overview', 'list', 'plans']

interface TabPanelExpose { init: () => void }

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const tabs = computed(() => TAB_VALUES.map(value => ({ value, label: t(`payment.admin.ordersTab.${value}`) })))
const active = ref<OrdersTab>(resolveTab(route.query.tab) ?? 'list')
const mounted = ref<Record<OrdersTab, boolean>>({ overview: false, list: false, plans: false })
const refreshing = ref(false)
const overviewRef = ref<TabPanelExpose | null>(null)
const listRef = ref<TabPanelExpose | null>(null)
const plansRef = ref<TabPanelExpose | null>(null)

/**
 * 待处理计数：只统计「钱已到、货没发」与「客户要求退款」两类，
 * 两者都是必须当天处理的订单。计数失败时保持为 0，不展示猜测值。
 */
const paidNotDelivered = ref(0)
const refundRequests = ref(0)

function resolveTab(value: unknown): OrdersTab | null {
  const raw = Array.isArray(value) ? value[0] : value
  return TAB_VALUES.includes(raw as OrdersTab) ? (raw as OrdersTab) : null
}

const activeHint = computed(() => t(`payment.admin.ordersTabHint.${active.value}`))
const attentionCount = computed(() => paidNotDelivered.value + refundRequests.value)
const attentionItems = computed<ActionStripItem[]>(() => {
  const items: ActionStripItem[] = []
  if (paidNotDelivered.value > 0) {
    items.push({
      label: t('payment.admin.attentionUndelivered', { count: paidNotDelivered.value }),
      hint: t('payment.admin.attentionUndeliveredHint'),
      to: `${route.path}?tab=list&status=PAID`,
    })
  }
  if (refundRequests.value > 0) {
    items.push({
      label: t('payment.admin.attentionRefunds', { count: refundRequests.value }),
      hint: t('payment.admin.attentionRefundsHint'),
      to: `${route.path}?tab=list&status=REFUND_REQUESTED`,
    })
  }
  return items
})

function panel(tab: OrdersTab) {
  return tab === 'overview' ? overviewRef.value : tab === 'list' ? listRef.value : plansRef.value
}

/** Marks a tab as mounted and reports whether this is its first activation. */
function activate(tab: OrdersTab): boolean {
  if (mounted.value[tab]) return false
  mounted.value[tab] = true
  return true
}

async function loadAttention() {
  const count = async (status: string) => {
    try {
      const res = await adminPaymentAPI.getOrders({ page: 1, page_size: 1, status })
      return Number(res.data.total || 0)
    } catch {
      return 0
    }
  }
  const [undelivered, refunds] = await Promise.all([count('PAID'), count('REFUND_REQUESTED')])
  paidNotDelivered.value = undelivered
  refundRequests.value = refunds
}

function initActive() {
  // Runs after this render, so a newly mounted panel already exposes init().
  void Promise.resolve().then(() => panel(active.value)?.init())
}

// 面板第一次显示时挂载并 init()；再次切回只切 v-show，不重复请求 ——
// 否则每次切 Tab 都会丢掉筛选条件并白跑一次接口。
watch(active, () => {
  if (activate(active.value)) initActive()
}, { flush: 'post' })

function selectTab(tab: OrdersTab) {
  active.value = tab
  void router.replace({ query: { ...route.query, tab } })
}

function refreshActive() {
  refreshing.value = true
  panel(active.value)?.init()
  void loadAttention().finally(() => { refreshing.value = false })
}

// Browser back / forward must move the tabs too; the list's ?status= is read by the panel itself.
watch(() => route.query.tab, value => {
  const next = resolveTab(value)
  if (next && next !== active.value) active.value = next
})


onMounted(() => {
  // Initial activation always happens exactly once, so it always loads.
  mounted.value[active.value] = true
  initActive()
  void loadAttention()
  if (route.query.tab !== active.value) {
    void router.replace({ query: { ...route.query, tab: active.value } })
  }
})
</script>
