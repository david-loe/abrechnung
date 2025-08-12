import { Readable } from 'node:stream'
import { Delete, Get, Produces, Query, Request, Route, Security, SuccessResponse, Tags } from 'tsoa'
import { _id, documentFileTypes } from '../../common/types.js'
import DocumentFile from '../models/documentFile.js'
import { Controller, checkOwner } from './controller.js'
import { NotAllowedError, NotFoundError } from './error.js'
import { AuthenticatedExpressRequest } from './types.js'

@Tags('Document File')
@Route('documentFile')
@Security('cookieAuth', ['user'])
@Security('httpBearer', ['user'])
export class DocumentFileController extends Controller {
  @Get()
  @Produces(documentFileTypes[0])
  @Produces(documentFileTypes[1])
  @Produces(documentFileTypes[2])
  @SuccessResponse(200)
  public async getOwn(@Query() _id: string, @Request() request: AuthenticatedExpressRequest) {
    const file = await DocumentFile.findOne({ _id: _id }).lean()
    if (!(file && request.user._id.equals(file.owner._id))) {
      throw new NotAllowedError()
    }
    this.setHeader('Content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`)
    this.setHeader('Content-Type', file.type)
    this.setHeader('Content-Length', file.data.length().toString())
    return Readable.from([file.data.value()])
  }

  @Delete()
  public async deleteOwn(@Query() _id: string, @Request() request: AuthenticatedExpressRequest) {
    return await this.deleter(DocumentFile, { _id: _id, checkOldObject: checkOwner(request.user) })
  }
}

@Route('examine/documentFile')
@Security('cookieAuth', ['user', 'examine/travel'])
@Security('httpBearer', ['user', 'examine/travel'])
@Security('cookieAuth', ['user', 'examine/expenseReport'])
@Security('httpBearer', ['user', 'examine/expenseReport'])
@Security('cookieAuth', ['user', 'examine/healthCareCost'])
@Security('httpBearer', ['user', 'examine/healthCareCost'])
export class DocumentFileAdminController extends Controller {
  @Get()
  @Produces(documentFileTypes[0])
  @Produces(documentFileTypes[1])
  @Produces(documentFileTypes[2])
  @SuccessResponse(200)
  public async getAny(@Query() _id: string) {
    const file = await DocumentFile.findOne({ _id: _id }).lean()
    if (!file) {
      throw new NotFoundError('No file found')
    }
    this.setHeader('Content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`)
    this.setHeader('Content-Type', file.type)
    this.setHeader('Content-Length', file.data.length().toString())
    return Readable.from([file.data.value()])
  }

  @Delete()
  public async deleteAny(@Query() _id: string) {
    return await this.deleter(DocumentFile, { _id: _id })
  }
}
