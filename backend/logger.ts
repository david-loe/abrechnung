import { Logger } from 'abrechnung-common/logger.js'
import ENV from './env.js'

export const logger = new Logger(ENV.LOG_LEVEL)
