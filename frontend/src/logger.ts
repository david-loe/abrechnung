import { Logger, LogLevel } from 'abrechnung-common/logger.js'
import ENV from '@/env.js'
export const logger = new Logger(ENV.MODE === 'development' ? LogLevel.INFO : LogLevel.ERROR)
