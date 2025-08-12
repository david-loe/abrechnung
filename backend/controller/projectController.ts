import { Types } from 'mongoose'
import { Body, Delete, Get, Post, Queries, Query, Request, Route, Security, Tags } from 'tsoa'
import { _id, Project as IProject, locales, ProjectSimple, ProjectWithUsers } from '../../common/types.js'
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
import { AuthenticatedExpressRequest } from './types.js'

@Tags('Project')
@Route('project')
@Security('cookieAuth', ['user'])
@Security('httpBearer', ['user'])
export class ProjectController extends Controller {
  @Get()
  public async get(@Queries() query: GetterQuery<ProjectSimple>, @Request() request: AuthenticatedExpressRequest) {
    const settings = await getSettings()
    if (
      !settings.userCanSeeAllProjects &&
      !(await isUserAllowedToAccess(request.user, [
        'admin',
        'approve/advance',
        'approve/travel',
        'examine/travel',
        'examine/expenseReport',
        'examine/healthCareCost',
        'book/advance',
        'book/expenseReport',
        'book/travel',
        'book/healthCareCost'
      ]))
    ) {
      throw new AuthorizationError()
    }
    return await this.getter(Project, { query, projection: { identifier: 1, organisation: 1, name: 1 }, sort: { identifier: 1 } })
  }
}

@Tags('Project')
@Route('admin/project')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class ProjectAdminController extends Controller {
  @Get()
  public async getComplete(@Queries() query: GetterQuery<IProject>) {
    return await this.getter(Project, { query, sort: { identifier: 1 } })
  }
  @Post()
  public async post(@Body() requestBody: SetterBody<ProjectWithUsers<Types.ObjectId>>) {
    async function cb(project: IProject<Types.ObjectId>) {
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
  public async postMany(@Body() requestBody: SetterBody<IProject<Types.ObjectId>>[]) {
    return await this.insertMany(Project, { requestBody })
  }
  @Delete()
  public async delete(@Query() _id: string) {
    return await this.deleter(Project, {
      _id: _id,
      referenceChecks: [
        { model: ExpenseReport, paths: ['project', 'addUp.$elemMatch.project'], conditions: { historic: false } },
        { model: Travel, paths: ['project', 'addUp.$elemMatch.project'], conditions: { historic: false } },
        { model: HealthCareCost, paths: ['project', 'addUp.$elemMatch.project'], conditions: { historic: false } }
      ],
      minDocumentCount: 1
    })
  }
  @Get('form')
  public async getForm() {
    return { data: mongooseSchemaToVueformSchema(Object.assign(projectSchema().obj, projectUsersSchema.obj), locales) }
  }
}
