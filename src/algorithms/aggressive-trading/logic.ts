import { ExchangeAnalyzer } from '../../../src/modules'
import { AbstractTradeAlgorithm } from '../../../src/abstract'
import {ExchangeClient} from '../../exchange-client'
import {AggressiveTraderInput, AggressiveTraderState, AggressiveTraderStopData} from './types'
import {Job, scheduleJob} from 'node-schedule'
import {GetSecurityType} from "../../../src/types/extractors";
import {CommonDomain} from "../../../src/types";

export class AggressiveTradingAlgorithm
    extends AbstractTradeAlgorithm<ExchangeClient, AggressiveTraderInput, AggressiveTraderState, AggressiveTraderStopData> {
  get name(): string { return 'aggressive-trading' }
  get description(): string { return 'aggressive-trading' }
  get inputs(): any {
    return {
      security_ticker: 'string'
    }
  }

  constructor(analyzer: ExchangeAnalyzer<ExchangeClient>){
    super(analyzer)
  }

  private async followSecurity(securityTicker: string): Promise<GetSecurityType<CommonDomain>> {
    const { analyzer, watcher } = this
    let security: GetSecurityType<CommonDomain> = await watcher.getSecurity(securityTicker)
    security = (await analyzer.addSecurities(security))[0]
    await analyzer.followSecurity(security.ticker)
    return security
  }

  private async watchSecurity(securityTicker: string, runId: number, state: AggressiveTraderState): Promise<Job | undefined> {
    const { analyzer, watcher, trader } = this
    let security: GetSecurityType<CommonDomain>
    try {
      security = await this.followSecurity(securityTicker)
    }
    catch (e) {
      await this.fixError(runId, e)
      return
    }
    let lastPrice: number = security.price
    let oldPrice: number = lastPrice
    return scheduleJob('*/15 * * * *', async () => {
      try {
        const updatedSecurities = await analyzer.updateFollowedSecurities()
        const updatedSecurity = updatedSecurities.find(s => s.ticker === securityTicker)
        if (!updatedSecurity) {
          oldPrice = lastPrice
          lastPrice = (await this.followSecurity(securityTicker)).price
        } else {
          oldPrice = lastPrice
          lastPrice = updatedSecurity.price
        }
        state.last_price = lastPrice
        await this.saveProgress(runId, state)
        const priceDiffPercents = (oldPrice - lastPrice) / oldPrice
        state.last_diff_percents = priceDiffPercents * 100
        state.last_diff_currency = oldPrice - lastPrice
        if (Math.abs(priceDiffPercents) > 0.005){
          if (priceDiffPercents > 0) {
            const {currencies} = await analyzer.tradebot.exchangeClient.api.portfolioCurrencies()
            const currency = currencies.find(c => c.currency === security.currency_ticker)
            if (!currency) return
            if (Math.ceil(lastPrice) * 3 < currency.balance) {
              await trader.sendOrder({
                ticker: securityTicker,
                price: lastPrice,
                lots: Math.floor(currency.balance / 3 / lastPrice),
                operation: "market_buy"
              }, runId)
              state.bought += Math.floor(currency.balance / 3 / lastPrice)
            }
          }
          else {
            const portfolioPosition = (await analyzer.getPortfolio()).find(p => p.security_ticker === securityTicker)
            if (!portfolioPosition) return
            await trader.sendOrder({
              ticker: securityTicker,
              price: lastPrice,
              lots: Math.ceil(portfolioPosition.amount * 2 / 3),
              operation: "market_sell"
            }, runId)
            state.sold += Math.ceil(portfolioPosition.amount * 2 / 3)
          }
          await this.saveProgress(runId, state)
        }
      }
      catch (e) { await this.fixError(runId, e) }
    })
  }

  async main({security_ticker}: AggressiveTraderInput) {
    const { watcher } = this
    const security = await watcher.getSecurity(security_ticker)
    const state: AggressiveTraderState = {
      last_price: security.price,
      last_diff_currency: 0,
      last_diff_percents: 0,
      sold: 0,
      bought: 0
    }
    const algorithmRun = await this.fixStart({security_ticker}, state)
    const job = await this.watchSecurity(security_ticker, algorithmRun.id, state)
    if (job) this.stopData.set(algorithmRun.id, { job })


    return algorithmRun
  }

  async continue(id: number) {
    const algorithmRun = await this.loadProgress(id)
    const { security_ticker }: AggressiveTraderInput = JSON.parse(algorithmRun.inputs)
    const state: AggressiveTraderState = JSON.parse(algorithmRun.state)
    const job = await this.watchSecurity(security_ticker, algorithmRun.id, state)
    if (job) this.stopData.set(algorithmRun.id, { job })

    return await this.fixContinue(id)
  }

  async stop(id: number) {
    const stopData = this.stopData.get(id)
    if (!stopData) throw new Error(`Algorithm run with id:${id} was not found.`)
    stopData.job.cancel()
    return await this.fixStop(id)
  }

}
