import {OperationType, OrderStatus, CommonDomain, 
    AbstractTranslator,
    GetCurrencyBalanceType,
    GetCurrencyType,
    GetOrderType,
    GetSecurityBalanceType,
    GetSecurityType} from '@badlabs/tradebot-core'
import {ExchangeClient} from './ExchangeClient'
import {Domain} from "../Domain";

export class Translator extends AbstractTranslator<ExchangeClient> {

    async currency(currency: GetCurrencyType<Domain>): Promise<GetCurrencyType<CommonDomain>> {
        return {
            name: currency,
            ticker: currency,
            exchangeTicker: currency
        }
    }

    async currencyBalance(currency: GetCurrencyBalanceType<Domain>): Promise<GetCurrencyBalanceType<CommonDomain>> {
        return {
            type: 'currency',
            currencyTicker: currency.currency,
            amount: currency.balance }
    }

    async security(security: GetSecurityType<Domain>): Promise<GetSecurityType<CommonDomain>> {
        if (!security.currency) throw new Error(`Security with ticker "${security.ticker}" have no currency`)
        return {
            currencyTicker: security.currency,
            name: security.name,
            price: await this.exchangeClient.infoModule.getSecurityLastPrice(security.ticker),
            ticker: security.ticker
        }
    }

    async securityBalance(security: GetSecurityBalanceType<Domain>): Promise<GetSecurityBalanceType<CommonDomain>> {
        return {
            type: 'security',
            amount: security.balance,
            securityTicker: security.ticker ?? 'undefined'
        }
    }

    async order(order: GetOrderType<Domain>): Promise<GetOrderType<CommonDomain>> {
        const security = await this.exchangeClient.infoModule.getSecurityByExchangeId(order.figi)
        return {
            operation: this.orderOperation(order),
            algorithmRunId: undefined,
            status: this.orderStatus(order),
            exchangeId: order.orderId,
            lots: order.requestedLots,
            price: order.price,
            securityTicker: security?.ticker || 'undefined'
        }
    }

    orderStatus(order: GetOrderType<Domain>): OrderStatus {
        switch (order.status) {
            case "New": return 'placed'
            case "Cancelled": return 'cancelled'
            case "Fill": return 'units_redeemed'
            case "PartiallyFill": return "units_redeemed"
            case "Replaced": return 'undefined'
            case "Rejected": return 'rejected'
            case "PendingNew": return 'to_be_processed'
            case "PendingReplace": return 'undefined'
            case 'PendingCancel': return 'cancelled'
            default: return 'undefined'
        }
    }

    orderOperation(order: GetOrderType<Domain>): OperationType {
        switch (order.operation) {
            case "Buy": return "limit_buy"
            case "BuyOrCancel": return "buy_or_cancel"
            case "MarketBuy": return 'market_buy'
            case "MarketSell": return  'market_sell'
            case "Sell": return 'limit_sell'
            case "SellOrCancel": return 'sell_or_cancel'
            default: return 'undefined'
        }
    }
}