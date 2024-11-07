import MongoStore from 'connect-mongo'
import cors from 'cors'
import express, { Request as ExRequest, Response as ExResponse } from 'express'
import { rateLimit } from 'express-rate-limit'
import session from 'express-session'
import mongoose from 'mongoose'
import swaggerUi from 'swagger-ui-express'
import { Subscription } from '../common/types.js'
import auth from './auth.js'
import { errorHandler, RateLimitExceededError } from './controller/error.js'
import { connectDB } from './db.js'
import { RegisterRoutes } from './dist/routes.js'
import swaggerDocument from './dist/swagger.json' with { type: 'json' }
import i18n from './i18n.js'
import { checkForMigrations } from './migrations.js'
await connectDB()
await checkForMigrations()
const app = express()

if (process.env.TRUST_PROXY) {
  if (process.env.TRUST_PROXY.toLowerCase() === 'true') {
    app.set('trust proxy', true)
  } else if (process.env.TRUST_PROXY.match(/^\d+$/)) {
    app.set('trust proxy', parseInt(process.env.TRUST_PROXY))
  } else {
    app.set('trust proxy', process.env.TRUST_PROXY)
  }
  app.get('/ip', (request, response) => {
    response.send(request.ip)
  })
}

app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ limit: '2mb', extended: true }))
app.use(
  cors({
    credentials: true,
    origin: [process.env.VITE_FRONTEND_URL, process.env.VITE_BACKEND_URL]
  })
)

if (process.env.RATE_LIMIT_WINDOW_MS && process.env.RATE_LIMIT) {
  app.use(
    rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS),
      limit: parseInt(process.env.RATE_LIMIT),
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skip: (req, res) => req.method !== 'POST',
      handler: (req, res, next) => next(new RateLimitExceededError())
    })
  )
}

if (process.env.RATE_LIMIT_WINDOW_MS && process.env.RATE_LIMIT) {
  app.use(
    rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS),
      limit: parseInt(process.env.RATE_LIMIT),
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skip: (req, res) => req.method !== 'POST',
      handler: (req, res, next) => next(new RateLimitExceededError())
    })
  )
}

export const sessionStore = MongoStore.create({ client: mongoose.connection.getClient() })
app.use(
  session({
    store: sessionStore,
    secret: process.env.COOKIE_SECRET ? process.env.COOKIE_SECRET : 'secret',
    cookie: {
      maxAge: 2 * 24 * 60 * 60 * 1000,
      secure: false,
      sameSite: 'strict'
    },
    resave: true,
    saveUninitialized: false,
    name: i18n.t('headlines.title').replace(/[^!#$%&'*+\-.^_`|~0-9A-Za-z]/g, '_')
  })
)

app.post('/subscribe', (req, res) => {
  let subscription: Subscription = req.body
  if (subscription && subscription.endpoint) {
    req.session.subscription = subscription
    console.log(req.session)
    console.log(req.session.subscription)
    res.status(201).json({ subscription: subscription })
  } else {
    res.status(400).json({ info: 'Subscription was not accepted' })
  }
})

app.use(auth)

if (process.env.NODE_ENV === 'development') {
  app.use('/docs', swaggerUi.serve, async (_req: ExRequest, res: ExResponse) => {
    res.send(swaggerUi.generateHTML(swaggerDocument))
  })
}

RegisterRoutes(app)

app.use(errorHandler)

export default app
