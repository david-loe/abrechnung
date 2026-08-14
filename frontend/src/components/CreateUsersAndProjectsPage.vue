<template>
  <main v-if="APP_DATA" class="container py-4">
    <h1 class="h3 mb-4">{{ t('accesses.create/usersAndProjects') }}</h1>

    <ul class="nav nav-tabs mb-4">
      <li class="nav-item">
        <button type="button" class="nav-link" :class="{ active: activeTab === 'users' }" @click="activeTab = 'users'">
          {{ t('labels.users') }}
        </button>
      </li>
      <li class="nav-item">
        <button type="button" class="nav-link" :class="{ active: activeTab === 'projects' }" @click="activeTab = 'projects'">
          {{ t('labels.projects') }}
        </button>
      </li>
    </ul>

    <template v-if="activeTab === 'users'">
      <section>
        <h2 class="h4 mb-3">{{ t('labels.userList') }}</h2>
        <Suspense>
          <UserList ref="userList" class="mb-5" endpoint="create/user" db-key-prefix="create" create-only />
        </Suspense>
      </section>
      <section>
        <h2 class="h4 mb-3">{{ t('labels.userImport') }}</h2>
        <CSVImport
          endpoint="create/user/bulk"
          :transformers="[
            { path: 'projects.assigned', key: 'identifier', array: APP_DATA.projects ?? [] },
            { path: 'settings.organisation', key: 'name', array: APP_DATA.organisations },
            { path: 'loseAccessAt', fn: convertGermanDateToHTMLDate }
          ]"
          :template-fields="[
            'name.givenName',
            'name.familyName',
            'email',
            'fk.magiclogin',
            'loseAccessAt',
            'projects.assigned',
            'settings.organisation'
          ]"
          @submitted="userListRef?.loadFromServer()" />
      </section>
    </template>

    <template v-else>
      <section>
        <h2 class="h4 mb-3">{{ t('labels.projectList') }}</h2>
        <Suspense>
          <ProjectList ref="projectList" class="mb-5" endpoint="create/project" db-key-prefix="create" create-only />
        </Suspense>
      </section>
      <section>
        <h2 class="h4 mb-3">{{ t('labels.projectImport') }}</h2>
        <CSVImport
          endpoint="create/project/bulk"
          :transformers="[{ path: 'organisation', key: 'name', array: APP_DATA.organisations }]"
          :template-fields="['identifier', 'name', 'organisation', 'budget.amount']"
          @submitted="projectListRef?.loadFromServer()" />
      </section>
    </template>
  </main>
</template>

<script lang="ts" setup>
import { convertGermanDateToHTMLDate } from 'abrechnung-common/utils/scripts.js'
import { ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import CSVImport from '@/components/elements/CSVImport.vue'
import ProjectList from '@/components/settings/elements/ProjectList.vue'
import UserList from '@/components/settings/elements/UserList.vue'
import APP_LOADER from '@/dataLoader.js'

const { t } = useI18n()
await APP_LOADER.loadData()
const APP_DATA = APP_LOADER.data
const activeTab = ref<'users' | 'projects'>('users')
const userListRef = useTemplateRef<{ loadFromServer: () => void }>('userList')
const projectListRef = useTemplateRef<{ loadFromServer: () => void }>('projectList')
</script>
