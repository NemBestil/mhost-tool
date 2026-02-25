<template>
  <NuxtLayout name="dashboard-page">
    <template #topbar-right>
      <input
          ref="fileInputRef"
          type="file"
          class="hidden"
          accept=".zip,application/zip"
          multiple
          @change="onFileInputChange"
      >
      <UButton
          icon="i-lucide-upload"
          label="Upload"
          :loading="isSubmitting"
          :disabled="isSubmitting || uploadStore.isUploading"
          @click="openFilePicker"
      />
    </template>

    <div
        class="relative flex-1 flex flex-col min-h-0"
        @dragenter.prevent="onDragEnter"
        @dragover.prevent="onDragOver"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
    >
      <div
          v-if="uploadStore.hasActivity"
          class="mb-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 cursor-pointer"
          @click="isSlideoverOpen = true"
      >
        <div class="px-4 py-3 flex items-center gap-3">
          <UIcon
              v-if="uploadStore.isUploading"
              name="i-lucide-loader-2"
              class="size-4 animate-spin text-primary"
          />
          <UIcon
              v-else
              name="i-lucide-check-circle"
              class="size-4 text-success"
          />
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium">{{ statusText }}</div>
            <div
                v-if="displayProgress"
                class="text-xs text-neutral-500"
            >
              {{ displayProgress.current }}/{{ displayProgress.total }} processed,
              {{ displayProgress.success }} success,
              {{ displayProgress.failed }} failed,
              {{ displayProgress.skipped }} skipped
            </div>
          </div>
        </div>
        <div
            v-if="uploadStore.isUploading"
            class="px-4 pb-3"
        >
          <UProgress
              v-if="uploadStore.totalKnown && progressPercent !== null"
              :model-value="progressPercent"
              size="sm"
              class="w-full"
          />
          <UProgress
              v-else
              size="sm"
              class="w-full"
          />
        </div>
      </div>

      <UTabs
          :items="tabItems"
          class="flex-1 flex flex-col min-h-0"
          :ui="{ content: 'flex-1 flex flex-col min-h-0' }"
      >
        <!-- Installed Plugins Tab -->
        <template #installed-plugins>
          <div class="flex-1 flex flex-col min-h-0 mt-4">
            <div class="flex flex-wrap items-center gap-3 mb-4">
              <UInput
                  v-model="installedPluginsSearch"
                  placeholder="Search plugins..."
                  icon="i-lucide-search"
                  class="w-64"
              />
              <USelectMenu
                  v-model="installedPluginsSourceFilter"
                  :items="sourceFilterOptions"
                  multiple
                  value-key="value"
                  placeholder="Source"
                  :search-input="false"
                  class="w-48"
              />
              <UCheckbox
                  v-model="installedPluginsNewerOnly"
                  label="Newer available"
              />
            </div>
            <UTable
                :data="filteredInstalledPlugins"
                :columns="installedPluginColumns"
                sticky
            >
              <template #name-cell="{ row }">
                <div class="flex flex-col">
                  <UTooltip :text="row.original.title || row.original.slug">
                    <div class="font-medium truncate block max-w-64">{{ row.original.title || row.original.slug }}</div>
                  </UTooltip>
                  <span class="text-xs text-neutral-500">{{ row.original.slug }}</span>
                </div>
              </template>

              <template #versions-cell="{ row }">
                <div
                    class="flex flex-wrap gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                    @click="openSitesModal('installed-plugins', row.original.slug, row.original.title)"
                >
                  <UBadge
                      v-for="v in row.original.versions.slice(0, 3)"
                      :key="v.version"
                      color="neutral"
                      variant="subtle"
                      size="sm"
                  >
                    {{ v.version }}
                  </UBadge>
                  <UBadge
                      v-if="row.original.versions.length > 3"
                      color="neutral"
                      variant="outline"
                      size="sm"
                  >
                    +{{ row.original.versions.length - 3 }} more
                  </UBadge>
                </div>
              </template>

              <template #latestVersion-cell="{ row }">
                <div
                    class="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity w-full"
                    @click="openSitesModal('installed-plugins', row.original.slug, row.original.title)"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <span v-if="row.original.latestVersion">{{ row.original.latestVersion }}</span>
                    <span v-else class="text-neutral-400">—</span>
                    <UBadge
                        v-if="row.original.upToDateCount > 0"
                        color="success"
                        variant="subtle"
                        size="sm"
                    >
                      {{ row.original.upToDateCount }}
                    </UBadge>
                    <UBadge
                        v-if="row.original.outdatedCount > 0"
                        color="warning"
                        variant="subtle"
                        size="sm"
                    >
                      {{ row.original.outdatedCount }}
                    </UBadge>
                  </div>
                  <UButton
                      v-if="row.original.outdatedInstallationIds.length > 0"
                      icon="i-lucide-arrow-up-circle"
                      color="warning"
                      size="xl"
                      variant="ghost"
                      class="ml-auto"
                      @click.stop="queuePackageUpdates('plugin', row.original.slug, row.original.outdatedInstallationIds)"
                  />
                </div>
              </template>

              <template #source-cell="{ row }">
                <UBadge
                    :color="row.original.source === 'wordpress.org' ? 'success' : row.original.source === 'external' ? 'neutral' : 'warning'"
                    variant="subtle"
                    size="sm"
                >
                  {{ row.original.source }}
                </UBadge>
              </template>
            </UTable>
          </div>
        </template>

        <!-- Installed Themes Tab -->
        <template #installed-themes>
          <div class="flex-1 flex flex-col min-h-0 mt-4">
            <div class="flex flex-wrap items-center gap-3 mb-4">
              <UInput
                  v-model="installedThemesSearch"
                  placeholder="Search themes..."
                  icon="i-lucide-search"
                  class="w-64"
              />
              <USelectMenu
                  v-model="installedThemesSourceFilter"
                  :items="sourceFilterOptions"
                  multiple
                  value-key="value"
                  placeholder="Source"
                  :search-input="false"
                  class="w-48"
              />
              <UCheckbox
                  v-model="installedThemesNewerOnly"
                  label="Newer available"
              />
            </div>
            <UTable
                :data="filteredInstalledThemes"
                :columns="installedThemeColumns"
                sticky
                class="flex-1 overflow-auto"
            >
              <template #name-cell="{ row }">
                <div class="flex flex-col">
                  <div class="font-medium">{{ row.original.title || row.original.slug }}</div>
                  <span class="text-xs text-neutral-500">{{ row.original.slug }}</span>
                </div>
              </template>

              <template #versions-cell="{ row }">
                <div
                    class="flex flex-wrap gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                    @click="openSitesModal('installed-themes', row.original.slug, row.original.title)"
                >
                  <UBadge
                      v-for="v in row.original.versions.slice(0, 3)"
                      :key="v.version"
                      color="neutral"
                      variant="subtle"
                      size="sm"
                  >
                    {{ v.version }}
                  </UBadge>
                  <UBadge
                      v-if="row.original.versions.length > 3"
                      color="neutral"
                      variant="outline"
                      size="sm"
                  >
                    +{{ row.original.versions.length - 3 }} more
                  </UBadge>
                </div>
              </template>

              <template #latestVersion-cell="{ row }">
                <div
                    class="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity w-full"
                    @click="openSitesModal('installed-themes', row.original.slug, row.original.title)"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <span v-if="row.original.latestVersion">{{ row.original.latestVersion }}</span>
                    <span v-else class="text-neutral-400">—</span>
                    <UBadge
                        v-if="row.original.upToDateCount > 0"
                        color="success"
                        variant="subtle"
                        size="sm"
                    >
                      {{ row.original.upToDateCount }}
                    </UBadge>
                    <UBadge
                        v-if="row.original.outdatedCount > 0"
                        color="warning"
                        variant="subtle"
                        size="sm"
                    >
                      {{ row.original.outdatedCount }}
                    </UBadge>
                  </div>
                  <UButton
                      v-if="row.original.outdatedInstallationIds.length > 0"
                      icon="i-lucide-arrow-up-circle"
                      color="warning"
                      variant="ghost"
                      size="xl"
                      class="ml-auto"
                      @click.stop="queuePackageUpdates('theme', row.original.slug, row.original.outdatedInstallationIds)"
                  />
                </div>
              </template>

              <template #source-cell="{ row }">
                <UBadge
                    :color="row.original.source === 'wordpress.org' ? 'success' : row.original.source === 'external' ? 'neutral' : 'warning'"
                    variant="subtle"
                    size="sm"
                >
                  {{ row.original.source }}
                </UBadge>
              </template>
            </UTable>
          </div>
        </template>

        <!-- Uploaded Plugins Tab -->
        <template #uploaded-plugins>
          <div class="flex-1 flex flex-col min-h-0 mt-4">
            <UTable
                :data="packages?.plugins || []"
                :columns="uploadedPluginColumns"
                sticky
                class="flex-1 overflow-auto"
            >
              <template #name-cell="{ row }">
                <div
                    class="flex flex-col cursor-pointer hover:text-primary transition-colors"
                    @click="downloadPackage('plugins', row.original.name)"
                >
                  <span class="font-medium">{{ row.original.title || row.original.name }}</span>
                  <span class="text-xs text-neutral-500">{{ row.original.slug }}</span>
                </div>
              </template>

              <template #versions-cell="{ row }">
                <div
                    class="flex flex-wrap items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    @click="openVersionsModal('plugins', row.original.name, row.original.title)"
                >
                  <UBadge
                      v-for="(version, index) in row.original.versions.slice(0, 3)"
                      :key="version"
                      :color="index === 0 ? 'primary' : 'neutral'"
                      :variant="index === 0 ? 'soft' : 'subtle'"
                      size="sm"
                  >
                    {{ version }}
                  </UBadge>
                  <UBadge
                      v-if="row.original.versions.length > 3"
                      color="neutral"
                      variant="subtle"
                      size="sm"
                  >
                    +{{ row.original.versions.length - 3 }} more
                  </UBadge>
                </div>
              </template>

              <template #installedVersions-cell="{ row }">
                <div
                    v-if="getInstalledPackageBySlug('installed-plugins', row.original.slug)"
                    class="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity w-full"
                    @click="openSitesModal('installed-plugins', row.original.slug, row.original.title)"
                >
                  <div class="flex flex-wrap gap-1 min-w-0">
                    <UBadge
                        v-for="v in getInstalledPackageBySlug('installed-plugins', row.original.slug).versions.slice(0, 2)"
                        :key="v.version"
                        color="neutral"
                        variant="subtle"
                        size="sm"
                    >
                      {{ v.version }}
                    </UBadge>
                    <UBadge
                        v-if="getInstalledPackageBySlug('installed-plugins', row.original.slug).versions.length > 2"
                        color="neutral"
                        variant="outline"
                        size="sm"
                    >
                      +{{ getInstalledPackageBySlug('installed-plugins', row.original.slug).versions.length - 2 }} more
                    </UBadge>
                  </div>
                  <UButton
                      v-if="getInstalledPackageBySlug('installed-plugins', row.original.slug).outdatedInstallationIds.length > 0"
                      icon="i-lucide-arrow-up-circle"
                      color="warning"
                      variant="ghost"
                      size="xl"
                      class="ml-auto"
                      @click.stop="queuePackageUpdates('plugin', row.original.slug, getInstalledPackageBySlug('installed-plugins', row.original.slug).outdatedInstallationIds)"
                  />
                </div>
                <span v-else class="text-neutral-400">—</span>
              </template>

              <template #uploadedAt-cell="{ row }">
                <span v-if="row.original.uploadedAt" :title="formatFullDate(row.original.uploadedAt)">
                  {{ formatRelativeTime(row.original.uploadedAt) }}
                </span>
                <span v-else class="text-neutral-400">N/A</span>
              </template>

              <template #actions-cell="{ row }">
                <UDropdownMenu :items="getActionItems('plugins', row.original)">
                  <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-more-horizontal"
                  />
                </UDropdownMenu>
              </template>
            </UTable>
          </div>
        </template>

        <!-- Uploaded Themes Tab -->
        <template #uploaded-themes>
          <div class="flex-1 flex flex-col min-h-0 mt-4">
            <UTable
                :data="packages?.themes || []"
                :columns="uploadedThemeColumns"
                sticky
                class="flex-1 overflow-auto"
            >
              <template #name-cell="{ row }">
                <div
                    class="flex flex-col cursor-pointer hover:text-primary transition-colors"
                    @click="downloadPackage('themes', row.original.name)"
                >
                  <span class="font-medium">{{ row.original.title || row.original.name }}</span>
                  <span class="text-xs text-neutral-500">{{ row.original.slug }}</span>
                </div>
              </template>

              <template #versions-cell="{ row }">
                <div
                    class="flex flex-wrap items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    @click="openVersionsModal('themes', row.original.name, row.original.title)"
                >
                  <UBadge
                      v-for="(version, index) in row.original.versions.slice(0, 3)"
                      :key="version"
                      :color="index === 0 ? 'primary' : 'neutral'"
                      :variant="index === 0 ? 'soft' : 'subtle'"
                      size="sm"
                  >
                    {{ version }}
                  </UBadge>
                  <UBadge
                      v-if="row.original.versions.length > 3"
                      color="neutral"
                      variant="subtle"
                      size="sm"
                  >
                    +{{ row.original.versions.length - 3 }} more
                  </UBadge>
                </div>
              </template>

              <template #installedVersions-cell="{ row }">
                <div
                    v-if="getInstalledPackageBySlug('installed-themes', row.original.slug)"
                    class="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity w-full"
                    @click="openSitesModal('installed-themes', row.original.slug, row.original.title)"
                >
                  <div class="flex flex-wrap gap-1 min-w-0">
                    <UBadge
                        v-for="v in getInstalledPackageBySlug('installed-themes', row.original.slug).versions.slice(0, 2)"
                        :key="v.version"
                        color="neutral"
                        variant="subtle"
                        size="sm"
                    >
                      {{ v.version }}
                    </UBadge>
                    <UBadge
                        v-if="getInstalledPackageBySlug('installed-themes', row.original.slug).versions.length > 2"
                        color="neutral"
                        variant="outline"
                        size="sm"
                    >
                      +{{ getInstalledPackageBySlug('installed-themes', row.original.slug).versions.length - 2 }} more
                    </UBadge>
                  </div>
                  <UButton
                      v-if="getInstalledPackageBySlug('installed-themes', row.original.slug).outdatedInstallationIds.length > 0"
                      icon="i-lucide-arrow-up-circle"
                      color="warning"
                      variant="ghost"
                      size="xl"
                      class="ml-auto"
                      @click.stop="queuePackageUpdates('theme', row.original.slug, getInstalledPackageBySlug('installed-themes', row.original.slug).outdatedInstallationIds)"
                  />
                </div>
                <span v-else class="text-neutral-400">—</span>
              </template>

              <template #uploadedAt-cell="{ row }">
                <span v-if="row.original.uploadedAt" :title="formatFullDate(row.original.uploadedAt)">
                  {{ formatRelativeTime(row.original.uploadedAt) }}
                </span>
                <span v-else class="text-neutral-400">N/A</span>
              </template>

              <template #actions-cell="{ row }">
                <UDropdownMenu :items="getActionItems('themes', row.original)">
                  <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-more-horizontal"
                  />
                </UDropdownMenu>
              </template>
            </UTable>
          </div>
        </template>
      </UTabs>

      <div
          v-if="isDragging"
          class="absolute inset-0 z-30 bg-primary/10 border-2 border-dashed border-primary rounded-xl flex items-center justify-center"
      >
        <div class="text-center px-4">
          <UIcon name="i-lucide-upload-cloud" class="size-10 text-primary mx-auto mb-2"/>
          <p class="font-medium text-primary">Drop ZIP files to upload</p>
          <p class="text-xs text-primary/80 mt-1">Plugins and themes only, max 100MB each</p>
        </div>
      </div>
    </div>

    <USlideover
        v-model:open="isSlideoverOpen"
        title="Upload Log"
        side="right"
    >
      <template #body>
        <div class="space-y-1 font-mono text-xs">
          <div
              v-for="(log, index) in uploadStore.logs"
              :key="index"
              class="py-1 px-2 rounded"
              :class="{
              'bg-error/10 text-error': log.type === 'error',
              'bg-success/10 text-success': log.type === 'complete',
              'bg-info/10 text-info': log.type === 'progress',
              'text-neutral-600 dark:text-neutral-400': log.type === 'log'
            }"
          >
            <span class="text-neutral-400 mr-2">{{ log.timestamp.toLocaleTimeString() }}</span>
            {{ log.message }}
          </div>
          <div
              v-if="uploadStore.logs.length === 0"
              class="text-neutral-400 text-center py-4"
          >
            No upload logs yet
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
              label="Clear"
              color="neutral"
              variant="outline"
              :disabled="uploadStore.isUploading"
              @click="uploadStore.clearUploads()"
          />
          <UButton
              label="Close"
              @click="isSlideoverOpen = false"
          />
        </div>
      </template>
    </USlideover>

    <UModal v-model:open="isVersionsModalOpen" :title="versionsModalTitle">
      <template #body>
        <div class="space-y-4">
          <UTable
              :data="versions"
              :columns="versionColumns"
              class="max-h-[60vh] overflow-auto"
          >
            <template #selected-header>
              <UCheckbox
                  :model-value="allVersionsSelected"
                  @update:model-value="toggleAllVersions"
              />
            </template>

            <template #selected-cell="{ row }">
              <UCheckbox
                  :model-value="selectedVersionIds.includes(row.original.id)"
                  @update:model-value="(value) => toggleVersionRow(row.original.id, Boolean(value))"
              />
            </template>

            <template #uploadedAt-cell="{ row }">
              <span :title="formatFullDate(row.original.uploadedAt)">
                {{ formatRelativeTime(row.original.uploadedAt) }}
              </span>
            </template>

            <template #actions-cell="{ row }">
              <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-download"
                  @click="downloadPackage(activeVersionsKind, activeVersionsName, row.original.id)"
              />
            </template>
          </UTable>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-between w-full">
          <UButton
              label="Delete Selected"
              color="error"
              variant="outline"
              :disabled="!selectedVersionIds.length || isDeletingSelected"
              :loading="isDeletingSelected"
              @click="deleteSelectedVersions"
          />

          <div class="flex gap-2">
            <UButton label="Close" @click="isVersionsModalOpen = false"/>
          </div>
        </div>
      </template>
    </UModal>

    <PackageSitesModal
        v-model:open="isSitesModalOpen"
        :package-details="sitesModalPackageDetails"
    />
  </NuxtLayout>
</template>

<script setup lang="ts">
import type {DropdownMenuItem, TableColumn} from '@nuxt/ui'
import {formatDistanceToNow} from 'date-fns'
import {useQuery, useQueryClient} from '@tanstack/vue-query'
import {watchDebounced, watchThrottled} from "@vueuse/core";

definePageMeta({
  title: 'Plugins & Themes'
})

type PackageKind = 'plugins' | 'themes'

type UploadedPackageRow = {
  id: string
  name: string
  title: string | null
  slug: string
  version: string
  uploadedAt: string
  versionsCount: number
  versions: string[]
}

type InstalledPackageRow = {
  slug: string
  name: string
  title: string | null
  versions: {
    version: string
    sitesCount: number
  }[]
  source: string
  latestVersion: string | null
  hasNewerVersion: boolean
  totalInstallations: number
  upToDateCount: number
  outdatedCount: number
  outdatedInstallationIds: string[]
}

type VersionsResponse = {
  versions: VersionRow[]
}

type VersionRow = {
  id: string
  name: string
  title: string | null
  slug: string
  version: string
  originalFilename: string
  uploadedAt: string
}

type InstalledPackageKind = 'installed-plugins' | 'installed-themes'

const toast = useToast()
const uploadStore = usePackageUploadStore()
const packageJobStore = usePackageJobStore()
const queryClient = useQueryClient()

// Fetch uploaded packages
const {data: packages, refetch: refetchPackages} = useQuery<{
  plugins: UploadedPackageRow[],
  themes: UploadedPackageRow[]
}>({
  queryKey: ['packages-list'],
  queryFn: () => useApiClient()('/packages/list')
})

// Fetch installed plugins and themes
const {data: installedPluginsData, refetch: refetchInstalledPlugins} = useQuery<{ plugins: InstalledPackageRow[] }>({
  queryKey: ['installed-plugins'],
  queryFn: () => useApiClient()('/packages/installed-plugins')
})
const {data: installedThemesData, refetch: refetchInstalledThemes} = useQuery<{ themes: InstalledPackageRow[] }>({
  queryKey: ['installed-themes'],
  queryFn: () => useApiClient()('/packages/installed-themes')
})

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024

const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const dragDepth = ref(0)
const isSubmitting = ref(false)
const isSlideoverOpen = ref(false)

const isVersionsModalOpen = ref(false)
const activeVersionsKind = ref<PackageKind>('plugins')
const activeVersionsName = ref('')
const activeVersionsTitle = ref<string | null>(null)
const versions = ref<VersionRow[]>([])
const selectedVersionIds = ref<string[]>([])
const isDeletingSelected = ref(false)

// Sites modal state (for viewing sites with a specific plugin/theme)
const isSitesModalOpen = ref(false)
const activeSitesKind = ref<InstalledPackageKind>('installed-plugins')
const activeSitesSlug = ref('')
const activeSitesTitle = ref<string | null>(null)

// Filters for installed plugins/themes
const installedPluginsSearch = ref('')
const installedPluginsNewerOnly = ref(false)
const installedThemesSearch = ref('')
const installedThemesNewerOnly = ref(false)

// Source filter options
const sourceFilterOptions = [
  {label: 'WordPress.org', value: 'wordpress.org'},
  {label: 'External', value: 'external'}
]

// Source filters - default to both selected
const installedPluginsSourceFilter = ref(['wordpress.org', 'external'])
const installedThemesSourceFilter = ref(['wordpress.org', 'external'])

const tabItems = [
  {
    label: 'Installed plugins',
    icon: 'i-lucide-plug',
    slot: 'installed-plugins'
  },
  {
    label: 'Installed themes',
    icon: 'i-lucide-palette',
    slot: 'installed-themes'
  },
  {
    label: 'Uploaded plugins',
    icon: 'i-lucide-upload',
    slot: 'uploaded-plugins'
  },
  {
    label: 'Uploaded themes',
    icon: 'i-lucide-upload',
    slot: 'uploaded-themes'
  }
]

// Columns for installed plugins
const installedPluginColumns: TableColumn<InstalledPackageRow>[] = [
  {
    accessorKey: 'name',
    header: 'Plugin'
  },
  {
    id: 'versions',
    header: 'Installed Versions'
  },
  {
    accessorKey: 'totalInstallations',
    header: 'Sites'
  },
  {
    accessorKey: 'latestVersion',
    header: 'Latest'
  },
  {
    accessorKey: 'source',
    header: 'Source'
  }
]

// Columns for installed themes
const installedThemeColumns: TableColumn<InstalledPackageRow>[] = [
  {
    accessorKey: 'name',
    header: 'Theme'
  },
  {
    id: 'versions',
    header: 'Installed Versions'
  },
  {
    accessorKey: 'totalInstallations',
    header: 'Sites'
  },
  {
    accessorKey: 'latestVersion',
    header: 'Latest'
  },
  {
    accessorKey: 'source',
    header: 'Source'
  }
]

// Columns for uploaded plugins
const uploadedPluginColumns: TableColumn<UploadedPackageRow>[] = [
  {
    accessorKey: 'name',
    header: 'Plugin'
  },
  {
    id: 'versions',
    header: 'Uploaded versions'
  },
  {
    id: 'installedVersions',
    header: 'Installed versions'
  },
  {
    accessorKey: 'uploadedAt',
    header: 'Uploaded'
  },
  {
    id: 'actions',
    header: '',
    size: 0,
    meta: {class: {td: 'w-2'}}
  }
]

// Columns for uploaded themes
const uploadedThemeColumns: TableColumn<UploadedPackageRow>[] = [
  {
    accessorKey: 'name',
    header: 'Theme'
  },
  {
    id: 'versions',
    header: 'Uploaded versions'
  },
  {
    id: 'installedVersions',
    header: 'Installed versions'
  },
  {
    accessorKey: 'uploadedAt',
    header: 'Uploaded'
  },
  {
    id: 'actions',
    header: '',
    size: 0,
    meta: {class: {td: 'w-2'}}
  }
]

const versionColumns: TableColumn<VersionRow>[] = [
  {
    id: 'selected',
    header: '',
    size: 0,
    meta: {class: {td: 'w-2'}}
  },
  {
    accessorKey: 'version',
    header: 'Version'
  },
  {
    accessorKey: 'uploadedAt',
    header: 'Uploaded'
  },
  {
    id: 'actions',
    header: '',
    size: 0,
    meta: {class: {td: 'w-2'}}
  }
]

// Filtered installed plugins
const filteredInstalledPlugins = computed(() => {
  let result = installedPluginsData.value?.plugins || []

  // Filter by source
  if (installedPluginsSourceFilter.value.length > 0) {
    result = result.filter(p => installedPluginsSourceFilter.value.includes(p.source))
  }

  if (installedPluginsNewerOnly.value) {
    result = result.filter(p => p.hasNewerVersion)
  }

  if (installedPluginsSearch.value.trim()) {
    const search = installedPluginsSearch.value.toLowerCase().trim()
    result = result.filter(p =>
        (p.title?.toLowerCase().includes(search)) ||
        p.slug.toLowerCase().includes(search) ||
        p.name.toLowerCase().includes(search)
    )
  }

  return result
})

// Filtered installed themes
const filteredInstalledThemes = computed(() => {
  let result = installedThemesData.value?.themes || []

  // Filter by source
  if (installedThemesSourceFilter.value.length > 0) {
    result = result.filter(t => installedThemesSourceFilter.value.includes(t.source))
  }

  if (installedThemesNewerOnly.value) {
    result = result.filter(t => t.hasNewerVersion)
  }

  if (installedThemesSearch.value.trim()) {
    const search = installedThemesSearch.value.toLowerCase().trim()
    result = result.filter(t =>
        (t.title?.toLowerCase().includes(search)) ||
        t.slug.toLowerCase().includes(search) ||
        t.name.toLowerCase().includes(search)
    )
  }

  return result
})

const displayProgress = computed(() => uploadStore.progress || uploadStore.lastCompletedProgress)

const getInstalledPackageBySlug = (kind: InstalledPackageKind, slug: string) => {
  const data = kind === 'installed-plugins' ? installedPluginsData.value?.plugins : installedThemesData.value?.themes
  return data?.find(p => p.slug === slug)
}

const progressPercent = computed(() => {
  if (!displayProgress.value || displayProgress.value.total === 0) return null
  return Math.round((displayProgress.value.current / displayProgress.value.total) * 100)
})

const statusText = computed(() => {
  const progress = displayProgress.value
  if (!progress) return 'Upload completed'
  if (uploadStore.isUploading) {
    return `Uploading ${progress.total} file(s)...`
  }
  return 'Upload completed'
})

const versionsModalTitle = computed(() => {
  const typeLabel = activeVersionsKind.value === 'plugins' ? 'Plugin' : 'Theme'
  return `${typeLabel} Versions: ${activeVersionsTitle.value || activeVersionsName.value}`
})

const sitesModalPackageDetails = computed(() => {
  if (!activeSitesSlug.value) return null
  return {
    kind: activeSitesKind.value,
    slug: activeSitesSlug.value,
    title: activeSitesTitle.value
  }
})

const allVersionsSelected = computed(() => {
  return versions.value.length > 0 && versions.value.every(row => selectedVersionIds.value.includes(row.id))
})

const getActionItems = (kind: PackageKind, row: UploadedPackageRow): DropdownMenuItem[][] => [
  [
    {
      label: 'Download latest',
      icon: 'i-lucide-download',
      onSelect: () => downloadPackage(kind, row.name)
    },
    {
      label: 'Versions',
      icon: 'i-lucide-history',
      onSelect: () => openVersionsModal(kind, row.name, row.title)
    },
    {
      label: 'Sites with ' + (kind === 'plugins' ? 'plugin' : 'theme'),
      icon: 'i-lucide-layout-list',
      onSelect: () => openSitesModal(kind === 'plugins' ? 'installed-plugins' : 'installed-themes', row.slug, row.title)
    }
  ],
  [
    {
      label: 'Delete',
      icon: 'i-lucide-trash',
      color: 'error' as const,
      onSelect: () => deleteAllVersions(kind, row.name)
    }
  ]
]

const openFilePicker = () => {
  fileInputRef.value?.click()
}

const onFileInputChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files ? Array.from(target.files) : []
  await uploadFiles(files)
  target.value = ''
}

const onDragEnter = (event: DragEvent) => {
  if (!hasDraggedFiles(event)) return
  dragDepth.value += 1
  isDragging.value = true
}

const onDragOver = (event: DragEvent) => {
  if (!hasDraggedFiles(event)) return
  event.dataTransfer!.dropEffect = 'copy'
}

const onDragLeave = (event: DragEvent) => {
  if (!hasDraggedFiles(event)) return
  dragDepth.value = Math.max(0, dragDepth.value - 1)
  if (dragDepth.value === 0) {
    isDragging.value = false
  }
}

const onDrop = async (event: DragEvent) => {
  if (!hasDraggedFiles(event)) return
  dragDepth.value = 0
  isDragging.value = false

  const droppedFiles = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : []
  await uploadFiles(droppedFiles)
}

const uploadFiles = async (files: File[]) => {
  if (!files.length) return

  const validFiles: File[] = []

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast.add({
        title: 'Ignored file',
        description: `${file.name} is not a ZIP archive.`,
        color: 'warning'
      })
      continue
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.add({
        title: 'File too large',
        description: `${file.name} exceeds the 100MB limit.`,
        color: 'error'
      })
      continue
    }

    validFiles.push(file)
  }

  if (!validFiles.length) return

  isSubmitting.value = true
  try {
    await uploadStore.startUpload(validFiles)
    await refetchPackages()
    isSlideoverOpen.value = true
  } finally {
    isSubmitting.value = false
  }
}

const hasDraggedFiles = (event: DragEvent) => {
  return !!event.dataTransfer?.types?.includes('Files')
}

const downloadPackage = (kind: PackageKind, name: string, id?: string) => {
  const url = new URL(`/api/packages/${kind}/${encodeURIComponent(name)}/download`, window.location.origin)
  if (id) {
    url.searchParams.set('id', id)
  }
  window.location.href = url.toString()
}

const openVersionsModal = async (kind: PackageKind, name: string, title: string | null) => {
  activeVersionsKind.value = kind
  activeVersionsName.value = name
  activeVersionsTitle.value = title
  await loadVersions()
  isVersionsModalOpen.value = true
}

const loadVersions = async () => {
  const response = await queryClient.fetchQuery({
    queryKey: ['package-versions', activeVersionsKind.value, activeVersionsName.value],
    queryFn: () => useApiClient()<VersionsResponse>(`/packages/${activeVersionsKind.value}/${encodeURIComponent(activeVersionsName.value)}/versions`),
    staleTime: 0
  })
  versions.value = response.versions
  selectedVersionIds.value = []
}

const openSitesModal = (kind: InstalledPackageKind, slug: string, title: string | null) => {
  activeSitesKind.value = kind
  activeSitesSlug.value = slug
  activeSitesTitle.value = title
  isSitesModalOpen.value = true
}

const queuePackageUpdates = async (kind: 'plugin' | 'theme', slug: string, installationIds: string[]) => {
  const uniqueInstallationIds = [...new Set(installationIds.filter(Boolean))]
  if (uniqueInstallationIds.length === 0) {
    toast.add({
      title: 'Nothing to update',
      description: 'All selected sites are already up to date.',
      color: 'neutral'
    })
    return
  }

  try {
    await useApiClient()('/packages/jobs', {
      method: 'POST',
      body: {
        jobs: uniqueInstallationIds.map(installationId => ({
          installationId,
          kind,
          slug,
          operation: 'update'
        }))
      }
    })

    toast.add({
      title: 'Updates queued',
      description: `${uniqueInstallationIds.length} update job(s) added to the queue.`,
      color: 'success'
    })
    packageJobStore.refreshStatus()
  } catch (error: any) {
    toast.add({
      title: 'Failed to queue updates',
      description: error?.data?.message || error?.message || 'Unknown error',
      color: 'error'
    })
  }
}

const deleteAllVersions = async (kind: PackageKind, name: string) => {
  const confirmed = window.confirm(`Delete all versions of "${name}"? This cannot be undone.`)
  if (!confirmed) return

  await useApiClient()(`/packages/${kind}/${encodeURIComponent(name)}`, {
    method: 'DELETE'
  })

  toast.add({
    title: 'Deleted',
    description: `${name} and all its versions were deleted.`,
    color: 'success'
  })

  if (isVersionsModalOpen.value && activeVersionsKind.value === kind && activeVersionsName.value === name) {
    isVersionsModalOpen.value = false
  }

  await refetchPackages()
}

const toggleAllVersions = (value: boolean | 'indeterminate') => {
  if (value === true) {
    selectedVersionIds.value = versions.value.map(row => row.id)
    return
  }
  selectedVersionIds.value = []
}

const toggleVersionRow = (id: string, checked: boolean) => {
  if (checked) {
    if (!selectedVersionIds.value.includes(id)) {
      selectedVersionIds.value.push(id)
    }
    return
  }

  selectedVersionIds.value = selectedVersionIds.value.filter(item => item !== id)
}

const deleteSelectedVersions = async () => {
  if (!selectedVersionIds.value.length) return

  const confirmed = window.confirm(`Delete ${selectedVersionIds.value.length} selected version(s)? This cannot be undone.`)
  if (!confirmed) return

  isDeletingSelected.value = true
  try {
    await useApiClient()(`/packages/${activeVersionsKind.value}/${encodeURIComponent(activeVersionsName.value)}/versions`, {
      method: 'DELETE',
      body: {
        ids: selectedVersionIds.value
      }
    })

    toast.add({
      title: 'Deleted versions',
      description: `${selectedVersionIds.value.length} version(s) deleted.`,
      color: 'success'
    })

    await loadVersions()
    await refetchPackages()

    if (versions.value.length === 0) {
      isVersionsModalOpen.value = false
    }
  } finally {
    isDeletingSelected.value = false
  }
}

const formatRelativeTime = (dateStr: string) => {
  return formatDistanceToNow(new Date(dateStr), {addSuffix: true})
}

const formatFullDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString()
}

watchThrottled(() => packageJobStore.lastCompletedProgress?.updatedAt, (updatedAt, previous) => {
  if (updatedAt && updatedAt !== previous) {
    refetchInstalledPlugins()
    refetchInstalledThemes()
    refetchPackages()
  }
}, { throttle: 5000 })
</script>
