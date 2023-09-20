interface FormField {
  field: string
  val: string | boolean | number
}

export function objectToFormFields(object: any, fieldPrefix: string = '', formFields: FormField[] = []): FormField[] {
  for (const key in object) {
    var field = fieldPrefix ? fieldPrefix + '[' + key + ']' : key
    if (object[key] === null || object[key] === undefined) {
      continue
    } else if (Array.isArray(object[key])) {
      for (var i = 0; i < object[key].length; i++) {
        objectToFormFields(object[key][i], field + '[' + i + ']', formFields)
      }
    } else if (object[key] instanceof Date) {
      formFields.push({ field, val: object[key].toJSON() })
    } else if (typeof object[key] === 'object') {
      objectToFormFields(object[key], field, formFields)
    } else {
      formFields.push({ field, val: object[key] })
    }
  }
  return formFields
}
