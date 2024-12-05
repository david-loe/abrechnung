import { SessionData } from 'express-session'
import mongoose from 'mongoose'
import webpush, { PushSubscription } from 'web-push'
import { User } from './../common/types.js'
import { sessionStore } from './app.js'

webpush.setVapidDetails(process.env.VITE_FRONTEND_URL, process.env.VITE_PUBLIC_VAPID_KEY, process.env.VITE_PRIVATE_VAPID_KEY)

/**
 * Sends push notifications to a list of users.
 +
 * @param {string} title - notification title
 * @param {string} body - notification content
 * @param {User[]} users - a list of users to get the notification
 * @param {string} url - url to be opend when clicking on the notification
 */
export async function sendPushNotification(title: String, body: String, users: User[], url: string) {
  let payload = {
    title: title,
    body: body,
    url: url
  }
  for (let i = 0; i < users.length; i++) {
    let sessions = await findSessionsByUserId(users[i]._id)
    if (sessions) {
      for (let i = 0; i < sessions.length; i++) {
        if (sessions[i].subscription) {
          webpush
            .sendNotification(sessions[i].subscription as PushSubscription, JSON.stringify(payload))
            .then((response) => console.log('Benachrichtigung gesendet:', response))
            .catch((error) => console.error('Fehler beim Senden der Benachrichtigung:', error))
        }
      }
    }
  }
}

/**
 * gets all session of the user identified by userId.
 *
 * @param {mongoose.Types.ObjectId} userId - User Identifier
 * @returns {Promise<SessionData[]>} - array including all the sessions of one user
 */
async function findSessionsByUserId(userId: mongoose.Types.ObjectId) {
  try {
    const sessions: SessionData[] = await new Promise<SessionData[]>((resolve, reject) => {
      sessionStore.all((err, sessions) => {
        if (err) {
          return reject(err)
        }
        if (Array.isArray(sessions)) {
          resolve(sessions)
        }
      })
    })
    const userSessions = sessions.filter((session) => {
      return (
        session.passport && session.passport.user && session.passport.user._id && session.passport.user._id.toString() === userId.toString()
      )
    })
    return userSessions
  } catch (error) {
    console.error('Fehler beim Abrufen der Sessions:', error)
    return []
  }
}
