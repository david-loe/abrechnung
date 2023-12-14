<template>
  <form class="container" @submit.prevent="mode === 'add' ? $emit('add', output()) : $emit('edit', output())">
    <div class="row mb-2">
      <div v-if="useLDAP" class="col">
        <label for="userFormFkLdapauth" class="form-label"> LDAP UID </label>
        <input type="text" class="form-control" id="userFormFkLdapauth" v-model="formUser.fk.ldapauth" :disabled="mode === 'edit'" />
      </div>
      <div v-if="useMicrosoft" class="col">
        <label for="userFormFkMicrosoft" class="form-label"> Microsoft ID </label>
        <input type="text" class="form-control" id="userFormFkMicrosoft" v-model="formUser.fk.microsoft" :disabled="mode === 'edit'" />
      </div>
      <div v-if="useMagicLogin" class="col">
        <label for="userFormFkMagiclogin" class="form-label"> Magic Login </label>
        <input type="email" class="form-control" id="userFormFkMagiclogin" v-model="formUser.fk.magiclogin" :disabled="mode === 'edit'" />
      </div>
      <div class="col">
        <label for="userFormMail" class="form-label"> {{ $t('labels.email') }}<span class="text-danger">*</span> </label>
        <input type="email" class="form-control" id="userFormMail" v-model="formUser.email" required :disabled="mode === 'edit'" />
      </div>
    </div>

    <div class="row mb-3">
      <div class="col">
        <label for="userFormFkGivenName" class="form-label"> {{ $t('labels.givenName') }}<span class="text-danger">*</span> </label>
        <input
          type="email"
          class="form-control"
          id="userFormFkGivenName"
          v-model="formUser.name.givenName"
          required
          :disabled="mode === 'edit'" />
      </div>
      <div class="col">
        <label for="userFormFamilyName" class="form-label"> {{ $t('labels.familyName') }}<span class="text-danger">*</span> </label>
        <input
          type="email"
          class="form-control"
          id="userFormFamilyName"
          v-model="formUser.name.familyName"
          required
          :disabled="mode === 'edit'" />
      </div>
    </div>

    <div class="row mb-3">
      <div class="col">
        <label for="userSettingsFormOrganisation" class="form-label me-2">
          {{ $t('labels.organisation') }}
        </label>
        <select class="form-select" id="userSettingsFormOrganisation" v-model="formUser.settings.organisation">
          <option v-for="organisation of $root.organisations" :value="organisation" :key="organisation._id">
            {{ organisation.name }}
          </option>
        </select>
      </div>
      <div class="col">
        <label for="userSettingsFormInsurance" class="form-label me-2">
          {{ $t('labels.insurance') }}
        </label>
        <select class="form-select" id="userSettingsFormInsurance" v-model="formUser.settings.insurance">
          <option v-for="insurance of $root.healthInsurances" :value="insurance" :key="insurance._id">{{ insurance.name }}</option>
        </select>
      </div>
    </div>

    <div class="row mb-3">
      <div v-for="access of accesses" class="col" :key="access">
        <div class="form-check">
          <label :for="'userForm' + access" class="form-check-label text-nowrap">
            <i v-for="icon of $root.settings.accessIcons[access]" :class="'bi ' + icon"></i>
            {{ $t('accesses.' + access) }}
          </label>
          <input class="form-check-input" type="checkbox" :id="'userForm' + access" role="switch" v-model="formUser.access[access]" />
        </div>
      </div>
    </div>

    <label for="invoiceDateInput" class="form-label">{{ $t('labels.loseAccessAt') }}</label>
    <DateInput id="invoiceDateInput" v-model="formUser.loseAccessAt" :with-time="true" />

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
import { User, accesses } from '../../../../../common/types.js'
import DateInput from '../../elements/DateInput.vue'

interface FormUser extends Omit<User, 'settings' | 'name' | '_id' | 'access'> {
  name?: User['name']
  settings?: User['settings']
  _id?: string
  access: Partial<User['access']>
}

export default defineComponent({
  components: { DateInput },
  name: 'UserForm',
  props: {
    user: {
      type: Object as PropType<FormUser>
    },
    mode: {
      type: String as PropType<'add' | 'edit'>,
      required: true
    }
  },
  data() {
    return {
      useLDAP: import.meta.env.VITE_AUTH_USE_LDAP.toLocaleLowerCase() === 'true',
      useMicrosoft: import.meta.env.VITE_AUTH_USE_MS_AZURE.toLocaleLowerCase() === 'true',
      useMagicLogin: import.meta.env.VITE_AUTH_USE_MAGIC_LOGIN.toLocaleLowerCase() === 'true',
      formUser: this.input(),
      loading: false,
      accesses
    }
  },
  methods: {
    default() {
      return {
        fk: {},
        access: { user: true },
        settings: {},
        name: { givenName: null, familyName: null },
        email: null,
        loseAccessAt: null
      }
    },
    clear() {
      this.loading = false
      this.formUser = this.default()
    },
    output() {
      this.loading = true
      return this.formUser
    },
    input() {
      this.loading = false
      return Object.assign({}, this.default(), this.user)
    }
  },
  created() {},
  watch: {
    user: function () {
      this.formUser = this.input()
    },
    'formUser.fk.magiclogin': function () {
      this.formUser.email = this.formUser.fk.magiclogin
    }
  }
})
</script>

<style></style>
