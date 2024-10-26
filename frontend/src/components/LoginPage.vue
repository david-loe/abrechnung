<template>
  <div class="text-center" id="loginPage">
    <i class="bi bi-receipt" style="font-size: 8rem"></i>
    <h1 class="h3 mb-3 fw-normal">{{ $t('login.signIn') }}</h1>
    <div v-if="strategy === 'ldapauth'">
      <form v-if="$root.displaySettings.auth.ldapauth" class="form-signin" @submit.prevent="login()">
        <div class="form-floating">
          <input
            type="text"
            class="form-control"
            autocomplete="username"
            id="usernameLDAP"
            name="usernameLDAP"
            placeholder=""
            v-model="usernameLDAP"
            required />
          <label for="usernameLDAP">{{ $t('labels.username') }}</label>
        </div>
        <div class="form-floating">
          <input
            type="password"
            class="form-control"
            id="passwordLDAP"
            name="passwordLDAP"
            placeholder=""
            autocomplete="currentPassword"
            v-model="passwordLDAP"
            required />
          <label for="passwordLDAP">{{ $t('labels.password') }}</label>
        </div>
        <button class="w-100 btn btn-lg btn-primary" type="submit">
          <i class="bi bi-people-fill me-1"></i>
          {{ $t('labels.signIn') }}
        </button>
      </form>
    </div>
    <div v-else-if="strategy === 'magiclogin'">
      <form v-if="$root.displaySettings.auth.magiclogin" class="form-signin" @submit.prevent="requestMagicLogin()">
        <div class="form-floating">
          <input
            type="email"
            class="form-control"
            autocomplete="email"
            id="magicLoginMail"
            name="magicLoginMail"
            placeholder=""
            v-model="magicLoginMail"
            required />
          <label for="magicLoginMail">E-Mail</label>
        </div>
        <button class="w-100 btn btn-lg btn-primary" type="submit">
          <i class="bi bi-envelope-fill me-1"></i>
          {{ $t('labels.sendMail') }}
        </button>
      </form>
    </div>

    <div v-if="$root.displaySettings.auth.ldapauth" class="mt-4">
      <button class="btn btn-lg btn-primary" @click="strategy = 'ldapauth'">
        <i class="bi bi-people-fill me-1"></i>
        {{ $t('labels.signInX', { X: 'LDAP' }) }}
      </button>
    </div>

    <div v-if="$root.displaySettings.auth.microsoft" class="mt-4">
      <a class="btn btn-lg btn-primary" :href="microsoftLink()">
        <i class="bi bi-microsoft me-1"></i>
        {{ $t('labels.signInX', { X: 'Microsoft' }) }}
      </a>
    </div>

    <div v-if="$root.displaySettings.auth.magiclogin" class="mt-4">
      <button class="btn btn-lg btn-primary" @click="strategy = 'magiclogin'">
        <i class="bi bi-envelope-fill me-1"></i>
        {{ $t('labels.signInX', { X: 'E-Mail' }) }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import axios from 'axios'
import { defineComponent } from 'vue'

type Strategy = 'ldapauth' | 'magiclogin'

export default defineComponent({
  name: 'LoginPage',
  data() {
    return {
      strategy: '' as Strategy,
      passwordLDAP: '',
      usernameLDAP: '',
      magicLoginMail: '',
      magicLoginSend: false
    }
  },
  methods: {
    async login() {
      try {
        const res = await axios.post(
          import.meta.env.VITE_BACKEND_URL + '/auth/ldapauth',
          {
            username: this.usernameLDAP,
            password: this.passwordLDAP
          },
          { withCredentials: true }
        )
        if (res.status === 204) {
          this.$root.loadState = 'UNLOADED'
          this.$router.push(this.$route.query.redirect ? (this.$route.query.redirect as string) : '/')
        }
      } catch (error) {
        this.passwordLDAP = ''
        this.$root.addAlert({ message: this.$t('alerts.loginFailed'), title: 'ERROR', type: 'danger' })
      }
    },
    async requestMagicLogin() {
      try {
        const res = await axios.post(import.meta.env.VITE_BACKEND_URL + '/auth/magiclogin', {
          destination: this.magicLoginMail,
          redirect: this.$route.query.redirect
        })
        if (res.status === 200) {
          this.magicLoginSend = true
          this.$root.addAlert({ message: this.$t('alerts.mailSend'), title: '', type: 'success', ttl: 10000 })
        }
      } catch (error) {
        this.passwordLDAP = ''
        this.$root.addAlert({ message: this.$t('alerts.loginFailed'), title: 'ERROR', type: 'danger' })
      }
    },
    microsoftLink() {
      return (
        import.meta.env.VITE_BACKEND_URL +
        '/auth/microsoft' +
        (this.$route.query.redirect ? '?redirect=' + (this.$route.query.redirect as string) : '')
      )
    }
  },
  async created() {
    await this.$root.load(true)
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

.form-signin input[type='usernameLDAP'] {
  margin-bottom: -1px;
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 0;
}

.form-signin input[type='passwordLDAP'] {
  margin-bottom: 10px;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}
</style>
