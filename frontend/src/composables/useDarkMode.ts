import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/**
 * Reactive mirror of `document.documentElement.classList.contains('dark')`.
 * Charts and canvas renderers read this so switching themes updates axis,
 * grid, and tooltip colors immediately without a page reload.
 */
export function useDarkMode(): Ref<boolean> {
  const read = () =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

  const isDark = ref(read())
  let observer: MutationObserver | null = null

  onMounted(() => {
    isDark.value = read()
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return
    observer = new MutationObserver(() => {
      isDark.value = read()
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
  })

  return isDark
}
