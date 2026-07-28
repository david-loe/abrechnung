import {
  Booking,
  BookingExportPackage,
  BookingExportPackageRequest,
  BookingExportPreview,
  BookingExportRow,
  IdDocument,
  Organisation as IOrganisation,
  idDocumentToId,
  ReportModelName,
  State,
  User
} from 'abrechnung-common/types.js'
import { isValidBic, isValidIban, maskIban } from 'abrechnung-common/utils/bank.js'
import { refNumberToString, roundAmount } from 'abrechnung-common/utils/scripts.js'
import { Model, mongo, Types } from 'mongoose'
import { calculateBookings } from '../models/booking.js'
import Organisation from '../models/organisation.js'
import { NotFoundError, ValidationClientError } from './error.js'
import { createSepaDocument, SepaPayment } from './sepa.js'
import { AuthenticatedExpressRequest } from './types.js'

interface PopulatedProject {
  _id: Types.ObjectId
  identifier: string
  organisation: Types.ObjectId
}

interface ExportReport {
  _id: Types.ObjectId
  name: string
  reference: number
  owner: Pick<User<Types.ObjectId>, '_id' | 'name' | 'employeeId' | 'settings'>
  bookings: (Omit<Booking<Types.ObjectId>, 'ledgerAccount' | 'project'> & {
    ledgerAccount: BookingExportRow<Types.ObjectId>['ledgerAccount']
    project: PopulatedProject
  })[]
}

type StoredBooking = Omit<Booking<Types.ObjectId>, 'ledgerAccount' | 'project'> & { ledgerAccount: Types.ObjectId; project: Types.ObjectId }

interface ExportPayment extends SepaPayment {
  report: ExportReport
  organisation: IOrganisation<Types.ObjectId, mongo.Binary>
  projectAmounts: Map<string, number>
}

interface ExportContext {
  organisations: IOrganisation<Types.ObjectId, mongo.Binary>[]
  payments: ExportPayment[]
  bookings: BookingExportRow<Types.ObjectId>[]
  storedBookingsByReport: Map<string, StoredBooking[]>
  errors: string[]
}

function objectId(value: unknown) {
  return idDocumentToId(value)?.toString()
}

function isValidExecutionDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

export function getEmployeeLiabilityProjectAmounts(
  bookings: Pick<ExportReport['bookings'][number], 'side' | 'amount' | 'ledgerAccount' | 'project'>[],
  organisationsById: Map<string, Pick<IOrganisation<Types.ObjectId, mongo.Binary>, 'accountingSettings'>>
) {
  const projectAmountsByOrganisation = new Map<string, Map<string, number>>()
  for (const booking of bookings) {
    const organisationId = objectId(booking.project.organisation)
    if (!organisationId) continue
    const organisation = organisationsById.get(organisationId)
    if (
      !organisation ||
      booking.side !== 'credit' ||
      objectId(booking.ledgerAccount) !== objectId(organisation.accountingSettings.employeeLiabilitiesAccount)
    ) {
      continue
    }
    let projectAmounts = projectAmountsByOrganisation.get(organisationId)
    if (!projectAmounts) {
      projectAmounts = new Map()
      projectAmountsByOrganisation.set(organisationId, projectAmounts)
    }
    const projectId = booking.project._id.toString()
    projectAmounts.set(projectId, roundAmount((projectAmounts.get(projectId) ?? 0) + booking.amount))
  }
  return projectAmountsByOrganisation
}

async function loadExportContext(
  // biome-ignore lint/suspicious/noExplicitAny: shared helper accepts each concrete report model
  reportModel: Model<any>,
  reportType: ReportModelName,
  requestedReports: IdDocument<string>[],
  request: AuthenticatedExpressRequest
) {
  const requestedIds = Array.from(new Set(requestedReports.map((report) => idDocumentToId(report).toString())))
  if (requestedIds.length === 0) {
    return { organisations: [], payments: [], bookings: [], storedBookingsByReport: new Map(), errors: [] } satisfies ExportContext
  }

  const filter = { _id: { $in: requestedIds }, historic: false, state: State.BOOKABLE } as Record<string, unknown>
  if (request.user.projects.supervised.length > 0) filter.project = { $in: request.user.projects.supervised }

  const projection: Record<string, 1> = { name: 1, reference: 1, owner: 1, project: 1, log: 1 }
  if (reportType === 'Advance') {
    projection.budget = 1
  } else {
    projection.expenses = 1
    projection.addUp = 1
    projection.advances = 1
  }
  if (reportType === 'Travel') {
    projection.stages = 1
    projection.days = 1
    projection.professionalShare = 1
  }
  const reports = (await reportModel.find(filter, projection).lean()) as ExportReport[]
  if (reports.length !== requestedIds.length) {
    throw new NotFoundError('At least one selected report was not found, is not bookable, or is not allowed')
  }
  await reportModel.populate(reports, { path: 'owner', select: { name: 1, employeeId: 1, 'settings.bankAccount': 1 } })

  const reportsById = new Map(reports.map((report) => [report._id.toString(), report]))
  const orderedReports = requestedIds.map((reportId) => reportsById.get(reportId) as ExportReport)
  const calculatedBookings = await Promise.all(
    orderedReports.map(
      async (report) =>
        (await calculateBookings(report as unknown as Parameters<typeof calculateBookings>[0], reportType)) as StoredBooking[]
    )
  )
  const storedBookingsByReport = new Map<string, StoredBooking[]>()
  for (const [index, report] of orderedReports.entries()) {
    const reportBookings = calculatedBookings[index]
    storedBookingsByReport.set(report._id.toString(), reportBookings)
    report.bookings = reportBookings as unknown as ExportReport['bookings']
  }
  await reportModel.populate(orderedReports, [
    { path: 'bookings.ledgerAccount' },
    { path: 'bookings.project', select: { identifier: 1, organisation: 1 } }
  ])
  const organisationIds = Array.from(
    new Set(orderedReports.flatMap(({ bookings }) => bookings.map(({ project }) => objectId(project.organisation))))
  ).filter((id): id is string => Boolean(id))
  const organisations = (await Organisation.find({ _id: { $in: organisationIds } }).lean()) as IOrganisation<Types.ObjectId, mongo.Binary>[]
  if (organisations.length !== organisationIds.length) throw new ValidationClientError('A booking organisation is missing')
  const organisationsById = new Map(organisations.map((organisation) => [organisation._id.toString(), organisation]))

  const bookings = orderedReports.flatMap((report) =>
    report.bookings.map(
      (booking): BookingExportRow<Types.ObjectId> => ({
        ...booking,
        report: { _id: report._id, name: report.name, reference: report.reference },
        reportType,
        employee: { _id: report.owner._id, name: report.owner.name, employeeId: report.owner.employeeId }
      })
    )
  )

  const payments: ExportPayment[] = []
  const errors = new Set<string>()
  for (const report of orderedReports) {
    const projectAmountsByOrganisation = getEmployeeLiabilityProjectAmounts(report.bookings, organisationsById)

    for (const [organisationId, projectAmounts] of projectAmountsByOrganisation) {
      const amount = roundAmount(Array.from(projectAmounts.values()).reduce((sum, projectAmount) => sum + projectAmount, 0))
      if (amount <= 0) continue
      const organisation = organisationsById.get(organisationId) as IOrganisation<Types.ObjectId, mongo.Binary>
      const ownerAccount = report.owner.settings.bankAccount
      if (!ownerAccount || !isValidIban(ownerAccount.iban) || (ownerAccount.bic && !isValidBic(ownerAccount.bic))) {
        errors.add(`missingEmployeeBankAccount:${refNumberToString(report.reference, reportType)}`)
      }
      payments.push({
        key: `${reportType}:${report._id}:${organisationId}:${report.owner._id}:${amount.toFixed(2)}`,
        reportType,
        reference: report.reference,
        reportName: report.name,
        ownerId: report.owner._id.toString(),
        creditorAccount: ownerAccount ?? { accountHolder: '', iban: '' },
        amount,
        report,
        organisation,
        projectAmounts
      })
    }
  }

  const affectedOrganisationIds = new Set(payments.map(({ organisation }) => organisation._id.toString()))
  for (const organisation of organisations) {
    if (!affectedOrganisationIds.has(organisation._id.toString())) continue
    if (organisation.accountingSettings.payoutAccounts.length === 0) errors.add(`missingPayoutAccount:${organisation.name}`)
    for (const account of organisation.accountingSettings.payoutAccounts) {
      if (!isValidIban(account.iban) || (account.bic && !isValidBic(account.bic)))
        errors.add(`invalidPayoutAccount:${organisation.name}:${account.name}`)
      if (organisation.accountingSettings.includeBankBookings && !account.ledgerAccount) {
        errors.add(`missingBankLedgerAccount:${organisation.name}:${account.name}`)
      }
    }
  }

  return { organisations, payments, bookings, storedBookingsByReport, errors: Array.from(errors) } satisfies ExportContext
}

export async function getBookingExportPreview(
  // biome-ignore lint/suspicious/noExplicitAny: shared helper accepts each concrete report model
  reportModel: Model<any>,
  reportType: ReportModelName,
  requestedReports: IdDocument<string>[],
  request: AuthenticatedExpressRequest
) {
  const context = await loadExportContext(reportModel, reportType, requestedReports, request)
  const paymentTotals = new Map<string, number>()
  for (const payment of context.payments) {
    const organisationId = payment.organisation._id.toString()
    paymentTotals.set(organisationId, roundAmount((paymentTotals.get(organisationId) ?? 0) + payment.amount))
  }
  const organisations = context.organisations.flatMap((organisation) => {
    const amount = paymentTotals.get(organisation._id.toString())
    if (!amount) return []
    return [
      {
        _id: organisation._id,
        name: organisation.name,
        amount,
        accounts: organisation.accountingSettings.payoutAccounts.map((account) => ({
          _id: account._id,
          name: account.name,
          maskedIban: maskIban(account.iban)
        }))
      }
    ]
  })
  return { organisations, errors: context.errors } satisfies BookingExportPreview<Types.ObjectId>
}

export async function createBookingExportPackage(
  // biome-ignore lint/suspicious/noExplicitAny: shared helper accepts each concrete report model
  reportModel: Model<any>,
  reportType: ReportModelName,
  body: BookingExportPackageRequest<string>,
  request: AuthenticatedExpressRequest
) {
  if (!isValidExecutionDate(body.executionDate)) throw new ValidationClientError('Invalid execution date')
  const context = await loadExportContext(reportModel, reportType, body.reports, request)
  if (context.errors.length > 0)
    throw new ValidationClientError(
      'The payment export configuration is incomplete',
      context.errors.map((message) => ({ message }))
    )

  const affectedOrganisationIds = new Set(context.payments.map(({ organisation }) => organisation._id.toString()))
  const selections = new Map<string, string>()
  for (const selection of body.bankAccounts) {
    const organisationId = objectId(selection.organisation)
    const accountId = objectId(selection.account)
    if (!organisationId || !accountId || selections.has(organisationId)) throw new ValidationClientError('Invalid bank account selection')
    selections.set(organisationId, accountId)
  }
  if (
    selections.size !== affectedOrganisationIds.size ||
    Array.from(selections.keys()).some((organisationId) => !affectedOrganisationIds.has(organisationId))
  ) {
    throw new ValidationClientError('Exactly one bank account must be selected for every affected organisation')
  }

  const bookings = [...context.bookings]
  const sepaFiles: BookingExportPackage<Types.ObjectId>['sepaFiles'] = []
  for (const organisationId of affectedOrganisationIds) {
    const organisation = context.organisations.find(({ _id }) => _id.toString() === organisationId)
    const account = organisation?.accountingSettings.payoutAccounts.find(({ _id }) => _id.toString() === selections.get(organisationId))
    if (!organisation || !account) throw new ValidationClientError('A selected bank account does not belong to its organisation')
    if (!isValidIban(account.iban) || (account.bic && !isValidBic(account.bic))) throw new ValidationClientError('Invalid payout account')
    if (organisation.accountingSettings.includeBankBookings && !account.ledgerAccount) {
      throw new ValidationClientError('The selected payout account has no ledger account')
    }

    const organisationPayments = context.payments.filter((payment) => payment.organisation._id.toString() === organisationId)
    sepaFiles.push({
      organisation: { name: organisation.name },
      account: { lastFour: account.iban.slice(-4) },
      xml: createSepaDocument({ debtorAccount: account, executionDate: body.executionDate, payments: organisationPayments })
    })

    if (organisation.accountingSettings.includeBankBookings) {
      for (const payment of organisationPayments) {
        for (const [projectId, projectAmount] of payment.projectAmounts) {
          const originalLiabilityBooking = payment.report.bookings.find(
            (booking) =>
              booking.project._id.toString() === projectId &&
              objectId(booking.ledgerAccount) === objectId(organisation.accountingSettings.employeeLiabilitiesAccount)
          )
          if (!originalLiabilityBooking || !account.ledgerAccount)
            throw new ValidationClientError('Unable to create balanced bank bookings')
          const common = {
            date: body.executionDate,
            project: originalLiabilityBooking.project,
            report: { _id: payment.report._id, name: payment.report.name, reference: payment.report.reference },
            reportType,
            employee: { _id: payment.report.owner._id, name: payment.report.owner.name, employeeId: payment.report.owner.employeeId },
            amount: projectAmount,
            remark: `SEPA ${refNumberToString(payment.report.reference, reportType)}`
          }
          bookings.push(
            { ...common, _id: new Types.ObjectId(), side: 'debit', ledgerAccount: originalLiabilityBooking.ledgerAccount },
            { ...common, _id: new Types.ObjectId(), side: 'credit', ledgerAccount: account.ledgerAccount }
          )
        }
      }
    }
  }

  if (context.storedBookingsByReport.size > 0) {
    const result = await reportModel.bulkWrite(
      Array.from(context.storedBookingsByReport, ([reportId, reportBookings]) => ({
        updateOne: { filter: { _id: reportId, historic: false, state: State.BOOKABLE }, update: { $set: { bookings: reportBookings } } }
      }))
    )
    if (result.matchedCount !== context.storedBookingsByReport.size) {
      throw new ValidationClientError('At least one selected report is no longer bookable')
    }
  }

  return { bookings, sepaFiles } satisfies BookingExportPackage<Types.ObjectId>
}
