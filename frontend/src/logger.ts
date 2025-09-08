import { Logger, LogLevel } from 'abrechnung-common/utils/logger.js'
import ENV from '@/env.js'
export const logger = new Logger(ENV.MODE === 'development' ? LogLevel.INFO : LogLevel.ERROR)
