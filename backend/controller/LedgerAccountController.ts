import { Body, Delete, Get, Post, Queries, Query, Route, Security, Tags } from '@tsoa/runtime'
import { LedgerAccount as ILedgerAccount, locales, travelExpenseItems } from 'abrechnung-common/types.js'
import { Types } from 'mongoose'
import Advance from '../models/advance.js'
import Category from '../models/category.js'
import ExpenseReport from '../models/expenseReport.js'
import HealthCareCost from '../models/healthCareCost.js'
import LedgerAccount, { ledgerAccountSchema } from '../models/ledgerAccount.js'
import Organisation from '../models/organisation.js'
import Travel from '../models/travel.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'

@Tags('LedgerAccount')
@Route('admin/ledgerAccount')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class LedgerAccountAdminController extends Controller {
  @Get()
  public async get(@Queries() query: GetterQuery<ILedgerAccount>) {
    return await this.getter(LedgerAccount, { query })
  }

  @Post()
  public async post(@Body() requestBody: SetterBody<ILedgerAccount<Types.ObjectId>>) {
    return await this.setter(LedgerAccount, { requestBody, allowNew: true })
  }

  @Post('bulk')
  public async postMany(@Body() requestBody: SetterBody<ILedgerAccount<Types.ObjectId>>[]) {
    return await this.insertMany(LedgerAccount, { requestBody })
  }

  @Delete()
  public async delete(@Query() _id: string) {
    return await this.deleter(LedgerAccount, {
      _id: _id,
      referenceChecks: [
        { model: Category, paths: ['ledgerAccount'] },
        {
          model: Organisation,
          paths: [
            'accountingSettings.employeeLiabilitiesAccount',
            'accountingSettings.employeeClaimsAccount',
            'accountingSettings.currencyExchangeDifferencesAccount',
            'accountingSettings.payoutAccounts.ledgerAccount',
            'accountingSettings.vatRates.inputTaxAccount',
            ...travelExpenseItems.map((item) => `accountingSettings.accountMapping.${item}`)
          ]
        },
        { model: Travel, paths: ['bookings.ledgerAccount'] },
        { model: ExpenseReport, paths: ['bookings.ledgerAccount'] },
        { model: HealthCareCost, paths: ['bookings.ledgerAccount'] },
        { model: Advance, paths: ['bookings.ledgerAccount'] }
      ],
      minDocumentCount: 1
    })
  }

  @Get('form')
  public async getForm() {
    return { data: mongooseSchemaToVueformSchema(ledgerAccountSchema().obj, locales) }
  }
}
