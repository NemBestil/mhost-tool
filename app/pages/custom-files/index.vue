<template>
  <NuxtLayout name="dashboard-page">
    <template #topbar-right>
      <input
        ref="fileInputRef"
        type="file"
        class="hidden"
        multiple
        @change="onFileInputChange"
      >
      <UButton
        icon="i-lucide-upload"
        label="Upload files"
        :loading="isSubmitting"
        :disabled="isSubmitting"
        @click="openFilePicker"
      />
    </template>

    <div class="flex-1 flex flex-col min-h-0">
      <CustomFileJobActivity />

      <div class="flex items-center gap-3 px-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search files..."
          class="max-w-sm"
        />
      </div>

      <UTable
        :data="filteredFiles"
        :columns="columns"
        :loading="isPending"
        sticky
        class="flex-1"
      >
        <template #relativePath-cell="{ row }">
          <div class="min-w-0 w-full space-y-1">
            <div class="flex items-center gap-2 min-w-0 w-full">
              <UInput
                :model-value="getPathDraft(row.original.id, row.original.relativePath)"
                class="min-w-0 flex-1"
                placeholder="wp-content/..."
                @update:model-value="(value) => updateDraft(row.original.id, String(value))"
                @keyup.enter="saveRelativePath(row.original)"
              />
              <UButton
                icon="i-lucide-save"
                color="primary"
                variant="outline"
                size="lg"
                :disabled="!isPathDirty(row.original.id, row.original.relativePath) || updatingPathIds.has(row.original.id)"
                :loading="updatingPathIds.has(row.original.id)"
                @click="saveRelativePath(row.original)"
              />
            </div>
            <div class="text-xs text-neutral-500 truncate">
              {{ row.original.originalFilename }}
            </div>
          </div>
        </template>

        <template #deployments-cell="{ row }">
          <div class="flex flex-wrap items-center gap-2">
            <UBadge
              :color="row.original.currentDeploymentCount > 0 ? 'success' : 'warning'"
              variant="subtle"
            >
              {{ row.original.currentDeploymentCount }} sites
            </UBadge>
          </div>
        </template>

        <template #uploadedAt-cell="{ row }">
          <span :title="formatFullDate(row.original.uploadedAt)">
            {{ formatRelativeTime(row.original.uploadedAt) }}
          </span>
        </template>

        <template #actions-cell="{ row }">
          <div class="flex items-center justify-end gap-2">
            <UButton
              icon="i-lucide-upload"
              label="Upload"
              color="primary"
              variant="outline"
              @click="openSitesModal(row.original)"
            />
            <UButton
              icon="i-lucide-trash"
              color="error"
              variant="ghost"
              :loading="deletingIds.has(row.original.id)"
              @click="deleteFile(row.original)"
            />
          </div>
        </template>
      </UTable>

      <div
        v-if="!isPending && filteredFiles.length === 0"
        class="py-12 text-center text-neutral-500"
      >
        No custom files found.
      </div>
    </div>

    <CustomFileSitesModal
      v-model:open="isSitesModalOpen"
      :file-details="activeFileDetails"
    />
  </NuxtLayout>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useQuery } from '@tanstack/vue-query'
import { formatDistanceToNow } from 'date-fns'
import { watchThrottled } from '@vueuse/core'

definePageMeta({
  title: 'Custom files'
})

type CustomFileRow = {
  id: string
  originalFilename: string
  relativePath: string
  uploadedAt: string
  currentDeploymentCount: number
  staleDeploymentCount: number
}

const toast = useToast()
const customFileJobStore = useCustomFileJobStore()
const apiClient = useApiClient();

const fileInputRef = ref<HTMLInputElement | null>(null)
const isSubmitting = ref(false)
const search = ref('')
const pathDrafts = ref<Record<string, string>>({})
const updatingPathIds = ref<Set<string>>(new Set())
const deletingIds = ref<Set<string>>(new Set())

const isSitesModalOpen = ref(false)
const activeFileDetails = ref<Pick<CustomFileRow, 'id' | 'originalFilename' | 'relativePath'> | null>(null)

const { data, isPending, refetch } = useQuery<{ files: CustomFileRow[] }>({
  queryKey: ['custom-files-list'],
  queryFn: () => useApiClient()('/custom-files/list')
})

const files = computed(() => data.value?.files || [])
const filteredFiles = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return files.value

  return files.value.filter(file => (
    file.originalFilename.toLowerCase().includes(query)
    || file.relativePath.toLowerCase().includes(query)
  ))
})

const columns: TableColumn<CustomFileRow>[] = [
  {
    accessorKey: 'relativePath',
    header: 'Relative path',
    meta: { class: { th: 'w-[55%]', td: 'w-[55%]' } }
  },
  {
    id: 'deployments',
    header: 'Sites'
  },
  {
    accessorKey: 'uploadedAt',
    header: 'Uploaded'
  },
  {
    id: 'actions',
    header: '',
    size: 0,
    meta: { class: { td: 'w-2' } }
  }
]

const openFilePicker = () => {
  fileInputRef.value?.click()
}

const onFileInputChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files ? Array.from(target.files) : []
  await uploadFiles(files)
  target.value = ''
}

const uploadFiles = async (filesToUpload: File[]) => {
  if (!filesToUpload.length) return

  console.log('Uploading files:', filesToUpload)
  isSubmitting.value = true
  try {
    const formData = new FormData()
    for (const file of filesToUpload) {
      formData.append('files', file, file.name)
    }

    const response = await apiClient<{count: number}>('/custom-files/upload', {
      method: 'POST',
      body: formData
    })

    console.log('Upload response:', response)

    toast.add({
      title: 'Files uploaded',
      description: `${response.count} custom file(s) uploaded.`,
      color: 'success'
    })

    await refetch()
  } catch (error: any) {
    toast.add({
      title: 'Upload failed',
      description: error?.data?.message || error?.message || 'Unknown error',
      color: 'error'
    })
  } finally {
    isSubmitting.value = false
  }
}

const getPathDraft = (id: string, relativePath: string) => {
  return pathDrafts.value[id] ?? relativePath
}

const updateDraft = (id: string, value: string) => {
  pathDrafts.value[id] = value
}

const isPathDirty = (id: string, relativePath: string) => {
  return (pathDrafts.value[id] ?? relativePath) !== relativePath
}

const saveRelativePath = async (file: CustomFileRow) => {
  const nextPath = pathDrafts.value[file.id] ?? file.relativePath
  if (nextPath === file.relativePath || updatingPathIds.value.has(file.id)) {
    return
  }

  updatingPathIds.value = new Set([...updatingPathIds.value, file.id])

  try {
    const response = await apiClient<{ id: string, relativePath: string }>(`/custom-files/${file.id}`, {
      method: 'PUT',
      body: {
        relativePath: nextPath
      }
    })

    toast.add({
      title: 'Path updated',
      description: `${file.originalFilename} now targets ${response.relativePath}.`,
      color: 'success'
    })

    pathDrafts.value[file.id] = response.relativePath
    if (activeFileDetails.value?.id === file.id) {
      activeFileDetails.value = {
        ...activeFileDetails.value,
        relativePath: response.relativePath
      }
    }

    await refetch()
  } catch (error: any) {
    toast.add({
      title: 'Failed to update path',
      description: error?.data?.message || error?.message || 'Unknown error',
      color: 'error'
    })
  } finally {
    const next = new Set(updatingPathIds.value)
    next.delete(file.id)
    updatingPathIds.value = next
  }
}

const openSitesModal = (file: CustomFileRow) => {
  activeFileDetails.value = {
    id: file.id,
    originalFilename: file.originalFilename,
    relativePath: file.relativePath
  }
  isSitesModalOpen.value = true
}

const deleteFile = async (file: CustomFileRow) => {
  if (deletingIds.value.has(file.id)) return

  const confirmed = window.confirm(`Delete "${file.originalFilename}"? This also removes its deployment history.`)
  if (!confirmed) return

  deletingIds.value = new Set([...deletingIds.value, file.id])

  try {
    await apiClient(`/custom-files/${file.id}`, {
      method: 'DELETE'
    })

    toast.add({
      title: 'File deleted',
      description: `${file.originalFilename} was removed.`,
      color: 'success'
    })

    if (activeFileDetails.value?.id === file.id) {
      isSitesModalOpen.value = false
      activeFileDetails.value = null
    }

    delete pathDrafts.value[file.id]
    await refetch()
  } catch (error: any) {
    toast.add({
      title: 'Failed to delete file',
      description: error?.data?.message || error?.message || 'Unknown error',
      color: 'error'
    })
  } finally {
    const next = new Set(deletingIds.value)
    next.delete(file.id)
    deletingIds.value = next
  }
}

const formatRelativeTime = (dateStr: string) => {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
}

const formatFullDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString()
}

watch(files, (rows) => {
  const nextDrafts: Record<string, string> = {}
  for (const file of rows) {
    nextDrafts[file.id] = pathDrafts.value[file.id] ?? file.relativePath
  }
  pathDrafts.value = nextDrafts
}, { immediate: true })

watchThrottled(() => customFileJobStore.lastCompletedProgress?.updatedAt, (updatedAt, previous) => {
  if (updatedAt && updatedAt !== previous) {
    refetch()
  }
}, { throttle: 5000 })
</script>
