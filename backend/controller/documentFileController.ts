import { Request as ExRequest } from 'express'
import { mongo } from 'mongoose'
import { Delete, Get, Produces, Query, Request, Route, Security, SuccessResponse } from 'tsoa'
import { _id, documentFileTypes } from '../../common/types.js'
import DocumentFile from '../models/documentFile.js'
import { Controller } from './controller.js'
import { NotAllowedError, NotFoundError } from './error.js'

@Route('documentFile')
@Security('cookieAuth', ['user'])
export class DocumentFileController extends Controller {
  @Get()
  @Produces(documentFileTypes[0])
  @Produces(documentFileTypes[1])
  @Produces(documentFileTypes[2])
  @SuccessResponse(200)
  public async getDocumentFile(@Query() _id: _id, @Request() request: ExRequest) {
    const file = await DocumentFile.findOne({ _id: _id }).lean()
    if (file && request.user!._id.equals(file.owner._id)) {
      request.res?.setHeader('Content-Type', file.type)
      request.res?.setHeader('Content-Length', (file.data as any as mongo.Binary).length().toString())
      request.res?.send((file.data as any as mongo.Binary).buffer)
    } else {
      throw new NotAllowedError()
    }
  }

  @Delete()
  public async deleteDocumentFile(@Query() _id: _id, @Request() request: ExRequest) {
    return await this.deleter(DocumentFile, { _id: _id, checkOldObject: this.checkOwner(request.user!) })
  }
}

@Route('examine/documentFile')
@Security('cookieAuth', ['user', 'examine/travel'])
@Security('cookieAuth', ['user', 'examine/expenseReport'])
@Security('cookieAuth', ['user', 'examine/healthCareCost'])
export class DocumentFileAdminController extends Controller {
  @Get()
  @Produces(documentFileTypes[0])
  @Produces(documentFileTypes[1])
  @Produces(documentFileTypes[2])
  @SuccessResponse(200)
  public async getDocumentFile(@Query() _id: _id, @Request() request: ExRequest) {
    const file = await DocumentFile.findOne({ _id: _id }).lean()
    if (file) {
      request.res?.setHeader('Content-Type', file.type)
      request.res?.setHeader('Content-Length', (file.data as any as mongo.Binary).length().toString())
      request.res?.send((file.data as any as mongo.Binary).buffer)
    } else {
      throw new NotFoundError('No file found')
    }
  }

  @Delete()
  public async deleteDocumentFile(@Query() _id: _id, @Request() request: ExRequest) {
    return await this.deleter(DocumentFile, { _id: _id })
  }
}
