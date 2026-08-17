import { Readable } from 'node:stream'
import { Body, Consumes, Delete, Get, Middlewares, Post, Produces, Queries, Query, Request, Route, Security, Tags } from '@tsoa/runtime'
import {
  BookingExportPackageRequest,
  IdDocument,
  Travel as ITravel,
  User as IUser,
  idDocumentToId,
  Stage,
  State,
  TravelExpense,
  TravelState,
  UserWithName
} from 'abrechnung-common/types.js'
import { mongo, QueryFilter, Types } from 'mongoose'
import { BACKEND_CACHE } from '../db.js'
import { createOperationServices } from '../factory.js'
import { checkIfUserIsProjectSupervisor, documentFileHandler, fileHandler } from '../helper.js'
import i18n from '../i18n.js'
import { emitIntegrationEvent } from '../integrations/dispatcher.js'
import ApprovedTravel from '../models/approvedTravel.js'
import Country from '../models/country.js'
import Travel, { TravelDoc } from '../models/travel.js'
import User from '../models/user.js'
import { createBookingExportPackage, getBookingExportPreview } from './bookingExport.js'
import { Controller, checkOwner, GetterQuery, SetterBody } from './controller.js'
import { AuthorizationError, NotFoundError, ValidationClientError } from './error.js'
import { bulkSaveImport, resolveImportReferences, validateImportValues } from './reportImport.js'
import { AuthenticatedExpressRequest, TravelApplication, TravelBulkImportPost, TravelPost } from './types.js'

async function assertTravelCanEnterReview(report: ITravel<Types.ObjectId, mongo.Binary>, language: string) {
  const owner = await User.findOne({ _id: report.owner._id }, { vehicleRegistration: 1 }).lean()
  const reviewSummary = createOperationServices().travelCalculator.validator.getValidationSummary(report, {
    vehicleRegistration: owner?.vehicleRegistration
  })
  if (!reviewSummary.canEnterReview) {
    throw new ValidationClientError(
      i18n.t('alerts.reviewRequirementsNotMet', { lng: language }),
      reviewSummary.results.filter((result) => result.severity === 'error').map((result) => ({ path: result.path, message: result.code }))
    )
  }
}

@Tags('Travel')
@Route('travel')
@Security('cookieAuth', ['user'])
@Security('httpBearer', ['user'])
export class TravelController extends Controller {
  @Get()
  public async getOwn(@Queries() query: GetterQuery<ITravel>, @Request() request: AuthenticatedExpressRequest) {
    return await this.getter(Travel, {
      query,
      // biome-ignore lint/suspicious/noExplicitAny: Populated path has to be queried with ObjectId
      filter: { owner: request.user._id as any, historic: false },
      projection: { history: 0, historic: 0, bookings: 0, expenses: 0, stages: 0, days: 0, bookingRemark: 0 },
      allowedAdditionalFields: ['expenses', 'stages', 'days'],
      sort: { startDate: -1 }
    })
  }

  @Delete()
  public async deleteOwn(@Query() _id: string, @Request() request: AuthenticatedExpressRequest) {
    const notAfterReview = BACKEND_CACHE.settings.preventOwnersFromDeletingReportsAfterReviewCompleted
    return await this.deleter(Travel, {
      _id: _id,
      checkOldObject: async (oldObject: TravelDoc) =>
        !oldObject.historic && (await checkOwner(request.user)(oldObject)) && (!notAfterReview || oldObject.state < State.BOOKABLE)
    })
  }

  @Post()
  public async postLumpSums(
    @Body() requestBody: SetterBody<{ days: TravelPost['days']; lastPlaceOfWork: TravelPost['lastPlaceOfWork']; _id: TravelPost['_id'] }>,
    @Request() request: AuthenticatedExpressRequest
  ) {
    const extendedBody = Object.assign(requestBody, { editor: request.user._id })
    return await this.setter(Travel, {
      requestBody: extendedBody,
      allowNew: false,
      checkOldObject: async (oldObject: TravelDoc) =>
        !oldObject.historic && oldObject.owner._id.equals(request.user._id) && oldObject.state === State.EDITABLE_BY_OWNER
    })
  }

  @Post('expense')
  @Middlewares(fileHandler.any())
  @Consumes('multipart/form-data')
  public async postExpenseToOwn(
    @Query('parentId') parentId: string,
    @Body() requestBody: SetterBody<TravelExpense<Types.ObjectId, mongo.Binary>>,
    @Request() request: AuthenticatedExpressRequest
  ) {
    return await this.setterForArrayElement(Travel, {
      requestBody: requestBody as TravelExpense,
      parentId,
      arrayElementKey: 'expenses',
      allowNew: true,
      async checkOldObject(oldObject: TravelDoc) {
        if (!oldObject.historic && oldObject.state === State.EDITABLE_BY_OWNER && request.user._id.equals(oldObject.owner._id)) {
          await documentFileHandler(['cost', 'receipts'])(request)
          // biome-ignore lint/suspicious/noExplicitAny: using Types.ObjectId to set IdDocument in backend
          oldObject.editor = request.user._id as any
          return true
        }
        return false
      },
      sortFn: (a: TravelExpense, b) => new Date(a.cost.date || 0).valueOf() - new Date(b.cost.date || 0).valueOf()
    })
  }

  @Post('stage')
  @Middlewares(fileHandler.any())
  @Consumes('multipart/form-data')
  public async postStageToOwn(
    @Query('parentId') parentId: string,
    @Body() requestBody: SetterBody<Stage<Types.ObjectId, mongo.Binary>>,
    @Request() request: AuthenticatedExpressRequest
  ) {
    return await this.setterForArrayElement(Travel, {
      requestBody: requestBody as Stage,
      parentId,
      arrayElementKey: 'stages',
      allowNew: true,
      async checkOldObject(oldObject: TravelDoc) {
        if (!oldObject.historic && oldObject.state === State.EDITABLE_BY_OWNER && request.user._id.equals(oldObject.owner._id)) {
          await documentFileHandler(['cost', 'receipts'])(request)
          // biome-ignore lint/suspicious/noExplicitAny: using Types.ObjectId to set IdDocument in backend
          oldObject.editor = request.user._id as any
          return true
        }
        return false
      },
      sortFn: (a: Stage, b) => new Date(a.departure).valueOf() - new Date(b.departure).valueOf()
    })
  }

  @Delete('expense')
  public async deleteExpeneseFromOwn(@Query() _id: string, @Query() parentId: string, @Request() request: AuthenticatedExpressRequest) {
    return await this.deleterForArrayElement(Travel, {
      _id,
      parentId,
      arrayElementKey: 'expenses',
      checkOldObject: async (oldObject: TravelDoc) => {
        if (!oldObject.historic && oldObject.state === State.EDITABLE_BY_OWNER && request.user._id.equals(oldObject.owner._id)) {
          // biome-ignore lint/suspicious/noExplicitAny: using Types.ObjectId to set IdDocument in backend
          oldObject.editor = request.user._id as any
          return true
        }
        return false
      }
    })
  }

  @Delete('stage')
  public async deleteStageFromOwn(@Query() _id: string, @Query() parentId: string, @Request() request: AuthenticatedExpressRequest) {
    return await this.deleterForArrayElement(Travel, {
      _id,
      parentId,
      arrayElementKey: 'stages',
      checkOldObject: async (oldObject: TravelDoc) => {
        if (!oldObject.historic && oldObject.state === State.EDITABLE_BY_OWNER && request.user._id.equals(oldObject.owner._id)) {
          // biome-ignore lint/suspicious/noExplicitAny: using Types.ObjectId to set IdDocument in backend
          oldObject.editor = request.user._id as any
          return true
        }
        return false
      }
    })
  }

  @Post('appliedFor')
  public async postOwnInWork(@Body() requestBody: TravelApplication, @Request() request: AuthenticatedExpressRequest) {
    const extendedBody = Object.assign(requestBody, { state: TravelState.APPLIED_FOR, editor: request.user._id })

    if (!extendedBody._id) {
      if (!request.user.access['appliedFor:travel']) {
        throw new AuthorizationError()
      }
      Object.assign(extendedBody, { owner: request.user._id })
      if (!extendedBody.name && extendedBody.startDate) {
        const date = new Date(extendedBody.startDate)
        extendedBody.name = `${extendedBody.destinationPlace?.place} ${i18n.t(`monthsShort.${date.getUTCMonth()}`, { lng: request.user.settings.language })} ${date.getUTCFullYear()}`
      }
    }
    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb: async (t: ITravel<Types.ObjectId>) => emitIntegrationEvent({ type: 'report.submitted', report: t }),
      checkOldObject: async (oldObject: TravelDoc) =>
        !oldObject.historic &&
        oldObject.state <= TravelState.APPROVED &&
        request.user._id.equals(oldObject.owner._id) &&
        request.user.access['appliedFor:travel'],
      allowNew: true
    })
  }

  @Post('approved')
  public async postOwnApproved(@Body() requestBody: TravelApplication, @Request() request: AuthenticatedExpressRequest) {
    let extendedBody: SetterBody<ITravel<Types.ObjectId, mongo.Binary>> = requestBody
    let cb: ((travel: ITravel<Types.ObjectId>) => unknown) | undefined
    if (!request.user.access['approved:travel']) {
      if (!extendedBody._id) {
        throw new AuthorizationError()
      } else {
        extendedBody = Object.assign({ _id: extendedBody._id }, { state: TravelState.APPROVED, editor: request.user._id })
      }
    } else {
      if (!extendedBody.name && extendedBody.startDate) {
        const date = new Date(extendedBody.startDate)
        extendedBody.name = `${extendedBody.destinationPlace?.place} ${i18n.t(`monthsShort.${date.getUTCMonth()}`, { lng: request.user.settings.language })} ${date.getUTCFullYear()}`
      }
      cb = async (t: ITravel<Types.ObjectId>) => {
        if (!extendedBody._id) {
          await emitIntegrationEvent({ type: 'travel.directly_approved', report: t })
        }
      }
      Object.assign(extendedBody, { state: TravelState.APPROVED, editor: request.user._id, owner: request.user._id })
    }
    return await this.setter(Travel, {
      requestBody: extendedBody,
      allowNew: true,
      cb,
      async checkOldObject(oldObject: TravelDoc) {
        if (
          oldObject.owner._id.equals(request.user._id) &&
          (oldObject.state === TravelState.APPROVED || oldObject.state === TravelState.IN_REVIEW) &&
          oldObject.editor._id.equals(request.user._id)
        ) {
          await oldObject.saveToHistory()
          return true
        }
        return false
      }
    })
  }

  @Post('underExamination')
  public async postOwnUnderExamination(
    @Body() requestBody: { _id: string; comment?: string },
    @Request() request: AuthenticatedExpressRequest
  ) {
    const extendedBody = Object.assign(requestBody, { state: TravelState.IN_REVIEW, editor: request.user._id })

    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb: async (t: ITravel<Types.ObjectId>) => emitIntegrationEvent({ type: 'report.review_requested', report: t }),
      allowNew: false,
      async checkOldObject(oldObject: TravelDoc) {
        if (oldObject.owner._id.equals(request.user._id) && oldObject.state === TravelState.APPROVED) {
          await assertTravelCanEnterReview(oldObject, request.user.settings.language)
          await oldObject.saveToHistory()
          return true
        }
        return false
      }
    })
  }

  @Get('report')
  @Produces('application/pdf')
  public async getOwnReport(@Query() _id: string, @Request() request: AuthenticatedExpressRequest) {
    const travel = await Travel.findOne({
      _id: _id,
      // biome-ignore lint/suspicious/noExplicitAny: Populated path has to be queried with ObjectId
      owner: request.user._id as any,
      historic: false,
      state: { $gte: State.BOOKABLE }
    }).lean()
    if (!travel) {
      throw new NotFoundError(`No travel with id: '${_id}' found or not allowed`)
    }
    const report = await createOperationServices().reportPrinter.print(travel, request.user.settings.language)
    this.setHeader('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(travel.name)}.pdf`)
    this.setHeader('Content-Type', 'application/pdf')
    this.setHeader('Content-Length', report.length)
    return Readable.from([report])
  }

  @Get('examiner')
  public async getExaminer() {
    return await this.getter<UserWithName, IUser<Types.ObjectId, mongo.Binary>>(User, {
      query: { limit: 5 },
      filter: { 'access.examine/travel': true },
      projection: { name: 1, email: 1 }
    })
  }
}

@Tags('Travel')
@Route('approve/travel')
@Security('cookieAuth', ['approve/travel'])
@Security('httpBearer', ['approve/travel'])
export class TravelApproveController extends Controller {
  @Get()
  public async getToApprove(@Queries() query: GetterQuery<ITravel>, @Request() request: AuthenticatedExpressRequest) {
    const filter: QueryFilter<ITravel> = { $and: [{ historic: false, state: { $gte: State.APPLIED_FOR, $lt: State.IN_REVIEW } }] }
    if (request.user.projects.supervised.length > 0) {
      // biome-ignore lint/suspicious/noExplicitAny: Populated path has to be queried with ObjectId
      filter.$and?.push({ project: { $in: request.user.projects.supervised as any } })
    }
    return await this.getter(Travel, {
      query,
      filter,
      projection: { history: 0, historic: 0, bookings: 0, expenses: 0, stages: 0, days: 0 },
      sort: { updatedAt: -1 }
    })
  }

  @Post('bulk')
  public async postManyApproved(@Body() requestBody: TravelBulkImportPost[], @Request() request: AuthenticatedExpressRequest) {
    const resolvedReferences = await resolveImportReferences(requestBody)
    const countries = await Country.find(
      { _id: { $in: requestBody.map(({ destinationPlace }) => destinationPlace?.country) } },
      { _id: 1, needsA1Certificate: 1 }
    ).lean()
    validateImportValues(
      requestBody.map(({ destinationPlace }) => destinationPlace?.country),
      new Set(countries.map(({ _id }) => _id)),
      'destinationPlace.country',
      'country'
    )

    const countriesById = new Map(countries.map((country) => [country._id, country]))
    const validationErrors: { path: string; message: string }[] = []
    for (const [index, row] of requestBody.entries()) {
      const startDate = new Date(row.startDate)
      const endDate = new Date(row.endDate)
      const rowLabel = `CSV row ${index + 3}`
      if (Number.isNaN(startDate.valueOf())) {
        validationErrors.push({ path: `${index}.startDate`, message: `${rowLabel}: Invalid start date.` })
      }
      if (Number.isNaN(endDate.valueOf())) {
        validationErrors.push({ path: `${index}.endDate`, message: `${rowLabel}: Invalid end date.` })
      }
      if (!Number.isNaN(startDate.valueOf()) && !Number.isNaN(endDate.valueOf())) {
        const dayCount = (endDate.valueOf() - startDate.valueOf()) / (1_000 * 60 * 60 * 24)
        if (dayCount < 0) {
          validationErrors.push({ path: `${index}.endDate`, message: `${rowLabel}: End date must not be before start date.` })
        } else if (dayCount > BACKEND_CACHE.travelSettings.maxTravelDayCount) {
          validationErrors.push({ path: `${index}.endDate`, message: `${rowLabel}: Travel exceeds the maximum duration.` })
        }
      }
      if (row.claimSpouseRefund && !BACKEND_CACHE.travelSettings.allowSpouseRefund) {
        validationErrors.push({ path: `${index}.claimSpouseRefund`, message: `${rowLabel}: Spouse refund is disabled.` })
      } else if (row.claimSpouseRefund && !row.fellowTravelersNames?.trim()) {
        validationErrors.push({ path: `${index}.fellowTravelersNames`, message: `${rowLabel}: Fellow traveler names are required.` })
      }
      if (row.isCrossBorder && countriesById.get(row.destinationPlace.country)?.needsA1Certificate) {
        if (!row.a1Certificate?.exactAddress?.trim()) {
          validationErrors.push({ path: `${index}.a1Certificate.exactAddress`, message: `${rowLabel}: Exact address is required.` })
        }
        if (!row.a1Certificate?.destinationName?.trim()) {
          validationErrors.push({ path: `${index}.a1Certificate.destinationName`, message: `${rowLabel}: Destination name is required.` })
        }
      }
    }
    if (validationErrors.length > 0) {
      throw new ValidationClientError(validationErrors[0].message, validationErrors)
    }

    const documents = requestBody.map((row, index) => {
      let name = row.name
      if (!name && row.startDate) {
        const date = new Date(row.startDate)
        name = `${row.destinationPlace?.place} ${i18n.t(`monthsShort.${date.getUTCMonth()}`, { lng: request.user.settings.language })} ${date.getUTCFullYear()}`
      }
      return new Travel({
        ...row,
        name,
        destinationPlace: { place: row.destinationPlace?.place, country: row.destinationPlace?.country },
        owner: resolvedReferences[index].owner,
        project: resolvedReferences[index].project,
        advances: resolvedReferences[index].advances,
        state: TravelState.APPROVED,
        editor: request.user._id,
        a1Certificate: row.isCrossBorder ? row.a1Certificate : undefined
      })
    })
    const result = await bulkSaveImport(Travel, documents)
    await Promise.all(result.map((travel) => emitIntegrationEvent({ type: 'travel.approved', report: travel })))
    return { message: 'alerts.successSaving', result }
  }

  @Post('approved')
  public async postAnyApproved(
    @Body() requestBody: ((TravelApplication & { owner: IdDocument }) | { _id: string }) & { comment?: string },
    @Request() request: AuthenticatedExpressRequest
  ) {
    const extendedBody = Object.assign(requestBody, { state: TravelState.APPROVED, editor: request.user._id })
    if (!extendedBody._id) {
      const travelApplication = extendedBody as TravelApplication
      if (!travelApplication.name && travelApplication.startDate) {
        const date = new Date(travelApplication.startDate as string)
        travelApplication.name = `${travelApplication.destinationPlace?.place} ${i18n.t(`monthsShort.${date.getUTCMonth()}`, { lng: request.user.settings.language })} ${date.getUTCFullYear()}`
      }
    }

    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb: async (t: ITravel<Types.ObjectId>) => emitIntegrationEvent({ type: 'travel.approved', report: t }),
      allowNew: true,
      async checkOldObject(oldObject: TravelDoc) {
        if (oldObject.state === TravelState.APPLIED_FOR && checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)) {
          await oldObject.saveToHistory()
          return true
        }
        return false
      }
    })
  }

  @Post('withdrawApproval')
  public async withdrawApproval(@Body() requestBody: { _id: string; comment?: string }, @Request() request: AuthenticatedExpressRequest) {
    const extendedBody = Object.assign(requestBody, { state: TravelState.REJECTED, editor: request.user._id })

    const result = await this.setter(Travel, {
      requestBody: extendedBody,
      allowNew: false,
      async checkOldObject(oldObject: TravelDoc) {
        if (oldObject.state !== TravelState.APPROVED || !checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)) {
          return false
        }
        await oldObject.saveToHistory()
        oldObject.log[TravelState.REJECTED] = undefined
        oldObject.log[TravelState.APPROVED] = undefined
        oldObject.markModified('log')
        return true
      }
    })

    await ApprovedTravel.deleteOne({ reportId: result.result._id })
    await emitIntegrationEvent({ type: 'report.approval_withdrawn', report: result.result })
    return result
  }

  @Post('rejected')
  public async postAnyRejected(@Body() requestBody: { _id: string; comment?: string }, @Request() request: AuthenticatedExpressRequest) {
    const extendedBody = Object.assign(requestBody, { state: TravelState.REJECTED, editor: request.user._id })

    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb: async (t: ITravel<Types.ObjectId>) => emitIntegrationEvent({ type: 'report.rejected', report: t }),
      allowNew: false,
      checkOldObject: async (oldObject: TravelDoc) =>
        oldObject.state === TravelState.APPLIED_FOR && checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)
    })
  }
}

@Tags('Travel')
@Route('examine/travel')
@Security('cookieAuth', ['examine/travel'])
@Security('httpBearer', ['examine/travel'])
export class TravelExamineController extends Controller {
  @Get()
  public async getToExamine(@Queries() query: GetterQuery<ITravel>, @Request() request: AuthenticatedExpressRequest) {
    const filter: QueryFilter<ITravel> = { $and: [{ historic: false, state: { $gte: State.EDITABLE_BY_OWNER } }] }
    if (request.user.projects.supervised.length > 0) {
      // biome-ignore lint/suspicious/noExplicitAny: Populated path has to be queried with ObjectId
      filter.$and?.push({ project: { $in: request.user.projects.supervised as any } })
    }
    return await this.getter(Travel, {
      query,
      filter,
      projection: { history: 0, historic: 0, bookings: 0, expenses: 0, stages: 0, days: 0 },
      allowedAdditionalFields: ['expenses', 'stages', 'days'],
      sort: { updatedAt: -1 }
    })
  }

  @Post()
  public async postAny(@Body() requestBody: SetterBody<TravelPost>, @Request() request: AuthenticatedExpressRequest) {
    const extendedBody = Object.assign(requestBody, { editor: request.user._id })

    return await this.setter(Travel, {
      requestBody: extendedBody,
      allowNew: false,
      checkOldObject: async (oldObject: TravelDoc) =>
        !oldObject.historic &&
        (oldObject.state === State.EDITABLE_BY_OWNER || oldObject.state === State.IN_REVIEW) &&
        checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)
    })
  }

  @Delete()
  public async deleteAny(@Query() _id: string, @Request() request: AuthenticatedExpressRequest) {
    return await this.deleter(Travel, {
      _id: _id,
      async checkOldObject(oldObject: TravelDoc) {
        return checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)
      }
    })
  }

  @Post('expense')
  @Middlewares(fileHandler.any())
  @Consumes('multipart/form-data')
  public async postExpenseToAny(
    @Query('parentId') parentId: string,
    @Body() requestBody: SetterBody<TravelExpense<Types.ObjectId, mongo.Binary>>,
    @Request() request: AuthenticatedExpressRequest
  ) {
    return await this.setterForArrayElement(Travel, {
      requestBody: requestBody as TravelExpense,
      parentId,
      arrayElementKey: 'expenses',
      allowNew: true,
      async checkOldObject(oldObject: TravelDoc) {
        if (
          !oldObject.historic &&
          (oldObject.state === State.EDITABLE_BY_OWNER || oldObject.state === State.IN_REVIEW) &&
          checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)
        ) {
          await documentFileHandler(['cost', 'receipts'], { owner: oldObject.owner._id })(request)
          // biome-ignore lint/suspicious/noExplicitAny: using Types.ObjectId to set IdDocument in backend
          oldObject.editor = request.user._id as any
          return true
        }
        return false
      },
      sortFn: (a: TravelExpense, b) => new Date(a.cost.date || 0).valueOf() - new Date(b.cost.date || 0).valueOf()
    })
  }

  @Post('stage')
  @Middlewares(fileHandler.any())
  @Consumes('multipart/form-data')
  public async postStageToAny(
    @Query('parentId') parentId: string,
    @Body() requestBody: SetterBody<Stage<Types.ObjectId, mongo.Binary>>,
    @Request() request: AuthenticatedExpressRequest
  ) {
    return await this.setterForArrayElement(Travel, {
      requestBody: requestBody as Stage,
      parentId,
      arrayElementKey: 'stages',
      allowNew: true,
      async checkOldObject(oldObject: TravelDoc) {
        if (
          !oldObject.historic &&
          (oldObject.state === State.EDITABLE_BY_OWNER || oldObject.state === State.IN_REVIEW) &&
          checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)
        ) {
          await documentFileHandler(['cost', 'receipts'], { owner: oldObject.owner._id })(request)
          // biome-ignore lint/suspicious/noExplicitAny: using Types.ObjectId to set IdDocument in backend
          oldObject.editor = request.user._id as any
          return true
        }
        return false
      },
      sortFn: (a: Stage, b) => new Date(a.departure).valueOf() - new Date(b.departure).valueOf()
    })
  }

  @Delete('expense')
  public async deleteExpeneseFromAny(@Query() _id: string, @Query() parentId: string, @Request() request: AuthenticatedExpressRequest) {
    return await this.deleterForArrayElement(Travel, {
      _id,
      parentId,
      arrayElementKey: 'expenses',
      async checkOldObject(oldObject: TravelDoc) {
        if (
          !oldObject.historic &&
          (oldObject.state === State.EDITABLE_BY_OWNER || oldObject.state === State.IN_REVIEW) &&
          checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)
        ) {
          // biome-ignore lint/suspicious/noExplicitAny: using Types.ObjectId to set IdDocument in backend
          oldObject.editor = request.user._id as any
          return true
        }
        return false
      }
    })
  }

  @Delete('stage')
  public async deleteStageFromAny(@Query() _id: string, @Query() parentId: string, @Request() request: AuthenticatedExpressRequest) {
    return await this.deleterForArrayElement(Travel, {
      _id,
      parentId,
      arrayElementKey: 'stages',
      async checkOldObject(oldObject: TravelDoc) {
        if (
          !oldObject.historic &&
          (oldObject.state === State.EDITABLE_BY_OWNER || oldObject.state === State.IN_REVIEW) &&
          checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)
        ) {
          // biome-ignore lint/suspicious/noExplicitAny: using Types.ObjectId to set IdDocument in backend
          oldObject.editor = request.user._id as any
          return true
        }
        return false
      }
    })
  }

  @Post('reviewCompleted')
  public async postReviewCompleted(
    @Body() requestBody: { _id: string; comment?: string; bookingRemark?: string | null },
    @Request() request: AuthenticatedExpressRequest
  ) {
    const extendedBody = Object.assign(requestBody, { state: TravelState.REVIEW_COMPLETED, editor: request.user._id })

    const cb = async (t: ITravel<Types.ObjectId>) => emitIntegrationEvent({ type: 'report.review_completed', report: t })

    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb,
      allowNew: false,
      async checkOldObject(oldObject: TravelDoc) {
        if (
          !oldObject.historic &&
          oldObject.state === TravelState.IN_REVIEW &&
          checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)
        ) {
          await assertTravelCanEnterReview(oldObject, request.user.settings.language)
          await oldObject.saveToHistory()
          return true
        }
        return false
      }
    })
  }

  @Post('approved')
  public async postAnyApproved(@Body() requestBody: { _id: string; comment?: string }, @Request() request: AuthenticatedExpressRequest) {
    const extendedBody = Object.assign(requestBody, { state: TravelState.APPROVED, editor: request.user._id })

    return await this.setter(Travel, {
      requestBody: extendedBody,
      allowNew: false,
      cb: (e: ITravel) => emitIntegrationEvent({ type: 'travel.back_to_approved', report: e }),
      async checkOldObject(oldObject: TravelDoc) {
        if (oldObject.state === TravelState.IN_REVIEW && checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)) {
          await oldObject.saveToHistory()
          return true
        }
        return false
      }
    })
  }

  @Post('underExamination')
  public async postAnyUnderExamination(
    @Body() requestBody: { _id: string; comment?: string },
    @Request() request: AuthenticatedExpressRequest
  ) {
    const extendedBody = Object.assign(requestBody, { state: TravelState.IN_REVIEW, editor: request.user._id })

    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb: async (t: ITravel<Types.ObjectId>) => emitIntegrationEvent({ type: 'report.review_requested', report: t }),
      allowNew: false,
      async checkOldObject(oldObject: TravelDoc) {
        if (oldObject.state === TravelState.APPROVED && checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)) {
          await assertTravelCanEnterReview(oldObject, request.user.settings.language)
          await oldObject.saveToHistory()
          return true
        }
        return false
      }
    })
  }

  @Get('report')
  @Produces('application/pdf')
  public async getReport(@Query() _id: string, @Request() request: AuthenticatedExpressRequest) {
    const filter: QueryFilter<ITravel<Types.ObjectId, mongo.Binary>> = { _id, historic: false, state: { $gte: State.BOOKABLE } }
    if (request.user.projects.supervised.length > 0) {
      // biome-ignore lint/suspicious/noExplicitAny: Populated path has to be queried with ObjectId
      filter.project = { $in: request.user.projects.supervised as any }
    }
    const travel = await Travel.findOne(filter).lean()
    if (!travel) {
      throw new NotFoundError(`No travel with id: '${_id}' found or not allowed`)
    }
    const report = await createOperationServices().reportPrinter.print(travel, request.user.settings.language)
    this.setHeader('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(travel.name)}.pdf`)
    this.setHeader('Content-Type', 'application/pdf')
    this.setHeader('Content-Length', report.length)
    return Readable.from([report])
  }
}

@Tags('Travel')
@Route('book/travel')
@Security('cookieAuth', ['book/travel'])
@Security('httpBearer', ['book/travel'])
export class TravelBookableController extends Controller {
  @Get()
  public async getBookable(@Queries() query: GetterQuery<ITravel>, @Request() request: AuthenticatedExpressRequest) {
    const filter: QueryFilter<ITravel> = { historic: false, state: { $gte: State.BOOKABLE } }
    if (request.user.projects.supervised.length > 0) {
      // biome-ignore lint/suspicious/noExplicitAny: Populated path has to be queried with ObjectId
      filter.project = { $in: request.user.projects.supervised as any }
    }
    return await this.getter(Travel, {
      query,
      filter,
      projection: { history: 0, historic: 0, bookings: 0, expenses: 0 },
      allowedAdditionalFields: ['expenses'],
      sort: { updatedAt: -1 }
    })
  }

  @Get('report')
  @Produces('application/pdf')
  public async getBookableReport(@Query() _id: string, @Request() request: AuthenticatedExpressRequest) {
    const filter: QueryFilter<ITravel<Types.ObjectId, mongo.Binary>> = { _id, historic: false, state: { $gte: State.BOOKABLE } }
    if (request.user.projects.supervised.length > 0) {
      // biome-ignore lint/suspicious/noExplicitAny: Populated path has to be queried with ObjectId
      filter.project = { $in: request.user.projects.supervised as any }
    }
    const travel = await Travel.findOne(filter).lean()
    if (!travel) {
      throw new NotFoundError(`No travel with id: '${_id}' found or not allowed`)
    }
    const report = await createOperationServices().reportPrinter.print(travel, request.user.settings.language)
    this.setHeader('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(travel.name)}.pdf`)
    this.setHeader('Content-Type', 'application/pdf')
    this.setHeader('Content-Length', report.length)
    return Readable.from([report])
  }

  @Post('bookingExportPreview')
  public async postBookingExportPreview(@Body() requestBody: IdDocument<string>[], @Request() request: AuthenticatedExpressRequest) {
    return { result: await getBookingExportPreview(Travel, 'Travel', requestBody, request) }
  }

  @Post('bookingExportPackage')
  public async postBookingExportPackage(
    @Body() requestBody: BookingExportPackageRequest<string>,
    @Request() request: AuthenticatedExpressRequest
  ) {
    return { result: await createBookingExportPackage(Travel, 'Travel', requestBody, request) }
  }

  @Post('booked')
  public async postBooked(@Body() requestBody: IdDocument<string>[], @Request() request: AuthenticatedExpressRequest) {
    const results = await Promise.allSettled(
      requestBody.map((id) => {
        const doc = { _id: idDocumentToId(id), state: State.BOOKED, editor: request.user._id }
        return this.setter(Travel, {
          requestBody: doc,
          allowNew: false,
          async checkOldObject(oldObject: TravelDoc) {
            if (oldObject.state === State.BOOKABLE && checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)) {
              await oldObject.saveToHistory()
              return true
            }
            return false
          }
        })
      })
    )
    const reducedResults = results.map((r) => ({ status: r.status, reason: (r as PromiseRejectedResult).reason }))
    const count = reducedResults.length
    const fulfilledCount = reducedResults.filter((entry) => entry.status === 'fulfilled').length
    if (fulfilledCount === 0 && count > 0) {
      throw new Error(reducedResults[0].reason)
    }
    return { result: reducedResults, message: `${fulfilledCount}/${count}` }
  }
}
