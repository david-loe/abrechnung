import { Body, Consumes, Controller, Get, Middlewares, Post, Produces, Query, Request, Route, SuccessResponse, Tags } from '@tsoa/runtime'
import { SuggestionSourceReportType } from 'abrechnung-common/types.js'
import ejs from 'ejs'
import { Request as ExRequest, Response as ExResponse, NextFunction } from 'express'
import { Types } from 'mongoose'
import { BACKEND_CACHE } from '../db.js'
import ENV from '../env.js'
import { authorizeExaminedReport } from '../examinedReports.js'
import { documentFileHandler, fileHandler } from '../helper.js'
import i18n from '../i18n.js'
import Token from '../models/token.js'
import User from '../models/user.js'
import { getFileUtilsContent, getUploadTemplate } from '../templates/cache.js'
import { AuthorizationError, NotAllowedError, NotFoundError, ValidationClientError } from './error.js'
import { File } from './types.js'

async function validateToken(req: ExRequest, _res: ExResponse, next: NextFunction) {
  const user = await User.findOne({ _id: req.query.userId as string })
  if (!user?.token?._id.equals(req.query.tokenId as string)) {
    throw new AuthorizationError('Token not valid')
  }
  req.user = user
  next()
}

async function uploadOwner(
  user: Express.User,
  userId: string,
  ownerId?: string,
  reportId?: string,
  sourceReportType?: SuggestionSourceReportType
) {
  if (!ownerId) return new Types.ObjectId(userId)
  if (!reportId || !sourceReportType) throw new ValidationClientError('Examined uploads require a report context.')
  const report = await authorizeExaminedReport({ reportId, sourceReportType }, user)
  if (!report.owner.equals(ownerId)) throw new NotAllowedError()
  return report.owner
}

@Tags('Upload')
@Route('upload')
export class UploadController extends Controller {
  @Get('new')
  @Middlewares(validateToken)
  @Produces('text/html')
  @SuccessResponse(200)
  public async getUploadPage(
    @Request() req: ExRequest,
    @Query() userId: string,
    @Query() tokenId: string,
    @Query() ownerId?: string,
    @Query() reportId?: string,
    @Query() sourceReportType?: SuggestionSourceReportType
  ): Promise<void> {
    const user = await User.findOne({ _id: userId }).lean()
    if (!user?.token) {
      throw new NotFoundError(`No user with token found for userId: ${userId}`)
    }
    const template = await getUploadTemplate()
    const url = new URL(`${ENV.VITE_BACKEND_URL}/upload/new`)
    url.searchParams.append('userId', userId)
    url.searchParams.append('tokenId', tokenId)
    if (ownerId) {
      await uploadOwner(req.user as Express.User, userId, ownerId, reportId, sourceReportType)
      url.searchParams.append('ownerId', ownerId)
      url.searchParams.append('reportId', reportId as string)
      url.searchParams.append('sourceReportType', sourceReportType as string)
    }
    const secondsLeft = Math.round((new Date(user.token.expireAt).valueOf() - Date.now()) / 1_000)
    const text = {
      tapToUpload: i18n.t('labels.tapToUpload', { lng: user?.settings.language }),
      uploading: i18n.t('labels.uploading', { lng: user?.settings.language }),
      success: i18n.t('labels.success', { lng: user?.settings.language }),
      error: i18n.t('labels.error', { lng: user?.settings.language }),
      fileXToLargeMaxIsY: i18n.t('alerts.fileXToLargeMaxIsY', { X: 'X', Y: 'Y', lng: user?.settings.language }),
      fileTypeOfXNotSupportedY: i18n.t('alerts.fileTypeOfXNotSupportedY', { X: 'X', Y: 'Y', lng: user?.settings.language })
    }
    const renderedHTML = ejs.render(template, {
      url: url.href,
      expireAfterSeconds: BACKEND_CACHE.settings.uploadTokenExpireAfterSeconds,
      secondsLeft,
      text,
      maxFileSizeInBytes: ENV.VITE_MAX_FILE_SIZE,
      imageCompressionThresholdInPx: ENV.VITE_IMAGE_COMPRESSION_THRESHOLD_PX,
      language: user?.settings.language,
      fileUtilsContent: await getFileUtilsContent()
    })
    req.res?.header('Content-Type', 'text/html; charset=utf-8').send(renderedHTML)
  }

  @Post('new')
  @Middlewares(validateToken, fileHandler.any())
  @Consumes('multipart/form-data')
  public async postFiles(
    @Request() req: ExRequest,
    @Body() requestBody: { files: File[] },
    @Query() userId: string,
    @Query() tokenId: string,
    @Query() ownerId?: string,
    @Query() reportId?: string,
    @Query() sourceReportType?: SuggestionSourceReportType
  ) {
    const token = await Token.findOne({ _id: tokenId })
    if (token) {
      const owner = await uploadOwner(req.user as Express.User, userId, ownerId, reportId, sourceReportType)
      await documentFileHandler(['files'], { owner, temporary: true })(req)
      token.files = token.files.concat(requestBody.files as unknown as Types.ObjectId[])
      token.markModified('files')
      await token.save()
    }
  }
}
