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
import i18n from './i18n.js'
import { logger } from './logger.js'
import { checkForMigrations } from './migrations.js'

export default async function () {
  await connectDB()
  await checkForMigrations()

  const app = express()
  if (process.env.TRUST_PROXY) {
    if (process.env.TRUST_PROXY.toLowerCase() === 'true') {
      app.set('trust proxy', true)
    } else if (process.env.TRUST_PROXY.match(/^\d+$/)) {
      app.set('trust proxy', Number.parseInt(process.env.TRUST_PROXY))
    } else {
      app.set('trust proxy', process.env.TRUST_PROXY)
    }
    app.get('/ip', (request, response) => {
      response.send(request.ip)
    })
  }

  app.use(express.json({ limit: '2mb' }))
  app.use(express.urlencoded({ limit: '2mb', extended: true }))
  app.use(cors({ credentials: true, origin: [process.env.VITE_FRONTEND_URL, process.env.VITE_BACKEND_URL] }))

  if (process.env.RATE_LIMIT_WINDOW_MS && process.env.RATE_LIMIT) {
    app.use(
      rateLimit({
        windowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS),
        limit: Number.parseInt(process.env.RATE_LIMIT),
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        skip: (req, _res) => req.method !== 'POST',
        handler: (_req, _res, next) => next(new RateLimitExceededError())
      })
    )
  }

  // only use secure cookie with https and trust proxy setup
  const useSecureCookie = process.env.VITE_BACKEND_URL.startsWith('https') && Boolean(process.env.TRUST_PROXY)

  app.use(
    session({
      store: await sessionStore(),
      secret: process.env.COOKIE_SECRET,
      cookie: {
        maxAge: (Number.parseInt(process.env.COOKIE_MAX_AGE_DAYS) || 30) * 24 * 60 * 60 * 1000,
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

  if (process.env.NODE_ENV === 'development') {
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
