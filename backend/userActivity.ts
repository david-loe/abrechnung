import { logger } from './logger.js'
import User, { UserDoc } from './models/user.js'

const activityUpdateInterval = 5 * 60 * 1000

/** Logins are recorded immediately; other authenticated activity is throttled per user. */
export async function recordUserActivity(user: UserDoc, login = false) {
  const now = new Date()
  const cutoff = new Date(now.valueOf() - (login ? 0 : activityUpdateInterval))
  if (user.lastActiveAt && new Date(user.lastActiveAt) > cutoff) return

  try {
    const result = await User.updateOne(
      { _id: user._id, $or: [{ lastActiveAt: { $exists: false } }, { lastActiveAt: null }, { lastActiveAt: { $lte: cutoff } }] },
      { $max: { lastActiveAt: now } }
    )
    if (result.modifiedCount) {
      user.lastActiveAt = now
      // The atomic update already persisted this value. A later save must not overwrite newer activity.
      user.unmarkModified('lastActiveAt')
    }
  } catch (error) {
    logger.warn(`Could not record activity for user '${user._id}'`, error)
  }
}
