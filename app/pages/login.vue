<script setup lang="ts">
import type { AuthFormField } from '@nuxt/ui'

type LoginForm = {
  username: string
  password: string
}

definePageMeta({
  layout: false,
  title: 'Login',
})

const fields = ref<AuthFormField[]>([
  {
    name: 'username',
    type: 'text',
    label: 'Username',
  },
  {
    name: 'password',
    type: 'password',
    label: 'Password',
  },
])

const isSubmitting = ref(false)
const errorMessage = ref('')
const authStore = useAuthStore()

async function onSubmit(event: { data: LoginForm }) {
  errorMessage.value = ''
  isSubmitting.value = true

  try {
    const response = await useApiClient()<{
      success: boolean
      expiresAt: string
    }>('/auth/login', {
      method: 'POST',
      body: event.data,
    })

    authStore.markLoggedIn(response.expiresAt)
    await navigateTo('/')
  } catch {
    errorMessage.value = 'Invalid username or password.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <UCard class="w-full max-w-md">
      <div class="mb-6 flex flex-col items-center gap-2">
        <img src="/img/logo.svg" alt="MHost logo" class="h-10 w-10 dark:hidden">
        <img src="/img/logo-dark.svg" alt="MHost logo" class="hidden h-10 w-10 dark:block">
        <h1 class="mhost-title text-2xl text-center dark:text-neutral-400">MHOST</h1>
      </div>

      <UAuthForm
        title="Login"
        :fields="fields"
        :loading="isSubmitting"
        @submit="onSubmit"
      />

      <p v-if="errorMessage" class="mt-4 text-sm text-error">
        {{ errorMessage }}
      </p>
    </UCard>
  </div>
</template>

<style scoped>
.mhost-title {
  font-family: 'Indie Flower', cursive;
}
</style>
