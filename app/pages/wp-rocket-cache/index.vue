<template>
  <NuxtLayout name="dashboard-page">
    <div class="flex-1 flex flex-col min-h-0">
      <UAlert
        v-if="setupStatus !== 'pending' && !featureEnabled"
        class="m-4"
        color="warning"
        variant="soft"
        title="WP Rocket Cache is disabled"
        description="Enable the WP Rocket Cache feature on the Setup overview page before using this section."
      >
        <template #actions>
          <UButton to="/settings/main" size="xs" color="warning" variant="outline" label="Open Setup overview" />
        </template>
      </UAlert>

      <template v-else>
        <div class="p-4 pb-0">
          <WpRocketCacheJobActivity />
        </div>

        <div class="px-4">
          <UAlert
            color="neutral"
            variant="soft"
            title="Scan-backed inventory"
            description="Plugin status is based on the latest site scan. Cache clearing is only available for active WP Rocket installations."
          />
        </div>

        <div class="flex items-center gap-2 px-4 py-4 border-b border-neutral-200 dark:border-neutral-800 flex-wrap">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search sites..."
            class="max-w-sm"
          >
            <template v-if="search?.length" #trailing>
              <UButton
                color="neutral"
                variant="link"
                icon="i-lucide-circle-x"
                aria-label="Clear input"
                class="cursor-pointer"
                @click="search = ''"
              />
            </template>
          </UInput>
          <USelectMenu
            v-model="selectedServer"
            :items="serverOptions"
            value-attribute="value"
            placeholder="Filter by server"
            class="w-48"
            clear
          >
            <template #leading>
              <Icon name="lucide:server" class="size-4" />
            </template>
          </USelectMenu>
          <USelectMenu
            v-model="selectedStatus"
            :items="statusOptions"
            value-attribute="value"
            placeholder="Filter by status"
            class="w-52"
            clear
          >
            <template #leading>
              <Icon name="lucide:filter" class="size-4" />
            </template>
          </USelectMenu>
        </div>

        <UTable
          :data="filteredSites"
          :columns="columns"
          :loading="status === 'pending'"
          class="table-auto flex-1"
          sticky
        >
          <template #selected-header>
            <UCheckbox
              :model-value="allSitesSelected"
              aria-label="Select all active sites"
              @update:model-value="toggleAllRows"
            />
          </template>

          <template #selected-cell="{ row }">
            <UIcon
              v-if="queueingInstallationIds.has(row.original.id)"
              name="i-lucide-loader-2"
              class="size-4 animate-spin text-primary"
            />
            <UCheckbox
              v-else
              :model-value="selectedInstallationIds.includes(row.original.id)"
              :disabled="!canSelectSite(row.original)"
              :aria-label="`Select ${decodeEntities(row.original.siteTitle)}`"
              @update:model-value="(value) => toggleRow(row.original.id, Boolean(value))"
            />
          </template>

          <template #siteTitle-cell="{ row }">
            <div class="flex flex-col">
              <NuxtLink
                :to="`/sites/${row.original.id}`"
                class="font-medium text-neutral-900 dark:text-neutral-50 hover:text-primary transition-colors cursor-pointer truncate w-full block"
                v-html="decodeEntities(row.original.siteTitle)"
              />
              <a :href="row.original.siteUrl" target="_blank" rel="noopener noreferrer" class="text-xs text-primary hover:underline">
                {{ row.original.siteUrl }}
              </a>
            </div>
          </template>

          <template #server-cell="{ row }">
            <span>{{ row.original.server.name }}</span>
          </template>

          <template #status-cell="{ row }">
            <div class="flex flex-wrap gap-2">
              <UBadge :color="getStatusColor(row.original.wpRocket.status)" variant="soft">
                {{ getWpRocketCacheStatusLabel(row.original.wpRocket.status) }}
              </UBadge>
              <UBadge
                v-if="row.original.wpRocket.pluginMainFilePath"
                color="neutral"
                variant="outline"
              >
                {{ row.original.wpRocket.pluginMainFilePath }}
              </UBadge>
            </div>
          </template>

          <template #version-cell="{ row }">
            <span v-if="row.original.wpRocket.pluginVersion">
              {{ row.original.wpRocket.pluginVersion }}
            </span>
            <span v-else class="text-sm text-neutral-400">-</span>
          </template>

          <template #actions-cell="{ row }">
            <div class="flex items-center justify-end gap-2">
              <UButton
                icon="i-lucide-rotate-cw"
                label="Clear cache"
                color="primary"
                variant="outline"
                :disabled="!canSelectSite(row.original)"
                :loading="queueingInstallationIds.has(row.original.id)"
                @click="queueCacheClear([row.original])"
              />
            </div>
          </template>
        </UTable>

        <div class="flex items-center justify-between px-4 py-3 border-t border-neutral-200 dark:border-neutral-800">
          <div class="text-sm text-muted">
            {{ selectedSites.length }} selected of {{ selectableSites.length }} active visible site(s).
          </div>
          <UButton
            color="primary"
            :variant="selectedSites.length === 0 || isProcessing ? 'outline' : 'solid'"
            :disabled="selectedSites.length === 0 || isProcessing"
            :loading="isProcessing"
            :label="`Clear selected (${selectedSites.length})`"
            icon="i-lucide-rocket"
            @click="queueCacheClear(selectedSites)"
          />
        </div>
      </template>
    </div>
  </NuxtLayout>
</template>

<script lang="ts" setup>
import type { TableColumn } from '@nuxt/ui'
import { useQuery } from '@tanstack/vue-query'
import type { TypedInternalResponse } from 'nitropack'
import { refDebounced } from '@vueuse/core'
import { canClearWpRocketCache, getWpRocketCacheStatusLabel, type WpRocketCacheListItem, type WpRocketCacheStatus } from '~/utils/wpRocketCache'

definePageMeta({
  title: 'WP Rocket Cache'
})

type WpRocketCacheListResponse = TypedInternalResponse<'/api/wp-rocket-cache/list', unknown, 'get'>
type ServerList = TypedInternalResponse<'/api/servers/list', unknown, 'get'>

const toast = useToast()
const wpRocketCacheJobStore = useWpRocketCacheJobStore()
const { data: setupSettings, status: setupStatus } = useSetupSettingsQuery()

const { data: sites, status } = useQuery<WpRocketCacheListResponse>({
  queryKey: ['wp-rocket-cache-list'],
  queryFn: () => useApiClient()('/wp-rocket-cache/list')
})
const { data: servers } = useQuery<ServerList>({
  queryKey: ['servers-list'],
  queryFn: () => useApiClient()('/servers/list')
})

const featureEnabled = computed(() => setupSettings.value?.features.wpRocketCache ?? false)
const search = ref('')
const searchThrottled = refDebounced(search, 500)
const selectedServer = ref<{ label: string, value: string }>()
const selectedStatus = ref<{ label: string, value: WpRocketCacheStatus }>()
const selectedInstallationIds = ref<string[]>([])
const queueingInstallationIds = ref<Set<string>>(new Set())
const isProcessing = ref(false)

const serverOptions = computed(() => {
  const options = []
  if (servers.value) {
    options.push(...servers.value.map((server) => ({ label: server.name, value: server.id })))
  }
  return options
})

const statusOptions = [
  { label: 'Active', value: 'active' as const },
  { label: 'Installed inactive', value: 'inactive' as const },
  { label: 'Not installed', value: 'missing' as const }
]

const filteredSites = computed(() => {
  let result = sites.value || []

  if (selectedServer.value) {
    result = result.filter((site) => site.serverId === selectedServer.value!.value)
  }

  if (selectedStatus.value) {
    result = result.filter((site) => site.wpRocket.status === selectedStatus.value!.value)
  }

  if (searchThrottled.value) {
    const query = searchThrottled.value.toLowerCase()
    result = result.filter((site) =>
      site.siteTitle.toLowerCase().includes(query) ||
      site.siteUrl.toLowerCase().includes(query) ||
      site.server.name.toLowerCase().includes(query) ||
      getWpRocketCacheStatusLabel(site.wpRocket.status).toLowerCase().includes(query) ||
      (site.wpRocket.pluginVersion?.toLowerCase().includes(query) ?? false)
    )
  }

  return result
})

const selectableSites = computed(() => {
  return filteredSites.value.filter(site => canSelectSite(site))
})

const selectedSites = computed(() => {
  const selected = new Set(selectedInstallationIds.value)
  return filteredSites.value.filter(site => selected.has(site.id))
})

const allSitesSelected = computed(() => {
  return selectableSites.value.length > 0
    && selectableSites.value.every(site => selectedInstallationIds.value.includes(site.id))
})

const columns: TableColumn<WpRocketCacheListItem>[] = [
  {
    id: 'selected',
    header: '',
    size: 0,
    meta: { class: { td: 'w-2' } }
  },
  {
    accessorKey: 'siteTitle',
    header: 'Site'
  },
  {
    accessorKey: 'server',
    header: 'Server'
  },
  {
    id: 'status',
    header: 'Status'
  },
  {
    id: 'version',
    header: 'Version'
  },
  {
    id: 'actions',
    header: '',
    size: 0,
    meta: { class: { td: 'w-2' } }
  }
]

const canSelectSite = (site: WpRocketCacheListItem) => {
  return canClearWpRocketCache(site) && !queueingInstallationIds.value.has(site.id)
}

const toggleAllRows = (value: boolean | 'indeterminate') => {
  if (value === true) {
    selectedInstallationIds.value = selectableSites.value.map(site => site.id)
    return
  }

  selectedInstallationIds.value = []
}

const toggleRow = (installationId: string, checked: boolean) => {
  const site = filteredSites.value.find(item => item.id === installationId)
  if (!site || !canSelectSite(site)) {
    return
  }

  if (checked) {
    if (!selectedInstallationIds.value.includes(installationId)) {
      selectedInstallationIds.value.push(installationId)
    }
    return
  }

  selectedInstallationIds.value = selectedInstallationIds.value.filter(id => id !== installationId)
}

const queueCacheClear = async (sitesToQueue: WpRocketCacheListItem[]) => {
  const queueableSites = sitesToQueue.filter(site => canSelectSite(site))
  if (queueableSites.length === 0) return

  const nextQueueingIds = new Set(queueingInstallationIds.value)
  for (const site of queueableSites) {
    nextQueueingIds.add(site.id)
  }

  queueingInstallationIds.value = nextQueueingIds
  isProcessing.value = queueableSites.length > 1

  try {
    await useApiClient()('/wp-rocket-cache/jobs', {
      method: 'POST',
      body: {
        jobs: queueableSites.map(site => ({
          installationId: site.id
        }))
      }
    })

    const queuedIds = new Set(queueableSites.map(site => site.id))
    selectedInstallationIds.value = selectedInstallationIds.value.filter(id => !queuedIds.has(id))

    toast.add({
      title: 'Cache clear queued',
      description: `${queueableSites.length} WP Rocket cache clear job(s) added to the queue.`,
      color: 'success'
    })

    await wpRocketCacheJobStore.refreshStatus()
  } catch (error: any) {
    toast.add({
      title: 'Failed to queue cache clear',
      description: error?.data?.message || error?.message || 'Unknown error',
      color: 'error'
    })
  } finally {
    const next = new Set(queueingInstallationIds.value)
    for (const site of queueableSites) {
      next.delete(site.id)
    }
    queueingInstallationIds.value = next
    isProcessing.value = false
  }
}

const getStatusColor = (status: WpRocketCacheStatus) => {
  if (status === 'active') {
    return 'success'
  }

  if (status === 'inactive') {
    return 'warning'
  }

  return 'neutral'
}

const decodeEntities = (text: string) => {
  if (!import.meta.client) {
    return text
  }

  const textarea = document.createElement('textarea')
  textarea.innerHTML = text
  return textarea.value
}

watch(filteredSites, (visibleSites) => {
  const visibleIds = new Set(visibleSites.map(site => site.id))
  selectedInstallationIds.value = selectedInstallationIds.value.filter(id => visibleIds.has(id))
}, { immediate: true })
</script>
