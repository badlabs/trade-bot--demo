import {TradeBot} from "trade-bot-core";
import {ExchangeClient} from "./exchange-client";
import {initAlgorithms} from "./algorithms";

const tradebot = new TradeBot({
  exchangeClient: new ExchangeClient(process.env.TINKOFF_SANDBOX_API_KEY || ''),
  botToken: process.env.BOT_TOKEN || '',
  initAlgorithmsCallback: initAlgorithms
})


