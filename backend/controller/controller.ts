import { DeleteResult } from 'mongodb'
import { FilterQuery, HydratedDocument, Model, ProjectionType, Types } from 'mongoose'
import { Controller as TsoaController } from 'tsoa'
import { Base64 } from '../../common/scripts.js'
import { GETResponse, Meta, User, _id } from '../../common/types.js'
import { IdDocument } from './types.js'

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

export interface GetterOptions<ModelType> {
  query: GetterQuery<ModelType>
  filter?: FilterQuery<ModelType>
  projection?: ProjectionType<ModelType>
  sortFn?: (a: ModelType, b: ModelType) => number
  cb?: (data: ModelType | ModelType[]) => any
  allowedAdditionalFields?: (keyof ModelType)[]
}

/**
 * @format binary
 */
type Data = string

type SetterPartial<T, U extends string> = T extends object
  ? {
      [P in Exclude<keyof T, U>]?: T[P] extends
        | string
        | number
        | Date
        | boolean
        | null
        | undefined
        | Types.ObjectId
        | string[]
        | number[]
        | Date[]
        | boolean[]
        | Types.ObjectId[]
        ? T[P] | undefined | null
        : T[P] extends Types.Buffer | null | undefined
        ? Data | Types.Buffer | undefined
        : T[P] extends (infer ElementType)[] | null | undefined
        ? _SetterPartial1<ElementType, U>[] | undefined
        : T[P] extends { _id: infer idType extends _id | string } | null | undefined
        ? T[P] | IdDocument<idType> | null | undefined
        : _SetterPartial2<T[P], U> | undefined
    }
  : T

type _SetterPartial2<T, U extends string> = T extends object
  ? {
      [P in Exclude<keyof T, U>]?: T[P] extends
        | string
        | number
        | Date
        | boolean
        | null
        | undefined
        | Types.ObjectId
        | string[]
        | number[]
        | Date[]
        | boolean[]
        | Types.ObjectId[]
        ? T[P] | undefined | null
        : T[P] extends Types.Buffer | null | undefined
        ? Data | Types.Buffer | undefined
        : T[P] extends (infer ElementType)[] | null | undefined
        ? _SetterPartial1<ElementType, U>[] | undefined
        : T[P] extends { _id: infer idType extends _id | string } | null | undefined
        ? T[P] | IdDocument<idType> | null | undefined
        : _SetterPartial1<T[P], U> | undefined
    }
  : T

type _SetterPartial1<T, U extends string> = T extends object
  ? {
      [P in Exclude<keyof T, U>]?: T[P] extends
        | string
        | number
        | Date
        | boolean
        | null
        | undefined
        | Types.ObjectId
        | string[]
        | number[]
        | Date[]
        | boolean[]
        | Types.ObjectId[]
        ? T[P] | undefined | null
        : T[P] extends Types.Buffer | null | undefined
        ? Data | Types.Buffer | undefined
        : T[P] extends (infer ElementType)[] | null | undefined
        ? _SetterPartial1<ElementType, U>[] | undefined
        : T[P] extends { _id: infer idType extends _id | string } | null | undefined
        ? T[P] | IdDocument<idType> | null | undefined
        : T[P]
    }
  : T

export type NoPost = 'historic' | 'owner' | 'history' | 'createdAt' | 'updatedAt' | 'editor' | 'exchangeRate' | 'state'
export type SetterBody<ModelType> = SetterPartial<ModelType, NoPost>

export interface SetterOptions<ModelType, CheckType = ModelType, ModelMethods = any> {
  requestBody: SetterPartial<ModelType, NoPost>
  cb?: (data: CheckType) => any
  allowNew?: boolean
  checkOldObject?: (oldObject: HydratedDocument<CheckType> & ModelMethods) => Promise<boolean>
}

export interface SetterForArrayElementOptions<ModelType, ArrayElementType> extends SetterOptions<ArrayElementType, ModelType> {
  arrayElementKey: keyof ModelType
  parentId: _id
  sortFn?: (a: ArrayElementType, b: ArrayElementType) => number
}

export interface DeleterQuery {
  _id: _id
}

export interface DeleterOptions<ModelType, ModelMethods = any> extends DeleterQuery {
  cb?: (data: DeleteResult) => any
  checkOldObject?: (oldObject: HydratedDocument<ModelType> & ModelMethods) => Promise<boolean>
}

export interface DeleterForArrayElemetQuery extends DeleterQuery {
  parentId: _id
}

export interface DeleterForArrayElemetOptions<ModelType, ArrayElementType = any>
  extends DeleterOptions<ModelType>,
    DeleterForArrayElemetQuery {
  arrayElementKey: keyof ModelType
  beforeDelete?(element: ArrayElementType): Promise<any>
}

export class Controller extends TsoaController {
  async getter<ModelType>(model: Model<ModelType>, options: GetterOptions<ModelType>): Promise<GETResponse<ModelType | ModelType[]>> {
    options.query.limit ||= 0
    options.query.page ||= 1
    options.filter ||= {}
    options.projection ||= {}

    const meta: Meta = {
      limit: options.query.limit,
      page: options.query.page,
      count: 1,
      countPages: 1
    }

    if (Object.keys(options.projection).length > 0 && options.query.additionalFields && options.allowedAdditionalFields) {
      for (const additionalField of options.query.additionalFields) {
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
    if (options.query._id) {
      var conditions: any = Object.assign({ _id: options.query._id }, options.filter)
      const result = (await model.findOne(conditions, options.projection).lean()) as ModelType
      if (result !== null) {
        if (options.cb) {
          options.cb(result)
        }
        return { data: result, meta }
      } else {
        throw new Error(`No ${model.modelName} for _id: '${options.query._id}' found.`)
      }
    } else {
      var conditions: any = {}
      if (options.query.filterJSON) {
        conditions = JSON.parse(Base64.decode(options.query.filterJSON))
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

  async setter<ModelType extends { _id?: Types.ObjectId | string }>(model: Model<ModelType>, options: SetterOptions<ModelType>) {
    var result: ModelType
    if (options.requestBody._id) {
      var oldObject = await model.findOne({ _id: options.requestBody._id })
      if (!oldObject) {
        throw new Error(`No ${model.modelName} for _id: '${options.requestBody._id}' found.`)
      }
      if (options.checkOldObject && !(await options.checkOldObject(oldObject))) {
        throw new Error(`Not allowed to modify this ${model.modelName}`)
      }
      Object.assign(oldObject, options.requestBody)
      result = (await oldObject.save()).toObject()
    } else if (options.allowNew) {
      result = (await new model(options.requestBody).save()).toObject()
    } else {
      throw new Error(`Not allowed to create a new ${model.modelName}`)
    }
    if (options.cb) {
      options.cb(result)
    }
    return { message: 'alerts.successSaving', result }
  }

  async setterForArrayElement<
    ModelType extends { _id?: Types.ObjectId | string },
    ArrayElementType extends { _id?: Types.ObjectId | string }
  >(model: Model<ModelType>, options: SetterForArrayElementOptions<ModelType, ArrayElementType>) {
    const parentObject = await model.findOne({ _id: options.parentId })
    if (!parentObject) {
      throw new Error(`No ${model.modelName} for _id: '${options.parentId}' found.`)
    }
    if (options.checkOldObject && !(await options.checkOldObject(parentObject))) {
      throw new Error(`Not allowed to modify this ${model.modelName} - ${String(options.arrayElementKey)}`)
    }
    if (options.requestBody._id && options.requestBody._id !== '') {
      var found = false
      for (const arrayElement of parentObject[options.arrayElementKey] as Array<ArrayElementType>) {
        if ((arrayElement._id! as Types.ObjectId).equals(options.requestBody._id as string)) {
          found = true
          Object.assign(arrayElement, options.requestBody)
          break
        }
      }
      if (!found) {
        throw new Error(`No ${model.modelName} - ${String(options.arrayElementKey)} for _id: '${options.requestBody._id}' found.`)
      }
    } else if (options.allowNew) {
      ;(parentObject[options.arrayElementKey] as Array<any>).push(options.requestBody)
    } else {
      throw new Error(`Not allowed to create a new ${model.modelName} - ${String(options.arrayElementKey)}`)
    }
    if (options.sortFn) {
      ;(parentObject[options.arrayElementKey] as Array<ArrayElementType>).sort(options.sortFn)
    }
    parentObject.markModified(options.arrayElementKey)
    const result: ModelType = (await parentObject.save()).toObject()
    if (options.cb) {
      options.cb(result)
    }
    return { message: 'alerts.successSaving', result: result }
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

  async deleterForArrayElement<ModelType>(model: Model<ModelType>, options: DeleterForArrayElemetOptions<ModelType>) {
    const parentObject = await model.findOne({ _id: options.parentId })
    if (!parentObject) {
      throw new Error(`No ${model.modelName} for _id: '${options.parentId}' found.`)
    }
    if (options.checkOldObject && !(await options.checkOldObject(parentObject))) {
      throw new Error(`Not allowed to modify this ${model.modelName} - ${String(options.arrayElementKey)}`)
    }
    var found = false
    for (var i = 0; i < (parentObject[options.arrayElementKey] as Array<{ _id: _id }>).length; i++) {
      if ((parentObject[options.arrayElementKey] as Array<{ _id: _id }>)[i]._id.equals(options._id)) {
        found = true
        if (options.beforeDelete) {
          await options.beforeDelete((parentObject[options.arrayElementKey] as Array<any>)[i])
        }
        ;(parentObject[options.arrayElementKey] as Array<any>).splice(i, 1)
        break
      }
    }
    if (!found) {
      throw new Error(`No ${model.modelName} - ${String(options.arrayElementKey)} for _id: '${options._id}' found.`)
    }
    parentObject.markModified(options.arrayElementKey)
    const result: ModelType = (await parentObject.save()).toObject()
    if (options.cb) {
      options.cb({ acknowledged: true, deletedCount: 1 })
    }
    return { message: 'alerts.successDeleting', result: result }
  }

  checkOwner(requestUser: User) {
    return async function (oldObject: { owner: { _id: Types.ObjectId | string } }) {
      if (requestUser._id.equals(oldObject.owner._id)) {
        return true
      } else {
        throw new Error('alerts.request.unauthorized')
      }
    }
  }
}
