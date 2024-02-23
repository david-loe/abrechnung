import { Controller as TsoaController } from 'tsoa'
import { Model, Types, Schema, SchemaTypeOptions, FilterQuery, ProjectionType } from 'mongoose'
import { GETResponse, Meta } from '../../common/types.js'

type Filter<ModelType> = {
  [key in keyof ModelType]: string
}

interface GetterQuerySimple {
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
  /**
   * @pattern ^[0-9a-fA-F]{24}$
   */
  id?: string
}

export interface GetterQuery<ModelType> extends GetterQuerySimple {
  additionalFields?: (keyof ModelType)[]
  filterJSON?: string
}

interface GetterOptions<ModelType> extends GetterQuerySimple {
  filter?: FilterQuery<ModelType>
  projection?: ProjectionType<ModelType>
  sortFn?: (a: ModelType, b: ModelType) => number
  cb?: (data: ModelType | ModelType[]) => any
}

export class Controller extends TsoaController {
  async getter<ModelType>(model: Model<ModelType>, options: GetterOptions<ModelType> = {}) {
    options.limit ||= 0
    options.page ||= 1
    options.filter ||= {}
    options.projection ||= {}

    const meta: Meta = {
      limit: options.limit,
      page: options.page,
      count: 0,
      countPages: 0
    }
    if (options.id) {
      var conditions: any = Object.assign({ _id: options.id }, options.filter)
      const result1 = await model.findOne(conditions, options.projection).lean()
      if (result1 != null) {
        meta.count = 1
        meta.countPages = 1
        let response: GETResponse<ModelType> = { data: result1, meta }
        return response
      } else {
        throw new Error(`No document with id '${options.id}' found`)
      }
    } else {
      var conditions: any = {}
      const fields = Object.keys(model.schema.obj)
      for (const field of Object.keys(req.query)) {
        if (field.indexOf('.') !== -1) {
          if (fields.indexOf(field.split('.')[0]) === -1) {
            continue
          }
        } else {
          if (fields.indexOf(field) === -1) {
            continue
          }
        }
        if (req.query[field] && (req.query[field] as string).length > 0) {
          var qFilter: any = {}
          if (field.indexOf('name') !== -1) {
            qFilter[field] = { $regex: req.query[field], $options: 'i' }
          } else {
            qFilter[field] = req.query[field]
          }
          if (!('$and' in conditions)) {
            conditions.$and = []
          }
          conditions.$and.push(qFilter)
        }
      }
      if (Object.keys(preConditions).length > 0) {
        if (!('$and' in conditions)) {
          conditions.$and = []
        }
        conditions.$and.push(preConditions)
      }
      const result = await model.find(conditions, select).lean()
      meta.count = result.length
      meta.countPages = Math.ceil(meta.count / meta.limit)
      if (result != null) {
        if (sortFn) {
          result.sort(sortFn)
        }
        const data = result.slice(meta.limit * (meta.page - 1), meta.limit * meta.page)
        let response: GETResponse<any[]> = { meta, data }
        res.send(response)
        if (cb) cb(data)
      } else {
        res.status(404).send({ message: 'No content' })
      }
    }
    return await model.find(options.filter, options.projection).lean()
  }
}
