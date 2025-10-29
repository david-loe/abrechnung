<template>
  <div v-if="LOGIN_APP_DATA.displaySettings" class="text-center" id="loginPage">
    <i class="bi bi-receipt" style="font-size: 8rem"></i>
    <h2 class="h3 mb-3 fw-normal">{{ $t('login.signIn') }}</h2>
    <div v-if="strategy === 'ldapauth'">
      <form v-if="LOGIN_APP_DATA.displaySettings.auth.ldapauth" class="form-signin" @submit.prevent="login()">
        <div class="form-floating">
          <input
            type="text"
            class="form-control"
            autocomplete="username"
            id="usernameLDAP"
            name="usernameLDAP"
            placeholder=""
            v-model="usernameLDAP"
            required >
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
            required >
          <label for="passwordLDAP">{{ $t('labels.password') }}</label>
        </div>
        <button class="w-100 btn btn-lg btn-primary" type="submit">
          <i class="bi bi-people-fill me-1"></i>
          {{ $t('labels.signIn') }}
        </button>
      </form>
    </div>
    <div v-else-if="strategy === 'magiclogin'">
      <form v-if="LOGIN_APP_DATA.displaySettings.auth.magiclogin" class="form-signin" @submit.prevent="requestMagicLogin()">
        <div class="form-floating">
          <input
            type="email"
            class="form-control"
            autocomplete="email"
            id="magicLoginMail"
            name="magicLoginMail"
            placeholder=""
            v-model="magicLoginMail"
            required >
          <label for="magicLoginMail">E-Mail</label>
        </div>
        <button class="w-100 btn btn-lg btn-primary" type="submit">
          <i class="bi bi-envelope-fill me-1"></i>
          {{ $t('labels.sendMail') }}
        </button>
      </form>
    </div>

    <div v-if="LOGIN_APP_DATA.displaySettings.auth.ldapauth" class="mt-4">
      <button class="btn btn-lg btn-primary" @click="strategy = 'ldapauth'">
        <i class="bi bi-people-fill me-1"></i>
        {{ $t('labels.signInX', { X: 'LDAP' }) }}
      </button>
    </div>

    <div v-if="LOGIN_APP_DATA.displaySettings.auth.microsoft" class="mt-4">
      <a class="btn btn-lg btn-primary" :href="microsoftLink()">
        <i class="bi bi-microsoft me-1"></i>
        {{ $t('labels.signInX', { X: 'Microsoft' }) }}
      </a>
    </div>

    <div v-if="LOGIN_APP_DATA.displaySettings.auth.oidc" class="mt-4">
      <a class="btn btn-lg btn-primary" :href="oidcLink()">
        <i :class="`bi bi-${LOGIN_APP_DATA.displaySettings.oidc.icon} me-1`"></i>
        {{ $t('labels.signInX', { X: LOGIN_APP_DATA.displaySettings.oidc.label }) }}
      </a>
    </div>

    <div v-if="LOGIN_APP_DATA.displaySettings.auth.magiclogin" class="mt-4">
      <button class="btn btn-lg btn-primary" @click="strategy = 'magiclogin'">
        <i class="bi bi-envelope-fill me-1"></i>
        {{ $t('labels.signInX', { X: 'E-Mail' }) }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import axios from 'axios'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import API from '@/api.js'
import APP_LOADER from '@/dataLoader.js'
import ENV from '@/env.js'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()

type Strategy = 'ldapauth' | 'magiclogin' | ''

const strategy = ref('' as Strategy)
const passwordLDAP = ref('')
const usernameLDAP = ref('')
const magicLoginMail = ref('')
const magicLoginSend = ref(false)

async function login() {
  try {
    const res = await axios.post(
      `${ENV.VITE_BACKEND_URL}/auth/ldapauth`,
      { username: usernameLDAP.value, password: passwordLDAP.value },
      { withCredentials: true }
    )
    if (res.status === 204) {
      await APP_LOADER.loadData(true)
      router.push(route.query.redirect ? (route.query.redirect as string) : '/')
    }
  } catch (error) {
    passwordLDAP.value = ''
    API.addAlert({ message: t('alerts.loginFailed'), title: 'ERROR', type: 'danger' })
  }
}
async function requestMagicLogin() {
  try {
    const res = await axios.post(`${ENV.VITE_BACKEND_URL}/auth/magiclogin`, {
      destination: magicLoginMail.value,
      redirect: route.query.redirect
    })
    if (res.status === 200) {
      magicLoginSend.value = true
      API.addAlert({ message: t('alerts.mailSend'), title: '', type: 'success', ttl: 10000 })
    }
  } catch (error) {
    passwordLDAP.value = ''
    API.addAlert({ message: t('alerts.loginFailed'), title: 'ERROR', type: 'danger' })
  }
}
function microsoftLink() {
  return `${ENV.VITE_BACKEND_URL}/auth/microsoft${route.query.redirect ? `?redirect=${route.query.redirect as string}` : ''}`
}
function oidcLink() {
  return `${ENV.VITE_BACKEND_URL}/auth/oidc${route.query.redirect ? `?redirect=${route.query.redirect as string}` : ''}`
}

const LOGIN_APP_DATA = await APP_LOADER.loadLoginData()
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

.form-signin input[type="usernameLDAP"] {
  margin-bottom: -1px;
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 0;
}

.form-signin input[type="passwordLDAP"] {
  margin-bottom: 10px;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}
</style>
