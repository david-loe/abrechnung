import { Controller as TsoaController } from 'tsoa'
import { Model, Types, FilterQuery, ProjectionType, HydratedDocument } from 'mongoose'
import { GETResponse, Meta } from '../../common/types.js'
import { DeleteResult } from 'mongodb'
import { _id } from './types.js'

export interface GetterQuery<ModelType> {
  /**
   * @isInt
   * @minimum 1
   */
  limit?: number
  /**
   * @isInt
   * @minimum 1
   */
  page?: number
  _id?: _id
  additionalFields?: (keyof ModelType)[]
  /**
   * @format byte
   */
  filterJSON?: string
}

export interface GetterOptions<ModelType> extends GetterQuery<ModelType> {
  filter?: FilterQuery<ModelType>
  projection?: ProjectionType<ModelType>
  sortFn?: (a: ModelType, b: ModelType) => number
  cb?: (data: ModelType | ModelType[]) => any
  allowedAdditionalFields?: (keyof ModelType)[]
}

/**
 * With _id everything else is optional. Without some fields may be required.
 */
export type SetterBody<ModelType> = Partial<ModelType>

export interface SetterOptions<ModelType> {
  requestBody: SetterBody<ModelType>
  cb?: (data: ModelType) => any
  allowNew?: boolean
  checkOldObject?: (oldObject: HydratedDocument<ModelType>) => Promise<boolean>
}

export interface DeleterQuery {
  _id: _id
}

export interface DeleterOptions<ModelType> extends DeleterQuery {
  cb?: (data: DeleteResult) => any
  checkOldObject?: (oldObject: HydratedDocument<ModelType>) => Promise<boolean>
}

export class Controller extends TsoaController {
  async getter<ModelType>(model: Model<ModelType>, options: GetterOptions<ModelType> = {}): Promise<GETResponse<ModelType | ModelType[]>> {
    options.limit ||= 0
    options.page ||= 1
    options.filter ||= {}
    options.projection ||= {}

    const meta: Meta = {
      limit: options.limit,
      page: options.page,
      count: 1,
      countPages: 1
    }
    if (Object.keys(options.projection).length > 0 && options.additionalFields && options.allowedAdditionalFields) {
      for (const additionalField of options.additionalFields) {
        if (options.allowedAdditionalFields.indexOf(additionalField) !== -1) {
          //@ts-ignore
          if (options.projection[additionalField] === 0) {
            //@ts-ignore
            delete options.projection[additionalField]!
          } else {
            //@ts-ignore
            options.projection[additionalField] = 1
          }
        }
      }
    }
    if (options._id) {
      var conditions: any = Object.assign({ _id: options._id }, options.filter)
      const result = (await model.findOne(conditions, options.projection).lean()) as ModelType
      if (result !== null) {
        if (options.cb) {
          options.cb(result)
        }
        return { data: result, meta }
      } else {
        throw new Error(`No ${model.modelName} for _id: '${options._id}' found.`)
      }
    } else {
      var conditions: any = {}
      if (options.filterJSON) {
        conditions = JSON.parse(Buffer.from(options.filterJSON, 'base64').toString())
      }
      if (Object.keys(options.filter).length > 0) {
        if (!('$and' in conditions)) {
          conditions.$and = []
        }
        conditions.$and.push(options.filter)
      }
      const result = (await model.find(conditions, options.projection).lean()) as ModelType[]
      meta.count = result.length
      if (options.sortFn) {
        result.sort(options.sortFn)
      }
      var data: ModelType[]
      if (meta.limit > 0) {
        meta.countPages = Math.ceil(meta.count / meta.limit)
        data = result.slice(meta.limit * (meta.page - 1), meta.limit * meta.page)
      } else {
        meta.countPages = 1
        data = result
      }
      if (options.cb) {
        options.cb(data)
      }
      return { data, meta }
    }
  }

  async setter<ModelType extends { _id: string | Types.ObjectId }>(model: Model<ModelType>, options: SetterOptions<ModelType>) {
    if (options.requestBody._id) {
      var oldObject = await model.findOne({ _id: options.requestBody._id })
      if (!oldObject) {
        throw new Error(`No ${model.modelName} for _id: '${options.requestBody._id}' found.`)
      }
      if (options.checkOldObject && !(await options.checkOldObject(oldObject))) {
        throw new Error(`Not allowed to modify this ${model.modelName}`)
      }
      Object.assign(oldObject, options.requestBody)
      const result = (await oldObject.save()).toObject()
      if (options.cb) {
        options.cb(result)
      }
      return { message: 'alerts.successSaving', result }
    } else if (options.allowNew) {
      const result = (await new model(options.requestBody).save()).toObject()
      if (options.cb) {
        options.cb(result)
      }
      return { message: 'alerts.successSaving', result }
    } else {
      throw Error(`Not allowed to create a new ${model.modelName}`)
    }
  }

  async deleter<ModelType>(model: Model<ModelType>, options: DeleterOptions<ModelType>) {
    const doc = await model.findOne({ _id: options._id })
    if (!doc) {
      throw new Error(`No ${model.modelName} for _id: '${options._id}' found.`)
    }
    if (options.checkOldObject && !(await options.checkOldObject(doc))) {
      throw new Error(`Not allowed to delete this ${model.modelName}`)
    }
    const result = await doc.deleteOne()
    if (options.cb) {
      options.cb(result)
    }
    return result
  }
}
