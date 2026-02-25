<script setup lang="ts">
definePageMeta({
  title: 'Edit Server',
})

const route = useRoute()
const serverId = route.params.id as string

async function onPageSuccess() {
  await navigateTo('/servers')
}
</script>

<template>
  <NuxtLayout name="dashboard-page">
    <template #topbar-right>
      <UButton
          to="/servers"
          icon="lucide:arrow-left"
          variant="ghost"
          color="neutral"
          label="Back to list"
      />
    </template>
    <div>
      <UCard class="max-w-2xl mx-auto">
        <ServerForm
            :id="serverId"
            @success="onPageSuccess"
        />
      </UCard>
    </div>
  </NuxtLayout>
</template>
