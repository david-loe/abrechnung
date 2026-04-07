import {
  Advance,
  DisplaySettings,
  ExpenseReport,
  HealthCareCost,
  Locale,
  PrinterSettings,
  Travel,
  TravelSettings
} from 'abrechnung-common/types.js'
import { createReportPrinter } from '../factory.js'
import { updateI18n } from '../i18n.js'

interface RenderReportPdfOptions {
  displaySettings: Pick<DisplaySettings, 'locale' | 'nameDisplayFormat'>
  printerSettings: PrinterSettings
  travelSettings: TravelSettings
}

export async function renderReportPdf(
  report: Travel | ExpenseReport | HealthCareCost | Advance,
  language: Locale,
  { displaySettings, printerSettings, travelSettings }: RenderReportPdfOptions
) {
  updateI18n(displaySettings.locale)

  const printer = createReportPrinter(printerSettings, travelSettings, displaySettings.nameDisplayFormat)
  return await printer.print(report, language)
}
