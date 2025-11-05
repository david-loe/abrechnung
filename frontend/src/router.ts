import axios from 'axios'
import { createRouter, createWebHistory, RouteLocationNormalized } from 'vue-router'
import { app } from '@/app.js'
import AdvanceApprovePage from '@/components/advance/ApprovePage.vue'
import BookAdvancePage from '@/components/advance/BookPage.vue'
import BookExpenseReportPage from '@/components/expenseReport/BookPage.vue'
import ExamineExpenseReportPage from '@/components/expenseReport/ExaminePage.vue'
import ExpenseReportPage from '@/components/expenseReport/ExpenseReportPage.vue'
import HomePage from '@/components/HomePage.vue'
import BookHealthCareCostPage from '@/components/healthCareCost/BookPage.vue'
import ExamineHealthCareCostPage from '@/components/healthCareCost/ExaminePage.vue'
import HealthCareCostPage from '@/components/healthCareCost/HealthCareCostPage.vue'
import LoginPage from '@/components/LoginPage.vue'
import TravelApprovePage from '@/components/travel/ApprovePage.vue'
import BookTravelPage from '@/components/travel/BookPage.vue'
import ExamineTravelPage from '@/components/travel/ExaminePage.vue'
import TravelPage from '@/components/travel/TravelPage.vue'
import ENV from '@/env.js'
import { logger } from '@/logger.js'

const routes = [
  {
    path: '/login',
    component: LoginPage,
    meta: { requiresAuth: false },
    beforeEnter: async (to: RouteLocationNormalized) => {
      if (await auth()) {
        return { path: typeof to.query.redirect === 'string' ? to.query.redirect : '/user' }
      }
      return true
    }
  },
  {
    path: '/admin',
    component: () => import('@/components/settings/SettingsPage.vue'),
    meta: { requiresAuth: true, requiresVueform: true }
  },
  {
    path: '/approve/advance/:_id([0-9a-fA-F]{24})?',
    component: AdvanceApprovePage,
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({ _id: route.params._id })
  },
  {
    path: '/book/advance/:_id([0-9a-fA-F]{24})?',
    component: BookAdvancePage,
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({ _id: route.params._id })
  },
  {
    path: '/approve/travel/:_id([0-9a-fA-F]{24})?',
    component: TravelApprovePage,
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({ _id: route.params._id })
  },
  {
    path: '/book/travel/:_id([0-9a-fA-F]{24})?',
    component: BookTravelPage,
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({ _id: route.params._id })
  },
  { path: '/examine/travel', component: ExamineTravelPage, meta: { requiresAuth: true } },
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
    path: '/book/expenseReport/:_id([0-9a-fA-F]{24})?',
    component: BookExpenseReportPage,
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({ _id: route.params._id })
  },
  { path: '/examine/expenseReport', component: ExamineExpenseReportPage, meta: { requiresAuth: true } },
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
    path: '/book/healthCareCost/:_id([0-9a-fA-F]{24})?',
    component: BookHealthCareCostPage,
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({ _id: route.params._id })
  },
  { path: '/examine/healthCareCost', component: ExamineHealthCareCostPage, meta: { requiresAuth: true } },
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
  { path: '/user', component: HomePage, meta: { requiresAuth: true } },
  { path: '/:pathMatch(.*)*', redirect: '/user' }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to) {
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth' }
    }
  }
})

export async function auth() {
  let auth = false
  if (!navigator.onLine) {
    return true
  }
  try {
    const res = await axios.get(`${ENV.VITE_BACKEND_URL}/auth/authenticated`, { withCredentials: true })
    auth = res.status === 204
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response && error.response.status !== 401) {
      logger.error(error)
    }
  }
  return auth
}

let vueformLoaded = false

router.beforeEach(async (to, _from, next) => {
  if (to.meta.requiresAuth && !(await auth())) {
    next({ path: '/login', query: { redirect: to.fullPath } })
  }
  if (to.meta.requiresVueform && !vueformLoaded) {
    const [{ default: Vueform }, { default: vueformConfig }] = await Promise.all([
      import('@vueform/vueform'),
      import('@/vueform.config.js')
    ])
    app.use(Vueform, vueformConfig)
    vueformLoaded = true
  }
  next()
})

export default router
