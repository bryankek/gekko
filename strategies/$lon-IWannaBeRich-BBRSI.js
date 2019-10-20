// IWannaBeRich strategy
//
var _ = require('lodash');
var log = require('../core/log.js');

var bb = require('./indicators/BB.js');
var rsi = require('./indicators/RSI.js');

let strat = {};

// seal everything into init to have the ability to use local variables unique for each strat instance
// , instead of using 'this.someVar', to optimize performance:
strat.init = function() {

  const config = require ('../core/util').getConfig() || {};

  let currentCandle, currentPrice = 0.0, buyPrice = 0.0, advised = false, tradeInitiated = false, buyTs;

  consoleLog(`strat init, gekkoId: ${ config.gekkoId }, type: ${ config.type }`)

  // debug? set to false to disable all logging/messages/stats (improves performance in backtests)
  this.debug = true;

  // performance
  config.backtest.batchSize = 1000; // increase performance
  config.silent = true;
  config.debug = false;

  this.name = '$lon-IWannaBeRich-BBRSI';
  this.nsamples = 0;
  this.trend = {
    //zone: 'none',  // none, top, high, low, bottom
    duration: 0,
    persisted: false,
    direction: '', //up, down
    adviced: false
    //  max: 0,
    //  min: 0
  };

  this.requiredHistory = this.tradingAdvisor.historySize;

  // define the indicators we need
  this.addIndicator('bb', 'BB', this.settings.bbands);
  this.addIndicator('rsi', 'RSI', this.settings.rsi);

// What happens on every new candle?
  this.update = function(candle) {
    consoleLog(`strat update:: price: ${ price }, rsiVal: ${ rsiVal }, this.trend.direction: ${ this.trend.direction }, this.trend.persisted: ${
      this.trend.persisted }, advised: ${ advised }, tradeInitiated: ${ tradeInitiated }`);

    currentPrice = candle.close;
    currentCandle = candle;
    // if strat has DEPENDENCIES, notify them:
    // this.notify({
    //   type: 'dependency-...',
    //   reason: 'TREND CHANGE',
    //   data: this.curIndicator
    // });
  }

  this.check = function(candle) {

    let bb = this.indicators.bb;
    let price = candle.close;
    this.nsamples++;

    let rsi = this.indicators.rsi;
    let rsiVal = rsi.result;

    consoleLog(`strat check:: price: ${ price }, rsiVal: ${ rsiVal }, this.trend.direction: ${ this.trend.direction }, this.trend.persisted: ${ 
      this.trend.persisted }, advised: ${ advised }, tradeInitiated: ${ tradeInitiated }`);

    //uptrend
    if (price <= bb.lower && rsiVal <= this.settings.rsi.low) {
      // new trend detected
      if(this.trend.direction !== 'up'){
        // reset the state for the new trend
        this.trend = {
          duration: 0,
          persisted: false,
          direction: 'up',
          adviced: false
        };
      }
      this.trend.duration++;
      log.debug('In uptrend since', this.trend.duration, 'candle(s)');

      if(this.trend.duration >= this.settings.rsi.persistence){
        this.trend.persisted = true;
      }

      if(this.trend.persisted && !this.trend.adviced && !advised) {
        this.trend.adviced = true;
        this.buy('up trend: long');
      } else {
        // this.advice();
      }

      return;
    }

    //downtrend
    if (price > bb.middle && rsiVal >= this.settings.rsi.high) {
      // new trend detected
      if(this.trend.direction !== 'down'){
        // reset the state for the new trend
        this.trend = {
          duration: 0,
          persisted: false,
          direction: 'down',
          adviced: false
        };
      }

      this.trend.duration++;

      log.debug('In downtrend since', this.trend.duration, 'candle(s)');

      if(this.trend.duration >= this.settings.rsi.persistence){
        this.trend.persisted = true;
      }

      if(this.trend.persisted && !this.trend.adviced && advised) {
        this.trend.adviced = true;
        this.sell('down trend: short');
      } else {
        // this.advice();
      }

      return;
    }

    //no trend
    this.trend.advice = '';
    // this.advice();

  }

  this.sell = function(reason) {
    consoleLog('this.sell');
    this.notify({
      type: 'sell advice',
      reason: reason,
    });
    consoleLog(reason);
    this.advice('short');
    advised = false;
    buyPrice = 0;
    if (tradeInitiated) { // Add logic to use other indicators
      tradeInitiated = false;
    }
  }

  this.buy = function(reason) {
    consoleLog('this.buy');
    advised = true;
    // If there are no active trades, send signal
    if (!tradeInitiated) { // Add logic to use other indicators
      this.notify({
        type: 'buy advice',
        reason: reason,
      });
      consoleLog(reason);
      this.advice('long');
      buyTs = this.candle.start;
      buyPrice = currentPrice;
      tradeInitiated = true;
    }
  }
  this.onPendingTrade = function(pendingTrade) {
    tradeInitiated = true;
    consoleLog('onPendingTrade (tradeInitiated = true)');
  }

  this.onTrade = function(trade) {
    tradeInitiated = false;
    consoleLog('onTrade (tradeInitiated = false)');
  }
// Trades that didn't complete with a buy/sell
  this.onTerminatedTrades = function(terminatedTrades) {
    tradeInitiated = false;
    consoleLog('Trade failed. Reason: (tradeInitiated = false)' + terminatedTrades && terminatedTrades.reason);
  }


// for debugging purposes log the last
// calculated parameters.
  this.log = function (candle) {
    var digits = 8;

    var bb = this.indicators.bb;
    var rsi = this.indicators.rsi;

    //BB logging
    //BB.lower; BB.upper; BB.middle are your line values
    log.debug('______________________________________');
    log.debug('calculated BB properties for candle ', this.nsamples);

    if (bb.upper > candle.close) log.debug('\t', 'Upper BB:', bb.upper.toFixed(digits));
    if (bb.middle > candle.close) log.debug('\t', 'Mid   BB:', bb.middle.toFixed(digits));
    if (bb.lower >= candle.close) log.debug('\t', 'Lower BB:', bb.lower.toFixed(digits));
    log.debug('\t', 'price:', candle.close.toFixed(digits));
    if (bb.upper <= candle.close) log.debug('\t', 'Upper BB:', bb.upper.toFixed(digits));
    if (bb.middle <= candle.close) log.debug('\t', 'Mid   BB:', bb.middle.toFixed(digits));
    if (bb.lower < candle.close) log.debug('\t', 'Lower BB:', bb.lower.toFixed(digits));
    log.debug('\t', 'Band gap: ', bb.upper.toFixed(digits) - bb.lower.toFixed(digits));

    //RSI logging
    log.debug('calculated RSI properties for candle:');
    log.debug('\t', 'rsi:', rsi.result.toFixed(digits));
    log.debug('\t', 'price:', candle.close.toFixed(digits));
  }


  this.end = function(a, b, c) {
    consoleLog('gekko end')
  }
  function consoleLog(msg){
    if(config){
      msg = msg || '';
      currentCandle = currentCandle || {}
      const prefix = `${ config.gekkoId }, ${ JSON.stringify(currentCandle.start) || JSON.stringify(moment()) } -- `;
      console.log(prefix, msg);
      log.debug(prefix, msg);
    }
  }
}

strat.check = function(){
  // gekko stub
}

module.exports = strat;

