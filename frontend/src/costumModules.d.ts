declare module 'mongoose' {
  namespace Types {
    type ObjectId = string
    type Buffer = Blob
  }
  namespace mongo {
    type Binary = Blob
  }
}
