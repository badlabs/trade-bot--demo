import OpenAPI from '@tinkoff/invest-openapi-js-sdk'
import {AbstractExchangeClient} from '@badlabs/tradebot-core'
import { TradeModule } from './TradeModule'
import { InfoModule } from './InfoModule'
import {Translator} from "./Translator"
import {Domain} from "../Domain";

export class ExchangeClient extends AbstractExchangeClient<Domain, OpenAPI>{
  constructor(token: string){
    super({
      infoModule: new InfoModule(),
      tradeModule: new TradeModule(),
      translator: new Translator()
    }, new OpenAPI({
      apiURL: 'https://api-invest.tinkoff.ru/openapi/sandbox',
      socketURL: 'wss://api-invest.tinkoff.ru/openapi/md/v1/md-openapi/ws',
      secretToken: token
    }))
  }

  protected async initAccount(){
    const { api } = this
    // await api.sandboxClear()
    // await api.setCurrenciesBalance({ currency: 'USD', balance: 1_000_000 })
    // await api.setCurrenciesBalance({ currency: 'RUB', balance: 1_000_000 })
    // await api.setCurrenciesBalance({ currency: 'EUR', balance: 1_000_000 })
    // // @ts-ignore
    // const { figi: appleFigi } = await api.searchOne({ ticker: 'AAPL' })
    // await api.setPositionBalance({ balance: 100, figi: appleFigi })
    this.isAccountInitialized = true
  }

  async getPortfolio() {
    const { api } = this
    const result = await api.portfolio()
    return result.positions
  }

  async getCurrenciesBalance() {
    const { api } = this
    return (await api.portfolioCurrencies()).currencies
  }
}
