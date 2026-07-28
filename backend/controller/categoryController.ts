import { Body, Delete, Get, Post, Queries, Query, Route, Security, Tags } from '@tsoa/runtime'
import { Category as ICategory, locales } from 'abrechnung-common/types.js'
import { Types } from 'mongoose'
import Category, { categorySchema } from '../models/category.js'
import ExpenseReport from '../models/expenseReport.js'
import HealthCareCost from '../models/healthCareCost.js'
import Travel from '../models/travel.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'
import { ValidationClientError } from './error.js'

async function validateCategoryScopeChange(requestBody: SetterBody<ICategory<Types.ObjectId>>) {
  if (!requestBody._id || (requestBody.for !== 'ExpenseReport' && requestBody.for !== 'Travel')) return

  const category = await Category.findById(requestBody._id, { for: 1 }).lean()
  if (!category || category.for === requestBody.for) return

  const categoryId = requestBody._id
  let isReferenced = false
  if (requestBody.for === 'ExpenseReport') {
    isReferenced = Boolean(
      await Travel.exists({
        historic: false,
        $or: [{ 'expenses.cost.positions.category': categoryId }, { 'stages.cost.positions.category': categoryId }]
      })
    )
  } else {
    const references = await Promise.all([
      ExpenseReport.exists({ historic: false, 'expenses.cost.positions.category': categoryId }),
      HealthCareCost.exists({ historic: false, 'expenses.cost.positions.category': categoryId })
    ])
    isReferenced = references.some(Boolean)
  }

  if (isReferenced) {
    throw new ValidationClientError('Categories referenced by active reports cannot be restricted to an incompatible report type.', [
      { path: 'for', message: 'referenced' }
    ])
  }
}

@Tags('Category')
@Route('category')
@Security('cookieAuth', ['user'])
@Security('httpBearer', ['user'])
export class CategoryController extends Controller {
  @Get()
  public async get(@Queries() query: GetterQuery<ICategory>) {
    return await this.getter(Category, { query })
  }
}

@Tags('Category')
@Route('admin/category')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class CategoryAdminController extends Controller {
  @Post()
  public async post(@Body() requestBody: SetterBody<ICategory<Types.ObjectId>>) {
    await validateCategoryScopeChange(requestBody)
    return await this.setter(Category, { requestBody: requestBody, allowNew: true })
  }
  @Post('bulk')
  public async postMany(@Body() requestBody: SetterBody<ICategory<Types.ObjectId>>[]) {
    await Promise.all(requestBody.map(validateCategoryScopeChange))
    return await this.insertMany(Category, { requestBody })
  }
  @Delete()
  public async delete(@Query() _id: string) {
    return await this.deleter(Category, {
      _id: _id,
      referenceChecks: [
        { model: ExpenseReport, paths: ['expenses.cost.positions.category'], conditions: { historic: false } },
        { model: HealthCareCost, paths: ['expenses.cost.positions.category'], conditions: { historic: false } },
        { model: Travel, paths: ['expenses.cost.positions.category', 'stages.cost.positions.category'], conditions: { historic: false } }
      ],
      minDocumentCount: 1
    })
  }
  @Get('form')
  public async getForm() {
    return { data: mongooseSchemaToVueformSchema(categorySchema().obj, locales) }
  }
}
