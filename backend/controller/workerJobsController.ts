import { Get, Path, Post, Query, Route, Security, Tags } from '@tsoa/runtime'
import { WorkerJobState } from 'abrechnung-common/types.js'
import { getWorkerJob, getWorkerJobs, retryWorkerJob } from '../integrations/jobs.js'
import { Controller } from './controller.js'

@Tags('Worker Jobs')
@Route('admin/jobs')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class WorkerJobsController extends Controller {
  @Get()
  public async get(
    @Query() state?: WorkerJobState,
    @Query() name?: string,
    @Query() id?: string,
    /** @isInt @minimum 1 @default 1 */ @Query() page = 1,
    /** @isInt @minimum 1 @maximum 100 @default 25 */ @Query() limit = 25,
    /** @default desc */ @Query() sortDirection: 'asc' | 'desc' = 'desc'
  ) {
    return await getWorkerJobs({ state, name, id, page, limit, sortDirection })
  }

  @Get('{jobId}')
  public async getOne(@Path() jobId: string) {
    return await getWorkerJob(jobId)
  }

  @Post('{jobId}/retry')
  public async retry(@Path() jobId: string) {
    return { message: 'alerts.successRetryingJob', result: await retryWorkerJob(jobId) }
  }
}
