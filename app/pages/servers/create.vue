<script setup lang="ts">
definePageMeta({
  title: 'Add Server',
})

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
          @success="onPageSuccess"
        />
      </UCard>
    </div>
  </NuxtLayout>
</template>
