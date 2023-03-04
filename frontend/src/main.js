import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import vSelect from './vue-select';
import 'vue-select/dist/vue-select.css';
import "./vue-select.css"

import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap"
import "bootstrap-icons/font/bootstrap-icons.css"



import i18n from './i18n'

createApp(App).component('vSelect', vSelect).use(i18n).use(router).mount('#app')
