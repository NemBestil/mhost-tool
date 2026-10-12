<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getWorldlineDayStatus, type WorldlineSite } from '../../../shared/utils/siteHealth'
import { useQuery } from '@tanstack/vue-query'

definePageMeta({ title: 'Worldline' })
type SiteList = WorldlineSite[]
type Site = SiteList[number]
const { data: sites, status, error, refetch } = useQuery<SiteList>({
  queryKey: ['worldline-sites'],
  queryFn: () => useApiClient()('/worldline/list')
})
const scanStore = useScanStore()
const search = ref('')
type StatusFilter = 'ALL' | 'OK' | 'No orders' | 'Fail'
const selectedStatus = ref<StatusFilter>('ALL')
const statusOptions: { label: string, value: StatusFilter }[] = [
  { label: 'All statuses', value: 'ALL' },
  { label: 'OK', value: 'OK' },
  { label: 'No orders', value: 'No orders' },
  { label: 'Fail', value: 'Fail' }
]

function decodeSiteTitle(title: string): string {
  const decoder = document.createElement('textarea')
  // Decode entity tokens as text, preserving literal markup in site names.
  return title.replace(/&(?:#\d+|#x[\da-f]+|[a-z][\da-z]+);/gi, entity => {
    decoder.innerHTML = entity
    return decoder.value
  })
}

const displaySites = computed(() => (sites.value ?? []).map(site => ({
  ...site,
  siteTitle: decodeSiteTitle(site.siteTitle)
})))
const filteredSites = computed(() => displaySites.value.filter(site =>
  `${site.siteTitle} ${site.siteUrl} ${site.server.name}`.toLowerCase().includes(search.value.toLowerCase())
  && (selectedStatus.value === 'ALL' || getWorldlineDayStatus(site.worldlineStats?.days.find(day => day.daysAgo === 1)) === selectedStatus.value)
))
const days = [1, 2, 3, 4, 5, 6, 7]
async function refreshSites() { await refetch() }
const columns: TableColumn<Site>[] = [
  { accessorKey: 'siteTitle', header: 'Site' },
  { id: 'server', header: 'Server' },
  ...days.map(day => ({ id: `day${day}`, header: day === 1 ? '1 day' : `${day} days` })),
  { id: 'actions', header: '' }
]
watch(() => scanStore.isScanning, (scanning, previous) => {
  if (!scanning && previous) void refetch()
})
</script>

<template>
  <NuxtLayout name="dashboard-page">
    <div class="p-4 space-y-4">
      <p class="text-sm text-muted">
        OK means at least one capture was found in up to five sampled orders. Fail means no capture was confirmed.
        A dash means there are no Worldline orders. A question mark means no scan result is available or nb-core is missing or inactive.
        Dates follow each site's timezone and exclude today.
        Recheck retries dates without a confirmed capture; OK days stay cached.
      </p>
      <div class="flex flex-wrap gap-3 items-center">
        <UInput v-model="search" icon="i-lucide-search" placeholder="Search sites or servers..." class="w-full sm:max-w-sm" />
        <USelect
          v-model="selectedStatus"
          :items="statusOptions"
          aria-label="Status"
          title="Status for 1 day from the latest scan"
          icon="i-lucide-filter"
          class="w-full sm:w-48"
        />
        <UButton label="Refresh" icon="i-lucide-refresh-cw" color="neutral" variant="outline" :loading="status === 'pending'" @click="refreshSites" />
      </div>
      <UAlert v-if="error" color="error" title="Could not load Worldline sites" :description="error.message" />
    </div>
    <UTable :data="filteredSites" :columns="columns" :column-pinning="{ right: ['actions'] }" :loading="status === 'pending'" class="flex-1" :ui="{ th: 'whitespace-nowrap', td: 'whitespace-nowrap' }">
      <template #siteTitle-cell="{ row }">
        <div class="flex w-44 flex-col gap-1">
          <NuxtLink :to="`/sites/${row.original.id}`" :title="row.original.siteTitle" class="truncate font-medium text-primary">{{ row.original.siteTitle }}</NuxtLink>
          <a :href="row.original.siteUrl" :title="row.original.siteUrl" target="_blank" rel="noopener noreferrer" class="truncate text-sm text-muted">{{ row.original.siteUrl }}</a>
        </div>
      </template>
      <template #server-cell="{ row }">
        <span :title="row.original.server.name" class="block max-w-32 truncate text-sm">{{ row.original.server.name }}</span>
      </template>
      <template v-for="day in days" :key="day" #[`day${day}-cell`]="{ row }">
        <WorldlineDayBadge :day="row.original.worldlineStats?.days.find(item => item.daysAgo === day)" :error="row.original.worldlineScanError" />
      </template>
      <template #actions-cell="{ row }">
        <UButton
          label="Gentjek"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="outline"
          :disabled="!row.original.nbCoreAvailable || !row.original.plugin?.isEnabled || scanStore.isServerScanning(row.original.serverId)"
          @click="scanStore.startWorldlineRecheck(row.original.id, row.original.serverId, () => refetch())"
        />
      </template>
      <template #empty>{{ sites?.length ? 'No sites match the selected filters.' : 'No sites with the Worldline plugin found. Scan your servers to update the list.' }}</template>
    </UTable>
  </NuxtLayout>
</template>
