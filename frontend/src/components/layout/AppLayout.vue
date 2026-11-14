<template>
  <div class="min-h-screen bg-canvas">
    <!-- Sidebar -->
    <AppSidebar />

    <!-- Main Content Area -->
    <div
      class="relative flex min-h-screen flex-col transition-[margin] duration-300"
      :class="[sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-[248px]']"
    >
      <!-- Header -->
      <AppHeader />

      <!-- Main Content -->
      <main class="flex-1 px-4 pb-10 pt-5 md:px-6 lg:px-6">
        <div class="min-w-0 w-full">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import '@/styles/onboarding.css'
import { computed, onMounted } from 'vue'
import { useAppStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import { useOnboardingTour } from '@/composables/useOnboardingTour'
import { useOnboardingStore } from '@/stores/onboarding'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'

/**
 * AppLayout — the authenticated shell.
 *
 * `bg-mesh-gradient` was dropped: the decorative blur sat behind every card
 * and made the flat surface scale from the redesign spec read as "muddy".
 * Page content fills the available width with responsive gutters.
 */
const appStore = useAppStore()
const authStore = useAuthStore()
const sidebarCollapsed = computed(() => appStore.sidebarCollapsed)
const isAdmin = computed(() => authStore.user?.role === 'admin')

const { replayTour } = useOnboardingTour({
  storageKey: isAdmin.value ? 'admin_guide' : 'user_guide',
  autoStart: true
})

const onboardingStore = useOnboardingStore()

onMounted(() => {
  onboardingStore.setReplayCallback(replayTour)
})

defineExpose({ replayTour })
</script>
