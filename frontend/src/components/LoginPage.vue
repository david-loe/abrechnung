<template>
  <div class="text-center" id="loginPage">
    <i class="bi bi-receipt" style="font-size: 8rem"></i>
    <h1 class="h3 mb-3 fw-normal">{{ $t('login.signIn') }}</h1>

    <form v-if="useLDAP" class="form-signin" @submit.prevent="login()">
      <div class="form-floating">
        <input
          type="text"
          class="form-control"
          autocomplete="username"
          id="username"
          name="username"
          placeholder=""
          v-model="username"
          required />
        <label for="username">{{ $t('labels.username') }}</label>
      </div>
      <div class="form-floating">
        <input
          type="password"
          class="form-control"
          id="password"
          name="password"
          placeholder=""
          autocomplete="currentPassword"
          v-model="password"
          required />
        <label for="password">{{ $t('labels.password') }}</label>
      </div>
      <button class="w-100 btn btn-lg btn-primary" type="submit">{{ $t('labels.signIn') }}</button>
    </form>

    <div v-if="useMicrosoft">
      <a class="btn btn-lg btn-primary" :href="microsoftLink">
        <i class="bi bi-microsoft me-1"></i>
        {{ $t('labels.signInX', { X: 'Microsoft' }) }}
      </a>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import axios from 'axios'

export default defineComponent({
  name: 'LoginPage',
  data() {
    return {
      password: '',
      username: '',
      useLDAP: import.meta.env.VITE_AUTH_USE_LDAP.toLocaleLowerCase() === 'true',
      useMicrosoft: import.meta.env.VITE_AUTH_USE_MS_AZURE.toLocaleLowerCase() === 'true',
      microsoftLink: import.meta.env.VITE_BACKEND_URL + '/auth/microsoft'
    }
  },
  methods: {
    async login() {
      try {
        const res = await axios.post(
          import.meta.env.VITE_BACKEND_URL + '/auth/ldapauth',
          {
            username: this.username,
            password: this.password
          },
          { withCredentials: true }
        )
        if (res.status === 200) {
          this.$root.loadState = 'UNLOADED'
          this.$router.push(this.$route.query.redirect ? (this.$route.query.redirect as string) : '/')
        }
      } catch (error) {
        this.password = ''
        this.$root.addAlert({ message: this.$t('alerts.loginFailed'), title: 'ERROR', type: 'danger' })
      }
    }
  },
  beforeMount() {
    this.$root.loadState = 'LOADED'
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.loginPage {
  height: 100%;
  display: flex;
  align-items: center;
  padding-top: 40px;
  padding-bottom: 40px;
  background-color: #f5f5f5;
}

.form-signin {
  width: 100%;
  max-width: 330px;
  padding: 15px;
  margin: auto;
}

.form-signin .checkbox {
  font-weight: 400;
}

.form-signin .form-floating:focus-within {
  z-index: 2;
}

.form-signin input[type='username'] {
  margin-bottom: -1px;
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 0;
}

.form-signin input[type='password'] {
  margin-bottom: 10px;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}
</style>
