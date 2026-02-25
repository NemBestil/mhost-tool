<template>
  <UModal v-model:open="isOpen" title="Confirm Delete">
    <template #body>
      <p>
        Are you sure you want to delete the server <strong>{{ server.name }}</strong>? This action cannot be undone.
      </p>
    </template>

    <template #footer>
      <div class="flex justify-end w-full gap-3">
        <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            size="xl"
            @click="isOpen = false"
        />
        <UButton
            label="Delete"
            color="error"
            size="xl"
            autofocus
            :loading="isDeleting"
            @click="onConfirm"
        />
      </div>
    </template>
  </UModal>
</template>

<script lang="ts" setup>
const props = defineProps<{
  server: { id: number | string; name: string }
}>()

const emit = defineEmits<{
  (e: 'deleted'): void
}>()

const isOpen = defineModel<boolean>('open', {default: false})
const isDeleting = ref(false)

const onConfirm = async () => {
  isDeleting.value = true
  try {
    await useApiClient()(`/servers/${props.server.id}`, {
      method: 'DELETE'
    })
    emit('deleted')
    isOpen.value = false
  } catch (error) {
    console.error('Failed to delete server:', error)
  } finally {
    isDeleting.value = false
  }
}
</script>
