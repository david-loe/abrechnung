import { SchemaDefinition, SchemaTypeOptions } from 'mongoose'
import { Locale, emailRegex } from '../../common/types.js'
import { writeToDisk } from '../helper.js'
import i18n from '../i18n.js'

export async function generateForms(
  schemaMap: { [key: string]: SchemaDefinition<unknown> },
  language: Locale | readonly Locale[],
  outputFolderPath: string
) {
  const start = new Date()
  const prefix = outputFolderPath === '' ? '' : outputFolderPath + '/'
  const promises: Promise<void>[] = []
  for (const key in schemaMap) {
    const path = prefix + key + '.json'
    promises.push(writeToDisk(path, JSON.stringify(mongooseSchemaToVueformSchema(schemaMap[key], language))))
  }
  await Promise.all(promises)
  const time = (new Date().valueOf() - start.valueOf()) / 1000
  console.log(`Generated forms in ${time}s`)
}

function mongooseSchemaToVueformSchema(mongooseSchema: SchemaDefinition | any, language: Locale | readonly Locale[], assignment = {}) {
  const vueformSchema: any = {}
  for (const path in mongooseSchema) {
    const prop = mongooseSchema[path] as SchemaTypeOptions<any>
    vueformSchema[path] = mapSchemaTypeToVueformElement(prop, language, path, assignment)
  }

  return vueformSchema
}

function mapSchemaTypeToVueformElement(
  schemaType: SchemaTypeOptions<any>,
  language: Locale | readonly Locale[],
  labelStr?: string,
  assignment = {}
) {
  if (schemaType.hide) {
    return
  }
  const vueformElement = Object.assign({ rules: ['nullable'] }, assignment) as any

  if (schemaType.required) {
    vueformElement['rules'].splice(vueformElement['rules'].indexOf('nullable'), 1)
    vueformElement['rules'].push('required')
  }
  if (schemaType.min !== undefined) {
    vueformElement['rules'].push('min:' + schemaType.min)
  }
  if (schemaType.max !== undefined) {
    vueformElement['rules'].push('max:' + schemaType.max)
  }

  if (schemaType.label) {
    vueformElement['label'] = translate(schemaType.label, language)
  } else if (labelStr) {
    vueformElement['label'] = translate('labels.' + labelStr, language)
  }
  if (schemaType.info) {
    vueformElement['info'] = translate(schemaType.info, language)
  }
  if (isFlatType(schemaType.type) && schemaType.default !== undefined) {
    vueformElement['default'] = schemaType.default
  }

  if (schemaType.ref) {
    vueformElement['type'] = schemaType.ref.toString().toLowerCase()
  } else if (schemaType.type === String) {
    vueformElement['placeholder'] = vueformElement['label']
    delete vueformElement['label']
    if (schemaType.enum && Array.isArray(schemaType.enum)) {
      vueformElement['type'] = 'select'
      const items: any = {}
      for (const value of schemaType.enum) {
        items[value!] = translate('labels.' + value, language)
      }
      vueformElement['items'] = items
    } else {
      vueformElement['type'] = 'text'
      if (schemaType.validate === emailRegex) {
        vueformElement['rules'].push('email')
      }
    }
  } else if (schemaType.type === Number) {
    vueformElement['type'] = 'text'
    vueformElement['input-type'] = 'number'
    vueformElement['rules'].push('numeric')
    vueformElement['attrs'] = { step: 'any' }
    vueformElement['force-numbers'] = true

    vueformElement['placeholder'] = vueformElement['label']
    delete vueformElement['label']
  } else if (schemaType.type === Date) {
    vueformElement['type'] = 'date'
    vueformElement['time'] = Boolean(schemaType.time)
    vueformElement['placeholder'] = vueformElement['label']
    delete vueformElement['label']
  } else if (schemaType.type === Boolean) {
    vueformElement['type'] = 'checkbox'
    vueformElement['text'] = vueformElement['label']
    delete vueformElement['label']
  } else if (Array.isArray(schemaType.type)) {
    if (schemaType.type[0].type === undefined && typeof schemaType.type[0] === 'object') {
      vueformElement['type'] = 'list'
      vueformElement['object'] = mongooseSchemaToVueformSchema(schemaType.type[0], language)
    } else if (schemaType.type[0].ref) {
      vueformElement['type'] = schemaType.type[0].ref.toString().toLowerCase()
      vueformElement['multiple'] = true
    } else {
      vueformElement['type'] = 'list'
      vueformElement['element'] = mapSchemaTypeToVueformElement(schemaType.type[0], language, labelStr)
      delete vueformElement['element'].placeholder
    }
  } else if (typeof schemaType.type === 'object') {
    const keys = Object.keys(schemaType.type).filter((key) => !schemaType.type[key].hide)
    vueformElement['type'] = 'object'
    if (keys.length > 1 && isFlatObject(schemaType.type)) {
      vueformElement['schema'] = mongooseSchemaToVueformSchema(schemaType.type, language, {
        columns: { lg: { container: 12 / (keys.length == 2 ? 2 : 3) }, sm: { container: 6 } }
      })
    } else {
      vueformElement['schema'] = mongooseSchemaToVueformSchema(schemaType.type, language)
    }
  } else {
    throw new Error(`No Type for conversion found for: ${labelStr} (${schemaType.type})`)
  }
  return vueformElement
}

function translate(str: string, language: Locale | readonly Locale[]) {
  if (typeof language === 'string') {
    return i18n.t(str, { lng: language })
  } else {
    const translation: { [key in Locale]?: string } = {}
    for (const lng of language) {
      translation[lng] = i18n.t(str, { lng })
    }
    return translation
  }
}

function isCheckboxGroup(mongooseSchema: SchemaDefinition | any) {
  return !Object.keys(mongooseSchema).some((path) => (mongooseSchema[path] as SchemaTypeOptions<any>).type !== Boolean)
}

function isFlatObject(mongooseSchema: SchemaDefinition | any) {
  return !Object.keys(mongooseSchema).some((path) => !isFlatType((mongooseSchema[path] as SchemaTypeOptions<any>).type))
}

function isFlatType(type: SchemaTypeOptions<any>['type']) {
  return type === Boolean || type === String || type === Number || type === Date || Array.isArray(type)
}
