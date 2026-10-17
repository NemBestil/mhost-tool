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
const { data: setupSettings } = useSetupSettingsQuery()
const search = ref('')
const showDevSites = ref(true)
const developmentSitePatterns = computed(() =>
  (setupSettings.value?.developmentSites ?? '').toLowerCase().split(/\s+/).filter(Boolean)
)
const filteredSites = computed(() => (sites.value ?? []).filter(site =>
  `${site.siteTitle} ${site.siteUrl} ${site.server.name}`.toLowerCase().includes(search.value.trim().toLowerCase())
  && (showDevSites.value || !developmentSitePatterns.value.some(pattern => site.siteUrl.toLowerCase().includes(pattern)))
))
const columns: TableColumn<TurnstileSite>[] = [
  { accessorKey: 'siteTitle', header: 'Domain' },
  { id: 'server', header: 'Server' },
  { id: 'plugin', header: 'Plugin status' },
  { id: 'configuration', header: 'Keys' },
  { id: 'checks', header: 'Settings' },
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

function decodeEntities(title: string): string {
  const decoder = document.createElement('textarea')
  return title.replace(/&(?:#\d+|#x[\da-f]+|[a-z][\da-z]+);/gi, entity => {
    decoder.innerHTML = entity
    return decoder.value
  })
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
        <UCheckbox v-model="showDevSites" label="Dev-sites" size="lg" class="min-h-11 items-center" />
        <UButton label="Refresh list" icon="i-lucide-refresh-cw" color="neutral" variant="outline" size="lg" :loading="isFetching" @click="refreshSites" />
      </div>
      <UAlert v-if="error" color="error" title="Could not load Turnstile sites" :description="error.message" />
    </div>

    <UTable :data="filteredSites" :columns="columns" :loading="status === 'pending'" class="flex-1" :ui="{ th: 'whitespace-nowrap', td: 'whitespace-nowrap' }">
      <template #siteTitle-cell="{ row }">
        <div class="flex flex-col">
          <NuxtLink :to="`/sites/${row.original.id}`" :title="decodeEntities(row.original.siteTitle)" class="font-medium text-default hover:text-primary transition-colors cursor-pointer truncate w-full block">{{ decodeEntities(row.original.siteTitle) }}</NuxtLink>
          <a :href="row.original.siteUrl" target="_blank" rel="noopener noreferrer" class="text-sm text-primary hover:underline">{{ row.original.siteUrl }}</a>
          <p v-if="row.original.turnstileScanError" class="max-w-sm whitespace-normal text-sm text-error">{{ row.original.turnstileScanError }}</p>
        </div>
      </template>
      <template #server-cell="{ row }">
        <span :title="row.original.server.name" class="block max-w-32 truncate text-sm">{{ row.original.server.name }}</span>
      </template>
      <template #plugin-cell="{ row }">
        <div class="flex flex-col items-start gap-1">
          <UBadge :color="!row.original.turnstileStats ? 'neutral' : row.original.turnstileStats.pluginInstalled ? 'success' : 'error'" variant="subtle" size="lg">
            {{ !row.original.turnstileStats ? 'Installed: ?' : row.original.turnstileStats.pluginInstalled ? 'Installed' : 'Not installed' }}
          </UBadge>
          <UBadge :color="!row.original.turnstileStats ? 'neutral' : row.original.turnstileStats.pluginIsActive ? 'success' : 'error'" variant="subtle" size="lg">
            {{ !row.original.turnstileStats ? 'Active: ?' : row.original.turnstileStats.pluginIsActive ? 'Active' : 'Inactive' }}
          </UBadge>
        </div>
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
      <template #actions-cell="{ row }">
        <UButton icon="i-lucide-refresh-cw" aria-label="Scan site" title="Scan site" color="neutral" variant="outline" size="lg" :disabled="scanStore.isServerScanning(row.original.serverId)" @click="scanStore.startSiteScan(row.original.id, row.original.serverId)" />
      </template>
      <template #empty>{{ sites?.length ? 'No sites match your search.' : 'No sites found. Scan your servers to populate the list.' }}</template>
    </UTable>
  </NuxtLayout>
</template>
