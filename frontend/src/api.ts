import { GETResponse, SETResponse } from 'abrechnung-common/types.js'
import axios, { AxiosRequestConfig } from 'axios'
import { Reactive, reactive } from 'vue'
import ENV from '@/env.js'
import i18n from '@/i18n.js'
import { logger } from '@/logger.js'
import router from '@/router'

export interface Alert {
  type: 'danger' | 'success'
  title: string
  message?: string
  id?: number
  ttl?: number
}

export interface APICallOptions {
  config?: AxiosRequestConfig
  showAlert?: { success: boolean; error: boolean }
}

class API {
  alerts: Reactive<Alert[]>
  router = router

  constructor() {
    this.alerts = reactive([])
  }

  async getter<T>(
    endpoint: string,
    params: AxiosRequestConfig['params'] = {},
    config: AxiosRequestConfig = {},
    showAlert = true
  ): Promise<{ ok?: GETResponse<T>; error?: unknown }> {
    try {
      const res = await axios.get(`${ENV.VITE_BACKEND_URL}/${endpoint}`, Object.assign({ params: params, withCredentials: true }, config))
      if (config.responseType === 'blob') {
        return { ok: { data: res.data, meta: { count: 1, page: 1, limit: 1, countPages: 1 } } }
      }
      return { ok: res.data }
    } catch (error: unknown) {
      if (
        config.responseType === 'blob' &&
        axios.isAxiosError(error) &&
        error.response &&
        error.response.data instanceof Blob &&
        error.response.data.type === 'application/json'
      ) {
        error.response.data = JSON.parse(await error.response.data.text())
      }
      return this.#handleError(error, showAlert)
    }
  }
  async setter<T>(
    endpoint: string,
    data: unknown,
    config: AxiosRequestConfig = {},
    showAlert = true
  ): Promise<{ ok?: T; error?: unknown }> {
    try {
      const res = await axios.post(`${ENV.VITE_BACKEND_URL}/${endpoint}`, data, Object.assign({ withCredentials: true }, config))
      if (showAlert) this.addAlert({ title: i18n.global.t(res.data.message), type: 'success' })
      return { ok: (res.data as SETResponse<T>).result }
    } catch (error: unknown) {
      return this.#handleError(error, showAlert)
    }
  }
  async deleter(
    endpoint: string,
    params: { _id?: string; parentId?: string },
    ask = true,
    showAlert = { success: true, error: true }
  ): Promise<boolean | unknown> {
    if (ask) {
      if (!confirm(i18n.global.t('alerts.areYouSureDelete'))) {
        return false
      }
    }
    try {
      const res = await axios.delete(`${ENV.VITE_BACKEND_URL}/${endpoint}`, { params: params, withCredentials: true })
      if (showAlert.success) this.addAlert({ message: '', title: i18n.global.t('alerts.successDeleting'), type: 'success' })
      if (res.data.result) {
        return res.data.result
      }
      return true
    } catch (error: unknown) {
      this.#handleError(error, showAlert.error)
    }
    return false
  }

  #handleError(error: unknown, showAlert: boolean) {
    if (!axios.isAxiosError(error) || !error.response) {
      logger.error(error)
      return { error: error }
    }
    if (showAlert) {
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
    return { error: error.response.data }
  }

  addAlert(alert: Alert) {
    const alertWithId = Object.assign(alert, { id: Math.random() })
    this.alerts.push(alertWithId)
    setTimeout(() => {
      const index = this.alerts.findIndex((al) => {
        return al.id === alertWithId.id
      })
      if (index !== -1) {
        this.alerts.splice(index, 1)
      }
    }, alertWithId.ttl || 5000)
  }
  redirectToLogin() {
    this.router.push({ path: '/login', query: { redirect: router.currentRoute.value.path } })
  }
}

export default new API()
