import fs from 'node:fs/promises'
import path from 'node:path'
import { getConnectionSettings, getDisplaySettings, getPrinterSettings, getTravelSettings } from '../../db.js'
import { reportPrinter } from '../../factory.js'
import { updateI18n } from '../../i18n.js'
import { logger } from '../../logger.js'
import { runOutboundAction } from '../runtime.js'
import { ReportWriteDiskPayload } from '../types.js'

export async function saveReportOnDisk({ filePath, report }: ReportWriteDiskPayload) {
  const connectionSettings = await getConnectionSettings(false)
  const lng = connectionSettings.PDFReportsViaEmail.locale

  const displaySettings = await getDisplaySettings(false)
  updateI18n(displaySettings.locale)

  const printerSettings = await getPrinterSettings(false)
  const travelSettings = await getTravelSettings(false)
  reportPrinter.setSettings(printerSettings)
  reportPrinter.setTravelSettings(travelSettings)
  const pdf = await reportPrinter.print(report, lng)

  await fs.mkdir(path.dirname(filePath), { recursive: true })
  logger.debug(`Write to file ${filePath}`)
  await fs.writeFile(filePath, pdf)
}

export async function writeReportToDisk(filePath: string, report: ReportWriteDiskPayload['report']) {
  await runOutboundAction('reports.write_disk', { filePath, report })
}
