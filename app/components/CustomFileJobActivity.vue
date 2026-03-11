<script setup lang="ts">
const customFileJobStore = useCustomFileJobStore()
const isSlideoverOpen = ref(false)

const progressPercent = computed(() => {
  const progress = customFileJobStore.progress
  if (!progress || progress.total === 0) return null
  return Math.round((progress.current / progress.total) * 100)
})

const statusText = computed(() => {
  const progress = customFileJobStore.progress
  if (!progress) return 'Custom file uploads completed'
  if (customFileJobStore.isRunning) {
    return `Processing ${progress.total} custom file uploads`
  }
  return 'Custom file uploads completed'
})
</script>

<template>
  <div
    v-if="customFileJobStore.hasActivity"
    class="mb-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 cursor-pointer"
    @click="isSlideoverOpen = true"
  >
    <div class="px-4 py-3 flex items-center gap-3">
      <UIcon
        v-if="customFileJobStore.isRunning"
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
        <div v-if="customFileJobStore.progress" class="text-xs text-neutral-500">
          {{ customFileJobStore.progress.success }} success,
          {{ customFileJobStore.progress.failed }} failed,
          {{ customFileJobStore.progress.skipped }} skipped
        </div>
      </div>
    </div>
    <div v-if="customFileJobStore.isRunning" class="px-4 pb-3">
      <UProgress
        v-if="progressPercent !== null"
        :model-value="progressPercent"
        size="sm"
        class="w-full"
      />
      <UProgress v-else size="sm" class="w-full" />
    </div>
  </div>

  <USlideover v-model:open="isSlideoverOpen" title="Custom File Upload Log" side="right">
    <template #body>
      <div class="space-y-1 font-mono text-xs">
        <div
          v-for="(log, index) in customFileJobStore.logs"
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
          <span v-if="log.originalFilename" class="font-semibold mr-2">{{ log.originalFilename }}</span>
          {{ log.message }}
        </div>
        <div v-if="customFileJobStore.logs.length === 0" class="text-neutral-400 text-center py-4">
          No custom file job logs yet
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Clear"
          color="neutral"
          variant="outline"
          :disabled="customFileJobStore.isRunning"
          @click="customFileJobStore.clearActivity()"
        />
        <UButton
          label="Close"
          @click="isSlideoverOpen = false"
        />
      </div>
    </template>
  </USlideover>
</template>
