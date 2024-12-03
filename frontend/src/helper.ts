export async function subscribeToPush() {
  if ('PushManager' in window && import.meta.env.VITE_PUBLIC_VAPID_KEY) {
    try {
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission()
      }
      if (Notification.permission === 'granted') {
        let options = {
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_PUBLIC_VAPID_KEY)
        }
        window.navigator.serviceWorker.getRegistration().then(async (registration) => {
          if (registration) {
            await registration.pushManager.subscribe(options).then(async (subscription) => {
              await fetch(import.meta.env.VITE_BACKEND_URL + '/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription)
              })
            })
          } else {
            return
          }
        })
      }
    } catch (err) {
      console.log(err)
    }
  }
}
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
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
export async function clearingDB() {
  const db = await openDatabase()
  // Starte eine Transaktion für den Object Store, den du leeren willst
  const transaction = db.transaction(['urls'], 'readwrite')
  const store = transaction.objectStore('urls')
  // Leere den Object Store
  const clearRequest = store.clear()
  clearRequest.onsuccess = () => {
    return
  }
}
