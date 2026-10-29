import test from 'ava'
import displaySettings from '../data/displaySettings.js'
import { Advance, AdvanceState, baseCurrency, Category, ExpenseReport, ExpenseReportState } from '../types.js'
import Formatter from '../utils/formatter.js'
import { readPdf } from './_pdf.js'
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
  const pages = await readPdf(bytes)

  t.is(pages.length, 1)
  t.true(pages[0].content.includes('Test advance'))
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
  const pages = await readPdf(bytes)

  t.is(pages.length, 1)
  t.true(pages[0].content.includes('Foreign expense report'))
  t.regex(pages[0].content, /100[,.]00/)
  t.regex(pages[0].content, /60[,.]00/)
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

test('given hidden metadata, the saved report still contains its category and omits an absent category', async (t) => {
  const { category, report, printer } = expenseReportFixture()
  const options = { project: false, metaInformation: false, reviewDates: false }
  const [withCategory] = await readPdf(await printer.print(report, 'de', options))
  const [withoutCategory] = await readPdf(await printer.print({ ...report, category: null }, 'de', options))
  t.true(withCategory.content.includes(category.name))
  t.false(withoutCategory.content.includes(category.name))
  t.false(withCategory.content.includes('PROJECT'))
})

for (const fontName of ['Inter', 'NotoSans'] as const) {
  for (const longProject of [false, true]) {
    for (const longCategory of [false, true]) {
      test(`${fontName}: project and category remain aligned and do not overlap (long project: ${longProject}, long category: ${longCategory})`, async (t) => {
        const { category, report, printer } = expenseReportFixture(fontName)
        const project = {
          ...report.project,
          identifier: longProject ? 'P'.repeat(200) : 'PROJECT',
          name: longProject ? 'Project name '.repeat(15) : 'Office'
        }
        const name = longCategory ? 'Office supplies '.repeat(30) : category.name
        const pages = await readPdf(
          await printer.print({ ...report, project, category: { ...category, name } }, 'de', { reviewDates: false })
        )
        t.is(pages.length, 1)
        const page = pages[0]
        const label = page.text.find(({ str }) => str.startsWith('labels.category:'))
        const badge = page.text.filter(({ str }) => str.includes('Office supplies'))
        const projectLines = page.text.filter(
          ({ str }) =>
            str.startsWith('labels.project:') ||
            str.includes('PROJECT') ||
            /^P{2,}/.test(str) ||
            str.includes('Project name') ||
            str.includes('Office)')
        )
        const owner = page.text.find(({ str }) => str.startsWith('labels.expensePayer:'))
        if (!label || !owner || !badge.length || !projectLines.length) throw new Error('Missing project, category or owner in PDF')
        t.true(Math.abs(badge[0].transform[5] - label.transform[5]) < 0.01)
        t.true(Math.abs(projectLines[0].transform[5] - label.transform[5]) < 0.01)
        if (longProject) t.true(projectLines.length > 1)
        if (longCategory) t.true(badge.length > 1)
        for (const item of projectLines) t.true(item.transform[4] + item.width < label.transform[4])
        for (const item of [...badge, ...projectLines]) {
          t.true(item.transform[5] > owner.transform[5])
          t.true(item.transform[4] + item.width <= page.width - printerSettings.pagePadding + 0.1)
        }
      })
    }
  }
}
