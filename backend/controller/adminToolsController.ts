import { ProjectSimple, ReportModelName, UserSimple } from 'abrechnung-common/types.js'
import mongoose from 'mongoose'
import { Body, Get, Post, Query, Route, Security, Tags } from 'tsoa'
import { Controller } from './controller.js'
import { NotFoundError } from './error.js'

@Tags('Admin')
@Route('admin/tools')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class AdminToolController extends Controller {
  @Get('report/ref')
  public async getByRef(@Query() ref: number, @Query() type: ReportModelName) {
    const report = await mongoose
      .model<{ name: string; owner: UserSimple; project: ProjectSimple; reference: number }>(type)
      .findOne({ reference: ref })
      .select({ _id: 1, project: 1, name: 1, owner: 1 })
      .lean()
    if (!report) {
      throw new NotFoundError(`No ${type} with ref: '${ref}' found`)
    }
    return { data: report }
  }

  @Post('report')
  public async updateReport(
    @Body() requestBody: { ref: number; type: ReportModelName; data: Partial<{ owner: string; project: string; name: string }> }
  ) {
    const model = mongoose.model<{ name: string; owner: UserSimple; project: ProjectSimple; reference: number }>(requestBody.type)
    const report = await model.findOneAndUpdate({ reference: requestBody.ref }, requestBody.data).lean()
    if (!report) {
      throw new NotFoundError(`No ${requestBody.type} with ref: '${requestBody.ref}' found`)
    }
    return { message: 'alerts.successSaving', result: report }
  }
}
