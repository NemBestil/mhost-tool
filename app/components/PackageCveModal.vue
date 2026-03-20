<template>
  <UModal v-model:open="isOpen" :title="modalTitle" :ui="{ content: 'max-w-2xl' }">
    <template #body>
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-primary" />
      </div>

      <div v-else-if="vulnerabilities.length === 0" class="py-4 text-center text-sm text-neutral-500">
        No known vulnerabilities found.
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="vuln in vulnerabilities"
          :key="vuln.vulnerabilityId"
          class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3"
        >
          <div class="flex items-start gap-3">
            <UBadge :color="getCveColor(vuln.cvssScore)" variant="subtle" class="shrink-0 mt-0.5">
              {{ vuln.cvssScore.toFixed(1) }}
            </UBadge>
            <div class="min-w-0 flex-1">
              <p class="font-medium text-sm">{{ vuln.title }}</p>
              <div class="flex flex-wrap items-center gap-2 mt-1 text-sm text-neutral-500">
                <span v-if="vuln.cve">{{ vuln.cve }}</span>
                <span v-if="vuln.cvssRating" class="text-neutral-400">&middot;</span>
                <span v-if="vuln.cvssRating">{{ vuln.cvssRating }}</span>
              </div>
              <div class="flex flex-wrap items-center gap-1.5 mt-2 text-sm text-neutral-500">
                <span>Affected versions:</span>
                <UBadge
                  v-for="v in vuln.affectedVersions"
                  :key="v"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                >
                  {{ v }}
                </UBadge>
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <UPopover v-if="vuln.copyrights && vuln.copyrights.length > 0">
                <UButton
                  icon="lucide:copyright"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                />
                <template #content>
                  <div class="p-3 max-w-xs space-y-2">
                    <p
                      v-for="(cr, index) in vuln.copyrights"
                      :key="index"
                      class="text-sm text-neutral-500"
                    >
                      {{ cr.notice }}
                    </p>
                  </div>
                </template>
              </UPopover>
              <UButton
                v-if="vuln.cveLink"
                icon="lucide:external-link"
                color="neutral"
                variant="ghost"
                size="sm"
                :href="vuln.cveLink"
                target="_blank"
                tag="a"
              />
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end">
        <UButton label="Close" color="neutral" variant="outline" @click="isOpen = false" />
      </div>
    </template>
  </UModal>
</template>

<script lang="ts" setup>
import { useQuery } from '@tanstack/vue-query'

type CveDetail = {
  vulnerabilityId: string
  title: string
  cve: string | null
  cveLink: string | null
  cvssScore: number
  cvssRating: string | null
  description: string | null
  copyrights: { notice: string }[] | null
  affectedVersions: string[]
}

const props = defineProps<{
  type: 'plugin' | 'theme' | null
  slug: string | null
  name: string | null
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const modalTitle = computed(() => {
  const label = props.name || props.slug || 'Package'
  return `Vulnerabilities — ${label}`
})

const { data, status: queryStatus } = useQuery<{ vulnerabilities: CveDetail[] }>({
  queryKey: computed(() => ['package-cve-details', props.type, props.slug]),
  queryFn: () => useApiClient()('/packages/cve-details', {
    query: { type: props.type, slug: props.slug }
  }),
  enabled: computed(() => isOpen.value && !!props.type && !!props.slug)
})

const isLoading = computed(() => queryStatus.value === 'pending' && isOpen.value)
const vulnerabilities = computed(() => data.value?.vulnerabilities ?? [])

const getCveColor = (cve: number) => {
  if (cve >= 7) return 'error'
  if (cve >= 4) return 'warning'
  if (cve >= 2) return 'info'
  return 'success'
}
</script>
