import { ExchangeAnalyzer } from '../../../src/modules'
import { AbstractTradeAlgorithm } from '../../../src/abstract'
import { addSecondsToDate } from '../../../src/utils'
import { CreateOrderOptions } from '../../../src/types'
import {ExchangeClient} from '../../exchange-client'
import {HammerInput, HammerState, HammerStopData} from './types'

export class HammerAlgorithm extends AbstractTradeAlgorithm<ExchangeClient, HammerInput, HammerState, HammerStopData> {
  get name(): string { return 'hammer' }
  get description(): string { return 'hammer' }
  get inputs(): any {
    return {
      order: 'OrderDetails',
      date: 'Date',
      seconds_before: 'number'
    }
  }

  constructor(analyzer: ExchangeAnalyzer<ExchangeClient>){
    super(analyzer)
  }

  async sendUntilNotRejected(order: CreateOrderOptions, run_id: number) {
    try {
      const status = await this.trader.sendOrder(order, run_id)
      if (status === 'rejected') await this.sendUntilNotRejected(order, run_id)
    }
    catch (e) { await this.fixError(run_id, e) }
  }

  async main(inputs: HammerInput) {
    const { order, seconds_before, date } = inputs
    const { trader } = this

    const send_date = addSecondsToDate(new Date(date), -seconds_before)

    const algorithmRun = await this.fixStart(inputs, { send_date })

    const job = trader.scheduleAction(async () => {
      await this.sendUntilNotRejected(order, algorithmRun.id)
      await this.fixFinish(algorithmRun.id)
    }, send_date)

    this.stopData.set(algorithmRun.id, { job })

    return algorithmRun
  }

  async continue(id: number) {
    const algorithmRun = await this.loadProgress(id)
    const { order } = JSON.parse(algorithmRun.inputs)
    const { send_date } = JSON.parse(algorithmRun.state)
    const { trader } = this

    const job = trader.scheduleAction(async () => {
      await this.sendUntilNotRejected(order, algorithmRun.id)
      await this.fixFinish(algorithmRun.id)
    }, new Date(send_date))

    this.stopData.set(algorithmRun.id, { job })

    return await this.fixContinue(id)
  }

  async stop(id: number) {
    const stopData = this.stopData.get(id)
    if (!stopData) throw new Error(`Algorithm run with id:${id} was not found.`)
    stopData?.job?.cancel()
    return await this.fixStop(id)
  }

}
