<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()

const items = computed<NavigationMenuItem[]>(() => {
  return [
    {
      label: 'Overview',
      icon: 'i-lucide-layout-grid',
      to: '/settings/main',
      active: route.path === '/settings' || route.path === '/settings/main'
    },
    {
      label: 'Notifications',
      icon: 'i-lucide-bell',
      to: '/settings/notifications',
      active: route.path.startsWith('/settings/notifications')
    }
  ]
})
</script>

<template>
  <UNavigationMenu :items="items" class="w-full -mt-6 -ms-1" />
</template>
