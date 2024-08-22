import { Body, Delete, Get, Post, Queries, Query, Route, Security, Tags } from 'tsoa'
import { Country as ICountry, _id } from '../../common/types.js'
import Country from '../models/country.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'

@Tags('Country')
@Route('')
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
        if (lumpSum.specials) {
          for (const special of lumpSum.specials) {
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
@Route('admin/country')
@Security('cookieAuth', ['admin'])
export class CountryAdminController extends Controller {
  @Post()
  public async postCountry(@Body() requestBody: SetterBody<ICountry>) {
    return await this.setter(Country, { requestBody: requestBody, allowNew: true })
  }
  @Post('bulk')
  public async postManyProjects(@Body() requestBody: SetterBody<ICountry>[]) {
    return await this.insertMany(Country, { requestBody })
  }
  @Delete()
  public async deleteCountry(@Query() _id: _id) {
    return await this.deleter(Country, { _id: _id })
  }
}
