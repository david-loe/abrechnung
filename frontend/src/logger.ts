import { Logger, LogLevel } from '@/../../common/logger.js'
import ENV from '@/env'
export const logger = new Logger(ENV.MODE === 'development' ? LogLevel.INFO : LogLevel.ERROR)
