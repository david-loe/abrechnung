import { SessionData } from 'express-session'
import webpush from 'web-push'
import { sessionStore } from '../db.js'
import { logger } from '../logger.js'
import { User } from './../../common/types.js'

export async function sendPushNotification(title: string, body: string, users: User[], url: string) {
  if (!process.env.VITE_FRONTEND_URL.startsWith('https')) {
    return
  }
  const payload = {
    title: title,
    body: body,
    url: url
  }
  const allSessions = await getAllSessions()
  for (const user of users) {
    const userSessions = allSessions.filter((session) => session.subscription && user._id.equals(session.passport.user._id))
    if (userSessions.length > 0) {
      const latestSession = userSessions.reduce(
        (max, session) => (new Date(session.cookie.expires!).valueOf() > new Date(max.cookie.expires!).valueOf() ? session : max),
        userSessions[0]
      )
      if (latestSession) {
        try {
          webpush.sendNotification(latestSession.subscription!, JSON.stringify(payload), {
            vapidDetails: {
              subject: process.env.VITE_FRONTEND_URL,
              publicKey: process.env.VITE_PUBLIC_VAPID_KEY,
              privateKey: process.env.PRIVATE_VAPID_KEY
            }
          })
        } catch (error) {
          logger.error(error)
        }
      }
    }
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
