import {Job} from 'node-schedule'

export type AggressiveTraderInput = {
    security_ticker: string
}
export type AggressiveTraderState = {
    last_price: number,
    last_diff_currency: number,
    last_diff_percents: number,
    bought: number,
    sold: number
}
export type AggressiveTraderStopData = {
    job: Job
}