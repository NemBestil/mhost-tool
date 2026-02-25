<template>
  <UModal v-model:open="isOpen" :title="modalTitle" :ui="{ content: 'max-w-4xl' }">
    <template #body>
      <div class="space-y-4">
        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-primary" />
        </div>

        <template v-else>
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div class="text-sm text-neutral-500">
              Latest version:
              <UBadge color="primary" variant="outline" v-if="latestVersion" >{{ latestVersion }}</UBadge>
              <UBadge color="warning" v-else>Not available</UBadge>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <UButton
                :label="`Update (${selectedOutdatedSites.length})`"
                icon="i-lucide-arrow-up-circle"
                color="warning"
                :variant="selectedOutdatedSites.length === 0 || isProcessing ? 'outline' : 'solid'"
                :disabled="selectedOutdatedSites.length === 0 || isProcessing"
                :loading="isProcessing && currentAction === 'update'"
                @click="updateSelectedOutdatedSites"
              />
              <UButton
                icon="i-lucide-play"
                color="success"
                :variant="selectedInactiveSites.length === 0 || isProcessing ? 'outline' : 'solid'"
                :label="`Activate (${selectedInactiveSites.length})`"
                :disabled="selectedInactiveSites.length === 0 || isProcessing"
                :loading="isProcessing && currentAction === 'activate'"
                @click="activateSelectedSites"
              />
              <UButton
                :label="`Deactivate (${selectedActiveSites.length})`"
                icon="i-lucide-power"
                color="neutral"
                :variant="selectedActiveSites.length === 0 || isProcessing ? 'outline' : 'solid'"
                :disabled="selectedActiveSites.length === 0 || isProcessing"
                :loading="isProcessing && currentAction === 'deactivate'"
                @click="deactivateSelectedSites"
              />
              <UButton
                :label="`Delete (${selectedDeletableSites.length})`"
                icon="i-lucide-trash"
                color="error"
                :variant="selectedDeletableSites.length === 0 || isProcessing ? 'outline' : 'solid'"
                :disabled="selectedDeletableSites.length === 0 || isProcessing"
                :loading="isProcessing && currentAction === 'delete'"
                @click="deleteSelectedSites"
              />
            </div>
          </div>

          <UTable
            :data="sites"
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
              <UIcon
                v-if="isRowPending(row.original.installationId)"
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
                :class="{ 'opacity-50 pointer-events-none': isRowPending(row.original.installationId) }"
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

            <template #version-cell="{ row }">
              <div
                class="flex items-center justify-between gap-2 w-full text-sm"
                :class="{ 'opacity-50 pointer-events-none': isRowPending(row.original.installationId) }"
              >
                <div class="flex items-center gap-1.5 min-w-0">
                  <span>{{ row.original.version }}</span>
                  <template v-if="latestVersion && latestVersion !== row.original.version">
                    <UIcon name="i-lucide-arrow-right" class="size-3.5 text-warning" />
                    <span class="text-warning font-medium">{{ latestVersion }}</span>
                  </template>
                  <UIcon
                    v-else-if="latestVersion && latestVersion === row.original.version"
                    name="i-lucide-check-circle"
                    class="size-3.5 text-primary"
                  />
                </div>
                <UButton
                  v-if="latestVersion && latestVersion !== row.original.version"
                  icon="i-lucide-arrow-up-circle"
                  color="warning"
                  variant="ghost"
                  size="xl"
                  :disabled="isProcessing || isRowPending(row.original.installationId)"
                  @click="queueUpdateForSite(row.original)"
                />
              </div>
            </template>

            <template #state-cell="{ row }">
              <div :class="{ 'opacity-50': isRowPending(row.original.installationId) }">
                <UBadge
                  :color="row.original.isActive ? 'success' : 'neutral'"
                  variant="subtle"
                  size="sm"
                >
                  {{ row.original.isActive ? 'Active' : 'Inactive' }}
                </UBadge>
              </div>
            </template>
          </UTable>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between">
        <div class="text-sm text-neutral-500">
          {{ selectedSites.length }} selected of {{ sites.length }}
        </div>
        <UButton label="Close" @click="isOpen = false" />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import {watchThrottled} from "@vueuse/core";

type PackageKind = 'installed-plugins' | 'installed-themes'
type PackageAction = 'activate' | 'deactivate' | 'delete'
type PendingOperation = 'update' | PackageAction

type SiteWithVersion = {
  installationId: string
  siteTitle: string
  siteUrl: string
  version: string
  isActive: boolean
  isUpToDate: boolean
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
const currentAction = ref<'update' | PackageAction | null>(null)
const pendingOperations = ref<Record<string, PendingOperation>>({})

const modalTitle = computed(() => {
  if (!props.packageDetails) return ''
  const typeLabel = props.packageDetails.kind === 'installed-plugins' ? 'Plugin' : 'Theme'
  return `${typeLabel}: ${props.packageDetails.title || props.packageDetails.slug}`
})

const packageKind = computed(() => {
  return props.packageDetails?.kind === 'installed-plugins' ? 'plugin' : 'theme'
})

const queryEnabled = computed(() => {
  return Boolean(isOpen.value && props.packageDetails?.slug)
})

const sitesQueryKey = computed(() => {
  return ['package-sites', props.packageDetails?.kind || null, props.packageDetails?.slug || null]
})

const {
  data: sitesResponse,
  isPending,
  isFetching,
  refetch: refetchSites
} = useQuery<{ sites: SiteWithVersion[], latestVersion: string | null }>({
  queryKey: sitesQueryKey,
  queryFn: () => $fetch(`/api/packages/${props.packageDetails!.kind}/${encodeURIComponent(props.packageDetails!.slug)}/sites`),
  enabled: queryEnabled,
  placeholderData: keepPreviousData
})

const sites = computed(() => sitesResponse.value?.sites || [])
const latestVersion = computed(() => sitesResponse.value?.latestVersion || null)
const isLoading = computed(() => isPending.value && !sitesResponse.value)

const pendingInstallationIds = computed(() => new Set(Object.keys(pendingOperations.value)))
const selectableSites = computed(() => {
  return sites.value.filter(site => !pendingInstallationIds.value.has(site.installationId))
})
const selectedSites = computed(() => {
  const selected = new Set(selectedInstallationIds.value)
  return sites.value.filter(site => selected.has(site.installationId))
})
const selectedOutdatedSites = computed(() => selectedSites.value.filter(site => !site.isUpToDate))
const selectedInactiveSites = computed(() => selectedSites.value.filter(site => !site.isActive))
const selectedActiveSites = computed(() => selectedSites.value.filter(site => site.isActive))
const selectedDeletableSites = computed(() => selectedSites.value)

const allSitesSelected = computed(() => {
  return selectableSites.value.length > 0 && selectedInstallationIds.value.length === selectableSites.value.length
})

const siteColumns: TableColumn<SiteWithVersion>[] = [
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
    accessorKey: 'version',
    header: 'Version'
  },
  {
    id: 'state',
    header: 'State'
  }
]

const queueUpdateForSite = async (site: SiteWithVersion) => {
  await queueUpdates([site])
}

const updateSelectedOutdatedSites = async () => {
  await queueUpdates(selectedOutdatedSites.value)
}

const queueUpdates = async (targetSites: SiteWithVersion[]) => {
  if (!props.packageDetails || targetSites.length === 0) return

  const targetIds = targetSites.map(site => site.installationId)
  markRowsPending(targetIds, 'update')

  isProcessing.value = true
  currentAction.value = 'update'
  try {
    await $fetch('/api/packages/jobs', {
      method: 'POST',
      body: {
        jobs: targetSites.map(site => ({
          installationId: site.installationId,
          kind: packageKind.value,
          slug: props.packageDetails!.slug,
          operation: 'update'
        }))
      }
    })

    toast.add({
      title: 'Updates queued',
      description: `${targetSites.length} update job(s) added to the queue.`,
      color: 'success'
    })
    packageJobStore.refreshStatus()
  } catch (error: any) {
    toast.add({
      title: 'Failed to queue updates',
      description: error?.data?.message || error?.message || 'Unknown error',
      color: 'error'
    })
    clearPendingForRows(targetIds)
  } finally {
    isProcessing.value = false
    currentAction.value = null
  }
}

const activateSelectedSites = async () => {
  await runBatchAction('activate', selectedInactiveSites.value)
}

const deactivateSelectedSites = async () => {
  await runBatchAction('deactivate', selectedActiveSites.value)
}

const deleteSelectedSites = async () => {
  await runBatchAction('delete', selectedDeletableSites.value)
}

const runBatchAction = async (operation: PackageAction, targetSites: SiteWithVersion[]) => {
  if (!props.packageDetails || targetSites.length === 0) return

  const actionLabel = operation === 'delete' ? 'delete' : operation === 'deactivate' ? 'deactivate' : 'activate'
  const warningText = operation === 'delete'
    ? `Delete ${targetSites.length} item(s) on selected sites? Active items will be deactivated first.`
    : operation === 'deactivate'
      ? `Deactivate ${targetSites.length} item(s) on selected sites?`
      : ''

  if (warningText && !window.confirm(warningText)) {
    return
  }

  const targetIds = targetSites.map(site => site.installationId)
  markRowsPending(targetIds, operation)

  isProcessing.value = true
  currentAction.value = operation
  try {
    const response = await $fetch<{
      success: number
      failed: number
      skipped: number
    }>('/api/packages/actions', {
      method: 'POST',
      body: {
        actions: targetSites.map(site => ({
          installationId: site.installationId,
          kind: packageKind.value,
          slug: props.packageDetails!.slug,
          operation
        }))
      }
    })

    toast.add({
      title: `${capitalize(actionLabel)} completed`,
      description: `${response.success} success, ${response.failed} failed, ${response.skipped} skipped.`,
      color: response.failed > 0 ? 'warning' : 'success'
    })

    await refetchSites()
  } catch (error: any) {
    toast.add({
      title: `Failed to ${actionLabel}`,
      description: error?.data?.message || error?.message || 'Unknown error',
      color: 'error'
    })
    clearPendingForRows(targetIds)
  } finally {
    isProcessing.value = false
    currentAction.value = null
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
  if (isRowPending(installationId)) {
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

watch(() => props.packageDetails, (details) => {
  selectedInstallationIds.value = []
  pendingOperations.value = {}

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
  reconcilePendingOperations()
  selectedInstallationIds.value = []
})

const isRowPending = (installationId: string): boolean => {
  return Boolean(pendingOperations.value[installationId])
}

const markRowsPending = (installationIds: string[], operation: PendingOperation) => {
  const next = { ...pendingOperations.value }
  const selectedSet = new Set(selectedInstallationIds.value)

  for (const installationId of installationIds) {
    next[installationId] = operation
    selectedSet.delete(installationId)
  }

  pendingOperations.value = next
  selectedInstallationIds.value = Array.from(selectedSet)
}

const clearPendingForRows = (installationIds: string[]) => {
  if (installationIds.length === 0) return

  const next = { ...pendingOperations.value }
  for (const installationId of installationIds) {
    delete next[installationId]
  }
  pendingOperations.value = next
}

const reconcilePendingOperations = () => {
  if (Object.keys(pendingOperations.value).length === 0) return

  const currentById = new Map(sites.value.map(site => [site.installationId, site]))
  const next = { ...pendingOperations.value }

  for (const [installationId, operation] of Object.entries(pendingOperations.value)) {
    const site = currentById.get(installationId)

    if (!site) {
      delete next[installationId]
      continue
    }

    if (operation === 'update' && site.isUpToDate) {
      delete next[installationId]
      continue
    }

    if (operation === 'activate' && site.isActive) {
      delete next[installationId]
      continue
    }

    if (operation === 'deactivate' && !site.isActive) {
      delete next[installationId]
      continue
    }
  }

  pendingOperations.value = next
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
</script>
