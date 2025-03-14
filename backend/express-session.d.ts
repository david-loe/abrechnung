import 'express-session'
import type { Types } from 'mongoose'
import { PushSubscription } from 'web-push'

declare module 'express-session' {
  interface SessionData {
    subscription?: PushSubscription
    passport: {
      user: {
        _id: Types.ObjectId
      }
    }
    redirect?: string
  }
}
