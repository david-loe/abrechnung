<template>
  <div>
    <template v-if="userToEdit && !createOnly">
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
          include-user-id-in-request />
      </ModalComponent>
    </template>
    <ListElement class="mb-3" ref="list" :endpoint="endpoint" :filter="filter" :headers="headers" :dbKeyPrefix="dbKeyPrefix">
      <template #header-name="header">
        <div class="filter-column">
          {{ t(header.text) }}
          <span class="clickable" @click="(e) => clickFilter('name', e)">
            <i v-if="showFilter.name" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="showFilter.name" @click.stop>
            <input
              type="text"
              class="form-control"
              v-model="(filter['name.givenName'] as any).$regex"
              :placeholder="t('labels.givenName')" >
            <input
              type="text"
              class="form-control"
              v-model="(filter['name.familyName'] as any).$regex"
              :placeholder="t('labels.familyName')" >
          </div>
        </div>
      </template>
      <template #header-email="header">
        <div class="filter-column">
          {{ t(header.text) }}
          <span class="clickable" @click="(e) => clickFilter('email', e)">
            <i v-if="showFilter.email" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="showFilter.email" @click.stop>
            <input type="text" class="form-control" v-model="(filter.email as any).$regex" >
          </div>
        </div>
      </template>

      <template #item-name="{ name }">{{ formatter.name(name) }}</template>
      <template #item-projects.assigned="{ projects }">
        <span class="me-1" v-for="p in projects.assigned">{{ p.identifier }}</span>
      </template>
      <template #item-access="user">
        <template v-for="access of accesses">
          <span v-if="user.access[access]" class="ms-3" :title="t('accesses.' + access)">
            <i v-for="icon of APP_DATA!.displaySettings.accessIcons[access]" :class="'bi bi-' + icon"></i>
          </span>
        </template>
      </template>
      <template #item-buttons="user">
        <button v-if="createOnly" type="button" class="btn btn-light btn-sm" @click="showForm(user, true)">
          <i class="bi bi-eye"></i>
        </button>
        <template v-else>
          <button type="button" class="btn btn-light btn-sm" @click="showForm(user)"><i class="bi bi-pencil"></i></button>
          <button type="button" class="btn btn-danger btn-sm ms-2" @click="deleteUser(user)"><i class="bi bi-trash"></i></button>
        </template>
      </template>
    </ListElement>
    <div v-if="_showForm" class="container">
      <Vueform
        :schema="schema"
        :tabs="tabs"
        v-model="userToEdit"
        :sync="true"
        :disabled="viewOnly"
        :endpoint="false"
        ref="form$"
        @submit="(form$: any) => postUser(form$.data)"
        @reset="_showForm = false"
        @mounted="setupForm" />
      <button v-if="viewOnly" type="button" class="btn btn-secondary mt-3" @click="closeForm">{{ t('labels.cancel') }}</button>
    </div>
    <button v-else type="button" class="btn btn-secondary" @click="showForm()">{{ t('labels.addX', { X: t('labels.user') }) }}</button>
  </div>
</template>

<script lang="ts" setup>
import { VueformSchema } from '@vueform/vueform'
import { accesses, idDocumentToId, User } from 'abrechnung-common/types.js'
import { computed, Ref, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Header } from 'vue3-easy-data-table'
import API from '@/api.js'
import ApiKeyForm from '@/components/elements/ApiKeyForm.vue'
import ListElement from '@/components/elements/ListElement.vue'
import ModalComponent from '@/components/elements/ModalComponent.vue'
import APP_LOADER from '@/dataLoader.js'
import { formatter } from '@/formatter.js'
import { getSyncedMagicLogin } from './userForm.js'

const { t } = useI18n()

const props = withDefaults(defineProps<{ endpoint?: string; createOnly?: boolean; dbKeyPrefix?: string }>(), {
  endpoint: 'admin/user',
  createOnly: false,
  dbKeyPrefix: 'admin'
})

const endpoint = computed(() => props.endpoint)
const createOnly = computed(() => props.createOnly)
const dbKeyPrefix = computed(() => props.dbKeyPrefix)
const headers = computed<Header[]>(() => [
  { text: 'labels.name', value: 'name' },
  { text: 'labels.email', value: 'email' },
  { text: 'labels.projects', value: 'projects.assigned', sortable: true },
  ...(createOnly.value ? [] : [{ text: 'labels.access', value: 'access' }]),
  { text: '', value: 'buttons', width: createOnly.value ? 48 : 80 }
])

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
const viewOnly = ref(false)
const modal = useTemplateRef<{ modal: { show: () => void } }>('modal')

function showForm(user?: User, readOnly = false) {
  // biome-ignore lint/suspicious/noExplicitAny: reduce arrays of objects to arrays of _ids for vueform select elements
  let formUser: any = user
  if (formUser) {
    const formUserSettings = Object.assign({}, formUser.settings)
    const formUserProjects = Object.assign({}, formUser.projects)
    formUser = Object.assign({}, formUser, { settings: formUserSettings, projects: formUserProjects })
    if (user?.settings.lastCurrencies) formUser.settings.lastCurrencies = user.settings.lastCurrencies.map((c) => c._id)
    if (user?.settings.lastCountries) formUser.settings.lastCountries = user.settings.lastCountries.map((c) => c._id)
    formUser.projects.assigned = user?.projects.assigned.map(idDocumentToId)
    formUser.projects.supervised = user?.projects.supervised.map(idDocumentToId)
    formUser.settings.organisation = user?.settings.organisation ? idDocumentToId(user.settings.organisation) : user?.settings.organisation
    formUser.settings.insurance = user?.settings.insurance ? idDocumentToId(user.settings.insurance) : user?.settings.insurance
  }
  userToEdit.value = formUser
  viewOnly.value = readOnly
  _showForm.value = true
}

function closeForm() {
  _showForm.value = false
  viewOnly.value = false
  userToEdit.value = undefined
}
async function postUser(user: User) {
  if (viewOnly.value) return
  const result = await API.setter<User>(props.endpoint, user)
  if (result.ok) {
    _showForm.value = false
    userToEdit.value = undefined
    loadFromServer()
    APP_LOADER.loadOptional('users')
  }
}
async function deleteUser(user: User<string>) {
  const result = await API.deleter(props.endpoint, { _id: user._id })
  if (result) {
    loadFromServer()
    APP_LOADER.loadOptional('users')
  }
}

// biome-ignore lint/suspicious/noExplicitAny: Vueform does not expose the mounted form instance type through its component event
function setupForm(form$: any) {
  if (!props.createOnly) {
    form$.el$('fk.genApiKey').on('click', () => {
      modal.value?.modal.show()
    })
  }

  const magicLoginEnabled = schema.fk?.schema?.magiclogin?.type !== 'hidden'
  const emailElement = form$.el$('email')
  const magicLoginElement = form$.el$('fk.magiclogin')

  emailElement.on('change', (email: string | null | undefined, previousEmail: string | null | undefined) => {
    const magicLogin = getSyncedMagicLogin({
      email,
      existingUser: Boolean(userToEdit.value?._id),
      magicLogin: magicLoginElement.value,
      magicLoginEnabled,
      previousEmail
    })

    if (magicLogin !== magicLoginElement.value) {
      magicLoginElement.update(magicLogin)
    }
  })
}

const buttons = {
  type: 'group',
  schema: {
    submit: { type: 'button', submits: true, buttonLabel: t('labels.save'), full: true, columns: { container: 6 } },
    reset: { type: 'button', resets: true, buttonLabel: t('labels.cancel'), columns: { container: 6 }, secondary: true }
  }
}
const schema = Object.assign({}, (await API.getter<{ [key: string]: VueformSchema }>(`${props.endpoint}/form`)).ok?.data, {
  buttons0: buttons,
  buttons1: buttons
})
if (!props.createOnly && schema.fk?.schema) {
  Object.assign(schema.fk.schema, { genApiKey: { type: 'button', buttonLabel: 'Gen API Key', columns: { container: 3 }, secondary: true } })
}
const tabs = {
  tab0: {
    label: t('labels.general'),
    elements: ['name', 'email', ...(props.createOnly ? ['employeeId'] : []), 'additionalDetails', 'projects', 'settings', 'buttons0']
  },
  tab1: {
    label: props.createOnly ? 'Login' : `Login & ${t('labels.access')}`,
    elements: ['fk', ...(props.createOnly ? [] : ['access']), 'loseAccessAt', 'buttons1']
  }
}
</script>

<style></style>
