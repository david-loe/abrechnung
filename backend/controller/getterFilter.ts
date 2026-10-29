import { Base64 } from 'abrechnung-common/utils/encoding.js'
import { Schema } from 'mongoose'
import { ValidationClientError } from './error.js'

const comparisonOperators = new Set([
  '$eq',
  '$ne',
  '$gt',
  '$gte',
  '$lt',
  '$lte',
  '$in',
  '$nin',
  '$exists',
  '$type',
  '$mod',
  '$regex',
  '$options',
  '$size'
])

function asObject(value: unknown) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return
  return value as Record<string, unknown>
}

function isWithin(path: string, parent: string) {
  return path === parent || path.startsWith(`${parent}.`)
}

export function parseGetterFilter(encoded: string, projection: Record<string, unknown>, schema: Pick<Schema, 'path'>) {
  let filter: unknown
  try {
    filter = JSON.parse(Base64.decode(encoded))
  } catch {
    throw new ValidationClientError('filterJSON must encode a JSON object')
  }

  const included = Object.keys(projection).filter((path) => projection[path] === 1 || projection[path] === true)
  const excluded = Object.keys(projection).filter((path) => projection[path] === 0 || projection[path] === false)
  // Explicitly including _id does not turn an exclusion projection into an inclusion projection.
  const inclusive = included.some((path) => path !== '_id') || (included.includes('_id') && excluded.length === 0)

  function normalizePath(path: string) {
    const parts: string[] = []
    for (const part of path.split('.')) {
      // Skip array indices, but retain numeric object keys such as workflow log states.
      if (/^\d+$/.test(part) && schema.path(parts.join('.'))?.instance === 'Array') continue
      parts.push(part)
    }
    return parts.join('.')
  }

  function isVisible(path: string, allowChildren = false) {
    const normalized = normalizePath(path)
    if (excluded.some((field) => isWithin(normalized, field) || (!allowChildren && isWithin(field, normalized)))) return false
    if (!inclusive) return true
    if (isWithin(normalized, '_id') && !excluded.includes('_id')) return true
    return included.some((field) => isWithin(normalized, field) || (allowChildren && isWithin(field, normalized)))
  }

  function requireVisible(path: string, allowChildren = false) {
    if (!isVisible(path, allowChildren)) {
      throw new ValidationClientError('Filter references a field excluded from the response', [
        { path, message: 'Field is not filterable' }
      ])
    }
  }

  function validatePredicate(value: unknown, path: string) {
    const predicate = asObject(value)
    if (!predicate || !Object.keys(predicate).some((key) => key.startsWith('$'))) {
      // An object here is an equality comparison against the entire stored value.
      requireVisible(path)
      return
    }
    for (const [operator, operand] of Object.entries(predicate)) {
      if (comparisonOperators.has(operator)) {
        requireVisible(path)
        if (['$in', '$nin'].includes(operator) && !Array.isArray(operand)) {
          throw new ValidationClientError(`${operator} requires an array`)
        }
      } else if (operator === '$not') {
        const negated = asObject(operand)
        if (!negated || Object.keys(negated).length === 0) throw new ValidationClientError('$not requires a predicate object')
        validatePredicate(operand, path)
      } else if (operator === '$elemMatch') {
        requireVisible(path, true)
        const element = asObject(operand)
        if (!element) throw new ValidationClientError('$elemMatch requires a predicate object')
        if (Object.keys(element).some((key) => comparisonOperators.has(key) || key === '$not' || key === '$elemMatch' || key === '$all')) {
          validatePredicate(operand, path)
        } else {
          validateFilter(operand, path)
        }
      } else if (operator === '$all') {
        if (!Array.isArray(operand)) throw new ValidationClientError('$all requires an array')
        if (operand.length === 0) requireVisible(path)
        for (const entry of operand) {
          const element = asObject(entry)
          if (element && Object.hasOwn(element, '$elemMatch')) {
            validatePredicate(entry, path)
          } else {
            requireVisible(path)
          }
        }
      } else {
        throw new ValidationClientError(`Unsupported filter operator: ${operator}`)
      }
    }
  }

  function validateFilter(value: unknown, prefix = '') {
    const filterObject = asObject(value)
    if (!filterObject) throw new ValidationClientError('Filter must be a JSON object')
    for (const [key, predicate] of Object.entries(filterObject)) {
      if (['$and', '$or', '$nor'].includes(key)) {
        if (!Array.isArray(predicate) || predicate.length === 0) throw new ValidationClientError(`${key} requires a nonempty array`)
        for (const entry of predicate) validateFilter(entry, prefix)
      } else if (key.startsWith('$')) {
        throw new ValidationClientError(`Unsupported filter operator: ${key}`)
      } else {
        if (key.split('.').some((part) => part.length === 0 || part.startsWith('$') || part.includes('\0'))) {
          throw new ValidationClientError('Invalid filter field path')
        }
        validatePredicate(predicate, prefix ? `${prefix}.${key}` : key)
      }
    }
  }

  validateFilter(filter)
  return filter as Record<string, unknown>
}
