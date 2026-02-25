<script setup lang="ts">
</script>
<template>
  <UApp :toaster="{ duration: 5000 }">
    <NuxtLoadingIndicator />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
