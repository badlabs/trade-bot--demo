import {OrderDetails} from 'src/utils'
import {Job} from 'node-schedule'

export type SlicingInput = {
    order: OrderDetails,
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