import {DomainTemplate} from "@badlabs/tradebot-core";
import {
    Currency,
    CurrencyPosition,
    MarketInstrument,
    PortfolioPosition
} from "@tinkoff/invest-openapi-js-sdk";
import {Order as ImportedOrder} from "@tinkoff/invest-openapi-js-sdk";

type Order = Omit<ImportedOrder, 'operation'> &
    { operation: 'Buy'| 'Sell' |
            'MarketBuy' | 'MarketSell' |
            'BuyOrCancel' | 'SellOrCancel' }

export type Domain = DomainTemplate<Currency, CurrencyPosition, MarketInstrument, PortfolioPosition, Order>