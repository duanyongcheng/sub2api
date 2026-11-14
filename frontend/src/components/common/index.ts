// Export all common components
export { default as DataTable } from './DataTable.vue'
export { default as Pagination } from './Pagination.vue'
export { default as BaseDialog } from './BaseDialog.vue'
export { default as ConfirmDialog } from './ConfirmDialog.vue'
export { default as StatCard } from './StatCard.vue'
export { default as Toast } from './Toast.vue'
export { default as LoadingSpinner } from './LoadingSpinner.vue'
export { default as EmptyState } from './EmptyState.vue'
export { default as LocaleSwitcher } from './LocaleSwitcher.vue'
export { default as ExportProgressDialog } from './ExportProgressDialog.vue'

// Redesign primitives (design-prototypes/docs/02-设计规范与实现映射.md §3)
export { default as KpiCard } from './KpiCard.vue'
export { default as StatusPill } from './StatusPill.vue'
export { default as PageHeader } from './PageHeader.vue'
export { default as ActionStrip } from './ActionStrip.vue'
export { default as Sparkline } from './Sparkline.vue'

// Export types
export type { Column } from './types'
export type { StatusTone } from './StatusPill.vue'
export type { ActionStripItem } from './ActionStrip.vue'
