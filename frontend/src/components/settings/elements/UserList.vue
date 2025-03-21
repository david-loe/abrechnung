<template>
  <div v-if="$root.settings.accessIcons">
    <template v-if="userToEdit">
      <ModalComponent
        :header="`API Key (${userToEdit.name.givenName} ${userToEdit.name.familyName})`"
        @close=";($refs.apiKeyForm as any).resetForm()"
        ref="modal">
        <ApiKeyForm
          :user="userToEdit"
          ref="apiKeyForm"
          endpoint="admin/user/httpBearer"
          @cancel=";($refs.modal as any).hideModal()"
          @new-key="
            //prettier-ignore
            getUsers();
            _showForm = false
          "
          include-user-id-in-request></ApiKeyForm>
      </ModalComponent>
    </template>
    <EasyDataTable
      class="mb-3"
      :rows-items="[5, 15, 25]"
      :rows-per-page="5"
      sort-by="name"
      :items="users"
      :filter-options="[
        {
          field: 'name',
          criteria: filter.name,
          comparison: (value: User['name'], criteria: string): boolean =>
            (value.givenName + ' ' + value.familyName).toLowerCase().indexOf(criteria.toLowerCase()) !== -1
        },
        {
          field: 'email',
          criteria: filter.email,
          comparison: (value: User['email'], criteria: string): boolean => value.toLowerCase().indexOf(criteria.toLowerCase()) !== -1
        }
      ]"
      :headers="[
        { text: $t('labels.name'), value: 'name' },
        { text: 'E-Mail', value: 'email' },
        { text: $t('labels.projects'), value: 'projects.assigned', sortable: true },
        { text: $t('labels.access'), value: 'access' },
        { value: 'buttons' }
      ]">
      <template #header-name="header">
        <div class="filter-column">
          {{ header.text }}
          <span style="cursor: pointer" @click="clickFilter('name')">
            <i v-if="_filter.name" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="_filter.name">
            <input type="text" class="form-control" v-model="filter.name" />
          </div>
        </div>
      </template>
      <template #header-email="header">
        <div class="filter-column">
          {{ header.text }}
          <span style="cursor: pointer" @click="clickFilter('email')">
            <i v-if="_filter.email" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="_filter.email">
            <input type="text" class="form-control" v-model="filter.email" />
          </div>
        </div>
      </template>
      <template #item-name="{ name }">
        {{ name.givenName + ' ' + name.familyName }}
      </template>
      <template #item-projects.assigned="{ projects }">
        <span class="me-1" v-for="p in projects.assigned">{{ p.identifier }}</span>
      </template>
      <template #item-access="user">
        <template v-for="access of accesses">
          <span v-if="user.access[access]" class="ms-3" :title="$t('accesses.' + access)">
            <i v-for="icon of $root.settings.accessIcons[access]" :class="'bi ' + icon"></i>
          </span>
        </template>
      </template>
      <template #item-buttons="user">
        <button type="button" class="btn btn-light" @click="showForm('edit', user)">
          <div class="d-none d-md-block">
            <i class="bi bi-pencil"></i>
          </div>
          <i class="bi bi-pencil d-block d-md-none"></i>
        </button>
        <button type="button" class="btn btn-danger ms-2" @click="deleteUser(user)">
          <div class="d-none d-md-block">
            <i class="bi bi-trash"></i>
          </div>
          <i class="bi bi-trash d-block d-md-none"></i>
        </button>
      </template>
    </EasyDataTable>
    <div v-if="_showForm" class="container" style="max-width: 650px">
      <Vueform
        :schema="schema"
        v-model="userToEdit"
        :sync="true"
        :endpoint="false"
        ref="form$"
        @submit="(form$: any) => postUser(form$.data)"
        @close="_showForm = false"
        @mounted="addApiKeyListen"></Vueform>
    </div>
    <button v-else type="button" class="btn btn-secondary" @click="showForm('add')">
      {{ $t('labels.addX', { X: $t('labels.user') }) }}
    </button>
  </div>
</template>

<script lang="ts">
import API from '@/api.js'
import ApiKeyForm from '@/components/elements/ApiKeyForm.vue'
import ModalComponent from '@/components/elements/ModalComponent.vue'
import { defineComponent } from 'vue'
import { User, accesses } from '../../../../../common/types.js'

interface Filter<T> {
  name: T
  email: T
}

export default defineComponent({
  name: 'UserList',
  components: { ModalComponent, ApiKeyForm },
  data() {
    return {
      users: [] as User[],
      userToEdit: undefined as any | undefined,
      userFormMode: 'add' as 'add' | 'edit',
      _showForm: false,
      filter: {
        name: '',
        email: ''
      } as Filter<string>,
      _filter: {
        name: false,
        email: false
      } as Filter<boolean>,
      accesses,
      schema: {} as any
    }
  },
  methods: {
    showForm(mode: 'add' | 'edit', user?: User) {
      this.userFormMode = mode
      let formUser: any = user
      if (formUser) {
        // reduce arrays of objects to arrays of _ids for vueform select elements
        const formUserSettings = Object.assign({}, formUser.settings)
        const formUserProjects = Object.assign({}, formUser.projects)
        formUser = Object.assign({}, formUser, { settings: formUserSettings, projects: formUserProjects })
        formUser.settings.lastCurrencies = user!.settings.lastCurrencies.map((c) => c._id)
        formUser.settings.lastCountries = user!.settings.lastCountries.map((c) => c._id)
        formUser.projects.assigned = user!.projects.assigned.map((p) => p._id)
        formUser.settings.organisation = user!.settings.organisation?._id
        formUser.settings.insurance = user!.settings.insurance?._id
      }
      this.userToEdit = formUser
      this._showForm = true
    },
    async postUser(user: User) {
      const result = await API.setter<User>('admin/user', user)
      if (result.ok) {
        this.getUsers()
        this._showForm = false
      }
      this.userToEdit = undefined
    },
    async deleteUser(user: User) {
      const result = await API.deleter('admin/user', { _id: user._id })
      if (result) {
        this.getUsers()
      }
    },
    async getUsers() {
      const result = (await API.getter<User[]>('admin/user')).ok
      if (result) {
        this.users = result.data
      }
      const rootUsers = (await API.getter<{ name: User['name']; _id: string }[]>('users', {}, {}, false)).ok?.data
      if (rootUsers) {
        this.$root.users = rootUsers
      }
    },
    clickFilter(header: keyof Filter<string>) {
      if (this._filter[header]) {
        this._filter[header] = false
        this.filter[header] = ''
      } else {
        this._filter[header] = true
      }
    },
    addApiKeyListen() {
      queueMicrotask(() => {
        ;(this.$refs.form$ as any).el$('fk.genApiKey').on('click', () => {
          ;(this.$refs.modal as any).modal.show()
        })
      })
    }
  },
  async beforeMount() {
    await this.$root.load()
    this.getUsers()
    this.schema = Object.assign({}, (await API.getter<any>('admin/user/form')).ok?.data, {
      buttons: {
        type: 'group',
        schema: {
          submit: { type: 'button', submits: true, buttonLabel: this.$t('labels.save'), full: true, columns: { container: 6 } },
          reset: { type: 'button', resets: true, buttonLabel: this.$t('labels.cancel'), columns: { container: 6 }, secondary: true }
        }
      },
      _id: { type: 'hidden', meta: true }
    })
    Object.assign(this.schema.fk.schema, {
      genApiKey: { type: 'button', buttonLabel: 'Gen API Key', columns: { container: 3 }, secondary: true }
    })
  }
})
</script>

<style></style>
