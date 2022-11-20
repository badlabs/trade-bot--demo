import { CreateOrderOptions, AbstractTradeModule, GetOrderType } from '@badlabs/tradebot-core'
import {Domain} from "../Domain";
import {ExchangeClient} from "./ExchangeClient";
import {getFigi, placedLimitOrderToOrder, placedMarketOrderToOrder} from "../utils";

export class TradeModule extends AbstractTradeModule<ExchangeClient>{

  public async sell({ ticker, lots, price }: CreateOrderOptions) {
    const { exchangeClient } = this
    const figi = await getFigi(ticker, exchangeClient)
    const placedOrder = await exchangeClient.api.limitOrder({figi, operation: 'Sell', lots, price})
    return placedLimitOrderToOrder(placedOrder, figi, price)
  }

  public async buy({ ticker, lots, price }: CreateOrderOptions) {
    const { exchangeClient } = this
    const figi = await getFigi(ticker, exchangeClient)
    const placedOrder = await exchangeClient.api.limitOrder({figi, operation: 'Buy', lots, price})
    return placedLimitOrderToOrder(placedOrder, figi, price)
  }

  public async marketSell({ ticker, lots }: CreateOrderOptions) {
    const { exchangeClient } = this
    const figi = await getFigi(ticker, exchangeClient)
    const placedOrder = await exchangeClient.api.marketOrder({figi, operation: 'Sell', lots})
    return placedMarketOrderToOrder(placedOrder, figi, ticker, this.exchangeClient)
  }

  public async marketBuy({ ticker, lots }: CreateOrderOptions) {
    const { exchangeClient } = this
    const figi = await getFigi(ticker, exchangeClient)
    const placedOrder = await exchangeClient.api.marketOrder({figi, operation: 'Buy', lots})
    return placedMarketOrderToOrder(placedOrder, figi, ticker, this.exchangeClient)
  }

  public async sellOrCancel(): Promise<GetOrderType<Domain>> {
    throw new Error("Method not implemented.");
  }

  public async buyOrCancel(): Promise<GetOrderType<Domain>> {
    throw new Error("Method not implemented.");
  }

}
