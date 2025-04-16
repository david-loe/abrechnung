import { Request as ExRequest } from 'express'
import { Body, Consumes, Delete, Get, Middlewares, Post, Queries, Query, Request, Route, Security, Tags } from 'tsoa'
import { Organisation as IOrganisation, _id, locales } from '../../common/types.js'
import { documentFileHandler, fileHandler } from '../helper.js'
import Organisation, { organisationSchema } from '../models/organisation.js'
import Project from '../models/project.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'

@Tags('Organisation')
@Route('organisation')
@Security('cookieAuth', ['user'])
@Security('httpBearer', ['user'])
export class OrganisationController extends Controller {
  @Get()
  public async get(@Queries() query: GetterQuery<IOrganisation>) {
    return await this.getter(Organisation, { query, projection: { name: 1 } })
  }
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
  public async post(@Body() requestBody: SetterBody<IOrganisation>, @Request() request: ExRequest) {
    await documentFileHandler(['logo'], { multiple: false, checkOwner: false })(request)
    return await this.setter(Organisation, { requestBody: requestBody, allowNew: true })
  }

  @Post('bulk')
  public async postMany(@Body() requestBody: SetterBody<Omit<IOrganisation, 'logo'>>[]) {
    return await this.insertMany(Organisation, { requestBody })
  }

  @Delete()
  public async delete(@Query() _id: _id) {
    return await this.deleter(Organisation, { _id: _id, referenceChecks: [{ model: Project, paths: ['organisation'] }] })
  }

  @Get('form')
  public async getForm() {
    return { data: mongooseSchemaToVueformSchema(organisationSchema().obj, locales) }
  }
}
