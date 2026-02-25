// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/fonts', '@nuxt/icon', '@nuxt/ui', '@nuxtjs/mdc', '@pinia/nuxt'],
  ssr: false,
  css: ['./app/assets/main.css'],
  vite: {
    plugins: [
      // @ts-expect-error missing type-stuff
      tailwindcss(),
    ],
  },
  nitro: {
    experimental: {
      websocket: true,
      tasks: true
    },
    scheduledTasks: {
      '* * * * *': ['ping-sites-high'],
      '*/2 * * * *': ['ping-sites-normal']
    }
  }
})
