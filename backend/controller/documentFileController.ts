import { Readable } from 'node:stream'
import {
  Body,
  Consumes,
  Delete,
  Get,
  Middlewares,
  Post,
  Produces,
  Query,
  Request,
  Route,
  Security,
  SuccessResponse,
  Tags
} from '@tsoa/runtime'
import { DocumentFileType, documentFileTypes } from 'abrechnung-common/types.js'
import { mongo, Types } from 'mongoose'
import { MAX_OCR_CHARACTERS, temporaryDocumentFileExpiration } from '../documentFiles.js'
import { authorizeExaminedReport, ExaminedReportContext } from '../examinedReports.js'
import { fileHandler } from '../helper.js'
import DocumentFile, { StoredDocumentFile } from '../models/documentFile.js'
import { Controller, checkOwner } from './controller.js'
import { NotAllowedError, ValidationClientError } from './error.js'
import { AuthenticatedExpressRequest } from './types.js'

interface OcrBody {
  documentFileId: string
  /** @maxLength 500000 */
  ocr: string
}

interface ExaminedOcrBody extends OcrBody, ExaminedReportContext {}

function documentFileResult(documentFile: StoredDocumentFile) {
  return { _id: documentFile._id, name: documentFile.name, owner: documentFile.owner, type: documentFile.type }
}

async function createDocumentFile(request: AuthenticatedExpressRequest, owner: Types.ObjectId) {
  if (!request.file) {
    throw new ValidationClientError('No file uploaded.', [{ path: 'file', message: 'required' }])
  }
  if (!documentFileTypes.includes(request.file.mimetype as DocumentFileType)) {
    throw new ValidationClientError('Unsupported file type.', [{ path: 'file', message: 'invalidType' }])
  }
  const documentFile = await new DocumentFile({
    data: request.file.buffer as unknown as mongo.Binary,
    name: request.file.originalname,
    owner,
    type: request.file.mimetype as DocumentFileType,
    expiresAt: temporaryDocumentFileExpiration()
  }).save()
  return { result: documentFileResult(documentFile.toObject()) }
}

function validateOcr(ocr: string) {
  if (ocr.length > MAX_OCR_CHARACTERS) {
    throw new ValidationClientError('OCR content is too long.', [{ path: 'ocr', message: 'maxLength' }])
  }
}

@Tags('Document File')
@Route('documentFile')
@Security('cookieAuth', ['user'])
@Security('httpBearer', ['user'])
export class DocumentFileController extends Controller {
  @Post()
  @Middlewares(fileHandler.single('file'))
  @Consumes('multipart/form-data')
  @SuccessResponse(201)
  public async postOwn(@Request() request: AuthenticatedExpressRequest) {
    this.setStatus(201)
    return await createDocumentFile(request, request.user._id)
  }

  @Post('ocr')
  @SuccessResponse(204)
  public async postOwnOcr(@Body() body: OcrBody, @Request() request: AuthenticatedExpressRequest) {
    validateOcr(body.ocr)
    const result = await DocumentFile.updateOne({ _id: body.documentFileId, owner: request.user._id }, { $set: { ocr: body.ocr } })
    if (result.matchedCount === 0) throw new NotAllowedError()
    this.setStatus(204)
  }

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
  @Post()
  @Middlewares(fileHandler.single('file'))
  @Consumes('multipart/form-data')
  @SuccessResponse(201)
  public async postAny(
    @Query() ownerId: string,
    @Query() reportId: string,
    @Query() sourceReportType: ExaminedReportContext['sourceReportType'],
    @Request() request: AuthenticatedExpressRequest
  ) {
    const report = await authorizeExaminedReport({ reportId, sourceReportType }, request.user)
    if (!report.owner.equals(ownerId)) throw new NotAllowedError()
    this.setStatus(201)
    return await createDocumentFile(request, report.owner)
  }

  @Post('ocr')
  @SuccessResponse(204)
  public async postAnyOcr(@Body() body: ExaminedOcrBody, @Request() request: AuthenticatedExpressRequest) {
    validateOcr(body.ocr)
    const report = await authorizeExaminedReport(body, request.user)
    const result = await DocumentFile.updateOne({ _id: body.documentFileId, owner: report.owner }, { $set: { ocr: body.ocr } })
    if (result.matchedCount === 0) throw new NotAllowedError()
    this.setStatus(204)
  }

  @Get()
  @Produces(documentFileTypes[0])
  @Produces(documentFileTypes[1])
  @Produces(documentFileTypes[2])
  @SuccessResponse(200)
  public async getAny(
    @Query() _id: string,
    @Query() reportId: string,
    @Query() sourceReportType: ExaminedReportContext['sourceReportType'],
    @Request() request: AuthenticatedExpressRequest
  ) {
    const report = await authorizeExaminedReport({ reportId, sourceReportType }, request.user)
    const file = await DocumentFile.findOne({ _id, owner: report.owner }).lean()
    if (!file) {
      throw new NotAllowedError()
    }
    this.setHeader('Content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`)
    this.setHeader('Content-Type', file.type)
    this.setHeader('Content-Length', file.data.length().toString())
    return Readable.from([file.data.value()])
  }

  @Delete()
  public async deleteAny(
    @Query() _id: string,
    @Query() reportId: string,
    @Query() sourceReportType: ExaminedReportContext['sourceReportType'],
    @Request() request: AuthenticatedExpressRequest
  ) {
    const report = await authorizeExaminedReport({ reportId, sourceReportType }, request.user)
    return await this.deleter(DocumentFile, { _id, checkOldObject: async (file) => file.owner.equals(report.owner) })
  }
}
