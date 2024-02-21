import {
  Body,
  Controller,
  Post,
  Route,
  SuccessResponse,
  Request,
  Get,
  Query,
} from "tsoa";
import User, { UserDoc } from "../models/user.js";
import { Request as ExRequest } from 'express'
import passport from "passport";
import magiclogin from '../authStrategies/magiclogin.js'

function addAdminIfNone(user: UserDoc) {
  User.find({ 'access.admin': true }).then((docs) => {
    if (docs.length == 0) {
      user.access.admin = true
      user.markModified('access')
      user.save()
    }
  })
}

@Route("auth")
export class AuthController extends Controller {
  /**
   * Send a magiclogin email to the destination email address.
   */
  @Post('magiclogin')
  public async magiclogin(
    @Body() requestBody: { destination: string },
    @Request() req: ExRequest
  ): Promise<void> {
    const user = await User.findOne({ 'fk.magiclogin': requestBody.destination })
    if (user) {
      // using a dummy res
      magiclogin.send(req, { status: (status: number) => { return (body: any) => null }, json: (body: any) => { if (!body.success) { throw new Error(body.error) } } } as any)
    } else {
      throw new Error(`No magiclogin user found for e-mail: ${requestBody.destination}`)
    }
  }

  @Get('magiclogin/callback')
  @SuccessResponse(302, `Redirecting to ${process.env.FRONTEND_URL}`)
  public async magicloginCallback(
    @Query() token: string,
    @Request() req: ExRequest
  ): Promise<void> {
    passport.authenticate('magiclogin')
    req.res?.redirect(process.env.VITE_FRONTEND_URL)
  }
}