<template>
  <iframe
    v-if="compiledHtml"
    :key="renderGeneration"
    ref="iframeRef"
    :src="sandboxUrl"
    :title="title"
    sandbox="allow-scripts"
    referrerpolicy="no-referrer"
    class="block h-full w-full border-0"
    @load="onIframeLoad"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onBeforeUnmount, ref, watch } from 'vue'
import {
  buildSandboxedPelicanSrcdoc,
  getPelicanSandboxUrl,
  PELICAN_SANDBOX_READY_EVENT,
  PELICAN_SANDBOX_RENDER_EVENT
} from './sandboxHtml'

const props = withDefaults(
  defineProps<{
    html: string
    title: string
    replayKey?: number | string
  }>(),
  {
    replayKey: 0
  }
)

const sandboxUrl = getPelicanSandboxUrl()
const compiledHtml = computed(() => buildSandboxedPelicanSrcdoc(props.html))

const iframeRef = ref<HTMLIFrameElement | null>(null)
const renderGeneration = ref(0)
let delivered = false

watch(
  [compiledHtml, () => props.replayKey],
  () => {
    delivered = false
    renderGeneration.value += 1
  }
)

function deliverHtml(): void {
  if (delivered || !compiledHtml.value) return
  const target = iframeRef.value?.contentWindow
  if (!target) return
  delivered = true
  // The sandboxed iframe intentionally has an opaque origin ("null"), so targetOrigin must be '*'.
  target.postMessage(
    {
      type: PELICAN_SANDBOX_RENDER_EVENT,
      html: compiledHtml.value
    },
    '*'
  )
}

function handleMessage(event: MessageEvent): void {
  const frameWindow = iframeRef.value?.contentWindow
  if (!frameWindow || event.source !== frameWindow) return
  const data = event.data as { type?: unknown } | null
  if (data && data.type === PELICAN_SANDBOX_READY_EVENT) {
    deliverHtml()
  }
}

function onIframeLoad(): void {
  deliverHtml()
}

onBeforeMount(() => {
  window.addEventListener('message', handleMessage)
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleMessage)
})
</script>
