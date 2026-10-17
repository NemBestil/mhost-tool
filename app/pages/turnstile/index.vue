<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useQuery } from '@tanstack/vue-query'
import {
  getTurnstileCheckColor,
  getTurnstileCheckCount,
  isTurnstileConfigured,
  turnstileChecks,
  type TurnstileSite
} from '../../../shared/utils/turnstile'

definePageMeta({ title: 'Turnstile' })

const { data: sites, status, error, refetch, isFetching } = useQuery<TurnstileSite[]>({
  queryKey: ['turnstile-sites'],
  queryFn: () => useApiClient()('/turnstile/list')
})
const scanStore = useScanStore()
const search = ref('')
const filteredSites = computed(() => (sites.value ?? []).filter(site =>
  `${site.siteTitle} ${site.siteUrl} ${site.server.name}`.toLowerCase().includes(search.value.trim().toLowerCase())
))
const columns: TableColumn<TurnstileSite>[] = [
  { accessorKey: 'siteUrl', header: 'Domain' },
  { id: 'server', header: 'Server' },
  { id: 'installed', header: 'Plugin installed' },
  { id: 'active', header: 'Plugin active' },
  { id: 'configuration', header: 'Keys & validation' },
  { id: 'checks', header: 'Important settings' },
  { id: 'checkedAt', header: 'Last checked' },
  { id: 'actions', header: '' }
]
const configurationChecks = [
  { key: 'hasSiteKey', label: 'Site key' },
  { key: 'hasSecretKey', label: 'Secret key' },
  { key: 'tested', label: 'Validation passed' }
] as const

function domain(url: string): string {
  try { return new URL(url).host } catch { return url }
}

async function refreshSites() { await refetch() }

watch(() => scanStore.isScanning, (scanning, previous) => {
  if (!scanning && previous) void refetch()
})
</script>

<template>
  <NuxtLayout name="dashboard-page">
    <div class="p-4 space-y-4">
      <p class="text-sm text-muted">
        Simple Cloudflare Turnstile status for all sites, from the latest site or server scan.
        Validation follows the plugin's saved test result. Tap a status or counter for details.
        All five settings count, including WooCommerce and Contact Form 7 settings on sites without those plugins.
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <UInput v-model="search" icon="i-lucide-search" placeholder="Search domains or servers..." aria-label="Search domains or servers" size="lg" class="w-full sm:max-w-sm" />
        <UButton label="Refresh list" icon="i-lucide-refresh-cw" color="neutral" variant="outline" size="lg" :loading="isFetching" @click="refreshSites" />
      </div>
      <UAlert v-if="error" color="error" title="Could not load Turnstile sites" :description="error.message" />
    </div>

    <UTable :data="filteredSites" :columns="columns" :loading="status === 'pending'" class="flex-1" :ui="{ th: 'whitespace-nowrap', td: 'whitespace-nowrap' }">
      <template #siteUrl-cell="{ row }">
        <div class="flex w-52 flex-col gap-1">
          <NuxtLink :to="`/sites/${row.original.id}`" :title="row.original.siteUrl" class="truncate font-medium text-primary">{{ domain(row.original.siteUrl) }}</NuxtLink>
          <a :href="row.original.siteUrl" target="_blank" rel="noopener noreferrer" class="truncate text-sm text-muted">{{ row.original.siteUrl }}</a>
        </div>
      </template>
      <template #server-cell="{ row }">
        <span :title="row.original.server.name" class="block max-w-32 truncate text-sm">{{ row.original.server.name }}</span>
      </template>
      <template #installed-cell="{ row }">
        <UBadge :color="!row.original.turnstileStats ? 'neutral' : row.original.turnstileStats.pluginInstalled ? 'success' : 'error'" variant="subtle" size="lg">
          {{ !row.original.turnstileStats ? 'Unknown' : row.original.turnstileStats.pluginInstalled ? 'Yes' : 'No' }}
        </UBadge>
      </template>
      <template #active-cell="{ row }">
        <UBadge :color="!row.original.turnstileStats ? 'neutral' : row.original.turnstileStats.pluginIsActive ? 'success' : 'error'" variant="subtle" size="lg">
          {{ !row.original.turnstileStats ? 'Unknown' : row.original.turnstileStats.pluginIsActive ? 'Yes' : 'No' }}
        </UBadge>
      </template>
      <template #configuration-cell="{ row }">
        <UPopover v-if="row.original.turnstileStats">
          <UButton :color="isTurnstileConfigured(row.original.turnstileStats) ? 'success' : 'error'" variant="subtle" size="lg" :aria-label="`Show key and validation status for ${domain(row.original.siteUrl)}`">
            {{ isTurnstileConfigured(row.original.turnstileStats) ? 'OK' : 'Incomplete' }}
            <Icon name="lucide:info" class="size-4" />
          </UButton>
          <template #content>
            <div class="p-4 space-y-3 max-w-80">
              <p class="font-medium">Keys & validation</p>
              <div v-for="check in configurationChecks" :key="check.key" class="flex items-center justify-between gap-4 text-sm">
                <span>{{ check.label }}</span>
                <UBadge :color="row.original.turnstileStats[check.key] ? 'success' : 'error'" variant="subtle" size="lg">{{ row.original.turnstileStats[check.key] ? 'Yes' : 'No' }}</UBadge>
              </div>
              <p v-if="row.original.turnstileStats.retestRequired" class="text-sm text-warning whitespace-normal">The plugin requires a new validation test.</p>
            </div>
          </template>
        </UPopover>
        <UBadge v-else color="neutral" variant="subtle" size="lg">Unknown</UBadge>
      </template>
      <template #checks-cell="{ row }">
        <UPopover v-if="row.original.turnstileStats">
          <UBadge as="button" type="button" :color="getTurnstileCheckColor(getTurnstileCheckCount(row.original.turnstileStats))" variant="subtle" size="lg" class="min-h-11 cursor-pointer gap-2 px-3" :aria-label="`Show important settings for ${domain(row.original.siteUrl)}: ${getTurnstileCheckCount(row.original.turnstileStats)}/5`">
            {{ getTurnstileCheckCount(row.original.turnstileStats) }}/5
            <Icon name="lucide:info" class="size-4" />
          </UBadge>
          <template #content>
            <div class="p-4 space-y-3 max-w-96">
              <p class="font-medium">Important settings</p>
              <div v-for="check in turnstileChecks" :key="check.key" class="flex items-center justify-between gap-4 text-sm">
                <span class="whitespace-normal">{{ check.label }}</span>
                <Icon :name="row.original.turnstileStats.checks[check.key] ? 'lucide:circle-check' : 'lucide:circle-x'" :class="row.original.turnstileStats.checks[check.key] ? 'text-success' : 'text-error'" class="size-5 shrink-0" :aria-label="row.original.turnstileStats.checks[check.key] ? 'Enabled' : 'Disabled'" role="img" />
              </div>
            </div>
          </template>
        </UPopover>
        <UBadge v-else color="neutral" variant="subtle" size="lg">Unknown</UBadge>
      </template>
      <template #checkedAt-cell="{ row }">
        <div class="max-w-64 space-y-1 text-sm whitespace-normal">
          <span>{{ row.original.turnstileCheckedAt ? new Date(row.original.turnstileCheckedAt).toLocaleString() : 'Not checked yet' }}</span>
          <p v-if="row.original.turnstileScanError" class="text-error">{{ row.original.turnstileScanError }}</p>
        </div>
      </template>
      <template #actions-cell="{ row }">
        <UButton label="Scan site" icon="i-lucide-scan" color="neutral" variant="outline" size="lg" :disabled="scanStore.isServerScanning(row.original.serverId)" @click="scanStore.startSiteScan(row.original.id, row.original.serverId)" />
      </template>
      <template #empty>{{ sites?.length ? 'No sites match your search.' : 'No sites found. Scan your servers to populate the list.' }}</template>
    </UTable>
  </NuxtLayout>
</template>
