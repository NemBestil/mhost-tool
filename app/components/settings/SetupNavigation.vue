<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const { data } = useSetupSettingsQuery()

const items = computed<NavigationMenuItem[]>(() => {
  const navItems: NavigationMenuItem[] = [
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

  if (data.value?.features.wpMailSmtpPro) {
    navItems.push({
      label: 'WP Mail SMTP Pro',
      icon: 'i-lucide-mail-check',
      to: '/settings/wp-mail-smtp-pro',
      active: route.path.startsWith('/settings/wp-mail-smtp-pro')
    })
  }

  return navItems
})
</script>

<template>
  <UNavigationMenu :items="items" class="w-full -mt-6 -ms-1" />
</template>
