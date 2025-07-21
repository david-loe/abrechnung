/**
 * register user for push notifivation if Push Manager and VAPID key avaiable
 * checking permission and asking for it if needed
 */

import { AxiosRequestConfig } from 'axios'
import { Ref } from 'vue'
import API from '@/api'

export async function subscribeToPush() {
  if (!('PushManager' in window) || !import.meta.env.VITE_PUBLIC_VAPID_KEY) {
    return
  }
  if (Notification.permission === 'default') {
    await Notification.requestPermission()
  }
  if (!(Notification.permission === 'granted')) {
    return
  }
  const options = { userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_PUBLIC_VAPID_KEY) }
  const registration = await window.navigator.serviceWorker.getRegistration()
  if (!registration) {
    return
  }
  const subscription = await registration.pushManager.subscribe(options)
  if (!subscription) {
    return
  }
  await fetch(`${import.meta.env.VITE_BACKEND_URL}/user/subscription`, {
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

/**
 * Opens a connection to an IndexedDB database named 'myDatabase' and sets up an object store called 'urls' with an id key if the database is newly created or upgraded.
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('myDatabase', 1)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      db.createObjectStore('urls', { keyPath: 'id' })
    }
    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result)
    }
    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error)
    }
  })
}
/**
 * Clears all entries in the 'urls' object store in the IndexedDB database.
 */
export async function clearingDB() {
  const db = await openDatabase()

  const transaction = db.transaction(['urls'], 'readwrite')
  const store = transaction.objectStore('urls')

  const clearRequest = store.clear()
  clearRequest.onsuccess = () => {
    return
  }
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
