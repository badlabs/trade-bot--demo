import {addDaysToDate} from "../../utils";
import {
    GetOperationsOptions,
    GetOrdersOptions,
    OperationType,
    CommonDomain} from "../../types";
import {OperationId} from "../../types/db";
import {GetSecurityType, GetCurrencyType, GetCurrencyBalanceType,
    GetPortfolioType, GetOperationType, GetOrderType} from "../../types/extractors";
import {AbstractTradeAlgorithm, AbstractExchangeClient} from 'src/abstract'
import {ExchangeTrader, ExchangeWatcher} from 'src/modules'
import {TradeAlgorithmsEngine} from './trade-algorithms-engine'
import {TradeBot} from 'src/TradeBot'
import {
    PrismaClient,
    D_FollowedSecurity,
    D_Algorithm,
    D_AlgorithmRun
} from '@prisma/client'
import {scheduleJob} from 'node-schedule'

const db = new PrismaClient()

export class ExchangeAnalyzer<ExchangeClient extends AbstractExchangeClient> {
    readonly tradebot: TradeBot<ExchangeClient>
    get trader(): ExchangeTrader<ExchangeClient> { return this.tradebot.trader }
    get watcher(): ExchangeWatcher<ExchangeClient> { return this.tradebot.watcher }
    readonly tradeAlgos: TradeAlgorithmsEngine<ExchangeClient>

    constructor(tradebot: TradeBot<ExchangeClient>,
                initAlgorithmsCallback:
                    (analyzer: ExchangeAnalyzer<ExchangeClient>) => AbstractTradeAlgorithm<ExchangeClient>[]
                    = () => []
    ) {
        this.tradebot = tradebot
        this.tradeAlgos = new TradeAlgorithmsEngine<ExchangeClient>(this, initAlgorithmsCallback)
        this.saveAlgorithms()
        this.initUpdaters()
    }

    private async initUpdaters(){
        scheduleJob('updateBalance', '*/1 * * * *', () => {
            this.tradebot.logger.log('Updating balance...')
            this.updateCurrenciesBalance()
        })
        scheduleJob('updatePortfolio', '*/1 * * * *', () => {
            this.tradebot.logger.log('Updating portfolio...')
            this.updatePortfolio()
        })
        scheduleJob('updateFollowedSecurities', '*/1 * * * *', () => {
            this.tradebot.logger.log('Updating followed securities...')
            this.updateFollowedSecurities()
        })
        scheduleJob('updateOperations', '*/30 * * * *', () => {
            this.tradebot.logger.log('Updating operations...')
            this.updateOperationsAll()
        })
    }

    private async loadSecurityIfNotExist(ticker: string): Promise<GetSecurityType<CommonDomain> | null> {
        const { watcher } = this
        const securityInCache = await db.d_Security.findFirst({ where: { ticker } })
        if (!securityInCache) {
            await this.addSecurities(await watcher.getSecurity(ticker))
            return db.d_Security.findFirst({ where: { ticker } })
        }
        return securityInCache
    }

    private async loadSecuritiesIfNotExist(tickers: string[]): Promise<GetSecurityType<CommonDomain>[]> {
        const { watcher } = this
        const securitiesInCache = await db.d_Security.findMany({ where: { ticker: { in: tickers } } })
        const securitiesToAdd = await Promise.all(tickers
            .filter(t => !securitiesInCache.some(s => s.ticker === t))
            .map(ticker => watcher.getSecurity(ticker)))
        return this.addSecurities(...securitiesToAdd)
    }

    // Currencies

    async updateCurrencies(): Promise<GetCurrencyType<CommonDomain>[]> {
        const { watcher } = this
        const relevantCurrencies = await watcher.getCurrencies()
        return await Promise.all(relevantCurrencies
            .map(currency => db.d_Currency.upsert({
                where: { ticker: currency.ticker },
                update: {},
                create: currency
            }))
        )
    }

    async getCurrencies(): Promise<GetCurrencyType<CommonDomain>[]> {
        return db.d_Currency.findMany({})
    }

    // Currencies Balance

    async updateCurrenciesBalance(): Promise<GetCurrencyBalanceType<CommonDomain>[]> {
        const { watcher } = this
        const relevantCurrencies = await watcher.getCurrenciesBalance()
        return await Promise.all(relevantCurrencies
            .map(currency => db.d_CurrencyBalance.upsert({
                where: { currency_ticker: currency.currency_ticker },
                update: { balance: currency.balance },
                create: currency
            }))
        )
    }

    async getCurrenciesBalance(): Promise<GetCurrencyBalanceType<CommonDomain>[]> {
        return db.d_CurrencyBalance.findMany({})
    }

    // Securities

    async updateSecurities(): Promise<GetSecurityType<CommonDomain>[]> {
        const { watcher } = this
        const securities: GetSecurityType<CommonDomain>[] = await db.d_Security.findMany({  })
        const securitiesPrices = await Promise.all(
            securities.map((security): Promise<number> => watcher.getSecurityLastPrice(security.ticker))
        )
        const updatePromises = securities
            .map((security, index) => db.d_Security.update({
                    where: { ticker: security.ticker },
                    data: { price: securitiesPrices[index] }
                })
            )
        return await Promise.all(updatePromises)
    }

    async getSecurities(): Promise<GetSecurityType<CommonDomain>[]> {
        return db.d_Security.findMany({})
    }

    async getSecurity(ticker: string): Promise<GetSecurityType<CommonDomain>> {
        const security = await db.d_Security.findUnique({ where: { ticker } })
        if (!security) throw new Error(`Security with ticker:${ticker} was not found`)
        return security
    }

    async addSecurities(...securities: GetSecurityType<CommonDomain>[]): Promise<GetSecurityType<CommonDomain>[]> {
        const createOrUpdatePromises = securities
            .map((security) => db.d_Security.upsert({
                    where: { ticker: security.ticker },
                    update: { price: security.price },
                    create: security
                })
            )
        return await Promise.all(createOrUpdatePromises)
    }

    // Followed Securities

    async getFollowedSecurities(): Promise<D_FollowedSecurity[]> {
        return db.d_FollowedSecurity.findMany({})
    }
    async followSecurity(securityTicker: string): Promise<D_FollowedSecurity> {
        return db.d_FollowedSecurity.upsert({
            where: { security_ticker: securityTicker },
            update: {},
            create: {
                security_ticker: securityTicker,
                followed_since: new Date()
            }
        })
    }
    async unfollowSecurity(securityTicker: string): Promise<D_FollowedSecurity> {
        return db.d_FollowedSecurity.delete({
            where: { security_ticker: securityTicker }
        })
    }
    async updateFollowedSecurities(): Promise<GetSecurityType<CommonDomain>[]> {
        const { watcher } = this
        const securitiesToUpdate = await db.d_FollowedSecurity.findMany({})
        const securitiesPrices = await Promise.all(
            securitiesToUpdate.map(security => watcher.getSecurityLastPrice(security.security_ticker))
        )
        const updatePromises = securitiesToUpdate.map((security, index) => db.d_Security.update({
            where: { ticker: security.security_ticker },
            data: { price: securitiesPrices[index] }
        }))
        return await Promise.all(updatePromises)
    }

    // Portfolio

    async updatePortfolio(): Promise<GetPortfolioType<CommonDomain>[]>{
        const { watcher } = this
        const relevantPortfolio = await watcher.getPortfolio()
        const securities = await Promise.all(relevantPortfolio.map(p => watcher.getSecurity(p.security_ticker)))
        await this.addSecurities(...securities)
        await db.d_PortfolioPosition.deleteMany({
            where: {
                security_ticker: { notIn: securities.map(s => s.ticker) }
            }
        })
        return await Promise.all(relevantPortfolio.map(position => db.d_PortfolioPosition.upsert(
            {
                where: { security_ticker: position.security_ticker },
                update: { amount: position.amount },
                create: position
            })
        ))

    }

    async getPortfolio(): Promise<GetPortfolioType<CommonDomain>[]> {
        return db.d_PortfolioPosition.findMany({})
    }

    async clearPortfolio(): Promise<number> {
        const { count: deleted } = await db.d_PortfolioPosition.deleteMany({})
        return deleted
    }
    async addPortfolioPosition(portfolioPosition: GetPortfolioType<CommonDomain>): Promise<GetPortfolioType<CommonDomain>> {
        return await db.$transaction(async (db) => {
            const positionToUpdate = await db.d_PortfolioPosition.findUnique({
                where: { security_ticker: portfolioPosition.security_ticker }
            })
            return db.d_PortfolioPosition.upsert({
                where: { security_ticker: portfolioPosition.security_ticker },
                update: { amount: (positionToUpdate?.amount || 0) + portfolioPosition.amount },
                create: portfolioPosition
            })
        })
    }
    async removePortfolioPosition(portfolioPosition: GetPortfolioType<CommonDomain>): Promise<GetPortfolioType<CommonDomain> | null> {
        return await db.$transaction(async (db) => {
            const positionToUpdate = await db.d_PortfolioPosition.findUnique({
                where: { security_ticker: portfolioPosition.security_ticker }
            })
            if ((positionToUpdate?.amount || 0) - portfolioPosition.amount > 0)
                return db.d_PortfolioPosition.update({
                    where: { security_ticker: portfolioPosition.security_ticker },
                    data: { amount: (positionToUpdate?.amount || 0) + portfolioPosition.amount }
                })
            return db.d_PortfolioPosition.delete({ where: { security_ticker: portfolioPosition.security_ticker } })
        })
    }
    async getPositionAverageBuyPrice(ticker: string): Promise<number> {
        const position = await db.d_PortfolioPosition.findUnique({where: { security_ticker: ticker }})
        async function getBoughtStats(take: number){
            const boughtStats = await db.d_Operation.aggregate({
                orderBy: { created_at: 'desc' },
                where: {
                    operation_type: 'buy',
                    security_ticker: ticker
                },
                take,
                _sum: { amount_requested: true },
                _count: { _all: true }
            })
            return boughtStats
        }
        let countOperations = 5
        let boughtStats = await getBoughtStats(countOperations)
        while ((!!boughtStats._sum.amount_requested ? boughtStats._sum.amount_requested < (position?.amount || 0) : false) && boughtStats._count._all !== 0) {
            countOperations++
            boughtStats = await getBoughtStats(countOperations)
            if (countOperations > boughtStats._count._all) break
        }
        const lastSecurityBuyOperations = await db.d_Operation.findMany({
            orderBy: { created_at: 'desc' },
                where: {
                    operation_type: 'buy',
                    security_ticker: ticker
                },
                take: countOperations
        })
        let buyPrice = 0
        let boughtAmount = position?.amount || 0
        for ( let buyOperation of lastSecurityBuyOperations as GetOperationType<CommonDomain>[] ){
            if (!buyOperation.amount_requested) continue
            if (buyOperation.amount_requested >= boughtAmount){
                buyPrice += boughtAmount * buyOperation.price
                break
            }
            buyPrice += buyOperation.amount_requested * buyOperation.price
            boughtAmount -= buyOperation.amount_requested
        }
        return buyPrice / (boughtStats?._sum?.amount_requested || 1)
    }

    // Operations

    async fixOperation(operation: GetOperationType<CommonDomain>): Promise<GetOperationType<CommonDomain>> {
        const operationId: OperationId = operation.exchange_id ?
            { exchange_id: operation.exchange_id} :
            { created_at: operation.created_at }
        const result = await db.d_Operation.upsert({
            where: operationId,
            update: { operation_type: operation.operation_type, amount: operation.amount, updated_at: new Date() },
            create: {
                ...operation,
                updated_at: new Date()
            }
        })
        return result as GetOperationType<CommonDomain>
    }

    async updateOperationsAll(from?: Date, to?: Date ): Promise<GetOperationType<CommonDomain>[]> {
        const { watcher, fixOperation } = this
        const allOperations = await watcher.getOperations(from || addDaysToDate(new Date(), -1), to)
        // @ts-ignore
        await this.loadSecuritiesIfNotExist(allOperations
            .map(op => op.security_ticker)
            .filter(t => t !== null))
        return await Promise.all(allOperations.map(operation => fixOperation(operation)))
    }
    async updateOperationsBySecurity(ticker: string): Promise<GetOperationType<CommonDomain>[]> {
        const { watcher, fixOperation } = this
        const allOperations = await watcher.getOperationsBySecurity(ticker, addDaysToDate(new Date(), -1))
        // @ts-ignore
        await this.loadSecuritiesIfNotExist(allOperations
            .map(op => op.security_ticker)
            .filter(t => t !== null))
        return await Promise.all(allOperations.map(operation => fixOperation(operation)))
    }
    async getOperations({ from, to, operation, securityTicker }: GetOperationsOptions): Promise<GetOperationType<CommonDomain>[]> {
        const result = await db.d_Operation.findMany({
            orderBy: { created_at: 'desc' },
            where: {
                AND: [
                    { created_at: { gte: from || new Date(0) } },
                    { created_at: { lte: to || new Date() } }
                ],
                operation_type: operation,
                security_ticker: securityTicker
            }
        })
        return result as GetOperationType<CommonDomain>[]
    }

    // Orders

    async saveOrder(order: GetOrderType<CommonDomain>, operation_type: OperationType, run_id: number | null = null): Promise<GetOrderType<CommonDomain>> {
        await this.loadSecurityIfNotExist(order.security_ticker)
        const result = await db.d_Order.create({ data: {...order, run_id, operation_type} })
        return result as GetOrderType<CommonDomain>
    }

    async getOrders({ from, to, operation, securityTicker, runId }: GetOrdersOptions): Promise<GetOrderType<CommonDomain>[]> {
        const result = await db.d_Order.findMany({
            orderBy: { created_at: 'desc' },
            where: {
                AND: [
                    { created_at: { gte: from || new Date(0) } },
                    { created_at: { lte: to || new Date() } }
                ],
                operation_type: operation,
                security_ticker: securityTicker,
                run_id: runId
            }
        })
        return result as GetOrderType<CommonDomain>[]
    }

    // Algorithms

    async saveAlgorithms(): Promise<D_Algorithm[]>{
        const { tradeAlgos } = this
        const updatePromises = tradeAlgos.description.map(algo => db.d_Algorithm.upsert({
            where: { name: algo.name },
            update: {
                description: algo.description,
                input_types: algo.input_types
            },
            create: algo
        }))
        return await Promise.all(updatePromises)
    }

    async runAlgorithm(algorithmName: string, inputs: any, state: any = inputs): Promise<D_AlgorithmRun>{
        return db.d_AlgorithmRun.create({
            data: {
                algorithm_name: algorithmName,
                inputs: JSON.stringify(inputs),
                state: JSON.stringify(state),
                status: 'running'
            }
        })
    }

    async saveAlgorithmRunProgress(id: number, state: any): Promise<D_AlgorithmRun>{
        return db.d_AlgorithmRun.update({
            where: { id },
            data: {
                state: JSON.stringify(state)
            }
        })
    }

    async loadAlgorithmRunProgress(id: number): Promise<D_AlgorithmRun | null>{
        return db.d_AlgorithmRun.findUnique({ where: { id } })
    }

    async stopAlgorithmRun(id: number): Promise<D_AlgorithmRun>{
        return db.d_AlgorithmRun.update({
            where: { id },
            data: { status: 'stopped'}
        })
    }

    async continueAlgorithmRun(id: number): Promise<D_AlgorithmRun>{
        return db.d_AlgorithmRun.update({
            where: { id },
            data: { status: 'continued'}
        })
    }

    async finishAlgorithmRun(id: number): Promise<D_AlgorithmRun>{
        return db.d_AlgorithmRun.update({
            where: { id },
            data: { status: 'finished'}
        })
    }

    async errorAlgorithmRun(id: number, error: Error): Promise<D_AlgorithmRun>{
        const run = await db.d_AlgorithmRun.findUnique({where: {id} })
        const state = { ...JSON.parse(run?.state || '{}'), error }
        return db.d_AlgorithmRun.update({
            where: { id },
            data: { status: 'error', state: JSON.stringify(state)}
        })
    }

    async getAlgorithmRunsByAlgorithm(algorithmName: string): Promise<D_AlgorithmRun[]>{
        return db.d_AlgorithmRun.findMany({
            orderBy: { id: 'desc' },
            where: { algorithm_name: algorithmName }
        })
    }

    async getUnfinishedAlgorithmRuns(): Promise<D_AlgorithmRun[]>{
        return db.d_AlgorithmRun.findMany({
            where: { status: { notIn: [ 'finished', 'stopped', 'error' ] }  }
        })
    }
}
