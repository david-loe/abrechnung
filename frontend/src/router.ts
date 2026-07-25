import axios from 'axios'
import { createRouter, createWebHistory, RouteLocationNormalized } from 'vue-router'
import { app } from '@/app.js'
import { adminSections, defaultAdminSection } from '@/components/settings/adminSections'
import { registerVueformLanguageChange } from '@/dataLoader.js'
import { logger } from '@/logger.js'
import { getValidOfflineContext, purgeSession, refreshAuthContext, sessionState } from '@/session.js'

const routes = [
  {
    path: '/login',
    component: () => import('@/components/LoginPage.vue'),
    meta: { requiresAuth: false },
    beforeEnter: async (to: RouteLocationNormalized) =>
      (await auth()) ? { path: typeof to.query.redirect === 'string' ? to.query.redirect : '/user' } : true
  },
  { path: '/offline-unavailable', component: () => import('@/components/OfflineUnavailablePage.vue'), meta: { requiresAuth: false } },
  {
    path: '/admin',
    component: () => import('@/components/settings/SettingsPage.vue'),
    meta: { requiresAuth: true, requiresVueform: true },
    children: [
      { path: '', redirect: { name: defaultAdminSection.routeName } },
      ...adminSections.map((section) => ({
        path: section.path,
        name: section.routeName,
        component: () => import('@/components/settings/AdminSettingsSection.vue'),
        meta: { adminSectionId: section.id }
      }))
    ]
  },
  {
    path: '/approve/advance/:_id([0-9a-fA-F]{24})?',
    component: () => import('@/components/advance/ApprovePage.vue'),
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({ _id: route.params._id })
  },
  {
    path: '/book/advance/:_id([0-9a-fA-F]{24})?',
    component: () => import('@/components/advance/BookPage.vue'),
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({ _id: route.params._id })
  },
  {
    path: '/approve/travel/:_id([0-9a-fA-F]{24})?',
    component: () => import('@/components/travel/ApprovePage.vue'),
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({ _id: route.params._id })
  },
  {
    path: '/book/travel/:_id([0-9a-fA-F]{24})?',
    component: () => import('@/components/travel/BookPage.vue'),
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({ _id: route.params._id })
  },
  { path: '/examine/travel', component: () => import('@/components/travel/ExaminePage.vue'), meta: { requiresAuth: true } },
  {
    path: '/examine/travel/:_id([0-9a-fA-F]{24})',
    component: () => import('@/components/travel/TravelPage.vue'),
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({
      _id: route.params._id,
      parentPages: [{ link: '/examine/travel', title: 'accesses.examine/travel' }],
      endpointPrefix: 'examine/'
    })
  },
  {
    path: '/travel/:_id([0-9a-fA-F]{24})',
    component: () => import('@/components/travel/TravelPage.vue'),
    meta: { requiresAuth: true, offlineCapable: true },
    props: (route: RouteLocationNormalized) => ({ _id: route.params._id, parentPages: [{ link: '/', title: 'headlines.home' }] })
  },
  {
    path: '/book/expenseReport/:_id([0-9a-fA-F]{24})?',
    component: () => import('@/components/expenseReport/BookPage.vue'),
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({ _id: route.params._id })
  },
  { path: '/examine/expenseReport', component: () => import('@/components/expenseReport/ExaminePage.vue'), meta: { requiresAuth: true } },
  {
    path: '/examine/expenseReport/:_id([0-9a-fA-F]{24})',
    component: () => import('@/components/expenseReport/ExpenseReportPage.vue'),
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({
      _id: route.params._id,
      parentPages: [{ link: '/examine/expenseReport', title: 'accesses.examine/expenseReport' }],
      endpointPrefix: 'examine/'
    })
  },
  {
    path: '/expenseReport/:_id([0-9a-fA-F]{24})',
    component: () => import('@/components/expenseReport/ExpenseReportPage.vue'),
    meta: { requiresAuth: true, offlineCapable: true },
    props: (route: RouteLocationNormalized) => ({ _id: route.params._id, parentPages: [{ link: '/', title: 'headlines.home' }] })
  },
  {
    path: '/book/healthCareCost/:_id([0-9a-fA-F]{24})?',
    component: () => import('@/components/healthCareCost/BookPage.vue'),
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({ _id: route.params._id })
  },
  { path: '/examine/healthCareCost', component: () => import('@/components/healthCareCost/ExaminePage.vue'), meta: { requiresAuth: true } },
  {
    path: '/examine/healthCareCost/:_id([0-9a-fA-F]{24})',
    component: () => import('@/components/healthCareCost/HealthCareCostPage.vue'),
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({
      _id: route.params._id,
      parentPages: [{ link: '/examine/healthCareCost', title: 'accesses.examine/healthCareCost' }],
      endpointPrefix: 'examine/'
    })
  },
  {
    path: '/healthCareCost/:_id([0-9a-fA-F]{24})',
    component: () => import('@/components/healthCareCost/HealthCareCostPage.vue'),
    meta: { requiresAuth: true, offlineCapable: true },
    props: (route: RouteLocationNormalized) => ({ _id: route.params._id, parentPages: [{ link: '/', title: 'headlines.home' }] })
  },
  { path: '/user', component: () => import('@/components/HomePage.vue'), meta: { requiresAuth: true, offlineCapable: true } },
  {
    path: '/advance/:_id([0-9a-fA-F]{24})',
    component: () => import('@/components/HomePage.vue'),
    meta: { requiresAuth: true, offlineCapable: true },
    props: (route: RouteLocationNormalized) => ({ reportId: route.params._id, reportType: 'advance' })
  },
  {
    path: '/advance/:_id([0-9a-fA-F]{24})/confirm',
    component: () => import('@/components/HomePage.vue'),
    meta: { requiresAuth: true },
    props: (route: RouteLocationNormalized) => ({ reportId: route.params._id, reportType: 'advance', confirmAdvance: true })
  },
  { path: '/:pathMatch(.*)*', redirect: '/user' }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to) {
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
  }
})

export async function auth() {
  if (!navigator.onLine) return Boolean(await getValidOfflineContext())
  try {
    return Boolean(await refreshAuthContext())
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) await purgeSession()
    else logger.error(error)
    return false
  }
}

let vueformLoaded = false

router.beforeEach(async (to) => {
  const offline = !sessionState.isOnline.value
  if (offline && to.meta.requiresAuth && !to.meta.offlineCapable) return { path: '/offline-unavailable', query: { redirect: to.fullPath } }
  if (to.meta.requiresAuth && !(await auth())) return { path: '/login', query: { redirect: to.fullPath } }
  if (to.meta.requiresVueform && !vueformLoaded) {
    const [{ default: Vueform }, { default: vueformConfig }] = await Promise.all([
      import('@vueform/vueform'),
      import('@/vueform.config.js')
    ])
    app.use(Vueform, vueformConfig)
    registerVueformLanguageChange((locale) => {
      app.config.globalProperties.$vueform.i18n.locale = locale
    })
    vueformLoaded = true
  }
  return true
})

export default router
