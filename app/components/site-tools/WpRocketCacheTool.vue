<template>
  <div v-if="featureEnabled" class="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4">
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1">
        <h3 class="font-semibold text-neutral-900 dark:text-neutral-50">
          Clear WP Rocket cache
          <UBadge :color="pluginIsActive ? 'success' : (pluginInstalled ? 'warning' : 'neutral')" variant="soft">
            {{ pluginStatusLabel }}
          </UBadge>
        </h3>
        <p class="text-sm text-neutral-500 mt-1">
          Queue a background cache clear for this site.
        </p>
      </div>
      <UButton
        icon="i-lucide-rocket"
        label="Clear cache"
        color="primary"
        :disabled="!canQueueCacheClear || isQueueing"
        :loading="isQueueing"
        @click="queueCacheClear"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
type SitePlugin = {
  slug: string
  version: string | null
  isEnabled: boolean
}

const props = defineProps<{
  siteId: string
  plugins: SitePlugin[]
}>()

const toast = useToast()
const wpRocketCacheJobStore = useWpRocketCacheJobStore()
const { data: setupSettings } = useSetupSettingsQuery()

const isQueueing = ref(false)

const featureEnabled = computed(() => setupSettings.value?.features.wpRocketCache ?? false)
const wpRocketPlugin = computed(() => {
  return props.plugins.find(plugin => plugin.slug === 'wp-rocket') || null
})
const pluginInstalled = computed(() => Boolean(wpRocketPlugin.value))
const pluginIsActive = computed(() => Boolean(wpRocketPlugin.value?.isEnabled))
const pluginStatusLabel = computed(() => {
  if (pluginIsActive.value) {
    return `Active${wpRocketPlugin.value?.version ? ` (${wpRocketPlugin.value.version})` : ''}`
  }

  if (pluginInstalled.value) {
    return `Inactive${wpRocketPlugin.value?.version ? ` (${wpRocketPlugin.value.version})` : ''}`
  }

  return 'Not installed'
})
const canQueueCacheClear = computed(() => featureEnabled.value && pluginIsActive.value)

const queueCacheClear = async () => {
  if (!canQueueCacheClear.value || isQueueing.value) {
    return
  }

  isQueueing.value = true

  try {
    await useApiClient()('/wp-rocket-cache/jobs', {
      method: 'POST',
      body: {
        jobs: [
          {
            installationId: props.siteId
          }
        ]
      }
    })

    toast.add({
      title: 'Cache clear queued',
      description: 'WP Rocket cache will be cleared in the background.',
      color: 'success'
    })

    await wpRocketCacheJobStore.refreshStatus()
  } catch (error: any) {
    toast.add({
      title: 'Failed to queue cache clear',
      description: error?.data?.message || error?.message || 'Unknown error',
      color: 'error'
    })
  } finally {
    isQueueing.value = false
  }
}
</script>
