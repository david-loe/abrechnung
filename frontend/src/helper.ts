import {
  AnyState,
  getReportTypeFromModelName,
  IdDocument,
  idDocumentToId,
  ReportModelName,
  State,
  TravelState,
  User
} from 'abrechnung-common/types.js'
import { AxiosRequestConfig } from 'axios'
import { Ref } from 'vue'
import API from './api'
import ENV from './env.js'

/**
 * register user for push notifivation if Push Manager and VAPID key avaiable
 * checking permission and asking for it if needed
 */
export async function subscribeToPush() {
  if (!('PushManager' in window) || !ENV.VITE_PUBLIC_VAPID_KEY) {
    return
  }
  if (Notification.permission === 'default') {
    await Notification.requestPermission()
  }
  if (!(Notification.permission === 'granted')) {
    return
  }
  const options = { userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(ENV.VITE_PUBLIC_VAPID_KEY) }
  const registration = await window.navigator.serviceWorker.getRegistration()
  if (!registration) {
    return
  }
  const subscription = await registration.pushManager.subscribe(options)
  if (!subscription) {
    return
  }
  await fetch(`${ENV.VITE_BACKEND_URL}/user/subscription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
    credentials: 'include'
  })
}
/**
 * Converts a base64 string into a Uint8Array for cryptographic or encoding purposes.
 * @param base64String -a string in base64 encoding.
 */
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export const bp = { sm: 576, md: 768, lg: 992, xl: 1200, xxl: 1400 } as const

export function hideExpandColumn(colDeleted: boolean, colIndex = 0) {
  queueMicrotask(() => {
    for (const tr of document.querySelectorAll<HTMLTableRowElement>('tr')) {
      const cells = tr.querySelectorAll<HTMLElement>('th, td')
      const cell = cells[colIndex]
      if (cell) {
        cell.style.display = 'none'
      }
    }

    if (!colDeleted) {
      const cols = document.querySelectorAll<HTMLElement>('col')
      const col = cols[colIndex]
      if (col) {
        col.remove()
      }
    }
  })
}

export function expandCollapseComments() {
  for (const td of document.querySelectorAll<HTMLElement>('td.can-expand')) {
    td.click()
  }
}

export function setLast<T>(item: T, list: T[], limit = 3) {
  const index = list.indexOf(item)
  if (index !== -1) {
    list.splice(index, 1)
  }
  const length = list.unshift(item)
  if (length > limit) {
    list.pop()
  }
}

export const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

export async function showFile(
  file: { endpoint: string; params: AxiosRequestConfig['params']; filename: string; isDownloading?: Ref<string> } | Blob | File
) {
  let fileObj: File | Blob
  if (file instanceof Blob) {
    fileObj = file
  } else {
    if (file.isDownloading) {
      file.isDownloading.value = file.params._id || true
    }
    const result = (await API.getter<Blob>(file.endpoint, file.params, { responseType: 'blob' })).ok
    if (file.isDownloading) {
      file.isDownloading.value = ''
    }
    if (result) {
      fileObj = new File([result.data], file.filename || 'file', { type: result.data.type })
    } else {
      return
    }
  }
  window.open(URL.createObjectURL(fileObj), '_blank')
}

export function getRouteForReport(
  user: User,
  report: { state: AnyState; owner: IdDocument; _id: string },
  reportModelName: ReportModelName
) {
  const reportType = getReportTypeFromModelName(reportModelName)
  if (user._id === idDocumentToId(report.owner)) {
    return `/${reportType}/${report._id}`
  }

  if (reportType === 'advance') {
    if (user.access['approve/advance']) {
      return `/approve/advance/${report._id}`
    }
    return `/book/advance/${report._id}`
  }

  if (reportType === 'travel') {
    if (user.access['examine/travel'] && report.state >= TravelState.APPROVED && report.state <= TravelState.REVIEW_COMPLETED) {
      return `/examine/travel/${report._id}`
    }
    if (user.access['approve/travel'] && report.state <= TravelState.APPROVED) {
      return `/approve/travel/${report._id}`
    }
    return `/book/travel/${report._id}`
  }

  //reportType === 'expenseReport' || reportType === 'healthCareCost'
  if (user.access[`examine/${reportType}`] && report.state >= State.EDITABLE_BY_OWNER && report.state <= State.BOOKABLE) {
    return `/examine/${reportType}/${report._id}`
  }
  return `/book/${reportType}/${report._id}`
}
