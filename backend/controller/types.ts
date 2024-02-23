import { DocumentFileType } from '../../common/types.js'

export interface File {
  type: DocumentFileType
  name: string
  /**
   * @format binary
   */
  data?: string
  _id?: string
}
