import { SessionData } from 'express-session'
import webpush from 'web-push'
import { User } from './../common/types.js'
import { sessionStore } from './app.js'

export async function sendPushNotification(title: string, body: string, users: User[], url: string) {
  const payload = {
    title: title,
    body: body,
    url: url
  }
  const allSessions = await getAllSessions()
  for (const user of users) {
    const userSessions = allSessions.filter((session) => session.subscription && user._id.equals(session.passport.user._id))
    const latestSession = userSessions.reduce(
      (max, session) => (new Date(session.cookie.expires!).valueOf() > new Date(max.cookie.expires!).valueOf() ? session : max),
      userSessions[0]
    )

    webpush.sendNotification(latestSession.subscription!, JSON.stringify(payload), {
      vapidDetails: {
        subject: process.env.VITE_FRONTEND_URL,
        publicKey: process.env.VITE_PUBLIC_VAPID_KEY,
        privateKey: process.env.VITE_PRIVATE_VAPID_KEY
      }
    })
  }
}

function getAllSessions() {
  return new Promise<SessionData[]>((resolve, reject) => {
    sessionStore.all((err, sessions) => {
      if (err) {
        return reject(err)
      }
      if (Array.isArray(sessions)) {
        resolve(sessions)
      } else {
        resolve([])
      }
    })
  })
}
