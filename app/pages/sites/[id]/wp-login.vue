<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <UCard class="w-full max-w-lg">
      <template #header>
        <h1 class="text-lg font-semibold">One-click login</h1>
      </template>

      <div v-if="isLoading" class="flex flex-col items-center text-center gap-3 py-4">
        <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-primary"/>
        <div class="text-base font-medium">Please wait, logging you in...</div>
        <p class="text-sm text-neutral-500">
          We are preparing a one-time WordPress login link for this site.
        </p>
      </div>

      <div v-else-if="!errorMessage && !autoLoginUser" class="space-y-4 py-2">
        <p class="text-sm text-neutral-600 dark:text-neutral-300">
          Select the user that should be used for one-click login.
        </p>

        <USelectMenu
            v-model="selectedUser"
            :items="userOptions"
            icon="i-lucide-user"
            placeholder="Select user"
            :ui="{ content: 'min-w-fit' }"
            class="w-full"
            value-key="value"
        >
          <template #item-label="{ item }">
            <div class="flex items-center justify-between gap-4 w-full">
              <span class="truncate">{{ item.label }}</span>
              <span class="text-muted text-xs whitespace-nowrap">{{ item.role }}</span>
            </div>
          </template>
        </USelectMenu>

        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" to="/sites" label="Cancel"/>
          <UButton
              label="Use user and login"
              :disabled="!selectedUser"
              :loading="isConfirmingUser"
              @click="confirmAutoLoginUser"
          />
        </div>
      </div>

      <div v-else class="space-y-4 py-2">
        <UAlert
            color="error"
            variant="soft"
            title="Unable to log in automatically"
            :description="errorMessage || 'Unknown error'"
        />
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" to="/sites" label="Back to sites"/>
          <UButton :to="`/sites/${siteId}`" label="Open site details"/>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script lang="ts" setup>
const route = useRoute()
const siteId = route.params.id as string

const isLoading = ref(true)
const errorMessage = ref<string | null>(null)
const isConfirmingUser = ref(false)
const autoLoginUser = ref<string | null>(null)
const selectedUser = ref<string | null>(null)
const userOptions = ref<Array<{
  label: string
  role: string
  value: string
}>>([])

definePageMeta({
  title: 'One-click login',
  layout: false,
})

const beginAutoLogin = async () => {
  const response = await useApiClient()(`/sites/${siteId}/one-click-login`, {
    method: 'POST'
  }) as { loginUrl?: string }

  if (!response?.loginUrl) {
    throw new Error('No login URL was returned.')
  }

  window.location.replace(response.loginUrl)
}

const confirmAutoLoginUser = async () => {
  if (!selectedUser.value) {
    return
  }

  isConfirmingUser.value = true
  errorMessage.value = null

  try {
    const response = await useApiClient()(`/sites/${siteId}/auto-login-user`, {
      method: 'PUT',
      body: {
        username: selectedUser.value
      }
    }) as { autoLoginUser: string | null }

    autoLoginUser.value = response.autoLoginUser
    isLoading.value = true
    await beginAutoLogin()
  } catch (error: any) {
    errorMessage.value = error?.data?.message || error?.message || 'Failed to set auto-login user.'
    isLoading.value = false
  } finally {
    isConfirmingUser.value = false
  }
}

onMounted(async () => {
  try {
    const usersResponse = await useApiClient()(`/sites/${siteId}/users`) as {
      users: Array<{
        user_login: string
        display_name: string
        roles: string[]
      }>
      autoLoginUser: string | null
    }

    autoLoginUser.value = usersResponse.autoLoginUser
    userOptions.value = usersResponse.users.map((user) => ({
      label: user.display_name || user.user_login,
      role: user.roles[0] || 'no-role',
      value: user.user_login
    }))

    if (autoLoginUser.value) {
      await beginAutoLogin()
      return
    }

    if (userOptions.value.length === 0) {
      throw new Error('No users were found on this site.')
    }

    selectedUser.value = userOptions.value[0]?.value || null
    isLoading.value = false
  } catch (error: any) {
    errorMessage.value = error?.data?.message || error?.message || 'Failed to generate one-time login URL.'
    isLoading.value = false
  }
})
</script>
