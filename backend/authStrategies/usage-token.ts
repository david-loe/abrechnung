import { tokenAdminUser } from 'abrechnung-common/types.js'
import { Strategy as BearerStrategy } from 'passport-http-bearer'
import ENV from '../env.js'

export default new BearerStrategy(async (token, done) => {
  try {
    const isValid = Boolean(ENV.USAGE_API_TOKEN) && token === ENV.USAGE_API_TOKEN
    if (isValid) {
      done(null, tokenAdminUser)
    } else {
      done(null, false)
    }
  } catch (error) {
    done(error)
  }
})
