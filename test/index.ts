import {runTradeBot, wait} from "@badlabs/tradebot-core";
import {ExchangeClient} from "../src/exchange-client";
import {initAlgorithms} from "../src/algorithms";

(async () => {

  const tradeBot = runTradeBot({
    exchangeClient: new ExchangeClient(process.env.TINKOFF_SANDBOX_API_KEY || ''),
    botToken: process.env.BOT_TOKEN || '',
    initAlgorithmsCallback: initAlgorithms
  })

  console.info(`${new Date()} Waiting initialization...`)

  while (!tradeBot.exchangeClient.isAccountInitialized){
    await wait(10)
  }
  await tradeBot.analyzer.updateCurrencies()
  console.info(`${new Date()} Starting tests...`)

  await tradeBot.trader.sendOrder({ ticker: 'AAPL', lots: 5, operation: 'limit_buy', price: 200 })
  await tradeBot.trader.sendOrder({ ticker: 'AAPL', lots: 5, operation: 'limit_buy', price: 300 })
  await tradeBot.trader.sendOrder({ ticker: 'AAPL', lots: 2, operation: 'limit_sell', price: 100 })
  console.table((await tradeBot.exchangeClient.api.currencies()).instruments)
  console.table((await tradeBot.exchangeClient.api.portfolio()).positions)
  console.table((await tradeBot.exchangeClient.api.portfolioCurrencies()).currencies)
})()

