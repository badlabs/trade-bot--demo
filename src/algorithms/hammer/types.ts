import {OrderDetails} from 'src/utils'
import {Job} from 'node-schedule'

export type HammerInput = {
    order: OrderDetails,
    date: Date,
    seconds_before: number
}
export type HammerState = {
    send_date: Date
}
export type HammerStopData = {
    job: Job
}