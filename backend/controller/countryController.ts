import { getSpecialLumpSumsList } from 'abrechnung-common/travel/lumpSums.js'
import { CountryCode, Country as ICountry, locales } from 'abrechnung-common/types.js'
import { Body, Delete, Get, Post, Queries, Query, Route, Security, Tags } from 'tsoa'
import Country, { countrySchema } from '../models/country.js'
import Travel from '../models/travel.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'

@Tags('Country')
@Route('')
@Security('cookieAuth', ['user'])
@Security('httpBearer', ['user'])
export class CountryController extends Controller {
  @Get('country')
  public async get(@Queries() query: GetterQuery<ICountry>) {
    return await this.getter(Country, { query })
  }
  @Get('specialLumpSums')
  public async getSpecialLumpSums() {
    const allCountries = await Country.find().lean()
    return { data: getSpecialLumpSumsList(allCountries) }
  }
}

@Tags('Country')
@Route('admin/country')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class CountryAdminController extends Controller {
  @Post()
  public async post(@Body() requestBody: SetterBody<ICountry>) {
    return await this.setter(Country, { requestBody: requestBody, allowNew: true })
  }
  @Post('bulk')
  public async postMany(@Body() requestBody: SetterBody<ICountry>[]) {
    return await this.insertMany(Country, { requestBody })
  }
  @Delete()
  public async delete(@Query() _id: CountryCode) {
    return await this.deleter(Country, {
      _id: _id,
      referenceChecks: [
        {
          model: Travel,
          paths: [
            'lastPlaceOfWork.country',
            'destinationPlace.country',
            'stages.startLocation.country',
            'stages.endLocation.country',
            'stages.midnightCountries.country'
          ],
          conditions: { historic: false }
        }
      ],
      minDocumentCount: 1
    })
  }
  @Get('form')
  public async getForm() {
    return { data: mongooseSchemaToVueformSchema(countrySchema().obj, locales) }
  }
}
