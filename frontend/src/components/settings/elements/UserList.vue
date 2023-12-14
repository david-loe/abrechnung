<template>
  <div class="container">
    <EasyDataTable
      class="mb-3"
      :rows-items="[5, 15, 25]"
      :rows-per-page="5"
      sort-by="name"
      :items="users"
      :headers="[
        { text: $t('labels.name'), value: 'name' },
        { text: 'E-Mail', value: 'email' },
        { text: $t('labels.organisation'), value: 'settings.organisation.name', sortable: true },
        { text: $t('labels.access'), value: 'access' },
        { value: 'buttons' }
      ]">
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
    <UserForm
      v-if="showForm_"
      :user="userToEdit"
      :mode="userFormMode"
      @add="postUser"
      @edit="postUser"
      @cancel="showForm_ = false"
      ref="userform"
      id="userform"
      style="max-width: 650px"></UserForm>
    <button v-else type="button" class="btn btn-secondary" @click="showForm('add')">
      {{ $t('labels.addX', { X: $t('labels.user') }) }}
    </button>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import UserForm from '../forms/UserForm.vue'
import { User, accesses } from '../../../../../common/types.js'
export default defineComponent({
  name: 'UserList',
  components: { UserForm },
  data() {
    return {
      users: [] as User[],
      userToEdit: undefined as User | undefined,
      userFormMode: 'add' as 'add' | 'edit',
      showForm_: false,
      accesses
    }
  },
  methods: {
    showForm(mode: 'add' | 'edit', user?: User) {
      this.userFormMode = mode
      this.userToEdit = user
      this.showForm_ = true
    },
    async postUser(user: User) {
      const result = await this.$root.setter<User>('admin/user', user)
      if (result.ok) {
        this.getUsers()
        ;(this.$refs.userform as typeof UserForm).clear()
        this.showForm_ = false
      }
      this.userToEdit = undefined
    },
    async deleteUser(user: User) {
      const result = await this.$root.deleter('admin/user', { id: user._id })
      if (result) {
        this.getUsers()
      }
    },
    async getUsers() {
      const result = (await this.$root.getter<User[]>('admin/user')).ok
      if (result) {
        this.users = result.data
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
