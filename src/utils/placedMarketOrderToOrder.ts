import {PlacedMarketOrder} from "@tinkoff/invest-openapi-js-sdk";
import {GetOrderType} from "@badlabs/tradebot-core";
import {Domain} from "../Domain";
import {ExchangeClient} from "../exchange-client";

export async function placedMarketOrderToOrder(order: PlacedMarketOrder,
                                               figi: string,
                                               ticker: string,
                                               exchangeClient: ExchangeClient): Promise<GetOrderType<Domain>> {
    const price = await exchangeClient.infoModule.getSecurityLastPrice(ticker)
    return {
        figi,
        operation: order.operation,
        price,
        status: order.status,
        orderId: order.orderId,
        requestedLots: order.requestedLots,
        type: "Market",
        executedLots: order.executedLots
    }
}