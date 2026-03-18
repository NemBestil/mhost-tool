<script setup lang="ts">
const wpRocketCacheJobStore = useWpRocketCacheJobStore()
const isSlideoverOpen = ref(false)

const progressPercent = computed(() => {
  const progress = wpRocketCacheJobStore.progress
  if (!progress || progress.total === 0) return null
  return Math.round((progress.current / progress.total) * 100)
})

const statusText = computed(() => {
  const progress = wpRocketCacheJobStore.progress
  if (!progress) return 'WP Rocket cache jobs completed'
  if (wpRocketCacheJobStore.isRunning) {
    return `Processing ${progress.total} WP Rocket cache jobs`
  }
  return 'WP Rocket cache jobs completed'
})
</script>

<template>
  <div
    v-if="wpRocketCacheJobStore.hasActivity"
    class="mb-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 cursor-pointer"
    @click="isSlideoverOpen = true"
  >
    <div class="px-4 py-3 flex items-center gap-3">
      <UIcon
        v-if="wpRocketCacheJobStore.isRunning"
        name="i-lucide-loader-2"
        class="size-4 animate-spin text-primary"
      />
      <UIcon
        v-else
        name="i-lucide-check-circle"
        class="size-4 text-success"
      />
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium">{{ statusText }}</div>
        <div v-if="wpRocketCacheJobStore.progress" class="text-xs text-neutral-500">
          {{ wpRocketCacheJobStore.progress.success }} success,
          {{ wpRocketCacheJobStore.progress.failed }} failed,
          {{ wpRocketCacheJobStore.progress.skipped }} skipped
        </div>
      </div>
    </div>
    <div v-if="wpRocketCacheJobStore.isRunning" class="px-4 pb-3">
      <UProgress
        v-if="progressPercent !== null"
        :model-value="progressPercent"
        size="sm"
        class="w-full"
      />
      <UProgress v-else size="sm" class="w-full" />
    </div>
  </div>

  <USlideover v-model:open="isSlideoverOpen" title="WP Rocket Cache Job Log" side="right">
    <template #body>
      <div class="space-y-1 font-mono text-xs">
        <div
          v-for="(log, index) in wpRocketCacheJobStore.logs"
          :key="index"
          class="py-1 px-2 rounded"
          :class="{
            'bg-error/10 text-error': log.type === 'error',
            'bg-success/10 text-success': log.type === 'complete',
            'bg-info/10 text-info': log.type === 'progress'
          }"
        >
          <span class="text-neutral-400 mr-2">{{ log.timestamp.toLocaleTimeString() }}</span>
          <span v-if="log.siteTitle" class="font-semibold mr-2">[{{ log.siteTitle }}]</span>
          {{ log.message }}
        </div>
        <div v-if="wpRocketCacheJobStore.logs.length === 0" class="text-neutral-400 text-center py-4">
          No WP Rocket cache job logs yet
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Clear"
          color="neutral"
          variant="outline"
          :disabled="wpRocketCacheJobStore.isRunning"
          @click="wpRocketCacheJobStore.clearActivity()"
        />
        <UButton
          label="Close"
          @click="isSlideoverOpen = false"
        />
      </div>
    </template>
  </USlideover>
</template>
