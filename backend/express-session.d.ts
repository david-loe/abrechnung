// src/express-session.d.ts

import 'express-session'

declare module 'express-session' {
  interface SessionData {
    subscriptions: Array<Subscription>
    passport?: {
      user?: {
        _id?: mongoose.Types.ObjectId // oder mongoose.Types.ObjectId, je nachdem, wie du die ID speicherst
      }
    }
  }
}
