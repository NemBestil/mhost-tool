<script setup lang="ts">
const packageJobStore = usePackageJobStore()
const isSlideoverOpen = ref(false)

const props = defineProps({
  collapsed: Boolean
})

const progressPercent = computed(() => {
  const progress = packageJobStore.progress
  if (!progress || progress.total === 0) return null
  return Math.round((progress.current / progress.total) * 100)
})

const statusText = computed(() => {
  const progress = packageJobStore.progress
  if (!progress) return 'Package jobs completed'
  if (packageJobStore.isRunning) {
    return `Processing ${progress.total} package jobs`
  }
  return 'Package jobs completed'
})

const showSite = ref(true)
const showPlugins = ref(true)
const showThemes = ref(true)
const siteFilters = ref<string[]>([])

const siteFilterItems = computed(() => {
  const map = new Map<string, string>()
  for (const log of packageJobStore.logs) {
    if (!log.siteId) continue
    map.set(log.siteId, log.siteTitle || log.siteId)
  }

  return [...map.entries()].map(([value, label]) => ({ label, value }))
})

const filteredLogs = computed(() => {
  return packageJobStore.logs.filter((log) => {
    if (log.kind === 'plugin' && !showPlugins.value) return false
    if (log.kind === 'theme' && !showThemes.value) return false

    if (siteFilters.value.length > 0 && log.siteId) {
      const selected = new Set(siteFilters.value)
      if (!selected.has(log.siteId)) return false
    }

    return true
  })
})
</script>

<template>
  <div
    v-if="packageJobStore.hasActivity"
    class="box-content bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 cursor-pointer w-full px-4 -mx-4 pb-4 -mb-4"
    @click="isSlideoverOpen = true"
  >
    <div class="px-2 pt-2 pb-3 flex items-center gap-3">
      <Icon
        v-if="packageJobStore.isRunning"
        name="lucide:loader-2"
        class="size-4 animate-spin text-primary"
      />
      <Icon
        v-else
        name="lucide:check-circle"
        class="size-4 text-success"
      />
      <div class="text-sm font-medium flex-1" v-if="!collapsed">
        {{ statusText }}
        <div v-if="packageJobStore.progress" class="text-xs text-neutral-500">
          {{ packageJobStore.progress.success }} success, {{ packageJobStore.progress.failed }} failed, {{ packageJobStore.progress.skipped }} skipped
        </div>
      </div>
    </div>
    <div class="px-2 w-full" v-if="packageJobStore.isRunning && !collapsed" :class="packageJobStore.isRunning && !collapsed ? 'pt-2 pb-4' : 'py-4'">
      <UProgress
        v-if="progressPercent !== null"
        :model-value="progressPercent"
        size="sm"
        color="primary"
        class="w-full"
      />
      <UProgress
        v-else
        size="sm"
        color="primary"
        class="w-full"
      />
    </div>
  </div>

  <USlideover v-model:open="isSlideoverOpen" title="Package Job Log" side="right">
    <template #title>
      <div class="flex flex-col gap-3">
        <span>Package Job Log</span>
        <div class="flex flex-wrap items-center gap-3">
          <UCheckbox v-model="showPlugins" label="Plugins" />
          <UCheckbox v-model="showThemes" label="Themes" />
          <UCheckbox v-model="showSite" label="Show site" />
          <USelectMenu
            v-model="siteFilters"
            multiple
            :items="siteFilterItems"
            value-key="value"
            label-key="label"
            placeholder="Filter by site"
            class="w-56"
          />
        </div>
      </div>
    </template>

    <template #body>
      <div class="space-y-1 font-mono text-xs">
        <div
          v-for="(log, index) in filteredLogs"
          :key="index"
          class="py-1 px-2 rounded"
          :class="{
            'bg-error/10 text-error': log.type === 'error',
            'bg-success/10 text-success': log.type === 'complete',
            'bg-info/10 text-info': log.type === 'progress'
          }"
        >
          <span class="text-neutral-400 mr-2">{{ log.timestamp.toLocaleTimeString() }}</span>
          <span v-if="showSite && log.siteTitle" class="font-semibold mr-2">[{{ log.siteTitle }}]</span>
          <span v-if="log.kind && log.slug" class="font-semibold mr-2">{{ log.kind }}:{{ log.slug }}</span>
          {{ log.message }}
        </div>
        <div v-if="filteredLogs.length === 0" class="text-neutral-400 text-center py-4">
          No package job logs yet
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Clear"
          color="neutral"
          variant="outline"
          :disabled="packageJobStore.isRunning"
          @click="packageJobStore.clearActivity()"
        />
        <UButton
          label="Close"
          @click="isSlideoverOpen = false"
        />
      </div>
    </template>
  </USlideover>
</template>
