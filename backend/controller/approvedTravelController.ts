import { Readable } from 'node:stream'
import { Get, Produces, Queries, Query, Request, Route, Security, Tags } from 'tsoa'
import { _id, ApprovedTravel as IApprovedTravel } from '../../common/types.js'
import { approvedTravelsPrinter } from '../factory.js'
import i18n from '../i18n.js'
import ApprovedTravel from '../models/approvedTravel.js'
import { Controller, GetterQuery } from './controller.js'
import { NotFoundError } from './error.js'
import { AuthenticatedExpressRequest } from './types.js'

@Tags('Travel', 'Approved Travel')
@Route('approvedTravel')
@Security('cookieAuth', ['approve/travel'])
@Security('httpBearer', ['approve/travel'])
export class ApprovedTravelController extends Controller {
  @Get()
  public async get(@Queries() query: GetterQuery<IApprovedTravel>) {
    return await this.getter(ApprovedTravel, { query })
  }

  @Get('report')
  @Produces('application/pdf')
  public async getReport(
    @Query() from: Date,
    @Query() to: Date,
    @Query() organisationId: _id | undefined | null,
    @Request() request: AuthenticatedExpressRequest
  ) {
    const travels = await ApprovedTravel.find({
      startDate: { $lte: to },
      endDate: { $gte: from },
      ...(organisationId ? { organisationId } : {})
    }).lean()
    if (travels.length === 0) {
      throw new NotFoundError(`No travels found`)
    }
    const report = await approvedTravelsPrinter.print(travels, request.user.settings.language, from, to)
    this.setHeader(
      'Content-disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(`${i18n.t('labels.travels')} ${from.toISOString().split('T')[0]} - ${to.toISOString().split('T')[0]}`)}.pdf`
    )
    this.setHeader('Content-Type', 'application/pdf')
    this.setHeader('Content-Length', report.length)
    return Readable.from([report])
  }
}
