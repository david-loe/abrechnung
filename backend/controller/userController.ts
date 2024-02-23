import { Route, Get, Tags, Security, Queries } from 'tsoa'
import { Controller, GetterQuery } from './controller.js'
import { Request as ExRequest, Response as ExResponse, NextFunction } from 'express'
import User from '../models/user.js'
import { User as IUser } from '../../common/types.js'

@Tags('User')
@Route('user')
@Security('cookieAuth')
export class UserController extends Controller {
  @Get()
  public getUser(@Queries() query: GetterQuery<IUser>) {
    return this.getter(User)
  }
}
