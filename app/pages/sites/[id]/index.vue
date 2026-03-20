<template>
  <NuxtLayout name="dashboard-page">
    <template #topbar-left>
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          to="/sites"
        />
        <h1 class="text-lg font-semibold" v-html="decodeEntities(site?.siteTitle || 'Loading...')"></h1>
      </div>
    </template>
    <template #topbar-right>
      <UButton
        to="/sites"
        icon="lucide:arrow-left"
        variant="ghost"
        color="neutral"
        label="Back to list"
      />
    </template>

    <div v-if="status === 'pending'" class="flex-1 flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="animate-spin size-8 text-neutral-400" />
    </div>

    <div v-else-if="site" class="flex-1 flex flex-col min-h-0 gap-6 pb-4">
      <UCard :ui="{ body: 'p-4 sm:p-6' }" class="shrink-0">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div class="space-y-1">
            <span class="text-xs font-medium text-neutral-500 uppercase tracking-wider">Site URL</span>
            <div class="flex items-center gap-2">
              <a :href="site.siteUrl" target="_blank" class="text-primary hover:underline font-medium">
                {{ site.siteUrl }}
              </a>
              <UIcon name="i-lucide-external-link" class="size-3.5 text-neutral-400" />
            </div>
          </div>

          <div class="space-y-1">
            <span class="text-xs font-medium text-neutral-500 uppercase tracking-wider">Server</span>
            <div class="flex items-center gap-2 font-medium">
              <UIcon name="i-lucide-server" class="size-4 text-neutral-400" />
              {{ site.server.name }} ({{ site.server.hostname }})
            </div>
          </div>

          <div class="space-y-1">
            <span class="text-xs font-medium text-neutral-500 uppercase tracking-wider">Admin Email</span>
            <div class="space-y-1">
              <div class="flex items-center gap-1.5">
                <span class="font-medium">{{ site.adminEmail || 'N/A' }}</span>
                <UButton
                  icon="i-lucide-pencil"
                  variant="ghost"
                  color="neutral"
                  size="xs"
                  @click="openAdminEmailModal"
                />
              </div>
              <div v-if="site.adminEmailFromName" class="text-sm text-neutral-500">
                From: {{ site.adminEmailFromName }}
              </div>
            </div>
          </div>

          <div v-if="site.hasWooCommerce" class="space-y-1">
            <span class="text-xs font-medium text-neutral-500 uppercase tracking-wider">WooCommerce Email</span>
            <div class="space-y-1">
              <div class="flex items-center gap-1.5">
                <span class="font-medium">{{ site.wooCommerceEmail || 'N/A' }}</span>
                <UButton
                  icon="i-lucide-pencil"
                  variant="ghost"
                  color="neutral"
                  size="xs"
                  @click="openWooCommerceEmailModal"
                />
              </div>
              <div v-if="site.wooCommerceEmailFromName" class="text-sm text-neutral-500">
                From: {{ site.wooCommerceEmailFromName }}
              </div>
            </div>
          </div>

          <div class="space-y-1">
            <span class="text-xs font-medium text-neutral-500 uppercase tracking-wider">Timezone</span>
            <div class="font-medium">{{ site.timezone || 'N/A' }}</div>
          </div>

          <div class="space-y-1">
            <span class="text-xs font-medium text-neutral-500 uppercase tracking-wider">Last Scanned</span>
            <div class="font-medium">
              <span v-if="site.lastScanAt" :title="formatFullDate(site.lastScanAt)">
                {{ formatRelativeTime(site.lastScanAt) }}
              </span>
              <span v-else class="text-neutral-400">Never</span>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex items-center gap-4 text-sm">
            <div class="flex items-center gap-1.5">
              <UIcon
                :name="site.usesServerCron ? 'i-lucide-check-circle' : 'i-lucide-x-circle'"
                :class="site.usesServerCron ? 'text-success' : 'text-neutral-400'"
              />
              <span :class="site.usesServerCron ? 'text-neutral-900 dark:text-neutral-50' : 'text-neutral-500'">Server Cron</span>
            </div>

            <div v-if="site.currentCve !== null" class="flex items-center gap-1.5">
              <UBadge :color="getCveColor(site.currentCve)" variant="subtle" class="cursor-pointer" @click="cveModalOpen = true">
                CVE Score: {{ site.currentCve.toFixed(1) }}
              </UBadge>
            </div>

            <div v-if="site.autoLoginUser" class="flex items-center gap-1.5">
              <UBadge color="primary" variant="subtle">
                Auto-login: {{ site.autoLoginUser }}
              </UBadge>
            </div>
          </div>
        </template>
      </UCard>

      <UTabs
        v-model="activeTab"
        :items="tabItems"
        class="flex-1 flex flex-col min-h-0"
        :ui="{ content: 'flex-1 flex flex-col min-h-0' }"
      >
        <template #plugins>
          <div class="flex-1 flex flex-col min-h-0 mt-4">
            <UTable :data="site.plugins" :columns="pluginColumns" sticky class="flex-1 overflow-auto">
              <template #name-cell="{ row }">
                <div class="flex flex-col">
                  <span class="font-medium">{{ row.original.title || row.original.name }}</span>
                  <span class="text-xs text-neutral-500">{{ row.original.slug }}</span>
                </div>
              </template>
              <template #version-cell="{ row }">
                <div class="flex flex-col gap-1">
                  <div class="flex items-center justify-between gap-2 text-sm w-full">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <span>{{ row.original.version }}</span>

                      <template v-if="row.original.latestVersion && row.original.latestVersion !== row.original.version">
                        <UIcon name="i-lucide-arrow-right" class="size-3.5 text-warning" />
                        <span class="text-warning font-medium">{{ row.original.latestVersion }}</span>
                      </template>

                      <UIcon
                        v-else-if="row.original.latestVersion === row.original.version"
                        name="i-lucide-check-circle"
                        class="size-3.5 text-primary"
                      />
                    </div>
                    <UButton
                      v-if="row.original.latestVersion && row.original.latestVersion !== row.original.version"
                      icon="i-lucide-arrow-up-circle"
                      color="warning"
                      variant="ghost"
                      size="xl"
                      class="ml-auto"
                      @click.stop="enqueueSitePackageUpdate('plugin', row.original.slug, row.original.title || row.original.name)"
                    />
                  </div>

                  <UBadge
                    v-if="row.original.source && row.original.source !== 'unknown'"
                    :color="row.original.source === 'wordpress.org' ? 'success' : 'neutral'"
                    variant="subtle"
                    size="sm"
                    class="w-fit"
                  >
                    {{ row.original.source === 'wordpress.org' ? 'WordPress®.org' : row.original.source }}
                  </UBadge>
                </div>
              </template>
              <template #cveScore-cell="{ row }">
                <UBadge v-if="row.original.cveScore != null" :color="getCveColor(row.original.cveScore)" variant="subtle">
                  {{ row.original.cveScore.toFixed(1) }}
                </UBadge>
              </template>
              <template #isEnabled-cell="{ row }">
                <UBadge v-if="row.original.isEnabled" color="success" variant="subtle">Active</UBadge>
                <UBadge v-else color="neutral" variant="subtle">Inactive</UBadge>
              </template>
              <template #autoUpdate-cell="{ row }">
                <UIcon
                  :name="row.original.autoUpdate ? 'i-lucide-refresh-cw' : 'i-lucide-minus'"
                  :class="row.original.autoUpdate ? 'text-primary' : 'text-neutral-400'"
                  :title="row.original.autoUpdate ? 'Auto-update enabled' : 'Auto-update disabled'"
                />
              </template>
            </UTable>
          </div>
        </template>

        <template #themes>
          <div class="flex-1 flex flex-col min-h-0 mt-4">
            <UTable :data="site.themes" :columns="themeColumns" sticky class="flex-1 overflow-auto">
              <template #name-cell="{ row }">
                <div class="flex flex-col">
                  <span class="font-medium">{{ row.original.title || row.original.name }}</span>
                  <span class="text-xs text-neutral-500">{{ row.original.slug }}</span>
                </div>
              </template>
              <template #version-cell="{ row }">
                <div class="flex flex-col gap-1">
                  <div class="flex items-center justify-between gap-2 text-sm w-full">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <span>{{ row.original.version }}</span>

                      <template v-if="row.original.latestVersion && row.original.latestVersion !== row.original.version">
                        <UIcon name="i-lucide-arrow-right" class="size-3.5 text-warning" />
                        <span class="text-warning font-medium">{{ row.original.latestVersion }}</span>
                      </template>

                      <UIcon
                        v-else-if="row.original.latestVersion === row.original.version"
                        name="i-lucide-check-circle"
                        class="size-3.5 text-primary"
                      />
                    </div>
                    <UButton
                      v-if="row.original.latestVersion && row.original.latestVersion !== row.original.version"
                      icon="i-lucide-arrow-up-circle"
                      color="warning"
                      variant="ghost"
                      size="xl"
                      class="ml-auto"
                      @click.stop="enqueueSitePackageUpdate('theme', row.original.slug, row.original.title || row.original.name)"
                    />
                  </div>

                  <UBadge
                    v-if="row.original.source && row.original.source !== 'unknown'"
                    :color="row.original.source === 'wordpress.org' ? 'success' : 'neutral'"
                    variant="subtle"
                    size="sm"
                    class="w-fit"
                  >
                    {{ row.original.source === 'wordpress.org' ? 'WordPress®.org' : row.original.source }}
                  </UBadge>
                </div>
              </template>
              <template #cveScore-cell="{ row }">
                <UBadge v-if="row.original.cveScore != null" :color="getCveColor(row.original.cveScore)" variant="subtle">
                  {{ row.original.cveScore.toFixed(1) }}
                </UBadge>
              </template>
              <template #isEnabled-cell="{ row }">
                <div class="flex flex-col gap-1">
                  <UBadge v-if="row.original.isEnabled" color="success" variant="subtle">Active</UBadge>
                  <UBadge v-else-if="row.original.isActiveChild" color="info" variant="subtle">Parent of Active</UBadge>
                  <UBadge v-else color="neutral" variant="subtle">Inactive</UBadge>
                </div>
              </template>
              <template #autoUpdate-cell="{ row }">
                <UIcon
                  :name="row.original.autoUpdate ? 'i-lucide-refresh-cw' : 'i-lucide-minus'"
                  :class="row.original.autoUpdate ? 'text-primary' : 'text-neutral-400'"
                  :title="row.original.autoUpdate ? 'Auto-update enabled' : 'Auto-update disabled'"
                />
              </template>
            </UTable>
          </div>
        </template>

        <template #users>
          <div class="flex-1 flex flex-col min-h-0 mt-4 gap-4">
            <div class="flex items-center gap-2">
              <UInput
                v-model="usersSearch"
                icon="i-lucide-search"
                placeholder="Search users..."
                class="max-w-sm"
              >
                <template v-if="usersSearch?.length" #trailing>
                  <UButton
                    color="neutral"
                    variant="link"
                    icon="i-lucide-circle-x"
                    aria-label="Clear input"
                    class="cursor-pointer"
                    @click="usersSearch = ''"
                  />
                </template>
              </UInput>

              <USelectMenu
                v-model="selectedRole"
                :items="roleOptions"
                value-key="value"
                placeholder="Filter by role"
                class="w-56"
                clear
              >
                <template #leading>
                  <UIcon name="i-lucide-shield-user" class="size-4" />
                </template>
              </USelectMenu>

              <div class="ml-auto text-sm text-neutral-500">
                {{ userPagination.total }} user{{ userPagination.total === 1 ? '' : 's' }}
              </div>
            </div>

            <UTable :data="filteredUsers" :columns="usersColumns" :loading="usersStatus === 'pending'" sticky class="flex-1 overflow-auto">
              <template #user_login-cell="{ row }">
                <div class="flex flex-col">
                  <span class="font-medium">{{ row.original.user_login }}</span>
                  <span class="text-xs text-neutral-500">ID: {{ row.original.id }}</span>
                </div>
              </template>

              <template #display_name-cell="{ row }">
                <span>{{ row.original.display_name || 'N/A' }}</span>
              </template>

              <template #user_email-cell="{ row }">
                <span>{{ row.original.user_email || 'N/A' }}</span>
              </template>

              <template #roles-cell="{ row }">
                <div class="flex flex-wrap gap-1">
                  <UBadge
                    v-for="role in row.original.roles"
                    :key="`${row.original.user_login}-${role}`"
                    variant="subtle"
                    color="neutral"
                    size="sm"
                  >
                    {{ role }}
                  </UBadge>
                  <span v-if="row.original.roles.length === 0" class="text-xs text-neutral-400">No roles</span>
                </div>
              </template>

              <template #actions-cell="{ row }">
                <div class="flex items-center justify-end gap-2">
                  <USwitch
                    :model-value="site.autoLoginUser === row.original.user_login"
                    :disabled="Boolean(autoLoginBusyUser)"
                    :title="site.autoLoginUser === row.original.user_login ? 'Unset auto-login user' : 'Set as auto-login user'"
                    @update:model-value="(value: boolean) => setAutoLoginUser(row.original, value)"
                  />

                  <UDropdownMenu
                    :items="getUserActionItems(row.original)"
                    :content="{
                      align: 'end',
                      side: 'bottom'
                    }"
                  >
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="xl"
                      icon="lucide:more-horizontal"
                    />
                  </UDropdownMenu>
                </div>
              </template>
            </UTable>

            <div
              v-if="userPagination.totalPages > 1"
              class="flex items-center justify-between gap-4 text-sm text-neutral-500"
            >
              <span>
                Page {{ userPagination.page }} of {{ userPagination.totalPages }}
              </span>

              <div class="flex items-center gap-2">
                <UButton
                  label="Previous"
                  color="neutral"
                  variant="outline"
                  :disabled="usersPage <= 1 || usersStatus === 'pending'"
                  @click="usersPage -= 1"
                />
                <UButton
                  label="Next"
                  color="neutral"
                  variant="outline"
                  :disabled="usersPage >= userPagination.totalPages || usersStatus === 'pending'"
                  @click="usersPage += 1"
                />
              </div>
            </div>
          </div>
        </template>

        <template #tools>
          <div class="flex-1 flex flex-col min-h-0 mt-4 gap-4">
            <SiteToolsWpRocketCacheTool :site-id="siteId" :plugins="site.plugins" />

            <div class="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1">
                  <h3 class="font-semibold text-neutral-900 dark:text-neutral-50">Log in to WordPress</h3>
                  <p class="text-sm text-neutral-500 mt-1">
                    Generate a secure one-time login link for the auto-login user.
                  </p>
                </div>
                <UButton
                  icon="i-lucide-log-in"
                  :to="`/sites/${siteId}/wp-login`"
                  target="_blank"
                  label="Log in"
                />
              </div>
            </div>
          </div>
        </template>
      </UTabs>
    </div>

    <div v-else class="flex-1 flex flex-col items-center justify-center py-12">
      <h2 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Site not found</h2>
      <p class="text-neutral-500 mt-2">The site you are looking for does not exist or has been removed.</p>
      <UButton to="/sites" class="mt-6">Back to Sites</UButton>
    </div>

    <UModal v-model:open="setPasswordModalOpen" title="Set new password">
      <template #body>
        <div class="space-y-3">
          <p class="text-sm text-neutral-500">
            Set a new password for <strong>{{ selectedUserForPassword?.user_login }}</strong>.
          </p>
          <UFormField label="New password" required>
            <UInput
              v-model="newPassword"
              type="password"
              placeholder="Enter new password"
              autocomplete="new-password"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" label="Cancel" :disabled="isUserActionLoading" @click="closePasswordModal" />
          <UButton label="Save password" :loading="isUserActionLoading" @click="confirmSetPassword" />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="resetPasswordModalOpen" title="Start password reset">
      <template #body>
        <div class="space-y-3">
          <p class="text-sm text-neutral-500">
            This will send a password reset link to <strong>{{ selectedUserForPasswordReset?.user_email || 'the user email' }}</strong>.
          </p>
          <p class="text-sm text-neutral-500">
            Continue for user <strong>{{ selectedUserForPasswordReset?.user_login }}</strong>?
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" label="Cancel" :disabled="isUserActionLoading" @click="closeResetPasswordModal" />
          <UButton label="Start reset" :loading="isUserActionLoading" @click="confirmStartPasswordReset" />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="adminEmailModalOpen" title="Edit admin email">
      <template #body>
        <div class="space-y-3">
          <p class="text-sm text-neutral-500">
            Update the WordPress® admin email address and sender name for this site.
          </p>
          <UFormField label="Admin email" required>
            <UInput v-model="adminEmailValue" type="email" placeholder="admin@example.com" autocomplete="email" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" label="Cancel" :disabled="isSiteEmailLoading" @click="adminEmailModalOpen = false" />
          <UButton label="Save" :loading="isSiteEmailLoading" @click="confirmUpdateAdminEmail" />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="wooCommerceEmailModalOpen" title="Edit WooCommerce email">
      <template #body>
        <div class="space-y-3">
          <UAlert
            color="info"
            variant="soft"
            title="Applies to all WooCommerce mails"
            description="This will set the from-address for all outgoing WooCommerce emails and update the recipient for all admin notification emails."
          />
          <UFormField label="WooCommerce email" required>
            <UInput v-model="wooCommerceEmailValue" type="email" placeholder="store@example.com" autocomplete="email" />
          </UFormField>
          <UFormField label="From name (sender name)">
            <UInput v-model="wooCommerceEmailFromNameValue" placeholder="Your store name" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" label="Cancel" :disabled="isSiteEmailLoading" @click="wooCommerceEmailModalOpen = false" />
          <UButton label="Save" :loading="isSiteEmailLoading" @click="confirmUpdateWooCommerceEmail" />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="changeEmailModalOpen" title="Change email">
      <template #body>
        <div class="space-y-3">
          <UAlert
            color="warning"
            variant="soft"
            title="No notification is sent"
            description="The WordPress® user will not receive any notification about this email change."
          />
          <p class="text-sm text-neutral-500">
            Change email for <strong>{{ selectedUserForEmail?.user_login }}</strong>.
          </p>
          <UFormField label="New email" required>
            <UInput v-model="newEmail" type="email" placeholder="name@example.com" autocomplete="email" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" label="Cancel" :disabled="isUserActionLoading" @click="closeChangeEmailModal" />
          <UButton label="Save email" :loading="isUserActionLoading" @click="confirmChangeEmail" />
        </div>
      </template>
    </UModal>

    <SiteCveModal v-model:open="cveModalOpen" :site-id="siteId" />
  </NuxtLayout>
</template>

<script lang="ts" setup>
import { h } from 'vue'
import { formatDistanceToNow } from 'date-fns'
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import { UButton } from '#components'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import type { TypedInternalResponse } from 'nitropack'

type SiteDetails = TypedInternalResponse<'/api/sites/:id', unknown, 'get'>

type SiteUser = {
  id: number
  user_login: string
  display_name: string
  user_email: string
  roles: string[]
}

type SiteUsersResponse = {
  users: SiteUser[]
  roles: string[]
  pagination: {
    page: number
    limit: number | null
    total: number
    totalPages: number
  }
  autoLoginUser: string | null
}

const route = useRoute()
const router = useRouter()
const siteId = route.params.id as string
const toast = useToast()
const queryClient = useQueryClient()
const packageJobStore = usePackageJobStore()

const tabValues = ['plugins', 'themes', 'users', 'tools'] as const
type SiteTab = typeof tabValues[number]

const { data: site, status } = useQuery<SiteDetails>({
  queryKey: ['site', siteId],
  queryFn: () => useApiClient()(`/sites/${siteId}`)
})

definePageMeta({
  title: 'Site Details'
})

const tabItems = [
  {
    label: 'Plugins',
    icon: 'i-lucide-plug',
    value: 'plugins',
    slot: 'plugins'
  },
  {
    label: 'Themes',
    icon: 'i-lucide-palette',
    value: 'themes',
    slot: 'themes'
  },
  {
    label: 'Users',
    icon: 'i-lucide-users',
    value: 'users',
    slot: 'users'
  },
  {
    label: 'Tools',
    icon: 'i-lucide-wrench',
    value: 'tools',
    slot: 'tools'
  }
]

const getRouteTab = (value: unknown): SiteTab => {
  return typeof value === 'string' && tabValues.includes(value as SiteTab)
    ? value as SiteTab
    : 'plugins'
}

const activeTab = ref<SiteTab>(getRouteTab(route.query.tab))

const createSortableHeader = (label: string) => {
  return ({ column }: any) => {
    const isSorted = column.getIsSorted()
    return h(UButton, {
      color: 'neutral',
      variant: 'ghost',
      label,
      icon: isSorted ? (isSorted === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow') : 'i-lucide-arrow-up-down',
      class: '-mx-2.5 -my-2.5',
      onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
    })
  }
}

const pluginColumns = [
  {
    accessorKey: 'name',
    header: createSortableHeader('Plugin'),
    sortingFn: (rowA: any, rowB: any) => {
      const a = rowA.original.title || rowA.original.name
      const b = rowB.original.title || rowB.original.name
      return a.localeCompare(b)
    }
  },
  {
    accessorKey: 'version',
    header: 'Version'
  },
  {
    accessorKey: 'cveScore',
    header: createSortableHeader('CVE'),
    sortingFn: (rowA: any, rowB: any) => {
      const a = rowA.original.cveScore ?? -1
      const b = rowB.original.cveScore ?? -1
      return a - b
    }
  },
  {
    accessorKey: 'isEnabled',
    header: 'Status'
  },
  {
    accessorKey: 'autoUpdate',
    header: 'Auto-update'
  }
]

const themeColumns = [
  {
    accessorKey: 'name',
    header: createSortableHeader('Theme'),
    sortingFn: (rowA: any, rowB: any) => {
      const a = rowA.original.title || rowA.original.name
      const b = rowB.original.title || rowB.original.name
      return a.localeCompare(b)
    }
  },
  {
    accessorKey: 'version',
    header: 'Version'
  },
  {
    accessorKey: 'cveScore',
    header: createSortableHeader('CVE'),
    sortingFn: (rowA: any, rowB: any) => {
      const a = rowA.original.cveScore ?? -1
      const b = rowB.original.cveScore ?? -1
      return a - b
    }
  },
  {
    accessorKey: 'isEnabled',
    header: 'Status'
  },
  {
    accessorKey: 'autoUpdate',
    header: 'Auto-update'
  }
]

const usersColumns: TableColumn<SiteUser>[] = [
  {
    accessorKey: 'user_login',
    header: 'Login'
  },
  {
    accessorKey: 'display_name',
    header: 'Display name'
  },
  {
    accessorKey: 'user_email',
    header: 'Email'
  },
  {
    accessorKey: 'roles',
    header: 'Roles'
  },
  {
    id: 'actions',
    header: '',
    size: 0,
    meta: { class: { td: 'w-2' } }
  }
]

const usersSearch = ref('')
const selectedRole = ref<string | undefined>('administrator')
const usersPage = ref(1)
const autoLoginBusyUser = ref<string | null>(null)

const {
  data: siteUsers,
  status: usersStatus,
  refetch: refetchUsers
} = useQuery<SiteUsersResponse>({
  queryKey: ['site-users', siteId, selectedRole, usersPage],
  queryFn: () => useApiClient()(`/sites/${siteId}/users`, {
    query: {
      role: selectedRole.value || undefined,
      page: usersPage.value,
      limit: 100
    }
  }),
  enabled: computed(() => Boolean(site.value))
})

const users = computed(() => siteUsers.value?.users || [])
const roleOptions = computed(() => {
  return (siteUsers.value?.roles || []).map(role => ({
      label: role,
    value: role
  }))
})

const filteredUsers = computed(() => {
  let result = users.value

  const role = selectedRole.value
  if (role) {
    result = result.filter(user => user.roles.includes(role))
  }

  if (usersSearch.value) {
    const q = usersSearch.value.toLowerCase()
    result = result.filter(user =>
      user.user_login.toLowerCase().includes(q) ||
      user.display_name.toLowerCase().includes(q) ||
      user.user_email.toLowerCase().includes(q)
    )
  }

  return result
})

const userPagination = computed(() => siteUsers.value?.pagination ?? {
  page: 1,
  limit: 100,
  total: 0,
  totalPages: 1
})

watch(selectedRole, () => {
  usersPage.value = 1
})

watch(() => route.query.tab, (value) => {
  const nextTab = getRouteTab(value)
  if (nextTab !== activeTab.value) {
    activeTab.value = nextTab
  }
})

watch(activeTab, async (value) => {
  if (value === getRouteTab(route.query.tab)) {
    return
  }

  await router.replace({
    query: {
      ...route.query,
      tab: value
    }
  })
})

const cveModalOpen = ref(false)
const setPasswordModalOpen = ref(false)
const resetPasswordModalOpen = ref(false)
const changeEmailModalOpen = ref(false)
const isUserActionLoading = ref(false)

const selectedUserForPassword = ref<SiteUser | null>(null)
const selectedUserForPasswordReset = ref<SiteUser | null>(null)
const selectedUserForEmail = ref<SiteUser | null>(null)

const newPassword = ref('')
const newEmail = ref('')

const closePasswordModal = () => {
  setPasswordModalOpen.value = false
  selectedUserForPassword.value = null
  newPassword.value = ''
}

const closeResetPasswordModal = () => {
  resetPasswordModalOpen.value = false
  selectedUserForPasswordReset.value = null
}

const closeChangeEmailModal = () => {
  changeEmailModalOpen.value = false
  selectedUserForEmail.value = null
  newEmail.value = ''
}

const getUserActionItems = (user: SiteUser): DropdownMenuItem[][] => [
  [
    {
      label: 'Set new password',
      icon: 'lucide:key-round',
      onSelect: () => {
        selectedUserForPassword.value = user
        newPassword.value = ''
        setPasswordModalOpen.value = true
      }
    },
    {
      label: 'Start password reset',
      icon: 'lucide:mail',
      onSelect: () => {
        selectedUserForPasswordReset.value = user
        resetPasswordModalOpen.value = true
      }
    }
  ],
  [
    {
      label: 'Change email',
      icon: 'lucide:at-sign',
      onSelect: () => {
        selectedUserForEmail.value = user
        newEmail.value = user.user_email
        changeEmailModalOpen.value = true
      }
    }
  ]
]

const setAutoLoginUser = async (user: SiteUser, enabled: boolean) => {
  const currentAutoLogin = site.value?.autoLoginUser ?? null
  const nextUsername = enabled ? user.user_login : null

  if (!enabled && currentAutoLogin !== user.user_login) {
    return
  }

  if (nextUsername === currentAutoLogin) {
    return
  }

  autoLoginBusyUser.value = user.user_login
  try {
    const response = await useApiClient()(`/sites/${siteId}/auto-login-user`, {
      method: 'PUT',
      body: {
        username: nextUsername
      }
    }) as { autoLoginUser: string | null }

    queryClient.setQueryData(['site', siteId], (current: SiteDetails | undefined) => {
      if (!current) return current
      return {
        ...current,
        autoLoginUser: response.autoLoginUser
      }
    })

    queryClient.setQueriesData({ queryKey: ['site-users', siteId] }, (current: SiteUsersResponse | undefined) => {
      if (!current) return current
      return {
        ...current,
        autoLoginUser: response.autoLoginUser
      }
    })

    toast.add({
      title: 'Auto-login user updated',
      description: response.autoLoginUser
        ? `${response.autoLoginUser} is now used for one-click login.`
        : 'One-click login user has been cleared.',
      color: 'success'
    })
  } catch (error: any) {
    toast.add({
      title: 'Failed to update auto-login user',
      description: error?.data?.message || error?.message || 'Unknown error',
      color: 'error'
    })
  } finally {
    autoLoginBusyUser.value = null
  }
}

const confirmSetPassword = async () => {
  const user = selectedUserForPassword.value
  if (!user || !newPassword.value) {
    return
  }

  isUserActionLoading.value = true
  try {
    await useApiClient()(`/sites/${siteId}/users/set-password`, {
      method: 'POST',
      body: {
        userLogin: user.user_login,
        password: newPassword.value
      }
    })

    toast.add({
      title: 'Password updated',
      description: `New password has been set for ${user.user_login}.`,
      color: 'success'
    })
    closePasswordModal()
  } catch (error: any) {
    toast.add({
      title: 'Failed to set password',
      description: error?.data?.message || error?.message || 'Unknown error',
      color: 'error'
    })
  } finally {
    isUserActionLoading.value = false
  }
}

const confirmStartPasswordReset = async () => {
  const user = selectedUserForPasswordReset.value
  if (!user) {
    return
  }

  isUserActionLoading.value = true
  try {
    await useApiClient()(`/sites/${siteId}/users/start-password-reset`, {
      method: 'POST',
      body: {
        userLogin: user.user_login
      }
    })

    toast.add({
      title: 'Password reset started',
      description: `A reset link was sent to ${user.user_email || 'the user email'}.`,
      color: 'success'
    })
    closeResetPasswordModal()
  } catch (error: any) {
    toast.add({
      title: 'Failed to start password reset',
      description: error?.data?.message || error?.message || 'Unknown error',
      color: 'error'
    })
  } finally {
    isUserActionLoading.value = false
  }
}

const confirmChangeEmail = async () => {
  const user = selectedUserForEmail.value
  const email = newEmail.value.trim()
  if (!user || !email) {
    return
  }

  isUserActionLoading.value = true
  try {
    await useApiClient()(`/sites/${siteId}/users/change-email`, {
      method: 'POST',
      body: {
        userLogin: user.user_login,
        email
      }
    })

    toast.add({
      title: 'Email changed',
      description: `${user.user_login} now uses ${email}.`,
      color: 'success'
    })

    await refetchUsers()
    closeChangeEmailModal()
  } catch (error: any) {
    toast.add({
      title: 'Failed to change email',
      description: error?.data?.message || error?.message || 'Unknown error',
      color: 'error'
    })
  } finally {
    isUserActionLoading.value = false
  }
}

const adminEmailModalOpen = ref(false)
const wooCommerceEmailModalOpen = ref(false)
const adminEmailValue = ref('')
const adminEmailFromNameValue = ref('')
const wooCommerceEmailValue = ref('')
const wooCommerceEmailFromNameValue = ref('')
const isSiteEmailLoading = ref(false)

const openAdminEmailModal = () => {
  adminEmailValue.value = site.value?.adminEmail || ''
  adminEmailFromNameValue.value = site.value?.adminEmailFromName || ''
  adminEmailModalOpen.value = true
}

const openWooCommerceEmailModal = () => {
  wooCommerceEmailValue.value = site.value?.wooCommerceEmail || ''
  wooCommerceEmailFromNameValue.value = site.value?.wooCommerceEmailFromName || ''
  wooCommerceEmailModalOpen.value = true
}

const confirmUpdateAdminEmail = async () => {
  const email = adminEmailValue.value.trim()
  if (!email) return

  isSiteEmailLoading.value = true
  try {
    const response = await useApiClient()(`/sites/${siteId}/update-admin-email`, {
      method: 'PUT',
      body: {
        email,
        fromName: adminEmailFromNameValue.value
      }
    }) as { adminEmail: string; adminEmailFromName: string | null }

    queryClient.setQueryData(['site', siteId], (current: SiteDetails | undefined) => {
      if (!current) return current
      return {
        ...current,
        adminEmail: response.adminEmail,
        adminEmailFromName: response.adminEmailFromName
      }
    })

    toast.add({
      title: 'Admin email updated',
      description: `Admin email set to ${response.adminEmail}.`,
      color: 'success'
    })
    adminEmailModalOpen.value = false
  } catch (error: any) {
    toast.add({
      title: 'Failed to update admin email',
      description: error?.data?.message || error?.message || 'Unknown error',
      color: 'error'
    })
  } finally {
    isSiteEmailLoading.value = false
  }
}

const confirmUpdateWooCommerceEmail = async () => {
  const email = wooCommerceEmailValue.value.trim()
  if (!email) return

  isSiteEmailLoading.value = true
  try {
    const response = await useApiClient()(`/sites/${siteId}/update-woocommerce-email`, {
      method: 'PUT',
      body: {
        email,
        fromName: wooCommerceEmailFromNameValue.value
      }
    }) as { wooCommerceEmail: string; wooCommerceEmailFromName: string | null }

    queryClient.setQueryData(['site', siteId], (current: SiteDetails | undefined) => {
      if (!current) return current
      return {
        ...current,
        wooCommerceEmail: response.wooCommerceEmail,
        wooCommerceEmailFromName: response.wooCommerceEmailFromName
      }
    })

    toast.add({
      title: 'WooCommerce email updated',
      description: `WooCommerce email set to ${response.wooCommerceEmail}.`,
      color: 'success'
    })
    wooCommerceEmailModalOpen.value = false
  } catch (error: any) {
    toast.add({
      title: 'Failed to update WooCommerce email',
      description: error?.data?.message || error?.message || 'Unknown error',
      color: 'error'
    })
  } finally {
    isSiteEmailLoading.value = false
  }
}

const formatRelativeTime = (dateStr: string) => {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
}

const formatFullDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString()
}

const decodeEntities = (text: string) => {
  if (import.meta.server) return text
  const textarea = document.createElement('textarea')
  textarea.innerHTML = text
  return textarea.value
}

const getCveColor = (cve: number) => {
  if (cve >= 7) return 'error'
  if (cve >= 4) return 'warning'
  if (cve >= 2) return 'info'
  return 'success'
}

const enqueueSitePackageUpdate = async (kind: 'plugin' | 'theme', slug: string, title: string) => {
  try {
    await useApiClient()('/packages/jobs', {
      method: 'POST',
      body: {
        jobs: [
          {
            installationId: siteId,
            kind,
            slug,
            operation: 'update'
          }
        ]
      }
    })

    toast.add({
      title: 'Update queued',
      description: `${title} will be updated in the background.`,
      color: 'success'
    })
    packageJobStore.refreshStatus()
  } catch (error: any) {
    toast.add({
      title: 'Failed to queue update',
      description: error?.data?.message || error?.message || 'Unknown error',
      color: 'error'
    })
  }
}

watch(() => packageJobStore.lastCompletedProgress?.updatedAt, (updatedAt, previous) => {
  if (updatedAt && updatedAt !== previous) {
    queryClient.invalidateQueries({ queryKey: ['site', siteId] })
  }
})
</script>
