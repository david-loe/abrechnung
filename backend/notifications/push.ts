import { User } from 'abrechnung-common/types.js'
import { SessionData } from 'express-session'
import { Types } from 'mongoose'
import webpush, { WebPushError } from 'web-push'
import { sessionStore } from '../db.js'
import ENV from '../env.js'
import { logger } from '../logger.js'

interface SessionWithSubscription extends SessionData {
  subscription: NonNullable<SessionData['subscription']>
}

export async function sendPushNotification(title: string, body: string, users: User<Types.ObjectId>[], url: string) {
  if (!ENV.VITE_FRONTEND_URL.startsWith('https')) {
    logger.debug('Frontend-URL is not HTTPS, Push-Notification sending stopped.')
    return
  }
  if (!ENV.PRIVATE_VAPID_KEY || !ENV.VITE_PUBLIC_VAPID_KEY) {
    logger.debug('VAPID keys are not set, Push-Notification sending stopped.')
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
        vapidDetails: { subject: ENV.VITE_FRONTEND_URL, publicKey: ENV.VITE_PUBLIC_VAPID_KEY, privateKey: ENV.PRIVATE_VAPID_KEY }
      })
      logger.debug(`Send push notification to ${user.email}`)
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
