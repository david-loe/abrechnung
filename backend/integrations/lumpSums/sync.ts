import { addLumpSumsToCountries, LumpSumsJSON } from 'abrechnung-common/travel/lumpSums.js'
import { Country as ICountry } from 'abrechnung-common/types.js'
import axios from 'axios'
import { HydratedDocument } from 'mongoose'
import { logger } from '../../logger.js'
import Country from '../../models/country.js'

export async function syncLumpSums() {
  const pauschbetragApi = 'https://cdn.jsdelivr.net/npm/pauschbetrag-api@1/ALL.json'
  try {
    const res = await axios.get<LumpSumsJSON>(pauschbetragApi)
    if (res.status === 200) {
      await addLumpSumsToCountries(
        res.data,
        (id) => Country.findOne({ _id: id }),
        async (c) => {
          ;(c as HydratedDocument<ICountry>).markModified('lumpSums')
          return (c as HydratedDocument<ICountry>).save()
        }
      )
    }
  } catch (error) {
    logger.error(`Unable to fetch lump sums from: ${pauschbetragApi}`, 'error')
    logger.error(error, 'error')
  }
}
