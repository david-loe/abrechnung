<template>
  <div class="container">
    <ul class="list-group mb-3" style="max-height: 400px; overflow-y: scroll">
      <li v-for="user of users" :key="user.uid" class="list-group-item">
        <div class="row align-items-center">
          <div class="col-auto me-auto">
            <span class="fs-6">
              {{ user.uid }}
              <template v-for="access of accesses">
                <span v-if="user.access[access]" class="ms-4">
                  <i v-for="icon of accessIcons[access]" :class="'bi ' + icon"></i>
                </span>
              </template>
            </span>
          </div>
          <div class="col-auto">
            <button type="button" class="btn btn-light" @click="showForm('edit', user)">
              <div class="d-none d-md-block">
                <i class="bi bi-pencil"></i>
                <span class="ps-1">{{ $t('labels.edit') }}</span>
              </div>
              <i class="bi bi-pencil d-block d-md-none"></i>
            </button>
            <button type="button" class="btn btn-danger ms-2" @click="deleteUser(user)">
              <div class="d-none d-md-block">
                <i class="bi bi-trash"></i>
                <span class="ps-1">{{ $t('labels.delete') }}</span>
              </div>
              <i class="bi bi-trash d-block d-md-none"></i>
            </button>
          </div>
        </div>
      </li>
    </ul>
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
import { accessIcons } from '../../../../../common/settings.json'
export default defineComponent({
  name: 'UserList',
  components: { UserForm },
  data() {
    return {
      users: [] as User[],
      userToEdit: undefined as User | undefined,
      userFormMode: 'add' as 'add' | 'edit',
      showForm_: false,
      accesses,
      accessIcons
    }
  },
  methods: {
    showForm(mode: 'add' | 'edit', user?: User) {
      this.userFormMode = mode
      this.userToEdit = user
      this.showForm_ = true
    },
    async postUser(user: User) {
      const result = await this.$root.setter('admin/user', user)
      if (result) {
        this.users = (await this.$root.getter('admin/user')).data
        ;(this.$refs.userform as typeof UserForm).clear()
        this.showForm_ = false
      }
      this.userToEdit = undefined
    },
    async deleteUser(user: User) {
      const result = await this.$root.deleter('admin/user', { id: user._id })
      if (result) {
        this.users = (await this.$root.getter('admin/user')).data
      }
    }
  },
  async beforeMount() {
    this.users = (await this.$root.getter('admin/user')).data
  }
})
</script>

<style></style>