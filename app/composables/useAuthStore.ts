type SessionStatusResponse = {
  authenticated: boolean
  expiresAt?: string
}

export const useAuthStore = defineStore('auth', () => {
  const isLoggedIn = ref(false)
  const sessionExpiresAt = ref<string | null>(null)
  const initialized = ref(false)

  watchEffect(() => {
    console.log('auth', isLoggedIn.value, sessionExpiresAt.value, initialized.value)
  })

  let expiryTimeout: ReturnType<typeof setTimeout> | null = null

  function clearExpiryTimeout() {
    if (expiryTimeout) {
      clearTimeout(expiryTimeout)
      expiryTimeout = null
    }
  }

  function markLoggedOut() {
    clearExpiryTimeout()
    isLoggedIn.value = false
    sessionExpiresAt.value = null
    initialized.value = true
  }

  function scheduleExpiry(expiresAt: string) {
    clearExpiryTimeout()

    if (!import.meta.client) {
      return
    }

    const delay = new Date(expiresAt).getTime() - Date.now()
    if (delay <= 0) {
      markLoggedOut()
      return
    }

    expiryTimeout = setTimeout(() => {
      markLoggedOut()
    }, delay)
  }

  function markLoggedIn(expiresAt: string | Date) {
    const expiryIso = new Date(expiresAt).toISOString()

    isLoggedIn.value = true
    sessionExpiresAt.value = expiryIso
    initialized.value = true
    scheduleExpiry(expiryIso)
  }

  async function initialize() {
    if (initialized.value) {
      return
    }

    try {
      const session = await useApiClient()<SessionStatusResponse>('/auth/session')
      if (session.authenticated && session.expiresAt) {
        markLoggedIn(session.expiresAt)
        return
      }
    } catch {
      // Treat network/server errors as unauthenticated for the client store.
    }

    markLoggedOut()
  }

  return {
    initialized,
    isLoggedIn,
    sessionExpiresAt,
    markLoggedIn,
    markLoggedOut,
    initialize,
  }
})
