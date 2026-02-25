import {
  executeSitePackageOperation,
  type SitePackageKind
} from '#server/utils/sitePackageOperations'
import { isPackageSiteLocked } from '#server/utils/packageJobQueue'

type DirectOperation = 'activate' | 'deactivate' | 'delete'

type ActionInput = {
  installationId: string
  kind: SitePackageKind
  slug: string
  operation: DirectOperation
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const actions = normalizeActions(body?.actions)

  if (actions.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No valid package actions were provided'
    })
  }

  const results: Array<{
    installationId: string
    slug: string
    kind: SitePackageKind
    operation: DirectOperation
    status: 'success' | 'failed' | 'skipped'
    message: string
  }> = []

  for (const action of actions) {
    if (isPackageSiteLocked(action.installationId)) {
      results.push({
        ...action,
        status: 'failed',
        message: 'Site is currently busy with another package job'
      })
      continue
    }

    const result = await executeSitePackageOperation(action)
    results.push({
      ...action,
      status: result.status,
      message: result.message
    })
  }

  return {
    total: results.length,
    success: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'failed').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    results
  }
})

function normalizeActions(input: unknown): ActionInput[] {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .map((raw): ActionInput | null => {
      if (!raw || typeof raw !== 'object') {
        return null
      }

      const item = raw as Record<string, unknown>
      const installationId = typeof item.installationId === 'string' ? item.installationId : ''
      const slug = typeof item.slug === 'string' ? item.slug : ''
      const kind = item.kind === 'plugin' || item.kind === 'theme' ? item.kind : null
      const operation = item.operation === 'activate' || item.operation === 'deactivate' || item.operation === 'delete'
        ? item.operation
        : null

      if (!installationId || !slug || !kind || !operation) {
        return null
      }

      return {
        installationId,
        slug,
        kind,
        operation
      }
    })
    .filter((action): action is ActionInput => Boolean(action))
}
