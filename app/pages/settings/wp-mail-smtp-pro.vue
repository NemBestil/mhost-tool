<template>
  <NuxtLayout name="dashboard-page">
    <div class="flex-1 flex flex-col min-h-0">
      <SettingsSetupNavigation />

      <div class="p-4 max-w-5xl mx-auto w-full space-y-4">
        <UAlert
          v-if="setupStatus !== 'pending' && !featureEnabled"
          color="warning"
          variant="soft"
          title="WP Mail SMTP Pro config is disabled"
          description="Enable the feature on the Setup overview page before editing configurations."
        >
          <template #actions>
            <UButton to="/settings/main" size="xs" color="warning" variant="outline" label="Open Setup overview" />
          </template>
        </UAlert>

        <UCard v-else>
          <template #header>
            <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h3 class="font-medium">WP Mail SMTP Pro configurations</h3>
                <p class="mt-1 text-sm text-neutral-500">
                  Create named configurations and edit them in the modal form.
                </p>
              </div>
              <UButton
                icon="i-lucide-plus"
                label="New configuration"
                :disabled="!featureEnabled"
                @click="openNewConfigurationModal"
              />
            </div>
          </template>

          <div v-if="configurations.length === 0" class="text-sm text-neutral-500">
            No configurations created yet.
          </div>

          <UTable v-else :data="configurations" :columns="columns" class="table-auto">
            <template #name-cell="{ row }">
              <div class="flex flex-col">
                <span class="font-medium">{{ row.original.name }}</span>
                <span class="text-xs text-neutral-500">{{ row.original.id }}</span>
              </div>
            </template>

            <template #mailer-cell="{ row }">
              <div class="flex flex-col gap-1">
                <UBadge variant="soft" color="neutral">
                  {{ getMailerLabel(row.original) }}
                </UBadge>
                <span class="text-xs text-neutral-500">
                  {{ getMailerSummary(row.original) }}
                </span>
              </div>
            </template>

            <template #logging-cell="{ row }">
              <div class="flex flex-col gap-1">
                <span>{{ row.original.logEmails ? 'Enabled' : 'Disabled' }}</span>
                <span v-if="row.original.logEmails" class="text-xs text-neutral-500">
                  {{ getLoggingSummary(row.original) }}
                </span>
              </div>
            </template>

            <template #verification-cell="{ row }">
              <div class="flex flex-col gap-1">
                <template v-if="row.original.mailer === 'amazon_ses'">
                  <UBadge :color="getAmazonSesValidationColor(row.original)" variant="soft">
                    {{ getAmazonSesValidationLabel(row.original) }}
                  </UBadge>
                  <span class="text-xs text-neutral-500">
                    {{ getAmazonSesValidationSummary(row.original) }}
                  </span>
                </template>
                <span v-else class="text-xs text-neutral-500">Not used</span>
              </div>
            </template>

            <template #actions-cell="{ row }">
              <div class="flex justify-end gap-2">
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-pencil"
                  label="Edit"
                  @click="openEditConfigurationModal(row.original)"
                />
                <UButton
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  label="Delete"
                  :loading="removingId === row.original.id"
                  @click="removeConfiguration(row.original)"
                />
              </div>
            </template>
          </UTable>
        </UCard>

        <UModal v-model:open="editorOpen" :title="editorTitle" :ui="{ content: 'sm:max-w-3xl' }">
          <template #body>
            <div class="space-y-6">
              <p class="text-sm text-neutral-500">
                Save this configuration with a name, then reuse it wherever WP Mail SMTP Pro needs a preset.
              </p>

              <div class="grid grid-cols-1 gap-4">
                <UFormField label="Configuration name" :error="getFieldError('name')" required>
                  <UInput
                    v-model="editorForm.name"
                    placeholder="Production SES"
                    :disabled="isSaving"
                    :color="getFieldError('name') ? 'error' : undefined"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Mailer" :error="getFieldError('mailer')">
                  <USelect
                    v-model="editorForm.mailer"
                    :items="wpMailSmtpProMailerOptions"
                    :disabled="isSaving"
                    :color="getFieldError('mailer') ? 'error' : undefined"
                    class="w-full"
                  />
                </UFormField>

                <template v-if="editorForm.mailer === 'other_smtp'">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <UFormField label="SMTP Host" :error="getFieldError('otherSmtpHost')">
                      <UInput
                        v-model="editorForm.otherSmtpHost"
                        placeholder="smtp.example.com"
                        :disabled="isSaving"
                        :color="getFieldError('otherSmtpHost') ? 'error' : undefined"
                        class="w-full"
                      />
                    </UFormField>
                    <UFormField label="Encryption" :error="getFieldError('otherSmtpEncryption')">
                      <USelect
                        v-model="editorForm.otherSmtpEncryption"
                        :items="wpMailSmtpProEncryptionOptions"
                        :disabled="isSaving"
                        :color="getFieldError('otherSmtpEncryption') ? 'error' : undefined"
                        class="w-full"
                      />
                    </UFormField>
                    <UFormField label="SMTP Port" :error="getFieldError('otherSmtpPort')">
                      <UInput
                        v-model.number="editorForm.otherSmtpPort"
                        type="number"
                        min="1"
                        max="65535"
                        :disabled="isSaving"
                        :color="getFieldError('otherSmtpPort') ? 'error' : undefined"
                        class="w-full"
                      />
                    </UFormField>
                    <UFormField label="Authentication">
                      <USwitch v-model="editorForm.otherSmtpAuthentication" :disabled="isSaving" />
                    </UFormField>
                    <UFormField
                      v-if="editorForm.otherSmtpAuthentication"
                      label="SMTP username"
                      :error="getFieldError('otherSmtpUsername')"
                    >
                      <UInput
                        v-model="editorForm.otherSmtpUsername"
                        :disabled="isSaving"
                        :color="getFieldError('otherSmtpUsername') ? 'error' : undefined"
                        class="w-full"
                      />
                    </UFormField>
                    <UFormField
                      v-if="editorForm.otherSmtpAuthentication"
                      label="SMTP password"
                      :error="getFieldError('otherSmtpPassword')"
                    >
                      <UInput
                        v-model="editorForm.otherSmtpPassword"
                        type="password"
                        :disabled="isSaving"
                        :color="getFieldError('otherSmtpPassword') ? 'error' : undefined"
                        class="w-full"
                      />
                    </UFormField>
                  </div>
                </template>

                <template v-else>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <UFormField label="Access key ID" :error="getFieldError('amazonSesAccessKeyId')">
                      <UInput
                        v-model="editorForm.amazonSesAccessKeyId"
                        :disabled="isSaving"
                        :color="getFieldError('amazonSesAccessKeyId') ? 'error' : undefined"
                        class="w-full"
                      />
                    </UFormField>
                    <UFormField label="Secret access key" :error="getFieldError('amazonSesSecretAccessKey')">
                      <UInput
                        v-model="editorForm.amazonSesSecretAccessKey"
                        type="password"
                        :disabled="isSaving"
                        :color="getFieldError('amazonSesSecretAccessKey') ? 'error' : undefined"
                        class="w-full"
                      />
                    </UFormField>
                    <UFormField label="AWS Region" :error="getFieldError('amazonSesRegion')">
                      <USelect
                        v-model="editorForm.amazonSesRegion"
                        :items="wpMailSmtpProAwsRegionOptions"
                        :disabled="isSaving"
                        :color="getFieldError('amazonSesRegion') ? 'error' : undefined"
                        class="w-full md:col-span-2"
                      />
                    </UFormField>
                  </div>

                  <UAlert
                    v-if="editorForm.amazonSesValidation"
                    :color="editorForm.amazonSesValidation.credentialsValid ? 'success' : 'error'"
                    variant="soft"
                    :title="editorForm.amazonSesValidation.credentialsValid ? 'AWS SES credentials are valid' : 'AWS SES validation failed'"
                    :description="`${getAmazonSesValidationSummary(editorForm)}. Save changes to run validation again.`"
                  />

                  <div
                    v-if="editorForm.amazonSesValidation?.identities.length"
                    class="rounded-lg border border-neutral-200 dark:border-neutral-800"
                  >
                    <div class="border-b border-neutral-200 dark:border-neutral-800 px-4 py-3">
                      <p class="font-medium">SES identities</p>
                      <p class="text-sm text-neutral-500">
                        DNS/verification status returned directly by AWS SES.
                      </p>
                    </div>
                    <div class="divide-y divide-neutral-200 dark:divide-neutral-800">
                      <div
                        v-for="identity in editorForm.amazonSesValidation.identities"
                        :key="identity.identity"
                        class="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div class="min-w-0">
                          <p class="font-medium break-all">{{ identity.identity }}</p>
                          <p class="text-xs text-neutral-500">{{ identity.type === 'domain' ? 'Domain' : 'Email' }}</p>
                        </div>
                        <div class="flex flex-wrap gap-2">
                          <UBadge color="neutral" variant="soft">
                            {{ identity.verificationStatus || 'Unknown' }}
                          </UBadge>
                          <UBadge
                            v-if="identity.type === 'domain'"
                            :color="identity.dnsVerified === true ? 'success' : identity.dnsVerified === false ? 'warning' : 'neutral'"
                            variant="soft"
                          >
                            {{ identity.dnsVerified === true ? 'DNS verified' : identity.dnsVerified === false ? 'DNS not verified' : 'DNS unknown' }}
                          </UBadge>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UFormField label="Log e-mails">
                  <USwitch v-model="editorForm.logEmails" :disabled="isSaving" />
                </UFormField>
                <UFormField label="Hide announcements">
                  <USwitch v-model="editorForm.hideAnnouncements" :disabled="isSaving" />
                </UFormField>
                <UFormField
                  v-if="editorForm.logEmails"
                  label="Retention period"
                  :error="getFieldError('logRetentionPeriod')"
                >
                  <USelect
                    v-model="editorForm.logRetentionPeriod"
                    :items="wpMailSmtpProLogRetentionOptions"
                    :disabled="isSaving"
                    :color="getFieldError('logRetentionPeriod') ? 'error' : undefined"
                    class="w-full"
                  />
                </UFormField>
                <UFormField v-if="editorForm.logEmails" label="Log e-mail content">
                  <USwitch v-model="editorForm.logEmailContent" :disabled="isSaving" />
                </UFormField>
                <UFormField label="Disable e-mail summaries">
                  <USwitch v-model="editorForm.disableEmailSummaries" :disabled="isSaving" />
                </UFormField>
              </div>
            </div>
          </template>

          <template #footer>
            <div class="flex justify-end items-center gap-2 w-full">
              <UButton color="neutral" variant="outline" label="Cancel" :disabled="isSaving" @click="closeEditorModal" />
              <UButton
                  size="lg"
                :label="editingConfigurationId ? 'Save changes' : 'Create configuration'"
                icon="i-lucide-save"
                :loading="isSaving"
                @click="saveConfiguration"
              />
            </div>
          </template>
        </UModal>
      </div>
    </div>
  </NuxtLayout>
</template>

<script lang="ts" setup>
import type { TableColumn } from '@nuxt/ui'
import { useQuery } from '@tanstack/vue-query'
import {
  createEmptyWpMailSmtpProConfiguration,
  type WpMailSmtpProConfiguration,
  type WpMailSmtpProSettingsResponse,
  wpMailSmtpProAwsRegionOptions,
  wpMailSmtpProEncryptionOptions,
  wpMailSmtpProLogRetentionOptions,
  wpMailSmtpProMailerOptions
} from '../../utils/wpMailSmtpPro'

definePageMeta({
  title: 'Setup'
})

type WpMailSmtpProFieldErrorPath = keyof WpMailSmtpProConfiguration

const toast = useToast()
const { data: setupSettings, status: setupStatus } = useSetupSettingsQuery()
const { data, refetch } = useQuery<WpMailSmtpProSettingsResponse>({
  queryKey: ['wp-mail-smtp-pro-settings'],
  queryFn: () => useApiClient()('/settings/wp-mail-smtp-pro')
})

const editorOpen = ref(false)
const editingConfigurationId = ref<string | null>(null)
const removingId = ref<string | null>(null)
const isSaving = ref(false)
const fieldErrors = ref<Partial<Record<WpMailSmtpProFieldErrorPath, string>>>({})
const editorForm = reactive<WpMailSmtpProConfiguration>(createEmptyWpMailSmtpProConfiguration())

const featureEnabled = computed(() => setupSettings.value?.features.wpMailSmtpPro ?? false)
const configurations = computed(() => data.value?.configurations ?? [])
const editorTitle = computed(() => editingConfigurationId.value ? 'Edit configuration' : 'New configuration')

const columns: TableColumn<WpMailSmtpProConfiguration>[] = [
  {
    accessorKey: 'name',
    header: 'Name'
  },
  {
    id: 'mailer',
    header: 'Mailer'
  },
  {
    id: 'logging',
    header: 'Logging'
  },
  {
    id: 'verification',
    header: 'AWS SES'
  },
  {
    id: 'actions',
    header: '',
    size: 0,
    meta: { class: { td: 'w-2' } }
  }
]

watch(() => editorForm.logEmails, (enabled) => {
  if (!enabled) {
    editorForm.logEmailContent = false
  }
})

const getFieldError = (field: WpMailSmtpProFieldErrorPath) => fieldErrors.value[field]

const setFieldErrors = (errors: Record<string, string>) => {
  const next: Partial<Record<WpMailSmtpProFieldErrorPath, string>> = {}

  for (const [field, message] of Object.entries(errors)) {
    next[field as WpMailSmtpProFieldErrorPath] = message
  }

  fieldErrors.value = next
}

const resetEditor = (configuration = createEmptyWpMailSmtpProConfiguration()) => {
  Object.assign(editorForm, createEmptyWpMailSmtpProConfiguration(), configuration)
  fieldErrors.value = {}
}

const closeEditorModal = () => {
  editorOpen.value = false
  editingConfigurationId.value = null
  resetEditor()
}

const openNewConfigurationModal = () => {
  editingConfigurationId.value = null
  resetEditor()
  editorOpen.value = true
}

const openEditConfigurationModal = (configuration: WpMailSmtpProConfiguration) => {
  editingConfigurationId.value = configuration.id
  resetEditor(configuration)
  editorOpen.value = true
}

const normalizeConfigurationForSave = (configuration: WpMailSmtpProConfiguration): WpMailSmtpProConfiguration => {
  return {
    ...configuration,
    id: configuration.id.trim(),
    name: configuration.name.trim(),
    otherSmtpHost: configuration.otherSmtpHost.trim(),
    otherSmtpPort: Number(configuration.otherSmtpPort),
    otherSmtpUsername: configuration.otherSmtpUsername.trim(),
    amazonSesAccessKeyId: configuration.amazonSesAccessKeyId.trim()
  }
}

const getMailerLabel = (configuration: WpMailSmtpProConfiguration) => {
  return configuration.mailer === 'other_smtp' ? 'Other SMTP' : 'Amazon SES'
}

const getAwsRegionLabel = (value: string) => {
  return wpMailSmtpProAwsRegionOptions.find((option) => option.value === value)?.label || value
}

const getRetentionLabel = (value: string) => {
  return wpMailSmtpProLogRetentionOptions.find((option) => option.value === value)?.label || 'Forever'
}

const getMailerSummary = (configuration: WpMailSmtpProConfiguration) => {
  if (configuration.mailer === 'other_smtp') {
    return `${configuration.otherSmtpHost || 'No host set'}:${configuration.otherSmtpPort}`
  }

  return getAwsRegionLabel(configuration.amazonSesRegion)
}

const getLoggingSummary = (configuration: WpMailSmtpProConfiguration) => {
  const parts = [getRetentionLabel(configuration.logRetentionPeriod)]

  if (configuration.logEmailContent) {
    parts.push('content logged')
  }

  return parts.join(' / ')
}

const getAmazonSesValidationColor = (configuration: WpMailSmtpProConfiguration) => {
  if (configuration.mailer !== 'amazon_ses') {
    return 'neutral'
  }

  if (!configuration.amazonSesValidation) {
    return 'neutral'
  }

  return configuration.amazonSesValidation.credentialsValid ? 'success' : 'error'
}

const getAmazonSesValidationLabel = (configuration: WpMailSmtpProConfiguration) => {
  if (configuration.mailer !== 'amazon_ses') {
    return 'Not used'
  }

  if (!configuration.amazonSesValidation) {
    return 'Not checked'
  }

  return configuration.amazonSesValidation.credentialsValid ? 'Credentials valid' : 'Credentials invalid'
}

const getAmazonSesValidationSummary = (configuration: WpMailSmtpProConfiguration) => {
  const validation = configuration.amazonSesValidation

  if (!validation) {
    return 'No validation result saved yet.'
  }

  const parts = []

  if (validation.errorMessage) {
    parts.push(validation.errorMessage)
  } else {
    parts.push(`${validation.identities.length} identities`)
  }

  parts.push(`Checked ${formatDateTime(validation.checkedAt)}`)

  return parts.join(' · ')
}

const formatDateTime = (value: string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'unknown time'
  }

  return date.toLocaleString()
}

const saveConfigurations = async (nextConfigurations: WpMailSmtpProConfiguration[], successMessage: string) => {
  await useApiClient()('/settings/wp-mail-smtp-pro', {
    method: 'PUT',
    body: {
      configurations: nextConfigurations.map(normalizeConfigurationForSave)
    }
  })

  await refetch()

  toast.add({
    title: 'Saved',
    description: successMessage,
    color: 'success'
  })
}

const saveConfiguration = async () => {
  if (!featureEnabled.value) {
    return
  }

  isSaving.value = true
  fieldErrors.value = {}

  const normalized = normalizeConfigurationForSave(editorForm)
  const nextConfigurations = editingConfigurationId.value
    ? configurations.value.map((configuration) => configuration.id === editingConfigurationId.value ? normalized : configuration)
    : [...configurations.value, normalized]

  try {
    await saveConfigurations(
      nextConfigurations,
      editingConfigurationId.value ? 'Configuration updated.' : 'Configuration created.'
    )

    closeEditorModal()
  } catch (error: any) {
    if (error.data?.data?.fieldErrors) {
      setFieldErrors(error.data.data.fieldErrors)
    }

    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to save the configuration.',
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}

const removeConfiguration = async (configuration: WpMailSmtpProConfiguration) => {
  removingId.value = configuration.id

  try {
    await saveConfigurations(
      configurations.value.filter((entry) => entry.id !== configuration.id),
      'Configuration deleted.'
    )
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to delete the configuration.',
      color: 'error'
    })
  } finally {
    removingId.value = null
  }
}
</script>
