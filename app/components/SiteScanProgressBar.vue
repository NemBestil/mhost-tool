<script setup lang="ts">
import {useQuery} from '@tanstack/vue-query'
import type {TypedInternalResponse} from "nitropack";

type GetServerList = TypedInternalResponse<'/api/servers/list', unknown, 'get'>
type GetServerListSingle = GetServerList[number];

const scanStore = useScanStore()
const isSlideoverOpen = ref(false)
const { data: servers } = useQuery<GetServerList>({
  queryKey: ['servers-list'],
  queryFn: () => useApiClient()('/servers/list')
})

const props = defineProps({
  collapsed: Boolean
})

// Filter options
const showTimestamps = ref(true)
const showServerNames = ref(true)
const filterOptions = ref({
  logs: true,
  errors: true,
  successes: true
})
const serverFilters = ref<{label: string, value: string}[]>([])

const serverFilterItems = computed(() => {
  if (!servers.value) return []
  return servers.value.map(server => ({
    label: server.name,
    value: server.id
  }))
})

// Initialize server filters with all servers when data is loaded
watch(serverFilterItems, (newServers) => {
  serverFilters.value = newServers
}, { immediate: true })

const progressPercent = computed(() => {
  if (!scanStore.progress) return null
  const { current, total } = scanStore.progress
  return total > 0 ? Math.round((current / total) * 100) : null
})

const statusText = computed(() => {
  const activeCount = Object.keys(scanStore.activeScans).length
  if (!scanStore.isScanning) return 'Scan completed'
  if (activeCount > 1) {
    return `Scanning ${activeCount} servers...`
  }
  if (scanStore.totalKnown && scanStore.progress) {
    return `Scanning ${scanStore.progress.total} sites`
  }
  return 'Scan running...'
})

const filteredLogs = computed(() => {
  return scanStore.logs.filter(log => {
    if ((log.type === 'error' || (log.type === 'progress' && log.message.startsWith('Failed:'))) && !filterOptions.value.errors) return false
    if (log.type === 'complete' && !filterOptions.value.successes) return false
    if (log.type === 'progress' && !log.message.startsWith('Failed:') && !filterOptions.value.successes) return false
    if (log.type === 'log' && !filterOptions.value.logs) return false
    
    // Server filter
    if (serverFilters.value.length > 0 && !serverFilters.value.find(s => s.value === log.serverId)) return false
    
    return true
  })
})

const handleClearScan = () => {
  scanStore.clearScan()
  isSlideoverOpen.value = false
}

const getServerName = (serverId: string) => {
  return servers.value?.find(s => s.id === serverId)?.name || serverId
}
</script>

<template>
  <!-- Progress Bar in Sidebar Footer -->
  <div
    v-if="scanStore.hasActivity"
    class="box-content bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 cursor-pointer w-full px-4 -mx-4 pb-4 -mb-4"
    @click="isSlideoverOpen = true"
  >
    <div class="px-2 pb-2 flex items-center gap-3" :class="scanStore.isScanning && !collapsed ? 'pt-2' : 'pt-4'">
      <Icon
        v-if="scanStore.isScanning"
        name="lucide:loader-2"
        class="size-4 animate-spin text-primary"
      />
      <Icon
        v-else
        name="lucide:check-circle"
        class="size-4 text-success"
      />
      <div class="text-sm font-medium flex-1" v-if="!collapsed">
        {{ statusText }}
        <div v-if="scanStore.progress" class="text-xs text-neutral-500">
          {{ scanStore.progress.success }} success, {{ scanStore.progress.failed }} failed
        </div>
      </div>
    </div>
    <div class="px-2 pb-2 w-full"  v-if="scanStore.isScanning && !collapsed">
      <!-- Indeterminate progress when total is not known -->
      <UProgress
        v-if="scanStore.isScanning && !scanStore.totalKnown"
        size="sm"
        color="primary"
        class="w-full"
      />
      <!-- Determinate progress when total is known -->
      <UProgress
        v-else-if="scanStore.isScanning && scanStore.totalKnown"
        :model-value="progressPercent"
        size="sm"
        color="primary"
        class="w-full"
      />
    </div>
  </div>

  <!-- Scan Log Slideover -->
  <USlideover v-model:open="isSlideoverOpen" title="Scan Log" side="right">
    <template #title>
      <div class="flex flex-col gap-3">
        <span>Scan Log</span>

        <!-- Filter Controls -->
        <div class="flex flex-wrap items-center gap-3">
          <UCheckbox
              v-model="showTimestamps"
              label="Timestamps"
          />
          <UCheckbox
              v-model="showServerNames"
              label="Server"
          />
          <UCheckbox
              v-model="filterOptions.logs"
              label="Logs"
          />
          <UCheckbox
              v-model="filterOptions.errors"
              label="Errors"
          />
          <UCheckbox
              v-model="filterOptions.successes"
              label="Successes"
          />
          <USelectMenu
              v-model="serverFilters"
              multiple
              :items="serverFilterItems"
              value-attribute="value"
              label-key="label"
              placeholder="Filter by server"
              class="w-48"
          >
            <template #leading>
              <Icon name="lucide:server" class="size-4" />
            </template>
            <template #default="{ modelValue }">
              <span v-if="!modelValue?.length || modelValue?.length === servers?.length">All Servers</span>
              <span v-else="modelValue?.length">{{ modelValue.length }} selected</span>
            </template>
          </USelectMenu>
        </div>
      </div>
    </template>

    <template #body>
      <div class="space-y-4">
        <!-- Log Entries -->
        <div class="space-y-1 font-mono text-xs">
          <div
            v-for="(log, index) in filteredLogs"
            :key="index"
            class="py-1 px-2 rounded"
            :class="{
              'bg-error/10 text-error': log.type === 'error' || (log.type === 'progress' && log.message.startsWith('Failed:')),
              'bg-success/10 text-success': log.type === 'complete',
              'bg-info/10 text-info': log.type === 'progress' && !log.message.startsWith('Failed:'),
              'text-neutral-600 dark:text-neutral-400': log.type === 'log'
            }"
          >
            <span v-if="showTimestamps" class="text-neutral-400 mr-2">{{ log.timestamp.toLocaleTimeString() }}</span>
            <span v-if="showServerNames" class="font-bold mr-2">[{{ getServerName(log.serverId) }}]</span>
            {{ log.message }}
          </div>
          <div v-if="filteredLogs.length === 0" class="text-neutral-400 text-center py-4">
            No logs to display
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Clear"
          color="neutral"
          variant="outline"
          :disabled="scanStore.isScanning"
          @click="handleClearScan"
        />
        <UButton
          label="Close"
          @click="isSlideoverOpen = false"
        />
      </div>
    </template>
  </USlideover>
</template>
