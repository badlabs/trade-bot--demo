import {PlacedLimitOrder} from "@tinkoff/invest-openapi-js-sdk";
import {GetOrderType} from "../../src/types/extractors";
import {Domain} from "../Domain";

export function placedLimitOrderToOrder(order: PlacedLimitOrder, figi: string, price: number): GetOrderType<Domain> {
    return {
        figi,
        operation: order.operation,
        price,
        status: order.status,
        orderId: order.orderId,
        requestedLots: order.requestedLots,
        type: "Limit",
        executedLots: order.executedLots
    }
}