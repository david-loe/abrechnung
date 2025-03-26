import axios, { AxiosRequestConfig } from 'axios'
import { Reactive, reactive } from 'vue'
import { Router, useRoute, useRouter } from 'vue-router'
import { GETResponse, SETResponse } from '../../common/types'
import i18n from './i18n.js'
import { logger } from './logger.js'

export interface Alert {
  type: 'danger' | 'success'
  title: string
  message?: string
  id?: number
  ttl?: number
}

class API {
  alerts: Reactive<Alert[]>
  router: Router

  constructor() {
    this.alerts = reactive([])
    this.router = useRouter()
  }

  async getter<T>(endpoint: string, params: any = {}, config: any = {}, showAlert = true): Promise<{ ok?: GETResponse<T>; error?: any }> {
    try {
      const res = await axios.get(
        import.meta.env.VITE_BACKEND_URL + '/' + endpoint,
        Object.assign(
          {
            params: params,
            withCredentials: true
          },
          config
        )
      )
      if (config.responseType === 'blob') {
        return { ok: { data: res.data, meta: { count: 1, page: 1, limit: 1, countPages: 1 } } }
      }
      return { ok: res.data }
    } catch (error: any) {
      if (showAlert) {
        if (error.response.status === 401) {
          this.redirectToLogin()
        } else {
          logger.error(error.response.data)
          this.addAlert({
            message: error.response.data.message, //@ts-ignore
            title: error.response.data.name ? i18n.global.t(error.response.data.name) : 'ERROR',
            type: 'danger'
          })
        }
      }
      return { error: error.response.data }
    }
  }
  async setter<T>(endpoint: string, data: any, config: AxiosRequestConfig<any> = {}, showAlert = true): Promise<{ ok?: T; error?: any }> {
    try {
      const res = await axios.post(
        import.meta.env.VITE_BACKEND_URL + '/' + endpoint,
        data,
        Object.assign(
          {
            withCredentials: true
          },
          config
        )
      )
      if (showAlert) this.addAlert({ title: i18n.global.t(res.data.message), type: 'success' })
      return { ok: (res.data as SETResponse<T>).result }
    } catch (error: any) {
      if (error.response) {
        if (error.response.status === 401) {
          this.redirectToLogin()
        } else {
          logger.error(error.response.data)
          this.addAlert({
            message: error.response.data.message,
            title: error.response.data.name ? i18n.global.t(error.response.data.name) : 'ERROR',
            type: 'danger'
          })
        }
        return { error: error.response.data }
      } else {
        return { error: error }
      }
    }
  }
  async deleter(endpoint: string, params: { [key: string]: any; _id: string }, ask = true, showAlert = true): Promise<boolean | any> {
    if (ask) {
      if (!confirm(i18n.global.t('alerts.areYouSureDelete'))) {
        return false
      }
    }
    try {
      const res = await axios.delete(import.meta.env.VITE_BACKEND_URL + '/' + endpoint, {
        params: params,
        withCredentials: true
      })
      if (res.status === 200) {
        if (showAlert) this.addAlert({ message: '', title: i18n.global.t('alerts.successDeleting'), type: 'success' })
        if (res.data.result) {
          return res.data.result
        }
        return true
      }
    } catch (error: any) {
      if (error.response.status === 401) {
        this.redirectToLogin()
      } else {
        logger.error(error.response.data)
        this.addAlert({
          message: error.response.data.message,
          title: error.response.data.name ? i18n.global.t(error.response.data.name) : 'ERROR',
          type: 'danger'
        })
      }
    }
    return false
  }
  addAlert(alert: Alert) {
    alert = Object.assign(alert, { id: Math.random() })
    this.alerts.push(alert)
    setTimeout(
      () => {
        const index = this.alerts.findIndex((al) => {
          return al.id === alert.id
        })
        if (index !== -1) {
          this.alerts.splice(index, 1)
        }
      },
      alert.ttl ? alert.ttl : 5000
    )
  }
  redirectToLogin() {
    this.router.push({ path: '/login', query: { redirect: useRoute().path } })
  }
}

export default new API()
