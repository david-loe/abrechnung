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
  bookings: [],
  history: [],
  historic: false,
  budget: { amount: 100, currency: baseCurrency },
  balance: { amount: 100, currency: baseCurrency },
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

test('ReportPrinter renders a foreign-currency advance with an offset', async (t) => {
  const exchangeRateDate = new Date('2026-08-18')
  const GBP = { _id: 'GBP', name: { de: 'Britisches Pfund', en: 'British Pound', fr: '', es: '', ru: '', kk: '' } }
  const foreignAdvance: Advance<string> = {
    ...advance,
    state: AdvanceState.APPROVED,
    exchangeRateDate,
    budget: { amount: 100, currency: GBP, exchangeRate: { date: exchangeRateDate, rate: 1.2, amount: 120 } },
    balance: { amount: 60, currency: GBP, exchangeRate: { date: exchangeRateDate, rate: 1.2, amount: 72 } },
    offsetAgainst: [
      {
        type: 'ExpenseReport',
        reportId: 'expense-report',
        subject: 'Foreign expense report',
        amount: 40,
        currency: GBP,
        exchangeRate: { date: exchangeRateDate, rate: 1.2, amount: 48 }
      }
    ]
  }
  const printer = new ReportPrinter<string>(
    { ...printerSettings, _id: 'printerSettings' },
    { distanceRefunds: { car: 0, halfCar: 0, motorcycle: 0 }, vehicleRegistrationWhenUsingOwnCar: 'none' },
    new Formatter('de', 'givenNameFirst'),
    (identifier) => identifier,
    async () => null,
    async () => null,
    displaySettings.reportTypeIcons
  )

  const bytes = await printer.print(foreignAdvance, 'de', {
    reviewDates: false,
    metaInformation: true,
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
