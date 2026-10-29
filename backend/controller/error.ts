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
