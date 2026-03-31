import fs from 'node:fs/promises'
import path from 'node:path'
import { getConnectionSettings, getDisplaySettings, getPrinterSettings, getTravelSettings } from '../../db.js'
import ENV from '../../env.js'
import { reportPrinter } from '../../factory.js'
import { updateI18n } from '../../i18n.js'
import { logger } from '../../logger.js'
import { writeToDiskFilePath } from '../../pdf/helper.js'
import { type IntegrationEvent } from '../events.js'
import { Integration } from '../integration.js'
import { ReportWriteDiskPayload } from '../types.js'

class ReportDiskIntegration extends Integration {
  public constructor() {
    super('reports.writeDisk')
  }

  protected override getJobOptions(operation: string) {
    if (operation === 'write') {
      return { attempts: 6, backoff: { type: 'exponential', delay: 3_000 } }
    }

    return super.getJobOptions(operation)
  }

  public override handles(event: IntegrationEvent) {
    return event.type === 'report.review_completed'
  }

  public override async runEvent(event: IntegrationEvent) {
    const report = event.report as ReportWriteDiskPayload['report']
    await this.enqueue('write', { filePath: await writeToDiskFilePath(report), report })
  }

  public override async execute(operation: string, payload: unknown) {
    if (operation !== 'write') {
      return super.execute(operation, payload)
    }

    await saveReportOnDisk(payload as ReportWriteDiskPayload)
  }
}

export const reportDiskIntegration = new ReportDiskIntegration()

export async function saveReportOnDisk({ filePath, report }: ReportWriteDiskPayload) {
  if (!ENV.BACKEND_SAVE_REPORTS_ON_DISK) {
    logger.debug('Report disk delivery disabled, skipping integration job.')
    return
  }

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
