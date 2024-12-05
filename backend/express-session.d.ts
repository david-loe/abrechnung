import 'express-session'
import type { Types } from 'mongoose'
import { PushSubscription } from 'web-push'

// adding subscription and passport to SessionData interface for saving the Push Subscription in th session
declare module 'express-session' {
  interface SessionData {
    subscription?: PushSubscription
    passport?: {
      user?: {
        _id?: Types.ObjectId
      }
    }
  }
}
