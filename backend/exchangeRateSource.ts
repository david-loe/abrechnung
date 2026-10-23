import { ExchangeRateProviderName } from 'abrechnung-common/types.js'
import { GetRateFn } from 'abrechnung-common/utils/currencyConverter.js'
import { sources as upstreamSources } from 'abrechnung-common/utils/exchangeRateSource.js'
import axios from 'axios'
import { logger } from './logger.js'

function handleProviderOutages(provider: ExchangeRateProviderName) {
  const getRate: GetRateFn = async (date, from, to) => {
    try {
      return await upstreamSources[provider](date, from, to)
    } catch (error) {
      if (!axios.isAxiosError(error) || (!error.response && !error.request && error.code !== 'ERR_CANCELED')) {
        throw error
      }
      logger.warn('Exchange rate provider unavailable', {
        provider,
        date: date.toISOString(),
        code: error.code,
        status: error.response?.status
      })
      return { rate: null, rates: null }
    }
  }
  return getRate
}

export const sources: Record<ExchangeRateProviderName, GetRateFn> = {
  Frankfurter: handleProviderOutages('Frankfurter'),
  InforEuro: handleProviderOutages('InforEuro')
}
