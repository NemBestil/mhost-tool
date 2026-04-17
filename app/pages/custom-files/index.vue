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

      <div class="flex items-center justify-between gap-3 px-4 pb-4 border-b border-neutral-200 dark:border-neutral-800 flex-wrap">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search files..."
          class="max-w-sm flex-1"
        />
        <div class="flex items-center gap-2">
          <UButton
            icon="i-lucide-upload"
            label="Upload"
            color="primary"
            :variant="selectedIds.length === 0 ? 'outline' : 'solid'"
            :disabled="selectedIds.length === 0"
            @click="openSelectedSitesModal"
          />
          <UButton
            icon="i-lucide-trash"
            label="Delete"
            color="error"
            :variant="selectedIds.length === 0 ? 'outline' : 'solid'"
            :disabled="selectedIds.length === 0"
            :loading="isDeletingBatch"
            @click="deleteSelectedFiles"
          />
        </div>
      </div>

      <UTable
        :data="filteredFiles"
        :columns="columns"
        :loading="isPending"
        sticky
        class="flex-1"
      >
        <template #selected-header>
          <UCheckbox
            :model-value="allFilesSelected"
            @update:model-value="toggleAllRows"
          />
        </template>

        <template #selected-cell="{ row }">
          <UCheckbox
            :model-value="selectedIds.includes(row.original.id)"
            @update:model-value="(value) => toggleRow(row.original.id, Boolean(value))"
          />
        </template>
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
      :file-ids="selectedIds"
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
const selectedIds = ref<string[]>([])
const isDeletingBatch = ref(false)

const isSitesModalOpen = ref(false)

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

const allFilesSelected = computed(() => {
  return filteredFiles.value.length > 0 && filteredFiles.value.every(f => selectedIds.value.includes(f.id))
})

const columns: TableColumn<CustomFileRow>[] = [
  {
    id: 'selected',
    header: '',
    size: 0,
    meta: { class: { td: 'w-2' } }
  },
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

const toggleAllRows = (value: boolean | 'indeterminate') => {
  if (value === true) {
    const next = new Set(selectedIds.value)
    for (const f of filteredFiles.value) {
      next.add(f.id)
    }
    selectedIds.value = Array.from(next)
    return
  }

  const next = new Set(selectedIds.value)
  for (const f of filteredFiles.value) {
    next.delete(f.id)
  }
  selectedIds.value = Array.from(next)
}

const toggleRow = (id: string, checked: boolean) => {
  if (checked) {
    if (!selectedIds.value.includes(id)) {
      selectedIds.value.push(id)
    }
    return
  }

  selectedIds.value = selectedIds.value.filter(itemId => itemId !== id)
}

const openSelectedSitesModal = () => {
  isSitesModalOpen.value = true
}

const deleteSelectedFiles = async () => {
  if (selectedIds.value.length === 0 || isDeletingBatch.value) return

  const confirmed = window.confirm(`Delete ${selectedIds.value.length} selected file(s)? This also removes their deployment history.`)
  if (!confirmed) return

  isDeletingBatch.value = true
  try {
    await Promise.all(selectedIds.value.map(id => apiClient(`/custom-files/${id}`, {
      method: 'DELETE'
    })))

    toast.add({
      title: 'Files deleted',
      description: `${selectedIds.value.length} custom file(s) removed.`,
      color: 'success'
    })

    selectedIds.value = []
    await refetch()
  } catch (error: any) {
    toast.add({
      title: 'Failed to delete files',
      description: error?.data?.message || error?.message || 'Unknown error',
      color: 'error'
    })
  } finally {
    isDeletingBatch.value = false
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
