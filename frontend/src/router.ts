import axios from 'axios'
import { createRouter, createWebHistory, RouteLocationNormalized } from 'vue-router'
import ExamineExpenseReportPage from './components/expenseReport/ExaminePage.vue'
import ExpenseReportPage from './components/expenseReport/ExpenseReportPage.vue'
import ConfirmHealthCareCostPage from './components/healthCareCost/ConfirmPage.vue'
import ExamineHealthCareCostPage from './components/healthCareCost/ExaminePage.vue'
import HealthCareCostPage from './components/healthCareCost/HealthCareCostPage.vue'
import HomePage from './components/HomePage.vue'
import LoginPage from './components/LoginPage.vue'
import SettingsPage from './components/settings/SettingsPage.vue'
import ApprovePage from './components/travel/ApprovePage.vue'
import ExamineTravelPage from './components/travel/ExaminePage.vue'
import TravelPage from './components/travel/TravelPage.vue'

const routes = [
  {
    path: '/login',
    component: LoginPage,
    meta: { requiresAuth: false },
    beforeEnter: async (to: RouteLocationNormalized) => {
      if (await auth()) {
        return { path: '/user' }
      } else {
        return true
      }
    }
  },
  {
    path: '/settings',
    component: SettingsPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/approve/travel/:_id([0-9a-fA-F]{24})?',
    component: ApprovePage,
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({ _id: route.params._id })
  },
  {
    path: '/examine/travel',
    component: ExamineTravelPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/examine/travel/:_id([0-9a-fA-F]{24})',
    component: TravelPage,
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({
      _id: route.params._id,
      parentPages: [{ link: '/examine/travel', title: 'accesses.examine/travel' }],
      endpointPrefix: 'examine/'
    })
  },
  {
    path: '/travel/:_id([0-9a-fA-F]{24})',
    component: TravelPage,
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({ _id: route.params._id, parentPages: [{ link: '/', title: 'headlines.home' }] })
  },
  {
    path: '/examine/expenseReport',
    component: ExamineExpenseReportPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/examine/expenseReport/:_id([0-9a-fA-F]{24})',
    component: ExpenseReportPage,
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({
      _id: route.params._id,
      parentPages: [{ link: '/examine/expenseReport', title: 'accesses.examine/expenseReport' }],
      endpointPrefix: 'examine/'
    })
  },
  {
    path: '/expenseReport/:_id([0-9a-fA-F]{24})',
    component: ExpenseReportPage,
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({ _id: route.params._id, parentPages: [{ link: '/', title: 'headlines.home' }] })
  },
  {
    path: '/confirm/healthCareCost',
    component: ConfirmHealthCareCostPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/confirm/healthCareCost/:_id([0-9a-fA-F]{24})',
    component: HealthCareCostPage,
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({
      _id: route.params._id,
      parentPages: [{ link: '/confirm/healthCareCost', title: 'accesses.confirm/healthCareCost' }],
      endpointPrefix: 'confirm/'
    })
  },
  {
    path: '/examine/healthCareCost',
    component: ExamineHealthCareCostPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/examine/healthCareCost/:_id([0-9a-fA-F]{24})',
    component: HealthCareCostPage,
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({
      _id: route.params._id,
      parentPages: [{ link: '/examine/healthCareCost', title: 'accesses.examine/healthCareCost' }],
      endpointPrefix: 'examine/'
    })
  },
  {
    path: '/healthCareCost/:_id([0-9a-fA-F]{24})',
    component: HealthCareCostPage,
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({ _id: route.params._id, parentPages: [{ link: '/', title: 'headlines.home' }] })
  },
  {
    path: '/user',
    component: HomePage,
    meta: { requiresAuth: true }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/user'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to) {
    if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth'
      }
    }
  }
})

async function auth() {
  let auth = false
  try {
    const res = await axios.get(import.meta.env.VITE_BACKEND_URL + '/auth/authenticated', {
      withCredentials: true
    })
    auth = res.status === 204
  } catch (error: any) {
    if (error.response && error.response.status !== 401) {
      console.log(error)
    }
  }
  return auth
}

router.beforeEach(async (to) => {
  if (to.meta.requiresAuth && !(await auth())) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
})

export default router
