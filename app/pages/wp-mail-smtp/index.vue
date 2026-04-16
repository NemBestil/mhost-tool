<template>
  <NuxtLayout name="dashboard-page">
    <template #topbar-right>
      <UDropdownMenu v-if="featureEnabled" :items="scanMenuItems">
        <UButton
          icon="i-lucide-scan"
          label="Scan"
        />
      </UDropdownMenu>
    </template>

    <div class="flex-1 flex flex-col min-h-0">
      <UAlert
        v-if="setupStatus !== 'pending' && !featureEnabled"
        class="m-4"
        color="warning"
        variant="soft"
        title="WP Mail SMTP is disabled"
        description="Enable the WP Mail SMTP Pro feature on the Setup overview page before using this section."
      >
        <template #actions>
          <UButton to="/settings/main" size="xs" color="warning" variant="outline" label="Open Setup overview" />
        </template>
      </UAlert>

      <template v-else>
        <div class="flex items-center gap-2 px-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <!-- Desktop Filters -->
          <div class="hidden md:flex items-center gap-2 flex-1">
            <UInput
              v-model="search"
              icon="i-lucide-search"
              placeholder="Search sites..."
              class="max-w-sm"
            >
              <template v-if="search?.length" #trailing>
                <UButton
                  color="neutral"
                  variant="link"
                  icon="i-lucide-circle-x"
                  aria-label="Clear input"
                  class="cursor-pointer"
                  @click="search = ''"
                />
              </template>
            </UInput>
            <USelectMenu
              v-model="selectedServer"
              :items="serverOptions"
              value-attribute="value"
              placeholder="Filter by server"
              class="w-48"
              clear
            >
              <template #leading>
                <Icon name="lucide:server" class="size-4" />
              </template>
            </USelectMenu>
            <USelectMenu
              v-model="selectedInstallationState"
              :items="installationStateOptions"
              value-attribute="value"
              placeholder="Filter by installation"
              class="w-56"
              clear
            >
              <template #leading>
                <Icon name="lucide:filter" class="size-4" />
              </template>
            </USelectMenu>
            <UCheckbox
                v-model="showDevSites"
                label="Dev-sites"
                class="ml-2"
            />
          </div>

          <!-- Mobile Filters -->
          <div class="flex md:hidden items-center gap-2 w-full">
            <UDrawer v-model:open="isFilterDrawerOpen" title="Filters">
              <UButton
                icon="i-lucide-filter"
                color="neutral"
                variant="outline"
                label="Filter"
                class="flex-1"
                :badge="activeFilterCount > 0 ? activeFilterCount : undefined"
              />

              <template #body>
                <div class="flex flex-col gap-6 p-4">
                  <UFormField label="Search">
                    <UInput
                      v-model="search"
                      icon="i-lucide-search"
                      placeholder="Search sites..."
                      class="w-full"
                      size="xl"
                    >
                      <template v-if="search?.length" #trailing>
                        <UButton
                          color="neutral"
                          variant="link"
                          icon="i-lucide-circle-x"
                          class="cursor-pointer"
                          @click="search = ''"
                        />
                      </template>
                    </UInput>
                  </UFormField>

                  <UFormField label="Server">
                    <USelectMenu
                      v-model="selectedServer"
                      :items="serverOptions"
                      value-attribute="value"
                      placeholder="All servers"
                      class="w-full"
                      size="xl"
                      clear
                    >
                      <template #leading>
                        <Icon name="lucide:server" class="size-4" />
                      </template>
                    </USelectMenu>
                  </UFormField>

                  <UFormField label="Installation">
                    <USelectMenu
                      v-model="selectedInstallationState"
                      :items="installationStateOptions"
                      value-attribute="value"
                      placeholder="All states"
                      class="w-full"
                      size="xl"
                      clear
                    >
                      <template #leading>
                        <Icon name="lucide:filter" class="size-4" />
                      </template>
                    </USelectMenu>
                  </UFormField>

                  <UCheckbox
                      v-model="showDevSites"
                      label="Dev-sites"
                      size="lg"
                  />
                </div>
              </template>

              <template #footer>
                <div class="flex flex-col gap-2 w-full">
                  <UButton
                    :disabled="activeFilterCount === 0"
                    label="Clear filters"
                    color="neutral"
                    variant="subtle"
                    block
                    @click="clearFilters"
                  />
                  <UButton
                    label="Close"
                    color="neutral"
                    variant="outline"
                    block
                    @click="isFilterDrawerOpen = false"
                  />
                </div>
              </template>
            </UDrawer>
          </div>
        </div>

        <UTable
          :data="filteredSites"
          :columns="columns"
          :loading="status === 'pending'"
          class="flex-1"
          virtualize
        >
          <template #siteTitle-cell="{ row }">
            <div class="flex flex-col">
              <div class="flex items-center gap-2">
                <UButton
                  variant="ghost"
                  color="neutral"
                  class="px-0"
                  @click="openDetailsModal(row.original)"
                  v-html="decodeEntities(row.original.siteTitle)"
                />
                <UTooltip :text="isDevSite(row.original.siteUrl) ? 'Development Site' : 'Production Site'">
                  <UBadge
                    :color="isDevSite(row.original.siteUrl) ? 'warning' : 'info'"
                    variant="subtle"
                    class="text-base px-1"
                  >
                    <Icon :name="isDevSite(row.original.siteUrl) ? 'lucide:flask-conical' : 'lucide:flask-conical-off'" class="size-4" />
                  </UBadge>
                </UTooltip>
              </div>
              <a :href="row.original.siteUrl" target="_blank" class="text-xs text-primary hover:underline">
                {{ row.original.siteUrl }}
              </a>
            </div>
          </template>

          <template #configuration-cell="{ row }">
            <div class="flex flex-col gap-1">
              <div class="flex items-center gap-3 text-neutral-500">
                <Icon
                  v-if="getConfigurationProviderIcon(row.original)"
                  :name="getConfigurationProviderIcon(row.original)!"
                  class="size-6 text-2xl"
                />
                <span>{{ getConfigurationSummary(row.original) }}</span>
              </div>
            </div>
          </template>

          <template #verification-cell="{ row }">
            <div class="flex flex-wrap gap-2">
              <UBadge
                :color="row.original.wpMailSmtp?.pluginInstalled ? 'success' : 'neutral'"
                variant="soft"
              >
                {{ row.original.wpMailSmtp?.pluginInstalled ? 'Plugin installed' : 'Not installed' }}
              </UBadge>

              <UBadge
                v-if="row.original.wpMailSmtp?.provider === 'amazonses'"
                :color="getCredentialsBadgeColor(row.original)"
                variant="soft"
              >
                {{ getCredentialsBadgeLabel(row.original) }}
              </UBadge>

              <UBadge
                v-if="row.original.wpMailSmtp?.provider === 'amazonses'"
                :color="getDnsBadgeColor(row.original)"
                variant="soft"
              >
                {{ getDnsBadgeLabel(row.original) }}
              </UBadge>
            </div>
          </template>

          <template #actions-cell="{ row }">
            <div class="flex items-center justify-end gap-2">
              <UButton
                icon="i-lucide-eye"
                color="neutral"
                variant="outline"
                size="xl"
                class="cursor-pointer"
                @click="openDetailsModal(row.original)"
              />
            </div>
          </template>
        </UTable>

        <UModal v-model:open="detailsModalOpen" :title="detailsModalTitle" :ui="{ content: 'sm:max-w-4xl' }">
          <template #body>
            <div v-if="selectedSite" class="space-y-6">
              <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <UCard
                  v-for="section in detailsSections"
                  :key="section.title"
                >
                  <template #header>
                    <h4 class="font-medium">{{ section.title }}</h4>
                  </template>

                  <dl class="space-y-3">
                    <div
                      v-for="item in section.items"
                      :key="item.label"
                      class="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                    >
                      <dt class="text-sm text-neutral-500">{{ item.label }}</dt>
                      <dd class="text-sm text-neutral-900 dark:text-neutral-100 break-all text-left sm:text-right">
                        <UBadge
                          v-if="item.kind === 'badge'"
                          v-bind="getDetailBadgeProps(item)"
                        />
                        <template v-else>
                          {{ item.value }}
                        </template>
                      </dd>
                    </div>
                  </dl>
                </UCard>
              </div>
            </div>
          </template>
        </UModal>
      </template>
    </div>
  </NuxtLayout>
</template>

<script lang="ts" setup>
import { h } from 'vue'
import { UButton } from '#components'
import type { TableColumn } from '@nuxt/ui'
import { useQuery } from '@tanstack/vue-query'
import type { TypedInternalResponse } from 'nitropack'
import { refDebounced } from '@vueuse/core'
import type { WpMailSmtpListItem } from '~/utils/wpMailSmtp'

definePageMeta({
  title: 'WP Mail SMTP'
})

const scanStore = useScanStore()
const { data: setupSettings, status: setupStatus } = useSetupSettingsQuery()

type WpMailSmtpListResponse = TypedInternalResponse<'/api/wp-mail-smtp/list', unknown, 'get'>
type ServerList = TypedInternalResponse<'/api/servers/list', unknown, 'get'>
type DetailBadgeItem = {
  label: string
  value: string
  kind: 'badge'
  color: 'success' | 'error'
  icon: string
}
type DetailTextItem = {
  label: string
  value: string
  kind?: 'text'
}
type DetailItem = DetailBadgeItem | DetailTextItem
type DetailSection = {
  title: string
  items: DetailItem[]
}

const { data: sites, status, refetch } = useQuery<WpMailSmtpListResponse>({
  queryKey: ['wp-mail-smtp-list'],
  queryFn: () => useApiClient()('/wp-mail-smtp/list')
})
const { data: servers } = useQuery<ServerList>({
  queryKey: ['servers-list'],
  queryFn: () => useApiClient()('/servers/list')
})

const featureEnabled = computed(() => setupSettings.value?.features.wpMailSmtpPro ?? false)
const search = ref('')
const searchThrottled = refDebounced(search, 500)
const selectedServer = ref<{ label: string, value: string }>()
const selectedInstallationState = ref<{ label: string, value: InstallationStateFilter }>()
const showDevSites = ref(true)
const isFilterDrawerOpen = ref(false)

const activeFilterCount = computed(() => {
  let count = 0
  if (search.value.trim()) count++
  if (selectedServer.value) count++
  if (selectedInstallationState.value) count++
  if (!showDevSites.value) count++
  return count
})

const clearFilters = () => {
  search.value = ''
  selectedServer.value = undefined
  selectedInstallationState.value = undefined
  showDevSites.value = true
}

const isDevSite = (siteUrl: string) => {
  if (!setupSettings.value?.developmentSites) return false
  const patterns = setupSettings.value.developmentSites.split(/\s+/).filter(Boolean)
  return patterns.some(p => siteUrl.toLowerCase().includes(p.toLowerCase()))
}
const detailsModalOpen = ref(false)
const selectedSite = ref<WpMailSmtpListItem | null>(null)
const serverOptions = computed(() => {
  const options = []
  if (servers.value) {
    options.push(...servers.value.map((server) => ({ label: server.name, value: server.id })))
  }
  return options
})
type InstallationStateFilter = 'not_installed' | 'installed_aws' | 'installed_other'

const installationStateOptions = [
  { label: 'Not installed', value: 'not_installed' as const },
  { label: 'Installed: AWS', value: 'installed_aws' as const },
  { label: 'Installed: Other provider', value: 'installed_other' as const }
]

const filteredSites = computed(() => {
  let result = sites.value || []

  if (selectedServer.value) {
    result = result.filter((site) => site.serverId === selectedServer.value!.value)
  }

  if (selectedInstallationState.value) {
    result = result.filter((site) => matchesInstallationStateFilter(site, selectedInstallationState.value!.value))
  }

  if (searchThrottled.value) {
    const query = searchThrottled.value.toLowerCase()
    result = result.filter((site) =>
      site.siteTitle.toLowerCase().includes(query) ||
      site.siteUrl.toLowerCase().includes(query) ||
      getConfigurationSummary(site).toLowerCase().includes(query) ||
      (site.configuration?.name.toLowerCase().includes(query) ?? false)
    )
  }

  if (!showDevSites.value) {
    result = result.filter((site) => !isDevSite(site.siteUrl))
  }

  return result
})

const createSortableColumn = (accessorKey: string, label: string, sortingFn?: any): TableColumn<WpMailSmtpListItem> => {
  const column: TableColumn<WpMailSmtpListItem> = {
    accessorKey,
    header: ({ column }) => {
      const isSorted = column.getIsSorted()

      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label,
        icon: isSorted
          ? (isSorted === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow')
          : 'i-lucide-arrow-up-down',
        class: '-mx-2.5 -my-2.5',
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
      })
    }
  }

  if (sortingFn) {
    column.sortingFn = sortingFn
  }

  return column
}

const columns: TableColumn<WpMailSmtpListItem>[] = [
  createSortableColumn('siteTitle', 'Site'),
  createSortableColumn('configuration', 'Configuration', (rowA: any, rowB: any) => {
    return (rowA.original.configuration?.name || '').localeCompare(rowB.original.configuration?.name || '')
  }),
  createSortableColumn('verification', 'Verification', (rowA: any, rowB: any) => {
    return Number(Boolean(rowA.original.wpMailSmtp?.pluginInstalled)) - Number(Boolean(rowB.original.wpMailSmtp?.pluginInstalled))
  }),
  {
    id: 'actions',
    header: '',
    size: 0,
    meta: { class: { td: 'w-2' } }
  }
]

const scanMenuItems = computed(() => {
  if (!servers.value || servers.value.length === 0) {
    return [[{ label: 'No servers available', disabled: true }]]
  }

  return [
    servers.value.map((server) => ({
      label: server.name,
      icon: 'i-lucide-server',
      disabled: scanStore.isServerScanning(server.id),
      onSelect: () => startScan(server.id)
    }))
  ]
})

const startScan = (serverId: string) => {
  scanStore.startScan(serverId, () => {
    void refetch()
  })
}

const openDetailsModal = (site: WpMailSmtpListItem) => {
  selectedSite.value = site
  detailsModalOpen.value = true
}

const decodeEntities = (text: string) => {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = text
  return textarea.value
}

const detailsModalTitle = computed(() => {
  if (!selectedSite.value) {
    return 'Installation details'
  }

  return decodeEntities(selectedSite.value.siteTitle)
})

const detailsSections = computed(() => {
  const site = selectedSite.value
  if (!site) {
    return []
  }

  const provider = site.wpMailSmtp?.provider
  const mailSettings: DetailItem[] = [
    { label: 'From email', value: site.wpMailSmtp?.fromEmail || 'Not set' },
    { label: 'From name', value: site.wpMailSmtp?.fromName || 'Not set' }
  ]

  if (provider === 'smtp') {
    mailSettings.push(
      { label: 'SMTP host', value: site.wpMailSmtp?.smtpHost || 'Not set' },
      { label: 'SMTP encryption', value: site.wpMailSmtp?.smtpEncryption || 'Not set' },
      { label: 'SMTP port', value: formatNullableNumber(site.wpMailSmtp?.smtpPort) },
      { label: 'SMTP auth', value: formatBoolean(site.wpMailSmtp?.smtpAuthentication) },
      { label: 'SMTP username', value: site.wpMailSmtp?.smtpUsername || 'Not set' }
    )
  }

  if (provider === 'amazonses') {
    mailSettings.push(
      { label: 'AWS access key ID', value: site.wpMailSmtp?.amazonSesAccessKeyId || 'Not set' },
      { label: 'AWS region', value: site.wpMailSmtp?.amazonSesRegion || 'Not set' }
    )
  }

  const verificationItems: DetailItem[] = []

  if (provider === 'amazonses') {
    verificationItems.push(
      getPositiveBadgeItem('SES credentials valid', site.wpMailSmtp?.amazonSesCredentialsValid === true, site.wpMailSmtp?.amazonSesCredentialsValid === true ? 'Valid' : 'Invalid'),
      getPositiveBadgeItem('SES DNS verified', site.wpMailSmtp?.amazonSesDnsVerified === true, site.wpMailSmtp?.amazonSesDnsVerified === true ? 'Verified' : 'Not verified'),
      { label: 'SES identity', value: site.wpMailSmtp?.amazonSesIdentity || 'Not set' },
      getPositiveBadgeItem(
        'SES identity status',
        isPositiveSesIdentityStatus(site.wpMailSmtp?.amazonSesIdentityStatus),
        site.wpMailSmtp?.amazonSesIdentityStatus || 'Unknown'
      ),
      getPositiveBadgeItem(
        'SES error',
        !site.wpMailSmtp?.amazonSesErrorMessage,
        site.wpMailSmtp?.amazonSesErrorMessage || 'None'
      ),
      { label: 'SES last checked', value: formatDateTime(site.wpMailSmtp?.amazonSesLastCheckedAt) }
    )
  }

  verificationItems.push(
    { label: 'Log emails', value: formatBoolean(site.wpMailSmtp?.logEmails) },
    { label: 'Log retention', value: formatLogRetention(site.wpMailSmtp?.logRetentionPeriod) },
    { label: 'Log email content', value: formatBoolean(site.wpMailSmtp?.logEmailContent) },
    { label: 'Hide announcements', value: formatBoolean(site.wpMailSmtp?.hideAnnouncements) },
    { label: 'Disable email summaries', value: formatBoolean(site.wpMailSmtp?.disableEmailSummaries) },
    { label: 'Record updated', value: formatDateTime(site.wpMailSmtp?.updatedAt) }
  )

  return [
    {
      title: 'Installation',
      items: [
        { label: 'Site title', value: decodeEntities(site.siteTitle) },
        { label: 'URL', value: site.siteUrl },
        { label: 'Server', value: site.server.name },
        { label: 'Provider', value: getProviderDetail(site) }
      ]
    },
    {
      title: 'Plugin',
      items: [
        { label: 'Installed', value: formatBoolean(site.wpMailSmtp?.pluginInstalled) },
        { label: 'Active', value: formatBoolean(site.wpMailSmtp?.pluginIsActive) },
        { label: 'Plugin slug', value: site.wpMailSmtp?.pluginSlug || 'Unknown' },
        { label: 'Plugin version', value: site.wpMailSmtp?.pluginVersion || 'Unknown' }
      ]
    },
    {
      title: 'Mail settings',
      items: mailSettings
    },
    {
      title: 'Verification and behavior',
      items: verificationItems
    }
  ] satisfies DetailSection[]
})

const getConfigurationSummary = (site: WpMailSmtpListItem) => {
  if (!site.wpMailSmtp?.provider) {
    return 'Plugin not configured'
  }

  if (site.wpMailSmtp.provider === 'smtp') {
    const host = site.wpMailSmtp.smtpHost || 'No host'
    const port = site.wpMailSmtp.smtpPort || '?'
    return `${host}:${port}`
  }

  if (site.wpMailSmtp.provider === 'amazonses') {
    return site.wpMailSmtp.amazonSesRegion || 'No region'
  }

  if (site.wpMailSmtp.provider === 'mail') {
    return 'PHP mail()'
  }

  return site.wpMailSmtp.provider
}

const matchesInstallationStateFilter = (site: WpMailSmtpListItem, filter: InstallationStateFilter) => {
  if (filter === 'not_installed') {
    return !site.wpMailSmtp?.pluginInstalled
  }

  if (!site.wpMailSmtp?.pluginInstalled) {
    return false
  }

  if (filter === 'installed_aws') {
    return site.wpMailSmtp.provider === 'amazonses'
  }

  return site.wpMailSmtp.provider !== 'amazonses'
}

const getProviderDetail = (site: WpMailSmtpListItem) => {
  if (!site.wpMailSmtp?.provider) {
    return 'Not configured'
  }

  if (site.wpMailSmtp.provider === 'smtp') {
    const host = site.wpMailSmtp.smtpHost || 'No host'
    const port = site.wpMailSmtp.smtpPort || '?'
    return `Other SMTP (${host}:${port})`
  }

  if (site.wpMailSmtp.provider === 'amazonses') {
    return `Amazon SES (${site.wpMailSmtp.amazonSesRegion || 'No region'})`
  }

  if (site.wpMailSmtp.provider === 'mail') {
    return 'PHP mail()'
  }

  return site.wpMailSmtp.provider
}

const getConfigurationProviderIcon = (site: WpMailSmtpListItem) => {
  if (site.wpMailSmtp?.provider === 'amazonses') {
    return 'fa7-brands:aws'
  }

  if (site.wpMailSmtp?.provider === 'smtp') {
    return 'lucide:server'
  }

  return null
}

const getDnsBadgeColor = (site: WpMailSmtpListItem) => {
  const value = site.wpMailSmtp?.amazonSesDnsVerified

  if (value === true) {
    return 'success'
  }

  if (value === false) {
    return 'warning'
  }

  return 'neutral'
}

const getDnsBadgeLabel = (site: WpMailSmtpListItem) => {
  const value = site.wpMailSmtp?.amazonSesDnsVerified

  if (value === true) {
    return 'DNS verified'
  }

  if (value === false) {
    return 'DNS not verified'
  }

  return 'DNS unknown'
}

const getCredentialsBadgeColor = (site: WpMailSmtpListItem) => {
  const value = site.wpMailSmtp?.amazonSesCredentialsValid

  if (value === true) {
    return 'success'
  }

  if (value === false) {
    return 'error'
  }

  return 'neutral'
}

const getCredentialsBadgeLabel = (site: WpMailSmtpListItem) => {
  const value = site.wpMailSmtp?.amazonSesCredentialsValid

  if (value === true) {
    return 'Credentials valid'
  }

  if (value === false) {
    return 'Credentials invalid'
  }

  return 'Credentials unknown'
}

const formatBoolean = (value: boolean | null | undefined) => {
  if (value === true) {
    return 'Yes'
  }

  if (value === false) {
    return 'No'
  }

  return 'Unknown'
}

const getPositiveBadgeItem = (label: string, isPositive: boolean, value: string): DetailBadgeItem => {
  return {
    label,
    value,
    kind: 'badge',
    color: isPositive ? 'success' : 'error',
    icon: isPositive ? 'i-lucide-check' : 'i-lucide-x'
  }
}

const getDetailBadgeProps = (item: DetailBadgeItem) => {
  return {
    color: item.color,
    variant: 'outline',
    icon: item.icon,
    label: item.value
  } as any
}

const isPositiveSesIdentityStatus = (value: string | null | undefined) => {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === 'verified' || normalized === 'success'
}

const formatNullableNumber = (value: number | null | undefined) => {
  if (typeof value === 'number') {
    return String(value)
  }

  return 'Not set'
}

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return 'Unknown'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}

const formatLogRetention = (value: string | null | undefined) => {
  if (value === '') {
    return 'Forever'
  }

  if (value === '86400') {
    return '1 Day'
  }

  if (value === '604800') {
    return '1 Week'
  }

  if (value === '2628000') {
    return '1 Month'
  }

  if (value === '15770000') {
    return '6 Months'
  }

  if (value === '31540000') {
    return '1 Year'
  }

  return 'Not set'
}
</script>
