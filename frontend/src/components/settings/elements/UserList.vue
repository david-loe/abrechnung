<template>
  <div v-if="$root.settings.accessIcons">
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
        { text: $t('labels.project'), value: 'settings.project.identifier', sortable: true },
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
      <template #item-access="user">
        <template v-for="access of accesses">
          <span v-if="user.access[access]" class="ms-3">
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
        @submit="(form$: any) => postUser(form$.data)"
        @reset="_showForm = false"></Vueform>
    </div>
    <button v-else type="button" class="btn btn-secondary" @click="showForm('add')">
      {{ $t('labels.addX', { X: $t('labels.user') }) }}
    </button>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import userFormSchema from '../../../../../common/forms/user.json'
import { User, accesses } from '../../../../../common/types.js'

interface Filter<T> {
  name: T
  email: T
}
export default defineComponent({
  name: 'UserList',
  components: {},
  data() {
    return {
      users: [] as User[],
      userToEdit: undefined as User | undefined,
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
      schema: Object.assign({}, userFormSchema, {
        buttons: {
          type: 'group',
          schema: {
            submit: { type: 'button', submits: true, buttonLabel: this.$t('labels.save'), full: true, columns: { container: 6 } },
            reset: { type: 'button', resets: true, buttonLabel: this.$t('labels.cancel'), columns: { container: 6 }, secondary: true }
          }
        },
        _id: { type: 'hidden', meta: true }
      })
    }
  },
  methods: {
    showForm(mode: 'add' | 'edit', user?: User) {
      this.userFormMode = mode
      this.userToEdit = user
      this._showForm = true
    },
    async postUser(user: User) {
      console.log(user)
      const result = await this.$root.setter<User>('admin/user', user)
      if (result.ok) {
        this.getUsers()
        this._showForm = false
      }
      this.userToEdit = undefined
    },
    async deleteUser(user: User) {
      const result = await this.$root.deleter('admin/user', { _id: user._id })
      if (result) {
        this.getUsers()
      }
    },
    async getUsers() {
      const result = (await this.$root.getter<User[]>('admin/user')).ok
      if (result) {
        this.users = result.data
      }
    },
    clickFilter(header: keyof Filter<string>) {
      if (this._filter[header]) {
        this._filter[header] = false
        this.filter[header] = ''
      } else {
        this._filter[header] = true
      }
    }
  },
  async created() {
    await this.$root.load()
    this.getUsers()
  }
})
</script>

<style></style>
