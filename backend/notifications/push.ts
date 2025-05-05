import { SessionData } from 'express-session'
import webpush, { WebPushError } from 'web-push'
import { sessionStore } from '../db.js'
import { logger } from '../logger.js'
import { User } from './../../common/types.js'

interface SessionWithSubscription extends SessionData {
  subscription: NonNullable<SessionData['subscription']>
}

export async function sendPushNotification(title: string, body: string, users: User[], url: string) {
  if (!process.env.VITE_FRONTEND_URL.startsWith('https')) {
    logger.warn('Frontend-URL fehlt oder ist nicht HTTPS, Push-Sendung abgebrochen')
    return
  }
  const payload = JSON.stringify({ title, body, url })
  const allSessions = await getAllSessions()

  for (const user of users) {
    const userSessions = allSessions.filter((s) => s.subscription && user._id.equals(s.passport.user._id)) as SessionWithSubscription[]
    if (userSessions.length === 0) continue

    const latest = userSessions.reduce((max, session) => ((session.cookie.expires || 0) > (max.cookie.expires || 0) ? session : max))
    try {
      await webpush.sendNotification(latest.subscription, payload, {
        vapidDetails: {
          subject: process.env.VITE_FRONTEND_URL,
          publicKey: process.env.VITE_PUBLIC_VAPID_KEY,
          privateKey: process.env.PRIVATE_VAPID_KEY
        }
      })
    } catch (err) {
      if ((err as WebPushError).statusCode === 410 || (err as WebPushError).statusCode === 404) {
        // need to clean up out-of-date subscriptions
      } else {
        logger.error(`Error while sending push notification to user '${user._id}':`, err)
      }
    }
  }
}

async function getAllSessions() {
  const store = await sessionStore()
  if (!store) {
    return []
  }
  return new Promise<SessionData[]>((resolve, reject) => {
    store.all((err, sessions) => {
      if (err) {
        return reject(err)
      }
      resolve(sessions as SessionData[])
    })
  })
}
