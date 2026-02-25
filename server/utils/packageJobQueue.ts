import { randomUUID } from 'node:crypto'
import Queue from 'better-queue'
import { broadcastScanEvent } from '#server/utils/scanBroadcast'
import {
  executeSitePackageOperation,
  type PackageSource,
  type SitePackageKind,
  type SitePackageOperationResult
} from '#server/utils/sitePackageOperations'

export type PackageQueueOperation = 'update' | 'install'

export type PackageQueueJobInput = {
  installationId: string
  siteTitle?: string
  kind: SitePackageKind
  slug: string
  operation: PackageQueueOperation
  source?: PackageSource
}

type PackageQueueJob = PackageQueueJobInput & {
  jobId: string
  enqueuedAt: string
}

export type PackageQueueSnapshot = {
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
  queue: Queue<PackageQueueJob, SitePackageOperationResult>
  siteLocks: Set<string>
  runningTasks: Map<string, PackageQueueJob>
  snapshot: PackageQueueSnapshot
}

const globalQueueState = globalThis as typeof globalThis & {
  __mhostPackageQueueState?: QueueState
}

const queueState = globalQueueState.__mhostPackageQueueState ?? createQueueState()

if (!globalQueueState.__mhostPackageQueueState) {
  globalQueueState.__mhostPackageQueueState = queueState
}

export function enqueuePackageJobs(jobs: PackageQueueJobInput[]) {
  if (jobs.length === 0) {
    return {
      accepted: 0,
      runId: queueState.snapshot.runId,
      snapshot: getPackageQueueSnapshot()
    }
  }

  if (queueState.snapshot.isComplete || !queueState.snapshot.runId) {
    queueState.snapshot = createFreshSnapshot()
  }

  const queuedJobs: PackageQueueJob[] = jobs.map(job => ({
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

  broadcastProgress(`Queued ${queuedJobs.length} package job(s)`)

  return {
    accepted: queuedJobs.length,
    runId: queueState.snapshot.runId,
    snapshot: getPackageQueueSnapshot()
  }
}

export function getPackageQueueSnapshot(): PackageQueueSnapshot {
  return { ...queueState.snapshot }
}

export function isPackageSiteLocked(installationId: string): boolean {
  return queueState.siteLocks.has(installationId)
}

function createQueueState(): QueueState {
  const state: QueueState = {
    queue: createQueue(),
    siteLocks: new Set<string>(),
    runningTasks: new Map<string, PackageQueueJob>(),
    snapshot: createFreshSnapshot()
  }

  wireQueueEvents(state)
  return state
}

function createQueue() {
  return new Queue<PackageQueueJob, SitePackageOperationResult>((job, cb) => {
    executeSitePackageOperation(job)
      .then(result => cb(null, result))
      .catch((error: any) => {
        cb(null, {
          status: 'failed',
          message: error?.message || 'Unexpected package processing error'
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

    broadcastProgress(`Started ${task.operation} ${task.kind} "${task.slug}"`, task)
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
      broadcastProgress(result?.message || 'Package job completed', task)
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

    broadcastError(message || 'Package queue task failed', task)
  })

  state.queue.on('drain', () => {
    state.snapshot.running = 0
    state.snapshot.queued = 0
    state.snapshot.isComplete = true
    state.snapshot.updatedAt = new Date().toISOString()

    broadcastScanEvent({
      channel: 'package-job',
      type: 'complete',
      message: `Package queue complete: ${state.snapshot.success} success, ${state.snapshot.failed} failed, ${state.snapshot.skipped} skipped`,
      data: getPackageQueueSnapshot()
    })
  })
}

function moveFirstUnlockedTaskToFront(): boolean {
  const internalQueue = (queueState.queue as any)?._store?._queue as string[] | undefined
  const internalTasks = (queueState.queue as any)?._store?._tasks as Record<string, PackageQueueJob> | undefined

  if (!Array.isArray(internalQueue) || !internalTasks || internalQueue.length === 0) {
    return true
  }

  const unlockedIndex = internalQueue.findIndex((taskId) => {
    const task = internalTasks[taskId]
    return Boolean(task) && !queueState.siteLocks.has(task.installationId)
  })

  if (unlockedIndex < 0) {
    return false
  }

  if (unlockedIndex > 0) {
    const [taskId] = internalQueue.splice(unlockedIndex, 1)
    internalQueue.unshift(taskId)
  }

  return true
}

function broadcastProgress(message: string, job?: PackageQueueJob) {
  queueState.snapshot.current = queueState.snapshot.success + queueState.snapshot.failed + queueState.snapshot.skipped
  queueState.snapshot.updatedAt = new Date().toISOString()

  broadcastScanEvent({
    channel: 'package-job',
    type: 'progress',
    message,
    data: {
      ...getPackageQueueSnapshot(),
      job: job ? {
        siteId: job.installationId,
        siteTitle: job.siteTitle || job.installationId,
        kind: job.kind,
        slug: job.slug,
        operation: job.operation
      } : undefined
    }
  })
}

function broadcastError(message: string, job?: PackageQueueJob) {
  queueState.snapshot.current = queueState.snapshot.success + queueState.snapshot.failed + queueState.snapshot.skipped
  queueState.snapshot.updatedAt = new Date().toISOString()

  broadcastScanEvent({
    channel: 'package-job',
    type: 'error',
    message,
    data: {
      ...getPackageQueueSnapshot(),
      job: job ? {
        siteId: job.installationId,
        siteTitle: job.siteTitle || job.installationId,
        kind: job.kind,
        slug: job.slug,
        operation: job.operation
      } : undefined
    }
  })
}

function createFreshSnapshot(): PackageQueueSnapshot {
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
