// ============================================================
// EUR/USD SNIPER DASHBOARD
// Market Structure + S/R + Indicators + News + Sniper + Elite Scalp
// ============================================================

// IMPORTANT:
// Use a NEW Twelve Data API key.
// Do NOT put your previously exposed key here.
const API_KEY = "8908432b6c784bc49aad6ccf64845991";

const PRICE_URL =
  `https://api.twelvedata.com/price?symbol=EUR/USD&apikey=${API_KEY}`;

const TIME_SERIES_URL =
  "https://api.twelvedata.com/time_series";

const NEWS_URL =
  "https://xoomar.com/api/markets/calendar?importance=high";

// ============================================================
// ELITE SCALP SETTINGS
// ============================================================

const SCALP_WINDOW_MINUTES = 120;

const SCALP_MIN_SCORE = 80;

const SCALP_MIN_RR = 2.0;

// EUR/USD:
// 0.00010 = approximately 1 pip
const SCALP_MIN_RISK_PIPS = 3;
const SCALP_MAX_RISK_PIPS = 15;

// Maximum distance from EMA20 before we consider price
// too extended for a fresh scalp entry.
const SCALP_MAX_EMA_DISTANCE = 0.00050;

// Small safety buffer beyond M5 structure.
const SCALP_SL_BUFFER = 0.00010;

// RSI momentum zones.
const SCALP_BULL_RSI = 52;
const SCALP_BEAR_RSI = 48;

// Avoid entering extremely stretched RSI conditions.
const SCALP_BULL_RSI_MAX = 68;
const SCALP_BEAR_RSI_MIN = 32;

let marketData = {};
let newsClear = false;

// ============================================================
// MAIN LOAD
// ============================================================

async function loadMarketData() {

  try {

    newsClear = false;

    setText(
      "priceStatus",
      "LOADING MARKET DATA..."
    );

    await fetchPrice();

    await loadCandles();

    // News MUST load before technical engines.
    await loadNews();

    updateTechnicalAnalysis();

    setText(
      "priceStatus",
      "MARKET DATA LOADED"
    );

  } catch (error) {

    console.error(
      "Market data error:",
      error
    );

    setText(
      "priceStatus",
      "DATA ERROR — CHECK API"
    );
  }
}

// ============================================================
// HELPERS
// ============================================================

function setText(id, value) {

  const el =
    document.getElementById(id);

  if (el) {
    el.textContent = value;
  }
}

// ============================================================
// FORMAT PRICE
// ============================================================

function formatPrice(value) {

  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return Number(value).toFixed(5);
}

// ============================================================
// LIVE PRICE
// ============================================================

async function fetchPrice() {

  const response =
    await fetch(
      PRICE_URL,
      {
        cache: "no-store"
      }
    );

  const data =
    await response.json();

  if (!data.price) {

    console.error(
      "Price API error:",
      data
    );

    throw new Error(
      "Price unavailable"
    );
  }

  marketData.price =
    Number(data.price);

  setText(
    "price",
    formatPrice(
      marketData.price
    )
  );
}

// ============================================================
// CANDLE DATA
// ============================================================

async function getCandles(
  interval,
  outputsize = 100
) {

  const url =
    `${TIME_SERIES_URL}?symbol=EUR/USD` +
    `&interval=${interval}` +
    `&outputsize=${outputsize}` +
    `&apikey=${API_KEY}`;

  const response =
    await fetch(
      url,
      {
        cache: "no-store"
      }
    );

  const data =
    await response.json();

  if (
    !data.values ||
    !Array.isArray(data.values)
  ) {

    console.error(
      "Candle API error:",
      data
    );

    return [];
  }

  return data.values
    .map(c => ({
      datetime: c.datetime,
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close)
    }))
    .filter(c =>
      Number.isFinite(c.open) &&
      Number.isFinite(c.high) &&
      Number.isFinite(c.low) &&
      Number.isFinite(c.close)
    )
    .reverse();
}

// ============================================================
// LOAD ALL CANDLES
// ============================================================

async function loadCandles() {

  const [
    h4,
    h1,
    m15,
    m5
  ] =
    await Promise.all([
      getCandles("4h", 100),
      getCandles("1h", 100),
      getCandles("15min", 100),
      getCandles("5min", 100)
    ]);

  marketData.h4 =
    h4;

  marketData.h1 =
    h1;

  marketData.m15 =
    m15;

  marketData.m5 =
    m5;

  if (
    !h4.length ||
    !h1.length ||
    !m15.length ||
    !m5.length
  ) {

    throw new Error(
      "Insufficient candle data"
    );
  }
}

// ============================================================
// SWING HIGH DETECTION
// ============================================================

function getSwingHighs(
  candles,
  strength = 2
) {

  const swings = [];

  for (
    let i = strength;
    i < candles.length - strength;
    i++
  ) {

    let isSwing = true;

    for (
      let j = 1;
      j <= strength;
      j++
    ) {

      if (
        candles[i].high <=
          candles[i - j].high ||
        candles[i].high <=
          candles[i + j].high
      ) {

        isSwing = false;
        break;
      }
    }

    if (isSwing) {

      swings.push({
        index: i,
        price: candles[i].high
      });
    }
  }

  return swings;
}

// ============================================================
// SWING LOW DETECTION
// ============================================================

function getSwingLows(
  candles,
  strength = 2
) {

  const swings = [];

  for (
    let i = strength;
    i < candles.length - strength;
    i++
  ) {

    let isSwing = true;

    for (
      let j = 1;
      j <= strength;
      j++
    ) {

      if (
        candles[i].low >=
          candles[i - j].low ||
        candles[i].low >=
          candles[i + j].low
      ) {

        isSwing = false;
        break;
      }
    }

    if (isSwing) {

      swings.push({
        index: i,
        price: candles[i].low
      });
    }
  }

  return swings;
}

// ============================================================
// MARKET STRUCTURE
// ============================================================

function getStructure(candles) {

  if (
    !candles ||
    candles.length < 15
  ) {
    return "RANGE";
  }

  const recent =
    candles.slice(-60);

  const swingHighs =
    getSwingHighs(
      recent,
      2
    );

  const swingLows =
    getSwingLows(
      recent,
      2
    );

  // ----------------------------------------------------------
  // PRIMARY STRUCTURE
  // ----------------------------------------------------------

  if (
    swingHighs.length >= 2 &&
    swingLows.length >= 2
  ) {

    const previousHigh =
      swingHighs[
        swingHighs.length - 2
      ].price;

    const latestHigh =
      swingHighs[
        swingHighs.length - 1
      ].price;

    const previousLow =
      swingLows[
        swingLows.length - 2
      ].price;

    const latestLow =
      swingLows[
        swingLows.length - 1
      ].price;

    if (
      latestHigh > previousHigh &&
      latestLow > previousLow
    ) {

      return "BULLISH";
    }

    if (
      latestHigh < previousHigh &&
      latestLow < previousLow
    ) {

      return "BEARISH";
    }
  }

  // ----------------------------------------------------------
  // PRICE MOVEMENT FALLBACK
  // ----------------------------------------------------------

  const firstIndex =
    Math.max(
      0,
      recent.length - 20
    );

  const firstClose =
    recent[
      firstIndex
    ].close;

  const lastClose =
    recent[
      recent.length - 1
    ].close;

  const priceChange =
    lastClose -
    firstClose;

  const rangeHigh =
    Math.max(
      ...recent.map(
        c => c.high
      )
    );

  const rangeLow =
    Math.min(
      ...recent.map(
        c => c.low
      )
    );

  const totalRange =
    rangeHigh -
    rangeLow;

  if (
    totalRange <= 0
  ) {

    return "RANGE";
  }

  const movementRatio =
    Math.abs(
      priceChange
    ) /
    totalRange;

  if (
    movementRatio >= 0.35
  ) {

    if (
      priceChange > 0
    ) {

      return "BULLISH";
    }

    if (
      priceChange < 0
    ) {

      return "BEARISH";
    }
  }

  return "RANGE";
}

// ============================================================
// REMOVE CLUSTERED LEVELS
// ============================================================

function uniqueLevels(
  levels,
  minimumDistance = 0.00025
) {

  const result = [];

  for (
    const level of levels
  ) {

    if (
      !result.some(
        existing =>
          Math.abs(
            existing -
            level
          ) < minimumDistance
      )
    ) {

      result.push(level);
    }
  }

  return result;
}

// ============================================================
// SUPPORT / RESISTANCE
// ============================================================

function calculateLevels(
  candles,
  price
) {

  if (
    !candles ||
    candles.length < 10
  ) {

    return {
      resistance1: null,
      resistance2: null,
      support1: null,
      support2: null
    };
  }

  const recent =
    candles.slice(-100);

  const swingHighs =
    getSwingHighs(
      recent,
      2
    )
    .map(
      x => x.price
    );

  const swingLows =
    getSwingLows(
      recent,
      2
    )
    .map(
      x => x.price
    );

  let resistances =
    swingHighs
      .filter(
        level =>
          level > price
      )
      .sort(
        (a, b) =>
          a - b
      );

  resistances =
    uniqueLevels(
      resistances
    );

  let supports =
    swingLows
      .filter(
        level =>
          level < price
      )
      .sort(
        (a, b) =>
          b - a
      );

  supports =
    uniqueLevels(
      supports
    );

  // ----------------------------------------------------------
  // RESISTANCE FALLBACK
  // ----------------------------------------------------------

  if (
    resistances.length < 2
  ) {

    const historicalHighs =
      recent
        .map(
          c => c.high
        )
        .filter(
          level =>
            level > price
        )
        .sort(
          (a, b) =>
            a - b
        );

    for (
      const level of historicalHighs
    ) {

      if (
        !resistances.some(
          r =>
            Math.abs(
              r - level
            ) < 0.00025
        )
      ) {

        resistances.push(
          level
        );
      }

      if (
        uniqueLevels(
          resistances
        ).length >= 2
      ) {

        break;
      }
    }

    resistances =
      uniqueLevels(
        resistances.sort(
          (a, b) =>
            a - b
        )
      );
  }

  // ----------------------------------------------------------
  // SUPPORT FALLBACK
  // ----------------------------------------------------------

  if (
    supports.length < 2
  ) {

    const historicalLows =
      recent
        .map(
          c => c.low
        )
        .filter(
          level =>
            level < price
        )
        .sort(
          (a, b) =>
            b - a
        );

    for (
      const level of historicalLows
    ) {

      if (
        !supports.some(
          s =>
            Math.abs(
              s - level
            ) < 0.00025
        )
      ) {

        supports.push(
          level
        );
      }

      if (
        uniqueLevels(
          supports
        ).length >= 2
      ) {

        break;
      }
    }

    supports =
      uniqueLevels(
        supports.sort(
          (a, b) =>
            b - a
        )
      );
  }

  return {

    resistance1:
      resistances[0] ||
      null,

    resistance2:
      resistances[1] ||
      null,

    support1:
      supports[0] ||
      null,

    support2:
      supports[1] ||
      null
  };
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
    candles.length <= period
  ) {

    return null;
  }

  let gains = 0;
  let losses = 0;

  for (
    let i = 1;
    i <= period;
    i++
  ) {

    const change =
      candles[i].close -
      candles[i - 1].close;

    if (
      change >= 0
    ) {

      gains += change;

    } else {

      losses +=
        Math.abs(
          change
        );
    }
  }

  let averageGain =
    gains /
    period;

  let averageLoss =
    losses /
    period;

  for (
    let i = period + 1;
    i < candles.length;
    i++
  ) {

    const change =
      candles[i].close -
      candles[i - 1].close;

    const gain =
      change > 0
        ? change
        : 0;

    const loss =
      change < 0
        ? Math.abs(change)
        : 0;

    averageGain =
      (
        averageGain *
        (period - 1) +
        gain
      ) /
      period;

    averageLoss =
      (
        averageLoss *
        (period - 1) +
        loss
      ) /
      period;
  }

  if (
    averageLoss === 0
  ) {

    return 100;
  }

  const rs =
    averageGain /
    averageLoss;

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
  period = 20
) {

  if (
    !candles ||
    candles.length < period
  ) {

    return null;
  }

  const multiplier =
    2 /
    (period + 1);

  let ema =
    candles
      .slice(
        0,
        period
      )
      .reduce(
        (sum, c) =>
          sum + c.close,
        0
      ) /
    period;

  for (
    let i = period;
    i < candles.length;
    i++
  ) {

    ema =
      (
        candles[i].close -
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

function getEMAStructure(
  candles
) {

  const ema20 =
    calculateEMA(
      candles,
      20
    );

  const ema50 =
    calculateEMA(
      candles,
      50
    );

  if (
    ema20 === null ||
    ema50 === null
  ) {

    return "RANGE";
  }

  if (
    ema20 > ema50
  ) {

    return "BULLISH";
  }

  if (
    ema20 < ema50
  ) {

    return "BEARISH";
  }

  return "RANGE";
}

// ============================================================
// LAST COMPLETED CANDLE
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

  // The newest candle can still be forming.
  // Use the previous candle as the completed candle.
  return candles[
    candles.length - 2
  ];
}

// ============================================================
// PREVIOUS COMPLETED CANDLE
// ============================================================

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
// CANDLE BODY RATIO
// ============================================================

function getCandleBodyRatio(
  candle
) {

  if (!candle) {
    return 0;
  }

  const range =
    candle.high -
    candle.low;

  if (
    range <= 0
  ) {

    return 0;
  }

  return (
    Math.abs(
      candle.close -
      candle.open
    ) /
    range
  );
}

// ============================================================
// M5 MOMENTUM TRIGGER
// ============================================================

function getM5MomentumTrigger(
  candles,
  direction
) {

  const last =
    getLastCompletedCandle(
      candles
    );

  const previous =
    getPreviousCompletedCandle(
      candles
    );

  if (
    !last ||
    !previous
  ) {

    return false;
  }

  const bodyRatio =
    getCandleBodyRatio(
      last
    );

  // ----------------------------------------------------------
  // BULLISH BREAKOUT
  // ----------------------------------------------------------

  if (
    direction === "BULLISH"
  ) {

    return (
      last.close >
        last.open &&

      last.close >
        previous.high &&

      bodyRatio >= 0.55
    );
  }

  // ----------------------------------------------------------
  // BEARISH BREAKOUT
  // ----------------------------------------------------------

  if (
    direction === "BEARISH"
  ) {

    return (
      last.close <
        last.open &&

      last.close <
        previous.low &&

      bodyRatio >= 0.55
    );
  }

  return false;
}

// ============================================================
// TECHNICAL ANALYSIS
// ============================================================

function updateTechnicalAnalysis() {

  const h4 =
    marketData.h4;

  const h1 =
    marketData.h1;

  const m15 =
    marketData.m15;

  const m5 =
    marketData.m5;

  const price =
    marketData.price;

  const h4Trend =
    getStructure(
      h4
    );

  const h1Trend =
    getStructure(
      h1
    );

  const m15Structure =
    getStructure(
      m15
    );

  const m5Structure =
    getStructure(
      m5
    );

  const h4Rsi =
    calculateRSI(
      h4
    );

  const h1Rsi =
    calculateRSI(
      h1
    );

  const m15Rsi =
    calculateRSI(
      m15
    );

  const m5Rsi =
    calculateRSI(
      m5
    );

  const emaStructure =
    getEMAStructure(
      m15
    );

  const levels =
    calculateLevels(
      m15,
      price
    );

  setText(
    "h4Trend",
    h4Trend
  );

  setText(
    "h1Trend",
    h1Trend
  );

  setText(
    "m15Structure",
    m15Structure
  );

  setText(
    "m5Structure",
    m5Structure
  );

  setText(
    "h4Rsi",
    h4Rsi !== null
      ? h4Rsi.toFixed(1)
      : "—"
  );

  setText(
    "h1Rsi",
    h1Rsi !== null
      ? h1Rsi.toFixed(1)
      : "—"
  );

  setText(
    "m15Rsi",
    m15Rsi !== null
      ? m15Rsi.toFixed(1)
      : "—"
  );

  setText(
    "m5Rsi",
    m5Rsi !== null
      ? m5Rsi.toFixed(1)
      : "—"
  );

  setText(
    "emaStructure",
    emaStructure
  );

  setText(
    "resistance1",
    formatPrice(
      levels.resistance1
    )
  );

  setText(
    "resistance2",
    formatPrice(
      levels.resistance2
    )
  );

  setText(
    "support1",
    formatPrice(
      levels.support1
    )
  );

  setText(
    "support2",
    formatPrice(
      levels.support2
    )
  );

  marketData.h4Trend =
    h4Trend;

  marketData.h1Trend =
    h1Trend;

  marketData.m15Structure =
    m15Structure;

  marketData.m5Structure =
    m5Structure;

  marketData.h4Rsi =
    h4Rsi;

  marketData.h1Rsi =
    h1Rsi;

  marketData.m15Rsi =
    m15Rsi;

  marketData.m5Rsi =
    m5Rsi;

  marketData.emaStructure =
    emaStructure;

  marketData.levels =
    levels;

  runSniperEngine();

  runScalpingEngine();

  runProEngine();
}

// ============================================================
// SNIPER ENGINE
// ============================================================

function runSniperEngine() {

  const h4 =
    marketData.h4Trend;

  const h1 =
    marketData.h1Trend;

  const m15 =
    marketData.m15Structure;

  const m5 =
    marketData.m5Structure;

  const price =
    marketData.price;

  const levels =
    marketData.levels;

  const ema =
    marketData.emaStructure;

  const m15Rsi =
    marketData.m15Rsi;

  const m5Rsi =
    marketData.m5Rsi;

  // ----------------------------------------------------------
  // NEWS
  // ----------------------------------------------------------

  if (!newsClear) {

    setText(
      "sniperStatus",
      "WAIT — NEWS FILTER NOT CONFIRMED"
    );

    setText(
      "direction",
      "WAIT"
    );

    setText(
      "validity",
      "Wait until the high-impact news filter is clear."
    );

    setText(
      "trigger",
      "No trade before news confirmation"
    );

    setText(
      "invalidation",
      "News filter closed"
    );

    clearTradeFields();

    return;
  }

  // ----------------------------------------------------------
  // H4 RANGE
  // ----------------------------------------------------------

  if (
    h4 === "RANGE"
  ) {

    setText(
      "sniperStatus",
      "WAIT — H4 NO CLEAR DIRECTION"
    );

    setText(
      "direction",
      "WAIT"
    );

    setText(
      "validity",
      "H4 is RANGE. Clear H4 trend required."
    );

    setText(
      "trigger",
      "Wait for H4 directional structure"
    );

    setText(
      "invalidation",
      "No A+ setup while H4 remains RANGE"
    );

    clearTradeFields();

    return;
  }

  // ----------------------------------------------------------
  // H4 / H1 CONFLICT
  // ----------------------------------------------------------

  if (
    h4 !== h1
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
      `H4 ${h4} but H1 ${h1}. Higher-timeframe alignment required.`
    );

    setText(
      "trigger",
      `Wait for H1 to align ${h4}`
    );

    setText(
      "invalidation",
      "Higher timeframe conflict"
    );

    clearTradeFields();

    return;
  }

  const direction =
    h4;

  let score = 0;

  if (
    m15 === direction
  ) {
    score += 25;
  }

  if (
    m5 === direction
  ) {
    score += 20;
  }

  if (
    ema === direction
  ) {
    score += 20;
  }

  if (
    direction === "BULLISH" &&
    m15Rsi !== null &&
    m15Rsi > 50
  ) {

    score += 15;
  }

  if (
    direction === "BEARISH" &&
    m15Rsi !== null &&
    m15Rsi < 50
  ) {

    score += 15;
  }

  if (
    direction === "BULLISH" &&
    m5Rsi !== null &&
    m5Rsi > 50
  ) {

    score += 10;
  }

  if (
    direction === "BEARISH" &&
    m5Rsi !== null &&
    m5Rsi < 50
  ) {

    score += 10;
  }

  if (newsClear) {
    score += 10;
  }

  setText(
    "setupScore",
    `${score}/100`
  );

  if (
    score < 75
  ) {

    setText(
      "sniperStatus",
      `WAIT — SETUP SCORE ${score}/100`
    );

    setText(
      "direction",
      direction
    );

    setText(
      "validity",
      "Technical alignment is not strong enough for A+."
    );

    setText(
      "trigger",
      `Need M15/M5 confirmation in ${direction} direction`
    );

    setText(
      "invalidation",
      "Score below A+ threshold"
    );

    clearTradeFields();

    return;
  }

  const entry =
    price;

  let stopLoss;
  let tp1;
  let tp2;
  let tp3;

  if (
    direction === "BULLISH"
  ) {

    stopLoss =
      levels.support1 ||
      entry - 0.0010;

    const riskDistance =
      entry -
      stopLoss;

    if (
      riskDistance <= 0
    ) {

      setText(
        "sniperStatus",
        "WAIT — INVALID LONG STRUCTURE"
      );

      clearTradeFields();

      return;
    }

    tp1 =
      entry +
      riskDistance * 1.5;

    tp2 =
      entry +
      riskDistance * 2.0;

    tp3 =
      entry +
      riskDistance * 3.0;

  } else {

    stopLoss =
      levels.resistance1 ||
      entry + 0.0010;

    const riskDistance =
      stopLoss -
      entry;

    if (
      riskDistance <= 0
    ) {

      setText(
        "sniperStatus",
        "WAIT — INVALID SHORT STRUCTURE"
      );

      clearTradeFields();

      return;
    }

    tp1 =
      entry -
      riskDistance * 1.5;

    tp2 =
      entry -
      riskDistance * 2.0;

    tp3 =
      entry -
      riskDistance * 3.0;
  }

  const risk =
    Math.abs(
      entry -
      stopLoss
    );

  const reward =
    Math.abs(
      tp2 -
      entry
    );

  const rr =
    risk > 0
      ? reward / risk
      : 0;

  setText(
    "sniperStatus",
    `A+ ${direction} SETUP`
  );

  setText(
    "direction",
    direction
  );

  setText(
    "entry",
    formatPrice(
      entry
    )
  );

  setText(
    "stopLoss",
    formatPrice(
      stopLoss
    )
  );

  setText(
    "tp1",
    formatPrice(
      tp1
    )
  );

  setText(
    "tp2",
    formatPrice(
      tp2
    )
  );

  setText(
    "tp3",
    formatPrice(
      tp3
    )
  );

  setText(
    "riskReward",
    `1:${rr.toFixed(2)}`
  );

  setText(
    "validity",
    "A+ technical alignment detected."
  );

  setText(
    "trigger",
    `Wait for ${direction} M15/M5 confirmation before entry.`
  );

  setText(
    "invalidation",
    direction === "BULLISH"
      ? `Invalid below ${formatPrice(stopLoss)}`
      : `Invalid above ${formatPrice(stopLoss)}`
  );
}

// ============================================================
// CLEAR SNIPER
// ============================================================

function clearTradeFields() {

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
    "setupScore",
    "—"
  );
}

// ============================================================
// ELITE SCALPING ENGINE
// ============================================================

function runScalpingEngine() {

  const h1 =
    marketData.h1Trend;

  const m15 =
    marketData.m15Structure;

  const m5 =
    marketData.m5Structure;

  const m5Candles =
    marketData.m5;

  const m5Rsi =
    marketData.m5Rsi;

  const price =
    marketData.price;

  // ----------------------------------------------------------
  // RESET
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // NEWS GATE
  // ----------------------------------------------------------

  if (!newsClear) {

    setText(
      "scalpVerdict",
      "WAIT — NEWS FILTER ACTIVE"
    );

    setText(
      "scalpDirection",
      "WAIT"
    );

    setText(
      "scalpScore",
      "0/100"
    );

    setText(
      "scalpValidity",
      "Elite scalp locked until the high-impact EUR/USD news filter is clear."
    );

    setText(
      "scalpTrigger",
      "No fresh scalp during the news lock."
    );

    setText(
      "scalpInvalidation",
      "News filter must become CLEAR."
    );

    return;
  }

  // ----------------------------------------------------------
  // H1 DIRECTION
  // ----------------------------------------------------------

  if (
    h1 === "RANGE"
  ) {

    setText(
      "scalpVerdict",
      "WAIT — H1 RANGE"
    );

    setText(
      "scalpDirection",
      "WAIT"
    );

    setText(
      "scalpScore",
      "0/100"
    );

    setText(
      "scalpValidity",
      "NEXT 2 HOURS — H1 has no clear directional bias."
    );

    setText(
      "scalpTrigger",
      "Wait for H1 to establish a clear bullish or bearish structure."
    );

    setText(
      "scalpInvalidation",
      "No elite scalp while H1 remains RANGE."
    );

    return;
  }

  const direction =
    h1;

  // ----------------------------------------------------------
  // SCORE COMPONENTS
  // ----------------------------------------------------------

  let score = 15;

  const reasons = [];

  // H1 direction
  reasons.push(
    `H1 ${direction}`
  );

  // ----------------------------------------------------------
  // M15 ALIGNMENT
  // ----------------------------------------------------------

  const m15Aligned =
    m15 === direction;

  if (
    m15Aligned
  ) {

    score += 15;

  } else {

    reasons.push(
      `M15 ${m15}`
    );
  }

  // ----------------------------------------------------------
  // M5 STRUCTURE
  // ----------------------------------------------------------

  const m5Aligned =
    m5 === direction;

  if (
    m5Aligned
  ) {

    score += 20;

  } else {

    reasons.push(
      `M5 ${m5}`
    );
  }

  // ----------------------------------------------------------
  // M5 EMA20 / EMA50
  // ----------------------------------------------------------

  const ema20 =
    calculateEMA(
      m5Candles,
      20
    );

  const ema50 =
    calculateEMA(
      m5Candles,
      50
    );

  if (
    ema20 === null ||
    ema50 === null
  ) {

    setText(
      "scalpVerdict",
      "WAIT — EMA DATA"
    );

    setText(
      "scalpDirection",
      "WAIT"
    );

    setText(
      "scalpScore",
      `${score}/100`
    );

    setText(
      "scalpValidity",
      "Not enough M5 EMA data."
    );

    setText(
      "scalpTrigger",
      "Wait for sufficient M5 candle data."
    );

    setText(
      "scalpInvalidation",
      "EMA20/50 unavailable."
    );

    return;
  }

  const emaAligned =
    direction === "BULLISH"
      ? ema20 > ema50 &&
        price > ema20
      : ema20 < ema50 &&
        price < ema20;

  if (
    emaAligned
  ) {

    score += 15;

  } else {

    reasons.push(
      "M5 EMA not aligned"
    );
  }

  // ----------------------------------------------------------
  // RSI MOMENTUM ZONE
  // ----------------------------------------------------------

  const rsiAligned =
    direction === "BULLISH"
      ? m5Rsi !== null &&
        m5Rsi >= SCALP_BULL_RSI &&
        m5Rsi <= SCALP_BULL_RSI_MAX
      : m5Rsi !== null &&
        m5Rsi <= SCALP_BEAR_RSI &&
        m5Rsi >= SCALP_BEAR_RSI_MIN;

  if (
    rsiAligned
  ) {

    score += 15;

  } else {

    reasons.push(
      `M5 RSI ${m5Rsi !== null ? m5Rsi.toFixed(1) : "—"} not in momentum zone`
    );
  }

  // ----------------------------------------------------------
  // M5 PRICE-ACTION TRIGGER
  // ----------------------------------------------------------

  const momentumTrigger =
    getM5MomentumTrigger(
      m5Candles,
      direction
    );

  if (
    momentumTrigger
  ) {

    score += 20;

  } else {

    reasons.push(
      "M5 momentum trigger not confirmed"
    );
  }

  // ----------------------------------------------------------
  // M15 ALIGNMENT BONUS
  // ----------------------------------------------------------

  // Already included above.
  // M15 is mandatory for elite scalp.
  
  // ----------------------------------------------------------
  // HARD ALIGNMENT GATE
  // ----------------------------------------------------------

  if (
    !m15Aligned ||
    !m5Aligned
  ) {

    setText(
      "scalpVerdict",
      "WAIT — TIMEFRAME ALIGNMENT"
    );

    setText(
      "scalpDirection",
      "WAIT"
    );

    setText(
      "scalpScore",
      `${score}/100`
    );

    setText(
      "scalpValidity",
      `NEXT 2 HOURS — ${reasons.join(" | ")}`
    );

    setText(
      "scalpTrigger",
      `Required: H1 → M15 → M5 all ${direction}.`
    );

    setText(
      "scalpInvalidation",
      "No scalp until timeframe alignment is restored."
    );

    return;
  }

  // ----------------------------------------------------------
  // HARD EMA GATE
  // ----------------------------------------------------------

  if (
    !emaAligned
  ) {

    setText(
      "scalpVerdict",
      "WAIT — EMA MOMENTUM FILTER"
    );

    setText(
      "scalpDirection",
      "WAIT"
    );

    setText(
      "scalpScore",
      `${score}/100`
    );

    setText(
      "scalpValidity",
      `NEXT 2 HOURS — Price/EMA20/EMA50 are not aligned ${direction}.`
    );

    setText(
      "scalpTrigger",
      direction === "BULLISH"
        ? "Need price above EMA20 and EMA20 above EMA50."
        : "Need price below EMA20 and EMA20 below EMA50."
    );

    setText(
      "scalpInvalidation",
      "EMA momentum filter failed."
    );

    return;
  }

  // ----------------------------------------------------------
  // HARD RSI GATE
  // ----------------------------------------------------------

  if (
    !rsiAligned
  ) {

    setText(
      "scalpVerdict",
      "WAIT — RSI MOMENTUM FILTER"
    );

    setText(
      "scalpDirection",
      "WAIT"
    );

    setText(
      "scalpScore",
      `${score}/100`
    );

    setText(
      "scalpValidity",
      `NEXT 2 HOURS — M5 RSI ${m5Rsi !== null ? m5Rsi.toFixed(1) : "—"} is outside the elite momentum zone.`
    );

    setText(
      "scalpTrigger",
      direction === "BULLISH"
        ? "Need M5 RSI between 52 and 68."
        : "Need M5 RSI between 32 and 48."
    );

    setText(
      "scalpInvalidation",
      "RSI momentum filter failed."
    );

    return;
  }

  // ----------------------------------------------------------
  // HARD PRICE-ACTION GATE
  // ----------------------------------------------------------

  if (
    !momentumTrigger
  ) {

    setText(
      "scalpVerdict",
      "WAIT — M5 TRIGGER"
    );

    setText(
      "scalpDirection",
      "WAIT"
    );

    setText(
      "scalpScore",
      `${score}/100`
    );

    setText(
      "scalpValidity",
      `NEXT 2 HOURS — ${direction} structure exists, but the completed M5 momentum candle has not confirmed.`
    );

    setText(
      "scalpTrigger",
      direction === "BULLISH"
        ? "Wait for a strong bullish M5 candle closing above the previous M5 high."
        : "Wait for a strong bearish M5 candle closing below the previous M5 low."
    );

    setText(
      "scalpInvalidation",
      "No entry without completed M5 price-action confirmation."
    );

    return;
  }

  // ----------------------------------------------------------
  // AVOID CHASING PRICE
  // ----------------------------------------------------------

  const emaDistance =
    Math.abs(
      price -
      ema20
    );

  if (
    emaDistance >
    SCALP_MAX_EMA_DISTANCE
  ) {

    setText(
      "scalpVerdict",
      "WAIT — PRICE EXTENDED"
    );

    setText(
      "scalpDirection",
      "WAIT"
    );

    setText(
      "scalpScore",
      `${score}/100`
    );

    setText(
      "scalpValidity",
      `Price is ${(
        emaDistance * 10000
      ).toFixed(1)} pips from EMA20.`
    );

    setText(
      "scalpTrigger",
      "Wait for a controlled pullback toward EMA20. Do not chase the move."
    );

    setText(
      "scalpInvalidation",
      "Fresh entry while price is extended is rejected."
    );

    return;
  }

  // ----------------------------------------------------------
  // M5 SUPPORT / RESISTANCE
  // ----------------------------------------------------------

  const scalpLevels =
    calculateLevels(
      m5Candles,
      price
    );

  let sl;

  if (
    direction === "BULLISH"
  ) {

    sl =
      scalpLevels.support1 !== null
        ? scalpLevels.support1 -
          SCALP_SL_BUFFER
        : price -
          0.00060;

  } else {

    sl =
      scalpLevels.resistance1 !== null
        ? scalpLevels.resistance1 +
          SCALP_SL_BUFFER
        : price +
          0.00060;
  }

  // ----------------------------------------------------------
  // VALIDATE STOP
  // ----------------------------------------------------------

  const riskDistance =
    Math.abs(
      price -
      sl
    );

  if (
    riskDistance <= 0
  ) {

    setText(
      "scalpVerdict",
      "WAIT — INVALID STOP"
    );

    setText(
      "scalpDirection",
      "WAIT"
    );

    setText(
      "scalpScore",
      `${score}/100`
    );

    setText(
      "scalpValidity",
      "M5 structure does not provide a valid stop location."
    );

    setText(
      "scalpTrigger",
      "Wait for a clean M5 structure and valid stop."
    );

    setText(
      "scalpInvalidation",
      "Invalid risk structure."
    );

    return;
  }

  // ----------------------------------------------------------
  // SCALP RISK IN PIPS
  // ----------------------------------------------------------

  const riskPips =
    riskDistance *
    10000;

  if (
    riskPips <
      SCALP_MIN_RISK_PIPS ||
    riskPips >
      SCALP_MAX_RISK_PIPS
  ) {

    setText(
      "scalpVerdict",
      "WAIT — RISK SIZE INVALID"
    );

    setText(
      "scalpDirection",
      "WAIT"
    );

    setText(
      "scalpScore",
      `${score}/100`
    );

    setText(
      "scalpValidity",
      `M5 stop distance is ${riskPips.toFixed(1)} pips. Elite scalp range: ${SCALP_MIN_RISK_PIPS}–${SCALP_MAX_RISK_PIPS} pips.`
    );

    setText(
      "scalpTrigger",
      "Wait for a cleaner entry/structure with an acceptable stop distance."
    );

    setText(
      "scalpInvalidation",
      "Risk distance outside elite scalp limits."
    );

    return;
  }

  // ----------------------------------------------------------
  // TARGETS
  // ----------------------------------------------------------

  const tp1 =
    direction === "BULLISH"
      ? price +
        riskDistance * 1.5
      : price -
        riskDistance * 1.5;

  const tp2 =
    direction === "BULLISH"
      ? price +
        riskDistance * SCALP_MIN_RR
      : price -
        riskDistance * SCALP_MIN_RR;

  const rr =
    riskDistance > 0
      ? Math.abs(
          tp2 -
          price
        ) /
        riskDistance
      : 0;

  // ----------------------------------------------------------
  // RR GATE
  // ----------------------------------------------------------

  if (
    rr <
    SCALP_MIN_RR
  ) {

    setText(
      "scalpVerdict",
      "WAIT — RR BELOW 1:2"
    );

    setText(
      "scalpDirection",
      "WAIT"
    );

    setText(
      "scalpScore",
      `${score}/100`
    );

    setText(
      "scalpValidity",
      `Calculated RR is 1:${rr.toFixed(2)}. Minimum required is 1:2.`
    );

    setText(
      "scalpTrigger",
      "Wait for a better entry or structure."
    );

    setText(
      "scalpInvalidation",
      "Risk/reward requirement failed."
    );

    return;
  }

  // ----------------------------------------------------------
  // NEARBY S/R ROOM CHECK
  // ----------------------------------------------------------

  const higherTimeframeLevels =
    marketData.levels;

  let roomToObstacle =
    Infinity;

  let obstacleText =
    "No nearby opposing level";

  if (
    direction === "BULLISH"
  ) {

    if (
      higherTimeframeLevels.resistance1 !== null
    ) {

      roomToObstacle =
        higherTimeframeLevels.resistance1 -
        price;

      obstacleText =
        `Resistance ${formatPrice(higherTimeframeLevels.resistance1)}`;
    }

  } else {

    if (
      higherTimeframeLevels.support1 !== null
    ) {

      roomToObstacle =
        price -
        higherTimeframeLevels.support1;

      obstacleText =
        `Support ${formatPrice(higherTimeframeLevels.support1)}`;
    }
  }

  const requiredRoom =
    riskDistance *
    SCALP_MIN_RR;

  if (
    roomToObstacle <
    requiredRoom
  ) {

    setText(
      "scalpVerdict",
      "WAIT — TARGET BLOCKED"
    );

    setText(
      "scalpDirection",
      "WAIT"
    );

    setText(
      "scalpScore",
      `${score}/100`
    );

    setText(
      "scalpValidity",
      `2R target is blocked by nearby ${obstacleText}.`
    );

    setText(
      "scalpTrigger",
      "Wait for more room beyond the opposing level or a better entry."
    );

    setText(
      "scalpInvalidation",
      "Insufficient room for minimum 1:2 RR."
    );

    return;
  }

  // ----------------------------------------------------------
  // FINAL SCORE
  // ----------------------------------------------------------

  if (
    score <
    SCALP_MIN_SCORE
  ) {

    setText(
      "scalpVerdict",
      `WAIT — SCALP SCORE ${score}/100`
    );

    setText(
      "scalpDirection",
      "WAIT"
    );

    setText(
      "scalpValidity",
      `Elite filter score below ${SCALP_MIN_SCORE}/100.`
    );

    setText(
      "scalpTrigger",
      "Wait for all elite scalp conditions to align."
    );

    setText(
      "scalpInvalidation",
      "Score below elite scalp threshold."
    );

    return;
  }

  // ==========================================================
  // FINAL ELITE SCALP SETUP
  // ==========================================================

  setText(
    "scalpVerdict",
    `ELITE SCALP — ${direction}`
  );

  setText(
    "scalpDirection",
    direction
  );

  setText(
    "scalpEntry",
    formatPrice(
      price
    )
  );

  setText(
    "scalpSL",
    formatPrice(
      sl
    )
  );

  setText(
    "scalpTP1",
    formatPrice(
      tp1
    )
  );

  setText(
    "scalpTP2",
    formatPrice(
      tp2
    )
  );

  setText(
    "scalpRR",
    `1:${rr.toFixed(2)}`
  );

  setText(
    "scalpScore",
    `${score}/100`
  );

  setText(
    "scalpValidity",
    `NEXT ${SCALP_WINDOW_MINUTES} MINUTES — H1/M15/M5 aligned | EMA aligned | RSI ${m5Rsi.toFixed(1)} | Risk ${riskPips.toFixed(1)} pips | 1:2+ RR | S/R room OK`
  );

  setText(
    "scalpTrigger",
    direction === "BULLISH"
      ? "M5 bullish momentum confirmed. Execute only while conditions remain valid; avoid chasing."
      : "M5 bearish momentum confirmed. Execute only while conditions remain valid; avoid chasing."
  );

  setText(
    "scalpInvalidation",
    direction === "BULLISH"
      ? `Invalid below ${formatPrice(sl)} or if H1/M15/M5 alignment breaks.`
      : `Invalid above ${formatPrice(sl)} or if H1/M15/M5 alignment breaks.`
  );
}

// ============================================================
// PRO ENGINE
// ============================================================

function runProEngine() {

  const h4 =
    marketData.h4Trend;

  const h1 =
    marketData.h1Trend;

  const m15 =
    marketData.m15Structure;

  if (!newsClear) {

    setText(
      "proVerdict",
      "WAIT — NEWS FILTER NOT CONFIRMED"
    );

    setText(
      "proExplanation",
      "High-impact news filter is not confirmed. No PRO setup."
    );

    return;
  }

  if (
    h4 === "RANGE"
  ) {

    setText(
      "proVerdict",
      "WAIT — H4 RANGE"
    );

    setText(
      "proExplanation",
      "H4 does not currently show a clear directional structure. Wait for a confirmed H4 directional move before looking for an A+ setup."
    );

    return;
  }

  if (
    h4 !== h1
  ) {

    setText(
      "proVerdict",
      "WAIT — H4/H1 CONFLICT"
    );

    setText(
      "proExplanation",
      `H4 is ${h4} while H1 is ${h1}. Wait for higher-timeframe alignment.`
    );

    return;
  }

  if (
    m15 !== h4
  ) {

    setText(
      "proVerdict",
      "WAIT — M15 CONFIRMATION"
    );

    setText(
      "proExplanation",
      `H4/H1 are ${h4}, but M15 is ${m15}. Wait for M15 confirmation.`
    );

    return;
  }

  setText(
    "proVerdict",
    `PRO ${h4} — CONFIRMED`
  );

  setText(
    "proExplanation",
    `H4 + H1 + M15 are aligned ${h4}. Wait for M5 entry confirmation and valid risk/reward before execution.`
  );
}

// ============================================================
// NEWS
// ============================================================

async function loadNews() {

  try {

    const response =
      await fetch(
        NEWS_URL,
        {
          cache: "no-store"
        }
      );

    const data =
      await response.json();

    processNews(
      data
    );

  } catch (error) {

    console.error(
      "News error:",
      error
    );

    newsClear = false;

    setText(
      "newsFilter",
      "⚠ NEWS DATA ERROR"
    );

    setText(
      "tradingRisk",
      "HIGH — NEWS FILTER UNCONFIRMED"
    );
  }
}

// ============================================================
// PROCESS NEWS
// ============================================================

function processNews(
  data
) {

  const events =
    Array.isArray(
      data?.data
    )
      ? data.data
      : [];

  const now =
    Date.now();

  const relevantEvents =
    events.filter(
      event => {

        const currency =
          String(
            event.currency ||
            event.currency_code ||
            ""
          ).toUpperCase();

        const importance =
          String(
            event.importance ||
            event.impact ||
            ""
          ).toLowerCase();

        return (
          (
            currency === "EUR" ||
            currency === "USD"
          ) &&
          (
            importance === "high" ||
            importance === "3" ||
            importance.includes("high")
          )
        );
      }
    );

  const upcoming =
    relevantEvents
      .map(
        event => {

          const dateValue =
            event.datetime ||
            event.date ||
            event.time ||
            event.releaseAt ||
            event.release_at;

          const timestamp =
            Date.parse(
              dateValue
            );

          return {
            ...event,
            timestamp
          };
        }
      )
      .filter(
        event =>
          Number.isFinite(
            event.timestamp
          )
      )
      .sort(
        (a, b) =>
          a.timestamp -
          b.timestamp
      );

  const eurEvents =
    upcoming.filter(
      event =>
        String(
          event.currency ||
          event.currency_code ||
          ""
        ).toUpperCase() ===
        "EUR"
    );

  const usdEvents =
    upcoming.filter(
      event =>
        String(
          event.currency ||
          event.currency_code ||
          ""
        ).toUpperCase() ===
        "USD"
    );

  displayNewsEvents(
    "eurNews",
    eurEvents
  );

  displayNewsEvents(
    "usdNews",
    usdEvents
  );

  const nextEvent =
    upcoming.find(
      event =>
        event.timestamp >= now
    );

  if (
    !nextEvent
  ) {

    newsClear = true;

    setText(
      "newsFilter",
      "✅ NEWS CLEAR"
    );

    setText(
      "nextEvent",
      "No upcoming high-impact EUR/USD event found."
    );

    setText(
      "tradingRisk",
      "NORMAL — TECHNICAL FILTER ACTIVE"
    );

    return;
  }

  const minutesUntil =
    (
      nextEvent.timestamp -
      now
    ) /
    60000;

  const eventCurrency =
    String(
      nextEvent.currency ||
      nextEvent.currency_code ||
      ""
    ).toUpperCase();

  const eventName =
    nextEvent.event ||
    nextEvent.name ||
    nextEvent.title ||
    "High-impact event";

  const eventDate =
    new Date(
      nextEvent.timestamp
    );

  const istText =
    eventDate.toLocaleString(
      "en-IN",
      {
        timeZone:
          "Asia/Kolkata",

        day: "2-digit",
        month: "short",
        year: "numeric",

        hour: "2-digit",
        minute: "2-digit",

        hour12: false
      }
    );

  setText(
    "nextEvent",
    `${eventName} — ${istText} IST`
  );

  // ----------------------------------------------------------
  // NEWS LOCK
  // 30 MINUTES BEFORE → 30 MINUTES AFTER
  //
  // PLUS:
  // No fresh setup within 2 hours before event.
  // ----------------------------------------------------------

  const withinNewsWindow =
    minutesUntil >= -30 &&
    minutesUntil <= 30;

  const tooClose =
    minutesUntil >= 0 &&
    minutesUntil <= 120;

  if (
    withinNewsWindow ||
    tooClose
  ) {

    newsClear = false;

    setText(
      "newsFilter",
      `⚠ ${eventCurrency} HIGH-IMPACT NEWS NEAR`
    );

    setText(
      "tradingRisk",
      "HIGH — NEWS FILTER ACTIVE"
    );

  } else {

    newsClear = true;

    setText(
      "newsFilter",
      "✅ NEWS CLEAR"
    );

    setText(
      "tradingRisk",
      "NORMAL — TECHNICAL FILTER ACTIVE"
    );
  }
}

// ============================================================
// NEWS DISPLAY
// ============================================================

function displayNewsEvents(
  id,
  events
) {

  if (
    !events.length
  ) {

    setText(
      id,
      `NO ${
        id === "eurNews"
          ? "EUR"
          : "USD"
      } HIGH-IMPACT EVENTS FOUND`
    );

    return;
  }

  const event =
    events[0];

  const name =
    event.event ||
    event.name ||
    event.title ||
    "High-impact event";

  const date =
    new Date(
      event.timestamp
    );

  const istText =
    date.toLocaleString(
      "en-IN",
      {
        timeZone:
          "Asia/Kolkata",

        day: "2-digit",
        month: "short",
        year: "numeric",

        hour: "2-digit",
        minute: "2-digit",

        hour12: false
      }
    );

  setText(
    id,
    `HIGH — ${name} @ ${istText} IST`
  );
}

// ============================================================
// TRADINGVIEW CHART
// ============================================================

function changeChart(
  interval
) {

  const iframe =
    document.getElementById(
      "tradingviewChart"
    );

  if (!iframe) {
    return;
  }

  iframe.src =
    `https://www.tradingview.com/widgetembed/?symbol=FXCM%3AEURUSD&interval=${interval}&theme=dark&style=1&locale=en&hide_top_toolbar=true&hide_legend=false&save_image=false&hideideas=true`;
}

// ============================================================
// AUTO REFRESH
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    loadMarketData();

    // Refresh every 2 minutes.
    setInterval(
      loadMarketData,
      120000
    );
  }
);
