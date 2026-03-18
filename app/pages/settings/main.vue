<template>
  <NuxtLayout name="dashboard-page">
    <SettingsSetupNavigation />

    <div class="flex-1 flex flex-col min-h-0">

      <div class="p-4 max-w-5xl mx-auto w-full space-y-4">
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <UCard>
            <template #header>
              <h3 class="font-medium">Setup pages</h3>
            </template>

            <div class="space-y-3">
              <p class="text-sm text-neutral-500">
                Use the sections below to configure global setup defaults.
              </p>

              <div
                v-for="page in pages"
                :key="page.title"
                class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-2"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="font-medium">{{ page.title }}</p>
                    <p class="text-sm text-neutral-500">{{ page.description }}</p>
                  </div>
                  <UBadge :color="page.available ? 'success' : 'neutral'" variant="soft">
                    {{ page.available ? 'Available' : 'Disabled' }}
                  </UBadge>
                </div>

                <div class="flex justify-end">
                  <UButton
                    v-if="page.available"
                    :to="page.to"
                    size="sm"
                    variant="outline"
                    label="Open"
                  />
                </div>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-medium">Features</h3>
            </template>

            <div class="space-y-4">
              <div class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
                <div class="flex items-start justify-between gap-4">
                  <div class="space-y-1">
                    <p class="font-medium">WP Mail SMTP Pro</p>
                    <p class="text-sm text-neutral-500">
                      Enable WP Mail SMTP scanning and the main navigation section for scanned installations.
                    </p>
                  </div>
                  <USwitch v-model="form.features.wpMailSmtpPro" :disabled="isSaving" />
                </div>

                <p class="mt-3 text-xs text-neutral-500">
                  When enabled, the WP Mail SMTP section appears in the main navigation.
                </p>
              </div>

              <div class="flex justify-end">
                <UButton
                  label="Save settings"
                  icon="i-lucide-save"
                  :loading="isSaving"
                  :disabled="!hasChanges"
                  @click="saveSettings"
                />
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>

<script lang="ts" setup>
definePageMeta({
  title: 'Setup'
})

const toast = useToast()

const { data, refetch } = useSetupSettingsQuery()

const form = reactive({
  features: {
    wpMailSmtpPro: false
  }
})

const isSaving = ref(false)

watch(data, (value) => {
  if (!value) {
    return
  }

  form.features.wpMailSmtpPro = value.features.wpMailSmtpPro
}, { immediate: true })

const hasChanges = computed(() => {
  return form.features.wpMailSmtpPro !== Boolean(data.value?.features.wpMailSmtpPro)
})

const pages = computed(() => [
  {
    title: 'Overview',
    description: 'Enable or disable optional setup features.',
    to: '/settings/main',
    available: true
  },
  {
    title: 'Notifications',
    description: 'Configure SMTP and scan-report e-mails for MHost.',
    to: '/settings/notifications',
    available: true
  }
])

const saveSettings = async () => {
  isSaving.value = true

  try {
    await useApiClient()('/settings/main', {
      method: 'PUT',
      body: {
        features: {
          wpMailSmtpPro: form.features.wpMailSmtpPro
        }
      }
    })

    await refetch()

    toast.add({
      title: 'Saved',
      description: 'Setup settings have been updated.',
      color: 'success'
    })
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to save setup settings.',
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}
</script>
