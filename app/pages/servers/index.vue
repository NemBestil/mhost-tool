<template>
  <NuxtLayout name="dashboard-page">
    <template #topbar-right>
      <UButton
          to="/servers/create"
          icon="i-lucide-plus"
          label="Add Server"
      />
    </template>

    <div>
      <UTable :data="servers" :columns="columns" :loading="status === 'pending'" class="table-auto">
        <!-- Name Column -->
        <template #name-cell="{ row }">
          <NuxtLink :to="`/servers/${row.original.id}/edit`" class="flex flex-col group">
            <span class="font-medium text-neutral-900 dark:text-neutral-50 group-hover:text-primary transition-colors">{{ row.original.name }}</span>
            <span class="text-xs text-neutral-500 dark:text-neutral-400">{{ row.original.hostname }}:{{
                row.original.sshPort
              }}</span>
          </NuxtLink>
        </template>

        <!-- Server Type Column -->
        <template #serverType-cell="{ row }">
          <div class="flex flex-col">
            <span>{{ row.original.serverType }}</span>
            <div class="flex items-center gap-1 text-xs"
                 :class="row.original.sshIsValid ? 'text-success' : 'text-error'">
              <Icon :name="row.original.sshIsValid ? 'lucide:check-circle' : 'lucide:x-circle'" class="size-3"/>
              <span>SSH {{ row.original.sshIsValid ? 'Valid' : 'Invalid' }}</span>
            </div>
          </div>
        </template>

        <!-- Actions Column -->
        <template #actions-cell="{ row }">
          <UDropdownMenu
              :items="getActionItems(row.original)"
              :content="{
                align: 'end',
                side: 'bottom'
              }">
            <UButton
                color="neutral"
                variant="ghost"
                size="xl"
                icon="lucide:more-horizontal"
            />
          </UDropdownMenu>
        </template>
      </UTable>

      <DeleteServerModal
          v-if="serverToDelete"
          v-model:open="isDeleteModalOpen"
          :server="serverToDelete!"
          @deleted="refetchServers"
      />
    </div>
  </NuxtLayout>
</template>

<script lang="ts" setup>
import type {TableColumn} from '@nuxt/ui'
import {useQuery} from '@tanstack/vue-query'
import type {TypedInternalResponse} from 'nitropack'

definePageMeta({
  title: 'List servers'
})

type ServerList = TypedInternalResponse<'/api/servers/list', unknown, 'get'>

const {data: servers, status, refetch: refetchServers} = useQuery<ServerList>({
  queryKey: ['servers-list'],
  queryFn: () => $fetch('/api/servers/list')
})

type Server = NonNullable<typeof servers.value>[number]

const columns: TableColumn<Server>[] = [
  {
    accessorKey: 'name',
    header: 'Name'
  },
  {
    accessorKey: 'serverType',
    header: 'Server Type'
  },
  {
    id: 'actions',
    header: '',
    size: 0,
    meta: {class: {td: 'w-2'}}
  }
]

// Action logic
const isDeleteModalOpen = ref(false)
const serverToDelete = ref<Server | null>(null)

const getActionItems = (row: Server) => [
  [
    {
      label: 'Edit',
      icon: 'lucide:pencil',
      to: `/servers/${row.id}/edit`
    }
  ],
  [
    {
      label: 'Delete',
      icon: 'lucide:trash',
      color: 'error' as const,
      onSelect: () => {
        serverToDelete.value = row
        isDeleteModalOpen.value = true
      }
    }
  ]
]
</script>
