import ejs from 'ejs'
import { Request as ExRequest, Response as ExResponse, NextFunction } from 'express'
import multer from 'multer'
import fs from 'node:fs/promises'
import { Body, Consumes, Controller, Get, Middlewares, Post, Produces, Query, Request, Route, SuccessResponse, Tags } from 'tsoa'
import { _id } from '../../common/types.js'
import { documentFileHandler, getSettings } from '../helper.js'
import i18n from '../i18n.js'
import Token from '../models/token.js'
import User from '../models/user.js'
import { AuthorizationError, NotFoundError } from './error.js'
import { File } from './types.js'

async function validateToken(req: ExRequest, res: ExResponse, next: NextFunction) {
  const user = await User.findOne({ _id: req.query.userId as string }).lean()
  if (!(user && user.token && user.token._id.equals(req.query.tokenId as string))) {
    throw new AuthorizationError('Token not valid')
  }
  next()
}
const fileHandler = multer({ limits: { fileSize: 16000000 } })

@Tags('Upload')
@Route('upload')
export class UploadController extends Controller {
  @Get('new')
  @Middlewares(validateToken)
  @Produces('text/html')
  @SuccessResponse(200)
  public async uploadPage(
    @Request() req: ExRequest,
    @Query() userId: string,
    @Query() tokenId: string,
    @Query() ownerId?: string
  ): Promise<void> {
    const settings = await getSettings()
    const user = await User.findOne({ _id: userId }).lean()
    const template = await fs.readFile('./templates/upload.ejs', { encoding: 'utf-8' })
    const url = new URL(process.env.VITE_BACKEND_URL + '/upload/new')
    url.searchParams.append('userId', userId)
    url.searchParams.append('tokenId', tokenId)
    if (ownerId) {
      const owner = await User.findOne({ _id: ownerId }).lean()
      if (owner) {
        url.searchParams.append('ownerId', ownerId)
      } else {
        throw new NotFoundError(`No user found for ownerId: ${ownerId}`)
      }
    }
    const secondsLeft = Math.round(
      (new Date(user!.token!.createdAt).valueOf() + settings.uploadTokenExpireAfterSeconds * 1000 - new Date().valueOf()) / 1000
    )
    const text = {
      tapToUpload: i18n.t('labels.tapToUpload', { lng: user?.settings.language }),
      uploading: i18n.t('labels.uploading', { lng: user?.settings.language }),
      success: i18n.t('labels.success', { lng: user?.settings.language }),
      error: i18n.t('labels.error', { lng: user?.settings.language })
    }
    const renderedHTML = ejs.render(template, {
      url: url.href,
      expireAfterSeconds: settings.uploadTokenExpireAfterSeconds,
      secondsLeft,
      text,
      language: user?.settings.language
    })
    this.setHeader('Content-Type', 'text/html; charset=utf-8')
    req.res?.send(renderedHTML)
  }

  @Post('new')
  @Middlewares(validateToken, fileHandler.any())
  @Consumes('multipart/form-data')
  public async upload(
    @Request() req: ExRequest,
    @Body() requestBody: { files: File[] },
    @Query() userId: string,
    @Query() tokenId: string,
    @Query() ownerId?: string
  ) {
    const token = await Token.findOne({ _id: tokenId })
    if (token) {
      await documentFileHandler(['files'], { owner: ownerId || userId })(req)
      token.files = token.files.concat(requestBody.files as unknown as _id[])
      token.markModified('files')
      await token.save()
    }
  }
}
