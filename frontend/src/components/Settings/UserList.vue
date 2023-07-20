<template>
  <div class="container">
    <ul class="list-group mb-3" style="max-height: 400px; overflow-y: scroll">
      <li v-for="user of users" :key="user.uid" class="list-group-item">
        <div class="row align-items-center">
          <div class="col-auto me-auto">
            <span class="fs-6">
              {{ user.uid }}
              <i v-if="user.access.approve" class="ms-4 bi bi-calendar-check"></i>
              <i v-if="user.access.examine" class="ms-4 bi bi-pencil-square"></i>
              <i v-if="user.access.admin" class="ms-4 bi bi-person-fill"></i>
            </span>
          </div>
          <div class="col-auto">
            <button type="button" class="btn btn-light" @click="clickEdit(user)">
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
    <!-- prettier-ignore-attribute @cancel -->
    <UserForm
      v-if="userFormMode !== ''"
      :user="userToEdit"
      :mode="userFormMode"
      @add="postUser"
      @edit="postUser"
      @cancel="userFormMode = '';userToEdit = undefined"
      ref="userform"
      id="userform"
      style="max-width: 650px"></UserForm>
    <!-- prettier-ignore-attribute @click -->
    <button v-if="userFormMode === ''" type="button" class="btn btn-secondary" @click="userFormMode = 'add'; userToEdit = undefined">
      {{ $t('labels.addX', { X: $t('labels.user') }) }}
    </button>
  </div>
</template>

<script>
import UserForm from '../Forms/UserForm.vue'
export default {
  name: 'UserList',
  components: { UserForm },
  data() {
    return {
      users: [],
      userToEdit: undefined,
      userFormMode: ''
    }
  },
  methods: {
    clickEdit(user) {
      this.userFormMode = 'edit'
      this.userToEdit = user
    },
    async postUser(user) {
      const result = await this.$root.setter('admin/user', user)
      if (result) {
        this.users = (await this.$root.getter('admin/user')).data
        this.$refs.userform.clear()
        this.userFormMode = ''
      }
      this.userToEdit = undefined
    },
    async deleteUser(user) {
      const result = await this.$root.deleter('admin/user', { id: user._id })
      if (result) {
        this.users = (await this.$root.getter('admin/user')).data
      }
    }
  },
  async beforeMount() {
    this.users = (await this.$root.getter('admin/user')).data
  }
}
</script>

<style></style>
