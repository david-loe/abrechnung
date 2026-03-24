<template>
  <div v-if="APP_DATA" class="d-lg-flex settings-page">
    <div class="settings-backdrop" :class="{ 'settings-backdrop--open': mobileNavigationOpen }" @click="mobileNavigationOpen = false"></div>

    <aside
      class="settings-sidebar"
      :class="{ 'settings-sidebar--open': mobileNavigationOpen }"
      :aria-hidden="sidebarHidden"
      :inert="sidebarHidden">
      <div
        class="settings-sidebar__inner offcanvas-body pt-lg-3"
        :class="{ 'settings-sidebar__inner--desktop-scroll': desktopSidebarShouldScroll }">
        <div class="d-flex align-items-center justify-content-between d-lg-none mb-3">
          <h2 class="h5 mb-0">{{ t('labels.contents') }}</h2>
          <button
            class="btn btn-light btn-sm"
            type="button"
            :tabindex="sidebarHidden ? -1 : undefined"
            @click="mobileNavigationOpen = false">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <div class="settings-sidebar__search">
          <label class="form-label visually-hidden" for="settings-navigation-search">{{ t('labels.search') }}</label>
          <input
            id="settings-navigation-search"
            v-model="searchQuery"
            class="form-control"
            type="search"
            :placeholder="`${t('labels.search')}...`"
            :tabindex="sidebarHidden ? -1 : undefined" >
        </div>

        <div class="settings-sidebar__content">
          <template v-for="group in visibleGroups" :key="group.group.id">
            <div class="small text-uppercase text-body-secondary fw-semibold mt-3 mb-2">{{ t(group.group.labelKey) }}</div>
            <ul class="nav nav-pills flex-column gap-1">
              <li v-for="item in group.sections" :key="item.section.id" class="nav-item">
                <button
                  class="nav-link w-100 text-start"
                  :class="item.section.id === activeSection.id ? 'active' : 'link-body-emphasis'"
                  type="button"
                  :tabindex="sidebarHidden ? -1 : undefined"
                  @click="navigateToSection(item.section)">
                  {{ t(item.section.labelKey) }}
                </button>
                <div v-if="item.subsections.length" class="ps-3 pt-1">
                  <button
                    v-for="subsection in item.subsections"
                    :key="subsection.id"
                    class="btn btn-sm w-100 text-start settings-subsection-button"
                    :class="item.section.id === activeSection.id && activeHash === subsection.id ? 'settings-subsection-button--active' : ''"
                    type="button"
                    :tabindex="sidebarHidden ? -1 : undefined"
                    @click="navigateToSection(item.section, subsection.id)">
                    {{ t(subsection.labelKey) }}
                  </button>
                </div>
              </li>
            </ul>
          </template>

          <p v-if="!visibleGroups.length" class="text-body-secondary mb-0 mt-2">{{ t('labels.noMatchingSettings') }}</p>
        </div>
      </div>
    </aside>

    <div class="flex-grow-1" id="settingsContent">
      <div ref="settingsContainerRef" class="container px-lg-4 py-3">
        <div class="d-lg-none mb-2">
          <nav aria-label="breadcrumb">
            <ol class="breadcrumb small mb-0">
              <li class="breadcrumb-item">
                <button
                  class="btn btn-link btn-sm p-0 align-baseline text-decoration-none"
                  type="button"
                  @click="mobileNavigationOpen = true">
                  {{ t('labels.settings') }}
                </button>
              </li>
              <li class="breadcrumb-item active" aria-current="page">{{ t(activeGroup.labelKey) }}</li>
            </ol>
          </nav>
        </div>

        <div class="d-flex align-items-start justify-content-between gap-3 mb-4">
          <div>
            <small class="d-none d-lg-block text-body-secondary text-uppercase fw-semibold mb-1">{{ t(activeGroup.labelKey) }}</small>
            <h2 class="mb-0">{{ t(activeSection.labelKey) }}</h2>
          </div>
        </div>

        <RouterView />
      </div>
    </div>

    <div class="invisible d-none d-lg-block" :style="{ width: rightMargin }"></div>
  </div>
</template>

<script lang="ts" setup>
import APP_LOADER from '@/dataLoader.js'
import { bp } from '@/helper'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute, useRouter } from 'vue-router'
import {
  type AdminSearchKeywordKey,
  adminSectionGroups,
  adminSections,
  defaultAdminSection,
  getAdminSectionById,
  type AdminSection,
  type AdminSectionId
} from './adminSections'

const { t, tm } = useI18n()
const route = useRoute()
const router = useRouter()

const APP_DATA = APP_LOADER.data
const searchQuery = ref('')
const mobileNavigationOpen = ref(false)
const viewportWidth = ref(window.innerWidth)
const desktopSidebarShouldScroll = ref(false)
const navBarOffset = ref(0)
const settingsContainerRef = ref<HTMLElement | null>(null)
let settingsResizeObserver: ResizeObserver | null = null
let navBarResizeObserver: ResizeObserver | null = null

const isCompactViewport = computed(() => viewportWidth.value < bp.lg)
const sidebarHidden = computed(() => !mobileNavigationOpen.value && isCompactViewport.value)
const activeHash = computed(() => route.hash.replace(/^#/, ''))
const activeSection = computed(() => getAdminSectionById(route.meta.adminSectionId as AdminSectionId | undefined) ?? defaultAdminSection)
const activeGroup = computed(() => adminSectionGroups.find((group) => group.id === activeSection.value.group) ?? adminSectionGroups[0])
const normalizedSearchQuery = computed(() => normalize(searchQuery.value.trim()))
const rightMargin = computed(() => `${navBarOffset.value}px`)

function normalize(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

function matchesSearch(value: string) {
  return normalize(value).includes(normalizedSearchQuery.value)
}

function getKeywords(keywordKey: AdminSearchKeywordKey | undefined) {
  if (!keywordKey) {
    return []
  }

  const message = tm(keywordKey)
  if (!Array.isArray(message)) {
    return typeof message === 'string' ? [message] : []
  }

  return message.filter((keyword): keyword is string => typeof keyword === 'string')
}

const visibleGroups = computed(() =>
  adminSectionGroups
    .map((group) => {
      const sections = adminSections
        .filter((section) => section.group === group.id)
        .map((section) => {
          const sectionMatches =
            !normalizedSearchQuery.value ||
            matchesSearch(t(section.labelKey)) ||
            getKeywords(section.keywordKey).some((keyword) => matchesSearch(keyword))

          const subsections = !normalizedSearchQuery.value
            ? activeSection.value.id === section.id
              ? [...(section.subsections ?? [])]
              : []
            : (section.subsections ?? []).filter(
                (subsection) => matchesSearch(t(subsection.labelKey)) || subsection.keywords.some((keyword) => matchesSearch(keyword))
              )

          const visible = !normalizedSearchQuery.value || sectionMatches || subsections.length > 0

          return { section, visible, subsections }
        })
        .filter((section) => section.visible)

      return { group, sections }
    })
    .filter((group) => group.sections.length > 0)
)

async function navigateToSection(section: AdminSection, subsectionId?: string) {
  const hash = subsectionId ? `#${subsectionId}` : ''
  const isCurrentTarget = route.name === section.routeName && route.hash === hash

  mobileNavigationOpen.value = false

  if (isCurrentTarget) {
    if (hash) {
      document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    return
  }

  await router.push({ name: section.routeName, hash: hash || undefined })
}

function updateDesktopSidebarLayout() {
  if (viewportWidth.value < bp.lg) {
    desktopSidebarShouldScroll.value = false
    return
  }

  const contentEl = settingsContainerRef.value

  if (!contentEl) {
    return
  }

  const contentRect = contentEl.getBoundingClientRect()
  desktopSidebarShouldScroll.value = contentRect.height <= window.innerHeight - contentRect.top
}

function updateRightMargin() {
  const navBarContent = document.getElementById('navBarContent')
  if (!navBarContent) {
    navBarOffset.value = 0
    return
  }

  const { right, width } = navBarContent.getBoundingClientRect()
  navBarOffset.value = Math.max(right - width, 0)
}

function handleResize() {
  viewportWidth.value = window.innerWidth
  if (viewportWidth.value >= bp.lg) {
    mobileNavigationOpen.value = false
  }
  updateDesktopSidebarLayout()
  updateRightMargin()
}

watch(
  () => route.fullPath,
  async () => {
    mobileNavigationOpen.value = false
    await nextTick()
    updateDesktopSidebarLayout()
  }
)

onMounted(() => {
  window.addEventListener('resize', handleResize)
  settingsResizeObserver = new ResizeObserver(() => updateDesktopSidebarLayout())
  if (settingsContainerRef.value) {
    settingsResizeObserver.observe(settingsContainerRef.value)
  }

  navBarResizeObserver = new ResizeObserver(() => updateRightMargin())
  const navBarContent = document.getElementById('navBarContent')
  if (navBarContent) {
    navBarResizeObserver.observe(navBarContent)
  }
  updateDesktopSidebarLayout()
  updateRightMargin()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  settingsResizeObserver?.disconnect()
  navBarResizeObserver?.disconnect()
})

await APP_LOADER.loadData()
</script>

<style scoped>
.settings-page {
  min-height: calc(100vh - 120px);
  position: relative;
}

.settings-backdrop {
  background: rgba(0, 0, 0, 0.35);
  inset: 0;
  opacity: 0;
  pointer-events: none;
  position: fixed;
  transition: opacity 0.2s ease;
  z-index: 1040;
}

.settings-backdrop--open {
  opacity: 1;
  pointer-events: auto;
}

.settings-sidebar {
  inset: 0 auto 0 0;
  max-width: min(86vw, 320px);
  pointer-events: none;
  position: fixed;
  transform: translateX(-100%);
  transition: transform 0.25s ease;
  width: 100%;
  z-index: 1050;
}

.settings-sidebar--open {
  pointer-events: auto;
  transform: translateX(0);
}

.settings-sidebar__inner {
  background: var(--bs-body-bg);
  border-right: 1px solid var(--bs-border-color);
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: min(86vw, 320px);
  overflow: hidden;
  padding: 1rem;
}

.settings-sidebar__search {
  flex: 0 0 auto;
  margin-bottom: 1rem;
}

.settings-sidebar__content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.settings-subsection-button {
  color: var(--bs-secondary-color);
  padding-left: 0.75rem;
}

.settings-subsection-button:hover,
.settings-subsection-button--active {
  background-color: rgba(var(--bs-primary-rgb), 0.1);
  color: var(--bs-primary);
}

@media (min-width: 992px) {
  .settings-backdrop {
    display: none;
  }

  .settings-sidebar {
    flex: 0 0 18rem;
    max-width: none;
    pointer-events: auto;
    position: static;
    transform: none;
    z-index: 1;
  }

  .settings-sidebar__inner {
    background: transparent;
    border-right: 0;
    height: auto;
    min-width: 0;
    overflow: visible;
    padding: 1rem 0 1rem 1rem;
  }

  .settings-sidebar__inner--desktop-scroll {
    height: calc(100vh - 120px);
    overflow: hidden;
  }

  .settings-sidebar__content {
    overflow: visible;
  }

  .settings-sidebar__inner--desktop-scroll .settings-sidebar__content {
    overflow-y: auto;
  }
}
</style>
