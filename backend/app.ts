import cors from 'cors'
import express, { NextFunction as ExNextFunction, Request as ExRequest, Response as ExResponse } from 'express'
import { rateLimit } from 'express-rate-limit'
import session from 'express-session'
import mongoose from 'mongoose'
import swaggerUi from 'swagger-ui-express'
import auth from './auth.js'
import { errorHandler, RateLimitExceededError, ReadOnlyError } from './controller/error.js'
import { BACKEND_CACHE, connectDB, disconnectDB, sessionStore } from './db.js'
import { RegisterRoutes } from './dist/routes.js'
import swaggerDocument from './dist/swagger.json' with { type: 'json' }
import ENV from './env.js'
import i18n from './i18n.js'
import { logger } from './logger.js'
import { checkForMigrations } from './migrations.js'
import { closeMailQueue } from './workers/mail.js'
import { closeSaveReportOnDiskQueue } from './workers/saveReportOnDisk.js'
import { closeWebhookQueue } from './workers/webhook.js'

export default async function () {
  await connectDB()
  await checkForMigrations()
  await mongoose.syncIndexes()

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

  app.use((req, _res, next) => {
    if (BACKEND_CACHE.settings.isReadOnly && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.path !== '/readOnly') {
      next(new ReadOnlyError())
    } else {
      next()
    }
  })

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

export async function shutdown() {
  await closeMailQueue()
  await closeSaveReportOnDiskQueue()
  await closeWebhookQueue()
  await disconnectDB()
}
