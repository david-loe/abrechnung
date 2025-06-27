/** biome-ignore-all lint/suspicious/noExplicitAny: to complex typing */

import { Schema, SchemaDefinition, SchemaTypeOptions } from 'mongoose'
import { Locale } from '../../common/types.js'
import i18n from '../i18n.js'

export function mongooseSchemaToVueformSchema(
  mongooseSchema: SchemaDefinition | any,
  language: Locale | readonly Locale[],
  assignment = {}
) {
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
  const rules: any[] = ['nullable']
  if (schemaType.rules && Array.isArray(schemaType.rules)) {
    rules.push(...schemaType.rules)
  }
  const vueformElement = Object.assign({ rules }, assignment) as any

  if (schemaType.required && schemaType.type !== Boolean) {
    const index = vueformElement.rules.indexOf('nullable')
    if (index !== -1) {
      vueformElement.rules.splice(index, 1)
    }
    if (!vueformElement.rules.some((v: any) => Boolean(v.required))) {
      vueformElement.rules.push('required')
    }
  }
  if (schemaType.min !== undefined) {
    vueformElement.rules.push(`min:${schemaType.min}`)
  }
  if (schemaType.max !== undefined) {
    vueformElement.rules.push(`max:${schemaType.max}`)
  }
  if (schemaType.validate && schemaType.validate instanceof RegExp) {
    vueformElement.rules.push(`regex:${schemaType.validate.toString()}`)
  }

  if (schemaType.description) {
    vueformElement.description = translate(schemaType.description, language)
  }

  if (schemaType.conditions) {
    vueformElement.conditions = schemaType.conditions
  }

  if (schemaType.label) {
    vueformElement.label = translate(schemaType.label, language)
  } else if (labelStr) {
    vueformElement.label = translate(`labels.${labelStr}`, language)
  }

  if (schemaType.info) {
    vueformElement.info = translate(schemaType.info, language)
  }
  if (isFlatType(schemaType.type) && schemaType.default !== undefined && schemaType.default !== null) {
    vueformElement.default = schemaType.default
  }

  if (!vueformElement.columns && isNotNested(schemaType)) {
    vueformElement.columns = { md: 6 }
  }

  if (schemaType.ref) {
    vueformElement.type = schemaType.ref.toString().toLowerCase()
    if (schemaType.ref !== 'DocumentFile') {
      vueformElement.placeholder = vueformElement.label
      vueformElement.label = undefined
    }
  } else if (schemaType.type === String) {
    vueformElement.placeholder = vueformElement.label
    vueformElement.label = undefined
    if (schemaType.enum && Array.isArray(schemaType.enum)) {
      vueformElement.type = 'select'
      const items: any = {}
      for (const value of schemaType.enum) {
        if (value) {
          items[value] = translate(`labels.${value}`, language)
        }
      }
      vueformElement.items = items
    } else if (schemaType.multiline) {
      vueformElement.type = 'textarea'
    } else {
      vueformElement.type = 'text'
    }
  } else if (schemaType.type === Number) {
    vueformElement.type = 'text'
    vueformElement.inputType = 'number'
    vueformElement.rules.push('numeric')
    vueformElement.attrs = { step: 'any' }
    vueformElement.forceNumbers = true

    vueformElement.placeholder = vueformElement.label
    vueformElement.label = undefined
  } else if (schemaType.type === Date) {
    vueformElement.type = 'date'
    vueformElement.time = Boolean(schemaType.time)
    vueformElement.placeholder = vueformElement.label
    vueformElement.label = undefined
  } else if (schemaType.type === Boolean) {
    vueformElement.type = 'checkbox'
    vueformElement.text = vueformElement.label
    vueformElement.label = undefined
  } else if (schemaType.type === Schema.Types.Mixed) {
    vueformElement.type = 'mixed'
  } else if (schemaType.type === Schema.Types.Map) {
    vueformElement.type = 'matrix'
    vueformElement.inputType = 'text'
    vueformElement.hideRows = true
    vueformElement.cols = ['Key', 'Value']
  } else if (Array.isArray(schemaType.type)) {
    if (schemaType.type[0].ref) {
      vueformElement.type = schemaType.type[0].ref.toString().toLowerCase()
      if (schemaType.type[0].ref === 'DocumentFile') {
        vueformElement.multiple = true
      } else {
        vueformElement.extendOptions = { mode: 'multiple' }
        vueformElement.placeholder = vueformElement.label
        vueformElement.label = undefined
      }
    } else if (!isFlatType(schemaType.type[0].type)) {
      // Array of Objects
      vueformElement.type = 'list'
      vueformElement.object = { schema: mongooseSchemaToVueformSchema(schemaType.type[0].type, language) }
    } else {
      vueformElement.type = 'list'
      vueformElement.element = mapSchemaTypeToVueformElement(schemaType.type[0], language, labelStr, { columns: 12 })
      vueformElement.element.placeholder = undefined
    }
    const index = vueformElement.rules.indexOf('required')
    if (index !== -1) {
      vueformElement.rules.splice(index, 1)
      vueformElement.rules.push('min:0')
    }
  } else if (typeof schemaType.type === 'object') {
    const keys = Object.keys(schemaType.type).filter((key) => !schemaType.type[key].hide)
    vueformElement.type = 'object'
    vueformElement.addClasses = { ElementLabel: { wrapper: 'h5' }, ElementLayout: { container: 'mb-2' } }
    if (keys.length > 1 && isNotNestedObject(schemaType.type)) {
      vueformElement.schema = mongooseSchemaToVueformSchema(schemaType.type, language, {
        columns: { xl: 12 / (keys.length > 3 ? 4 : keys.length), lg: 12 / (keys.length > 2 ? 3 : keys.length), sm: 6 }
      })
    } else {
      vueformElement.schema = mongooseSchemaToVueformSchema(schemaType.type, language)
    }
  } else {
    throw new Error(`No Type for conversion found for: ${labelStr} (${schemaType.type})`)
  }
  return vueformElement
}

function translate(str: string, language: Locale | readonly Locale[]) {
  if (typeof language === 'string') {
    return i18n.t(str, { lng: language })
  }
  const translation: { [key in Locale]?: string } = {}
  for (const lng of language) {
    translation[lng] = i18n.t(str, { lng })
  }
  return translation
}

function isNotNestedObject(mongooseSchema: SchemaDefinition | any) {
  return !Object.keys(mongooseSchema).some((path) => !isNotNested(mongooseSchema[path] as SchemaTypeOptions<any>))
}

function isNotNested(schemaType: SchemaTypeOptions<any>) {
  return isFlatType(schemaType.type) || typeof schemaType.type !== 'object' || schemaType.ref
}

function isFlatType(type: SchemaTypeOptions<any>['type']) {
  return type === Boolean || type === String || type === Number || type === Date || Array.isArray(type)
}
