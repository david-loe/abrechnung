interface FormField {
  field: string
  val: string | boolean | number
}

// biome-ignore lint/suspicious/noExplicitAny: generic function
export function objectToFormFields(object: any, fieldPrefix = '', formFields: FormField[] = []): FormField[] {
  for (const key in object) {
    const field = fieldPrefix ? `${fieldPrefix}[${key}]` : key
    if (object[key] === null || object[key] === undefined) {
    } else if (Array.isArray(object[key])) {
      for (let i = 0; i < object[key].length; i++) {
        objectToFormFields(object[key][i], `${field}[${i}]`, formFields)
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
