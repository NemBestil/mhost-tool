import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { prisma } from '#server/utils/db'
import { compareVersions } from '#server/utils/uploadedPackages'
import { execSshCommandByServerId, uploadFileToServerByServerId } from '#server/utils/ssh'
import { detectPhpBinary } from '#server/utils/phpBinary'

export type SitePackageKind = 'plugin' | 'theme'
export type SitePackageOperation = 'update' | 'install' | 'activate' | 'deactivate' | 'delete'
export type PackageSource = 'wordpress.org' | 'external'

export type SitePackageOperationInput = {
  installationId: string
  kind: SitePackageKind
  slug: string
  operation: SitePackageOperation
  source?: PackageSource
}

export type SitePackageOperationResult = {
  status: 'success' | 'failed' | 'skipped'
  message: string
}

type InstallationContext = {
  id: string
  serverId: string
  unixUsername: string
  installationPath: string
}

type ExternalAsset = {
  assetKey: string
  localPath: string
  remotePath: string
  version: string
}

const ensuredWpCliServers = new Set<string>()
const wpCliEnsureInFlight = new Map<string, Promise<void>>()

const uploadedAssetsByServer = new Map<string, Set<string>>()
const uploadInFlightByServer = new Map<string, Map<string, Promise<string>>>()

export async function executeSitePackageOperation(input: SitePackageOperationInput): Promise<SitePackageOperationResult> {
  const installation = await prisma.wordPressInstallation.findUnique({
    where: { id: input.installationId },
    select: {
      id: true,
      serverId: true,
      unixUsername: true,
      installationPath: true
    }
  })

  if (!installation) {
    return {
      status: 'failed',
      message: `Site not found: ${input.installationId}`
    }
  }

  await ensureWpCliOnServer(installation.serverId)

  if (input.operation === 'update' || input.operation === 'install') {
    return await handleUpdateOrInstall(installation, input)
  }

  if (input.operation === 'activate') {
    return await handleActivate(installation, input.kind, input.slug)
  }

  if (input.operation === 'deactivate') {
    return await handleDeactivate(installation, input.kind, input.slug)
  }

  return await handleDelete(installation, input.kind, input.slug)
}

async function handleActivate(
  installation: InstallationContext,
  kind: SitePackageKind,
  slug: string
): Promise<SitePackageOperationResult> {
  if (kind === 'plugin') {
    const existing = await prisma.wordPressPlugin.findUnique({
      where: {
        installationId_slug: {
          installationId: installation.id,
          slug
        }
      },
      select: {
        isEnabled: true,
        source: true,
        latestVersion: true
      }
    })

    if (!existing) {
      return {
        status: 'skipped',
        message: `Plugin "${slug}" is not installed on this site`
      }
    }

    if (existing.isEnabled) {
      return {
        status: 'skipped',
        message: `Plugin "${slug}" is already active`
      }
    }

    await runWpCliCommand(installation, ['plugin', 'activate', slug])
    await syncPluginState(installation, slug, normalizeSource(existing.source), existing.latestVersion ?? null)

    return {
      status: 'success',
      message: `Plugin "${slug}" activated`
    }
  }

  const existingTheme = await prisma.wordPressTheme.findUnique({
    where: {
      installationId_slug: {
        installationId: installation.id,
        slug
      }
    },
    select: {
      isEnabled: true,
      source: true,
      latestVersion: true
    }
  })

  if (!existingTheme) {
    return {
      status: 'skipped',
      message: `Theme "${slug}" is not installed on this site`
    }
  }

  if (existingTheme.isEnabled) {
    return {
      status: 'skipped',
      message: `Theme "${slug}" is already active`
    }
  }

  const previousActive = await getActiveThemeSlug(installation)
  await runWpCliCommand(installation, ['theme', 'activate', slug])
  await syncThemeState(installation, slug, normalizeSource(existingTheme.source), existingTheme.latestVersion ?? null)
  if (previousActive && previousActive !== slug) {
    await syncThemeState(installation, previousActive, 'wordpress.org', null)
  }

  return {
    status: 'success',
    message: `Theme "${slug}" activated`
  }
}

async function handleUpdateOrInstall(
  installation: InstallationContext,
  input: SitePackageOperationInput
): Promise<SitePackageOperationResult> {
  const existing = await findInstalledPackage(installation.id, input.kind, input.slug)
  const source = input.source ?? normalizeSource(existing?.source)
  const wpKind = input.kind === 'plugin' ? 'plugin' : 'theme'
  const wasActive = Boolean(existing?.isEnabled)

  if (input.operation === 'update' && !existing) {
    return {
      status: 'skipped',
      message: `${wpKind} "${input.slug}" is not installed on this site`
    }
  }

  let latestVersionHint: string | null = existing?.latestVersion ?? null

  if (source === 'external') {
    const externalAsset = await resolveExternalAsset(input.kind, input.slug)
    latestVersionHint = externalAsset.version

    if (input.operation === 'update' && existing && compareVersions(externalAsset.version, existing.version) <= 0) {
      return {
        status: 'skipped',
        message: `${wpKind} "${input.slug}" is already up to date`
      }
    }

    const remoteAssetPath = await ensureExternalAssetOnServer(installation.serverId, externalAsset)
    await runWpCliCommand(installation, [wpKind, 'install', remoteAssetPath, '--force'])
  } else {
    if (input.operation === 'update' && existing?.latestVersion && compareVersions(existing.latestVersion, existing.version) <= 0) {
      return {
        status: 'skipped',
        message: `${wpKind} "${input.slug}" is already up to date`
      }
    }

    if (input.operation === 'update') {
      await runWpCliCommand(installation, [wpKind, 'update', input.slug])
    } else {
      await runWpCliCommand(installation, [wpKind, 'install', input.slug, '--force'])
    }
  }

  if (input.operation === 'update') {
    await restoreActivationState(installation, input.kind, input.slug, wasActive)
  }

  if (input.kind === 'plugin') {
    await syncPluginState(installation, input.slug, source, latestVersionHint)
  } else {
    await syncThemeState(installation, input.slug, source, latestVersionHint)
  }

  return {
    status: 'success',
    message: `${capitalize(wpKind)} "${input.slug}" ${input.operation === 'install' ? 'installed' : 'updated'}`
  }
}

async function handleDeactivate(
  installation: InstallationContext,
  kind: SitePackageKind,
  slug: string
): Promise<SitePackageOperationResult> {
  if (kind === 'plugin') {
    const existing = await prisma.wordPressPlugin.findUnique({
      where: {
        installationId_slug: {
          installationId: installation.id,
          slug
        }
      },
      select: {
        isEnabled: true,
        source: true,
        latestVersion: true
      }
    })

    if (!existing) {
      return {
        status: 'skipped',
        message: `Plugin "${slug}" is not installed on this site`
      }
    }

    if (!existing.isEnabled) {
      return {
        status: 'skipped',
        message: `Plugin "${slug}" is already inactive`
      }
    }

    await runWpCliCommand(installation, ['plugin', 'deactivate', slug])
    await syncPluginState(installation, slug, normalizeSource(existing.source), existing.latestVersion ?? null)

    return {
      status: 'success',
      message: `Plugin "${slug}" deactivated`
    }
  }

  const existingTheme = await prisma.wordPressTheme.findUnique({
    where: {
      installationId_slug: {
        installationId: installation.id,
        slug
      }
    },
    select: {
      isEnabled: true,
      source: true,
      latestVersion: true
    }
  })

  if (!existingTheme) {
    return {
      status: 'skipped',
      message: `Theme "${slug}" is not installed on this site`
    }
  }

  if (!existingTheme.isEnabled) {
    return {
      status: 'skipped',
      message: `Theme "${slug}" is already inactive`
    }
  }

  const fallback = await switchActiveThemeAwayFrom(installation, slug)
  await syncThemeState(installation, slug, normalizeSource(existingTheme.source), existingTheme.latestVersion ?? null)
  await syncThemeState(installation, fallback, 'wordpress.org', null)

  return {
    status: 'success',
    message: `Theme "${slug}" deactivated`
  }
}

async function handleDelete(
  installation: InstallationContext,
  kind: SitePackageKind,
  slug: string
): Promise<SitePackageOperationResult> {
  if (kind === 'plugin') {
    const existing = await prisma.wordPressPlugin.findUnique({
      where: {
        installationId_slug: {
          installationId: installation.id,
          slug
        }
      },
      select: {
        isEnabled: true
      }
    })

    if (existing?.isEnabled) {
      await runWpCliCommand(installation, ['plugin', 'deactivate', slug], { allowFailure: true })
    }

    const deleteResult = await runWpCliCommand(installation, ['plugin', 'delete', slug], { allowFailure: true })
    if (deleteResult.code !== 0 && !isMissingPackageError(deleteResult.stderr)) {
      return {
        status: 'failed',
        message: `Failed to delete plugin "${slug}": ${trimError(deleteResult.stderr)}`
      }
    }

    await prisma.wordPressPlugin.deleteMany({
      where: {
        installationId: installation.id,
        slug
      }
    })

    return {
      status: 'success',
      message: `Plugin "${slug}" deleted`
    }
  }

  const existingTheme = await prisma.wordPressTheme.findUnique({
    where: {
      installationId_slug: {
        installationId: installation.id,
        slug
      }
    },
    select: {
      isEnabled: true
    }
  })

  let fallbackTheme: string | null = null
  if (existingTheme?.isEnabled) {
    fallbackTheme = await switchActiveThemeAwayFrom(installation, slug)
  }

  const deleteResult = await runWpCliCommand(installation, ['theme', 'delete', slug], { allowFailure: true })
  if (deleteResult.code !== 0 && !isMissingPackageError(deleteResult.stderr)) {
    return {
      status: 'failed',
      message: `Failed to delete theme "${slug}": ${trimError(deleteResult.stderr)}`
    }
  }

  await prisma.wordPressTheme.deleteMany({
    where: {
      installationId: installation.id,
      slug
    }
  })

  if (fallbackTheme) {
    await syncThemeState(installation, fallbackTheme, 'wordpress.org', null)
  }

  return {
    status: 'success',
    message: `Theme "${slug}" deleted`
  }
}

async function restoreActivationState(
  installation: InstallationContext,
  kind: SitePackageKind,
  slug: string,
  wasActive: boolean
) {
  if (kind === 'plugin') {
    await runWpCliCommand(
      installation,
      wasActive ? ['plugin', 'activate', slug] : ['plugin', 'deactivate', slug],
      { allowFailure: true }
    )
    return
  }

  if (wasActive) {
    await runWpCliCommand(installation, ['theme', 'activate', slug], { allowFailure: true })
  }
}

async function switchActiveThemeAwayFrom(installation: InstallationContext, slug: string): Promise<string> {
  const themes = await getThemeList(installation)
  const activeTheme = themes.find(theme => theme.status === 'active')

  if (!activeTheme || activeTheme.name !== slug) {
    return activeTheme?.name || slug
  }

  const fallback = themes.find(theme => theme.name !== slug)
  if (!fallback) {
    throw new Error(`Unable to deactivate active theme "${slug}" because no fallback theme is installed`)
  }

  await runWpCliCommand(installation, ['theme', 'activate', fallback.name])
  return fallback.name
}

async function getActiveThemeSlug(installation: InstallationContext): Promise<string | null> {
  const themes = await getThemeList(installation)
  return themes.find(theme => theme.status === 'active')?.name || null
}

async function getThemeList(installation: InstallationContext): Promise<Array<{ name: string, status: string }>> {
  const themesResult = await runWpCliCommand(
    installation,
    ['theme', 'list', '--format=json', '--fields=name,status'],
    { allowFailure: true }
  )

  return parseJsonArray<{ name: string, status: string }>(themesResult.stdout)
}

async function syncPluginState(
  installation: InstallationContext,
  slug: string,
  source: PackageSource,
  latestVersionHint: string | null
) {
  const existing = await prisma.wordPressPlugin.findUnique({
    where: {
      installationId_slug: {
        installationId: installation.id,
        slug
      }
    },
    select: {
      latestVersion: true,
      mainFilePath: true,
      autoUpdate: true
    }
  })

  const result = await runWpCliCommand(
    installation,
    ['plugin', 'get', slug, '--format=json', '--fields=name,title,status,version'],
    { allowFailure: true }
  )

  if (result.code !== 0 || !result.stdout.trim()) {
    await prisma.wordPressPlugin.deleteMany({
      where: {
        installationId: installation.id,
        slug
      }
    })
    return
  }

  const details = parseJson<{ name?: string, title?: string, status?: string, version?: string }>(result.stdout)

  await prisma.wordPressPlugin.upsert({
    where: {
      installationId_slug: {
        installationId: installation.id,
        slug
      }
    },
    update: {
      name: details?.name || slug,
      title: details?.title || details?.name || slug,
      version: details?.version || '',
      isEnabled: details?.status === 'active',
      autoUpdate: existing?.autoUpdate ?? false,
      source,
      latestVersion: latestVersionHint || existing?.latestVersion || null
    },
    create: {
      installationId: installation.id,
      name: details?.name || slug,
      title: details?.title || details?.name || slug,
      slug,
      version: details?.version || '',
      isEnabled: details?.status === 'active',
      autoUpdate: existing?.autoUpdate ?? false,
      source,
      latestVersion: latestVersionHint || null,
      mainFilePath: existing?.mainFilePath || null
    }
  })
}

async function syncThemeState(
  installation: InstallationContext,
  slug: string,
  source: PackageSource,
  latestVersionHint: string | null
) {
  const existing = await prisma.wordPressTheme.findUnique({
    where: {
      installationId_slug: {
        installationId: installation.id,
        slug
      }
    },
    select: {
      latestVersion: true
    }
  })

  const detailsResult = await runWpCliCommand(
    installation,
    ['theme', 'get', slug, '--format=json', '--fields=name,title,status,version,auto_update'],
    { allowFailure: true }
  )

  if (detailsResult.code !== 0 || !detailsResult.stdout.trim()) {
    await prisma.wordPressTheme.deleteMany({
      where: {
        installationId: installation.id,
        slug
      }
    })
    return
  }

  const details = parseJson<{ name?: string, title?: string, status?: string, version?: string, auto_update?: string }>(detailsResult.stdout)
  const themeListResult = await runWpCliCommand(
    installation,
    ['theme', 'list', '--format=json', '--fields=name,status,parent'],
    { allowFailure: true }
  )
  const allThemes = parseJsonArray<{ name: string, status: string, parent?: string | null }>(themeListResult.stdout)
  const activeTheme = allThemes.find(theme => theme.status === 'active')
  const isActiveChild = Boolean(activeTheme?.parent && activeTheme.parent === slug)

  await prisma.wordPressTheme.upsert({
    where: {
      installationId_slug: {
        installationId: installation.id,
        slug
      }
    },
    update: {
      name: details?.name || slug,
      title: details?.title || details?.name || slug,
      version: details?.version || '',
      isEnabled: details?.status === 'active',
      autoUpdate: details?.auto_update === 'on',
      isActiveChild,
      source,
      latestVersion: latestVersionHint || existing?.latestVersion || null
    },
    create: {
      installationId: installation.id,
      name: details?.name || slug,
      title: details?.title || details?.name || slug,
      slug,
      version: details?.version || '',
      isEnabled: details?.status === 'active',
      autoUpdate: details?.auto_update === 'on',
      isActiveChild,
      source,
      latestVersion: latestVersionHint || null
    }
  })
}

async function resolveExternalAsset(kind: SitePackageKind, slug: string): Promise<ExternalAsset> {
  const packageRow = kind === 'plugin'
    ? await prisma.uploadedWordPressPlugin.findFirst({
      where: { slug, isLatest: true },
      select: { slug: true, version: true, archivePath: true }
    })
    : await prisma.uploadedWordPressTheme.findFirst({
      where: { slug, isLatest: true },
      select: { slug: true, version: true, archivePath: true }
    })

  if (!packageRow) {
    throw new Error(`No uploaded ${kind} version available for "${slug}"`)
  }

  const localPath = resolve(process.cwd(), packageRow.archivePath)
  await access(localPath)

  const safeVersion = packageRow.version.replace(/[^a-zA-Z0-9._-]/g, '-')
  const safeSlug = packageRow.slug.replace(/[^a-zA-Z0-9._-]/g, '-')
  const remoteDir = `/opt/mhost-cli/assets/${kind}s`
  const remotePath = `${remoteDir}/${safeSlug}-${safeVersion}.zip`

  return {
    assetKey: `${kind}:${packageRow.slug}:${packageRow.version}`,
    localPath,
    remotePath,
    version: packageRow.version
  }
}

async function ensureExternalAssetOnServer(serverId: string, asset: ExternalAsset): Promise<string> {
  const uploaded = uploadedAssetsByServer.get(serverId) || new Set<string>()
  uploadedAssetsByServer.set(serverId, uploaded)

  if (uploaded.has(asset.assetKey)) {
    return asset.remotePath
  }

  const serverInflight = uploadInFlightByServer.get(serverId) || new Map<string, Promise<string>>()
  uploadInFlightByServer.set(serverId, serverInflight)

  const existingPromise = serverInflight.get(asset.assetKey)
  if (existingPromise) {
    return await existingPromise
  }

  const uploadPromise = (async () => {
    await execSshCommandByServerId(serverId, `mkdir -p ${shellEscape('/opt/mhost-cli/assets')} ${shellEscape(`/opt/mhost-cli/assets/${asset.assetKey.startsWith('plugin:') ? 'plugins' : 'themes'}`)}`, { timeoutMs: 30_000 })

    const existsResult = await execSshCommandByServerId(
      serverId,
      `if [ -f ${shellEscape(asset.remotePath)} ]; then echo "1"; fi`,
      { timeoutMs: 30_000 }
    )

    if (!existsResult.stdout.trim()) {
      await uploadFileToServerByServerId(serverId, asset.localPath, asset.remotePath)
    }

    uploaded.add(asset.assetKey)
    return asset.remotePath
  })()

  serverInflight.set(asset.assetKey, uploadPromise)

  try {
    return await uploadPromise
  } finally {
    serverInflight.delete(asset.assetKey)
  }
}

async function ensureWpCliOnServer(serverId: string) {
  if (ensuredWpCliServers.has(serverId)) {
    return
  }

  const existing = wpCliEnsureInFlight.get(serverId)
  if (existing) {
    await existing
    return
  }

  const promise = (async () => {
    const ensureCmd = `
      mkdir -p /opt/mhost-cli && \
      if [ ! -f /opt/mhost-cli/wp-cli.phar ] || [ $(find /opt/mhost-cli/wp-cli.phar -mtime +14 2>/dev/null | wc -l) -gt 0 ]; then
        curl -sS -o /opt/mhost-cli/wp-cli.phar https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && \
        chmod +x /opt/mhost-cli/wp-cli.phar
      fi
    `.trim()

    const result = await execSshCommandByServerId(serverId, ensureCmd, { timeoutMs: 120_000 })
    if (result.code !== 0) {
      throw new Error(`Failed to ensure wp-cli is available: ${trimError(result.stderr || result.stdout)}`)
    }
    ensuredWpCliServers.add(serverId)
  })()

  wpCliEnsureInFlight.set(serverId, promise)

  try {
    await promise
  } finally {
    wpCliEnsureInFlight.delete(serverId)
  }
}

async function runWpCliCommand(
  installation: InstallationContext,
  args: string[],
  opts?: { allowFailure?: boolean, timeoutMs?: number }
) {
  const username = installation.unixUsername.trim()
  if (!/^[a-z_][a-z0-9\._-]*[$]?$/i.test(username)) {
    throw new Error(`Invalid unix username "${installation.unixUsername}"`)
  }

  const phpResult = await detectPhpBinary(installation.serverId)
  const cmd = [
    phpResult.binary,
    '/opt/mhost-cli/wp-cli.phar',
    ...args,
    '--skip-plugins',
    '--skip-themes'
  ].map(shellEscape).join(' ')

  const wrapped = `cd ${shellEscape(installation.installationPath)} && ${cmd}`
  const fullCommand = `su - ${username} -s /bin/bash -c ${shellEscape(wrapped)}`

  const result = await execSshCommandByServerId(
    installation.serverId,
    fullCommand,
    { timeoutMs: opts?.timeoutMs ?? 180_000 }
  )

  if (!opts?.allowFailure && result.code !== 0) {
    throw new Error(trimError(result.stderr || result.stdout))
  }

  return result
}

async function findInstalledPackage(installationId: string, kind: SitePackageKind, slug: string) {
  if (kind === 'plugin') {
    return await prisma.wordPressPlugin.findUnique({
      where: {
        installationId_slug: {
          installationId,
          slug
        }
      },
      select: {
        version: true,
        isEnabled: true,
        source: true,
        latestVersion: true
      }
    })
  }

  return await prisma.wordPressTheme.findUnique({
    where: {
      installationId_slug: {
        installationId,
        slug
      }
    },
    select: {
      version: true,
      isEnabled: true,
      source: true,
      latestVersion: true
    }
  })
}

function normalizeSource(source: string | null | undefined): PackageSource {
  return source === 'external' ? 'external' : 'wordpress.org'
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function parseJsonArray<T>(value: string): T[] {
  const parsed = parseJson<unknown>(value)
  return Array.isArray(parsed) ? parsed as T[] : []
}

function isMissingPackageError(stderr: string): boolean {
  const normalized = (stderr || '').toLowerCase()
  return normalized.includes('is not installed') || normalized.includes('not installed')
}

function trimError(message: string): string {
  return message.trim().split('\n').filter(Boolean)[0] || 'Unknown error'
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
