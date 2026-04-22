import { Request as ExRequest, Response as ExResponse, NextFunction } from 'express'
import { Error as MongooseErrors } from 'mongoose'
import { ValidateError } from 'tsoa'
import { logger } from '../logger.js'

export class ClientError extends Error {
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

export class ValidationClientError extends ClientError {
  status = 422
  name = 'alerts.ValidationError'
  errors: { path?: string; message: string }[]

  constructor(message: string, errors: { path?: string; message: string }[] = []) {
    super(message)
    this.errors = errors
  }
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

function serializeErrorValue(value: unknown, circularReferences = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) {
    return value
  }
  if (typeof value === 'bigint') {
    return value.toString()
  }
  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`
  }
  if (typeof value !== 'object') {
    return value
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (circularReferences.has(value)) {
    return '[Circular]'
  }

  circularReferences.add(value)

  if (Array.isArray(value)) {
    const serialized = value.map((entry) => serializeErrorValue(entry, circularReferences))
    circularReferences.delete(value)
    return serialized
  }

  const serialized: Record<string, unknown> = {}
  const keys = new Set(Object.keys(value))

  if (value instanceof Error) {
    keys.add('name')
    keys.add('message')
    keys.add('stack')
    keys.add('cause')
  }

  for (const key of Object.getOwnPropertyNames(value)) {
    keys.add(key)
  }

  for (const key of keys) {
    try {
      serialized[key] = serializeErrorValue((value as Record<string, unknown>)[key], circularReferences)
    } catch (error) {
      serialized[key] = `Unable to serialize property: ${key}`
      logger.warn(error)
    }
  }

  circularReferences.delete(value)
  return serialized
}

function serializeError(error: Error) {
  return serializeErrorValue(error)
}

export function errorHandler(err: unknown, req: ExRequest, res: ExResponse, next: NextFunction): void {
  if (!(err instanceof AuthorizationError)) {
    logger.warn(`Error on request: ${req.user?.email || 'Guest'} -> ${req.method} ${req.url}`)
    logger.warn(err)
  }

  if (err instanceof ValidateError) {
    res.status(422).json(serializeError(err))
  } else if (err instanceof MongooseErrors.ValidationError) {
    res.status(422).json(serializeError(err))
  } else if (err instanceof ClientError) {
    res.status(err.status).json(serializeError(err))
  } else if (err instanceof Error) {
    res.status(500).json(serializeError(err))
  } else {
    next(err)
  }
}
