import { assertAdminCredentialsConfigured } from '#server/utils/auth'

export default defineNitroPlugin(() => {
  try {
    assertAdminCredentialsConfigured()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
})
