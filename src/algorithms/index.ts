import {AbstractTradeAlgorithm} from '../../src/abstract'
import {SlicingAlgorithm} from './slicing/logic'
import {ExchangeAnalyzer} from '../../src/modules'
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
