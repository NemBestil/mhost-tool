<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { WorldlineSite } from '../../../shared/utils/siteHealth'
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
const filteredSites = computed(() => (sites.value ?? []).filter(site =>
  `${site.siteTitle} ${site.siteUrl} ${site.server.name}`.toLowerCase().includes(search.value.toLowerCase())
))
const days = [1, 2, 3, 4, 5, 6, 7]
async function refreshSites() { await refetch() }
const columns: TableColumn<Site>[] = [
  { accessorKey: 'siteTitle', header: 'Site' },
  { id: 'plugin', header: 'Plugin' },
  ...days.map(day => ({ id: `day${day}`, header: day === 1 ? 'Yesterday' : `${day} days ago` })),
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
        A dash means there are no Worldline orders. Dates follow each site's timezone and exclude today.
        Recheck retries dates without a confirmed capture; OK days stay cached.
      </p>
      <div class="flex flex-wrap gap-3 items-center">
        <UInput v-model="search" icon="i-lucide-search" placeholder="Search sites or servers..." class="w-full sm:max-w-sm" />
        <UButton label="Refresh" icon="i-lucide-refresh-cw" color="neutral" variant="outline" :loading="status === 'pending'" @click="refreshSites" />
      </div>
      <UAlert v-if="error" color="error" title="Could not load Worldline sites" :description="error.message" />
    </div>
    <UTable :data="filteredSites" :columns="columns" :column-pinning="{ right: ['actions'] }" :loading="status === 'pending'" class="flex-1" :ui="{ th: 'whitespace-nowrap', td: 'whitespace-nowrap' }">
      <template #siteTitle-cell="{ row }">
        <div class="flex flex-col gap-1">
          <NuxtLink :to="`/sites/${row.original.id}`" class="font-medium text-primary">{{ row.original.siteTitle }}</NuxtLink>
          <a :href="row.original.siteUrl" target="_blank" rel="noopener noreferrer" class="text-sm text-muted">{{ row.original.siteUrl }}</a>
          <span class="text-sm text-muted">{{ row.original.server.name }}</span>
        </div>
      </template>
      <template #plugin-cell="{ row }">
        <UBadge :color="row.original.plugin?.isEnabled ? 'success' : 'neutral'" variant="subtle">
          {{ row.original.plugin?.version }} · {{ row.original.plugin?.isEnabled ? 'Active' : 'Inactive' }}
        </UBadge>
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
          :disabled="!row.original.plugin?.isEnabled || scanStore.isServerScanning(row.original.serverId)"
          @click="scanStore.startWorldlineRecheck(row.original.id, row.original.serverId, () => refetch())"
        />
      </template>
      <template #empty>No sites with the Worldline plugin found. Scan your servers to update the list.</template>
    </UTable>
  </NuxtLayout>
</template>
