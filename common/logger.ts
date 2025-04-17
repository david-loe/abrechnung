export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  logLevel: LogLevel = LogLevel.INFO

  constructor(logLevel?: LogLevel | string) {
    if (logLevel) {
      if (typeof logLevel === 'string') {
        this.logLevel = Logger.getLogLevelFromString(logLevel)
      } else {
        this.logLevel = logLevel
      }
    }
  }
  error(message?: any, ...optionalParams: any[]) {
    if (this.logLevel > LogLevel.ERROR) {
      return
    }
    console.error(message, ...optionalParams)
  }
  warn(message?: any, ...optionalParams: any[]) {
    if (this.logLevel > LogLevel.WARN) {
      return
    }
    console.warn(message, ...optionalParams)
  }
  info(message?: any, ...optionalParams: any[]) {
    if (this.logLevel > LogLevel.INFO) {
      return
    }
    console.info(message, ...optionalParams)
  }
  debug(message?: any, ...optionalParams: any[]) {
    if (this.logLevel > LogLevel.DEBUG) {
      return
    }
    console.debug(message, ...optionalParams)
  }

  static getLogLevelFromString(logLevel: string): LogLevel {
    switch (logLevel.toLowerCase()) {
      case 'debug':
        return LogLevel.DEBUG
      case 'info':
        return LogLevel.INFO
      case 'warn':
        return LogLevel.WARN
      case 'error':
        return LogLevel.ERROR
      default:
        return LogLevel.INFO
    }
  }
}
