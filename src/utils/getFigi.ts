import {ExchangeClient} from "../exchange-client";

export async function getFigi(ticker: string, exchangeClient: ExchangeClient): Promise<string> {
    const security = await exchangeClient.infoModule.getSecurity(ticker, false)
    if (!security) throw new Error(`Security ${ticker} not found`)
    const { figi } = security
    return figi
}