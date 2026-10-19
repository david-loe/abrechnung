import { mock } from 'node:test'
import test from 'ava'
import { PDFDocument, PDFPage } from 'pdf-lib'
import displaySettings from '../data/displaySettings.js'
import { Advance, AdvanceState, baseCurrency, Category, ExpenseReport, ExpenseReportState } from '../types.js'
import Formatter from '../utils/formatter.js'
import { PDFDrawer } from './printer.js'
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

function expenseReportFixture(fontName: 'Inter' | 'NotoSans' = printerSettings.fontName) {
  const category = {
    _id: 'category',
    name: 'Office supplies',
    style: { color: '#336699', text: 'white' },
    for: 'ExpenseReport',
    isDefault: false
  } as Category<string>
  const report: ExpenseReport<string> = {
    _id: 'expense-report',
    name: 'Expenses',
    reference: 2,
    owner: user,
    editor: user,
    project: advance.project,
    comments: [],
    state: ExpenseReportState.IN_WORK,
    log: {},
    createdAt: advance.createdAt,
    updatedAt: advance.updatedAt,
    bookings: [],
    history: [],
    historic: false,
    expenses: [],
    advances: [],
    addUp: [],
    category
  }
  const printer = new ReportPrinter<string>(
    { ...printerSettings, fontName, _id: 'printerSettings' },
    { distanceRefunds: { car: 0, halfCar: 0, motorcycle: 0 }, vehicleRegistrationWhenUsingOwnCar: 'none' },
    new Formatter('de', 'givenNameFirst'),
    (key) => key,
    async () => null,
    async () => null,
    displaySettings.reportTypeIcons
  )
  return { category, report, printer }
}

test.serial('expense report category badge is printed independently of project and metadata options', async (t) => {
  const badge = mock.method(PDFDrawer.prototype, 'drawBadge')
  t.teardown(() => badge.mock.restore())
  const { category, report, printer } = expenseReportFixture()
  const options = { project: false, metaInformation: false, reviewDates: false }
  const bytes = await printer.print(report, 'de', options)
  t.is((await PDFDocument.load(bytes)).getPageCount(), 1)
  t.is(badge.mock.callCount(), 1)
  t.is(badge.mock.calls[0].arguments[0], category.name)
  t.deepEqual(badge.mock.calls[0].arguments[1], category.style)
  await printer.print({ ...report, category: null }, 'de', options)
  t.is(badge.mock.callCount(), 1)
})

test.serial('expense report project and category share their first text upper edge without overlapping', async (t) => {
  const text = mock.method(PDFDrawer.prototype, 'drawText')
  const renderedText = mock.method(PDFPage.prototype, 'drawText')
  const badge = mock.method(PDFDrawer.prototype, 'drawBadge')
  t.teardown(() => {
    text.mock.restore()
    renderedText.mock.restore()
    badge.mock.restore()
  })
  for (const fontName of ['Inter', 'NotoSans'] as const) {
    const { category, report, printer } = expenseReportFixture(fontName)
    for (const longProject of [false, true]) {
      for (const longCategory of [false, true]) {
        text.mock.resetCalls()
        renderedText.mock.resetCalls()
        badge.mock.resetCalls()
        const project = {
          ...report.project,
          identifier: longProject ? 'P'.repeat(200) : 'PROJECT',
          name: longProject ? 'Project name '.repeat(15) : 'Office'
        }
        const bytes = await printer.print(
          { ...report, project, category: { ...category, name: longCategory ? 'Office supplies '.repeat(30) : category.name } },
          'de',
          { reviewDates: false }
        )
        t.is((await PDFDocument.load(bytes)).getPageCount(), 1)
        const labelIndex = text.mock.calls.findIndex(({ arguments: [value] }) => value === 'labels.category: ')
        const label = text.mock.calls[labelIndex].arguments[1]
        const projectLines = text.mock.calls
          .slice(0, labelIndex)
          .filter(
            ({ arguments: [, options] }) =>
              options.xStart === printerSettings.pagePadding && options.fontSize === printerSettings.fontSizes.M
          )
        t.true(projectLines.length > 0)
        t.is(projectLines[0].arguments[1].yStart, label.yStart)
        if (longProject) t.true(projectLines.length > 1)
        const badgeCall = badge.mock.calls[0]
        if (typeof badgeCall.result !== 'number') throw new Error('Badge did not return its lower edge')
        const drawer = badgeCall.this as PDFDrawer<string>
        const badgeOptions = badgeCall.arguments[2]
        t.is(label.yStart, badgeOptions.yStart)
        const renderedBadge = renderedText.mock.calls.find(({ arguments: [value] }) => value.startsWith('Office supplies'))
        t.truthy(renderedBadge)
        if (renderedBadge) {
          const renderedLabel = renderedText.mock.calls.find(({ arguments: [value] }) => value === 'labels.category: ')
          t.is(renderedBadge.arguments[1]?.y, renderedLabel?.arguments[1]?.y)
        }
        for (const {
          arguments: [value, options]
        } of projectLines) {
          t.true(options.xStart + drawer.font.widthOfTextAtSize(value, options.fontSize) < label.xStart)
        }
        const owner = text.mock.calls.find(({ arguments: [value] }) => value.startsWith('labels.expensePayer:'))
        t.truthy(owner)
        if (owner) {
          t.true(owner.arguments[1].yStart < badgeCall.result)
          t.true(owner.arguments[1].yStart < projectLines[projectLines.length - 1].arguments[1].yStart)
        }
      }
    }
  }
})
