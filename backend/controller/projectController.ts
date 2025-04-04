import { Request as ExRequest } from 'express'
import { Body, Delete, Get, Post, Queries, Query, Request, Route, Security, Tags } from 'tsoa'
import { Project as IProject, ProjectSimple, ProjectWithUsers, _id, locales } from '../../common/types.js'
import { getSettings } from '../db.js'
import ExpenseReport from '../models/expenseReport.js'
import HealthCareCost from '../models/healthCareCost.js'
import Project, { projectSchema, projectUsersSchema } from '../models/project.js'
import Travel from '../models/travel.js'
import User from '../models/user.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { isUserAllowedToAccess } from './authentication.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'
import { AuthorizationError } from './error.js'

@Tags('Project')
@Route('project')
@Security('cookieAuth', ['user'])
@Security('httpBearer', ['user'])
export class ProjectController extends Controller {
  @Get()
  public async get(@Queries() query: GetterQuery<ProjectSimple>, @Request() request: ExRequest) {
    const settings = await getSettings()
    if (
      settings.userCanSeeAllProjects ||
      (await isUserAllowedToAccess(request.user!, [
        'admin',
        'approve/travel',
        'examine/travel',
        'examine/expenseReport',
        'examine/healthCareCost',
        'confirm/healthCareCost',
        'refunded/expenseReport',
        'refunded/travel',
        'refunded/healthCareCost'
      ]))
    ) {
      return await this.getter(Project, { query, projection: { identifier: 1, organisation: 1 } })
    } else {
      throw new AuthorizationError()
    }
  }
}

@Tags('Project')
@Route('admin/project')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class ProjectAdminController extends Controller {
  @Get()
  public async getComplete(@Queries() query: GetterQuery<IProject>) {
    return await this.getter(Project, { query })
  }
  @Post()
  public async post(@Body() requestBody: SetterBody<ProjectWithUsers>) {
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
  public async postMany(@Body() requestBody: SetterBody<IProject>[]) {
    return await this.insertMany(Project, { requestBody })
  }
  @Delete()
  public async delete(@Query() _id: _id) {
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
  public async getForm() {
    return { data: mongooseSchemaToVueformSchema(Object.assign(projectSchema.obj, projectUsersSchema.obj), locales) }
  }
}
