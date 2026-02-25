export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path.startsWith('/__nuxt_error')) {
    return
  }

  const auth = useAuthStore()
  await auth.initialize()

  const isLoginPage = to.path === '/login'

  console.log('logged in?', auth.isLoggedIn)

  if (!auth.isLoggedIn && !isLoginPage) {
    return navigateTo('/login')
  }

  if (auth.isLoggedIn && isLoginPage) {
    return navigateTo('/')
  }
})
