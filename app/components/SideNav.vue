<script lang="ts" setup>
import type { NavigationMenuItem as NuxtNavigationMenuItem } from '@nuxt/ui'
interface NavigationMenuItem extends NuxtNavigationMenuItem {
  open?: boolean
}


const props = withDefaults(defineProps<{
  items: NavigationMenuItem[]
  collapsed?: boolean
}>(), {
  collapsed: false
})

const route = useRoute()

const openItems = ref(
  props.items.reduce((acc, item, index) => {
    acc[index] = item.open ?? true
    return acc
  }, {} as Record<number, boolean>)
)

const toggleItem = (index: number) => {
  openItems.value[index] = !openItems.value[index]
}

const isItemOpen = (index: number) => {
  return openItems.value[index] ?? true
}
</script>

<template>
  <div>
    <div class="space-y-4">
      <NuxtLink
        to="/"
        class="mt-2 block"
      >
        <UButton
          :ui="{ leadingIcon: 'size-4 mr-1' }"
          class="w-full cursor-pointer"
          icon="i-lucide-house"
          variant="link"
          active-variant="soft"
          :active="route.path === '/'"
          :label="collapsed ? '' : 'Overview'"
        />
      </NuxtLink>

      <hr class="bg-(--ui-border) border-default">

      <div
        v-for="(item, itemKey) in props.items"
        :key="itemKey"
        class="border-b border-default"
        :class="collapsed ? 'space-y-2' : ' px-2'"
      >
        <UButton
          v-if="!collapsed"
          variant="ghost"
          color="neutral"
          class="w-full justify-between uppercase text-xs font-medium tracking-wider mb-2 px-2"
          @click="toggleItem(itemKey)"
        >
          <template #leading>
            <span>{{ item.label }}</span>
          </template>
          <template #trailing>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-4 transition-transform duration-200"
              :class="{ '-rotate-180': !isItemOpen(itemKey) }"
            />
          </template>
        </UButton>
        <div
          v-if="!collapsed"
          class="overflow-hidden transition-all duration-200"
          :class="isItemOpen(itemKey) ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'"
        >
          <NuxtLink
            v-for="child in item.children"
            :key="child.label"
            :to="child.to"
            class="w-full block px-1.5 py-1.5 flex items-center gap-2 hover:text-default text-sm last:mb-4"
            :class="route.path === child.to ? 'text-default' : 'text-muted'"
          >
            <UIcon
              :name="child.icon"
              class="text-muted size-4"
              :class="collapsed ? '' : 'mr-1'"
            />
            <span v-if="!collapsed">{{ child.label }}</span>
          </NuxtLink>
        </div>
        <template v-if="collapsed">
          <UButton
            v-for="child in item.children"
            :key="child.label"
            :to="child.to"
            variant="link"
            color="neutral"
            :active="route.path === child.to"
            class="w-full justify-center px-1.5"
            :icon="child.icon"
          />
        </template>
      </div>
    </div>
  </div>
</template>
