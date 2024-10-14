import { Request as ExRequest } from 'express'
import { Body, Delete, Get, Post, Queries, Query, Request, Route, Security } from 'tsoa'
import { Project as IProject, ProjectSimple, ProjectWithUsers, _id, locales } from '../../common/types.js'
import { getSettings } from '../helper.js'
import ExpenseReport from '../models/expenseReport.js'
import HealthCareCost from '../models/healthCareCost.js'
import Project, { projectSchema } from '../models/project.js'
import Travel from '../models/travel.js'
import User from '../models/user.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'
import { AuthorizationError } from './error.js'

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
      request.user?.access['confirm/healthCareCost'] ||
      request.user?.access['admin']
    ) {
      return await this.getter(Project, { query, projection: { identifier: 1, organisation: 1 } })
    } else {
      throw new AuthorizationError()
    }
  }
}

@Route('admin/project')
@Security('cookieAuth', ['admin'])
export class ProjectAdminController extends Controller {
  @Get()
  public async getProject(@Queries() query: GetterQuery<IProject>) {
    return await this.getter(Project, { query })
  }
  @Post()
  public async postProject(@Body() requestBody: SetterBody<ProjectWithUsers>) {
    async function cb(project: IProject) {
      if (requestBody.assignees) {
        for (const userId of requestBody.assignees) {
          await (await User.findOne({ _id: userId }))?.addProjects({ assigned: [project._id] })
        }
      }
      if (requestBody.supervisors) {
        for (const userId of requestBody.supervisors) {
          await (await User.findOne({ _id: userId }))?.addProjects({ supervised: [project._id] })
        }
      }
    }
    return await this.setter(Project, { requestBody: requestBody, allowNew: true, cb })
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
  @Get('form')
  public async getProjectForm() {
    return { data: mongooseSchemaToVueformSchema(projectSchema.obj, locales) }
  }
}
