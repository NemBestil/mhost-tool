<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import {useQuery} from '@tanstack/vue-query'
import type {TypedInternalResponse} from 'nitropack'

interface ServerFormState {
  name: string
  hostname: string
  sshPort: number
  sshPrivateKey: string
  serverType: string
}

type ServerDetails = TypedInternalResponse<'/api/servers/:id', unknown, 'get'>

const props = defineProps<{
  id?: string
}>()

const emit = defineEmits<{
  success: []
}>()

const state = reactive<ServerFormState>({
  name: '',
  hostname: '',
  sshPort: 22,
  sshPrivateKey: '',
  serverType: 'PLESK'
})

const form = ref()
const errors = ref<{ path: string, message: string }[]>([])
const loading = ref(false)
const toast = useToast()

const serverTypeOptions = [
  { label: 'Plesk', value: 'PLESK' },
  { label: 'cPanel/WHM', value: 'CPANEL_WHM' }
]

const {
  data: existingServer,
  status: fetchStatus,
  error: fetchError
} = useQuery<ServerDetails>({
  queryKey: ['server', props.id],
  queryFn: () => $fetch(`/api/servers/${props.id}`),
  enabled: computed(() => Boolean(props.id))
})

const fetching = computed(() => Boolean(props.id) && fetchStatus.value === 'pending')

watch(existingServer, (data) => {
  if (!data) return
  Object.assign(state, data)
  state.sshPrivateKey = ''
}, {immediate: true})

watch(fetchError, (error) => {
  if (!error) return
  toast.add({
    title: 'Error',
    description: 'Failed to load server data',
    color: 'error'
  })
})

async function onSubmit(event: FormSubmitEvent<ServerFormState>) {
  loading.value = true
  errors.value = []

  try {
    const method = props.id ? 'PUT' : 'POST'
    const url = props.id ? `/api/servers/${props.id}` : '/api/servers'

    await $fetch(url, {
      method,
      body: state
    })

    toast.add({
      title: 'Success',
      description: props.id ? 'Server updated successfully' : 'Server added successfully',
      color: 'success'
    })

    emit('success')
  } catch (err: any) {
    if (err.data?.data?.fieldErrors) {
      setErrors(err.data.data.fieldErrors)
    } else if (err.data?.data?.ssh) {
      toast.add({
        title: 'SSH Validation Failed',
        description: err.data.data.ssh,
        color: 'error'
      })
      setErrors({ 
        sshPrivateKey: err.data.data.ssh 
      })
    } else {
      toast.add({
        title: 'Error',
        description: err.message || 'An error occurred while saving the server',
        color: 'error'
      })
    }
  } finally {
    loading.value = false
  }
}

function setErrors(fieldErrors: Record<string, string>) {
  errors.value = Object.entries(fieldErrors).map(([path, message]) => ({
    path,
    message
  }))
}
</script>

<template>
  <div v-if="fetching" class="flex justify-center p-12">
    <UIcon name="lucide:loader-2" class="w-8 h-8 animate-spin text-neutral-500" />
  </div>
  <UForm
    v-else
    ref="form"
    :state="state"
    class="space-y-4"
    @submit="onSubmit"
  >
    <UFormField label="Server Name" name="name" required :error="errors.find(e => e.path === 'name')?.message">
      <UInput v-model="state.name" placeholder="My Production Server" class="w-full" />
    </UFormField>

    <UFormField label="Hostname" name="hostname" required :error="errors.find(e => e.path === 'hostname')?.message">
      <UInput v-model="state.hostname" placeholder="server.example.com" class="w-full" />
    </UFormField>

    <UFormField label="SSH Port" name="sshPort" required :error="errors.find(e => e.path === 'sshPort')?.message">
      <UInput v-model="state.sshPort" type="number" class="w-full" />
    </UFormField>

    <UFormField label="SSH Private Key" name="sshPrivateKey" :required="!id" help="The private key used to connect to the server as root." :error="errors.find(e => e.path === 'sshPrivateKey')?.message">
      <UTextarea v-model="state.sshPrivateKey" :rows="5" :placeholder="id ? 'Leave blank to keep existing key, or paste a new one to update.' : '-----BEGIN OPENSSH PRIVATE KEY-----...'" class="w-full font-mono text-xs" />
    </UFormField>

    <UFormField label="Server Type" name="serverType" required :error="errors.find(e => e.path === 'serverType')?.message">
      <USelect v-model="state.serverType" :items="serverTypeOptions" class="w-full" />
    </UFormField>

    <div class="flex justify-end gap-3">
      <UButton
        type="submit"
        label="Save Server"
        size="lg"
        :loading="loading"
        icon="lucide:save"
      />
    </div>
  </UForm>
</template>
