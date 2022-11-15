import {OperationType, OrderStatus, CommonDomain} from '../../src/types'
import {AbstractTranslator} from '../../src/abstract'
import {ExchangeClient} from './ExchangeClient'
import {
    GetCurrencyBalanceType,
    GetCurrencyType,
    GetOperationType, GetOrderType,
    GetPortfolioType,
    GetSecurityType
} from "../../src/types/extractors";
import {Domain} from "../Domain";

export class Translator extends AbstractTranslator<ExchangeClient> {

    async currency(currency: GetCurrencyType<Domain>): Promise<GetCurrencyType<CommonDomain>> {
        return { name: currency, ticker: currency }
    }

    async currencyBalance(currency: GetCurrencyBalanceType<Domain>): Promise<GetCurrencyBalanceType<CommonDomain>> {
        return { currency_ticker: currency.currency, balance: currency.balance }
    }

    async portfolio(portfolio: GetPortfolioType<Domain>): Promise<GetPortfolioType<CommonDomain>[]> {
        return portfolio.positions
            .map(position => {
                return {
                    security_ticker: position.ticker || 'undefined',
                    amount: position.balance
                }
            })
    }

    async security(security: GetSecurityType<Domain>): Promise<GetSecurityType<CommonDomain>> {
        if (!security.currency) throw new Error(`Security with ticker "${security.ticker}" have no currency`)
        return {
            currency_ticker: security.currency,
            name: security.name,
            price: await this.exchangeClient.infoModule.getSecurityLastPrice(security.ticker),
            ticker: security.ticker
        }
    }

    async operation(operation: GetOperationType<Domain>): Promise<GetOperationType<CommonDomain>> {
        const security = operation?.figi ?
            await this.exchangeClient.infoModule.getSecurityByExchangeId(operation?.figi) :
            null
        return {
            security_ticker: security?.ticker || null,
            amount: operation?.quantityExecuted || null,
            amount_requested: operation?.quantity || null,
            created_at: new Date(operation.date),
            exchange_id: operation.id,
            operation_type: operation.operationType === "Buy" ? 'limit_buy' :
                operation.operationType === "Sell" ? 'limit_sell' : 'undefined',
            price: operation?.price || 0,
            status: operation.status,
            updated_at: new Date(),
        }
    }

    async operations(operations: GetOperationType<Domain>[]): Promise<GetOperationType<CommonDomain>[]> {
        const securityIds = Array.from(new Set(operations.map(op => op.figi)))
        await Promise.all(securityIds.map(async (id) => {
            if (id)
                await this.exchangeClient.infoModule.getSecurityByExchangeId(id)
        }))
        return await Promise.all(operations.map(op => this.operation(op)))
    }

    async order(order: GetOrderType<Domain>): Promise<GetOrderType<CommonDomain>> {
        const security = await this.exchangeClient.infoModule.getSecurityByExchangeId(order.figi)
        return {
            operation_type: this.orderOperation(order),
            run_id: null,
            status_first: this.orderStatus(order),
            exchange_id: order.orderId,
            created_at: new Date(),
            amount: order.requestedLots,
            price: order.price,
            security_ticker: security?.ticker || 'undefined'
        }
    }

    orderStatus(order: GetOrderType<Domain>): OrderStatus {
        switch (order.status) {
            case "New": return 'new'
            case "Cancelled": return 'cancelled'
            case "Fill": return 'fill'
            case "PartiallyFill": return "partially_fill"
            case "Replaced": return 'replaced'
            case "Rejected": return 'rejected'
            case "PendingNew": return 'pending_new'
            case "PendingReplace": return 'pending_replace'
            case 'PendingCancel': return 'pending_cancel'
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