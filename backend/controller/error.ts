import { Request as ExRequest, Response as ExResponse, NextFunction } from 'express'
import { Error as MongooseErrors } from 'mongoose'
import { ValidateError } from 'tsoa'
import { logger } from '../logger.js'

class ClientError extends Error {
  status = 400
}

export class AuthorizationError extends ClientError {
  status = 401
  name = 'alerts.unauthorized'
}

export class NotAllowedError extends ClientError {
  status = 403
  name = 'alerts.notAllowed'
}

export class NotFoundError extends ClientError {
  status = 404
  name = 'alerts.notFound'
}

export class ConflictError extends ClientError {
  status = 409
  name = 'alerts.conflict'
}

export class RateLimitExceededError extends ClientError {
  status = 429
  name = 'alerts.rateLimitExceeded'
}

export class NotImplementedError extends ClientError {
  status = 501
  name = 'alerts.notImplemented'
}

export class ReadOnlyError extends ClientError {
  status = 503
  name = 'alerts.isReadOnly'
}

export function errorHandler(err: unknown, req: ExRequest, res: ExResponse, next: NextFunction): void {
  if (!(err instanceof AuthorizationError)) {
    logger.warn(`Error on request: ${req.user?.email || 'Guest'} -> ${req.method} ${req.url}`)
    logger.warn(err)
  }

  if (err instanceof ValidateError) {
    res.status(422).json(err)
  } else if (err instanceof MongooseErrors.ValidationError) {
    res.status(422).json(err)
  } else if (err instanceof ClientError) {
    res.status(err.status).json(Object.assign({ message: err.message }, err))
  } else if (err instanceof Error) {
    res.status(500).json(Object.assign({ message: err.message }, err))
  } else {
    next(err)
  }
}
