import type Icon from '@/components/icons/Icon.vue'

/**
 * A single "needs a decision" row in the operations overview to-do rail.
 * Kept in its own module so the view can build the list without importing the
 * component's SFC type.
 */
export interface TodoTask {
  key: string
  title: string
  hint: string
  count: number
  /** Route the row jumps to when clicked. Empty string disables navigation. */
  to: string
  icon: InstanceType<typeof Icon>['$props']['name']
  tone: 'warn' | 'bad' | 'info' | 'neutral'
}
