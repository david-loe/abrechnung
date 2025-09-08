import { Logger } from 'abrechnung-common/utils/logger.js'
import ENV from './env.js'

export const logger = new Logger(ENV.LOG_LEVEL)
