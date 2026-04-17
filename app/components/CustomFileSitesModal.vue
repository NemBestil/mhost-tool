<template>
  <UModal v-model:open="isOpen" :title="modalTitle" :ui="{ content: 'max-w-4xl' }">
    <template #body>
      <div class="space-y-4">
        <div v-if="props.fileIds.length > 0" class="text-sm text-neutral-500">
          Target files:
          <UBadge color="neutral" variant="outline">{{ props.fileIds.length }} selected</UBadge>
        </div>

        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-primary" />
        </div>

        <template v-else>
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <UInput
              v-model="searchQuery"
              placeholder="Search sites..."
              icon="i-lucide-search"
              class="w-64"
              :disabled="isProcessing"
            />
            <UButton
              :label="`Upload (${selectedSites.length})`"
              icon="i-lucide-upload"
              color="primary"
              :variant="selectedSites.length === 0 || isProcessing ? 'outline' : 'solid'"
              :disabled="selectedSites.length === 0 || isProcessing"
              :loading="isProcessing"
              @click="queueUpload"
            />
          </div>

          <UTable
            :data="filteredSites"
            :columns="siteColumns"
            class="h-[60vh]"
            virtualize
          >
            <template #selected-header>
              <UCheckbox
                :model-value="allSitesSelected"
                @update:model-value="toggleAllRows"
              />
            </template>

            <template #selected-cell="{ row }">
              <UIcon
                v-if="pendingInstallationIds.has(row.original.installationId)"
                name="i-lucide-loader-2"
                class="size-4 animate-spin text-primary"
              />
              <UCheckbox
                v-else
                :model-value="selectedInstallationIds.includes(row.original.installationId)"
                @update:model-value="(value) => toggleRow(row.original.installationId, Boolean(value))"
              />
            </template>

            <template #siteTitle-cell="{ row }">
              <div
                class="flex flex-col"
                :class="{ 'opacity-50 pointer-events-none': pendingInstallationIds.has(row.original.installationId) }"
              >
                <NuxtLink
                  :to="`/sites/${row.original.installationId}`"
                  class="font-medium hover:text-primary transition-colors"
                  @click="isOpen = false"
                >
                  <span v-html="row.original.siteTitle"></span>
                </NuxtLink>
                <a
                  :href="row.original.siteUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm text-neutral-500 hover:text-primary transition-colors"
                >
                  {{ row.original.siteUrl }}
                </a>
              </div>
            </template>

            <template #status-cell="{ row }">
              <div :class="{ 'opacity-50': pendingInstallationIds.has(row.original.installationId) }">
                <UBadge
                  v-if="row.original.presentCount === row.original.totalCount"
                  color="success"
                  variant="subtle"
                >
                  {{ row.original.presentCount }}/{{ row.original.totalCount }}
                </UBadge>
                <UBadge
                  v-else-if="row.original.presentCount > 0"
                  color="warning"
                  variant="subtle"
                >
                  {{ row.original.presentCount }}/{{ row.original.totalCount }}
                </UBadge>
                <UBadge
                  v-else
                  color="error"
                  variant="subtle"
                >
                  {{ row.original.presentCount }}/{{ row.original.totalCount }}
                </UBadge>
              </div>
            </template>

            <template #deployedAt-cell="{ row }">
              <div class="text-sm">
                <span v-if="row.original.deployedAt" :title="formatFullDate(row.original.deployedAt)">
                  {{ formatRelativeTime(row.original.deployedAt) }}
                </span>
                <span v-else class="text-neutral-400">Never</span>
              </div>
            </template>
          </UTable>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between">
        <div class="text-sm text-neutral-500">
          {{ selectedSites.length }} selected of {{ filteredSites.length }}
        </div>
        <UButton label="Close" @click="isOpen = false" />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { formatDistanceToNow } from 'date-fns'
import { watchThrottled } from '@vueuse/core'

type FileDetails = {
  id: string
  originalFilename: string
  relativePath: string
}

type SiteRow = {
  installationId: string
  siteTitle: string
  siteUrl: string
  serverName: string
  presentCount: number
  totalCount: number
  deployedAt: string | null
}

const props = defineProps<{
  fileIds: string[]
}>()

const isOpen = defineModel<boolean>('open', { required: true })
const toast = useToast()
const customFileJobStore = useCustomFileJobStore()

const selectedInstallationIds = ref<string[]>([])
const isProcessing = ref(false)
const searchQuery = ref('')
const pendingInstallationIds = ref<Set<string>>(new Set())

const modalTitle = computed(() => {
  if (props.fileIds.length === 0) return ''
  if (props.fileIds.length === 1 && files.value[0]) {
    return `Custom file: ${files.value[0].originalFilename}`
  }
  return `Upload ${props.fileIds.length} custom files`
})

const queryEnabled = computed(() => {
  return Boolean(isOpen.value && props.fileIds.length > 0)
})

const {
  data: sitesResponse,
  isPending,
  isFetching,
  refetch: refetchSites
} = useQuery<{ files: FileDetails[], sites: SiteRow[] }>({
  queryKey: computed(() => ['custom-file-sites', props.fileIds]),
  queryFn: () => useApiClient()('/custom-files/sites-status', {
    method: 'POST',
    body: { fileIds: props.fileIds }
  }),
  enabled: queryEnabled,
  placeholderData: keepPreviousData
})

const sites = computed(() => sitesResponse.value?.sites || [])
const files = computed(() => sitesResponse.value?.files || [])
const isLoading = computed(() => isPending.value && !sitesResponse.value)
const filteredSites = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return sites.value

  return sites.value.filter(site => (
    site.siteTitle.toLowerCase().includes(query)
    || site.siteUrl.toLowerCase().includes(query)
  ))
})
const selectedSites = computed(() => {
  const selected = new Set(selectedInstallationIds.value)
  return filteredSites.value.filter(site => selected.has(site.installationId))
})
const selectableSites = computed(() => {
  return filteredSites.value.filter(site => !pendingInstallationIds.value.has(site.installationId))
})
const allSitesSelected = computed(() => {
  return selectableSites.value.length > 0 && selectableSites.value.every(site => selectedInstallationIds.value.includes(site.installationId))
})

const siteColumns: TableColumn<SiteRow>[] = [
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
    accessorKey: 'serverName',
    header: 'Server'
  },
  {
    id: 'status',
    header: 'Status'
  },
  {
    id: 'deployedAt',
    header: 'Last uploaded'
  }
]

const queueUpload = async () => {
  if (props.fileIds.length === 0 || selectedSites.value.length === 0) return

  const selected = [...selectedSites.value]

  isProcessing.value = true
  pendingInstallationIds.value = new Set([
    ...pendingInstallationIds.value,
    ...selected.map(site => site.installationId)
  ])

  try {
    const jobs = []
    for (const site of selected) {
      for (const fileId of props.fileIds) {
        jobs.push({
          installationId: site.installationId,
          customFileId: fileId
        })
      }
    }

    await useApiClient()('/custom-files/jobs', {
      method: 'POST',
      body: {
        jobs
      }
    })

    toast.add({
      title: 'Uploads queued',
      description: `${jobs.length} upload job(s) added to the queue.`,
      color: 'success'
    })

    selectedInstallationIds.value = []
    customFileJobStore.refreshStatus()
  } catch (error: any) {
    for (const site of selected) {
      pendingInstallationIds.value.delete(site.installationId)
    }

    toast.add({
      title: 'Failed to queue uploads',
      description: error?.data?.message || error?.message || 'Unknown error',
      color: 'error'
    })
  } finally {
    isProcessing.value = false
  }
}

const toggleAllRows = (value: boolean | 'indeterminate') => {
  if (value === true) {
    selectedInstallationIds.value = selectableSites.value.map(site => site.installationId)
    return
  }

  selectedInstallationIds.value = []
}

const toggleRow = (installationId: string, checked: boolean) => {
  if (pendingInstallationIds.value.has(installationId)) {
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

const reconcilePending = () => {
  if (pendingInstallationIds.value.size === 0) return

  const next = new Set(pendingInstallationIds.value)
  for (const site of sites.value) {
    if (site.presentCount === site.totalCount) {
      next.delete(site.installationId)
    }
  }
  pendingInstallationIds.value = next
}

const formatRelativeTime = (dateStr: string) => {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
}

const formatFullDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString()
}

watch(() => props.fileIds, (ids) => {
  selectedInstallationIds.value = []
  searchQuery.value = ''
  pendingInstallationIds.value = new Set()

  if (isOpen.value && ids.length > 0 && !isFetching.value) {
    refetchSites()
  }
}, { immediate: true })

watchThrottled(() => customFileJobStore.lastCompletedProgress?.updatedAt, (updatedAt, previous) => {
  if (isOpen.value && updatedAt && updatedAt !== previous) {
    refetchSites()
  }
}, { throttle: 5000 })

watch(() => sitesResponse.value?.sites, () => {
  reconcilePending()
})
</script>
