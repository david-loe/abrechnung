import test from 'ava'
import { PDFDocument } from 'pdf-lib'
import displaySettings from '../data/displaySettings.js'
import { Advance, AdvanceState, baseCurrency } from '../types.js'
import Formatter from '../utils/formatter.js'
import printerSettings from './printerSettings.js'
import { ReportPrinter } from './reportPrinter.js'

const user = { _id: 'user', email: 'user@example.org', name: { givenName: 'Test', familyName: 'User' } }

const advance: Advance<string> = {
  _id: 'advance',
  name: 'Test advance',
  reference: 1,
  owner: user,
  editor: user,
  project: { _id: 'project', identifier: 'PROJECT', organisation: 'organisation', balance: { amount: 0 } },
  comments: [],
  state: AdvanceState.APPLIED_FOR,
  log: {},
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  history: [],
  historic: false,
  budget: { amount: 100, currency: baseCurrency },
  balance: { amount: 100 },
  reason: 'Test reason',
  offsetAgainst: []
}

test('ReportPrinter renders configured report type icons and ignores unknown icons', async (t) => {
  const printer = new ReportPrinter<string>(
    { ...printerSettings, _id: 'printerSettings' },
    { distanceRefunds: { car: 0, halfCar: 0, motorcycle: 0 }, vehicleRegistrationWhenUsingOwnCar: 'none' },
    new Formatter('de', 'givenNameFirst'),
    (identifier) => identifier,
    async () => null,
    async () => null,
    { ...displaySettings.reportTypeIcons, advance: ['briefcase', 'unknown-report-icon', 'cash-coin'] }
  )

  const bytes = await printer.print(advance, 'de', {
    reviewDates: false,
    metaInformation: false,
    project: false,
    comments: false,
    notes: false,
    bookingRemark: false,
    additionalOwnerDetails: false
  })
  const pdf = await PDFDocument.load(bytes)

  t.is(pdf.getPageCount(), 1)
  t.true(bytes.length > 0)
})
