import { Request as ExRequest, Response as ExResponse, NextFunction } from 'express'
import { Error as MongooseErrors } from 'mongoose'
import { ValidateError } from 'tsoa'
import { log } from '../../common/logger.js'

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

export class NotImplementedError extends ClientError {
  status = 501
  name = 'alerts.notImplemented'
}

export function errorHandler(err: unknown, req: ExRequest, res: ExResponse, next: NextFunction): ExResponse | void {
  if (!(err instanceof AuthorizationError)) {
    log(`Error on request of ${req.path}`, 'warn')
    log(err, 'warn')
  }

  if (err instanceof ValidateError) {
    return res.status(422).json(err)
  } else if (err instanceof MongooseErrors.ValidationError) {
    return res.status(422).json(err)
  } else if (err instanceof ClientError) {
    return res.status(err.status).json(Object.assign({ message: err.message }, err))
  } else if (err instanceof Error) {
    return res.status(500).json(Object.assign({ message: err.message }, err))
  }
  next(err)
}
