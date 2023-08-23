<template>
  <form class="container" @submit.prevent="mode === 'add' ? $emit('add', output()) : $emit('edit', output())">
    <div class="row mb-2">
      <div class="col">
        <label for="userFormUid" class="form-label"> {{ $t('labels.uid') }}<span class="text-danger">*</span> </label>
        <input type="text" class="form-control" id="userFormUid" v-model="formUser.uid" required :disabled="mode === 'edit'" />
      </div>
      <div class="col">
        <label for="userFormMail" class="form-label"> {{ $t('labels.email') }}<span class="text-danger">*</span> </label>
        <input type="text" class="form-control" id="userFormMail" v-model="formUser.email" required :disabled="mode === 'edit'" />
      </div>
    </div>

    <div class="row mb-2">
      <div class="col">
        <div class="form-check">
          <label for="userFormApprove" class="form-check-label text-nowrap"> {{ $t('labels.approve') }}</label>
          <input class="form-check-input" type="checkbox" id="userFormApprove" role="switch" v-model="formUser.access.approve" />
        </div>
      </div>
      <div class="col">
        <div class="form-check">
          <label for="userFormExamine" class="form-check-label text-nowrap"> {{ $t('labels.examine') }}</label>
          <input class="form-check-input" type="checkbox" id="userFormExamine" role="switch" v-model="formUser.access.examine" />
        </div>
      </div>
      <div class="col">
        <div class="form-check">
          <label for="userFormAdmin" class="form-check-label text-nowrap"> {{ $t('labels.admin') }}</label>
          <input class="form-check-input" type="checkbox" id="userFormAdmin" role="switch" v-model="formUser.access.admin" />
        </div>
      </div>
    </div>

    <div class="mb-2">
      <button type="submit" class="btn btn-primary me-2" :disabled="loading">
        <span v-if="loading" class="spinner-border spinner-border-sm"></span>
        {{ mode === 'add' ? $t('labels.addX', { X: $t('labels.user') }) : $t('labels.save') }}
      </button>
      <button type="button" class="btn btn-light" v-on:click="$emit('cancel')">
        {{ $t('labels.cancel') }}
      </button>
    </div>
  </form>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { User } from '../../../../common/types.js'

interface FormUser extends Omit<User, 'settings' | 'name' | '_id'> {
  name?: string
  settings?: User['settings']
  _id?: string
}

const defaultUser: FormUser = {
  uid: '',
  access: {
    approve: false,
    examine: false,
    admin: false
  },
  email: ''
}
export default defineComponent({
  components: {},
  name: 'UserForm',
  props: {
    user: {
      type: Object as PropType<FormUser>,
      default: () => structuredClone(defaultUser)
    },
    mode: {
      type: String as PropType<'add' | 'edit'>,
      required: true
    }
  },
  data() {
    return {
      formUser: this.user,
      loading: false
    }
  },
  methods: {
    clear() {
      this.loading = false
      this.formUser = structuredClone(defaultUser)
    },
    output() {
      this.loading = true
      return this.formUser
    },
    input() {
      this.loading = false
      return Object.assign({}, structuredClone(defaultUser), this.user)
    }
  },
  beforeMount() {},
  watch: {
    user: function () {
      this.formUser = this.input()
    }
  }
})
</script>

<style></style>
