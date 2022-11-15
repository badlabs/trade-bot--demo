import { ExchangeAnalyzer } from '../../../src/modules'
import { AbstractTradeAlgorithm } from '../../../src/abstract'
import {addMinutesToDate, addSecondsToDate} from '../../../src/utils'
import {ExchangeClient} from '../../exchange-client'
import {SlicingInput, SlicingState, SlicingStopData} from './types'

export class SlicingAlgorithm extends AbstractTradeAlgorithm<ExchangeClient, SlicingInput, SlicingState, SlicingStopData> {
  get name(): string { return 'slicing' }
  get description(): string { return 'slicing' }
  get inputs(): any {
    return {
      order: 'OrderDetails',
      parts: 'number',
      minutes: 'number'
    }
  }

  constructor(analyzer: ExchangeAnalyzer<ExchangeClient>){
    super(analyzer)
  }

  async main(inputs: SlicingInput) {
    const { order, parts, minutes } = inputs
    const { trader } = this
    const lotsInOrder: number = Math.floor(order.lots / parts)
    let lastLots: number =  order.lots % parts
    const lotsInOrders: number[] = []

    for (let i = 0; i < parts; i++) {
      lotsInOrders.push(lotsInOrder)
    }
    for (let i = lotsInOrders.length - 1; lastLots > 0; i--){
      lotsInOrders[i] += 1
      lastLots -= 1
    }

    const algorithmRun = await this.fixStart(inputs, { orders_sended: 0, lots_in_orders: lotsInOrders })
    const stopData: SlicingStopData = { jobs: [] }

    const startPoint = addSecondsToDate(new Date(), 10)
    for (let i = 0; i < lotsInOrders.length; i++) {
      const lots = lotsInOrders[i]
      const sendOrderTime: Date = addMinutesToDate(startPoint, minutes/(parts - 1) * i)
      const newJob = trader.scheduleAction(async () => {
        try {
          await trader.sendOrder({...order, lots}, algorithmRun.id)
          if (i < lotsInOrders.length - 1) await this.saveProgress(algorithmRun.id, { orders_sended: i + 1, lots_in_orders: lotsInOrders })
          else await this.fixFinish(algorithmRun.id)
        }
        catch (e) { await this.fixError(algorithmRun.id, e) }
      }, sendOrderTime)
      stopData.jobs.push(newJob)
    }
    this.stopData.set(algorithmRun.id, stopData)

    return algorithmRun
  }
  async continue(id: number) {
    const algorithmRun = await this.loadProgress(id)
    const { order, parts, minutes } = JSON.parse(algorithmRun.inputs)
    const { orders_sended, lots_in_orders } = JSON.parse(algorithmRun.state)
    const { trader } = this
    const stopData: SlicingStopData = { jobs: [] }

    const minutesRemain = minutes * (1 - orders_sended / parts)
    const startPoint = addSecondsToDate(new Date(), 10)
    for (let i = orders_sended; i < lots_in_orders.length; i++) {
      const lots = lots_in_orders[i]
      const sendOrderTime: Date = addMinutesToDate(startPoint, minutesRemain/(parts - 1) * i)
      const newJob = trader.scheduleAction(async () => {
        try {
          await trader.sendOrder({...order, lots}, algorithmRun.id)
          if (i < lots_in_orders.length - 1) await this.saveProgress(algorithmRun.id, { orders_sended: i + 1, lots_in_orders })
          else await this.fixFinish(algorithmRun.id)
        }
        catch (e) { await this.fixError(algorithmRun.id, e) }
      }, sendOrderTime)
      stopData.jobs.push(newJob)
    }
    this.stopData.set(algorithmRun.id, stopData)
    return await this.fixContinue(id)
  }

  async stop(id: number) {
    const stopData = this.stopData.get(id)
    if (!stopData) throw new Error(`Algorithm run with id:${id} was not found.`)
    stopData.jobs.forEach(job => {
      job.cancel()
    })
    return await this.fixStop(id)
  }

}
