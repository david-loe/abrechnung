import { BookingExportPackage } from 'abrechnung-common/types.js'
import { download, sanitizeFilename } from 'abrechnung-common/utils/scripts.js'
import { strToU8, zipSync } from 'fflate'
import { bookingExportToCSV } from './bookingCsv.js'

type Translate = (key: string) => string

export function createBookingPackageArchive(value: BookingExportPackage<string>, executionDate: string, t: Translate) {
  const files: Record<string, Uint8Array> = { 'bookings.csv': strToU8(bookingExportToCSV(value.bookings, t)) }
  for (const sepaFile of value.sepaFiles) {
    const baseFilename = sanitizeFilename(`${sepaFile.organisation.name}-${executionDate}-${sepaFile.account.lastFour}.xml`)
    let filename = baseFilename
    let suffix = 2
    while (Object.hasOwn(files, filename)) {
      filename = `${baseFilename.slice(0, -4)}-${suffix}.xml`
      suffix += 1
    }
    files[filename] = strToU8(sepaFile.xml)
  }
  return zipSync(files, { level: 6 })
}

export function downloadBookingPackage(value: BookingExportPackage<string>, executionDate: string, t: Translate) {
  const archive = createBookingPackageArchive(value, executionDate, t)
  download(new File([archive.slice().buffer], `booking-export-${executionDate}.zip`, { type: 'application/zip' }))
}
