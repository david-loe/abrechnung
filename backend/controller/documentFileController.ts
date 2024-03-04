import { Route, Get, Tags, Security, Request, Delete, Query, Produces, SuccessResponse } from 'tsoa'
import { Controller } from './controller.js'
import DocumentFile from '../models/documentFile.js'
import { documentFileTypes, _id } from '../../common/types.js'
import { Request as ExRequest } from 'express'
import { mongo } from 'mongoose'

@Tags('DocumentFile')
@Route('api/documentFile')
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
      throw new Error('alerts.request.unauthorized')
    }
  }

  @Delete()
  public async deleteDocumentFile(@Query() _id: _id, @Request() request: ExRequest){
    return await this.deleter(DocumentFile, { _id: _id, async checkOldObject(oldObject) {
      if(request.user!._id.equals(oldObject.owner._id)){
        return true
      }else{
        throw Error('alerts.request.unauthorized')
      }
    }, })
  }
}

@Tags('Examine', 'DocumentFile')
@Route('api/examine/documentFile')
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
      throw new Error('No file found')
    }
  }

  @Delete()
  public async deleteDocumentFile(@Query() _id: _id, @Request() request: ExRequest){
    return await this.deleter(DocumentFile, { _id: _id})
  }
}
