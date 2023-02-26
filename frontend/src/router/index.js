import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from '../components/LoginPage.vue'
import SettingsPage from '../components/SettingsPage.vue'
import ApprovePage from '../components/ApprovePage.vue'
import ExaminePage from '../components/ExaminePage.vue'
import HomePage from '../components/HomePage.vue'
import axios from 'axios'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: LoginPage,
    meta: { requiresAuth: false}
  },
  {
    path: '/settings',
    name: 'Settings',
    component: SettingsPage,
    meta: { requiresAuth: true}
  },
  {
    path: '/approve',
    name: 'Approve',
    component: ApprovePage,
    meta: { requiresAuth: true}
  },
  {
    path: '/examine',
    name: 'Examine',
    component: ExaminePage,
    meta: { requiresAuth: true}
  },
  {
    path: '/',
    name: 'Home',
    component: HomePage,
    meta: { requiresAuth: true},
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
  scrollBehavior(to) {
    if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth',
      }
    }
  }
})

async function auth() {
  var auth = false;
  try {
    const res = await axios.get(process.env.VUE_APP_BACKEND_URL + '/api/user', {
      withCredentials: true,
    })
    auth = res.status === 200
  } catch (error) {
    console.log(error)
  }
  return auth
}

router.beforeEach(async (to) => {
  if (to.meta.requiresAuth && !await auth()) {
    return {
      path: '/login',
    }
  }
})


export default router
