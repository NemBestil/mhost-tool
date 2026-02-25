<template>
  <NuxtLayout name="dashboard-page">
    <template #topbar-left>
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          to="/sites"
        />
        <h1 class="text-lg font-semibold" v-html="decodeEntities(site?.siteTitle || 'Loading...')"></h1>
      </div>
    </template>
    <template #topbar-right>
      <UButton
          to="/sites"
          icon="lucide:arrow-left"
          variant="ghost"
          color="neutral"
          label="Back to list"
      />
    </template>

    <div v-if="status === 'pending'" class="flex-1 flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="animate-spin size-8 text-neutral-400" />
    </div>

    <div v-else-if="site" class="flex-1 flex flex-col min-h-0 gap-6  pb-4">
      <!-- Site Info Header -->
      <UCard :ui="{ body: 'p-4 sm:p-6' }" class="shrink-0">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div class="space-y-1">
            <span class="text-xs font-medium text-neutral-500 uppercase tracking-wider">Site URL</span>
            <div class="flex items-center gap-2">
              <a :href="site.siteUrl" target="_blank" class="text-primary hover:underline font-medium">
                {{ site.siteUrl }}
              </a>
              <UIcon name="i-lucide-external-link" class="size-3.5 text-neutral-400" />
            </div>
          </div>

          <div class="space-y-1">
            <span class="text-xs font-medium text-neutral-500 uppercase tracking-wider">Server</span>
            <div class="flex items-center gap-2 font-medium">
              <UIcon name="i-lucide-server" class="size-4 text-neutral-400" />
              {{ site.server.name }} ({{ site.server.hostname }})
            </div>
          </div>

          <div class="space-y-1">
            <span class="text-xs font-medium text-neutral-500 uppercase tracking-wider">Admin Email</span>
            <div class="font-medium">{{ site.adminEmail || 'N/A' }}</div>
          </div>

          <div class="space-y-1">
            <span class="text-xs font-medium text-neutral-500 uppercase tracking-wider">PHP Version</span>
            <div class="flex items-center gap-2 font-medium">
              <UBadge variant="subtle" color="neutral">{{ site.phpVersion || 'Unknown' }}</UBadge>
              <span class="text-neutral-400 text-sm">Limit: {{ site.phpMemoryLimit || 'N/A' }}</span>
            </div>
          </div>

          <div class="space-y-1">
            <span class="text-xs font-medium text-neutral-500 uppercase tracking-wider">Timezone</span>
            <div class="font-medium">{{ site.timezone || 'N/A' }}</div>
          </div>

          <div class="space-y-1">
            <span class="text-xs font-medium text-neutral-500 uppercase tracking-wider">Last Scanned</span>
            <div class="font-medium">
              <span v-if="site.lastScanAt" :title="formatFullDate(site.lastScanAt)">
                {{ formatRelativeTime(site.lastScanAt) }}
              </span>
              <span v-else class="text-neutral-400">Never</span>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex items-center gap-4 text-sm">
            <div class="flex items-center gap-1.5">
              <UIcon
                :name="site.usesServerCron ? 'i-lucide-check-circle' : 'i-lucide-x-circle'"
                :class="site.usesServerCron ? 'text-success' : 'text-neutral-400'"
              />
              <span :class="site.usesServerCron ? 'text-neutral-900 dark:text-neutral-50' : 'text-neutral-500'">Server Cron</span>
            </div>

            <div v-if="site.currentCve !== null" class="flex items-center gap-1.5">
              <UBadge :color="getCveColor(site.currentCve)" variant="subtle">
                CVE Score: {{ site.currentCve.toFixed(1) }}
              </UBadge>
            </div>
          </div>
        </template>
      </UCard>

      <!-- Tabs for Plugins, Themes, Tweaks -->
      <UTabs
        :items="tabItems"
        class="flex-1 flex flex-col min-h-0"
        :ui="{ content: 'flex-1 flex flex-col min-h-0' }"
      >
        <template #plugins>
          <div class="flex-1 flex flex-col min-h-0 mt-4">
            <UTable :data="site.plugins" :columns="pluginColumns" sticky class="flex-1 overflow-auto">
              <template #name-cell="{ row }">
                <div class="flex flex-col">
                  <span class="font-medium">{{ row.original.title || row.original.name }}</span>
                  <span class="text-xs text-neutral-500">{{ row.original.slug }}</span>
                </div>
              </template>
              <template #version-cell="{ row }">
                <div class="flex flex-col gap-1">
                  <div class="flex items-center justify-between gap-2 text-sm w-full">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <span>{{ row.original.version }}</span>

                      <template v-if="row.original.latestVersion && row.original.latestVersion !== row.original.version">
                        <UIcon name="i-lucide-arrow-right" class="size-3.5 text-warning" />
                        <span class="text-warning font-medium">{{ row.original.latestVersion }}</span>
                      </template>

                      <UIcon
                        v-else-if="row.original.latestVersion === row.original.version"
                        name="i-lucide-check-circle"
                        class="size-3.5 text-primary"
                      />
                    </div>
                    <UButton
                      v-if="row.original.latestVersion && row.original.latestVersion !== row.original.version"
                      icon="i-lucide-arrow-up-circle"
                      color="warning"
                      variant="ghost"
                      size="xl"
                      class="ml-auto"
                      @click.stop="enqueueSitePackageUpdate('plugin', row.original.slug, row.original.title || row.original.name)"
                    />
                  </div>

                  <UBadge
                    v-if="row.original.source && row.original.source !== 'unknown'"
                    :color="row.original.source === 'wordpress.org' ? 'success' : 'neutral'"
                    variant="subtle"
                    size="sm"
                    class="w-fit"
                  >
                    {{ row.original.source }}
                  </UBadge>
                </div>
              </template>
              <template #isEnabled-cell="{ row }">
                <UBadge v-if="row.original.isEnabled" color="success" variant="subtle">Active</UBadge>
                <UBadge v-else color="neutral" variant="subtle">Inactive</UBadge>
              </template>
              <template #autoUpdate-cell="{ row }">
                <UIcon
                  :name="row.original.autoUpdate ? 'i-lucide-refresh-cw' : 'i-lucide-minus'"
                  :class="row.original.autoUpdate ? 'text-primary' : 'text-neutral-400'"
                  :title="row.original.autoUpdate ? 'Auto-update enabled' : 'Auto-update disabled'"
                />
              </template>
            </UTable>
          </div>
        </template>

        <template #themes>
          <div class="flex-1 flex flex-col min-h-0 mt-4">
            <UTable :data="site.themes" :columns="themeColumns" sticky class="flex-1 overflow-auto">
              <template #name-cell="{ row }">
                <div class="flex flex-col">
                  <span class="font-medium">{{ row.original.title || row.original.name }}</span>
                  <span class="text-xs text-neutral-500">{{ row.original.slug }}</span>
                </div>
              </template>
              <template #version-cell="{ row }">
                <div class="flex flex-col gap-1">
                  <div class="flex items-center justify-between gap-2 text-sm w-full">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <span>{{ row.original.version }}</span>

                      <template v-if="row.original.latestVersion && row.original.latestVersion !== row.original.version">
                        <UIcon name="i-lucide-arrow-right" class="size-3.5 text-warning" />
                        <span class="text-warning font-medium">{{ row.original.latestVersion }}</span>
                      </template>

                      <UIcon
                        v-else-if="row.original.latestVersion === row.original.version"
                        name="i-lucide-check-circle"
                        class="size-3.5 text-primary"
                      />
                    </div>
                    <UButton
                      v-if="row.original.latestVersion && row.original.latestVersion !== row.original.version"
                      icon="i-lucide-arrow-up-circle"
                      color="warning"
                      variant="ghost"
                      size="xl"
                      class="ml-auto"
                      @click.stop="enqueueSitePackageUpdate('theme', row.original.slug, row.original.title || row.original.name)"
                    />
                  </div>

                  <UBadge
                    v-if="row.original.source && row.original.source !== 'unknown'"
                    :color="row.original.source === 'wordpress.org' ? 'success' : 'neutral'"
                    variant="subtle"
                    size="sm"
                    class="w-fit"
                  >
                    {{ row.original.source }}
                  </UBadge>
                </div>
              </template>
              <template #isEnabled-cell="{ row }">
                <div class="flex flex-col gap-1">
                  <UBadge v-if="row.original.isEnabled" color="success" variant="subtle">Active</UBadge>
                  <UBadge v-else-if="row.original.isActiveChild" color="info" variant="subtle">Parent of Active</UBadge>
                  <UBadge v-else color="neutral" variant="subtle">Inactive</UBadge>
                </div>
              </template>
              <template #autoUpdate-cell="{ row }">
                <UIcon
                  :name="row.original.autoUpdate ? 'i-lucide-refresh-cw' : 'i-lucide-minus'"
                  :class="row.original.autoUpdate ? 'text-primary' : 'text-neutral-400'"
                  :title="row.original.autoUpdate ? 'Auto-update enabled' : 'Auto-update disabled'"
                />
              </template>
            </UTable>
          </div>
        </template>

        <template #tweaks>
          <div class="mt-4 flex-1 overflow-auto">
            <div class="text-center py-12 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
              <UIcon name="i-lucide-settings-2" class="size-12 text-neutral-300 mx-auto mb-4" />
              <h3 class="text-lg font-medium text-neutral-900 dark:text-neutral-50">No Tweaks Yet</h3>
              <p class="text-neutral-500 max-w-sm mx-auto mt-2">
                Website tweaks and security hardening options will be available here in a future update.
              </p>
            </div>
          </div>
        </template>
      </UTabs>
    </div>

    <div v-else class="flex-1 flex flex-col items-center justify-center py-12">
      <h2 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Site not found</h2>
      <p class="text-neutral-500 mt-2">The site you are looking for does not exist or has been removed.</p>
      <UButton to="/sites" class="mt-6">Back to Sites</UButton>
    </div>
  </NuxtLayout>
</template>

<script lang="ts" setup>
import {formatDistanceToNow} from 'date-fns'
import {useQuery, useQueryClient} from '@tanstack/vue-query'
import type { TypedInternalResponse } from 'nitropack'
type SiteDetails = TypedInternalResponse<'/api/sites/:id', unknown, 'get'>

const route = useRoute()
const siteId = route.params.id as string
const toast = useToast()
const queryClient = useQueryClient()
const packageJobStore = usePackageJobStore()

const { data: site, status } = useQuery<SiteDetails>({
  queryKey: ['site', siteId],
  queryFn: () => useApiClient()(`/sites/${siteId}`)
})

definePageMeta({
  title: 'Site Details'
})

const tabItems = [
  {
    label: 'Plugins',
    icon: 'i-lucide-plug',
    slot: 'plugins'
  },
  {
    label: 'Themes',
    icon: 'i-lucide-palette',
    slot: 'themes'
  },
  {
    label: 'Tweaks',
    icon: 'i-lucide-settings-2',
    slot: 'tweaks'
  }
]

const pluginColumns = [
  {
    accessorKey: 'name',
    header: 'Plugin'
  },
  {
    accessorKey: 'version',
    header: 'Version'
  },
  {
    accessorKey: 'isEnabled',
    header: 'Status'
  },
  {
    accessorKey: 'autoUpdate',
    header: 'Auto-update'
  }
]

const themeColumns = [
  {
    accessorKey: 'name',
    header: 'Theme'
  },
  {
    accessorKey: 'version',
    header: 'Version'
  },
  {
    accessorKey: 'isEnabled',
    header: 'Status'
  },
  {
    accessorKey: 'autoUpdate',
    header: 'Auto-update'
  }
]

// Helpers (duplicated from index.vue for now, consider moving to a utility)
const formatRelativeTime = (dateStr: string) => {
  return formatDistanceToNow(new Date(dateStr), {addSuffix: true})
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

const getCveColor = (cve: number) => {
  if (cve >= 7) return 'error'
  if (cve >= 4) return 'warning'
  if (cve >= 2) return 'info'
  return 'success'
}

const enqueueSitePackageUpdate = async (kind: 'plugin' | 'theme', slug: string, title: string) => {
  try {
    await useApiClient()('/packages/jobs', {
      method: 'POST',
      body: {
        jobs: [
          {
            installationId: siteId,
            kind,
            slug,
            operation: 'update'
          }
        ]
      }
    })

    toast.add({
      title: 'Update queued',
      description: `${title} will be updated in the background.`,
      color: 'success'
    })
    packageJobStore.refreshStatus()
  } catch (error: any) {
    toast.add({
      title: 'Failed to queue update',
      description: error?.data?.message || error?.message || 'Unknown error',
      color: 'error'
    })
  }
}

watch(() => packageJobStore.lastCompletedProgress?.updatedAt, (updatedAt, previous) => {
  if (updatedAt && updatedAt !== previous) {
    queryClient.invalidateQueries({ queryKey: ['site', siteId] })
  }
})
</script>
