import {CreateOrderOptions} from '@badlabs/tradebot-core'
import {Job} from 'node-schedule'

export type SlicingInput = {
    order: CreateOrderOptions,
    parts: number,
    minutes: number
}
export type SlicingState = {
    orders_sended: number,
    lots_in_orders: number[]
}
export type SlicingStopData = {
    jobs: Job[]
}