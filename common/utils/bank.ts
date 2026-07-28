import { maskValue } from './masking.js'

export function normalizeIban(value: string) {
  return value.replace(/\s+/g, '').toUpperCase()
}

export function isValidIban(value: string) {
  const iban = normalizeIban(value)
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false

  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`
  let remainder = 0
  for (const character of rearranged) {
    const numeric = character >= 'A' && character <= 'Z' ? String(character.charCodeAt(0) - 55) : character
    for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}

export function normalizeBic(value: string) {
  return value.replace(/\s+/g, '').toUpperCase()
}

export function isValidBic(value: string) {
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(normalizeBic(value))
}

export function maskIban(value: string) {
  const iban = normalizeIban(value)
  return maskValue(iban, { visibleStart: 2, visibleEnd: 4, character: '•' })
}
