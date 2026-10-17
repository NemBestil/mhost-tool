import type { $Fetch } from 'ofetch'

export function useApiClient(): $Fetch {
  // Requests are relative to /api. Use ofetch's client type so Nitro does not
  // try to infer server routes from these relative paths in every consumer.
  return useNuxtApp().$api as $Fetch
}
