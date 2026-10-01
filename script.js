// ============================================================
// EUR/USD SNIPER DASHBOARD
// Market Structure + S/R + Indicators + News + Sniper + Scalp
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
// MAIN LOAD
// ============================================================

async function loadMarketData() {
  try {
    newsClear = false;

    setText("priceStatus", "LOADING MARKET DATA...");

    await fetchPrice();
    await loadCandles();

    // IMPORTANT:
    // News must load BEFORE technical engines.
    await loadNews();

    updateTechnicalAnalysis();

    setText("priceStatus", "MARKET DATA LOADED");

  } catch (error) {
    console.error("Market data error:", error);
    setText("priceStatus", "DATA ERROR — CHECK API");
  }
}

// ============================================================
// HELPERS
// ============================================================

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatPrice(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return "—";
  }

  return Number(value).toFixed(5);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ============================================================
// LIVE PRICE
// ============================================================

async function fetchPrice() {
  const response = await fetch(PRICE_URL);
  const data = await response.json();

  if (!data.price) {
    throw new Error("Price unavailable");
  }

  marketData.price = Number(data.price);

  setText(
    "price",
    formatPrice(marketData.price)
  );
}

// ============================================================
// CANDLE DATA
// ============================================================

async function getCandles(interval, outputsize = 100) {
  const url =
    `${TIME_SERIES_URL}?symbol=EUR/USD` +
    `&interval=${interval}` +
    `&outputsize=${outputsize}` +
    `&apikey=${API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (!data.values || !Array.isArray(data.values)) {
    console.error("Candle API error:", data);
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

async function loadCandles() {
  const [h4, h1, m15, m5] = await Promise.all([
    getCandles("4h", 100),
    getCandles("1h", 100),
    getCandles("15min", 100),
    getCandles("5min", 100)
  ]);

  marketData.h4 = h4;
  marketData.h1 = h1;
  marketData.m15 = m15;
  marketData.m5 = m5;

  if (
    !h4.length ||
    !h1.length ||
    !m15.length ||
    !m5.length
  ) {
    throw new Error("Insufficient candle data");
  }
}

// ============================================================
// SWING DETECTION
// ============================================================

function getSwingHighs(candles, strength = 2) {
  const swings = [];

  for (
    let i = strength;
    i < candles.length - strength;
    i++
  ) {
    let isSwing = true;

    for (let j = 1; j <= strength; j++) {
      if (
        candles[i].high <= candles[i - j].high ||
        candles[i].high <= candles[i + j].high
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

function getSwingLows(candles, strength = 2) {
  const swings = [];

  for (
    let i = strength;
    i < candles.length - strength;
    i++
  ) {
    let isSwing = true;

    for (let j = 1; j <= strength; j++) {
      if (
        candles[i].low >= candles[i - j].low ||
        candles[i].low >= candles[i + j].low
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
// IMPROVED MARKET STRUCTURE
// ============================================================

function getStructure(candles) {
  if (!candles || candles.length < 15) {
    return "RANGE";
  }

  const recent = candles.slice(-60);

  const swingHighs = getSwingHighs(recent, 2);
  const swingLows = getSwingLows(recent, 2);

  // Need at least two swing highs and two swing lows
  if (
    swingHighs.length >= 2 &&
    swingLows.length >= 2
  ) {
    const previousHigh =
      swingHighs[swingHighs.length - 2].price;

    const latestHigh =
      swingHighs[swingHighs.length - 1].price;

    const previousLow =
      swingLows[swingLows.length - 2].price;

    const latestLow =
      swingLows[swingLows.length - 1].price;

    // Higher High + Higher Low
    if (
      latestHigh > previousHigh &&
      latestLow > previousLow
    ) {
      return "BULLISH";
    }

    // Lower High + Lower Low
    if (
      latestHigh < previousHigh &&
      latestLow < previousLow
    ) {
      return "BEARISH";
    }
  }

  // ----------------------------------------------------------
  // Conservative fallback using recent closes
  // ----------------------------------------------------------

  const last = recent[recent.length - 1];

  const firstClose =
    recent[Math.max(0, recent.length - 20)].close;

  const lastClose = last.close;

  const priceChange =
    lastClose - firstClose;

  const rangeHigh =
    Math.max(...recent.map(c => c.high));

  const rangeLow =
    Math.min(...recent.map(c => c.low));

  const totalRange =
    rangeHigh - rangeLow;

  if (totalRange <= 0) {
    return "RANGE";
  }

  const movementRatio =
    Math.abs(priceChange) / totalRange;

  // Only use fallback when movement is meaningful.
  if (movementRatio >= 0.35) {
    if (priceChange > 0) {
      return "BULLISH";
    }

    if (priceChange < 0) {
      return "BEARISH";
    }
  }

  return "RANGE";
}

// ============================================================
// SUPPORT / RESISTANCE
// ============================================================

function uniqueLevels(levels, minimumDistance = 0.00025) {
  const result = [];

  for (const level of levels) {
    if (
      !result.some(
        existing =>
          Math.abs(existing - level) <
          minimumDistance
      )
    ) {
      result.push(level);
    }
  }

  return result;
}

function calculateLevels(candles, price) {
  if (!candles || candles.length < 10) {
    return {
      resistance1: null,
      resistance2: null,
      support1: null,
      support2: null
    };
  }

  const recent = candles.slice(-60);

  const swingHighs =
    getSwingHighs(recent, 2)
      .map(x => x.price);

  const swingLows =
    getSwingLows(recent, 2)
      .map(x => x.price);

  // ----------------------------------------------------------
  // RESISTANCE
  // Nearest resistance above current price first.
  // ----------------------------------------------------------

  let resistances =
    swingHighs
      .filter(level => level > price)
      .sort((a, b) => a - b);

  resistances =
    uniqueLevels(resistances);

  // ----------------------------------------------------------
  // SUPPORT
  // Nearest support below current price first.
  // ----------------------------------------------------------

  let supports =
    swingLows
      .filter(level => level < price)
      .sort((a, b) => b - a);

  supports =
    uniqueLevels(supports);

  // ----------------------------------------------------------
  // Fallback levels if swing detection gives too few levels
  // ----------------------------------------------------------

  if (resistances.length < 2) {
    const highs =
      recent
        .map(c => c.high)
        .filter(level => level > price)
        .sort((a, b) => a - b);

    for (const level of highs) {
      if (
        !resistances.some(
          r => Math.abs(r - level) < 0.00025
        )
      ) {
        resistances.push(level);
      }
    }

    resistances =
      uniqueLevels(
        resistances.sort((a, b) => a - b)
      );
  }

  if (supports.length < 2) {
    const lows =
      recent
        .map(c => c.low)
        .filter(level => level < price)
        .sort((a, b) => b - a);

    for (const level of lows) {
      if (
        !supports.some(
          s => Math.abs(s - level) < 0.00025
        )
      ) {
        supports.push(level);
      }
    }

    supports =
      uniqueLevels(
        supports.sort((a, b) => b - a)
      );
  }

  return {
    resistance1: resistances[0] || null,
    resistance2: resistances[1] || null,

    support1: supports[0] || null,
    support2: supports[1] || null
  };
}

// ============================================================
// RSI
// ============================================================

function calculateRSI(candles, period = 14) {
  if (!candles || candles.length <= period) {
    return null;
  }

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change =
      candles[i].close -
      candles[i - 1].close;

    if (change >= 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
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
      change > 0 ? change : 0;

    const loss =
      change < 0 ? Math.abs(change) : 0;

    averageGain =
      ((averageGain * (period - 1)) + gain) /
      period;

    averageLoss =
      ((averageLoss * (period - 1)) + loss) /
      period;
  }

  if (averageLoss === 0) {
    return 100;
  }

  const rs =
    averageGain / averageLoss;

  return 100 - (100 / (1 + rs));
}

// ============================================================
// EMA
// ============================================================

function calculateEMA(candles, period = 20) {
  if (!candles || candles.length < period) {
    return null;
  }

  const multiplier =
    2 / (period + 1);

  let ema =
    candles
      .slice(0, period)
      .reduce(
        (sum, c) => sum + c.close,
        0
      ) / period;

  for (
    let i = period;
    i < candles.length;
    i++
  ) {
    ema =
      (candles[i].close - ema) *
      multiplier +
      ema;
  }

  return ema;
}

// ============================================================
// EMA STRUCTURE
// ============================================================

function getEMAStructure(candles) {
  const ema20 =
    calculateEMA(candles, 20);

  const ema50 =
    calculateEMA(candles, 50);

  if (
    ema20 === null ||
    ema50 === null
  ) {
    return "RANGE";
  }

  if (ema20 > ema50) {
    return "BULLISH";
  }

  if (ema20 < ema50) {
    return "BEARISH";
  }

  return "RANGE";
}

// ============================================================
// TECHNICAL ANALYSIS
// ============================================================

function updateTechnicalAnalysis() {
  const h4 = marketData.h4;
  const h1 = marketData.h1;
  const m15 = marketData.m15;
  const m5 = marketData.m5;
  const price = marketData.price;

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
    calculateLevels(m15, price);

  setText("h4Trend", h4Trend);
  setText("h1Trend", h1Trend);
  setText("m15Structure", m15Structure);
  setText("m5Structure", m5Structure);

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
    formatPrice(levels.resistance1)
  );

  setText(
    "resistance2",
    formatPrice(levels.resistance2)
  );

  setText(
    "support1",
    formatPrice(levels.support1)
  );

  setText(
    "support2",
    formatPrice(levels.support2)
  );

  // Save for engines
  marketData.h4Trend = h4Trend;
  marketData.h1Trend = h1Trend;
  marketData.m15Structure = m15Structure;
  marketData.m5Structure = m5Structure;

  marketData.h4Rsi = h4Rsi;
  marketData.h1Rsi = h1Rsi;
  marketData.m15Rsi = m15Rsi;
  marketData.m5Rsi = m5Rsi;

  marketData.emaStructure = emaStructure;
  marketData.levels = levels;

  runSniperEngine();
  runScalpingEngine();
  runProEngine();
}

// ============================================================
// CANDLE DIRECTION
// ============================================================

function getLastCandleDirection(candles) {
  if (!candles || candles.length < 2) {
    return "NEUTRAL";
  }

  const c =
    candles[candles.length - 1];

  if (c.close > c.open) {
    return "BULLISH";
  }

  if (c.close < c.open) {
    return "BEARISH";
  }

  return "NEUTRAL";
}

// ============================================================
// SNIPER ENGINE
// ============================================================

function runSniperEngine() {
  const h4 = marketData.h4Trend;
  const h1 = marketData.h1Trend;
  const m15 = marketData.m15Structure;
  const m5 = marketData.m5Structure;

  const price = marketData.price;

  const levels =
    marketData.levels;

  const ema =
    marketData.emaStructure;

  const m15Rsi =
    marketData.m15Rsi;

  const m5Rsi =
    marketData.m5Rsi;

  // ----------------------------------------------------------
  // NEWS FILTER
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
  // H4 DIRECTION
  // ----------------------------------------------------------

  if (h4 === "RANGE") {
    setText(
      "sniperStatus",
      "WAIT — H4 NO CLEAR DIRECTION"
    );

    setText("direction", "WAIT");

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
  // H4/H1 ALIGNMENT
  // ----------------------------------------------------------

  if (h4 !== h1) {
    setText(
      "sniperStatus",
      "WAIT — H4/H1 CONFLICT"
    );

    setText("direction", "WAIT");

    setText(
      "validity",
      "H4 and H1 must align."
    );

    setText(
      "trigger",
      "Wait for H1 to align with H4"
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

  // M15 structure
  if (m15 === direction) {
    score += 25;
  }

  // M5 structure
  if (m5 === direction) {
    score += 20;
  }

  // EMA
  if (ema === direction) {
    score += 20;
  }

  // RSI
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

  // M5 RSI
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

  // News clear
  if (newsClear) {
    score += 10;
  }

  setText(
    "setupScore",
    `${score}/100`
  );

  // ----------------------------------------------------------
  // A+ THRESHOLD
  // ----------------------------------------------------------

  if (score < 75) {
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

  // ----------------------------------------------------------
  // ENTRY / SL / TP
  // ----------------------------------------------------------

  const entry = price;

  let stopLoss;
  let tp1;
  let tp2;
  let tp3;

  if (direction === "BULLISH") {
    stopLoss =
      levels.support1 ||
      entry - 0.0010;

    const riskDistance =
      entry - stopLoss;

    if (riskDistance <= 0) {
      setText(
        "sniperStatus",
        "WAIT — INVALID LONG STRUCTURE"
      );

      clearTradeFields();
      return;
    }

    tp1 =
      entry + riskDistance * 1.5;

    tp2 =
      entry + riskDistance * 2.0;

    tp3 =
      entry + riskDistance * 3.0;

  } else {
    stopLoss =
      levels.resistance1 ||
      entry + 0.0010;

    const riskDistance =
      stopLoss - entry;

    if (riskDistance <= 0) {
      setText(
        "sniperStatus",
        "WAIT — INVALID SHORT STRUCTURE"
      );

      clearTradeFields();
      return;
    }

    tp1 =
      entry - riskDistance * 1.5;

    tp2 =
      entry - riskDistance * 2.0;

    tp3 =
      entry - riskDistance * 3.0;
  }

  const risk =
    Math.abs(entry - stopLoss);

  const reward =
    Math.abs(tp2 - entry);

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
// CLEAR SNIPER TRADE FIELDS
// ============================================================

function clearTradeFields() {
  setText("entry", "—");
  setText("stopLoss", "—");
  setText("tp1", "—");
  setText("tp2", "—");
  setText("tp3", "—");
  setText("riskReward", "—");
  setText("setupScore", "—");
}

// ============================================================
// SCALPING ENGINE
// ============================================================

function runScalpingEngine() {
  const h1 =
    marketData.h1Trend;

  const m5 =
    marketData.m5Structure;

  const m5Rsi =
    marketData.m5Rsi;

  const price =
    marketData.price;

  const levels =
    marketData.levels;

  // News filter first
  if (!newsClear) {
    setText(
      "scalpVerdict",
      "WAIT — NEWS FILTER NOT CONFIRMED"
    );

    setText(
      "scalpDirection",
      "WAIT"
    );

    setText(
      "scalpValidity",
      "High-impact news filter is not confirmed."
    );

    return;
  }

  // H1 must have direction
  if (h1 === "RANGE") {
    setText(
      "scalpVerdict",
      "WAIT — H1 NO CLEAR DIRECTION"
    );

    setText(
      "scalpDirection",
      "WAIT"
    );

    setText(
      "scalpValidity",
      "NEXT 2 HOURS — H1 IS RANGE"
    );

    setText(
      "scalpTrigger",
      "Wait for H1 directional structure"
    );

    setText(
      "scalpInvalidation",
      "No scalp while H1 remains RANGE"
    );

    clearScalpFields();

    return;
  }

  const direction =
    h1;

  let score = 0;

  if (m5 === direction) {
    score += 40;
  }

  if (
    direction === "BULLISH" &&
    m5Rsi !== null &&
    m5Rsi > 50
  ) {
    score += 30;
  }

  if (
    direction === "BEARISH" &&
    m5Rsi !== null &&
    m5Rsi < 50
  ) {
    score += 30;
  }

  if (newsClear) {
    score += 30;
  }

  setText(
    "scalpScore",
    `${score}/100`
  );

  if (score < 70) {
    setText(
      "scalpVerdict",
      `WAIT — SCALP SCORE ${score}/100`
    );

    setText(
      "scalpDirection",
      direction
    );

    setText(
      "scalpValidity",
      "M5 confirmation is not strong enough."
    );

    setText(
      "scalpTrigger",
      `Wait for M5 ${direction} confirmation`
    );

    setText(
      "scalpInvalidation",
      "Scalp score below threshold"
    );

    clearScalpFields();

    return;
  }

  const entry =
    price;

  let sl;
  let tp1;
  let tp2;

  if (direction === "BULLISH") {
    sl =
      levels.support1 ||
      entry - 0.0006;

    const riskDistance =
      entry - sl;

    if (riskDistance <= 0) {
      clearScalpFields();
      return;
    }

    tp1 =
      entry + riskDistance * 1.5;

    tp2 =
      entry + riskDistance * 2.0;

  } else {
    sl =
      levels.resistance1 ||
      entry + 0.0006;

    const riskDistance =
      sl - entry;

    if (riskDistance <= 0) {
      clearScalpFields();
      return;
    }

    tp1 =
      entry - riskDistance * 1.5;

    tp2 =
      entry - riskDistance * 2.0;
  }

  const risk =
    Math.abs(entry - sl);

  const reward =
    Math.abs(tp2 - entry);

  const rr =
    risk > 0
      ? reward / risk
      : 0;

  setText(
    "scalpVerdict",
    `SCALP ${direction}`
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
    formatPrice(sl)
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
    `1:${rr.toFixed(2)}`
  );

  setText(
    "scalpValidity",
    "NEXT 2 HOURS — technical conditions aligned."
  );

  setText(
    "scalpTrigger",
    `Wait for M5 ${direction} confirmation.`
  );

  setText(
    "scalpInvalidation",
    direction === "BULLISH"
      ? `Invalid below ${formatPrice(sl)}`
      : `Invalid above ${formatPrice(sl)}`
  );
}

// ============================================================
// CLEAR SCALP
// ============================================================

function clearScalpFields() {
  setText("scalpEntry", "—");
  setText("scalpSL", "—");
  setText("scalpTP1", "—");
  setText("scalpTP2", "—");
  setText("scalpRR", "—");
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

  if (h4 === "RANGE") {
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

  if (h4 !== h1) {
    setText(
      "proVerdict",
      "WAIT — H4/H1 CONFLICT"
    );

    setText(
      "proExplanation",
      "Higher-timeframe structure is not aligned. Wait for H1 to align with H4."
    );

    return;
  }

  if (m15 !== h4) {
    setText(
      "proVerdict",
      "WAIT — M15 CONFIRMATION"
    );

    setText(
      "proExplanation",
      `H4/H1 are ${h4}, but M15 has not confirmed the same direction yet.`
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
      await fetch(NEWS_URL, {
        cache: "no-store"
      });

    const data =
      await response.json();

    processNews(data);

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
    Array.isArray(data?.data)
      ? data.data
      : [];

  const now =
    Date.now();

  const relevantEvents =
    events.filter(event => {

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
        (currency === "EUR" ||
         currency === "USD") &&
        (
          importance === "high" ||
          importance === "3" ||
          importance.includes("high")
        )
      );
    });

  const upcoming =
    relevantEvents
      .map(event => {

        const dateValue =
          event.datetime ||
          event.date ||
          event.time ||
          event.releaseAt ||
          event.release_at;

        const timestamp =
          Date.parse(dateValue);

        return {
          ...event,
          timestamp
        };
      })
      .filter(event =>
        Number.isFinite(event.timestamp)
      )
      .sort(
        (a, b) =>
          a.timestamp -
          b.timestamp
      );

  const eurEvents =
    upcoming.filter(event =>
      String(
        event.currency ||
        event.currency_code ||
        ""
      ).toUpperCase() === "EUR"
    );

  const usdEvents =
    upcoming.filter(event =>
      String(
        event.currency ||
        event.currency_code ||
        ""
      ).toUpperCase() === "USD"
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

  if (!nextEvent) {
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
    (nextEvent.timestamp - now) /
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
  // 30 minutes before → 30 minutes after
  // ----------------------------------------------------------

  const withinNewsWindow =
    minutesUntil >= -30 &&
    minutesUntil <= 30;

  // Additional safety:
  // if important event is within next 2 hours,
  // do not allow a fresh sniper setup.
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

function displayNewsEvents(id, events) {
  if (!events.length) {
    setText(
      id,
      `NO ${id === "eurNews" ? "EUR" : "USD"} HIGH-IMPACT EVENTS FOUND`
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

  const timestamp =
    event.timestamp;

  const date =
    new Date(timestamp);

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

function changeChart(interval) {
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

    // Refresh every 2 minutes
    setInterval(
      loadMarketData,
      120000
    );
  }
);
