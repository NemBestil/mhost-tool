<template>
  <div class="flex-1 flex flex-col min-h-0 pt-2">
    <div class="flex items-center gap-2 px-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
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

      <USelect
        v-model="statusFilter"
        value-key="id"
        :items="statusFilterOptions"
        class="w-40"
      />
      <USelectMenu
        v-model="selectedServers"
        :items="serverOptions"
        multiple
        value-key="value"
        placeholder="Filter by server"
        :search-input="false"
        class="w-48"
      >
        <template #leading>
          <Icon name="lucide:server" class="size-4" />
        </template>
      </USelectMenu>
    </div>

    <UTable
      ref="table"
      v-model:sorting="sorting"
      v-model:expanded="expanded"
      :data="filteredSites"
      :columns="columns"
      :loading="sitesStatus === 'pending'"
      :get-row-id="(row) => row.id"
      sticky
      class="table-auto flex-1"
    >
      <template #siteTitle-cell="{ row }">
        <div class="flex flex-col">
          <NuxtLink
            :to="`/sites/${row.original.id}`"
            class="font-medium text-neutral-900 dark:text-neutral-50 hover:text-primary transition-colors cursor-pointer truncate w-full block max-w-64 truncate block"
            v-html="decodeEntities(row.original.siteTitle)"
          />
          <a :href="row.original.siteUrl" target="_blank" class="text-xs text-primary hover:underline">
            {{ row.original.siteUrl }}
          </a>
        </div>
      </template>

      <template #server-cell="{ row }">
        <span>{{ row.original.server.name }}</span>
      </template>

      <template #monitoringLevel-cell="{ row }">
        <USelect
          :model-value="row.original.monitoringLevel"
          :items="monitoringLevelOptions"
          value-key="id"
          class="w-44"
          @update:model-value="(value : MonitoringLevel) => updateSiteMonitoringLevel(row.original, value)"
        >
          <template #item-label="{ item }">
            <span :class="item.color ? `text-${item.color}` : ''">{{ item.label }}</span>
          </template>
          <template #default="{ modelValue }">
            <span v-if="modelValue" :class="monitoringLevelOptions.find(o => o.id === modelValue)?.color ? `text-${monitoringLevelOptions.find(o => o.id === modelValue)?.color}` : ''">
              {{ monitoringLevelOptions.find(o => o.id === modelValue)?.label }}
            </span>
          </template>
        </USelect>
      </template>

      <template #monitoringStatus-cell="{ row }">
        <div class="flex flex-col">
          <UBadge
            :color="row.original.monitoringStatus === 'DOWN' ? 'error' : (row.original.monitoringStatus === 'UP' ? 'success' : 'neutral')"
            variant="subtle"
          >
            {{ row.original.monitoringStatus === 'DOWN' ? 'Down' : (row.original.monitoringStatus === 'UP' ? 'Up' : 'Unknown') }}
          </UBadge>
          <span
            v-if="row.original.monitoringStatus === 'DOWN' && row.original.monitoringCurrentStatusSince"
            class="text-xs text-neutral-500 mt-1"
            :title="formatFullDate(row.original.monitoringCurrentStatusSince)"
          >
            Since {{ formatRelativeTime(row.original.monitoringCurrentStatusSince) }}
          </span>
          <span
            v-if="row.original.monitoringStatus === 'DOWN' && row.original.monitoringFailedAttempts > 0"
            class="text-xs text-neutral-500"
          >
            Attempts: {{ row.original.monitoringFailedAttempts }}
          </span>
        </div>
      </template>

      <template #monitoringLastCheckedAt-cell="{ row }">
        <span
          v-if="row.original.monitoringLastCheckedAt"
          class="text-sm"
          :title="formatFullDate(row.original.monitoringLastCheckedAt)"
        >
          {{ formatRelativeTime(row.original.monitoringLastCheckedAt) }}
        </span>
        <span v-else class="text-sm text-neutral-400">Never</span>
      </template>

      <template #expanded="{ row }">
        <div class="px-6 py-3 bg-neutral-50 dark:bg-neutral-900/40 border-b border-neutral-200 dark:border-neutral-800">
          <div class="mb-4 p-3 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950">
            <div class="text-sm font-medium mb-2">Site checks</div>
            <div class="grid grid-cols-1 lg:grid-cols-[240px_140px_140px_auto] gap-3 items-end">
              <UFormField label="Test /wp-login.php">
                <USwitch
                  :model-value="getSiteCheckDraft(row.original).monitoringTestWpLogin"
                  @update:model-value="(value: boolean) => updateDraftField(row.original.id, 'monitoringTestWpLogin', value)"
                />
              </UFormField>
              <UFormField label="Frontpage status min">
                <UInput
                  :model-value="String(getSiteCheckDraft(row.original).monitoringFrontpageStatusMin)"
                  type="number"
                  min="100"
                  max="599"
                  @update:model-value="(value) => updateDraftField(row.original.id, 'monitoringFrontpageStatusMin', parseStatusCode(value, 200))"
                />
              </UFormField>
              <UFormField label="Frontpage status max">
                <UInput
                  :model-value="String(getSiteCheckDraft(row.original).monitoringFrontpageStatusMax)"
                  type="number"
                  min="100"
                  max="599"
                  @update:model-value="(value) => updateDraftField(row.original.id, 'monitoringFrontpageStatusMax', parseStatusCode(value, 299))"
                />
              </UFormField>
              <UButton
                label="Save checks"
                icon="i-lucide-save"
                :loading="updatingSiteChecks[row.original.id]"
                @click="saveSiteChecks(row.original)"
              />
            </div>
            <p class="text-xs text-amber-600 mt-2">
              Enable /wp-login.php checks only on selected sites. This can add significant server load, but is a strong test that PHP is running and the database is connected.
            </p>
          </div>

          <div v-if="historyLoading[row.original.id]" class="flex items-center gap-2 text-sm text-neutral-500">
            <UIcon name="i-lucide-loader-2" class="size-4 animate-spin" />
            Loading monitor history...
          </div>
          <div v-else-if="!(historyBySiteId[row.original.id] || []).length" class="text-sm text-neutral-500">
            No monitor history yet.
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="eventItem in historyBySiteId[row.original.id]"
              :key="eventItem.id"
              class="flex items-start justify-between gap-4 text-sm"
            >
              <div class="flex items-center gap-2">
                <UBadge :color="eventItem.status === 'DOWN' ? 'error' : 'success'" variant="subtle">
                  {{ eventItem.status }}
                </UBadge>
                <span>{{ eventItem.details || defaultEventDetails(eventItem.status) }}</span>
              </div>
              <span class="text-xs text-neutral-500 whitespace-nowrap" :title="formatFullDate(eventItem.occurredAt)">
                {{ formatRelativeTime(eventItem.occurredAt) }}
              </span>
            </div>
          </div>
        </div>
      </template>
    </UTable>

    <div class="flex items-center justify-between px-4 py-3 border-t border-neutral-200 dark:border-neutral-800">
      <div class="text-sm text-muted">
        {{ selectedCount }} of {{ filteredSites.length }} row(s) selected.
      </div>
      <UDropdownMenu
        v-if="selectedCount > 0"
        :items="batchActionItems"
        :content="{ align: 'end' }"
      >
        <UButton
          color="neutral"
          variant="outline"
          label="Batch Actions"
          trailing-icon="i-lucide-chevron-down"
        />
      </UDropdownMenu>
    </div>
  </div>

  <UModal v-model:open="setMonitoringModalOpen" title="Set monitoring level">
    <template #body>
      <div class="space-y-3">
        <p class="text-sm text-muted">
          Set monitoring level for <strong>{{ selectedCount }}</strong> selected site(s).
        </p>
        <USelectMenu
          v-model="batchMonitoringLevel"
          :items="monitoringLevelOptions"
          value-key="id"
          class="w-64"
          :disabled="isApplyingBatch"
        >
          <template #item-label="{ item }">
            <span :class="item.color ? `text-${item.color}` : ''">{{ item.label }}</span>
          </template>
          <template #default="{ modelValue }">
            <span v-if="modelValue" :class="monitoringLevelOptions.find(o => o.id === modelValue)?.color ? `text-${monitoringLevelOptions.find(o => o.id === modelValue)?.color}` : ''">
              {{ monitoringLevelOptions.find(o => o.id === modelValue)?.label }}
            </span>
          </template>
        </USelectMenu>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          label="Cancel"
          :disabled="isApplyingBatch"
          @click="setMonitoringModalOpen = false"
        />
        <UButton
          label="Apply"
          :loading="isApplyingBatch"
          @click="applyBatchMonitoringLevel"
        />
      </div>
    </template>
  </UModal>
</template>

<script lang="ts" setup>
import { h, resolveComponent } from 'vue'
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import { formatDistanceToNow } from 'date-fns'
import { useQuery, useQueryClient } from '@tanstack/vue-query'

type MonitoringLevel = 'NONE' | 'NORMAL' | 'HIGH'
type MonitoringStatus = 'UP' | 'DOWN' | 'UNKNOWN'

type MonitoringSite = {
  id: string
  siteTitle: string
  siteUrl: string
  monitoringLevel: MonitoringLevel
  monitoringStatus: MonitoringStatus
  monitoringCurrentStatusSince: string | null
  monitoringLastCheckedAt: string | null
  monitoringTestWpLogin: boolean
  monitoringFrontpageStatusMin: number
  monitoringFrontpageStatusMax: number
  monitoringFailedAttempts: number
  server: {
    id: string
    name: string
  }
}

type MonitoringEvent = {
  id: string
  status: MonitoringStatus
  occurredAt: string
  details: string | null
}

const UCheckbox = resolveComponent('UCheckbox')
const UButton = resolveComponent('UButton')

const toast = useToast()
const table = useTemplateRef('table')
const queryClient = useQueryClient()

const { data: sites, status: sitesStatus, refetch: refetchSites } = useQuery<MonitoringSite[]>({
  queryKey: ['monitoring-sites'],
  queryFn: () => $fetch('/api/monitoring/sites/list'),
})

const monitoringLevelOptions = [
  { label: 'High priority', id: 'HIGH' as MonitoringLevel, color: 'error' as const },
  { label: 'Normal priority', id: 'NORMAL' as MonitoringLevel, color: 'primary' as const },
  { label: 'None', id: 'NONE' as MonitoringLevel, color: 'neutral' as const }
]

const statusFilterOptions = [
  { label: 'All', id: 'ALL' as const },
  { label: 'Up', id: 'UP' as const },
  { label: 'Down', id: 'DOWN' as const },
  { label: 'Unknown', id: 'UNKNOWN' as const }
]

const sorting = ref([{ id: 'siteTitle', desc: false }])
const expanded = ref<Record<string, boolean>>({})
const search = ref('')
const statusFilter = ref<'ALL' | MonitoringStatus>('ALL')

// Server filter - extract unique servers from sites
const serverOptions = computed(() => {
  if (!sites.value) return []
  const uniqueServers = new Map<string, { label: string, value: string }>()
  for (const site of sites.value) {
    if (!uniqueServers.has(site.server.id)) {
      uniqueServers.set(site.server.id, { label: site.server.name, value: site.server.id })
    }
  }
  return Array.from(uniqueServers.values()).sort((a, b) => a.label.localeCompare(b.label))
})

// Initialize with all servers selected by default
const selectedServers = ref<string[]>([])

// Watch for serverOptions changes to auto-select all servers when data loads
watch(serverOptions, (newOptions) => {
  if (newOptions.length > 0 && selectedServers.value.length === 0) {
    selectedServers.value = newOptions.map(option => option.value)
  }
}, { immediate: true })

const filteredSites = computed(() => {
  let result = sites.value || []

  // Filter by selected servers
  if (selectedServers.value.length < serverOptions.value.length) {
    const selectedServerIds = new Set(selectedServers.value.map(s => s))
    result = result.filter(site => selectedServerIds.has(site.server.id))
  }

  if (statusFilter.value !== 'ALL') {
    result = result.filter(site => site.monitoringStatus === statusFilter.value)
  }

  if (search.value.trim()) {
    const query = search.value.toLowerCase().trim()
    result = result.filter(site =>
      site.siteTitle.toLowerCase().includes(query) ||
      site.siteUrl.toLowerCase().includes(query) ||
      site.server.name.toLowerCase().includes(query)
    )
  }

  return result
})

const selectedCount = computed(() => {
  return table.value?.tableApi?.getFilteredSelectedRowModel().rows.length || 0
})

const getSelectedSiteIds = () => {
  const selectedRows = table.value?.tableApi?.getFilteredSelectedRowModel().rows || []
  return selectedRows.map((row: any) => row.original.id)
}

const historyBySiteId = ref<Record<string, MonitoringEvent[]>>({})
const historyLoading = ref<Record<string, boolean>>({})
const updatingSiteLevel = ref<Record<string, boolean>>({})
const updatingSiteChecks = ref<Record<string, boolean>>({})
const siteCheckDraftById = ref<Record<string, {
  monitoringTestWpLogin: boolean
  monitoringFrontpageStatusMin: number
  monitoringFrontpageStatusMax: number
}>>({})

const setMonitoringModalOpen = ref(false)
const isApplyingBatch = ref(false)
const batchMonitoringLevel = ref<MonitoringLevel>('NORMAL')

const createSortableColumn = (accessorKey: string, label: string, sortingFn?: any) => {
  const column: any = {
    accessorKey,
    header: ({ column }: any) => {
      const isSorted = column.getIsSorted()
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label,
        icon: isSorted ? (isSorted === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow') : 'i-lucide-arrow-up-down',
        class: '-mx-2.5 -my-2.5',
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
      })
    }
  }

  if (sortingFn) {
    column.sortingFn = sortingFn
  }

  return column
}

const toggleExpandRow = async (row: any) => {
  const wasExpanded = row.getIsExpanded()
  row.toggleExpanded()

  if (!wasExpanded) {
    initializeSiteCheckDraft(row.original)
    await loadHistory(row.original.id)
  }
}

const columns: TableColumn<MonitoringSite>[] = [
  {
    id: 'expand',
    header: '',
    cell: ({ row }) => h(UButton, {
      color: 'neutral',
      variant: 'ghost',
      icon: row.getIsExpanded() ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right',
      class: 'p-1',
      onClick: () => toggleExpandRow(row)
    }),
    enableSorting: false,
    enableHiding: false
  },
  {
    id: 'select',
    header: ({ table }: any) => h(UCheckbox, {
      modelValue: table.getIsSomePageRowsSelected() ? 'indeterminate' : table.getIsAllPageRowsSelected(),
      'onUpdate:modelValue': (value: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!value),
      ariaLabel: 'Select all'
    }),
    cell: ({ row }) => h(UCheckbox, {
      modelValue: row.getIsSelected(),
      'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
      ariaLabel: 'Select row'
    }),
    enableSorting: false,
    enableHiding: false
  },
  createSortableColumn('siteTitle', 'Site'),
  createSortableColumn('server', 'Server', (rowA: any, rowB: any) => {
    return rowA.original.server.name.localeCompare(rowB.original.server.name)
  }),
  createSortableColumn('monitoringLevel', 'Monitoring', (rowA: any, rowB: any) => {
    const weights: Record<MonitoringLevel, number> = {
      NONE: 0,
      NORMAL: 1,
      HIGH: 2
    }
    return weights[rowA.original.monitoringLevel as MonitoringLevel] - weights[rowB.original.monitoringLevel as MonitoringLevel]
  }),
  createSortableColumn('monitoringStatus', 'Status'),
  createSortableColumn('monitoringLastCheckedAt', 'Last checked')
]

const batchActionItems = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: 'Set monitoring',
      icon: 'i-lucide-bell',
      onSelect: () => {
        setMonitoringModalOpen.value = true
      }
    }
  ]
])

const loadHistory = async (siteId: string) => {
  if (historyBySiteId.value[siteId] || historyLoading.value[siteId]) {
    return
  }

  historyLoading.value[siteId] = true
  try {
    const response = await queryClient.fetchQuery({
      queryKey: ['monitoring-site-events', siteId],
      queryFn: () => $fetch<{ events: MonitoringEvent[] }>(`/api/monitoring/sites/${siteId}/events`),
      staleTime: 0
    })
    historyBySiteId.value[siteId] = response.events
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to load monitor history.',
      color: 'error'
    })
    historyBySiteId.value[siteId] = []
  } finally {
    historyLoading.value[siteId] = false
  }
}

const updateSiteMonitoringLevel = async (site: MonitoringSite, level: MonitoringLevel) => {
  if (site.monitoringLevel === level) return

  updatingSiteLevel.value[site.id] = true

  try {
    await $fetch(`/api/monitoring/sites/${site.id}/level`, {
      method: 'PUT',
      body: {
        monitoringLevel: level
      }
    })

    // Update the site in the query cache
    queryClient.setQueryData<MonitoringSite[]>(['monitoring-sites'], (oldData) => {
      if (!oldData) return oldData
      return oldData.map(s => s.id === site.id ? { ...s, monitoringLevel: level } : s)
    })
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to update monitoring level.',
      color: 'error'
    })
  } finally {
    updatingSiteLevel.value[site.id] = false
  }
}

const initializeSiteCheckDraft = (site: MonitoringSite) => {
  if (siteCheckDraftById.value[site.id]) {
    return
  }

  siteCheckDraftById.value[site.id] = {
    monitoringTestWpLogin: site.monitoringTestWpLogin,
    monitoringFrontpageStatusMin: site.monitoringFrontpageStatusMin,
    monitoringFrontpageStatusMax: site.monitoringFrontpageStatusMax
  }
}

const getSiteCheckDraft = (site: MonitoringSite) => {
  initializeSiteCheckDraft(site)
  return siteCheckDraftById.value[site.id]
}

const updateDraftField = (
  siteId: string,
  field: 'monitoringTestWpLogin' | 'monitoringFrontpageStatusMin' | 'monitoringFrontpageStatusMax',
  value: boolean | number
) => {
  if (!siteCheckDraftById.value[siteId]) {
    return
  }

  ;(siteCheckDraftById.value[siteId] as any)[field] = value
}

const parseStatusCode = (value: string | number | undefined, fallback: number) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  const integerValue = Math.floor(parsed)
  if (integerValue < 100) return 100
  if (integerValue > 599) return 599
  return integerValue
}

const saveSiteChecks = async (site: MonitoringSite) => {
  const draft = getSiteCheckDraft(site)

  if (draft.monitoringFrontpageStatusMin > draft.monitoringFrontpageStatusMax) {
    toast.add({
      title: 'Validation error',
      description: 'Frontpage status min must be less than or equal to max.',
      color: 'error'
    })
    return
  }

  updatingSiteChecks.value[site.id] = true
  try {
    const updated = await $fetch(`/api/monitoring/sites/${site.id}/config`, {
      method: 'PUT',
      body: draft
    })

    queryClient.setQueryData<MonitoringSite[]>(['monitoring-sites'], (oldData) => {
      if (!oldData) return oldData
      return oldData.map(s => {
        if (s.id !== site.id) return s
        return {
          ...s,
          monitoringTestWpLogin: updated.monitoringTestWpLogin,
          monitoringFrontpageStatusMin: updated.monitoringFrontpageStatusMin,
          monitoringFrontpageStatusMax: updated.monitoringFrontpageStatusMax
        }
      })
    })

    toast.add({
      title: 'Checks updated',
      description: 'Monitoring checks have been updated for this site.',
      color: 'success'
    })
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to update site checks.',
      color: 'error'
    })
  } finally {
    updatingSiteChecks.value[site.id] = false
  }
}

const applyBatchMonitoringLevel = async () => {
  const siteIds = getSelectedSiteIds()
  if (siteIds.length === 0) return

  isApplyingBatch.value = true
  try {
    await $fetch('/api/monitoring/sites/batch-level', {
      method: 'POST',
      body: {
        siteIds,
        monitoringLevel: batchMonitoringLevel.value
      }
    })

    await refetchSites()
    table.value?.tableApi?.resetRowSelection()
    setMonitoringModalOpen.value = false

    toast.add({
      title: 'Monitoring updated',
      description: `${siteIds.length} site(s) updated.`,
      color: 'success'
    })
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to apply monitoring level.',
      color: 'error'
    })
  } finally {
    isApplyingBatch.value = false
  }
}

const defaultEventDetails = (status: MonitoringStatus) => {
  if (status === 'DOWN') return 'Site is down'
  return 'Site is up again'
}

const formatRelativeTime = (dateStr: string) => {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
}

const formatFullDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString()
}

const decodeEntities = (text: string) => {
  if (import.meta.server) return text
  const textarea = document.createElement('textarea')
  textarea.innerHTML = text
  return textarea.value
}
</script>
