import './main.js'
import { createApp } from 'vue'
import App from './App.vue'
import API from './api.js'
import i18n from './i18n.js'
import router from './router.js'
import vSelect from './vue-select.js'

export const app = createApp(App)
app.component('vSelect', vSelect)
app.use(i18n)
app.use(router)
API.registerLoginRedirect(() => router.push({ path: '/login', query: { redirect: router.currentRoute.value.path } }))
app.mount('#app')
