import { createRouter, createWebHistory, RouteLocationNormalized } from 'vue-router'
import LoginPage from './components/LoginPage.vue'
import SettingsPage from './components/settings/SettingsPage.vue'
import ApprovePage from './components/travel/ApprovePage.vue'
import ExamineTravelPage from './components/travel/ExaminePage.vue'
import ExamineExpenseReportPage from './components/expenseReport/ExaminePage.vue'
import HealthCareCostPage from './components/healthCareCost/HealthCareCostPage.vue'
import ExamineHealthCareCostPage from './components/healthCareCost/ExaminePage.vue'
import ConfirmHealthCareCostPage from './components/healthCareCost/ConfirmPage.vue'
import HomePage from './components/HomePage.vue'
import TravelPage from './components/travel/TravelPage.vue'
import axios from 'axios'
import ExpenseReportPage from './components/expenseReport/ExpenseReportPage.vue'

const routes = [
  {
    path: '/login',
    component: LoginPage,
    meta: { requiresAuth: false }
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
      parentPages: [{ link: '/examine/travel', title: 'labels.examine/travel' }],
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
      parentPages: [{ link: '/examine/expenseReport', title: 'labels.examine/expenseReport' }],
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
      parentPages: [{ link: '/confirm/healthCareCost', title: 'labels.confirm/healthCareCost' }],
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
      parentPages: [{ link: '/examine/healthCareCost', title: 'labels.examine/healthCareCost' }],
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
    path: '/',
    component: HomePage,
    meta: { requiresAuth: true }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
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
  var auth = false
  try {
    const res = await axios.get(import.meta.env.VITE_BACKEND_URL + '/api/user', {
      withCredentials: true
    })
    auth = res.status === 200
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
