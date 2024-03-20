import MongoStore from 'connect-mongo'
import cors from 'cors'
import express, { Request as ExRequest, Response as ExResponse, NextFunction } from 'express'
import session from 'express-session'
import { MongoClient } from 'mongodb'
import mongoose, { Error as MongooseErrors } from 'mongoose'
import swaggerUi from 'swagger-ui-express'
import { ValidateError } from 'tsoa'
import auth from './auth.js'
import './db.js'
import { RegisterRoutes } from './dist/routes.js'
import swaggerDocument from './dist/swagger.json' assert { type: 'json' }
import i18n from './i18n.js'
import './migrations.js'

const app = express()

app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ limit: '2mb', extended: true }))
app.use(
  cors({
    credentials: true,
    origin: [process.env.VITE_FRONTEND_URL, process.env.VITE_BACKEND_URL]
  })
)

app.use(
  session({
    store: MongoStore.create({ client: mongoose.connection.getClient() as unknown as MongoClient }),
    secret: process.env.COOKIE_SECRET ? process.env.COOKIE_SECRET : 'secret',
    cookie: {
      maxAge: 2 * 24 * 60 * 60 * 1000,
      secure: false,
      sameSite: 'strict'
    },
    resave: true,
    saveUninitialized: false,
    name: i18n.t('headlines.title')
  })
)

app.use(auth)

if (process.env.NODE_ENV === 'development') {
  app.use('/docs', swaggerUi.serve, async (_req: ExRequest, res: ExResponse) => {
    return res.send(swaggerUi.generateHTML(swaggerDocument))
  })
}

RegisterRoutes(app)

app.use(function errorHandler(err: unknown, req: ExRequest, res: ExResponse, next: NextFunction): ExResponse | void {
  if (err instanceof ValidateError) {
    console.warn(`Caught Validation Error for ${req.path}:`, err.fields)
    return res.status(422).json({
      message: 'Validation Failed',
      details: err?.fields
    })
  }
  if (err instanceof MongooseErrors.ValidationError) {
    return res.status(422).send({ error: err })
  }
  if (err instanceof Error) {
    next(err)
  }
  next()
})

export default app
