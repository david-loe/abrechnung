import { Request as ExRequest } from 'express'
import { Body, Delete, Get, Post, Queries, Query, Request, Route, Security, Tags } from 'tsoa'
import { Project as IProject, ProjectSimple, _id } from '../../common/types.js'
import { getSettings } from '../helper.js'
import ExpenseReport from '../models/expenseReport.js'
import HealthCareCost from '../models/healthCareCost.js'
import Project from '../models/project.js'
import Travel from '../models/travel.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'
import { AuthorizationError } from './error.js'

@Tags('Project')
@Route('project')
@Security('cookieAuth', ['user'])
export class ProjectController extends Controller {
  @Get()
  public async getProject(@Queries() query: GetterQuery<ProjectSimple>, @Request() request: ExRequest) {
    const settings = await getSettings()
    if (
      settings.userCanSeeAllProjects ||
      request.user?.access['approve/travel'] ||
      request.user?.access['examine/travel'] ||
      request.user?.access['examine/expenseReport'] ||
      request.user?.access['examine/healthCareCost'] ||
      request.user?.access['confirm/healthCareCost']
    ) {
      return await this.getter(Project, { query, projection: { identifier: 1, organisation: 1 } })
    } else {
      throw new AuthorizationError()
    }
  }
}

@Tags('Admin', 'Project')
@Route('admin/project')
@Security('cookieAuth', ['admin'])
export class ProjectAdminController extends Controller {
  @Get()
  public async getProject(@Queries() query: GetterQuery<IProject>) {
    return await this.getter(Project, { query })
  }
  @Post()
  public async postProject(@Body() requestBody: SetterBody<IProject>) {
    return await this.setter(Project, { requestBody: requestBody, allowNew: true })
  }
  @Post('bulk')
  public async postManyProjects(@Body() requestBody: SetterBody<IProject>[]) {
    return await this.insertMany(Project, { requestBody })
  }
  @Delete()
  public async deleteProject(@Query() _id: _id) {
    return await this.deleter(Project, {
      _id: _id,
      referenceChecks: [
        { model: ExpenseReport, paths: ['project'] },
        { model: Travel, paths: ['project'] },
        { model: HealthCareCost, paths: ['project'] }
      ]
    })
  }
}
