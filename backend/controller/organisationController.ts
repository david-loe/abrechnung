import { Body, Delete, Get, Post, Queries, Query, Route, Security, Tags } from 'tsoa'
import { Organisation as IOrganisation, _id } from '../../common/types.js'
import Organisation from '../models/organisation.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'

@Tags('Organisation')
@Route('organisation')
@Security('cookieAuth', ['user'])
export class OrganisationController extends Controller {
  @Get()
  public async getOrganisation(@Queries() query: GetterQuery<IOrganisation>) {
    return await this.getter(Organisation, { query, projection: { name: 1 } })
  }
}

@Tags('Admin', 'Organisation')
@Route('admin/organisation')
@Security('cookieAuth', ['admin'])
export class OrganisationAdminController extends Controller {
  @Get()
  public async getOrganisation(@Queries() query: GetterQuery<IOrganisation>) {
    return await this.getter(Organisation, { query })
  }

  @Post()
  public async postOrganisation(@Body() requestBody: SetterBody<IOrganisation>) {
    return await this.setter(Organisation, { requestBody: requestBody, allowNew: true })
  }

  @Delete()
  public async deleteOrganisation(@Query() _id: _id) {
    return await this.deleter(Organisation, { _id: _id })
  }
}
