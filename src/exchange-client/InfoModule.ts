import { ExchangeClient } from './ExchangeClient'
import {AbstractInfoModule, GetCurrencyType, GetSecurityType} from '@badlabs/tradebot-core'
import {Domain} from "../Domain";

const securitiesCache = new Map<string, GetSecurityType<ExchangeClient>>()

export class InfoModule extends AbstractInfoModule<ExchangeClient>{

  async getCurrencies(): Promise<GetCurrencyType<ExchangeClient>[]> {
    return [ 'CHF', "CNY", 'EUR', "GBP", "HKD", "JPY", "RUB", "TRY", "USD" ]
  }

  async getSecurityLastPrice(ticker: string) {
    const { exchangeClient } = this
    const security = await this.getSecurity(ticker, true)
    const orderBook = await exchangeClient.api.orderbookGet({ figi: security?.figi || '' })
    return orderBook?.lastPrice || 0
  }

  async getSecurityCurrency(ticker: string) {
    const { getSecurity } = this
    const security = await getSecurity(ticker)
    if (!security) throw new Error(`Security with ticker "${ticker}" was not found`)
    if (!security.currency) throw new Error(`Security with ticker "${ticker}" has no currency`)
    return security.currency
  }

  async getSecurityName(ticker: string) {
    const { getSecurity } = this
    const security = await getSecurity(ticker)
    return security?.name || ''
  }

  async getSecurity(ticker: string, ignoreCache: boolean = false) {
    const { exchangeClient } = this
    if (!securitiesCache.has(ticker) || ignoreCache){
      const security = await exchangeClient.api.searchOne({ ticker })
      if (!security) return null
      securitiesCache.set(ticker, security)
      return security
    }
    return securitiesCache.get(ticker) ?? null
  }

  async getSecurityByExchangeId(id: string, ignoreCache: boolean = false) {
    const { exchangeClient } = this
    if (!securitiesCache.has(id) || ignoreCache){
      const security = await exchangeClient.api.searchOne({ figi: id })
      if (!security) return null
      securitiesCache.set(id, security)
      return security
    }
    return securitiesCache.get(id) ?? null
  }
}
