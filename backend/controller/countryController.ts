import { Route, Get, Tags, Security, Queries, Post, Body, Delete, Query } from 'tsoa'
import { Controller, GetterQuery, SetterBody } from './controller.js'
import Country from '../models/country.js'
import { Country as ICountry, _id } from '../../common/types.js'

@Tags('Country')
@Route('api/')
@Security('cookieAuth', ['user'])
export class CountryController extends Controller {
  @Get('country')
  public async getCountry(@Queries() query: GetterQuery<ICountry>) {
    return await this.getter(Country, {
      query,
      projection: { lumpSums: 0, lumpSumsFrom: 0 },
      allowedAdditionalFields: ['lumpSums', 'lumpSumsFrom']
    })
  }
  @Get('specialLumpSums')
  public async getSpecialLumpSums() {
    const allCountries = await Country.find().lean()
    const specialCountries: { [key: string]: string[] } = {}
    for (const c of allCountries) {
      const specials: string[] = []
      for (const lumpSum of c.lumpSums) {
        if (lumpSum.spezials) {
          for (const special of lumpSum.spezials) {
            if (specials.indexOf(special.city) === -1) {
              specials.push(special.city)
            }
          }
        }
      }
      if (specials.length > 0) {
        specialCountries[c._id] = specials
      }
    }
    return { data: specialCountries }
  }
}

@Tags('Admin', 'Country')
@Route('api/admin/country')
@Security('cookieAuth', ['admin'])
export class CountryAdminController extends Controller {
  @Post()
  public async postCountry(@Body() requestBody: SetterBody<ICountry>) {
    return await this.setter(Country, { requestBody: requestBody })
  }
  @Delete()
  public async deleteCountry(@Query() _id: _id) {
    return await this.deleter(Country, { _id: _id })
  }
}
