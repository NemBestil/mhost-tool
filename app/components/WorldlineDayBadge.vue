<script setup lang="ts">
import { getWorldlineDayStatus, type WorldlineDay } from '../../shared/utils/siteHealth'

const props = defineProps<{ day?: WorldlineDay, error?: string | null }>()
const label = computed(() => {
  const status = getWorldlineDayStatus(props.day)
  return status === 'No orders' ? '-' : status
})
const color = computed(() => label.value === '?' ? 'warning' : label.value === 'OK' ? 'success' : label.value === '-' ? 'neutral' : 'error')
const tooltip = computed(() => {
  const day = props.day
  if (!day) return props.error ?? 'No scan result. Scan the site to check captures.'
  const explanation = day.total === 0 ? 'No Worldline orders.' : {
    captured: 'At least one sampled order has a captured amount.',
    missing: 'No capture found in the sampled orders.',
    unknown: 'Capture could not be confirmed. A lookup failed or a transaction ID was missing.',
    no_orders: 'No orders were available when the sample was checked.'
  }[day.captureStatus]
  return `${day.date}: ${explanation} ${day.total} orders, ${day.eligible} processing/completed. Sample: ${day.sampled} orders. Checked: ${new Date(day.checkedAt).toLocaleString()}.`
})
</script>

<template>
  <UTooltip :text="tooltip">
    <UBadge :label="label" :color="color" variant="subtle" :aria-label="tooltip" />
  </UTooltip>
</template>
