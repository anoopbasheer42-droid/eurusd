// ============================================================
// EUR/USD SNIPER DASHBOARD
// Elite Market Structure + S/R + Indicators + News
// A+ Sniper Engine + Elite Scalping Engine
// ============================================================

const API_KEY = "8908432b6c784bc49aad6ccf64845991";

const PRICE_URL =
  `https://api.twelvedata.com/price?symbol=EUR/USD&apikey=${API_KEY}`;

const TIME_SERIES_URL =
  "https://api.twelvedata.com/time_series";

const NEWS_URL =
  "https://xoomar.com/api/markets/calendar?importance=high";

let marketData = {};
let newsClear = false;

// ============================================================
// ELITE SCALP SETTINGS
// ============================================================

const SCALP_SETTINGS = {

  // Scoring
  A_PLUS_SCORE: 85,
  VALID_SCORE: 75,

  // Minimum RR
  MIN_RR: 2.0,

  // M5 RSI
  RSI_BULLISH_LEVEL: 50,
  RSI_BEARISH_LEVEL: 50,

  // Maximum scalp stop in pips
  // EUR/USD: 1 pip = 0.00010
  MAX_STOP_PIPS: 12,

  // Minimum useful stop
  MIN_STOP_PIPS: 2,

  // Avoid chasing
  MAX_EXTENSION_PIPS: 15,

  // News protection
  NEWS_LOCK_MINUTES: 120
};

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

function pipDistance(a, b) {

  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b)
  ) {
    return null;
  }

  return Math.abs(a - b) / 0.00010;
}

function getLastClosedCandle(candles) {

  if (
    !candles ||
    candles.length < 2
  ) {
    return null;
  }

  return candles[
    candles.length - 2
  ];
}

function getPreviousClosedCandle(candles) {

  if (
    !candles ||
    candles.length < 3
  ) {
    return null;
  }

  return candles[
    candles.length - 3
  ];
}

// ============================================================
// LIVE PRICE
// ============================================================

async function fetchPrice() {

  const response =
    await fetch(PRICE_URL);

  const data =
    await response.json();

  if (!data.price) {
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
    await fetch(url);

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

      datetime:
        c.datetime,

      open:
        Number(c.open),

      high:
        Number(c.high),

      low:
        Number(c.low),

      close:
        Number(c.close)

    }))
    .filter(c =>

      Number.isFinite(c.open) &&
      Number.isFinite(c.high) &&
      Number.isFinite(c.low) &&
      Number.isFinite(c.close)

    )
    .reverse();
}

async function loadCandles() {

  const [
    h4,
    h1,
    m15,
    m5
  ] =
    await Promise.all([

      getCandles(
        "4h",
        100
      ),

      getCandles(
        "1h",
        100
      ),

      getCandles(
        "15min",
        100
      ),

      getCandles(
        "5min",
        100
      )

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
// SWING HIGH
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

        price:
          candles[i].high

      });
    }
  }

  return swings;
}

// ============================================================
// SWING LOW
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

        price:
          candles[i].low

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
  // CONSERVATIVE FALLBACK
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
    Math.abs(priceChange) /
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
// UNIQUE LEVELS
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
          ) <
          minimumDistance
      )
    ) {

      result.push(
        level
      );
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
    ).map(
      x => x.price
    );

  const swingLows =
    getSwingLows(
      recent,
      2
    ).map(
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
    gains / period;

  let averageLoss =
    losses / period;

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
// EMA DETAILS
// ============================================================

function getEMADetails(
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

  const closed =
    getLastClosedCandle(
      candles
    );

  if (
    ema20 === null ||
    ema50 === null ||
    !closed
  ) {

    return {

      ema20: null,
      ema50: null,
      direction: "RANGE",
      priceAbove20: false

    };
  }

  return {

    ema20,

    ema50,

    direction:
      ema20 > ema50
        ? "BULLISH"
        : ema20 < ema50
          ? "BEARISH"
          : "RANGE",

    priceAbove20:
      closed.close > ema20

  };
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
    getStructure(h4);

  const h1Trend =
    getStructure(h1);

  const m15Structure =
    getStructure(m15);

  const m5Structure =
    getStructure(m5);

  const h4Rsi =
    calculateRSI(h4);

  const h1Rsi =
    calculateRSI(h1);

  const m15Rsi =
    calculateRSI(m15);

  const m5Rsi =
    calculateRSI(m5);

  const emaStructure =
    getEMAStructure(m15);

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

  runEliteScalpingEngine();

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

  if (
    !newsClear
  ) {

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
      `Wait for H1 to align with H4 ${h4}`
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

  if (
    newsClear
  ) {
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
      riskDistance * 2;

    tp3 =
      entry +
      riskDistance * 3;

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
      riskDistance * 2;

    tp3 =
      entry -
      riskDistance * 3;
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

function runEliteScalpingEngine() {

  const h1 =
    marketData.h1Trend;

  const m15 =
    marketData.m15Structure;

  const m5 =
    marketData.m5Structure;

  const h1Candles =
    marketData.h1;

  const m15Candles =
    marketData.m15;

  const m5Candles =
    marketData.m5;

  const h1Rsi =
    marketData.h1Rsi;

  const m5Rsi =
    marketData.m5Rsi;

  const price =
    marketData.price;

  const levels =
    marketData.levels;

  // ==========================================================
  // NEWS HARD GATE
  // ==========================================================

  if (
    !newsClear
  ) {

    setScalpWait(
      "WAIT — NEWS FILTER ACTIVE",
      "WAIT",
      "High-impact news protection is active.",
      "Wait until the news window is clear.",
      "No scalp during the protected news window.",
      "—"
    );

    return;
  }

  // ==========================================================
  // H1 RANGE HARD GATE
  // ==========================================================

  if (
    h1 === "RANGE"
  ) {

    setScalpWait(
      "NO TRADE — H1 RANGE",
      "WAIT",
      "H1 does not provide a clean directional bias.",
      "Wait for a confirmed H1 directional structure.",
      "No scalp while H1 remains RANGE.",
      "—"
    );

    return;
  }

  // ==========================================================
  // H1 EMA ALIGNMENT
  // ==========================================================

  const h1EMA =
    getEMADetails(
      h1Candles
    );

  const h1EmaAligned =
    h1EMA.direction === h1;

  // ==========================================================
  // H1 / M15 HARD GATE
  // ==========================================================

  if (
    h1 !== m15
  ) {

    setScalpWait(
      "NO TRADE — H1/M15 CONFLICT",
      "WAIT",
      `H1 is ${h1}; M15 is ${m15}. The scalping bias is not aligned.`,
      `Wait for M15 to confirm ${h1}.`,
      "No scalp while H1 and M15 conflict.",
      "—"
    );

    return;
  }

  // ==========================================================
  // M15 / M5 HARD GATE
  // ==========================================================

  if (
    m15 !== m5
  ) {

    setScalpWait(
      "NO TRADE — M15/M5 CONFLICT",
      "WAIT",
      `M15 is ${m15}; M5 is ${m5}. Entry timeframe is not aligned.`,
      `Wait for M5 to confirm ${m15}.`,
      "No scalp while M15 and M5 conflict.",
      "—"
    );

    return;
  }

  const direction =
    h1;

  // ==========================================================
  // CLOSED M5 CANDLE
  // ==========================================================

  const m5Last =
    getLastClosedCandle(
      m5Candles
    );

  const m5Previous =
    getPreviousClosedCandle(
      m5Candles
    );

  if (
    !m5Last ||
    !m5Previous
  ) {

    setScalpWait(
      "NO TRADE — M5 DATA",
      "WAIT",
      "Not enough confirmed M5 candles.",
      "Wait for a confirmed M5 candle.",
      "M5 confirmation unavailable.",
      "—"
    );

    return;
  }

  // ==========================================================
  // M5 CANDLE CONFIRMATION
  // ==========================================================

  const bullishCandle =
    m5Last.close >
    m5Last.open;

  const bearishCandle =
    m5Last.close <
    m5Last.open;

  const bullishConfirmation =
    direction === "BULLISH" &&
    bullishCandle &&
    m5Last.close >
      m5Previous.high;

  const bearishConfirmation =
    direction === "BEARISH" &&
    bearishCandle &&
    m5Last.close <
      m5Previous.low;

  const m5Confirmation =
    bullishConfirmation ||
    bearishConfirmation;

  // ==========================================================
  // LIQUIDITY SWEEP
  // ==========================================================

  const bullishSweep =
    direction === "BULLISH" &&
    m5Last.low <
      m5Previous.low &&
    m5Last.close >
      m5Previous.low;

  const bearishSweep =
    direction === "BEARISH" &&
    m5Last.high >
      m5Previous.high &&
    m5Last.close <
      m5Previous.high;

  const liquiditySweep =
    bullishSweep ||
    bearishSweep;

  // ==========================================================
  // RSI CONFIRMATION
  // ==========================================================

  const rsiAligned =
    direction === "BULLISH"
      ? (
          m5Rsi !== null &&
          m5Rsi > 50
        )
      : (
          m5Rsi !== null &&
          m5Rsi < 50
        );

  // ==========================================================
  // S/R LOCATION
  // ==========================================================

  let srLocation =
    false;

  if (
    direction === "BULLISH"
  ) {

    if (
      levels.support1 !== null
    ) {

      const distance =
        pipDistance(
          price,
          levels.support1
        );

      srLocation =
        distance !== null &&
        distance <= 12;
    }

  } else {

    if (
      levels.resistance1 !== null
    ) {

      const distance =
        pipDistance(
          price,
          levels.resistance1
        );

      srLocation =
        distance !== null &&
        distance <= 12;
    }
  }

  // ==========================================================
  // ANTI-CHASE
  // ==========================================================

  const recentM5 =
    m5Candles.slice(-4);

  const recentHigh =
    Math.max(
      ...recentM5.map(
        c => c.high
      )
    );

  const recentLow =
    Math.min(
      ...recentM5.map(
        c => c.low
      )
    );

  let extensionPips = 0;

  if (
    direction === "BULLISH"
  ) {

    extensionPips =
      pipDistance(
        price,
        recentLow
      );

  } else {

    extensionPips =
      pipDistance(
        price,
        recentHigh
      );
  }

  const notOverextended =
    extensionPips !== null &&
    extensionPips <=
      SCALP_SETTINGS.MAX_EXTENSION_PIPS;

  // ==========================================================
  // SCORE
  // ==========================================================

  let score = 0;

  // H1 structure
  score += 15;

  // H1 EMA
  if (
    h1EmaAligned
  ) {
    score += 10;
  }

  // M15 structure
  score += 15;

  // M5 structure
  score += 15;

  // M5 confirmation
  if (
    m5Confirmation
  ) {
    score += 15;
  }

  // S/R
  if (
    srLocation
  ) {
    score += 10;
  }

  // Liquidity
  if (
    liquiditySweep
  ) {
    score += 5;
  }

  // RSI
  if (
    rsiAligned
  ) {
    score += 5;
  }

  // News
  score += 10;

  setText(
    "scalpScore",
    `${score}/100`
  );

  // ==========================================================
  // HARD GATE — EMA
  // ==========================================================

  if (
    !h1EmaAligned
  ) {

    setScalpWait(
      "NO TRADE — H1 EMA CONFLICT",
      "WAIT",
      `H1 structure is ${direction}, but H1 EMA20/EMA50 is ${h1EMA.direction}.`,
      `Wait for H1 EMA alignment with ${direction}.`,
      "H1 structure and EMA direction disagree.",
      `${score}/100`
    );

    return;
  }

  // ==========================================================
  // HARD GATE — M5 CONFIRMATION
  // ==========================================================

  if (
    !m5Confirmation
  ) {

    setScalpWait(
      "WAIT — M5 CONFIRMATION REQUIRED",
      "WAIT",
      `H1 + M15 + M5 structure are ${direction}, but the last closed M5 candle has not confirmed the entry.`,
      `Wait for a closed M5 ${direction.toLowerCase()} confirmation candle.`,
      "No entry without closed M5 confirmation.",
      `${score}/100`
    );

    return;
  }

  // ==========================================================
  // BUILD TRADE
  // ==========================================================

  const entry =
    price;

  let sl;
  let tp1;
  let tp2;

  if (
    direction === "BULLISH"
  ) {

    sl =
      levels.support1;

    if (
      sl === null ||
      sl >= entry
    ) {

      setScalpWait(
        "NO TRADE — INVALID SUPPORT",
        "WAIT",
        "A valid support-based stop cannot be calculated.",
        "Wait for a clean support structure.",
        "Invalid long stop location.",
        `${score}/100`
      );

      return;
    }

  } else {

    sl =
      levels.resistance1;

    if (
      sl === null ||
      sl <= entry
    ) {

      setScalpWait(
        "NO TRADE — INVALID RESISTANCE",
        "WAIT",
        "A valid resistance-based stop cannot be calculated.",
        "Wait for a clean resistance structure.",
        "Invalid short stop location.",
        `${score}/100`
      );

      return;
    }
  }

  const riskDistance =
    Math.abs(
      entry - sl
    );

  const stopPips =
    pipDistance(
      entry,
      sl
    );

  // ==========================================================
  // STOP DISTANCE HARD GATE
  // ==========================================================

  if (
    stopPips === null ||
    stopPips <
      SCALP_SETTINGS.MIN_STOP_PIPS ||
    stopPips >
      SCALP_SETTINGS.MAX_STOP_PIPS
  ) {

    setScalpWait(
      "NO TRADE — STOP DISTANCE",
      "WAIT",
      `Calculated stop is ${stopPips !== null ? stopPips.toFixed(1) : "—"} pips. Elite scalp range is ${SCALP_SETTINGS.MIN_STOP_PIPS}–${SCALP_SETTINGS.MAX_STOP_PIPS} pips.`,
      "Wait for a tighter, technically valid entry.",
      "Stop distance outside scalp limits.",
      `${score}/100`
    );

    return;
  }

  if (
    direction === "BULLISH"
  ) {

    tp1 =
      entry +
      riskDistance * 1.5;

    tp2 =
      entry +
      riskDistance * 2;

  } else {

    tp1 =
      entry -
      riskDistance * 1.5;

    tp2 =
      entry -
      riskDistance * 2;
  }

  const risk =
    Math.abs(
      entry - sl
    );

  const reward =
    Math.abs(
      tp2 - entry
    );

  const rr =
    risk > 0
      ? reward / risk
      : 0;

  // ==========================================================
  // RR HARD GATE
  // ==========================================================

  if (
    rr <
    SCALP_SETTINGS.MIN_RR
  ) {

    setScalpWait(
      "NO TRADE — RR BELOW 1:2",
      "WAIT",
      `Available risk/reward is 1:${rr.toFixed(2)}.`,
      "Wait for an entry with at least 1:2 RR.",
      "Minimum scalp RR is 1:2.",
      `${score}/100`
    );

    return;
  }

  // ==========================================================
  // S/R HARD GATE
  // ==========================================================

  if (
    !srLocation
  ) {

    setScalpWait(
      "WAIT — WAIT FOR S/R LOCATION",
      "WAIT",
      direction === "BULLISH"
        ? "Price is not sufficiently close to the identified support."
        : "Price is not sufficiently close to the identified resistance.",
      direction === "BULLISH"
        ? "Wait for a pullback into support."
        : "Wait for a retracement into resistance.",
      "Do not chase price away from the level.",
      `${score}/100`
    );

    return;
  }

  // ==========================================================
  // ANTI-CHASE HARD GATE
  // ==========================================================

  if (
    !notOverextended
  ) {

    setScalpWait(
      "WAIT — PRICE EXTENDED",
      "WAIT",
      `Price is approximately ${extensionPips.toFixed(1)} pips from the recent M5 reference area.`,
      "Wait for a pullback instead of chasing the move.",
      "Entry too extended from the recent M5 structure.",
      `${score}/100`
    );

    return;
  }

  // ==========================================================
  // SCORE CLASSIFICATION
  // ==========================================================

  if (
    score < SCALP_SETTINGS.VALID_SCORE
  ) {

    setScalpWait(
      `NO TRADE — SCORE ${score}/100`,
      "WAIT",
      "The setup does not meet the minimum elite scalp quality threshold.",
      `Need at least ${SCALP_SETTINGS.VALID_SCORE}/100.`,
      "Setup quality below threshold.",
      `${score}/100`
    );

    return;
  }

  if (
    score < SCALP_SETTINGS.A_PLUS_SCORE
  ) {

    setScalpWait(
      `WAIT — SETUP DEVELOPING ${score}/100`,
      "WAIT",
      `The setup has ${score}/100 but is below the A+ threshold of ${SCALP_SETTINGS.A_PLUS_SCORE}/100.`,
      "Wait for additional confirmation before entry.",
      "Not yet A+.",
      `${score}/100`
    );

    return;
  }

  // ==========================================================
  // A+ SCALP
  // ==========================================================

  setText(
    "scalpVerdict",
    `A+ SCALP — ${direction}`
  );

  setText(
    "scalpDirection",
    direction
  );

  setText(
    "scalpEntry",
    formatPrice(
      entry
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
    `NEXT 2 HOURS — A+ conditions aligned. H1 ${direction}, M15 ${direction}, M5 ${direction}.`
  );

  setText(
    "scalpTrigger",
    liquiditySweep
      ? `Liquidity sweep + M5 ${direction.toLowerCase()} confirmation. Entry only after closed M5 confirmation.`
      : `M5 ${direction.toLowerCase()} confirmation closed. Execute only while structure remains valid.`
  );

  setText(
    "scalpInvalidation",
    direction === "BULLISH"
      ? `Invalid below ${formatPrice(sl)} or if H1/M15/M5 alignment breaks.`
      : `Invalid above ${formatPrice(sl)} or if H1/M15/M5 alignment breaks.`
  );
}

// ============================================================
// SCALP WAIT HELPER
// ============================================================

function setScalpWait(
  verdict,
  direction,
  validity,
  trigger,
  invalidation,
  score
) {

  setText(
    "scalpVerdict",
    verdict
  );

  setText(
    "scalpDirection",
    direction
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
    score
  );

  setText(
    "scalpValidity",
    validity
  );

  setText(
    "scalpTrigger",
    trigger
  );

  setText(
    "scalpInvalidation",
    invalidation
}

// ============================================================
// CLEAR SCALP
// ============================================================

function clearScalpFields() {

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

  if (
    !newsClear
  ) {

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

function processNews(data) {

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
          )

          &&

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
        ).toUpperCase()
        ===
        "EUR"
    );

  const usdEvents =
    upcoming.filter(
      event =>

        String(
          event.currency ||
          event.currency_code ||
          ""
        ).toUpperCase()
        ===
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
    ) / 60000;

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

        day:
          "2-digit",

        month:
          "short",

        year:
          "numeric",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hour12:
          false

      }
    );

  setText(
    "nextEvent",
    `${eventName} — ${istText} IST`
  );

  // ----------------------------------------------------------
  // NEWS PROTECTION
  // ----------------------------------------------------------

  const withinNewsWindow =
    minutesUntil >= -30 &&
    minutesUntil <= 30;

  const tooClose =
    minutesUntil >= 0 &&
    minutesUntil <=
      SCALP_SETTINGS.NEWS_LOCK_MINUTES;

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

        day:
          "2-digit",

        month:
          "short",

        year:
          "numeric",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hour12:
          false

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
