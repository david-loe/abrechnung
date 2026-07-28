import {
  type Advance,
  type Booking,
  type Cost,
  type CostPosition,
  type ExpenseReport,
  type HealthCareCost,
  idDocumentToId,
  type NameDisplayFormat,
  type ReportModelName,
  State,
  type Travel
} from 'abrechnung-common/types.js'
import Formatter from 'abrechnung-common/utils/formatter.js'
import {
  getBaseCurrencyAmount,
  getCostPositionBaseCurrencyAmount,
  getCostPositionVatAmount,
  multiplyAmountAndRound,
  refNumberToString,
  roundAmount,
  subtractAmounts,
  sumAmounts
} from 'abrechnung-common/utils/scripts.js'
import mongoose, { mongo, Types } from 'mongoose'
import { BACKEND_CACHE } from '../db.js'

type BookableReport =
  | Travel<Types.ObjectId, mongo.Binary>
  | ExpenseReport<Types.ObjectId, mongo.Binary>
  | HealthCareCost<Types.ObjectId, mongo.Binary>
  | Advance<Types.ObjectId>

type GeneratedBooking = Omit<Booking<Types.ObjectId>, 'ledgerAccount' | 'project'> & {
  ledgerAccount: Types.ObjectId
  project: Types.ObjectId
}

interface ProjectAccountingContext {
  projectId: Types.ObjectId
  employeeLiabilitiesAccount: Types.ObjectId
  employeeClaimsAccount: Types.ObjectId
  accountMapping: Record<string, Types.ObjectId>
  vatAccountingEnabled: boolean
  vatRates: { rate: number; inputTaxAccount?: Types.ObjectId }[]
}

function toObjectId(value: unknown, field: string) {
  const id = idDocumentToId(value)
  if (!id || !Types.ObjectId.isValid(id.toString())) {
    throw new Error(`Cannot create bookings without a valid ${field}`)
  }
  return new Types.ObjectId(id.toString())
}

function idKey(value: unknown, field: string) {
  return toObjectId(value, field).toString()
}

function collectPositionIds(report: Exclude<BookableReport, Advance<Types.ObjectId>>) {
  const costs = report.expenses.map(({ cost }) => cost)
  if ('stages' in report) costs.push(...report.stages.map(({ cost }) => cost))
  return {
    projectIds: costs.flatMap(({ positions }) => positions.map(({ project }) => toObjectId(project, 'position project'))),
    categoryIds: costs.flatMap(({ positions }) => positions.map(({ category }) => toObjectId(category, 'position category')))
  }
}

async function loadAccountingContext(report: BookableReport) {
  const reportProjectId = toObjectId(report.project, 'report project')
  const { projectIds, categoryIds } =
    'expenses' in report
      ? collectPositionIds(report as Exclude<BookableReport, Advance<Types.ObjectId>>)
      : { projectIds: [], categoryIds: [] }
  projectIds.push(reportProjectId)
  if ('addUp' in report) {
    projectIds.push(...report.addUp.map(({ project }) => toObjectId(project, 'summary project')))
  }

  const uniqueProjectIds = Array.from(new Map(projectIds.map((id) => [id.toString(), id])).values())
  const uniqueCategoryIds = Array.from(new Map(categoryIds.map((id) => [id.toString(), id])).values())
  const [projects, categories, owner] = await Promise.all([
    mongoose.connection
      .collection<{ _id: Types.ObjectId; organisation: Types.ObjectId }>('projects')
      .find({ _id: { $in: uniqueProjectIds } }, { projection: { organisation: 1 } })
      .toArray(),
    mongoose.connection
      .collection<{ _id: Types.ObjectId; ledgerAccount: Types.ObjectId }>('categories')
      .find({ _id: { $in: uniqueCategoryIds } }, { projection: { ledgerAccount: 1 } })
      .toArray(),
    mongoose.connection
      .collection<{ _id: Types.ObjectId; name: { givenName: string; familyName: string } }>('users')
      .findOne({ _id: toObjectId(report.owner, 'report owner') }, { projection: { name: 1 } })
  ])
  if (!owner) throw new Error('Cannot create bookings without a report owner')
  if (projects.length !== uniqueProjectIds.length) throw new Error('Cannot create bookings because a referenced project is missing')
  if (categories.length !== uniqueCategoryIds.length) throw new Error('Cannot create bookings because a referenced category is missing')

  const organisationIds = Array.from(new Map(projects.map(({ organisation }) => [organisation.toString(), organisation])).values())
  const organisations = await mongoose.connection
    .collection<{
      _id: Types.ObjectId
      accountingSettings: {
        employeeLiabilitiesAccount: Types.ObjectId
        employeeClaimsAccount: Types.ObjectId
        accountMapping: Record<string, Types.ObjectId>
        vatAccountingEnabled: boolean
        vatRates: { rate: number; inputTaxAccount?: Types.ObjectId }[]
      }
    }>('organisations')
    .find({ _id: { $in: organisationIds } }, { projection: { accountingSettings: 1 } })
    .toArray()
  if (organisations.length !== organisationIds.length) {
    throw new Error('Cannot create bookings because a project organisation is missing')
  }

  const organisationsById = new Map(organisations.map((organisation) => [organisation._id.toString(), organisation]))
  const projectsById = new Map<string, ProjectAccountingContext>()
  for (const project of projects) {
    const organisation = organisationsById.get(project.organisation.toString())
    if (!organisation?.accountingSettings) throw new Error('Cannot create bookings without organisation accounting settings')
    projectsById.set(project._id.toString(), { projectId: project._id, ...organisation.accountingSettings })
  }

  return {
    reportProjectId,
    owner,
    projectsById,
    categoryAccounts: new Map(categories.map((category) => [category._id.toString(), category.ledgerAccount]))
  }
}

function oppositeSideAmount(amount: number) {
  return roundAmount(subtractAmounts(0, amount))
}

export async function calculateBookings(
  report: BookableReport,
  reportModelName: ReportModelName,
  nameDisplayFormat: NameDisplayFormat = BACKEND_CACHE.getSnapshot().displaySettings.nameDisplayFormat
) {
  const context = await loadAccountingContext(report)
  const bookingDate = report.log[State.BOOKABLE]?.on
  if (!bookingDate) throw new Error('Cannot create bookings without a bookable date')
  if (typeof report.reference !== 'number') throw new Error('Cannot create bookings without a report reference')

  const formatter = new Formatter('en', nameDisplayFormat)
  const remark = `${reportModelName} ${formatter.name(context.owner.name)} ${refNumberToString(report.reference, reportModelName)}`
  const accountAmounts = new Map<string, { project: Types.ObjectId; ledgerAccount: Types.ObjectId; amount: number }>()
  const projectTotals = new Map<string, number>()

  function projectContext(projectValue: unknown) {
    const key = idKey(projectValue, 'booking project')
    const project = context.projectsById.get(key)
    if (!project) throw new Error(`Cannot create bookings without accounting settings for project ${key}`)
    return project
  }

  function addAccountAmount(project: ProjectAccountingContext, ledgerAccount: Types.ObjectId, amount: number) {
    const roundedAmount = roundAmount(amount)
    if (roundedAmount === 0) return
    const key = `${project.projectId}:${ledgerAccount}`
    const current = accountAmounts.get(key)
    if (current) {
      current.amount = roundAmount(sumAmounts(current.amount, roundedAmount))
    } else {
      accountAmounts.set(key, { project: project.projectId, ledgerAccount, amount: roundedAmount })
    }
  }

  function addProjectTotal(project: ProjectAccountingContext, amount: number) {
    const key = project.projectId.toString()
    projectTotals.set(key, roundAmount(sumAmounts(projectTotals.get(key) ?? 0, amount)))
  }

  function categoryAccount(position: CostPosition<Types.ObjectId>) {
    const categoryId = idKey(position.category, 'position category')
    const account = context.categoryAccounts.get(categoryId)
    if (!account) throw new Error(`Cannot create bookings without a ledger account for category ${categoryId}`)
    return account
  }

  function addPosition(
    cost: Cost<Types.ObjectId, mongo.Binary>,
    position: CostPosition<Types.ObjectId>,
    ledgerAccount: Types.ObjectId,
    factor = 1
  ) {
    const project = projectContext(position.project)
    const grossAmount = multiplyAmountAndRound(getCostPositionBaseCurrencyAmount(cost, position), factor)
    const vatAmount = getCostPositionVatAmount(
      { grossAmount, vatRate: position.vatRate },
      project.vatAccountingEnabled && position.kind !== 'ownCar'
    )
    const netAmount = roundAmount(subtractAmounts(grossAmount, vatAmount))
    addAccountAmount(project, ledgerAccount, netAmount)
    if (vatAmount !== 0) {
      const vatRate = project.vatRates.find(({ rate }) => rate === position.vatRate)
      if (!vatRate?.inputTaxAccount) {
        throw new Error(`Cannot create bookings without an input tax account for VAT rate ${position.vatRate}`)
      }
      addAccountAmount(project, vatRate.inputTaxAccount, vatAmount)
    }
    addProjectTotal(project, grossAmount)
  }

  if (reportModelName === 'Advance') {
    const project = projectContext(report.project)
    const amount = getBaseCurrencyAmount((report as Advance<Types.ObjectId>).budget)
    addAccountAmount(project, project.employeeClaimsAccount, amount)
    addAccountAmount(project, project.employeeLiabilitiesAccount, oppositeSideAmount(amount))
  } else {
    const costReport = report as
      | Travel<Types.ObjectId, mongo.Binary>
      | ExpenseReport<Types.ObjectId, mongo.Binary>
      | HealthCareCost<Types.ObjectId, mongo.Binary>
    if (reportModelName === 'Travel') {
      const travel = costReport as Travel<Types.ObjectId, mongo.Binary>
      for (const expense of travel.expenses) {
        const factor = expense.purpose === 'mixed' && travel.professionalShare ? travel.professionalShare : 1
        for (const position of expense.cost.positions) {
          addPosition(expense.cost, position, categoryAccount(position), factor)
        }
      }
      for (const stage of travel.stages) {
        const factor = stage.purpose === 'mixed' && travel.professionalShare ? travel.professionalShare : 1
        for (const position of stage.cost.positions) {
          const project = projectContext(position.project)
          const ledgerAccount = project.accountMapping[stage.transport.type]
          if (!ledgerAccount) throw new Error(`Cannot create bookings without an account mapping for ${stage.transport.type}`)
          addPosition(stage.cost, position, ledgerAccount, factor)
        }
      }
      const project = projectContext(context.reportProjectId)
      for (const day of travel.days) {
        const lumpSums = [
          { type: 'cateringLumpSum', amount: day.lumpSums.catering.refund.amount },
          { type: 'overnightLumpSum', amount: day.lumpSums.overnight.refund.amount }
        ]
        for (const lumpSum of lumpSums) {
          const ledgerAccount = project.accountMapping[lumpSum.type]
          if (!ledgerAccount) throw new Error(`Cannot create bookings without an account mapping for ${lumpSum.type}`)
          addAccountAmount(project, ledgerAccount, lumpSum.amount)
          addProjectTotal(project, lumpSum.amount)
        }
      }
    } else {
      for (const expense of costReport.expenses) {
        for (const position of expense.cost.positions) {
          addPosition(expense.cost, position, categoryAccount(position))
        }
      }
    }

    const advanceAmounts = new Map(
      costReport.addUp.map(({ project, advance }) => [idKey(project, 'summary project'), roundAmount(advance.amount)])
    )
    for (const [projectId, total] of projectTotals) {
      const project = projectContext(projectId)
      if (total > 0) {
        const advanceAmount = Math.min(total, Math.max(advanceAmounts.get(projectId) ?? 0, 0))
        addAccountAmount(project, project.employeeClaimsAccount, oppositeSideAmount(advanceAmount))
        addAccountAmount(project, project.employeeLiabilitiesAccount, oppositeSideAmount(subtractAmounts(total, advanceAmount)))
      } else if (total < 0) {
        addAccountAmount(project, project.employeeClaimsAccount, oppositeSideAmount(total))
      }
    }
  }

  const projectBalances = new Map<string, number>()
  for (const { project, amount } of accountAmounts.values()) {
    const projectId = project.toString()
    projectBalances.set(projectId, roundAmount(sumAmounts(projectBalances.get(projectId) ?? 0, amount)))
  }
  const unbalancedProject = Array.from(projectBalances.entries()).find(([, balance]) => balance !== 0)
  if (unbalancedProject) throw new Error(`Generated bookings for project ${unbalancedProject[0]} are not balanced`)

  return Array.from(accountAmounts.values()).flatMap(({ project, ledgerAccount, amount }): GeneratedBooking[] => {
    const roundedAmount = roundAmount(amount)
    if (roundedAmount === 0) return []
    return [
      {
        _id: new Types.ObjectId(),
        side: roundedAmount > 0 ? 'debit' : 'credit',
        ledgerAccount,
        amount: Math.abs(roundedAmount),
        date: bookingDate,
        project,
        remark
      }
    ]
  })
}
