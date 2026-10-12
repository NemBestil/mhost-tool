<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { getCronStatus } from '../../shared/utils/siteHealth'

const props = defineProps<{
  site: {
    cronMonitorStartedAt: Date | string | null
    cronLastRunAt: Date | string | null
    cronCheckedAt: Date | string | null
    cronScanError: string | null
  }
}>()
const now = useNow({ interval: 60_000 })
const status = computed(() => getCronStatus(props.site, now.value.getTime()))
const colors = { ok: 'success', overdue: 'error', pending: 'warning', unknown: 'neutral' } as const
const tooltip = computed(() => {
  const lastRun = props.site.cronLastRunAt ? new Date(props.site.cronLastRunAt).toLocaleString() : 'Never'
  const checked = props.site.cronCheckedAt ? new Date(props.site.cronCheckedAt).toLocaleString() : 'Never'
  const details = props.site.cronScanError ?? ({
    ok: 'Cron ran within the last 24 hours.',
    overdue: 'Cron has not run within the last 24 hours.',
    pending: 'Waiting for the first hourly heartbeat.',
    unknown: 'Heartbeat unavailable. Install and activate the updated nb-core plugin, then scan the site.'
  })[status.value]
  return `${details} Last cron run: ${lastRun}. Last scan: ${checked}.`
})
</script>

<template>
  <UTooltip :text="tooltip">
    <UBadge :color="colors[status]" variant="subtle" class="text-base px-1" :aria-label="tooltip">
      <Icon name="lucide:clock" class="size-4" />
    </UBadge>
  </UTooltip>
</template>
