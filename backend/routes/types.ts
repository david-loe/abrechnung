import { Request, Response } from 'express'
import { User } from '../../common/types.js'

export interface RequestWithUser extends Request {
  user: User
}
