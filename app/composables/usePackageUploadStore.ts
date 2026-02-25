import { defineStore } from 'pinia'

export interface UploadLogEntry {
  timestamp: Date
  type: 'log' | 'progress' | 'error' | 'complete'
  message: string
  uploadId: string
}

export interface UploadProgress {
  total: number
  current: number
  success: number
  failed: number
  skipped: number
}

const EMPTY_PROGRESS: UploadProgress = {
  total: 0,
  current: 0,
  success: 0,
  failed: 0,
  skipped: 0
}

export const usePackageUploadStore = defineStore('package-upload', () => {
  const activeUploads = ref<Record<string, UploadProgress>>({})
  const completedUploads = ref<Set<string>>(new Set())
  const lastCompletedProgress = ref<UploadProgress | null>(null)
  const logs = ref<UploadLogEntry[]>([])
  const ws = ref<WebSocket | null>(null)
  const wsConnected = ref(false)

  const isUploading = computed(() => Object.keys(activeUploads.value).length > 0)
  const hasActivity = computed(() => isUploading.value || completedUploads.value.size > 0)

  const aggregateProgress = computed<UploadProgress | null>(() => {
    const entries = Object.values(activeUploads.value)
    if (entries.length === 0) return null

    return entries.reduce((acc, curr) => ({
      total: acc.total + curr.total,
      current: acc.current + curr.current,
      success: acc.success + curr.success,
      failed: acc.failed + curr.failed,
      skipped: acc.skipped + curr.skipped
    }), { ...EMPTY_PROGRESS })
  })

  const totalKnown = computed(() => aggregateProgress.value !== null && aggregateProgress.value.total > 0)

  const addLog = (type: UploadLogEntry['type'], message: string, uploadId: string) => {
    logs.value.push({
      timestamp: new Date(),
      type,
      message,
      uploadId
    })
  }

  const connectWebSocket = () => {
    if (ws.value?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/_ws`

    ws.value = new WebSocket(wsUrl)

    ws.value.onopen = () => {
      wsConnected.value = true
    }

    ws.value.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data?.channel !== 'upload') return

        const uploadId = data.uploadId as string | undefined
        if (!uploadId) return

        addLog(data.type, data.message, uploadId)

        if (data.type === 'progress' && data.data) {
          const progress = {
            total: Number(data.data.total || 0),
            current: Number(data.data.current || 0),
            success: Number(data.data.success || 0),
            failed: Number(data.data.failed || 0),
            skipped: Number(data.data.skipped || 0)
          }
          activeUploads.value[uploadId] = progress
          lastCompletedProgress.value = progress
        }

        if (data.type === 'complete') {
          if (data.data) {
            lastCompletedProgress.value = {
              total: Number(data.data.total || 0),
              current: Number(data.data.current || 0),
              success: Number(data.data.success || 0),
              failed: Number(data.data.failed || 0),
              skipped: Number(data.data.skipped || 0)
            }
          }
          delete activeUploads.value[uploadId]
          completedUploads.value.add(uploadId)
        }
      } catch (error) {
        console.error('Failed to parse upload WebSocket event:', error)
      }
    }

    ws.value.onclose = () => {
      wsConnected.value = false
      if (isUploading.value) {
        setTimeout(connectWebSocket, 1000)
      }
    }

    ws.value.onerror = (error) => {
      console.error('Upload WebSocket error:', error)
      wsConnected.value = false
    }
  }

  const disconnectWebSocket = () => {
    if (ws.value) {
      ws.value.close()
      ws.value = null
      wsConnected.value = false
    }
  }

  const startUpload = async (files: File[], onComplete?: () => void) => {
    if (!files.length) return

    connectWebSocket()
    const formData = new FormData()

    for (const file of files) {
      formData.append('files', file, file.name)
    }

    try {
      await useApiClient()('/packages/upload', {
        method: 'POST',
        body: formData
      })
    } catch (error: any) {
      const uploadId = `local-${Date.now()}`
      addLog('error', `Failed to start upload: ${error?.data?.message || error?.message || 'Unknown error'}`, uploadId)
      return
    }

    if (onComplete) {
      const stop = watch(
        () => isUploading.value,
        (uploading) => {
          if (!uploading) {
            onComplete()
            stop()
          }
        }
      )
    }
  }

  const clearUploads = () => {
    if (isUploading.value) return

    completedUploads.value.clear()
    lastCompletedProgress.value = null
    logs.value = []
    activeUploads.value = {}
  }

  if (import.meta.client) {
    connectWebSocket()
  }

  return {
    activeUploads,
    completedUploads,
    lastCompletedProgress,
    logs,
    wsConnected,
    isUploading,
    hasActivity,
    progress: aggregateProgress,
    totalKnown,
    startUpload,
    clearUploads,
    connectWebSocket,
    disconnectWebSocket
  }
})
