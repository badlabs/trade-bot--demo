import {DomainTemplate} from "../src/types";
import {Currency, CurrencyPosition, MarketInstrument, Operation, Portfolio} from "@tinkoff/invest-openapi-js-sdk";
import {Order as ImportedOrder} from "@tinkoff/invest-openapi-js-sdk";

type Order = Omit<ImportedOrder, 'operation'> &
    { operation: 'Buy'| 'Sell' |
            'MarketBuy' | 'MarketSell' |
            'BuyOrCancel' | 'SellOrCancel' }

export type Domain = DomainTemplate<
    Currency, CurrencyPosition,
    MarketInstrument, Order,
    Portfolio, Operation>