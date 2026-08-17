import { Body, Consumes, Delete, Get, Middlewares, Post, Queries, Query, Request, Route, Security, Tags } from '@tsoa/runtime'
import { Organisation as IOrganisation, locales, OrganisationBankAccount } from 'abrechnung-common/types.js'
import { mongo, Types } from 'mongoose'
import { claimDocumentFiles } from '../documentFiles.js'
import { documentFileHandler, fileHandler } from '../helper.js'
import ExpenseReport from '../models/expenseReport.js'
import HealthCareCost from '../models/healthCareCost.js'
import LedgerAccount from '../models/ledgerAccount.js'
import Organisation, { organisationSchema } from '../models/organisation.js'
import Project from '../models/project.js'
import Travel from '../models/travel.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'
import { ValidationClientError } from './error.js'
import { AuthenticatedExpressRequest, File } from './types.js'

@Tags('Organisation')
@Route('organisation')
@Security('cookieAuth', ['user'])
@Security('httpBearer', ['user'])
export class OrganisationController extends Controller {
  @Get()
  public async get(@Queries() query: GetterQuery<IOrganisation>) {
    return await this.getter(Organisation, {
      query,
      projection: { name: 1, 'accountingSettings.vatAccountingEnabled': 1, 'accountingSettings.vatRates.rate': 1 }
    })
  }
}

interface PostOrganisation extends Omit<IOrganisation<Types.ObjectId>, 'logo'> {
  logo: File
}

@Tags('Organisation')
@Route('admin/organisation')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class OrganisationAdminController extends Controller {
  @Get()
  public async getComplete(@Queries() query: GetterQuery<IOrganisation>) {
    return await this.getter(Organisation, { query })
  }

  @Post()
  @Middlewares(fileHandler.single('logo[data]'))
  @Consumes('multipart/form-data')
  public async post(@Body() requestBody: SetterBody<PostOrganisation>, @Request() request: AuthenticatedExpressRequest) {
    await documentFileHandler(['logo'], { multiple: false, checkOwner: false })(request)
    if (requestBody._id && requestBody.accountingSettings?.vatRates) {
      const organisation = await Organisation.findById(requestBody._id, { 'accountingSettings.vatRates.rate': 1 }).lean()
      const newRates = new Set(requestBody.accountingSettings.vatRates.map(({ rate }) => rate))
      const removedRates = organisation?.accountingSettings.vatRates.map(({ rate }) => rate).filter((rate) => !newRates.has(rate)) ?? []
      if (removedRates.length > 0) {
        const projectIds = await Project.find({ organisation: requestBody._id }).distinct('_id')
        const expensePositionFilter = { $elemMatch: { project: { $in: projectIds }, vatRate: { $in: removedRates } } }
        const [expenseReportUsage, healthCareCostUsage, travelUsage] = await Promise.all([
          ExpenseReport.exists({ 'expenses.cost.positions': expensePositionFilter }),
          HealthCareCost.exists({ 'expenses.cost.positions': expensePositionFilter }),
          Travel.exists({ $or: [{ 'expenses.cost.positions': expensePositionFilter }, { 'stages.cost.positions': expensePositionFilter }] })
        ])
        if (expenseReportUsage || healthCareCostUsage || travelUsage) {
          throw new ValidationClientError('VAT rates referenced by cost positions cannot be removed.', [
            { path: 'accountingSettings.vatRates', message: 'referenced' }
          ])
        }
      }
    }
    if (!requestBody._id && (!requestBody.accountingSettings?.vatRates || requestBody.accountingSettings.vatRates.length === 0)) {
      const [account7, account19] = await Promise.all([
        LedgerAccount.findOne({ identifier: '1571' }),
        LedgerAccount.findOne({ identifier: '1576' })
      ])
      requestBody.accountingSettings = {
        ...requestBody.accountingSettings,
        vatAccountingEnabled: true,
        includeBankBookings: false,
        payoutAccounts: [],
        vatRates: [{ rate: 0 }, { rate: 7, inputTaxAccount: account7?._id }, { rate: 19, inputTaxAccount: account19?._id }]
      } as IOrganisation<Types.ObjectId>['accountingSettings']
    }
    const payoutAccounts = requestBody.accountingSettings?.payoutAccounts as OrganisationBankAccount<Types.ObjectId>[] | undefined | null
    if (requestBody.accountingSettings?.includeBankBookings && payoutAccounts?.some(({ ledgerAccount }) => !ledgerAccount)) {
      throw new ValidationClientError('Every payout account needs a ledger account when bank bookings are enabled.', [
        { path: 'accountingSettings.payoutAccounts', message: 'missingBankLedgerAccount' }
      ])
    }
    const result = await this.setter(Organisation, {
      requestBody: requestBody as IOrganisation<Types.ObjectId, mongo.Binary>,
      allowNew: true
    })
    if (requestBody.logo?._id) await claimDocumentFiles([requestBody.logo._id])
    return result
  }

  @Post('bulk')
  public async postMany(@Body() requestBody: SetterBody<Omit<IOrganisation<Types.ObjectId>, 'logo'>>[]) {
    return await this.insertMany(Organisation, { requestBody })
  }

  @Delete()
  public async delete(@Query() _id: string) {
    return await this.deleter(Organisation, {
      _id: _id,
      referenceChecks: [{ model: Project, paths: ['organisation'] }],
      minDocumentCount: 1
    })
  }

  @Get('form')
  public async getForm() {
    return { data: mongooseSchemaToVueformSchema(organisationSchema().obj, locales) }
  }
}
