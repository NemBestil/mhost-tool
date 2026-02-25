function getRequestPath(request: RequestInfo | URL): string {
  if (typeof request === 'string') {
    return request
  }

  if (request instanceof URL) {
    return request.pathname
  }

  if (request instanceof Request) {
    try {
      return new URL(request.url).pathname
    } catch {
      return request.url
    }
  }

  return ''
}

export default defineNuxtPlugin(() => {
  const router = useRouter()
  const toast = useToast()

  let handlingUnauthorized = false

  const api = $fetch.create({
    baseURL: '/api',
    async onResponseError({ request, response }) {
      const requestPath = getRequestPath(request)
      const isLoginRequest = requestPath === '/auth/login' || requestPath === '/api/auth/login'

      if (response.status !== 401 || isLoginRequest) {
        return
      }

      const auth = useAuthStore()
      auth.markLoggedOut()

      if (handlingUnauthorized) {
        return
      }

      handlingUnauthorized = true

      toast.add({
        title: 'Session expired',
        description: 'Please log in again.',
        color: 'error',
      })

      if (router.currentRoute.value.path !== '/login') {
        await router.push('/login')
      }

      handlingUnauthorized = false
    },
  })

  return {
    provide: {
      api,
    },
  }
})
