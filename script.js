// ============================================================
// EUR/USD SNIPER DASHBOARD
// ELITE SCALPING ENGINE
// ============================================================

// IMPORTANT:
// Use your NEW Twelve Data API key here.
// Do NOT use the old exposed API key.

const API_KEY = "8908432b6c784bc49aad6ccf64845991";

const SYMBOL = "EUR/USD";

const PRICE_URL =
  "https://api.twelvedata.com/price";

const TIME_SERIES_URL =
  "https://api.twelvedata.com/time_series";

const NEWS_URL =
  "https://xoomar.com/api/markets/calendar?importance=high";


// ============================================================
// ELITE SCALPING SETTINGS
// ============================================================

const SCALP_WINDOW_MINUTES = 120;

const SCALP_MIN_SCORE = 80;

const SCALP_MIN_RR = 2.0;

const SCALP_MIN_RISK_PIPS = 3;

const SCALP_MAX_RISK_PIPS = 15;

const SCALP_MAX_EMA_DISTANCE = 0.00050;

const SCALP_SL_BUFFER = 0.00010;


// RSI zones

const BULLISH_RSI_MIN = 52;
const BULLISH_RSI_MAX = 68;

const BEARISH_RSI_MIN = 32;
const BEARISH_RSI_MAX = 48;


// ============================================================
// MARKET DATA
// ============================================================

let marketData = {

  price: null,

  h4: [],
  h1: [],
  m15: [],
  m5: [],

  h4Trend: "RANGE",
  h1Trend: "RANGE",
  m15Structure: "RANGE",
  m5Structure: "RANGE",

  resistance1: null,
  resistance2: null,

  support1: null,
  support2: null,

  h4Rsi: null,
  h1Rsi: null,
  m15Rsi: null,
  m5Rsi: null,

  h4Ema20: null,
  h4Ema50: null,

  h1Ema20: null,
  h1Ema50: null,

  m15Ema20: null,
  m15Ema50: null,

  m5Ema20: null,
  m5Ema50: null,

  emaStructure: "RANGE",

  news: {

    clear: true,

    eur: "No major event",

    usd: "No major event",

    nextEvent: "No major event",

    risk: "LOW"

  }

};


// ============================================================
// INITIALIZE
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    loadMarketData();

    setInterval(
      () => {
        loadMarketData();
      },
      120000
    );

  }
);


// ============================================================
// TRADINGVIEW CHART SWITCHER
// ============================================================

function changeChart(interval) {

  const chart =
    document.getElementById(
      "tradingChart"
    );


  if (!chart) {

    console.error(
      "TradingView chart not found."
    );

    return;

  }


  const buttons =
    document.querySelectorAll(
      ".chart-buttons button"
    );


  buttons.forEach(
    button => {
      button.classList.remove(
        "active"
      );
    }
  );


  if (interval === "5min") {

    document
      .getElementById("btnM5")
      ?.classList.add("active");

  }


  if (interval === "15min") {

    document
      .getElementById("btnM15")
      ?.classList.add("active");

  }


  if (interval === "1h") {

    document
      .getElementById("btnH1")
      ?.classList.add("active");

  }


  if (interval === "4h") {

    document
      .getElementById("btnH4")
      ?.classList.add("active");

  }


  const tradingViewIntervals = {

    "5min": "5",

    "15min": "15",

    "1h": "60",

    "4h": "240"

  };


  const tvInterval =
    tradingViewIntervals[
      interval
    ];


  if (!tvInterval) {
    return;
  }


  chart.src =
    "https://www.tradingview.com/widgetembed/?" +

    "frameElementId=tradingviewChart" +

    "&symbol=FX:EURUSD" +

    "&interval=" +
    tvInterval +

    "&hidesidetoolbar=1" +

    "&symboledit=1" +

    "&saveimage=0" +

    "&toolbarbg=f1f3f6" +

    "&studies=[]" +

    "&hideideas=1" +

    "&theme=dark" +

    "&style=1" +

    "&timezone=Asia%2FKolkata";

}


// ============================================================
// MAIN DATA LOADER
// ============================================================

async function loadMarketData() {

  setStatus(
    "Loading market data...",
    "yellow"
  );


  try {

    const [

      price,

      h4,

      h1,

      m15,

      m5,

      news

    ] = await Promise.all([

      getPrice(),

      getCandles(
        "4h",
        150
      ),

      getCandles(
        "1h",
        150
      ),

      getCandles(
        "15min",
        150
      ),

      getCandles(
        "5min",
        200
      ),

      getNews()

    ]);


    marketData.price = price;

    marketData.h4 = h4;

    marketData.h1 = h1;

    marketData.m15 = m15;

    marketData.m5 = m5;

    marketData.news = news;


    // --------------------------------------------------------
    // STRUCTURE
    // --------------------------------------------------------

    marketData.h4Trend =
      getMarketStructure(h4);

    marketData.h1Trend =
      getMarketStructure(h1);

    marketData.m15Structure =
      getMarketStructure(m15);

    marketData.m5Structure =
      getMarketStructure(m5);


    // --------------------------------------------------------
    // SUPPORT / RESISTANCE
    // --------------------------------------------------------

    const sr =
      calculateSupportResistance(
        h1
      );


    marketData.resistance1 =
      sr.resistance1;

    marketData.resistance2 =
      sr.resistance2;

    marketData.support1 =
      sr.support1;

    marketData.support2 =
      sr.support2;


    // --------------------------------------------------------
    // RSI
    // --------------------------------------------------------

    marketData.h4Rsi =
      calculateRSI(h4);

    marketData.h1Rsi =
      calculateRSI(h1);

    marketData.m15Rsi =
      calculateRSI(m15);

    marketData.m5Rsi =
      calculateRSI(m5);


    // --------------------------------------------------------
    // EMA
    // --------------------------------------------------------

    marketData.h4Ema20 =
      calculateEMA(h4, 20);

    marketData.h4Ema50 =
      calculateEMA(h4, 50);

    marketData.h1Ema20 =
      calculateEMA(h1, 20);

    marketData.h1Ema50 =
      calculateEMA(h1, 50);

    marketData.m15Ema20 =
      calculateEMA(m15, 20);

    marketData.m15Ema50 =
      calculateEMA(m15, 50);

    marketData.m5Ema20 =
      calculateEMA(m5, 20);

    marketData.m5Ema50 =
      calculateEMA(m5, 50);


    marketData.emaStructure =
      getEMAStructure();


    // --------------------------------------------------------
    // UPDATE
    // --------------------------------------------------------

    updateDashboard();

    runSniperEngine();

    runEliteScalpingEngine();

    runProAnalysis();


    setStatus(

      "MARKET DATA LOADED • " +
      new Date().toLocaleTimeString(
        "en-IN"
      ),

      "green"

    );


  } catch (error) {

    console.error(error);

    setStatus(
      "Market data error",
      "red"
    );

    showErrorState(error);

  }

}


// ============================================================
// PRICE
// ============================================================

async function getPrice() {

  const url =
    PRICE_URL +
    "?symbol=" +
    encodeURIComponent(SYMBOL) +
    "&apikey=" +
    encodeURIComponent(API_KEY);


  const response =
    await fetch(url);


  const data =
    await response.json();


  if (
    !response.ok ||
    !data ||
    !data.price
  ) {

    throw new Error(
      "Unable to get live EUR/USD price"
    );

  }


  return Number(
    data.price
  );

}


// ============================================================
// CANDLES
// ============================================================

async function getCandles(
  interval,
  outputsize
) {

  const url =
    TIME_SERIES_URL +

    "?symbol=" +
    encodeURIComponent(SYMBOL) +

    "&interval=" +
    encodeURIComponent(interval) +

    "&outputsize=" +
    outputsize +

    "&apikey=" +
    encodeURIComponent(API_KEY);


  const response =
    await fetch(url);


  const data =
    await response.json();


  if (
    !response.ok ||
    !data ||
    !data.values
  ) {

    throw new Error(
      "Unable to load " +
      interval +
      " candle data"
    );

  }


  return data.values

    .map(
      c => ({

        datetime:
          new Date(
            c.datetime
          ),

        open:
          Number(c.open),

        high:
          Number(c.high),

        low:
          Number(c.low),

        close:
          Number(c.close)

      })
    )

    .sort(
      (a, b) =>
        a.datetime -
        b.datetime
    );

}


// ============================================================
// NEWS
// ============================================================

async function getNews() {

  try {

    const response =
      await fetch(
        NEWS_URL
      );


    if (!response.ok) {

      return {

        clear: false,

        eur:
          "News unavailable",

        usd:
          "News unavailable",

        nextEvent:
          "News unavailable",

        risk:
          "UNKNOWN"

      };

    }


    const data =
      await response.json();


    const events =
      normalizeNews(data);


    const now =
      new Date();


    const end =
      new Date(

        now.getTime() +

        SCALP_WINDOW_MINUTES *
        60000

      );


    const relevant =
      events.filter(
        event => {

          if (!event.time) {
            return false;
          }


          return (

            event.time >= now &&

            event.time <= end &&

            (

              event.currency ===
              "EUR" ||

              event.currency ===
              "USD"

            )

          );

        }
      );


    if (
      relevant.length === 0
    ) {

      return {

        clear: true,

        eur: "CLEAR",

        usd: "CLEAR",

        nextEvent:
          "No high-impact EUR/USD event in next 2 hours",

        risk: "LOW"

      };

    }


    const eur =
      relevant.filter(
        e =>
          e.currency === "EUR"
      );


    const usd =
      relevant.filter(
        e =>
          e.currency === "USD"
      );


    relevant.sort(
      (a, b) =>
        a.time - b.time
    );


    const first =
      relevant[0];


    return {

      clear: false,

      eur:
        eur.length
          ? "HIGH IMPACT EVENT"
          : "CLEAR",

      usd:
        usd.length
          ? "HIGH IMPACT EVENT"
          : "CLEAR",

      nextEvent:
        formatNewsEvent(
          first
        ),

      risk: "HIGH"

    };


  } catch (error) {

    console.warn(
      "News check failed:",
      error
    );


    return {

      clear: false,

      eur: "UNVERIFIED",

      usd: "UNVERIFIED",

      nextEvent:
        "News could not be verified",

      risk: "UNKNOWN"

    };

  }

}


// ============================================================
// NEWS NORMALIZATION
// ============================================================

function normalizeNews(data) {

  let raw = [];


  if (Array.isArray(data)) {

    raw = data;

  } else if (
    data &&
    Array.isArray(
      data.events
    )
  ) {

    raw = data.events;

  } else if (
    data &&
    Array.isArray(
      data.data
    )
  ) {

    raw = data.data;

  }


  return raw

    .map(
      item => {

        const rawCurrency =
          String(

            item.currency ||
            item.country ||
            item.ccy ||
            ""

          ).toUpperCase();


        let currency = "";


        if (
          rawCurrency.includes(
            "USD"
          )
        ) {

          currency = "USD";

        } else if (
          rawCurrency.includes(
            "EUR"
          )
        ) {

          currency = "EUR";

        }


        const timeValue =
          item.datetime ||
          item.date ||
          item.time ||
          item.timestamp;


        let time = null;


        if (timeValue) {

          const parsed =
            new Date(
              timeValue
            );


          if (
            !isNaN(
              parsed.getTime()
            )
          ) {

            time = parsed;

          }

        }


        return {

          currency,

          title:
            item.title ||
            item.event ||
            item.name ||
            "High impact event",

          time

        };

      }
    )

    .filter(
      item =>
        item.currency &&
        item.time
    );

}


// ============================================================
// NEWS FORMAT
// ============================================================

function formatNewsEvent(
  event
) {

  if (
    !event ||
    !event.time
  ) {

    return "No event";

  }


  return (

    event.currency +

    " • " +

    event.title +

    " • " +

    event.time.toLocaleTimeString(
      "en-IN",
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    )

  );

}


// ============================================================
// MARKET STRUCTURE
// ============================================================

function getMarketStructure(
  candles
) {

  if (
    !candles ||
    candles.length < 20
  ) {

    return "RANGE";

  }


  const completed =
    candles.slice(
      0,
      candles.length - 1
    );


  const recent =
    completed.slice(-20);


  const highs =
    recent.map(
      c => c.high
    );


  const lows =
    recent.map(
      c => c.low
    );


  const highest =
    Math.max(
      ...highs
    );


  const lowest =
    Math.min(
      ...lows
    );


  const last =
    recent[
      recent.length - 1
    ];


  const first =
    recent[0];


  const range =
    highest -
    lowest;


  if (range <= 0) {
    return "RANGE";
  }


  const movement =
    last.close -
    first.close;


  const threshold =
    range * 0.20;


  if (
    movement > threshold
  ) {

    return "BULLISH";

  }


  if (
    movement < -threshold
  ) {

    return "BEARISH";

  }


  const swings =
    findSwingPoints(
      recent
    );


  if (
    swings.highs.length >= 2 &&
    swings.lows.length >= 2
  ) {

    const h1 =
      swings.highs[
        swings.highs.length - 2
      ];


    const h2 =
      swings.highs[
        swings.highs.length - 1
      ];


    const l1 =
      swings.lows[
        swings.lows.length - 2
      ];


    const l2 =
      swings.lows[
        swings.lows.length - 1
      ];


    if (
      h2.price > h1.price &&
      l2.price > l1.price
    ) {

      return "BULLISH";

    }


    if (
      h2.price < h1.price &&
      l2.price < l1.price
    ) {

      return "BEARISH";

    }

  }


  return "RANGE";

}


// ============================================================
// SWING POINTS
// ============================================================

function findSwingPoints(
  candles
) {

  const highs = [];

  const lows = [];


  for (
    let i = 2;
    i < candles.length - 2;
    i++
  ) {

    const c =
      candles[i];


    if (

      c.high >
      candles[i - 1].high &&

      c.high >
      candles[i - 2].high &&

      c.high >
      candles[i + 1].high &&

      c.high >
      candles[i + 2].high

    ) {

      highs.push({

        index: i,

        price: c.high

      });

    }


    if (

      c.low <
      candles[i - 1].low &&

      c.low <
      candles[i - 2].low &&

      c.low <
      candles[i + 1].low &&

      c.low <
      candles[i + 2].low

    ) {

      lows.push({

        index: i,

        price: c.low

      });

    }

  }


  return {

    highs,

    lows

  };

}


// ============================================================
// SUPPORT / RESISTANCE
// ============================================================

function calculateSupportResistance(
  candles
) {

  const completed =
    candles.slice(
      0,
      candles.length - 1
    );


  const recent =
    completed.slice(-80);


  const current =
    recent[
      recent.length - 1
    ].close;


  const swings =
    findSwingPoints(
      recent
    );


  let resistances =
    swings.highs

      .map(
        s => s.price
      )

      .filter(
        p => p > current
      )

      .sort(
        (a, b) =>
          a - b
      );


  let supports =
    swings.lows

      .map(
        s => s.price
      )

      .filter(
        p => p < current
      )

      .sort(
        (a, b) =>
          b - a
      );


  if (
    resistances.length < 2
  ) {

    const futureHighs =
      recent

        .map(
          c => c.high
        )

        .filter(
          p => p > current
        )

        .sort(
          (a, b) =>
            a - b
        );


    resistances =
      [
        ...resistances,
        ...futureHighs
      ];

  }


  if (
    supports.length < 2
  ) {

    const pastLows =
      recent

        .map(
          c => c.low
        )

        .filter(
          p => p < current
        )

        .sort(
          (a, b) =>
            b - a
        );


    supports =
      [
        ...supports,
        ...pastLows
      ];

  }


  resistances =
    uniqueLevels(
      resistances
    ).slice(0, 2);


  supports =
    uniqueLevels(
      supports
    ).slice(0, 2);


  return {

    resistance1:
      resistances[0] ||
      current + 0.00100,

    resistance2:
      resistances[1] ||
      current + 0.00200,

    support1:
      supports[0] ||
      current - 0.00100,

    support2:
      supports[1] ||
      current - 0.00200

  };

}


// ============================================================
// UNIQUE LEVELS
// ============================================================

function uniqueLevels(
  levels
) {

  const result = [];


  for (
    const price of levels
  ) {

    if (

      !result.some(

        existing =>

          Math.abs(
            existing -
            price
          ) < 0.00015

      )

    ) {

      result.push(
        price
      );

    }

  }


  return result;

}


// ============================================================
// RSI
// ============================================================

function calculateRSI(
  candles,
  period = 14
) {

  if (
    !candles ||
    candles.length <
      period + 2
  ) {

    return null;

  }


  const completed =
    candles.slice(
      0,
      candles.length - 1
    );


  const closes =
    completed.map(
      c => c.close
    );


  let gains = 0;

  let losses = 0;


  for (
    let i = 1;
    i <= period;
    i++
  ) {

    const change =
      closes[i] -
      closes[i - 1];


    if (
      change > 0
    ) {

      gains += change;

    } else {

      losses +=
        Math.abs(
          change
        );

    }

  }


  let avgGain =
    gains / period;


  let avgLoss =
    losses / period;


  for (
    let i = period + 1;
    i < closes.length;
    i++
  ) {

    const change =
      closes[i] -
      closes[i - 1];


    const gain =
      change > 0
        ? change
        : 0;


    const loss =
      change < 0
        ? Math.abs(
            change
          )
        : 0;


    avgGain =
      (
        avgGain *
          (period - 1) +
        gain
      ) / period;


    avgLoss =
      (
        avgLoss *
          (period - 1) +
        loss
      ) / period;

  }


  if (
    avgLoss === 0
  ) {

    return 100;

  }


  const rs =
    avgGain /
    avgLoss;


  return (
    100 -
    100 /
      (1 + rs)
  );

}


// ============================================================
// EMA
// ============================================================

function calculateEMA(
  candles,
  period
) {

  if (
    !candles ||
    candles.length <
      period + 2
  ) {

    return null;

  }


  const completed =
    candles.slice(
      0,
      candles.length - 1
    );


  const closes =
    completed.map(
      c => c.close
    );


  const multiplier =
    2 /
    (period + 1);


  let ema =
    closes

      .slice(
        0,
        period
      )

      .reduce(
        (
          sum,
          value
        ) =>
          sum + value,
        0
      ) / period;


  for (
    let i = period;
    i < closes.length;
    i++
  ) {

    ema =
      (
        closes[i] -
        ema
      ) *
      multiplier +
      ema;

  }


  return ema;

}


// ============================================================
// EMA STRUCTURE
// ============================================================

function getEMAStructure() {

  if (

    marketData.m5Ema20 === null ||

    marketData.m5Ema50 === null ||

    marketData.price === null

  ) {

    return "RANGE";

  }


  if (

    marketData.m5Ema20 >
    marketData.m5Ema50 &&

    marketData.price >
    marketData.m5Ema20

  ) {

    return "BULLISH";

  }


  if (

    marketData.m5Ema20 <
    marketData.m5Ema50 &&

    marketData.price <
    marketData.m5Ema20

  ) {

    return "BEARISH";

  }


  return "RANGE";

}


// ============================================================
// COMPLETED CANDLES
// ============================================================

function getLastCompletedCandle(
  candles
) {

  if (
    !candles ||
    candles.length < 3
  ) {

    return null;

  }


  return candles[
    candles.length - 2
  ];

}


function getPreviousCompletedCandle(
  candles
) {

  if (
    !candles ||
    candles.length < 4
  ) {

    return null;

  }


  return candles[
    candles.length - 3
  ];

}


// ============================================================
// M5 MOMENTUM
// ============================================================

function getM5MomentumTrigger(
  direction
) {

  const last =
    getLastCompletedCandle(
      marketData.m5
    );


  const previous =
    getPreviousCompletedCandle(
      marketData.m5
    );


  if (
    !last ||
    !previous
  ) {

    return {

      valid: false,

      reason:
        "Not enough completed candles"

    };

  }


  const range =
    last.high -
    last.low;


  if (
    range <= 0
  ) {

    return {

      valid: false,

      reason:
        "Invalid candle range"

    };

  }


  const body =
    Math.abs(
      last.close -
      last.open
    );


  const bodyRatio =
    body / range;


  if (
    bodyRatio < 0.55
  ) {

    return {

      valid: false,

      reason:
        "M5 candle body is too weak"

    };

  }


  if (
    direction ===
    "BULLISH"
  ) {

    if (

      last.close >
      last.open &&

      last.close >
      previous.high

    ) {

      return {

        valid: true,

        reason:
          "Completed M5 bullish breakout candle"

      };

    }


    return {

      valid: false,

      reason:
        "Waiting for completed M5 bullish breakout"

    };

  }


  if (
    direction ===
    "BEARISH"
  ) {

    if (

      last.close <
      last.open &&

      last.close <
      previous.low

    ) {

      return {

        valid: true,

        reason:
          "Completed M5 bearish breakout candle"

      };

    }


    return {

      valid: false,

      reason:
        "Waiting for completed M5 bearish breakout"

    };

  }


  return {

    valid: false,

    reason:
      "No direction"

  };

}


// ============================================================
// UPDATE DASHBOARD
// ============================================================

function updateDashboard() {

  setText(
    "price",
    formatPrice(
      marketData.price
    )
  );


  setText(
    "h4Trend",
    marketData.h4Trend
  );

  setText(
    "h1Trend",
    marketData.h1Trend
  );

  setText(
    "m15Structure",
    marketData.m15Structure
  );

  setText(
    "m5Structure",
    marketData.m5Structure
  );


  setText(
    "resistance1",
    formatPrice(
      marketData.resistance1
    )
  );

  setText(
    "resistance2",
    formatPrice(
      marketData.resistance2
    )
  );

  setText(
    "support1",
    formatPrice(
      marketData.support1
    )
  );

  setText(
    "support2",
    formatPrice(
      marketData.support2
    )
  );


  setText(
    "h4Rsi",
    formatNumber(
      marketData.h4Rsi,
      1
    )
  );

  setText(
    "h1Rsi",
    formatNumber(
      marketData.h1Rsi,
      1
    )
  );

  setText(
    "m15Rsi",
    formatNumber(
      marketData.m15Rsi,
      1
    )
  );

  setText(
    "m5Rsi",
    formatNumber(
      marketData.m5Rsi,
      1
    )
  );


  setText(
    "emaStructure",
    marketData.emaStructure
  );


  setText(
    "eurNews",
    marketData.news.eur
  );

  setText(
    "usdNews",
    marketData.news.usd
  );

  setText(
    "newsFilter",
    marketData.news.clear
      ? "✅ NEWS CLEAR"
      : "🚫 NEWS BLOCKED"
  );

  setText(
    "nextEvent",
    marketData.news.nextEvent
  );

  setText(
    "tradingRisk",
    marketData.news.risk
  );

}


// ============================================================
// ELITE SCALPING ENGINE
// ============================================================

function runEliteScalpingEngine() {

  clearScalpFields();


  // ----------------------------------------------------------
  // NEWS
  // ----------------------------------------------------------

  if (
    !marketData.news.clear
  ) {

    setScalpVerdict(
      "WAIT — NEWS RISK",
      "red"
    );


    setText(
      "scalpScore",
      "0 / 100"
    );


    setText(
      "scalpValidity",
      "High-impact EUR/USD news is not clear for the next 2 hours."
    );


    setText(
      "scalpTrigger",
      "Wait until the news window is clear."
    );


    setText(
      "scalpInvalidation",
      "No trade while news risk is unresolved."
    );


    return;

  }


  // ----------------------------------------------------------
  // H1
  // ----------------------------------------------------------

  const direction =
    marketData.h1Trend;


  if (

    direction !== "BULLISH" &&

    direction !== "BEARISH"

  ) {

    setScalpVerdict(
      "WAIT — H1 RANGE",
      "yellow"
    );


    setText(
      "scalpDirection",
      "WAIT"
    );


    setText(
      "scalpScore",
      "0 / 100"
    );


    setText(
      "scalpValidity",
      "Next 2 hours — waiting for clear H1 direction."
    );


    setText(
      "scalpTrigger",
      "H1 must establish bullish or bearish structure."
    );


    setText(
      "scalpInvalidation",
      "No directional H1 structure."
    );


    return;

  }


  // ----------------------------------------------------------
  // SCORE
  // ----------------------------------------------------------

  let score = 15;


  const reasons = [];


  reasons.push(
    "H1 directional structure"
  );


  // M15

  if (
    marketData.m15Structure ===
    direction
  ) {

    score += 15;

    reasons.push(
      "M15 aligned"
    );

  }


  // M5

  if (
    marketData.m5Structure ===
    direction
  ) {

    score += 20;

    reasons.push(
      "M5 aligned"
    );

  }


  // EMA

  const emaAligned =
    isEMAAligned(
      direction
    );


  if (
    emaAligned
  ) {

    score += 15;

    reasons.push(
      "M5 EMA20/EMA50 aligned"
    );

  }


  // RSI

  const rsiAligned =
    isRSIAligned(
      direction
    );


  if (
    rsiAligned
  ) {

    score += 15;

    reasons.push(
      "RSI confirmation"
    );

  }


  // M5 momentum

  const momentum =
    getM5MomentumTrigger(
      direction
    );


  if (
    momentum.valid
  ) {

    score += 20;

    reasons.push(
      "Completed M5 momentum trigger"
    );

  }


  // ----------------------------------------------------------
  // TIMEFRAME ALIGNMENT
  // ----------------------------------------------------------

  if (

    marketData.m15Structure !==
    direction ||

    marketData.m5Structure !==
    direction

  ) {

    setScalpVerdict(
      "WAIT — TIMEFRAME ALIGNMENT",
      "yellow"
    );


    setText(
      "scalpDirection",
      "WAIT"
    );


    setText(
      "scalpScore",
      score + " / 100"
    );


    setText(
      "scalpValidity",

      "NEXT 2 HOURS — H1 " +
      marketData.h1Trend +
      " | M15 " +
      marketData.m15Structure +
      " | M5 " +
      marketData.m5Structure

    );


    setText(
      "scalpTrigger",

      "Required: H1 → M15 → M5 all " +
      direction +
      "."

    );


    setText(
      "scalpInvalidation",

      "No scalp until timeframe alignment is restored."

    );


    return;

  }


  // ----------------------------------------------------------
  // EMA GATE
  // ----------------------------------------------------------

  if (
    !emaAligned
  ) {

    setScalpVerdict(
      "WAIT — EMA NOT ALIGNED",
      "yellow"
    );


    setText(
      "scalpDirection",
      direction
    );


    setText(
      "scalpScore",
      score + " / 100"
    );


    setText(
      "scalpValidity",

      "NEXT 2 HOURS — M5 EMA20/EMA50 confirmation required."

    );


    setText(
      "scalpTrigger",

      direction === "BULLISH"

        ? "EMA20 must be above EMA50 and price above EMA20."

        : "EMA20 must be below EMA50 and price below EMA20."

    );


    setText(
      "scalpInvalidation",
      "M5 EMA structure invalid."
    );


    return;

  }


  // ----------------------------------------------------------
  // RSI GATE
  // ----------------------------------------------------------

  if (
    !rsiAligned
  ) {

    setScalpVerdict(
      "WAIT — RSI NOT CONFIRMED",
      "yellow"
    );


    setText(
      "scalpDirection",
      direction
    );


    setText(
      "scalpScore",
      score + " / 100"
    );


    setText(
      "scalpValidity",

      "NEXT 2 HOURS — M5 RSI confirmation required."

    );


    setText(
      "scalpTrigger",

      direction === "BULLISH"

        ? "M5 RSI must be 52–68."

        : "M5 RSI must be 32–48."

    );


    setText(
      "scalpInvalidation",
      "M5 RSI outside confirmation zone."
    );


    return;

  }


  // ----------------------------------------------------------
  // PRICE ACTION GATE
  // ----------------------------------------------------------

  if (
    !momentum.valid
  ) {

    setScalpVerdict(
      "WAIT — PRICE ACTION",
      "yellow"
    );


    setText(
      "scalpDirection",
      direction
    );


    setText(
      "scalpScore",
      score + " / 100"
    );


    setText(
      "scalpValidity",

      "NEXT 2 HOURS — completed M5 momentum confirmation required."

    );


    setText(
      "scalpTrigger",
      momentum.reason
    );


    setText(
      "scalpInvalidation",

      "No entry without completed M5 candle confirmation."

    );


    return;

  }


  // ----------------------------------------------------------
  // ENTRY
  // ----------------------------------------------------------

  const entry =
    marketData.price;


  // ----------------------------------------------------------
  // CHASE PROTECTION
  // ----------------------------------------------------------

  const emaDistance =
    Math.abs(

      entry -
      marketData.m5Ema20

    );


  if (
    emaDistance >
    SCALP_MAX_EMA_DISTANCE
  ) {

    setScalpVerdict(
      "WAIT — DON'T CHASE",
      "yellow"
    );


    setText(
      "scalpDirection",
      direction
    );


    setText(
      "scalpScore",
      score + " / 100"
    );


    setText(
      "scalpValidity",

      "NEXT 2 HOURS — price is too far from M5 EMA20."

    );


    setText(
      "scalpTrigger",

      "Wait for a controlled pullback toward EMA20."

    );


    setText(
      "scalpInvalidation",

      "Entry is extended from EMA20."

    );


    return;

  }


  // ----------------------------------------------------------
  // STOP LOSS
  // ----------------------------------------------------------

  const lastCandle =
    getLastCompletedCandle(
      marketData.m5
    );


  let stopLoss;


  if (
    direction ===
    "BULLISH"
  ) {

    stopLoss =

      Math.min(

        marketData.support1,

        lastCandle.low

      ) -

      SCALP_SL_BUFFER;

  } else {

    stopLoss =

      Math.max(

        marketData.resistance1,

        lastCandle.high

      ) +

      SCALP_SL_BUFFER;

  }


  const risk =
    Math.abs(
      entry -
      stopLoss
    );


  const riskPips =
    risk * 10000;


  // ----------------------------------------------------------
  // RISK LIMIT
  // ----------------------------------------------------------

  if (
    riskPips <
    SCALP_MIN_RISK_PIPS
  ) {

    setScalpVerdict(
      "WAIT — RISK TOO SMALL",
      "yellow"
    );


    setText(
      "scalpDirection",
      direction
    );


    setText(
      "scalpScore",
      score + " / 100"
    );


    setText(
      "scalpValidity",

      "NEXT 2 HOURS — risk must be at least 3 pips."

    );


    setText(
      "scalpTrigger",

      "Wait for a cleaner structure with sufficient stop distance."

    );


    setText(
      "scalpInvalidation",

      "Risk below minimum threshold."

    );


    return;

  }


  if (
    riskPips >
    SCALP_MAX_RISK_PIPS
  ) {

    setScalpVerdict(
      "WAIT — RISK TOO HIGH",
      "yellow"
    );


    setText(
      "scalpDirection",
      direction
    );


    setText(
      "scalpScore",
      score + " / 100"
    );


    setText(
      "scalpValidity",

      "NEXT 2 HOURS — risk must be between 3 and 15 pips."

    );


    setText(
      "scalpTrigger",

      "Wait for a tighter valid structure."

    );


    setText(
      "scalpInvalidation",

      "Risk exceeds 15 pips."

    );


    return;

  }


  // ----------------------------------------------------------
  // TARGETS
  // ----------------------------------------------------------

  const tp1 =

    direction === "BULLISH"

      ? entry +
        risk * 1.5

      : entry -
        risk * 1.5;


  const tp2 =

    direction === "BULLISH"

      ? entry +
        risk * 2

      : entry -
        risk * 2;


  const rr =
    2.0;


  // ----------------------------------------------------------
  // S/R ROOM
  // ----------------------------------------------------------

  const roomOK =
    checkHigherTimeframeRoom(

      direction,

      entry,

      tp2

    );


  if (!roomOK) {

    setScalpVerdict(
      "WAIT — S/R BLOCKS 2R",
      "yellow"
    );


    setText(
      "scalpDirection",
      direction
    );


    setText(
      "scalpEntry",
      formatPrice(entry)
    );


    setText(
      "scalpSL",
      formatPrice(stopLoss)
    );


    setText(
      "scalpTP1",
      formatPrice(tp1)
    );


    setText(
      "scalpTP2",
      formatPrice(tp2)
    );


    setText(
      "scalpRR",
      "2.00R"
    );


    setText(
      "scalpScore",
      score + " / 100"
    );


    setText(
      "scalpValidity",

      "NEXT 2 HOURS — higher-timeframe S/R blocks the 2R target."

    );


    setText(
      "scalpTrigger",

      "Wait for price to clear the nearby S/R zone."

    );


    setText(
      "scalpInvalidation",

      "2R target is blocked."

    );


    return;

  }


  // ----------------------------------------------------------
  // SCORE GATE
  // ----------------------------------------------------------

  if (
    score <
    SCALP_MIN_SCORE
  ) {

    setScalpVerdict(
      "WAIT — SCORE BELOW A+",
      "yellow"
    );


    setText(
      "scalpDirection",
      direction
    );


    setText(
      "scalpScore",
      score + " / 100"
    );


    setText(
      "scalpValidity",

      "NEXT 2 HOURS — Elite threshold is 80/100."

    );


    setText(
      "scalpTrigger",

      "Wait for stronger confluence."

    );


    setText(
      "scalpInvalidation",

      "Setup remains below Elite score threshold."

    );


    return;

  }


  // ----------------------------------------------------------
  // ELITE SCALP
  // ----------------------------------------------------------

  setScalpVerdict(

    "ELITE SCALP — " +
    direction,

    direction ===
      "BULLISH"

      ? "green"

      : "red"

  );


  setText(
    "scalpDirection",
    direction
  );


  setText(
    "scalpEntry",
    formatPrice(entry)
  );


  setText(
    "scalpSL",
    formatPrice(stopLoss)
  );


  setText(
    "scalpTP1",
    formatPrice(tp1)
  );


  setText(
    "scalpTP2",
    formatPrice(tp2)
  );


  setText(
    "scalpRR",
    rr.toFixed(2) +
    "R"
  );


  setText(
    "scalpScore",
    score + " / 100"
  );


  setText(

    "scalpValidity",

    "NEXT 120 MINUTES — " +

    "H1/M15/M5 aligned | " +

    "EMA aligned | " +

    "RSI confirmed | " +

    "Risk " +

    riskPips.toFixed(1) +

    " pips | " +

    "1:2+ RR | " +

    "S/R room OK"

  );


  setText(

    "scalpTrigger",

    "Completed M5 momentum candle confirmed. " +

    reasons.join(
      " • "
    )

  );


  setText(

    "scalpInvalidation",

    direction === "BULLISH"

      ? "Below " +
        formatPrice(
          stopLoss
        )

      : "Above " +
        formatPrice(
          stopLoss
        )

  );

}


// ============================================================
// EMA ALIGNMENT
// ============================================================

function isEMAAligned(
  direction
) {

  const price =
    marketData.price;


  const ema20 =
    marketData.m5Ema20;


  const ema50 =
    marketData.m5Ema50;


  if (

    price === null ||

    ema20 === null ||

    ema50 === null

  ) {

    return false;

  }


  if (
    direction ===
    "BULLISH"
  ) {

    return (

      ema20 > ema50 &&

      price > ema20

    );

  }


  if (
    direction ===
    "BEARISH"
  ) {

    return (

      ema20 < ema50 &&

      price < ema20

    );

  }


  return false;

}


// ============================================================
// RSI ALIGNMENT
// ============================================================

function isRSIAligned(
  direction
) {

  const rsi =
    marketData.m5Rsi;


  if (
    rsi === null
  ) {

    return false;

  }


  if (
    direction ===
    "BULLISH"
  ) {

    return (

      rsi >=
        BULLISH_RSI_MIN &&

      rsi <=
        BULLISH_RSI_MAX

    );

  }


  if (
    direction ===
    "BEARISH"
  ) {

    return (

      rsi >=
        BEARISH_RSI_MIN &&

      rsi <=
        BEARISH_RSI_MAX

    );

  }


  return false;

}


// ============================================================
// S/R ROOM
// ============================================================

function checkHigherTimeframeRoom(

  direction,

  entry,

  tp2

) {

  if (
    direction ===
    "BULLISH"
  ) {

    if (

      marketData.resistance1 &&

      marketData.resistance1 >
        entry &&

      marketData.resistance1 <=
        tp2

    ) {

      return false;

    }

  }


  if (
    direction ===
    "BEARISH"
  ) {

    if (

      marketData.support1 &&

      marketData.support1 <
        entry &&

      marketData.support1 >=
        tp2

    ) {

      return false;

    }

  }


  return true;

}


// ============================================================
// A+ SNIPER ENGINE
// ============================================================

function runSniperEngine() {

  clearSniperFields();


  if (
    !marketData.news.clear
  ) {

    setText(
      "sniperStatus",
      "WAIT — NEWS RISK"
    );


    setText(
      "direction",
      "WAIT"
    );


    setText(
      "validity",
      "News filter is not clear."
    );


    return;

  }


  if (

    marketData.h4Trend ===
      "RANGE" ||

    marketData.h1Trend ===
      "RANGE"

  ) {

    setText(
      "sniperStatus",
      "WAIT — NO CLEAR TREND"
    );


    setText(
      "direction",
      "WAIT"
    );


    setText(
      "validity",
      "H4/H1 directional structure required."
    );


    return;

  }


  if (

    marketData.h4Trend !==
    marketData.h1Trend

  ) {

    setText(
      "sniperStatus",
      "WAIT — H4/H1 CONFLICT"
    );


    setText(
      "direction",
      "WAIT"
    );


    setText(

      "validity",

      "H4 " +
      marketData.h4Trend +
      " but H1 " +
      marketData.h1Trend +
      ". Higher-timeframe alignment required."

    );


    setText(

      "trigger",

      "Wait for H1 to align " +
      marketData.h4Trend

    );


    setText(
      "invalidation",
      "Higher timeframe conflict"
    );


    return;

  }


  const direction =
    marketData.h4Trend;


  let score = 40;


  if (
    marketData.m15Structure ===
    direction
  ) {

    score += 15;

  }


  if (
    marketData.m5Structure ===
    direction
  ) {

    score += 15;

  }


  if (
    marketData.emaStructure ===
    direction
  ) {

    score += 15;

  }


  const rsiOK =

    direction ===
      "BULLISH"

      ? (

          marketData.m15Rsi >=
            50 &&

          marketData.m5Rsi >=
            50

        )

      : (

          marketData.m15Rsi <=
            50 &&

          marketData.m5Rsi <=
            50

        );


  if (rsiOK) {

    score += 10;

  }


  if (
    score < 75
  ) {

    setText(
      "sniperStatus",
      "WAIT — SETUP BELOW A+"
    );


    setText(
      "direction",
      direction
    );


    setText(
      "setupScore",
      score + " / 100"
    );


    setText(
      "validity",
      "Waiting for stronger confluence."
    );


    return;

  }


  const entry =
    marketData.price;


  let stopLoss;


  if (
    direction ===
    "BULLISH"
  ) {

    stopLoss =
      marketData.support1 -
      0.00010;

  } else {

    stopLoss =
      marketData.resistance1 +
      0.00010;

  }


  const risk =
    Math.abs(
      entry -
      stopLoss
    );


  const tp1 =

    direction ===
      "BULLISH"

      ? entry + risk

      : entry - risk;


  const tp2 =

    direction ===
      "BULLISH"

      ? entry +
        risk * 2

      : entry -
        risk * 2;


  const tp3 =

    direction ===
      "BULLISH"

      ? entry +
        risk * 3

      : entry -
        risk * 3;


  setText(

    "sniperStatus",

    "A+ SNIPER — " +
    direction

  );


  setText(
    "direction",
    direction
  );


  setText(
    "entry",
    formatPrice(entry)
  );


  setText(
    "stopLoss",
    formatPrice(stopLoss)
  );


  setText(
    "tp1",
    formatPrice(tp1)
  );


  setText(
    "tp2",
    formatPrice(tp2)
  );


  setText(
    "tp3",
    formatPrice(tp3)
  );


  setText(
    "riskReward",
    "1:3.00"
  );


  setText(

    "validity",

    "Setup valid while structure and news remain unchanged."

  );


  setText(

    "trigger",

    "M15/M5 confirmation in the " +
    direction.toLowerCase() +
    " direction."

  );


  setText(
    "invalidation",
    formatPrice(stopLoss)
  );


  setText(
    "setupScore",
    score + " / 100"
  );

}


// ============================================================
// PRO ANALYSIS
// ============================================================

function runProAnalysis() {

  if (
    !marketData.news.clear
  ) {

    setText(
      "proVerdict",
      "WAIT — NEWS RISK"
    );


    setText(

      "proExplanation",

      "High-impact EUR/USD news is blocking the setup."

    );


    return;

  }


  if (

    marketData.h4Trend ===
      "RANGE" ||

    marketData.h1Trend ===
      "RANGE"

  ) {

    setText(
      "proVerdict",
      "WAIT — RANGE"
    );


    setText(

      "proExplanation",

      "Higher timeframe structure is not directional enough."

    );


    return;

  }


  if (

    marketData.h4Trend !==
    marketData.h1Trend

  ) {

    setText(
      "proVerdict",
      "WAIT — H4/H1 CONFLICT"
    );


    setText(

      "proExplanation",

      "H4 is " +
      marketData.h4Trend +
      " while H1 is " +
      marketData.h1Trend +
      ". Wait for higher-timeframe alignment."

    );


    return;

  }


  const direction =
    marketData.h1Trend;


  const aligned =

    marketData.m15Structure ===
      direction &&

    marketData.m5Structure ===
      direction &&

    marketData.emaStructure ===
      direction;


  if (!aligned) {

    setText(
      "proVerdict",
      "WAIT — LOWER TF CONFLICT"
    );


    setText(

      "proExplanation",

      "H4/H1 direction is established, but M15/M5/EMA confirmation is incomplete."

    );


    return;

  }


  setText(

    "proVerdict",

    "ALIGNED — " +
    direction

  );


  setText(

    "proExplanation",

    "H4/H1 direction is aligned with M15/M5 structure and EMA conditions. Check the Elite Scalping section for the completed-candle entry trigger."

  );

}


// ============================================================
// CLEAR SNIPER
// ============================================================

function clearSniperFields() {

  setText(
    "direction",
    "—"
  );

  setText(
    "entry",
    "—"
  );

  setText(
    "stopLoss",
    "—"
  );

  setText(
    "tp1",
    "—"
  );

  setText(
    "tp2",
    "—"
  );

  setText(
    "tp3",
    "—"
  );

  setText(
    "riskReward",
    "—"
  );

  setText(
    "validity",
    "—"
  );

  setText(
    "trigger",
    "—"
  );

  setText(
    "invalidation",
    "—"
  );

  setText(
    "setupScore",
    "—"
  );

}


// ============================================================
// CLEAR SCALP
// ============================================================

function clearScalpFields() {

  setText(
    "scalpDirection",
    "—"
  );

  setText(
    "scalpEntry",
    "—"
  );

  setText(
    "scalpSL",
    "—"
  );

  setText(
    "scalpTP1",
    "—"
  );

  setText(
    "scalpTP2",
    "—"
  );

  setText(
    "scalpRR",
    "—"
  );

  setText(
    "scalpScore",
    "—"
  );

  setText(
    "scalpValidity",
    "—"
  );

  setText(
    "scalpTrigger",
    "—"
  );

  setText(
    "scalpInvalidation",
    "—"
  );

}


// ============================================================
// ERROR STATE
// ============================================================

function showErrorState(
  error
) {

  const message =

    error &&
    error.message

      ? error.message

      : "Unknown error";


  setText(
    "price",
    "ERROR"
  );


  setText(
    "sniperStatus",
    "DATA ERROR"
  );


  setText(
    "scalpVerdict",
    "DATA ERROR"
  );


  setText(
    "proVerdict",
    "DATA ERROR"
  );


  setText(
    "scalpValidity",
    message
  );


  setText(
    "proExplanation",
    message
  );

}


// ============================================================
// UI HELPERS
// ============================================================

function setText(
  id,
  value
) {

  const element =
    document.getElementById(
      id
    );


  if (element) {

    element.textContent =

      value === null ||
      value === undefined

        ? "—"

        : value;

  }

}


function setScalpVerdict(
  text,
  type
) {

  const element =
    document.getElementById(
      "scalpVerdict"
    );


  if (!element) {
    return;
  }


  element.textContent =
    text;


  element.className =
    "big-status " +
    type;

}


function setStatus(
  text,
  type
) {

  const element =
    document.getElementById(
      "priceStatus"
    );


  if (!element) {
    return;
  }


  element.textContent =
    text;


  element.className =
    type || "";

}


function formatPrice(
  value
) {

  if (

    value === null ||

    value === undefined ||

    isNaN(value)

  ) {

    return "—";

  }


  return Number(
    value
  ).toFixed(5);

}


function formatNumber(
  value,
  decimals
) {

  if (

    value === null ||

    value === undefined ||

    isNaN(value)

  ) {

    return "—";

  }


  return Number(
    value
  ).toFixed(
    decimals
  );

}
