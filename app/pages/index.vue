<template>
  <NuxtLayout name="dashboard-page">
    <div class="p-4 space-y-4">
      <h2 class="text-lg font-semibold">Dashboard</h2>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <UCard>
          <div class="text-sm text-neutral-500">Servers</div>
          <div class="text-2xl font-semibold mt-1">{{ overview?.serversCount ?? 0 }}</div>
        </UCard>
        <UCard>
          <div class="text-sm text-neutral-500">Total sites</div>
          <div class="text-2xl font-semibold mt-1">{{ overview?.totalSites ?? 0 }}</div>
        </UCard>
        <UCard>
          <div class="text-sm text-neutral-500">Sites with outdated plugins</div>
          <div class="text-2xl font-semibold mt-1 text-warning">{{ overview?.sitesWithOutdatedPlugins ?? 0 }}</div>
        </UCard>
        <UCard>
          <div class="text-sm text-neutral-500">Sites with outdated themes</div>
          <div class="text-2xl font-semibold mt-1 text-warning">{{ overview?.sitesWithOutdatedThemes ?? 0 }}</div>
        </UCard>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <UCard>
          <div class="text-sm text-neutral-500">Sites up to date</div>
          <div class="text-2xl font-semibold mt-1 text-success">{{ overview?.upToDateSites ?? 0 }}</div>
        </UCard>
        <UCard>
          <div class="text-sm text-neutral-500">Currently down</div>
          <div class="text-2xl font-semibold mt-1 text-error">{{ overview?.downSites ?? 0 }}</div>
        </UCard>
        <UCard>
          <div class="text-sm text-neutral-500">Currently up</div>
          <div class="text-2xl font-semibold mt-1 text-success">{{ overview?.upSites ?? 0 }}</div>
        </UCard>
        <UCard>
          <div class="text-sm text-neutral-500">Unknown status</div>
          <div class="text-2xl font-semibold mt-1 text-neutral-500">{{ overview?.unknownSites ?? 0 }}</div>
        </UCard>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <UCard>
          <div class="text-sm text-neutral-500">High priority monitoring</div>
          <div class="text-xl font-semibold mt-1">{{ overview?.highPrioritySites ?? 0 }}</div>
        </UCard>
        <UCard>
          <div class="text-sm text-neutral-500">Normal priority monitoring</div>
          <div class="text-xl font-semibold mt-1">{{ overview?.normalPrioritySites ?? 0 }}</div>
        </UCard>
        <UCard>
          <div class="text-sm text-neutral-500">Monitoring disabled</div>
          <div class="text-xl font-semibold mt-1">{{ overview?.disabledSites ?? 0 }}</div>
        </UCard>
      </div>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-medium">Notification channels</h3>
            <UTooltip
              v-if="overview && !overview.smtpConfigured"
              text="E-mail cannot be enabled until SMTP has been configured."
            >
              <UBadge
                color="warning"
                variant="soft"
                icon="i-lucide-triangle-alert"
                label="SMTP not configured"
              />
            </UTooltip>
          </div>
        </template>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div
            v-for="channel in overview?.notificationChannels || []"
            :key="channel.key"
            class="rounded-md border border-neutral-200 dark:border-neutral-800 p-3"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium">{{ channel.label }}</span>
              <UBadge
                :color="channel.enabled ? 'success' : 'neutral'"
                variant="soft"
                :label="channel.enabled ? 'Enabled' : 'Disabled'"
              />
            </div>
            <div class="mt-2 text-sm text-neutral-500">
              {{ channel.configuredTargets }} target{{ channel.configuredTargets === 1 ? '' : 's' }} configured
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </NuxtLayout>
</template>

<script lang="ts" setup>
import { useQuery } from '@tanstack/vue-query'

definePageMeta({
  title: 'Dashboard'
})

type DashboardOverview = {
  serversCount: number
  totalSites: number
  highPrioritySites: number
  normalPrioritySites: number
  disabledSites: number
  upSites: number
  downSites: number
  unknownSites: number
  sitesWithOutdatedPlugins: number
  sitesWithOutdatedThemes: number
  upToDateSites: number
  smtpConfigured: boolean
  notificationChannels: {
    key: string
    label: string
    configuredTargets: number
    enabled: boolean
  }[]
}

const { data: overview } = useQuery<DashboardOverview>({
  queryKey: ['dashboard-overview'],
  queryFn: () => $fetch('/api/dashboard/overview')
})
</script>
