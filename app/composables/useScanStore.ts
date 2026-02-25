import { defineStore } from 'pinia'

export interface ScanLogEntry {
  timestamp: Date
  type: 'log' | 'progress' | 'error' | 'complete'
  message: string
  serverId: string
}

export interface ScanProgress {
  total: number
  current: number
  success: number
  failed: number
}

export const useScanStore = defineStore('scan', () => {
  const activeScans = ref<Record<string, ScanProgress>>({})
  const completedScans = ref<Set<string>>(new Set())
  const logs = ref<ScanLogEntry[]>([])
  const ws = ref<WebSocket | null>(null)
  const wsConnected = ref(false)

  const isScanning = computed(() => Object.keys(activeScans.value).length > 0)
  const isComplete = computed(() => completedScans.value.size > 0 && !isScanning.value)
  const hasActivity = computed(() => isScanning.value || completedScans.value.size > 0)

  const aggregateProgress = computed<ScanProgress | null>(() => {
    const activeEntries = Object.values(activeScans.value)
    if (activeEntries.length === 0) return null

    return activeEntries.reduce((acc, curr) => ({
      total: acc.total + curr.total,
      current: acc.current + curr.current,
      success: acc.success + curr.success,
      failed: acc.failed + curr.failed
    }), { total: 0, current: 0, success: 0, failed: 0 })
  })

  const totalKnown = computed(() => aggregateProgress.value !== null && aggregateProgress.value.total > 0)

  const isServerScanning = (serverId: string) => !!activeScans.value[serverId]

  const addLog = (type: ScanLogEntry['type'], message: string, serverId: string) => {
    logs.value.push({
      timestamp: new Date(),
      type,
      message,
      serverId
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
        const serverId = data.serverId
        
        if (!serverId) return

        addLog(data.type, data.message, serverId)

        if (data.type === 'progress' && data.data) {
          activeScans.value[serverId] = data.data
        }

        if (data.type === 'complete') {
          delete activeScans.value[serverId]
          completedScans.value.add(serverId)
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    }

    ws.value.onclose = () => {
      wsConnected.value = false
      // Reconnect after a delay if there are active scans
      if (isScanning.value) {
        setTimeout(connectWebSocket, 1000)
      }
    }

    ws.value.onerror = (error) => {
      console.error('WebSocket error:', error)
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

  const startScan = async (serverId: string, onComplete?: () => void) => {
    if (isServerScanning(serverId)) return

    // Ensure WebSocket is connected
    connectWebSocket()

    // Initial progress if we don't know total yet
    activeScans.value[serverId] = { total: 0, current: 0, success: 0, failed: 0 }
    completedScans.value.delete(serverId)

    try {
      await useApiClient()('/sites/scan', {
        method: 'POST',
        body: { serverId }
      })
    } catch (e: any) {
      delete activeScans.value[serverId]
      addLog('error', `Failed to start scan: ${e.message}`, serverId)
      return
    }

    // Watch for completion if callback provided
    if (onComplete) {
      const unwatch = watch(
        () => completedScans.value.has(serverId),
        (completed) => {
          if (completed) {
            onComplete()
            unwatch()
          }
        }
      )
    }
  }

  const clearScan = () => {
    if (isScanning.value) return
    
    completedScans.value.clear()
    logs.value = []
    activeScans.value = {}
  }

  // Auto-connect WebSocket on client side
  if (import.meta.client) {
    connectWebSocket()
  }

  return {
    isScanning,
    isComplete,
    logs,
    progress: aggregateProgress,
    activeScans,
    completedScans,
    hasActivity,
    totalKnown,
    wsConnected,
    isServerScanning,
    startScan,
    clearScan,
    connectWebSocket,
    disconnectWebSocket
  }
})
