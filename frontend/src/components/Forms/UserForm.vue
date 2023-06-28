<template>
  <form class="container" @submit.prevent="this.mode === 'add' ? this.$emit('add', this.formUser) : this.$emit('edit', this.formUser)">
    <div class="row mb-2">
      <div class="col">
        <label for="userFormUid" class="form-label">
          {{ $t('labels.uid') }}<span class="text-danger">*</span>
        </label>
        <input type="text" class="form-control" id="userFormUid" v-model="formUser.uid" required :disabled="this.mode === 'edit'" />
      </div>
      <div class="col">
        <label for="userFormMail" class="form-label">
          {{ $t('labels.email') }}<span class="text-danger">*</span>
        </label>
        <input type="text" class="form-control" id="userFormMail" v-model="formUser.email" required :disabled="this.mode === 'edit'" />
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
      <button type="submit" class="btn btn-primary me-2" v-if="this.mode === 'add'">
        {{ $t('labels.addX', {X: $t('labels.user') }) }}
      </button>
      <button type="submit" class="btn btn-primary me-2" v-if="this.mode === 'edit'">
        {{ $t('labels.save') }}
      </button>
      <button type="button" class="btn btn-light" v-on:click="this.$emit('cancel')">
        {{ $t('labels.cancel') }}
      </button>
    </div>
  </form>
</template>

<script>
export default {
  components: {},
  name: 'UserForm',
  props: {
    user: {
      type: Object,
      default: function () {
        return {
          uid: '',
          access: {
            approve: false,
            examine: false,
            admin: false,
          },
          email: '',
        }
      },
    },
    mode: {
      type: String,
      required: true,
      validator: function (value) {
        return ['add', 'edit'].indexOf(value) !== -1
      },
    },
  },
  data() {
    return {
      formUser: this.user,
    }
  },
  methods: {
    clear() {
      this.formUser = {
        uid: '',
        access: {
          approve: false,
          examine: false,
          admin: false,
        },
        email: '',
      }
    },
  },
  beforeMount() {},
  watch: {
    user: function () {
      this.formUser = this.user
    },
  },
}
</script>

<style>
</style>