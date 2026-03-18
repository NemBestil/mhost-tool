import { useQuery } from '@tanstack/vue-query'

export type SetupSettingsResponse = {
  features: {
    wpMailSmtpPro: boolean
    wpRocketCache: boolean
  }
}

export function useSetupSettingsQuery() {
  return useQuery<SetupSettingsResponse>({
    queryKey: ['setup-settings'],
    queryFn: () => useApiClient()('/settings/main')
  })
}
