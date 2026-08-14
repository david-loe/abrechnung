import { Body, Post, Request, Route, Security, SuccessResponse, Tags } from '@tsoa/runtime'
import { SuggestionReportType, SuggestionSourceReportType } from 'abrechnung-common/types.js'
import { authorizeExaminedReport } from '../examinedReports.js'
import { createSuggestion } from '../suggestions.js'
import { Controller } from './controller.js'
import { NotAllowedError } from './error.js'
import { AuthenticatedExpressRequest } from './types.js'

interface SuggestionBody {
  type: 'expense' | 'stage'
  reportType: SuggestionReportType
  projectId: string
  documentFileIds: string[]
}

interface ExaminedSuggestionBody extends SuggestionBody {
  reportId: string
  sourceReportType: SuggestionSourceReportType
}

@Tags('Suggestions')
@Route('suggestions')
@Security('cookieAuth', ['user'])
@Security('httpBearer', ['user'])
export class SuggestionController extends Controller {
  @Post()
  @SuccessResponse(200)
  public async postOwn(@Body() body: SuggestionBody, @Request() request: AuthenticatedExpressRequest) {
    this.setHeader('Cache-Control', 'no-store')
    const suggestion = await createSuggestion({ ...body, owner: request.user._id })
    if (!suggestion) {
      this.setStatus(204)
      return
    }
    return { result: suggestion }
  }
}

@Tags('Suggestions')
@Route('examine/suggestions')
@Security('cookieAuth', ['user', 'examine/travel'])
@Security('httpBearer', ['user', 'examine/travel'])
@Security('cookieAuth', ['user', 'examine/expenseReport'])
@Security('httpBearer', ['user', 'examine/expenseReport'])
@Security('cookieAuth', ['user', 'examine/healthCareCost'])
@Security('httpBearer', ['user', 'examine/healthCareCost'])
export class SuggestionAdminController extends Controller {
  @Post()
  @SuccessResponse(200)
  public async postAny(@Body() body: ExaminedSuggestionBody, @Request() request: AuthenticatedExpressRequest) {
    this.setHeader('Cache-Control', 'no-store')
    const { reportId, sourceReportType, ...suggestionRequest } = body
    const report = await authorizeExaminedReport({ reportId, sourceReportType }, request.user)
    if (!report.project.equals(suggestionRequest.projectId)) throw new NotAllowedError()
    const suggestion = await createSuggestion({ ...suggestionRequest, owner: report.owner })
    if (!suggestion) {
      this.setStatus(204)
      return
    }
    return { result: suggestion }
  }
}
