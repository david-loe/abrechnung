<template>
  <div class="text-center" id="loginPage">
    <form class="form-signin" @submit.prevent="login()">
      <i class="bi bi-airplane" style="font-size: 8rem"></i>
      <h1 class="h3 mb-3 fw-normal">{{ $t('login.signIn') }}</h1>

      <div class="form-floating">
        <input type="username" class="form-control" id="username" placeholder="name@example.com" v-model="username" required />
        <label for="username">{{ $t('labels.username') }}</label>
      </div>
      <div class="form-floating">
        <input
          type="password"
          class="form-control"
          id="floatingPassword"
          placeholder="{{ $t('labels.password') }}"
          v-model="password"
          required
        />
        <label for="floatingPassword">{{ $t('labels.password') }}</label>
      </div>

      <button class="w-100 btn btn-lg btn-primary" type="submit">{{$t('labels.signIn')}}</button>
    </form> 
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'LoginPage',
  data() {
    return {
      password: '',
      username: '',
    }
  },
  methods: {
    async login() {
      try {
        const res = await axios.post(
          process.env.VUE_APP_BACKEND_URL + '/login',
          {
            username: this.username,
            password: this.password,
          },
          { withCredentials: true },
        )
        if (res.status === 200) {
          this.$root.loadState = 'UNLOADED'
          this.$router.push(this.$route.query.redirect ? this.$route.query.redirect : '/')
        }
      } catch (error) {
        this.password = ''
        this.$root.addAlert({message: this.$t('alerts.loginFailed'), title: "ERROR", type: "danger"})
      }
    },
  },
  beforeMount() {
    this.$root.loadState = 'LOADED'
  },
}
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
