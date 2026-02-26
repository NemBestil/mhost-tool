<template>
  <div class="p-4 space-y-4 max-w-5xl">
    <UCard>
      <template #header>
        <h3 class="font-medium">New site defaults</h3>
      </template>
      <div class="space-y-3">
        <div class="text-sm text-neutral-500">
          Monitoring level to apply when new sites are discovered.
        </div>
        <USelectMenu
            v-model="defaultNewSiteLevel"
            :items="monitoringLevelOptions"
            value-key="id"
            class="w-64"
            :disabled="isSavingConfig || configStatus === 'pending'"
        >
          <template #item-label="{ item }">
            <span :class="item.color ? `text-${item.color}` : ''">{{ item.label }}</span>
          </template>
          <template #default="{ modelValue }">
            <span v-if="modelValue"
                  :class="monitoringLevelOptions.find(o => o.id === modelValue)?.color ? `text-${monitoringLevelOptions.find(o => o.id === modelValue)?.color}` : ''">
              {{ monitoringLevelOptions.find(o => o.id === modelValue)?.label }}
            </span>
          </template>
        </USelectMenu>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h3 class="font-medium">E-mail notifications</h3>
          <UButton
              size="sm"
              variant="outline"
              icon="i-lucide-plus"
              label="Add e-mail"
              :disabled="isSavingConfig || !smtpConfigured"
              @click="addEmailTarget"
          />
        </div>
      </template>
      <div class="space-y-3">
        <UAlert
            v-if="!smtpConfigured"
            color="warning"
            variant="soft"
            title="SMTP is not configured"
            description="Add valid SMTP settings in Main settings before enabling e-mail notifications."
        >
          <template #actions>
            <UButton to="/settings/main" size="xs" color="warning" variant="outline" label="Open Main settings"/>
          </template>
        </UAlert>
        <div v-if="emailTargets.length === 0" class="text-sm text-neutral-500">
          No e-mail addresses configured.
        </div>
        <div
            v-for="(entry, index) in emailTargets"
            :key="`email-${index}`"
            class="grid grid-cols-1 xl:grid-cols-[1fr_200px_220px_180px_auto] gap-3 items-start"
            :class="index>0 ? 'border-t pt-3 mt-3 border-neutral-200 dark:border-neutral-700' : ''"
        >
          <UFormField label="E-mail address">
            <UInput
                v-model="entry.email"
                placeholder="name@example.com"
                class="w-full"
                :disabled="isSavingConfig || !smtpConfigured"
            />
          </UFormField>
          <UFormField label="Triggers after">
            <UFieldGroup class="w-full">
              <UInput
                  :model-value="String(entry.minAttempts)"
                  type="number"
                  min="1"
                  :disabled="isSavingConfig || !smtpConfigured"
                  class="w-full"
                  @update:model-value="(value) => entry.minAttempts = parseMinAttempts(value)"
              >
              </UInput>
                <UBadge variant="outline" color="neutral">failure(s)</UBadge>
            </UFieldGroup>
          </UFormField>
          <UFormField label="Priorities">
            <USelect
                v-model="entry.priorities"
                value-key="id"
                multiple
                :items="emailPriorityOptions"
                :disabled="isSavingConfig || !smtpConfigured"
                class="w-full"
            />
          </UFormField>
          <UFormField label="Notification type">
            <USwitch
                :model-value="entry.notifyOnUp"
                :disabled="isSavingConfig || !smtpConfigured"
                :label="entry.notifyOnUp ? 'Down + Up' : 'Down only'"
                @update:model-value="(value) => entry.notifyOnUp = Boolean(value)"
            />
          </UFormField>
          <div class="self-center w-full text-end">
            <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash"
                size="xl"
                :disabled="isSavingConfig || !smtpConfigured"
                @click="removeEmailTarget(index)"
            />
          </div>
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h3 class="font-medium">Pushover notifications</h3>
          <UButton
              size="sm"
              variant="outline"
              icon="i-lucide-plus"
              label="Add token"
              :disabled="isSavingConfig"
              @click="addPushoverTarget"
          />
        </div>
      </template>
      <div class="space-y-3">
        <div v-if="pushoverTargets.length === 0" class="text-sm text-neutral-500">
          No pushover tokens configured.
        </div>
        <div
            v-for="(entry, index) in pushoverTargets"
            :key="`pushover-${index}`"
            class="grid grid-cols-1 xl:grid-cols-[1fr_1fr_140px_160px_auto_auto] gap-2 items-end"
        >
          <UFormField label="Pushover App Token">
            <UInput
                v-model="entry.token"
                placeholder="Enter token"
                :disabled="isSavingConfig"
            />
          </UFormField>

          <UFormField label="Pushover User Key">
            <UInput
                v-model="entry.userKey"
                placeholder="Enter user key"
                :disabled="isSavingConfig"
            />
          </UFormField>
          <UFormField label="Triggers after attempts">
            <UInput
                :model-value="String(entry.minAttempts)"
                type="number"
                min="1"
                :disabled="isSavingConfig"
                @update:model-value="(value) => entry.minAttempts = parseMinAttempts(value)"
            />
          </UFormField>
          <UFormField label="Criticality">
            <USelectMenu
                v-model="entry.criticality"
                value-key="id"
                :items="criticalityOptions"
                :disabled="isSavingConfig"
            />
          </UFormField>
          <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-send"
              label="Test"
              :loading="isTestingPushover[index]"
              :disabled="isSavingConfig"
              @click="testPushoverTarget(index)"
          />
          <UButton
              color="error"
              variant="ghost"
              icon="i-lucide-trash"
              :disabled="isSavingConfig"
              @click="removePushoverTarget(index)"
          />
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h3 class="font-medium">Webhook notifications</h3>
          <UButton
              size="sm"
              variant="outline"
              icon="i-lucide-plus"
              label="Add webhook"
              :disabled="isSavingConfig"
              @click="addWebhookTarget"
          />
        </div>
      </template>
      <div class="space-y-3">
        <div v-if="webhookTargets.length === 0" class="text-sm text-neutral-500">
          No webhooks configured.
        </div>
        <div
            v-for="(entry, index) in webhookTargets"
            :key="`webhook-${index}`"
            class="grid grid-cols-1 md:grid-cols-[1fr_200px_auto] gap-2 items-end"
        >
          <UFormField label="Webhook URL (HTTP/HTTPS)">
            <UInput
                v-model="entry.url"
                placeholder="https://example.com/webhook"
                :disabled="isSavingConfig"
            />
          </UFormField>
          <UFormField label="Triggers after attempts">
            <UInput
                :model-value="String(entry.minAttempts)"
                type="number"
                min="1"
                :disabled="isSavingConfig"
                @update:model-value="(value) => entry.minAttempts = parseMinAttempts(value)"
            />
          </UFormField>
          <UButton
              color="error"
              variant="ghost"
              icon="i-lucide-trash"
              :disabled="isSavingConfig"
              @click="removeWebhookTarget(index)"
          />
        </div>
      </div>
    </UCard>

    <div class="flex justify-end">
      <UButton
          label="Save configuration"
          icon="i-lucide-save"
          :loading="isSavingConfig"
          @click="saveConfiguration"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import type {SelectItem} from '@nuxt/ui'
import {useQuery} from '@tanstack/vue-query'

type MonitoringLevel = 'NONE' | 'NORMAL' | 'HIGH'
type MonitoringCriticality = 'NORMAL' | 'CRITICAL'

type MonitoringConfig = {
  defaultNewSiteLevel: MonitoringLevel
  smtpConfigured: boolean
  emails: {
    id: string
    email: string
    minAttempts: number
    notifyOnUp: boolean
    priorities: MonitoringLevel[]
  }[]
  pushoverTokens: {
    id: string
    token: string
    userKey: string | null
    minAttempts: number
    criticality: MonitoringCriticality
  }[]
  webhooks: {
    id: string
    url: string
    minAttempts: number
  }[]
}

const toast = useToast()

const {data: config, status: configStatus, refetch: refetchConfig} = useQuery<MonitoringConfig>({
  queryKey: ['monitoring-config'],
  queryFn: () => useApiClient()('/monitoring/config')
})

const monitoringLevelOptions = [
  {label: 'High priority', id: 'HIGH' as MonitoringLevel, color: 'error' as const},
  {label: 'Normal priority', id: 'NORMAL' as MonitoringLevel, color: 'primary' as const},
  {label: 'None', id: 'NONE' as MonitoringLevel, color: 'neutral' as const}
]

const criticalityOptions = [
  {label: 'Critical', id: 'CRITICAL' as MonitoringCriticality},
  {label: 'Normal', id: 'NORMAL' as MonitoringCriticality}
]

const emailPriorityOptions = [
  {label: 'High', id: 'HIGH'},
  {label: 'Normal', id: 'NORMAL'}
] satisfies SelectItem[]

const isSavingConfig = ref(false)
const isTestingPushover = ref<Record<number, boolean>>({})
const defaultNewSiteLevel = ref<MonitoringLevel>('NONE')
const emailTargets = ref<{
  email: string,
  minAttempts: number,
  notifyOnUp: boolean,
  priorities: MonitoringLevel[]
}[]>([])
const pushoverTargets = ref<{
  token: string,
  userKey: string,
  minAttempts: number,
  criticality: MonitoringCriticality
}[]>([])
const webhookTargets = ref<{ url: string, minAttempts: number }[]>([])
const smtpConfigured = computed(() => config.value?.smtpConfigured ?? false)

watch(config, (value) => {
  if (!value) return
  defaultNewSiteLevel.value = value.defaultNewSiteLevel
  emailTargets.value = value.emails.map(item => ({
    email: item.email,
    minAttempts: item.minAttempts,
    notifyOnUp: item.notifyOnUp,
    priorities: item.priorities
  }))
  pushoverTargets.value = value.pushoverTokens.map(item => ({
    token: item.token,
    userKey: item.userKey ?? '',
    minAttempts: item.minAttempts,
    criticality: item.criticality
  }))
  webhookTargets.value = value.webhooks.map(item => ({
    url: item.url,
    minAttempts: item.minAttempts
  }))
}, {immediate: true})

const addEmailTarget = () => {
  emailTargets.value.push({
    email: '',
    minAttempts: 1,
    notifyOnUp: false,
    priorities: ['HIGH', 'NORMAL']
  })
}

const removeEmailTarget = (index: number) => {
  emailTargets.value.splice(index, 1)
}

const addPushoverTarget = () => {
  pushoverTargets.value.push({
    token: '',
    userKey: '',
    minAttempts: 1,
    criticality: 'NORMAL'
  })
}

const removePushoverTarget = (index: number) => {
  pushoverTargets.value.splice(index, 1)
}

const testPushoverTarget = async (index: number) => {
  const target = pushoverTargets.value[index]
  if (!target) return
  if (!target.token.trim() || !target.userKey.trim()) {
    toast.add({
      title: 'Validation error',
      description: 'Pushover token and user key cannot be empty.',
      color: 'error'
    })
    return
  }

  isTestingPushover.value[index] = true
  try {
    await useApiClient()('/monitoring/test-notification', {
      method: 'POST',
      body: {
        token: target.token.trim(),
        userKey: target.userKey.trim()
      }
    })

    toast.add({
      title: 'Test sent',
      description: 'Pushover notification has been sent.',
      color: 'success'
    })
  } catch (error: any) {
    toast.add({
      title: 'Test failed',
      description: error.data?.message || 'Failed to send Pushover notification.',
      color: 'error'
    })
  } finally {
    isTestingPushover.value[index] = false
  }
}

const addWebhookTarget = () => {
  webhookTargets.value.push({
    url: '',
    minAttempts: 1
  })
}

const removeWebhookTarget = (index: number) => {
  webhookTargets.value.splice(index, 1)
}

const parseMinAttempts = (value: string | number | undefined) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1
  }
  return Math.floor(parsed)
}

const saveConfiguration = async () => {
  const normalizedEmails = emailTargets.value.map(item => ({
    email: item.email.trim(),
    minAttempts: parseMinAttempts(item.minAttempts),
    notifyOnUp: item.notifyOnUp,
    priorities: Array.from(new Set(item.priorities.filter((priority): priority is MonitoringLevel => (
        priority === 'HIGH' || priority === 'NORMAL'
    ))))
  }))

  const normalizedPushover = pushoverTargets.value.map(item => ({
    token: item.token.trim(),
    userKey: item.userKey.trim(),
    minAttempts: parseMinAttempts(item.minAttempts),
    criticality: item.criticality
  }))

  const normalizedWebhooks = webhookTargets.value.map(item => ({
    url: item.url.trim(),
    minAttempts: parseMinAttempts(item.minAttempts)
  }))

  if (normalizedEmails.some(item => item.email.length === 0)) {
    toast.add({
      title: 'Validation error',
      description: 'E-mail addresses cannot be empty.',
      color: 'error'
    })
    return
  }

  if (normalizedEmails.some(item => item.priorities.length === 0)) {
    toast.add({
      title: 'Validation error',
      description: 'Select at least one priority for each e-mail target.',
      color: 'error'
    })
    return
  }

  if (normalizedEmails.length > 0 && !smtpConfigured.value) {
    toast.add({
      title: 'Validation error',
      description: 'Configure SMTP settings before enabling e-mail notifications.',
      color: 'error'
    })
    return
  }

  if (normalizedPushover.some(item => item.token.length === 0)) {
    toast.add({
      title: 'Validation error',
      description: 'Pushover tokens cannot be empty.',
      color: 'error'
    })
    return
  }

  if (normalizedWebhooks.some(item => item.url.length === 0)) {
    toast.add({
      title: 'Validation error',
      description: 'Webhook URLs cannot be empty.',
      color: 'error'
    })
    return
  }

  isSavingConfig.value = true
  try {
    await useApiClient()('/monitoring/config', {
      method: 'PUT',
      body: {
        defaultNewSiteLevel: defaultNewSiteLevel.value,
        emails: normalizedEmails,
        pushoverTokens: normalizedPushover,
        webhooks: normalizedWebhooks
      }
    })

    await refetchConfig()

    toast.add({
      title: 'Configuration saved',
      description: 'Monitoring notifications have been updated.',
      color: 'success'
    })
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to save configuration.',
      color: 'error'
    })
  } finally {
    isSavingConfig.value = false
  }
}
</script>
