import { Body, Delete, Get, Post, Queries, Query, Route, Security, Tags } from '@tsoa/runtime'
import { LedgerAccount as ILedgerAccount, locales, travelExpenseItems } from 'abrechnung-common/types.js'
import { Types } from 'mongoose'
import Booking from '../models/booking.js'
import Category from '../models/category.js'
import LedgerAccount, { ledgerAccountSchema } from '../models/ledgerAccount.js'
import Organisation from '../models/organisation.js'
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
            ...travelExpenseItems.map((item) => `accountingSettings.accountMapping.${item}`)
          ]
        },
        { model: Booking, paths: ['ledgerAccount'] }
      ],
      minDocumentCount: 1
    })
  }

  @Get('form')
  public async getForm() {
    return { data: mongooseSchemaToVueformSchema(ledgerAccountSchema().obj, locales) }
  }
}
