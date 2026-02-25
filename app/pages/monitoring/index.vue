<template>
  <NuxtLayout name="dashboard-page">
    <div class="flex-1 flex flex-col min-h-0">
      <div class="px-4">
        <UTabs
          v-model="activeTab"
          :items="navItems"
          class="w-full"
        />
      </div>

      <MonitoringSites v-if="activeTab === 'sites'" />
      <MonitoringConfiguration v-else-if="activeTab === 'configuration'" />
    </div>
  </NuxtLayout>
</template>

<script lang="ts" setup>

definePageMeta({
  title: 'Monitoring'
})

const navItems = [
  {
    label: 'Site list',
    icon: 'i-lucide-list',
    value: 'sites'
  },
  {
    label: 'Configuration',
    icon: 'i-lucide-settings',
    value: 'configuration'
  }
]

const activeTab = ref('sites')
</script>
