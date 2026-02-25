import { defineStore } from 'pinia'

export interface PackageJobLogEntry {
  timestamp: Date
  type: 'progress' | 'error' | 'complete'
  message: string
  siteId?: string
  siteTitle?: string
  kind?: 'plugin' | 'theme'
  slug?: string
  operation?: 'update' | 'install'
}

export interface PackageJobProgress {
  runId: string | null
  total: number
  current: number
  queued: number
  running: number
  success: number
  failed: number
  skipped: number
  isComplete: boolean
  updatedAt: string
}

export const usePackageJobStore = defineStore('package-job', () => {
  const activeProgress = ref<PackageJobProgress | null>(null)
  const lastCompletedProgress = ref<PackageJobProgress | null>(null)
  const logs = ref<PackageJobLogEntry[]>([])
  const ws = ref<WebSocket | null>(null)
  const wsConnected = ref(false)

  const isRunning = computed(() => {
    return Boolean(activeProgress.value && (activeProgress.value.queued > 0 || activeProgress.value.running > 0))
  })

  const hasActivity = computed(() => {
    return isRunning.value || Boolean(lastCompletedProgress.value?.total)
  })

  const progress = computed(() => activeProgress.value || lastCompletedProgress.value)

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
        if (data?.channel !== 'package-job') return

        const type = data?.type
        if (type !== 'progress' && type !== 'error' && type !== 'complete') {
          return
        }

        logs.value.push({
          timestamp: new Date(),
          type,
          message: data?.message || '',
          siteId: data?.data?.job?.siteId,
          siteTitle: data?.data?.job?.siteTitle,
          kind: data?.data?.job?.kind,
          slug: data?.data?.job?.slug,
          operation: data?.data?.job?.operation
        })

        const snapshot = normalizeProgress(data?.data)
        if (!snapshot) return

        if (type === 'complete' || snapshot.isComplete) {
          lastCompletedProgress.value = snapshot
          activeProgress.value = null
        } else {
          activeProgress.value = snapshot
          lastCompletedProgress.value = snapshot
        }
      } catch (error) {
        console.error('Failed to parse package job event:', error)
      }
    }

    ws.value.onclose = () => {
      wsConnected.value = false
      if (isRunning.value) {
        setTimeout(connectWebSocket, 1000)
      }
    }

    ws.value.onerror = (error) => {
      console.error('Package job WebSocket error:', error)
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

  const refreshStatus = async () => {
    try {
      const snapshot = await useApiClient()<PackageJobProgress>('/packages/jobs/status')
      const normalized = normalizeProgress(snapshot)
      if (!normalized) return

      if (normalized.isComplete) {
        if (normalized.total > 0) {
          lastCompletedProgress.value = normalized
        }
        activeProgress.value = null
      } else {
        activeProgress.value = normalized
      }
    } catch (error) {
      console.error('Failed to fetch package queue status:', error)
    }
  }

  const clearActivity = () => {
    if (isRunning.value) return

    logs.value = []
    activeProgress.value = null
    lastCompletedProgress.value = null
  }

  if (import.meta.client) {
    connectWebSocket()
    refreshStatus()
  }

  return {
    activeProgress,
    lastCompletedProgress,
    logs,
    wsConnected,
    progress,
    isRunning,
    hasActivity,
    clearActivity,
    refreshStatus,
    connectWebSocket,
    disconnectWebSocket
  }
})

function normalizeProgress(input: any): PackageJobProgress | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  return {
    runId: typeof input.runId === 'string' ? input.runId : null,
    total: Number(input.total || 0),
    current: Number(input.current || 0),
    queued: Number(input.queued || 0),
    running: Number(input.running || 0),
    success: Number(input.success || 0),
    failed: Number(input.failed || 0),
    skipped: Number(input.skipped || 0),
    isComplete: Boolean(input.isComplete),
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : new Date().toISOString()
  }
}
