var development = false
if (import.meta.env) {
  development = import.meta.env.MODE === 'development'
} else {
  development = process.env.NODE_ENV === 'development'
}

export function log(message: any, level: 'info' | 'warn' | 'error' = 'info') {
  if (development) {
    if (level === 'error') {
      console.error(message)
    } else if (level === 'warn') {
      console.warn(message)
    } else {
      console.log(message)
    }
  }
}
