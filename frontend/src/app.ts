import './main.js'
import { createApp } from 'vue'
import App from './App.vue'
import i18n from './i18n.js'
import router from './router.js'
import vSelect from './vue-select.js'

export const app = createApp(App)
app.component('vSelect', vSelect)
app.use(i18n)
app.use(router)
app.mount('#app')
