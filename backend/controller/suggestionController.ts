import { Get, Query, Request, Route, Security, SuccessResponse, Tags } from '@tsoa/runtime'
import { SuggestionReportType } from 'abrechnung-common/types.js'
import { createSuggestion } from '../suggestions.js'
import { Controller } from './controller.js'
import { AuthenticatedExpressRequest } from './types.js'

@Tags('Suggestions')
@Route('suggestions')
@Security('cookieAuth', ['user'])
@Security('httpBearer', ['user'])
export class SuggestionController extends Controller {
  @Get()
  @SuccessResponse(200)
  public async getOwn(
    @Query() type: 'expense' | 'stage',
    @Query() reportType: SuggestionReportType,
    @Query() projectId: string,
    @Query() documentFileIds: string[],
    @Request() request: AuthenticatedExpressRequest
  ) {
    this.setHeader('Cache-Control', 'no-store')
    const suggestion = await createSuggestion({ type, reportType, projectId, documentFileIds, owner: request.user._id })
    if (!suggestion) {
      this.setStatus(204)
      return
    }
    return { data: suggestion }
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
  @Get()
  @SuccessResponse(200)
  public async getAny(
    @Query() type: 'expense' | 'stage',
    @Query() reportType: SuggestionReportType,
    @Query() projectId: string,
    @Query() documentFileIds: string[]
  ) {
    this.setHeader('Cache-Control', 'no-store')
    const suggestion = await createSuggestion({ type, reportType, projectId, documentFileIds })
    if (!suggestion) {
      this.setStatus(204)
      return
    }
    return { data: suggestion }
  }
}
