import axios from 'axios'
import { RouteLocationNormalized, createRouter, createWebHistory } from 'vue-router'
import HomePage from './components/HomePage.vue'
import LoginPage from './components/LoginPage.vue'
import ExamineExpenseReportPage from './components/expenseReport/ExaminePage.vue'
import ExpenseReportPage from './components/expenseReport/ExpenseReportPage.vue'
import RefundedExpenseReportPage from './components/expenseReport/RefundedPage.vue'
import ConfirmHealthCareCostPage from './components/healthCareCost/ConfirmPage.vue'
import ExamineHealthCareCostPage from './components/healthCareCost/ExaminePage.vue'
import HealthCareCostPage from './components/healthCareCost/HealthCareCostPage.vue'
import RefundedHealthCareCostPage from './components/healthCareCost/RefundedPage.vue'
import SettingsPage from './components/settings/SettingsPage.vue'
import ApprovePage from './components/travel/ApprovePage.vue'
import ExamineTravelPage from './components/travel/ExaminePage.vue'
import RefundedTravelPage from './components/travel/RefundedPage.vue'
import TravelPage from './components/travel/TravelPage.vue'
import { logger } from './logger.js'

const routes = [
  {
    path: '/login',
    component: LoginPage,
    meta: { requiresAuth: false },
    beforeEnter: async (to: RouteLocationNormalized) => {
      if (await auth()) {
        return { path: '/user' }
      }
      return true
    }
  },
  {
    path: '/admin',
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
    path: '/refunded/travel',
    component: RefundedTravelPage,
    meta: { requiresAuth: true }
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
    path: '/refunded/expenseReport',
    component: RefundedExpenseReportPage,
    meta: { requiresAuth: true }
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
    path: '/refunded/healthCareCost',
    component: RefundedHealthCareCostPage,
    meta: { requiresAuth: true }
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

export async function auth() {
  let auth = false
  if (!navigator.onLine) {
    return true
  }
  try {
    const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/auth/authenticated`, {
      withCredentials: true
    })
    auth = res.status === 204
  } catch (error: any) {
    if (error.response && error.response.status !== 401) {
      logger.error(error)
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
