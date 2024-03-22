import { Body, Delete, Get, Post, Queries, Query, Route, Security, Tags } from 'tsoa'
import { Project as IProject, ProjectSimple, _id } from '../../common/types.js'
import Project from '../models/project.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'

@Tags('Project')
@Route('project')
@Security('cookieAuth', ['user'])
export class ProjectController extends Controller {
  @Get()
  public async getProject(@Queries() query: GetterQuery<ProjectSimple>) {
    return await this.getter(Project, { query, projection: { identifier: 1, organisation: 1 } })
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
  @Delete()
  public async deleteProject(@Query() _id: _id) {
    return await this.deleter(Project, { _id: _id })
  }
}
