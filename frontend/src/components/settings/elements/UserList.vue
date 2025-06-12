<template>
  <div>
    <template v-if="userToEdit">
      <ModalComponent
        :header="`API Key (${formatter.name(userToEdit.name)})`"
        @afterClose=";($refs.apiKeyForm as any).resetForm()"
        ref="modal">
        <ApiKeyForm
          :user="userToEdit"
          ref="apiKeyForm"
          endpoint="admin/user/httpBearer"
          @cancel=";($refs.modal as any).hideModal()"
          @new-key="
            () => {
              loadFromServer()
              _showForm = false
            }
          "
          include-user-id-in-request>
        </ApiKeyForm>
      </ModalComponent>
    </template>
    <ListElement class="mb-3" ref="list" endpoint="admin/user" :filter="filter" :headers="headers">
      <template #header-name="header">
        <div class="filter-column">
          {{ header.text }}
          <span style="cursor: pointer" @click="(e) => clickFilter('name', e)">
            <i v-if="showFilter.name" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="showFilter.name" @click.stop>
            <input
              type="text"
              class="form-control"
              v-model="(filter['name.givenName'] as any).$regex"
              :placeholder="t('labels.givenName')" />
            <input
              type="text"
              class="form-control"
              v-model="(filter['name.familyName'] as any).$regex"
              :placeholder="t('labels.familyName')" />
          </div>
        </div>
      </template>

      <template #header-email="header">
        <div class="filter-column">
          {{ header.text }}
          <span style="cursor: pointer" @click="(e) => clickFilter('email', e)">
            <i v-if="showFilter.email" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="showFilter.email" @click.stop>
            <input type="text" class="form-control" v-model="(filter.email as any).$regex" />
          </div>
        </div>
      </template>

      <template #item-name="{ name }">
        {{ formatter.name(name) }}
      </template>
      <template #item-projects.assigned="{ projects }">
        <span class="me-1" v-for="p in projects.assigned">{{ p.identifier }}</span>
      </template>
      <template #item-access="user">
        <template v-for="access of accesses">
          <span v-if="user.access[access]" class="ms-3" :title="$t('accesses.' + access)">
            <i v-for="icon of APP_DATA!.displaySettings.accessIcons[access]" :class="'bi bi-' + icon"></i>
          </span>
        </template>
      </template>
      <template #item-buttons="user">
        <button type="button" class="btn btn-light btn-sm" @click="showForm(user)">
          <div class="d-none d-md-block">
            <i class="bi bi-pencil"></i>
          </div>
          <i class="bi bi-pencil d-block d-md-none"></i>
        </button>
        <button type="button" class="btn btn-danger btn-sm ms-2" @click="deleteUser(user)">
          <div class="d-none d-md-block">
            <i class="bi bi-trash"></i>
          </div>
          <i class="bi bi-trash d-block d-md-none"></i>
        </button>
      </template>
    </ListElement>
    <div v-if="_showForm" class="container">
      <Vueform
        :schema="schema"
        v-model="userToEdit"
        :sync="true"
        :endpoint="false"
        ref="form$"
        @submit="(form$: any) => postUser(form$.data)"
        @reset="_showForm = false"
        @mounted="(form$:any) => {form$.el$('fk.genApiKey').on('click', () => {($refs.modal as any).modal.show()})}"></Vueform>
    </div>
    <button v-else type="button" class="btn btn-secondary" @click="showForm()">
      {{ $t('labels.addX', { X: $t('labels.user') }) }}
    </button>
  </div>
</template>

<script lang="ts" setup>
import { Ref, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Header } from 'vue3-easy-data-table'
import { accesses, User, UserWithNameAndProject } from '@/../../common/types.js'
import API from '@/api.js'
import APP_LOADER from '@/appData.js'
import ApiKeyForm from '@/components/elements/ApiKeyForm.vue'
import ListElement from '@/components/elements/ListElement.vue'
import ModalComponent from '@/components/elements/ModalComponent.vue'
import { formatter } from '@/formatter.js'

const { t } = useI18n()

const headers: Header[] = [
  { text: t('labels.name'), value: 'name' },
  { text: 'E-Mail', value: 'email' },
  { text: t('labels.projects'), value: 'projects.assigned', sortable: true },
  { text: t('labels.access'), value: 'access' },
  { text: '', value: 'buttons', width: 80 }
]

const list = useTemplateRef('list')
async function loadFromServer() {
  if (list.value) {
    list.value.loadFromServer()
  }
}
defineExpose({ loadFromServer })

await APP_LOADER.loadData()
const APP_DATA = APP_LOADER.data

const getEmptyFilter = () => ({
  'name.givenName': { $regex: undefined, $options: 'i' },
  'name.familyName': { $regex: undefined, $options: 'i' },
  email: { $regex: undefined, $options: 'i' }
})

const filter = ref(getEmptyFilter())

const showFilter = ref({ name: false, email: false })

function clickFilter(header: keyof typeof showFilter.value, event?: MouseEvent) {
  event?.stopPropagation()
  if (showFilter.value[header]) {
    showFilter.value[header] = false
    if (header === 'name') {
      filter.value['name.givenName'] = getEmptyFilter()['name.givenName']
      filter.value['name.familyName'] = getEmptyFilter()['name.familyName']
    } else {
      filter.value[header] = getEmptyFilter()[header]
    }
  } else {
    showFilter.value[header] = true
  }
}

const userToEdit: Ref<User | undefined> = ref(undefined)
const _showForm = ref(false)

function showForm(user?: User) {
  let formUser: any = user
  if (formUser) {
    // reduce arrays of objects to arrays of _ids for vueform select elements
    const formUserSettings = Object.assign({}, formUser.settings)
    const formUserProjects = Object.assign({}, formUser.projects)
    formUser = Object.assign({}, formUser, { settings: formUserSettings, projects: formUserProjects })
    formUser.settings.lastCurrencies = user?.settings.lastCurrencies.map((c) => c._id)
    formUser.settings.lastCountries = user?.settings.lastCountries.map((c) => c._id)
    formUser.projects.assigned = user?.projects.assigned.map((p) => p._id)
    formUser.settings.organisation = user?.settings.organisation?._id
    formUser.settings.insurance = user?.settings.insurance?._id
  }
  userToEdit.value = formUser
  _showForm.value = true
}
async function postUser(user: User) {
  const result = await API.setter<User>('admin/user', user)
  if (result.ok) {
    _showForm.value = false
    userToEdit.value = undefined
    loadFromServer()
    APP_LOADER.loadOptional('users')
  }
}
async function deleteUser(user: User) {
  const result = await API.deleter('admin/user', { _id: user._id })
  if (result) {
    loadFromServer()
    APP_LOADER.loadOptional('users')
  }
}

const schema = Object.assign({}, (await API.getter<any>('admin/user/form')).ok?.data, {
  buttons: {
    type: 'group',
    schema: {
      submit: { type: 'button', submits: true, buttonLabel: t('labels.save'), full: true, columns: { container: 6 } },
      reset: { type: 'button', resets: true, buttonLabel: t('labels.cancel'), columns: { container: 6 }, secondary: true }
    }
  },
  _id: { type: 'hidden', meta: true }
})
Object.assign(schema.fk.schema, { genApiKey: { type: 'button', buttonLabel: 'Gen API Key', columns: { container: 3 }, secondary: true } })
</script>

<style></style>
