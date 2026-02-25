<template>
  <NuxtLayout name="dashboard-page">
    <div class="p-4 max-w-3xl mx-auto">
      <UCard>
        <template #header>
          <h3 class="font-medium">E-mail configuration</h3>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-neutral-500">
            Configure SMTP for e-mail notifications. This is required before monitoring e-mails can be enabled.
          </p>

          <div class="grid grid-cols-1 gap-3">
            <UFormField label="SMTP host and port">
              <UFieldGroup class="w-full">
                <UInput v-model="form.host" placeholder="smtp.example.com" :disabled="isSaving || isTesting"
                        :color="getFieldError('host') ? 'error' : undefined"
                        class="w-full"/>
                <UInput v-model.number="form.port" type="number" min="1" max="65535" :disabled="isSaving || isTesting"
                        :color="getFieldError('port') ? 'error' : undefined"/>
              </UFieldGroup>
              <p v-if="getFieldError('host')" class="mt-1 text-sm text-error">{{ getFieldError('host') }}</p>
              <p v-if="getFieldError('port')" class="mt-1 text-sm text-error">{{ getFieldError('port') }}</p>
            </UFormField>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <UFormField>
                <template #label>
                  STARTTLS or TLS
                  <UTooltip text="If true, the connection uses TLS immediately upon connecting. Set this to true when connecting to port 465. For port 587 or 25, leave this as false and let STARTTLS upgrade the connection." :content="{side: 'top'}">
                    <button type="button" class="inline-flex items-center gap-1 text-sm text-neutral-500">
                      <UIcon name="i-lucide-info" class="size-3.5" />
                    </button>
                  </UTooltip>
                </template>
                <USwitch v-model="form.secure" :disabled="isSaving || isTesting"/>
              </UFormField>
              <UFormField label="SASL auth method" :error="getFieldError('authMethod')">
                <USelect
                  v-model="form.authMethod"
                  :items="smtpAuthMethodOptions"
                  value-key="value"
                  :disabled="isSaving || isTesting"
                  :color="getFieldError('authMethod') ? 'error' : undefined"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="SMTP username" :error="getFieldError('authUser')">
                <UInput v-model="form.authUser" placeholder="mailer@example.com" :disabled="isSaving || isTesting"
                        :color="getFieldError('authUser') ? 'error' : undefined" class="w-full" />
              </UFormField>
              <UFormField label="SMTP password" :error="getFieldError('authPass')">
                <UInput v-model="form.authPass" type="password" :disabled="isSaving || isTesting"
                        :color="getFieldError('authPass') ? 'error' : undefined" class="w-full"/>
              </UFormField>
              <UFormField label="From name" :error="getFieldError('fromName')">
                <UInput v-model="form.fromName" placeholder="MHost" :disabled="isSaving || isTesting"
                        :color="getFieldError('fromName') ? 'error' : undefined" class="w-full"/>
              </UFormField>
              <UFormField label="From e-mail" :error="getFieldError('fromEmail')">
                <UInput v-model="form.fromEmail" placeholder="monitor@example.com" :disabled="isSaving || isTesting"
                        :color="getFieldError('fromEmail') ? 'error' : undefined" class="w-full"/>
              </UFormField>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 justify-end">
            <UPopover>
              <UButton
                  color="neutral"
                  variant="outline"
                  label="Send test e-mail"
                  icon="i-lucide-send"
                  :loading="isTesting"
                  :disabled="!canSendTestEmail || isSaving"
              />
              <template #content>
                <div class="p-4 w-full space-y-3">
                  <UFormField label="Test recipient (optional)" :error="getFieldError('toEmail')">
                    <UInput
                        v-model="testRecipient"
                        placeholder="alerts@example.com"
                        :disabled="isSaving || isTesting"
                        :color="getFieldError('toEmail') ? 'error' : undefined"
                        @keyup.enter="sendTestEmail"
                    />
                  </UFormField>
                  <UButton
                      label="Send test e-mail"
                      icon="i-lucide-send"
                      block
                      :loading="isTesting"
                      :disabled="!canSendTestEmail || isSaving"
                      @click="sendTestEmail"
                  />
                </div>
              </template>
            </UPopover>
            <UButton
                label="Save settings"
                icon="i-lucide-save"
                :loading="isSaving"
                :disabled="isTesting"
                @click="saveSettings"
            />
          </div>
        </div>
      </UCard>
    </div>
  </NuxtLayout>
</template>

<script lang="ts" setup>
import {useQuery} from '@tanstack/vue-query'

definePageMeta({
  title: 'Main settings'
})

type SmtpForm = {
  host: string
  port: number
  secure: boolean
  authMethod: 'PLAIN' | 'LOGIN' | 'CRAM-MD5'
  authUser: string
  authPass: string
  fromName: string
  fromEmail: string
}

type MainSettingsResponse = {
  smtp: SmtpForm | null
  smtpConfigured: boolean
}

type SmtpFieldErrorPath = keyof SmtpForm | 'toEmail'

const toast = useToast()

const {data, refetch} = useQuery<MainSettingsResponse>({
  queryKey: ['main-settings'],
  queryFn: () => useApiClient()('/settings/main')
})

const form = reactive<SmtpForm>({
  host: '',
  port: 587,
  secure: false,
  authMethod: 'PLAIN',
  authUser: '',
  authPass: '',
  fromName: '',
  fromEmail: ''
})

const testRecipient = ref('')
const isTestPopoverOpen = ref(false)
const isSaving = ref(false)
const isTesting = ref(false)
const fieldErrors = ref<Partial<Record<SmtpFieldErrorPath, string>>>({})
const smtpAuthMethodOptions = [
  { label: 'PLAIN', value: 'PLAIN' },
  { label: 'LOGIN', value: 'LOGIN' },
  { label: 'CRAM-MD5', value: 'CRAM-MD5' }
] as const

watch(data, (value) => {
  if (!value?.smtp) return

  Object.assign(form, value.smtp)
}, {immediate: true})

watch(() => form.port, (port) => {
  if (port === 465) {
    form.secure = true
    return
  }

  if (port === 587) {
    form.secure = false
  }
})

const canSendTestEmail = computed(() => {
  const port = Number(form.port)
  return (
    form.host.trim().length > 0 &&
    Number.isInteger(port) &&
    port > 0 &&
    port <= 65535 &&
    form.authUser.trim().length > 0 &&
    form.authPass.length > 0 &&
    form.fromName.trim().length > 0 &&
    form.fromEmail.trim().length > 0
  )
})

const getFieldError = (field: SmtpFieldErrorPath) => fieldErrors.value[field]

const setFieldErrors = (errors: Record<string, string>) => {
  fieldErrors.value = {
    host: errors.host,
    port: errors.port,
    authMethod: errors.authMethod,
    authUser: errors.authUser,
    authPass: errors.authPass,
    fromName: errors.fromName,
    fromEmail: errors.fromEmail,
    toEmail: errors.toEmail
  }
}

const saveSettings = async () => {
  isSaving.value = true
  fieldErrors.value = {}
  try {
    await useApiClient()('/settings/main', {
      method: 'PUT',
      body: {
        smtp: {
          ...form,
          port: Number(form.port),
          host: form.host.trim(),
          authUser: form.authUser.trim(),
          fromName: form.fromName.trim(),
          fromEmail: form.fromEmail.trim()
        }
      }
    })

    await refetch()

    toast.add({
      title: 'Saved',
      description: 'SMTP settings have been updated.',
      color: 'success'
    })
  } catch (error: any) {
    if (error.data?.data?.fieldErrors) {
      setFieldErrors(error.data.data.fieldErrors)
    }

    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to save SMTP settings.',
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}

const sendTestEmail = async () => {
  if (!canSendTestEmail.value) {
    return
  }

  isTesting.value = true
  fieldErrors.value = {}
  try {
    await useApiClient()('/settings/smtp-test', {
      method: 'POST',
      body: {
        smtp: {
          ...form,
          port: Number(form.port),
          host: form.host.trim(),
          authUser: form.authUser.trim(),
          fromName: form.fromName.trim(),
          fromEmail: form.fromEmail.trim()
        },
        toEmail: testRecipient.value.trim() || undefined
      }
    })

    toast.add({
      title: 'Test sent',
      description: 'SMTP test e-mail has been sent.',
      color: 'success'
    })
  } catch (error: any) {
    if (error.data?.data?.fieldErrors) {
      setFieldErrors(error.data.data.fieldErrors)
    }

    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to send test e-mail.',
      color: 'error'
    })
  } finally {
    isTesting.value = false
  }
}
</script>
