<script setup lang="ts">
import type {NavigationMenuItem} from '@nuxt/ui'

const route = useRoute()
const authStore = useAuthStore()
const toast = useToast()
const config = useRuntimeConfig()

const isLoggingOut = ref(false)

async function logout() {
  if (isLoggingOut.value) {
    return
  }

  isLoggingOut.value = true

  try {
    await useApiClient()('/auth/logout', { method: 'POST' })
  } catch {
    // Clear local state even if server session was already invalidated.
  } finally {
    authStore.markLoggedOut()
    toast.add({
      title: 'Logged out',
      description: 'You have been signed out.',
      color: 'success',
    })
    await navigateTo('/login')
    isLoggingOut.value = false
  }
}

const links = computed<NavigationMenuItem[][]>(() => [
  [
    {
      to: '/',
      icon: 'i-lucide-layout-dashboard',
      label: 'Dashboard',
      active: route.path === '/'
    },
    {
      to: '/servers',
      icon: 'i-lucide-server',
      label: 'Servers',
      active: route.path.startsWith('/servers')
    },
    {
      to: '/sites',
      icon: 'i-lucide-globe',
      label: 'Sites',
      active: route.path.startsWith('/sites')
    },
    {
      to: '/packages',
      icon: 'i-lucide-box',
      label: 'Plugins & Themes',
      active: route.path.startsWith('/packages')
    },
    {
      to: '/monitoring',
      icon: 'i-lucide-activity',
      label: 'Monitoring',
      active: route.path.startsWith('/monitoring')
    }
  ],
  [[
    {
      to: '/settings/main',
      icon: 'i-lucide-settings',
      label: 'Setup',
      active: route.path.startsWith('/settings')
    }],[
    {
      label: 'Logout',
      icon: 'i-lucide-log-out',
      disabled: isLoggingOut.value,
      onSelect: () => {
        logout()
      }
    }]
  ]
])
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
        resizable
        collapsible
        :min-size="14"
        :default-size="16"
        :max-size="18"
    >
      <template #header="{ collapsed }">
        <div class="prose flex w-full items-center gap-3 ps-1" v-if="!collapsed">

          <!-- LOGO -->
          <img src="/img/logo.svg" alt="MHost logo" class="h-8 w-8 dark:hidden">
          <img src="/img/logo-dark.svg" alt="MHost logo" class="hidden h-8 w-8 dark:block">
          <div class="flex flex-col flex-1">
            <ProseH2 class="mhost-title my-0 dark:text-neutral-400">
              MHOST
            </ProseH2>
          </div>
          <!-- LOGO -->

          <div class="flex flex-col items-end">
            <UColorModeSwitch />
            <span class="mhost-title text-neutral-400 text-base pt-1 -mb-5">{{ config.public.version }}</span>
          </div>
        </div>
        <div v-else class="flex w-full items-center justify-center">
          <img src="/img/logo.svg" alt="MHost logo" class="h-8 w-8 dark:hidden">
          <img src="/img/logo-dark.svg" alt="MHost logo" class="hidden h-8 w-8 dark:block">
        </div>
      </template>

      <template #default="{ collapsed }">
        <UColorModeSwitch v-if="collapsed"/>
        <UNavigationMenu
            :collapsed="collapsed"
            :items="links[0]"
            orientation="vertical"
            tooltip
        />

        <div class="mt-auto space-y-4">

          <UNavigationMenu
              :collapsed="collapsed"
              :items="links[1]"
              orientation="vertical"
              tooltip
          />
        </div>
      </template>

      <template #footer="{ collapsed }">
       <div class="flex flex-col w-full">
          <PackageJobProgressBar :collapsed="collapsed" />
          <SiteScanProgressBar :collapsed="collapsed" />
        </div>
      </template>
    </UDashboardSidebar>

    <slot/>
  </UDashboardGroup>
</template>

<style scoped>
.mhost-title {
  font-family: 'Indie Flower', cursive;
}
</style>
