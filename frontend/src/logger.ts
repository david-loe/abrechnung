import { Logger, LogLevel } from '../../common/logger.js'

export const logger = new Logger(import.meta.env.MODE === 'development' ? LogLevel.INFO : LogLevel.ERROR)
