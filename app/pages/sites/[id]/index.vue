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
            <div class="font-medium">{{ site.adminEmail || 'N/A' }}</div>
          </div>

          <div class="space-y-1">
            <span class="text-xs font-medium text-neutral-500 uppercase tracking-wider">PHP Version</span>
            <div class="flex items-center gap-2 font-medium">
              <UBadge variant="subtle" color="neutral">{{ site.phpVersion || 'Unknown' }}</UBadge>
              <span class="text-neutral-400 text-sm">Limit: {{ site.phpMemoryLimit || 'N/A' }}</span>
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
              <UBadge :color="getCveColor(site.currentCve)" variant="subtle">
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
                    {{ row.original.source }}
                  </UBadge>
                </div>
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
                    {{ row.original.source }}
                  </UBadge>
                </div>
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
                value-attribute="value"
                placeholder="Filter by role"
                class="w-56"
                clear
              >
                <template #leading>
                  <UIcon name="i-lucide-shield-user" class="size-4" />
                </template>
              </USelectMenu>
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
          </div>
        </template>

        <template #tweaks>
          <div class="mt-4 flex-1 overflow-auto">
            <div class="text-center py-12 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
              <UIcon name="i-lucide-settings-2" class="size-12 text-neutral-300 mx-auto mb-4" />
              <h3 class="text-lg font-medium text-neutral-900 dark:text-neutral-50">No Tweaks Yet</h3>
              <p class="text-neutral-500 max-w-sm mx-auto mt-2">
                Website tweaks and security hardening options will be available here in a future update.
              </p>
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

    <UModal v-model:open="changeEmailModalOpen" title="Change email">
      <template #body>
        <div class="space-y-3">
          <UAlert
            color="warning"
            variant="soft"
            title="No notification is sent"
            description="The WordPress user will not receive any notification about this email change."
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
  </NuxtLayout>
</template>

<script lang="ts" setup>
import { formatDistanceToNow } from 'date-fns'
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
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
  autoLoginUser: string | null
}

const route = useRoute()
const siteId = route.params.id as string
const toast = useToast()
const queryClient = useQueryClient()
const packageJobStore = usePackageJobStore()

const { data: site, status } = useQuery<SiteDetails>({
  queryKey: ['site', siteId],
  queryFn: () => useApiClient()(`/sites/${siteId}`)
})

const {
  data: siteUsers,
  status: usersStatus,
  refetch: refetchUsers
} = useQuery<SiteUsersResponse>({
  queryKey: ['site-users', siteId],
  queryFn: () => useApiClient()(`/sites/${siteId}/users`),
  enabled: computed(() => Boolean(site.value))
})

definePageMeta({
  title: 'Site Details'
})

const tabItems = [
  {
    label: 'Plugins',
    icon: 'i-lucide-plug',
    slot: 'plugins'
  },
  {
    label: 'Themes',
    icon: 'i-lucide-palette',
    slot: 'themes'
  },
  {
    label: 'Users',
    icon: 'i-lucide-users',
    slot: 'users'
  },
  {
    label: 'Tweaks',
    icon: 'i-lucide-settings-2',
    slot: 'tweaks'
  }
]

const pluginColumns = [
  {
    accessorKey: 'name',
    header: 'Plugin'
  },
  {
    accessorKey: 'version',
    header: 'Version'
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
    header: 'Theme'
  },
  {
    accessorKey: 'version',
    header: 'Version'
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
const selectedRole = ref<{ label: string, value: string } | null>(null)
const autoLoginBusyUser = ref<string | null>(null)

const users = computed(() => siteUsers.value?.users || [])
const roleOptions = computed(() => {
  return (siteUsers.value?.roles || []).map(role => ({
    label: role,
    value: role
  }))
})

const filteredUsers = computed(() => {
  let result = users.value

  const role = selectedRole.value?.value
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

    queryClient.setQueryData(['site-users', siteId], (current: SiteUsersResponse | undefined) => {
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
