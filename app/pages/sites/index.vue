<template>
  <NuxtLayout name="dashboard-page">
    <template #topbar-right>
      <UDropdownMenu :items="scanMenuItems">
        <UButton
            icon="i-lucide-scan"
            label="Scan"
        />
      </UDropdownMenu>
    </template>

    <div class="flex items-center gap-2 px-4 pb-4 sm:pt-4 border-b border-neutral-200 dark:border-neutral-800">
      <!-- Desktop filters -->
      <div class="hidden md:flex items-center gap-2 flex-1">
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
            v-model="selectedHostingStatus"
            :items="hostingStatusOptions"
            value-attribute="value"
            placeholder="Filter by status"
            class="w-48"
            clear
        >
          <template #leading>
            <Icon name="lucide:signal" class="size-4" />
          </template>
        </USelectMenu>
        <USelectMenu
            v-model="selectedCoreVersion"
            :items="coreVersionOptions"
            placeholder="Core version"
            class="w-48"
            clear
        >
          <template #leading>
            <Icon name="lucide:binary" class="size-4" />
          </template>
        </USelectMenu>
        <UCheckbox
            v-model="showDevSites"
            label="Dev-sites"
            class="ml-2"
        />
      </div>

      <!-- Mobile filters -->
      <div class="flex md:hidden items-center gap-2 w-full">
        <UDrawer v-model:open="isFilterDrawerOpen" title="Filters">
          <UButton
              icon="i-lucide-filter"
              color="neutral"
              variant="outline"
              label="Filter"
              class="flex-1"
              :badge="activeFilterCount > 0 ? activeFilterCount : undefined"
          />

          <template #body>
            <div class="flex flex-col gap-6 p-4">
              <UFormField label="Search">
                <UInput
                    v-model="search"
                    icon="i-lucide-search"
                    placeholder="Search sites..."
                    class="w-full"
                    size="xl"
                >
                  <template v-if="search?.length" #trailing>
                    <UButton
                        color="neutral"
                        variant="link"
                        icon="i-lucide-circle-x"
                        class="cursor-pointer"
                        @click="search = ''"
                    />
                  </template>
                </UInput>
              </UFormField>

              <UFormField label="Server">
                <USelectMenu
                    v-model="selectedServer"
                    :items="serverOptions"
                    value-attribute="value"
                    placeholder="All servers"
                    class="w-full"
                    size="xl"
                    clear
                >
                  <template #leading>
                    <Icon name="lucide:server" class="size-4" />
                  </template>
                </USelectMenu>
              </UFormField>

              <UFormField label="Status">
                <USelectMenu
                    v-model="selectedHostingStatus"
                    :items="hostingStatusOptions"
                    value-attribute="value"
                    placeholder="All statuses"
                    class="w-full"
                    size="xl"
                    clear
                >
                  <template #leading>
                    <Icon name="lucide:signal" class="size-4" />
                  </template>
                </USelectMenu>
              </UFormField>

              <UFormField label="Core version">
                <USelectMenu
                    v-model="selectedCoreVersion"
                    :items="coreVersionOptions"
                    placeholder="All versions"
                    class="w-full"
                    size="xl"
                    clear
                >
                  <template #leading>
                    <Icon name="lucide:binary" class="size-4" />
                  </template>
                </USelectMenu>
              </UFormField>

              <UCheckbox
                  v-model="showDevSites"
                  label="Dev-sites"
                  size="lg"
              />
            </div>
          </template>

          <template #footer>
            <div class="flex flex-col gap-2 w-full">
              <UButton
                  :disabled="activeFilterCount === 0"
                  label="Clear filters"
                  color="neutral"
                  variant="subtle"
                  block
                  @click="clearFilters"
              />
              <UButton
                  label="Close"
                  color="neutral"
                  variant="outline"
                  block
                  @click="isFilterDrawerOpen = false"
              />
            </div>
          </template>
        </UDrawer>
      </div>
    </div>

    <UTable
        ref="table"
        virtualize
        v-model:sorting="sorting"
        :data="filteredSites"
        :columns="columns"
        :loading="status === 'pending'"
        :get-row-id="(row) => row.id"
        class="flex-1"
    >
      <!-- Site Title Column -->
      <template #siteTitle-cell="{ row }">
        <div class="flex flex-col">
          <NuxtLink :to="`/sites/${row.original.id}`"
                    class="font-medium text-neutral-900 dark:text-neutral-50 hover:text-primary transition-colors cursor-pointer truncate w-full block"
                    v-html="decodeEntities(row.original.siteTitle)"></NuxtLink>
          <a :href="row.original.siteUrl" target="_blank" class="text-xs text-primary hover:underline">
            {{ row.original.siteUrl }}
          </a>
        </div>
      </template>

      <!-- Server Column -->
      <template #server-cell="{ row }">
        <span>{{ row.original.server.name }}</span>
      </template>

      <!-- Status Column -->
      <template #status-cell="{ row }">
        <div class="flex items-center gap-1">
          <UTooltip :text="getHostingStatusLabel(row.original.hostingStatus)">
            <UBadge
                :color="getHostingStatusColor(row.original.hostingStatus)"
                variant="subtle"
                class="text-base px-1"
            >
              <Icon :name="getHostingStatusIcon(row.original.hostingStatus)" class="size-4" />
            </UBadge>
          </UTooltip>
          <UTooltip :text="isDevSite(row.original.siteUrl) ? 'Development Site' : 'Production Site'">
            <UBadge
                :color="isDevSite(row.original.siteUrl) ? 'warning' : 'info'"
                variant="subtle"
                class="text-base px-1"
            >
              <Icon :name="isDevSite(row.original.siteUrl) ? 'lucide:flask-conical' : 'lucide:flask-conical-off'" class="size-4" />
            </UBadge>
          </UTooltip>
          <UBadge
              v-if="row.original.wordpressVersion"
              color="neutral"
              variant="subtle"
              :label="row.original.wordpressVersion"
          />
        </div>
      </template>

      <!-- CVE Column -->
      <template #currentCve-cell="{ row }">
        <UBadge
          v-if="row.original.currentCve != null"
          :color="getCveColor(row.original.currentCve)"
          variant="subtle"
          class="cursor-pointer"
          @click="openCveModal(row.original.id)"
        >
          {{ row.original.currentCve.toFixed(1) }}
        </UBadge>
      </template>

      <!-- Last Scan Column -->
      <template #lastScanAt-cell="{ row }">
          <span v-if="row.original.lastScanAt" class="text-sm" :title="formatFullDate(row.original.lastScanAt)">
            {{ formatRelativeTime(row.original.lastScanAt) }}
          </span>
        <span v-else class="text-sm text-neutral-400">Never</span>
      </template>

      <!-- Actions Column -->
      <template #actions-cell="{ row }">
        <div class="flex items-center justify-end gap-2">
          <UButton
              icon="i-lucide-log-in"
              :color="row.original.autoLoginUser ? 'primary' : 'warning'"
              variant="ghost"
              size="xl"
              :to="`/sites/${row.original.id}/wp-login`"
              target="_blank"
          />

          <UDropdownMenu
              :items="getActionItems(row.original)"
              :content="{
                  align: 'end',
                  side: 'bottom'
                }">
            <UButton
                color="neutral"
                variant="ghost"
                size="xl"
                icon="lucide:more-horizontal"
            />
          </UDropdownMenu>
        </div>
      </template>
    </UTable>

    <!-- Table Footer with Batch Actions -->
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

    <!-- Delete Confirmation Modal -->
    <UModal
        v-model:open="deleteModalOpen"
        :title="deleteCount === 1 ? 'Delete Site' : 'Delete Selected Sites'"
        :content="{ onOpenAutoFocus: handleDeleteModalOpenAutoFocus }"
        @after:enter="focusDeleteButton"
    >
      <template #body>
        <p class="text-sm text-muted">
          Are you sure you want to delete <strong>{{ deleteCount }}</strong> site(s) from MHost?
        </p>
        <p class="text-sm text-muted mt-2">
          The actual WordPress® sites will remain untouched on your servers. Only the records in MHost will be removed.
        </p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
              color="neutral"
              variant="outline"
              label="Cancel"
              @click="deleteModalOpen = false"
          />
          <UButton
              data-site-delete-confirm
              color="error"
              label="Delete"
              :loading="isDeleting"
              @click="confirmDelete"
          />
        </div>
      </template>
    </UModal>

    <SiteCveModal v-model:open="cveModalOpen" :site-id="cveModalSiteId" />
  </NuxtLayout>
</template>

<script lang="ts" setup>
import {h, resolveComponent} from 'vue'
import {UButton} from '#components'
import type {TableColumn} from '@nuxt/ui'
import {formatDistanceToNow} from 'date-fns'
import {useQuery} from '@tanstack/vue-query'
import type {TypedInternalResponse} from 'nitropack'
import {refDebounced} from "@vueuse/core";

const UCheckbox = resolveComponent('UCheckbox')

definePageMeta({
  title: 'WordPress® Sites'
})

const scanStore = useScanStore()
const packageJobStore = usePackageJobStore()
const toast = useToast()
type SiteList = TypedInternalResponse<'/api/sites/list', unknown, 'get'>
type ServerList = TypedInternalResponse<'/api/servers/list', unknown, 'get'>

const {data: sites, status, refetch: refetchSites} = useQuery<SiteList>({
  queryKey: ['sites-list'],
  queryFn: () => useApiClient()('/sites/list')
})
const {data: servers} = useQuery<ServerList>({
  queryKey: ['servers-list'],
  queryFn: () => useApiClient()('/servers/list')
})
const { data: setupSettings } = useSetupSettingsQuery()

const table = useTemplateRef('table')
const search = ref('')
const searchThrottled = refDebounced(search, 500)
const sorting = ref([{id: 'siteTitle', desc: false}])

const selectedServer = ref<{ label: string, value: string } | null>(null)
const selectedHostingStatus = ref<{ label: string, value: string } | null>(null)
const selectedCoreVersion = ref<string | null>(null)
const showDevSites = ref(true)
const isFilterDrawerOpen = ref(false)

const activeFilterCount = computed(() => {
  let count = 0
  if (search.value) count++
  if (selectedServer.value) count++
  if (selectedHostingStatus.value) count++
  if (selectedCoreVersion.value) count++
  if (!showDevSites.value) count++
  return count
})

const clearFilters = () => {
  search.value = ''
  selectedServer.value = null
  selectedHostingStatus.value = null
  selectedCoreVersion.value = null
  showDevSites.value = true
}

const isDevSite = (siteUrl: string) => {
  if (!setupSettings.value?.developmentSites) return false
  const patterns = setupSettings.value.developmentSites.split(/\s+/).filter(Boolean)
  return patterns.some(p => siteUrl.toLowerCase().includes(p.toLowerCase()))
}
const hostingStatusOptions = [
  { label: 'Public', value: 'PUBLIC' },
  { label: 'Private', value: 'PRIVATE' },
  { label: 'Inactive', value: 'INACTIVE' },
  { label: 'Unknown', value: 'UNKNOWN' }
]
const serverOptions = computed(() => {
  const options = []
  if (servers.value) {
    options.push(...servers.value.map(s => ({label: s.name, value: s.id})))
  }
  return options
})
const coreVersionOptions = computed(() => {
  const versions = (sites.value || [])
    .map(site => site.wordpressVersion)
    .filter((version): version is string => Boolean(version))

  return [...new Set(versions)].sort((a, b) => b.localeCompare(a, undefined, {numeric: true}))
})

const filteredSites = computed(() => {
  let result = sites.value || []

  if (selectedServer.value) {
    result = result.filter(s => s.serverId === selectedServer.value!.value)
  }

  if (selectedHostingStatus.value) {
    result = result.filter(s => s.hostingStatus === selectedHostingStatus.value!.value)
  }

  if (selectedCoreVersion.value) {
    result = result.filter(s => s.wordpressVersion === selectedCoreVersion.value)
  }

  if (searchThrottled.value) {
    const q = searchThrottled.value.toLowerCase()
    result = result.filter(s =>
        s.siteTitle.toLowerCase().includes(q) ||
        s.siteUrl.toLowerCase().includes(q)
    )
  }

  if (!showDevSites.value) {
    result = result.filter(s => !isDevSite(s.siteUrl))
  }

  return result
})

type Site = NonNullable<typeof sites.value>[number]

// Selection state
const selectedCount = computed((): number => table.value?.tableApi?.getFilteredSelectedRowModel().rows.length || 0)

const getSelectedSiteIds = () => {
  const selectedRows = table.value?.tableApi?.getFilteredSelectedRowModel().rows || []
  return selectedRows.map((row: any) => row.original.id)
}

// CVE modal state
const cveModalOpen = ref(false)
const cveModalSiteId = ref<string | null>(null)

const openCveModal = (siteId: string) => {
  cveModalSiteId.value = siteId
  cveModalOpen.value = true
}

// Delete modal state
const deleteModalOpen = ref(false)
const isDeleting = ref(false)
const siteIdsToDelete = ref<string[]>([])
const deleteCount = computed(() => siteIdsToDelete.value.length)

const focusDeleteButton = () => {
  requestAnimationFrame(() => {
    document.querySelector<HTMLButtonElement>('[data-site-delete-confirm]')?.focus({preventScroll: true})
  })
}

const handleDeleteModalOpenAutoFocus = (event: Event) => {
  event.preventDefault()
  focusDeleteButton()
}

// Batch action items
const batchActionItems = computed(() => [
  [
    {
      label: 'Update WordPress',
      icon: 'lucide:circle-arrow-up',
      onSelect: () => queueWordPressUpdates(getSelectedSiteIds())
    }
  ],
  [
    {
      label: 'Delete',
      icon: 'lucide:trash',
      color: 'error' as const,
      onSelect: () => {
        siteIdsToDelete.value = getSelectedSiteIds()
        deleteModalOpen.value = true
      }
    }
  ]
])

const queueWordPressUpdates = async (siteIds: string[]) => {
  const uniqueSiteIds = [...new Set(siteIds.filter(Boolean))]
  if (uniqueSiteIds.length === 0) return

  try {
    await useApiClient()('/packages/jobs', {
      method: 'POST',
      body: {
        jobs: uniqueSiteIds.map(installationId => ({
          installationId,
          kind: 'core',
          slug: 'wordpress',
          operation: 'update'
        }))
      }
    })

    toast.add({
      title: 'WordPress updates queued',
      description: `${uniqueSiteIds.length} site update(s) added to the queue.`,
      color: 'success',
      icon: 'i-lucide-circle-arrow-up'
    })

    await packageJobStore.refreshStatus()
  } catch (error: any) {
    toast.add({
      title: 'Failed to queue WordPress updates',
      description: error?.data?.message || error?.message || 'Unknown error',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  }
}

const confirmDelete = async () => {
  const siteIds = siteIdsToDelete.value
  if (siteIds.length === 0) return

  isDeleting.value = true
  try {
    await useApiClient()('/sites/batch-delete', {
      method: 'POST',
      body: { siteIds }
    })

    toast.add({
      title: 'Sites deleted',
      description: `${siteIds.length} site(s) have been removed from MHost.`,
      color: 'success',
      icon: 'i-lucide-check-circle'
    })

    // Clear selection and refresh data
    table.value?.tableApi?.resetRowSelection()
    await refetchSites()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to delete sites.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    isDeleting.value = false
    deleteModalOpen.value = false
    siteIdsToDelete.value = []
  }
}

const createSortableColumn = (accessorKey: string, label: string, sortingFn?: any): TableColumn<Site> => {
  const column: TableColumn<Site> = {
    accessorKey,
    header: ({column}) => {
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

const columns: TableColumn<Site>[] = [
  {
    id: 'select',
    header: ({table}) => h(UCheckbox, {
      'modelValue': table.getIsSomePageRowsSelected() ? 'indeterminate' : table.getIsAllPageRowsSelected(),
      'onUpdate:modelValue': (value: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!value),
      'ariaLabel': 'Select all'
    }),
    cell: ({row}) => h('label', {
      class: 'block -m-3 p-3 cursor-pointer',
      // onClick: (e: Event) => e.stopPropagation()
    }, [
      h(UCheckbox, {
        'modelValue': row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
        'ariaLabel': 'Select row'
      })
    ]),
    enableSorting: false,
    enableHiding: false
  },
  createSortableColumn('siteTitle', 'Site'),
  createSortableColumn('server', 'Server', (rowA: any, rowB: any) => {
    return rowA.original.server.name.localeCompare(rowB.original.server.name)
  }),
  {
    accessorKey: 'status',
    header: 'Status',
    accessorFn: (row: Site) => row.hostingStatus,
  },
  createSortableColumn('currentCve', 'CVE', (rowA: any, rowB: any) => {
    const a = rowA.original.currentCve ?? -1
    const b = rowB.original.currentCve ?? -1
    return a - b
  }),
  createSortableColumn('lastScanAt', 'Last Scan'),
  {
    id: 'actions',
    header: '',
    size: 0,
    meta: {class: {td: 'w-2'}}
  }
]

const scanMenuItems = computed(() => {
  if (!servers.value || servers.value.length === 0) {
    return [[{label: 'No servers available', disabled: true}]]
  }

  return [
    servers.value.map(server => ({
      label: server.name,
      icon: 'i-lucide-server',
      disabled: scanStore.isServerScanning(server.id),
      onSelect: () => startScan(server.id)
    }))
  ]
})

const startScan = (serverId: string) => {
  scanStore.startScan(serverId, () => {
    void refetchSites()
  })
}

const startSiteScan = (row: Site) => {
  scanStore.startSiteScan(row.id, row.serverId, () => {
    void refetchSites()
  })
}

const formatRelativeTime = (dateStr: string) => {
  return formatDistanceToNow(new Date(dateStr), {addSuffix: true})
}

const formatFullDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const decodeEntities = (text: string) => {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = text
  return textarea.value
}

const getCveColor = (cve: number) => {
  if (cve >= 7) return 'error'
  if (cve >= 4) return 'warning'
  if (cve >= 2) return 'info'
  return 'success'
}

const getHostingStatusColor = (status: string) => {
  switch (status) {
    case 'PUBLIC': return 'success'
    case 'PRIVATE': return 'warning'
    case 'INACTIVE': return 'error'
    default: return 'neutral'
  }
}

const getHostingStatusIcon = (status: string) => {
  switch (status) {
    case 'PUBLIC': return 'lucide:globe'
    case 'PRIVATE': return 'lucide:lock'
    case 'INACTIVE': return 'lucide:wifi-off'
    default: return 'lucide:help-circle'
  }
}

const getHostingStatusLabel = (status: string) => {
  switch (status) {
    case 'PUBLIC': return 'Public'
    case 'PRIVATE': return 'Private'
    case 'INACTIVE': return 'Inactive'
    default: return 'Unknown'
  }
}


const getActionItems = (row: Site) => [
  [
    {
      label: 'View Details',
      icon: 'lucide:eye',
      to: `/sites/${row.id}`
    },
    {
      label: 'Scan now',
      icon: 'lucide:refresh-cw',
      disabled: scanStore.isServerScanning(row.serverId),
      onSelect: () => startSiteScan(row)
    },
    {
      label: 'Update WordPress',
      icon: 'lucide:circle-arrow-up',
      onSelect: () => queueWordPressUpdates([row.id])
    }
  ],
  [
    {
      label: 'Delete',
      icon: 'lucide:trash',
      color: 'error' as const,
      onSelect: () => {
        siteIdsToDelete.value = [row.id]
        deleteModalOpen.value = true
      }
    }
  ]
]

watch(() => packageJobStore.lastCompletedProgress?.updatedAt, (updatedAt, previous) => {
  if (updatedAt && updatedAt !== previous) {
    void refetchSites()
  }
})
</script>
