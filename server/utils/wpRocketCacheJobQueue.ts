import { randomUUID } from 'node:crypto'
import Queue from 'better-queue'
import { broadcastScanEvent } from '#server/utils/scanBroadcast'
import { executeWpRocketCacheClear, type WpRocketCacheOperationResult } from '#server/utils/wpRocketCacheOperations'

export type WpRocketCacheQueueJobInput = {
  installationId: string
  siteTitle?: string
}

type WpRocketCacheQueueJob = WpRocketCacheQueueJobInput & {
  jobId: string
  enqueuedAt: string
}

export type WpRocketCacheQueueSnapshot = {
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

type QueueState = {
  queue: Queue<WpRocketCacheQueueJob, WpRocketCacheOperationResult>
  siteLocks: Set<string>
  runningTasks: Map<string, WpRocketCacheQueueJob>
  snapshot: WpRocketCacheQueueSnapshot
}

const globalQueueState = globalThis as typeof globalThis & {
  __mhostWpRocketCacheQueueState?: QueueState
}

const queueState = globalQueueState.__mhostWpRocketCacheQueueState ?? createQueueState()

if (!globalQueueState.__mhostWpRocketCacheQueueState) {
  globalQueueState.__mhostWpRocketCacheQueueState = queueState
}

export function enqueueWpRocketCacheJobs(jobs: WpRocketCacheQueueJobInput[]) {
  if (jobs.length === 0) {
    return {
      accepted: 0,
      runId: queueState.snapshot.runId,
      snapshot: getWpRocketCacheQueueSnapshot()
    }
  }

  if (queueState.snapshot.isComplete || !queueState.snapshot.runId) {
    queueState.snapshot = createFreshSnapshot()
  }

  const queuedJobs: WpRocketCacheQueueJob[] = jobs.map(job => ({
    ...job,
    jobId: randomUUID(),
    enqueuedAt: new Date().toISOString()
  }))

  for (const job of queuedJobs) {
    queueState.queue.push(job)
    queueState.snapshot.total++
    queueState.snapshot.queued++
  }

  queueState.snapshot.updatedAt = new Date().toISOString()

  broadcastProgress(`Queued ${queuedJobs.length} WP Rocket cache job(s)`)

  return {
    accepted: queuedJobs.length,
    runId: queueState.snapshot.runId,
    snapshot: getWpRocketCacheQueueSnapshot()
  }
}

export function getWpRocketCacheQueueSnapshot(): WpRocketCacheQueueSnapshot {
  return { ...queueState.snapshot }
}

function createQueueState(): QueueState {
  const state: QueueState = {
    queue: createQueue(),
    siteLocks: new Set<string>(),
    runningTasks: new Map<string, WpRocketCacheQueueJob>(),
    snapshot: createFreshSnapshot()
  }

  wireQueueEvents(state)
  return state
}

function createQueue() {
  return new Queue<WpRocketCacheQueueJob, WpRocketCacheOperationResult>((job, cb) => {
    executeWpRocketCacheClear(job.installationId)
      .then(result => cb(null, result))
      .catch((error: any) => {
        cb(null, {
          status: 'failed',
          message: error?.message || 'Unexpected WP Rocket cache processing error'
        })
      })
  }, {
    id: (job, cb) => cb(null, job.jobId as any),
    concurrent: 8,
    precondition: (cb) => {
      cb(null, moveFirstUnlockedTaskToFront())
    },
    preconditionRetryTimeout: 1000
  })
}

function wireQueueEvents(state: QueueState) {
  state.queue.on('task_started', (taskId, task) => {
    state.runningTasks.set(String(taskId), task)
    state.siteLocks.add(task.installationId)

    state.snapshot.queued = Math.max(0, state.snapshot.queued - 1)
    state.snapshot.running++
    state.snapshot.isComplete = false
    state.snapshot.updatedAt = new Date().toISOString()

    broadcastProgress('Clearing WP Rocket cache', task)
  })

  state.queue.on('task_finish', (taskId, result) => {
    const task = state.runningTasks.get(String(taskId))
    if (task) {
      state.siteLocks.delete(task.installationId)
      state.runningTasks.delete(String(taskId))
    }

    state.snapshot.running = Math.max(0, state.snapshot.running - 1)

    if (result?.status === 'skipped') {
      state.snapshot.skipped++
      broadcastProgress(result.message, task)
    } else if (result?.status === 'failed') {
      state.snapshot.failed++
      broadcastError(result.message, task)
    } else {
      state.snapshot.success++
      broadcastProgress(result?.message || 'WP Rocket cache cleared', task)
    }

    state.snapshot.updatedAt = new Date().toISOString()
  })

  state.queue.on('task_failed', (taskId, message) => {
    const task = state.runningTasks.get(String(taskId))
    if (task) {
      state.siteLocks.delete(task.installationId)
      state.runningTasks.delete(String(taskId))
    }

    state.snapshot.running = Math.max(0, state.snapshot.running - 1)
    state.snapshot.failed++
    state.snapshot.updatedAt = new Date().toISOString()

    broadcastError(message || 'WP Rocket cache queue task failed', task)
  })

  state.queue.on('drain', () => {
    state.snapshot.running = 0
    state.snapshot.queued = 0
    state.snapshot.isComplete = true
    state.snapshot.updatedAt = new Date().toISOString()

    broadcastScanEvent({
      channel: 'wp-rocket-cache-job',
      type: 'complete',
      message: `WP Rocket cache queue complete: ${state.snapshot.success} success, ${state.snapshot.failed} failed, ${state.snapshot.skipped} skipped`,
      data: getWpRocketCacheQueueSnapshot()
    })
  })
}

function moveFirstUnlockedTaskToFront(): boolean {
  const internalQueue = (queueState.queue as any)?._store?._queue as string[] | undefined
  const internalTasks = (queueState.queue as any)?._store?._tasks as Record<string, WpRocketCacheQueueJob> | undefined

  if (!Array.isArray(internalQueue) || !internalTasks || internalQueue.length === 0) {
    return true
  }

  const unlockedIndex = internalQueue.findIndex((taskId) => {
    const task = internalTasks[taskId]
    return Boolean(task && !queueState.siteLocks.has(task.installationId))
  })

  if (unlockedIndex < 0) {
    return false
  }

  if (unlockedIndex > 0) {
    const [taskId] = internalQueue.splice(unlockedIndex, 1)
    if (taskId) {
      internalQueue.unshift(taskId)
    }
  }

  return true
}

function broadcastProgress(message: string, job?: WpRocketCacheQueueJob) {
  queueState.snapshot.current = queueState.snapshot.success + queueState.snapshot.failed + queueState.snapshot.skipped
  queueState.snapshot.updatedAt = new Date().toISOString()

  broadcastScanEvent({
    channel: 'wp-rocket-cache-job',
    type: 'progress',
    message,
    data: {
      ...getWpRocketCacheQueueSnapshot(),
      job: job ? {
        siteId: job.installationId,
        siteTitle: job.siteTitle || job.installationId
      } : undefined
    }
  })
}

function broadcastError(message: string, job?: WpRocketCacheQueueJob) {
  queueState.snapshot.current = queueState.snapshot.success + queueState.snapshot.failed + queueState.snapshot.skipped
  queueState.snapshot.updatedAt = new Date().toISOString()

  broadcastScanEvent({
    channel: 'wp-rocket-cache-job',
    type: 'error',
    message,
    data: {
      ...getWpRocketCacheQueueSnapshot(),
      job: job ? {
        siteId: job.installationId,
        siteTitle: job.siteTitle || job.installationId
      } : undefined
    }
  })
}

function createFreshSnapshot(): WpRocketCacheQueueSnapshot {
  return {
    runId: randomUUID(),
    total: 0,
    current: 0,
    queued: 0,
    running: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    isComplete: false,
    updatedAt: new Date().toISOString()
  }
}
