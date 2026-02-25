<script lang="ts" setup>
const route = useRoute()
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar
          :title="(route.meta?.title as string) ?? 'MHost'"
          :ui="{ right: 'gap-3' }"
      >
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <slot name="topbar-right" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex-1 flex flex-col min-h-0">
        <slot />
      </div>
    </template>
  </UDashboardPanel>
</template>
