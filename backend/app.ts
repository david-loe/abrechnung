import cors from 'cors'
import express, { NextFunction as ExNextFunction, Request as ExRequest, Response as ExResponse } from 'express'
import { rateLimit } from 'express-rate-limit'
import session from 'express-session'
import swaggerUi from 'swagger-ui-express'
import auth from './auth.js'
import { errorHandler, RateLimitExceededError } from './controller/error.js'
import { connectDB, sessionStore } from './db.js'
import { RegisterRoutes } from './dist/routes.js'
import swaggerDocument from './dist/swagger.json' with { type: 'json' }
import ENV from './env.js'
import i18n from './i18n.js'
import { logger } from './logger.js'
import { checkForMigrations } from './migrations.js'

export default async function () {
  await connectDB()
  await checkForMigrations()

  const app = express()

  if (ENV.TRUST_PROXY) {
    app.set('trust proxy', ENV.TRUST_PROXY)
    app.get('/ip', (request, response) => {
      response.send(request.ip)
    })
  }

  app.use(express.json({ limit: '2mb' }))
  app.use(express.urlencoded({ limit: '2mb', extended: true }))
  app.use(cors({ credentials: true, origin: [ENV.VITE_FRONTEND_URL, ENV.VITE_BACKEND_URL] }))

  if (ENV.RATE_LIMIT_WINDOW_MS || ENV.RATE_LIMIT) {
    app.use(
      rateLimit({
        windowMs: ENV.RATE_LIMIT_WINDOW_MS,
        limit: ENV.RATE_LIMIT,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        skip: (req, _res) => req.method !== 'POST',
        handler: (_req, _res, next) => next(new RateLimitExceededError())
      })
    )
  }

  // only use secure cookie with https and trust proxy setup
  const useSecureCookie = ENV.VITE_BACKEND_URL.startsWith('https') && Boolean(ENV.TRUST_PROXY)

  app.use(
    session({
      store: await sessionStore(),
      secret: ENV.COOKIE_SECRET,
      cookie: {
        maxAge: ENV.COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
        secure: useSecureCookie,
        sameSite: useSecureCookie ? 'none' : 'lax'
      },
      resave: true,
      saveUninitialized: false,
      name: i18n.t('headlines.title').replace(/[^!#$%&'*+\-.^_`|~0-9A-Za-z]/g, '_')
    })
  )

  app.use(auth)

  // Request-Logging
  app.use((req, _res, next) => {
    logger.debug(`${req.user?.email || 'Guest'} -> ${req.method} ${req.url}`)
    if (req.body && Object.keys(req.body).length > 0) {
      logger.debug('Body:', req.body)
    }
    next()
  })

  if (ENV.NODE_ENV === 'development') {
    app.use(
      '/docs',
      // fix path when behind proxy https://github.com/scottie1984/swagger-ui-express/issues/183
      (req: ExRequest, res: ExResponse, next: ExNextFunction) => {
        if (req.originalUrl === '/docs') return res.redirect('docs/')
        next()
      },
      swaggerUi.serve,
      async (_req: ExRequest, res: ExResponse) => {
        res.send(swaggerUi.generateHTML(swaggerDocument))
      }
    )
  }

  RegisterRoutes(app)

  app.use(errorHandler)
  return app
}
