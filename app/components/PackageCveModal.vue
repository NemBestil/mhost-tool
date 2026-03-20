<template>
  <UModal v-model:open="isOpen" :title="modalTitle" :ui="{ content: 'max-w-3xl' }">
    <template #body>
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-primary" />
      </div>

      <div v-else-if="vulnerabilities.length === 0" class="py-4 text-center text-sm text-neutral-500">
        No known vulnerabilities found.
      </div>

      <div v-else class="space-y-6">
        <div
          v-for="vuln in vulnerabilities"
          :key="vuln.vulnerabilityId"
          class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-4"
        >
          <!-- Header -->
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-3 min-w-0">
              <UBadge :color="getCveColor(vuln.cvssScore)" variant="subtle" class="shrink-0 mt-0.5 text-sm">
                {{ vuln.cvssScore.toFixed(1) }}
              </UBadge>
              <div class="min-w-0">
                <p class="font-semibold">{{ vuln.title }}</p>
                <div class="flex flex-wrap items-center gap-2 mt-1 text-sm text-neutral-500">
                  <span v-if="vuln.cve" class="font-medium">{{ vuln.cve }}</span>
                  <span v-if="vuln.cvssRating">&middot;</span>
                  <span v-if="vuln.cvssRating">{{ vuln.cvssRating }}</span>
                </div>
              </div>
            </div>
            <a
              v-if="vuln.cveLink"
              :href="vuln.cveLink"
              target="_blank"
              class="shrink-0"
            >
              <UButton
                icon="lucide:external-link"
                color="neutral"
                variant="ghost"
                size="sm"
                tag="span"
              />
            </a>
          </div>

          <!-- Description -->
          <p v-if="vuln.description" class="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
            {{ vuln.description }}
          </p>

          <!-- Details grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div v-if="vuln.cvssVector">
              <span class="text-neutral-500">CVSS Vector</span>
              <p class="font-mono text-neutral-600 dark:text-neutral-400 break-all">{{ vuln.cvssVector }}</p>
            </div>

            <div v-if="vuln.published">
              <span class="text-neutral-500">Published</span>
              <p>{{ formatDate(vuln.published) }}</p>
            </div>

            <div v-if="vuln.updated">
              <span class="text-neutral-500">Last updated</span>
              <p>{{ formatDate(vuln.updated) }}</p>
            </div>

            <div>
              <span class="text-neutral-500">Patch available</span>
              <div class="flex items-center gap-1.5 mt-0.5">
                <UIcon
                  :name="vuln.patched ? 'i-lucide-check-circle' : 'i-lucide-x-circle'"
                  :class="vuln.patched ? 'text-success' : 'text-error'"
                  class="size-4"
                />
                <span>{{ vuln.patched ? 'Yes' : 'No' }}</span>
              </div>
            </div>
          </div>

          <!-- Patched versions -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">

          <div v-if="vuln.patchedVersions.length > 0">
            <span class="text-sm text-neutral-500">Patched in</span>
            <div class="flex flex-wrap gap-1.5 mt-1">
              <UBadge
                v-for="v in vuln.patchedVersions"
                :key="v"
                color="success"
                variant="subtle"
                size="sm"
              >
                {{ v }}
              </UBadge>
            </div>
          </div>

          <!-- Affected installed versions -->
          <div>
            <span class="text-sm text-neutral-500">Affected installed versions</span>
            <div class="flex flex-wrap gap-1.5 mt-1">
              <UBadge
                v-for="v in vuln.affectedVersions"
                :key="v"
                color="error"
                variant="subtle"
                size="sm"
              >
                {{ v }}
              </UBadge>
            </div>
          </div>
          </div>

          <!-- Copyright -->
          <div v-if="vuln.copyrights && vuln.copyrights.length > 0" class="border-t border-neutral-200 dark:border-neutral-800 pt-3">
            <div v-for="(cr, index) in vuln.copyrights" :key="index" class="flex items-start gap-1.5 text-sm text-neutral-400">
              <Icon name="lucide:copyright" class="size-3.5 mt-0.5 shrink-0" />
              <span>{{ cr.notice }}</span>
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
  cvssVector: string | null
  description: string | null
  copyrights: { notice: string }[] | null
  published: string | null
  updated: string | null
  patched: boolean
  patchedVersions: string[]
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

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
</script>
