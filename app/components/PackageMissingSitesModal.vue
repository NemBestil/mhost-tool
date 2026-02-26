<template>
  <UModal v-model:open="isOpen" :title="modalTitle" :ui="{ content: 'max-w-4xl' }">
    <template #body>
      <div class="space-y-4">
        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-primary" />
        </div>

        <template v-else>
          <UAlert
            v-if="sites.length === 0"
            color="success"
            variant="soft"
            title="Nothing to do"
            description="All sites already have this package."
          />

          <template v-else>
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <UInput
                v-model="searchQuery"
                placeholder="Search sites..."
                icon="i-lucide-search"
                class="w-64"
                :disabled="isProcessing"
              />
              <div class="flex items-center gap-2">
                <UButton
                  :label="`Install (${selectedSites.length})`"
                  icon="i-lucide-download"
                  color="primary"
                  :variant="selectedSites.length === 0 || isProcessing ? 'outline' : 'solid'"
                  :disabled="selectedSites.length === 0 || isProcessing"
                  :loading="isProcessing && currentAction === 'install'"
                  @click="queueInstall(false)"
                />
                <UButton
                  :label="`Install & Activate (${selectedSites.length})`"
                  icon="i-lucide-zap"
                  color="success"
                  :variant="selectedSites.length === 0 || isProcessing ? 'outline' : 'solid'"
                  :disabled="selectedSites.length === 0 || isProcessing"
                  :loading="isProcessing && currentAction === 'install-activate'"
                  @click="queueInstall(true)"
                />
              </div>
            </div>

            <UTable
              :data="filteredSites"
              :columns="siteColumns"
              class="max-h-[60vh]"
              sticky
            >
              <template #selected-header>
                <UCheckbox
                  :model-value="allSitesSelected"
                  @update:model-value="toggleAllRows"
                />
              </template>

              <template #selected-cell="{ row }">
                <UCheckbox
                  :model-value="selectedInstallationIds.includes(row.original.installationId)"
                  @update:model-value="(value) => toggleRow(row.original.installationId, Boolean(value))"
                />
              </template>

              <template #siteTitle-cell="{ row }">
                <div class="flex flex-col">
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
            </UTable>
          </template>
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
import { watchThrottled } from '@vueuse/core'

type PackageKind = 'plugins' | 'themes'
type QueueOperation = 'install' | 'install-activate'

type MissingSite = {
  installationId: string
  siteTitle: string
  siteUrl: string
  serverName: string
}

type PackageDetails = {
  kind: PackageKind
  slug: string
  title: string | null
}

const props = defineProps<{
  packageDetails: PackageDetails | null
}>()

const isOpen = defineModel<boolean>('open', { required: true })
const toast = useToast()
const packageJobStore = usePackageJobStore()

const selectedInstallationIds = ref<string[]>([])
const isProcessing = ref(false)
const currentAction = ref<QueueOperation | null>(null)
const searchQuery = ref('')

const modalTitle = computed(() => {
  if (!props.packageDetails) return ''
  const typeLabel = props.packageDetails.kind === 'plugins' ? 'Plugin' : 'Theme'
  return `Sites Without ${typeLabel}: ${props.packageDetails.title || props.packageDetails.slug}`
})

const packageKind = computed(() => {
  return props.packageDetails?.kind === 'plugins' ? 'plugin' : 'theme'
})

const queryEnabled = computed(() => {
  return Boolean(isOpen.value && props.packageDetails?.slug)
})

const sitesQueryKey = computed(() => {
  return ['package-missing-sites', props.packageDetails?.kind || null, props.packageDetails?.slug || null]
})

const {
  data: sitesResponse,
  isPending,
  isFetching,
  refetch: refetchSites
} = useQuery<{ sites: MissingSite[] }>({
  queryKey: sitesQueryKey,
  queryFn: () => useApiClient()(`/packages/missing-${props.packageDetails!.kind}/${encodeURIComponent(props.packageDetails!.slug)}/sites`),
  enabled: queryEnabled,
  placeholderData: keepPreviousData
})

const sites = computed(() => sitesResponse.value?.sites || [])
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

const allSitesSelected = computed(() => {
  return filteredSites.value.length > 0 && selectedSites.value.length === filteredSites.value.length
})

const siteColumns: TableColumn<MissingSite>[] = [
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
  }
]

const queueInstall = async (activateAfterInstall: boolean) => {
  if (!props.packageDetails || selectedSites.value.length === 0) return

  const operation: QueueOperation = activateAfterInstall ? 'install-activate' : 'install'
  const selected = [...selectedSites.value]

  isProcessing.value = true
  currentAction.value = operation
  try {
    await useApiClient()('/packages/jobs', {
      method: 'POST',
      body: {
        jobs: selected.map(site => ({
          installationId: site.installationId,
          kind: packageKind.value,
          slug: props.packageDetails!.slug,
          operation,
          source: 'external'
        }))
      }
    })

    toast.add({
      title: 'Install queued',
      description: `${selected.length} install job(s) added to the queue.`,
      color: 'success'
    })

    selectedInstallationIds.value = []
    packageJobStore.refreshStatus()
  } catch (error: any) {
    toast.add({
      title: 'Failed to queue install',
      description: error?.data?.message || error?.message || 'Unknown error',
      color: 'error'
    })
  } finally {
    isProcessing.value = false
    currentAction.value = null
  }
}

const toggleAllRows = (value: boolean | 'indeterminate') => {
  if (value === true) {
    selectedInstallationIds.value = filteredSites.value.map(site => site.installationId)
    return
  }
  selectedInstallationIds.value = []
}

const toggleRow = (installationId: string, checked: boolean) => {
  if (checked) {
    if (!selectedInstallationIds.value.includes(installationId)) {
      selectedInstallationIds.value.push(installationId)
    }
    return
  }

  selectedInstallationIds.value = selectedInstallationIds.value.filter(id => id !== installationId)
}

watch(() => props.packageDetails, (details) => {
  selectedInstallationIds.value = []
  searchQuery.value = ''

  if (isOpen.value && details && !isFetching.value) {
    refetchSites()
  }
}, { immediate: true })

watchThrottled(() => packageJobStore.lastCompletedProgress?.updatedAt, (updatedAt, previous) => {
  if (isOpen.value && updatedAt && updatedAt !== previous) {
    refetchSites()
  }
}, { throttle: 5000 })

watch(() => sitesResponse.value?.sites, () => {
  selectedInstallationIds.value = []
  searchQuery.value = ''
})
</script>
