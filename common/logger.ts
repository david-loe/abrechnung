export enum LogLevel {
  DEBUG = 0,
  INFO,
  WARN,
  ERROR
}

export class Logger {
  logLevel: LogLevel = LogLevel.INFO

  constructor(logLevel?: LogLevel | string) {
    if (typeof logLevel === 'string') {
      logLevel = Logger.getLogLevelFromString(logLevel)
    }
    if (logLevel) {
      this.logLevel = logLevel
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
