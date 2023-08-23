declare module '*.woff2'

declare module 'mongoose' {
  namespace Types {
    type ObjectId = string
    type Buffer = Blob
  }
}
