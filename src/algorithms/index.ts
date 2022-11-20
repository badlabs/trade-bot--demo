import {AbstractTradeAlgorithm, ExchangeAnalyzer} from '@badlabs/tradebot-core'
import {SlicingAlgorithm} from './slicing/logic'
import {HammerAlgorithm} from './hammer/logic'
import {AggressiveTradingAlgorithm} from './aggressive-trading/logic'
import {ExchangeClient} from '../exchange-client'

export function initAlgorithms(analyzer: ExchangeAnalyzer<ExchangeClient>): AbstractTradeAlgorithm<ExchangeClient>[] {
    return [
        new SlicingAlgorithm(analyzer),
        new HammerAlgorithm(analyzer),
        new AggressiveTradingAlgorithm(analyzer)
    ]
}
