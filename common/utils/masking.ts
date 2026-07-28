interface MaskOptions {
  visibleStart?: number
  visibleEnd?: number
  character?: string
  maskedLength?: number
}

export function maskValue(value: string, options: MaskOptions = {}) {
  const prefixEnd = Math.min(Math.max(options.visibleStart ?? 0, 0), value.length)
  const suffixStart = Math.max(value.length - Math.max(options.visibleEnd ?? 0, 0), prefixEnd)
  const hiddenLength = Math.max(options.maskedLength ?? suffixStart - prefixEnd, 0)
  return `${value.slice(0, prefixEnd)}${(options.character ?? '*').repeat(hiddenLength)}${value.slice(suffixStart)}`
}
