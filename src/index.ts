import {runTradeBot} from "@badlabs/tradebot-core";
import {ExchangeClient} from "./exchange-client";
import {initAlgorithms} from "./algorithms";

runTradeBot({
  exchangeClient: new ExchangeClient(process.env.TINKOFF_SANDBOX_API_KEY || ''),
  botToken: process.env.BOT_TOKEN || '',
  initAlgorithmsCallback: initAlgorithms
})


