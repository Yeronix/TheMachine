//-----------------------
//-----------------------
// SETUP AND DEPENDENCIES
//-----------------------
//-----------------------

// connect to Discord API
var Discord = require('discord.io');
var auth = require('./auth.json');

// loads modifiable settings from config file
var settings = require("./config.json");

// loads all necessary local data
var markets = require('./markets.json').markets;

// loads all packages used
var schedule = require('node-schedule');
var R = require("r-script-with-bug-fixes");

// connect to Binance API using Node Binance API wrapper
const binance = require('node-binance-api');
binance.options({
  'APIKEY':'<key>',
  'APISECRET':'<secret>'
});



//-----------------------
//-----------------------
// COMMAND FUNCTIONS
//-----------------------
//-----------------------

// checks Binance market for price
function check_price(market="BTCUSDT", channelID) {
  binance.prices(function(error, ticker) {
    if (ticker.msg != "Invalid symbol.") {
      bot.sendMessage({
        to: channelID,
        message: market + " price: " + ticker[market]
      });
    }
    else {
      bot.sendMessage({to: channelID, message:
      "Didn't recognize that symbol. Try again?"});
    }
  });
}

// checks Binance market for price and converts to USD
function check_price_USD(market="BTCUSDT", channelID) {
  binance.prices(function(error, ticker) {
    if (ticker.market != undefined) {
      var exchange_rate = 1
      if (market.endsWith("BTC")) {
        exchange_rate = ticker["BTCUSDT"]
      }
      if (market.endsWith("ETH")) {
        exchange_rate = ticker["ETHUSDT"]
      }
      if (market.endsWith("BNB")) {
        exchange_rate = ticker["BNBUSDT"]
      }

      price = exchange_rate * ticker[market]

      bot.sendMessage({
        to: channelID,
        message: market + " price: " + price
      });

    }
    else {
      bot.sendMessage({to: channelID, message:
      "Didn't recognize that symbol. Try again?"});
    }
  });
}

// checks Binance market for volume
function check_volume(market="BTCUSDT", channelID) {
  binance.prevDay(market, function(error, prevDay, symbol) {
    if (prevDay.msg != "Invalid symbol.") {
      bot.sendMessage({
        to: channelID,
        message: market + " 24h volume: " + prevDay.volume.toString()
      });
    }
    else {
      bot.sendMessage({to: channelID, message:
      "Didn't recognize that symbol. Try again?"});
    }
  });
}


// runs Ichimoku TA on a market and returns the resulting analysis
function check_ichimoku(market="BTCUSDT", channelID, timeframe="1h") {
  bot.sendMessage({to: channelID, message: "Checking market.."});
  
  // possible time-frames: 1m,3m,5m,15m,30m,1h,2h,4h,6h,8h,12h,1d,3d,1w,1M
  binance.candlesticks(market, timeframe, function(error, ticks, symbol) {
    if (ticks.msg != "Invalid symbol.") {

      analysis = run_ichimoku(ticks)

      // parse analysis results
      switch (analysis) {
        case "above green cloud":
          analysis = "is above the green cloud. Uptrending market with support."
          break;

        case "above red cloud":
          analysis = "is above the red cloud."
          break;

        case "inside green cloud":
          analysis = "is inside the cloud. Careful trading."
          break;

        case "inside red cloud":
          analysis = "is inside the cloud. Careful trading."
          break;

        case "below green cloud":
          analysis = "is below the green cloud."
          break;

        case "below red cloud":
          analysis = "is below the red cloud. Downtrending market with support."
          break;

        case "broken into green cloud":
          analysis = "has recently broken into the green cloud!"
          break;

        case "broken through green cloud":
          analysis = "has completely broken through the green cloud! "
                       + "Support broken. Watch for reversal. "
                       + ":chart_with_downwards_trend:"
          break;

        case "bounced off green cloud support":
          analysis = "has recently bounced off support. "
                      + "Currently back above the green cloud."
          break;

        case "broken into red cloud":
          analysis = "has recently broke into the red cloud!"
          break;

        case "broken through red cloud":
          analysis = "has completely broken through the red cloud! "
                      + "Support broken. Watch for reversal. "
                      + ":chart_with_upwards_trend:"
          break;

        case "bounced off red cloud support":
          analysis = "has recently bounced off support. "
                        + "Currently back below the red cloud."
          break;

        default: analysis = analysis
      }

      if (analysis != undefined) {
        bot.sendMessage({to: channelID, message: market + ' timeframe ' + analysis});
      }
      else {
        bot.sendMessage({to: channelID, message:
          "Sorry, had trouble reading markets."});
      }
    }

    else {
      bot.sendMessage({to: channelID, message:
      "Didn't recognize that symbol. Try again?"});
    }
  }, {limit: 125});
}

// helper function for check_ichimoku
function run_ichimoku(ticks) {
  // converts from array to JSON for easier loading into R
  for (var i in ticks) {ticks[i] = Object.assign({}, ticks[i])}

  try {
    var analysis = R("ta-tools/ichimoku.R")
                   .data(JSON.stringify(ticks))
                   .callSync()
  }
  catch(err) {
    console.log("R-Script threw an error: " + err)
  }

  return analysis
}



//-----------------------
//-----------------------
// DISCORD BOT LISTENERS
//-----------------------
//-----------------------

// launches bot
var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});


// actions that launch upon bot startup
bot.on('ready', function (evt) {
    console.log('Connected');
    console.log('Logged in as: ' + bot.username + '-' + bot.id);
});


// actions that launch upon any messages in the channel
bot.on('message', function (user, userID, channelID, message, evt) {

    // filters only for commands that start with '$'
    if (message.substring(0, 1) == '$') {
        var args = message.substring(1).split(' ');
        var command = args[0]
        var param = args[1]
        var param2 = args[2]
        if (param != undefined ) {
          param = param.toUpperCase()
        }

        // help command
        if (command == "help") {
          bot.sendMessage({
            to: channelID,
            message: "WELCOME TO THE MACHINE! Here's a list of commands. \n" +
            "$price MARKET : gives the price for a specified market \n" +
            "$priceUSD MARKET : gives the price for a specified market in US dollars \n" +
            "$vol MARKET : gives the volume for a specified market \n" +
            "$ichi MARKET : gives whether a specific market is within its Ichimoku cloud \n" +
            "$alert : toggles whether or not you want to receive 15m Ichimoku cloud updates"
          });
        }

        //  price command
        if (command == "price") {
          var market = param
          check_price(market, channelID)
        }

        //  price command
        if (command == "priceUSD") {
          var market = param
          check_price_USD(market, channelID)
        }

        // volume command
        if (command == "vol") {
          var market = param
          check_volume(market, channelID)
         }

        // ichimoku command
        if (command == "ichi") {
          var market = param
          var timeframe = param2
          check_ichimoku(market, channelID, timeframe)
        }

        // alert command for toggling Ichimoku indicator
        if (command == "alert") {
          var indicator = param

          if      ( ichi_alert === "on" ) { ichi_alert = "off" }
          else if ( ichi_alert === "off") { ichi_alert = "on"  }

          bot.sendMessage({
            to: channelID,
            message: "Ichimoku indicator is now " + ichi_alert + "!"
          });
        }

     }
});



// ----------------
// ----------------
// SCHEDULED EVENTS
// ----------------
// ----------------

const ALERT_CHANNEL = settings.alert_channelID
const ALERT_FREQUENCY = "0,15,30,45 * * * *"   // default every 15 mins

var ichi_alert = "on"
var interval = "15m"  // choices: 15m,30m,1h,2h,4h,6h,8h,12h,1d,3d,1w,1M


// ichimoku scheduled alert system
var ichiAlertSystem = schedule.scheduleJob(ALERT_FREQUENCY, function(){
  console.log("Running scheduled Ichimoku analysis..")
  if (ichi_alert === "on") {
  function analyzeMarkets(i) {
    if (i < markets.length) {
      binance.candlesticks(markets[i], interval, function(error, ticks, symbol) {

        // recursively convert array into stringified JSON
        function jsonify(ticks, i) {
          if (i < ticks.length) {
            ticks[i] = Object.assign({}, ticks[i])
            jsonify(ticks, i+1)
          }
        }
        jsonify(ticks,0)
        candlesticks_data = JSON.stringify(ticks)

        R("ta-tools/ichimoku.R").data(candlesticks_data)
          .call(function(err, analysis) {
            console.log(analysis)
          if (analysis == "broken into green cloud") {
            bot.sendMessage({to: ALERT_CHANNEL,
              message: symbol + ': recently ' + analysis + " on the " + interval});
            }
          if (analysis == "broken into red cloud") {
            bot.sendMessage({to: ALERT_CHANNEL,
              message: symbol + ': recently ' + analysis + " on the " + interval});
            }
          if (analysis == "broken through green cloud") {
            bot.sendMessage({to: ALERT_CHANNEL,
              message: symbol + ': recently ' + analysis + " on the " + interval});
            }
          if (analysis == "broken through red cloud") {
            bot.sendMessage({to: ALERT_CHANNEL,
              message: symbol + ': recently ' + analysis + " on the " + interval});
            }
          analyzeMarkets(i+1)

        })
      }, {limit: 125});
    }
  }
  analyzeMarkets(0)
  }
});



// -----------------------
// CONFIGURATION FUNCTIONS
// -----------------------

// fetches list of available markets from Binance API;
// markets are usually stored locally but may need if new markets are added
function refreshMarkets() {
    binance.prices(function(ticker) {
        console.log(JSON.stringify(Object.keys(ticker)).length);
    });
}

// -----------------------
// Funsies
// -----------------------

bot.on('message', function (user, userID, channelID, message, evt) {
    if (message.substring(0, 1) == '!') {
        var args = message.substring(1).split(' ');
        var cmd = args[0];

        args = args.splice(1);

        switch(cmd) {
            // !rage
            case 'rage':
                bot.sendMessage({ to: channelID, message: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' });
            break;
			// !gold
			case 'gold':
                bot.sendMessage({ to: channelID, message: 'I am the golden god!' });
            break;
			// !wow
			case 'wow':
                bot.sendMessage({ to: channelID, message: 'http://ksassets.timeincuk.net/wp/uploads/sites/55/2017/07/owen-wilson-wow-920x584.jpg' });
            break;
			// !crypto
			case 'crypto':
                bot.sendMessage({ to: channelID, message: 'https://thumbs.dreamstime.com/z/businessman-money-funny-displeased-count-holding-isolated-white-background-employee-young-man-small-profit-bankruptcy-56591282.jpg' });
            break;
			// !worship
			case 'worship':
                bot.sendMessage({ to: channelID, message: 'All hail Owen' });
            break;
			// !booty
			case 'booty':
                bot.sendMessage({ to: channelID, message: 'but do u eat ass tho' });
            break;
			// !chris
			case 'chris':
                bot.sendMessage({ to: channelID, message: '*hits vape* WELL YOU SEE' });
            break;
			// !ethan
			case 'ethan':
                bot.sendMessage({ to: channelID, message: '*promises not to talk about AI when he gets drunk* *one drink later* SO HAVE YOU HEARD ABOUT' });
            break;
			// !asher
			case 'asher':
                bot.sendMessage({ to: channelID, message: '*pulls out another instrument* Electronic music is gay' });
            break;
			// !michael
			case 'michael':
                bot.sendMessage({ to: channelID, message: '*pushes glasses up nose* Incorrect.' });
            break;
			// !michael
			case 'mikl':
                bot.sendMessage({ to: channelID, message: '*pushes glasses up nose* Incorrect.' });
            break;
			// !clark
			case 'clark':
                bot.sendMessage({ to: channelID, message: '*peers under top of doorframe* Hey kids.' });
            break;
            default:
                bot.sendMessage({ to: channelID, message: 'Unknown command.' });
        }
    }
})
