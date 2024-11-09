import { SessionData } from 'express-session'
import mongoose from 'mongoose'
import webpush from 'web-push'
import { User } from './../common/types.js'
import { sessionStore } from './app.js'

webpush.setVapidDetails(process.env.VITE_FRONTEND_URL, process.env.VITE_PUBLIC_VAPID_KEY, process.env.VITE_PRIVATE_VAPID_KEY)

export async function sendPushNotification(title: String, body: String, users: User[], url: string) {
  let payload = {
    title: title,
    body: body,
    url: url
  }
  for (let i = 0; i < users.length; i++) {
    let sessions = await findSessionsByUserId(users[i]._id)
    console.log(sessions)
    if (sessions) {
      for (let i = 0; i < sessions.length; i++) {
        if (sessions[i].subscription) {
          console.log(sessions[i].subscription)
          webpush
            .sendNotification(sessions[i].subscription, JSON.stringify(payload))
            .then((response) => console.log('Benachrichtigung gesendet:', response))
            .catch((error) => console.error('Fehler beim Senden der Benachrichtigung:', error))
        }
      }
    }
  }
}

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
    // Filtere die Sessions nach der Benutzer-ID
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
