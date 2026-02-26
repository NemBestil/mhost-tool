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
    </div>

    <UTable
        ref="table"
        sticky
        v-model:sorting="sorting"
        :data="filteredSites"
        :columns="columns"
        :loading="status === 'pending'"
        :get-row-id="(row) => row.id"
        class="table-auto flex-1"
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

      <!-- CVE Column -->
      <template #currentCve-cell="{ row }">
        <UBadge
            v-if="row.original.currentCve !== null"
            :color="getCveColor(row.original.currentCve)"
            variant="subtle"
        >
          {{ row.original.currentCve.toFixed(1) }}
        </UBadge>
        <span v-else class="text-sm text-neutral-400">Unknown</span>
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
    <UModal v-model:open="deleteModalOpen" title="Delete Selected Sites">
      <template #body>
        <p class="text-sm text-muted">
          Are you sure you want to delete <strong>{{ selectedCount }}</strong> site(s) from MHost?
        </p>
        <p class="text-sm text-muted mt-2">
          The actual WordPress sites will remain untouched on your servers. Only the records in MHost will be removed.
        </p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
              color="neutral"
              variant="outline"
              label="Cancel"
              @click="deleteModalOpen = false"
          />
          <UButton
              color="error"
              label="Delete"
              :loading="isDeleting"
              @click="confirmDelete"
          />
        </div>
      </template>
    </UModal>
  </NuxtLayout>
</template>

<script lang="ts" setup>
import {h, resolveComponent} from 'vue'
import {UButton} from '#components'
import type {TableColumn} from '@nuxt/ui'
import {formatDistanceToNow} from 'date-fns'
import {useQuery} from '@tanstack/vue-query'
import type {TypedInternalResponse} from 'nitropack'

const UCheckbox = resolveComponent('UCheckbox')

definePageMeta({
  title: 'WordPress Sites'
})

const scanStore = useScanStore()
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

const table = useTemplateRef('table')
const search = ref('')
const sorting = ref([{id: 'siteTitle', desc: false}])

const selectedServer = ref<{ label: string, value: string } | null>(null)
const serverOptions = computed(() => {
  const options = []
  if (servers.value) {
    options.push(...servers.value.map(s => ({label: s.name, value: s.id})))
  }
  return options
})

const filteredSites = computed(() => {
  let result = sites.value || []

  if (selectedServer.value) {
    result = result.filter(s => s.serverId === selectedServer.value!.value)
  }

  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(s =>
        s.siteTitle.toLowerCase().includes(q) ||
        s.siteUrl.toLowerCase().includes(q)
    )
  }

  return result
})

type Site = NonNullable<typeof sites.value>[number]

// Selection state
const selectedCount = computed(() => {
  return table.value?.tableApi?.getFilteredSelectedRowModel().rows.length || 0
})

const getSelectedSiteIds = () => {
  const selectedRows = table.value?.tableApi?.getFilteredSelectedRowModel().rows || []
  return selectedRows.map((row: any) => row.original.id)
}

// Delete modal state
const deleteModalOpen = ref(false)
const isDeleting = ref(false)

// Batch action items
const batchActionItems = computed(() => [
  [
    {
      label: 'Delete',
      icon: 'lucide:trash',
      color: 'error' as const,
      onSelect: () => {
        deleteModalOpen.value = true
      }
    }
  ]
])

const confirmDelete = async () => {
  const siteIds = getSelectedSiteIds()
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
  }
}

const createSortableColumn = (accessorKey: string, label: string, sortingFn?: any) => {
  const column: any = {
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
  createSortableColumn('currentCve', 'CVE'),
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
  return 'success'
}


const getActionItems = (row: Site) => [
  [
    {
      label: 'View Details',
      icon: 'lucide:eye',
      to: `/sites/${row.id}`
    }
  ],
  [
    {
      label: 'Delete',
      icon: 'lucide:trash',
      color: 'error' as const,
      onSelect: () => {
        // TODO: Implement delete
      }
    }
  ]
]
</script>
