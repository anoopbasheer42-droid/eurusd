// ============================================================
// EUR/USD SNIPER DASHBOARD
// Complete script.js
// ============================================================

// ================= CONFIG =================

const API_KEY = "8908432b6c784bc49aad6ccf64845991";

const PRICE_URL =
  `https://api.twelvedata.com/price?symbol=EUR/USD&apikey=${API_KEY}`;

const TIME_SERIES_URL =
  "https://api.twelvedata.com/time_series";

const NEWS_URL =
  "https://xoomar.com/markets/api/calendar";


// ================= GLOBAL DATA =================

let marketData = {
  H4: [],
  H1: [],
  M15: [],
  M5: []
};

let currentPrice = null;
let newsData = [];


// ================= HELPERS =================

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


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// ================= FETCH PRICE =================

async function fetchPrice() {

  try {

    const response = await fetch(PRICE_URL);

    if (!response.ok) {
      throw new Error("Price API HTTP error");
    }

    const data = await response.json();

    if (!data.price) {
      throw new Error(data.message || "Price unavailable");
    }

    currentPrice = Number(data.price);

    setText(
      "price",
      formatPrice(currentPrice)
    );

    setText(
      "priceStatus",
      "MARKET DATA LOADED"
    );

    return currentPrice;

  } catch (error) {

    console.error("Price error:", error);

    setText(
      "priceStatus",
      "PRICE CONNECTION ERROR"
    );

    return null;
  }
}


// ================= FETCH CANDLES =================

async function fetchCandles(interval, outputsize = 100) {

  const url =
    `${TIME_SERIES_URL}` +
    `?symbol=EUR/USD` +
    `&interval=${interval}` +
    `&outputsize=${outputsize}` +
    `&apikey=${API_KEY}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Candle API HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.values) {
    throw new Error(
      data.message || `No ${interval} candle data`
    );
  }

  return data.values
    .map(c => ({
      time: new Date(c.datetime).getTime(),
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close)
    }))
    .sort((a, b) => a.time - b.time);
}


// ================= LOAD ALL TIMEFRAMES =================

async function loadCandles() {

  try {

    marketData.H4 = await fetchCandles("4h");
    await sleep(300);

    marketData.H1 = await fetchCandles("1h");
    await sleep(300);

    marketData.M15 = await fetchCandles("15min");
    await sleep(300);

    marketData.M5 = await fetchCandles("5min");

    console.log("Candles loaded:", marketData);

    return true;

  } catch (error) {

    console.error("Candle loading error:", error);

    return false;
  }
}


// ================= EMA =================

function calculateEMA(candles, period) {

  if (!candles || candles.length < period) {
    return null;
  }

  const closes =
    candles.map(c => c.close);

  const multiplier =
    2 / (period + 1);

  let ema =
    closes
      .slice(0, period)
      .reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < closes.length; i++) {

    ema =
      (closes[i] - ema) * multiplier + ema;
  }

  return ema;
}


// ================= RSI =================

function calculateRSI(candles, period = 14) {

  if (!candles || candles.length < period + 1) {
    return null;
  }

  const closes =
    candles.map(c => c.close);

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {

    const change =
      closes[i] - closes[i - 1];

    if (change >= 0) {
      gains += change;
    } else {
      losses -= change;
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
      closes[i] - closes[i - 1];

    const gain =
      change > 0 ? change : 0;

    const loss =
      change < 0 ? -change : 0;

    avgGain =
      ((avgGain * (period - 1)) + gain) / period;

    avgLoss =
      ((avgLoss * (period - 1)) + loss) / period;
  }

  if (avgLoss === 0) {
    return 100;
  }

  const rs =
    avgGain / avgLoss;

  return 100 - (100 / (1 + rs));
}


// ================= MARKET STRUCTURE =================

function getStructure(candles) {

  if (!candles || candles.length < 10) {
    return "INSUFFICIENT DATA";
  }

  const recent =
    candles.slice(-10);

  const first =
    recent.slice(0, 5);

  const last =
    recent.slice(-5);

  const firstHigh =
    Math.max(...first.map(c => c.high));

  const lastHigh =
    Math.max(...last.map(c => c.high));

  const firstLow =
    Math.min(...first.map(c => c.low));

  const lastLow =
    Math.min(...last.map(c => c.low));

  const firstClose =
    first[first.length - 1].close;

  const lastClose =
    last[last.length - 1].close;


  if (
    lastHigh < firstHigh &&
    lastLow < firstLow &&
    lastClose < firstClose
  ) {
    return "BEARISH";
  }


  if (
    lastHigh > firstHigh &&
    lastLow > firstLow &&
    lastClose > firstClose
  ) {
    return "BULLISH";
  }


  return "RANGE";
}


// ================= SUPPORT / RESISTANCE =================

function calculateLevels(candles) {

  if (!candles || candles.length < 20) {
    return {
      resistance1: null,
      resistance2: null,
      support1: null,
      support2: null
    };
  }

  const recent =
    candles.slice(-50);

  const highs =
    recent.map(c => c.high);

  const lows =
    recent.map(c => c.low);

  const sortedHighs =
    [...highs].sort((a, b) => b - a);

  const sortedLows =
    [...lows].sort((a, b) => a - b);

  return {

    resistance1:
      sortedHighs[0],

    resistance2:
      sortedHighs[1],

    support1:
      sortedLows[0],

    support2:
      sortedLows[1]
  };
}


// ================= UPDATE TECHNICALS =================

function updateTechnicalAnalysis() {

  const h4 = marketData.H4;
  const h1 = marketData.H1;
  const m15 = marketData.M15;
  const m5 = marketData.M5;


  // ---------- STRUCTURE ----------

  const h4Trend =
    getStructure(h4);

  const h1Trend =
    getStructure(h1);

  const m15Structure =
    getStructure(m15);

  const m5Structure =
    getStructure(m5);


  setText("h4Trend", h4Trend);
  setText("h1Trend", h1Trend);
  setText("m15Structure", m15Structure);
  setText("m5Structure", m5Structure);


  // ---------- RSI ----------

  const h4RSI =
    calculateRSI(h4);

  const h1RSI =
    calculateRSI(h1);

  const m15RSI =
    calculateRSI(m15);

  const m5RSI =
    calculateRSI(m5);


  setText(
    "h4Rsi",
    h4RSI !== null
      ? h4RSI.toFixed(1)
      : "—"
  );

  setText(
    "h1Rsi",
    h1RSI !== null
      ? h1RSI.toFixed(1)
      : "—"
  );

  setText(
    "m15Rsi",
    m15RSI !== null
      ? m15RSI.toFixed(1)
      : "—"
  );

  setText(
    "m5Rsi",
    m5RSI !== null
      ? m5RSI.toFixed(1)
      : "—"
  );


  // ---------- EMA ----------

  const h1EMA20 =
    calculateEMA(h1, 20);

  const h1EMA50 =
    calculateEMA(h1, 50);

  let emaStructure =
    "NEUTRAL";

  if (
    h1EMA20 !== null &&
    h1EMA50 !== null
  ) {

    if (h1EMA20 > h1EMA50) {
      emaStructure = "BULLISH";
    }

    else if (h1EMA20 < h1EMA50) {
      emaStructure = "BEARISH";
    }
  }

  setText(
    "emaStructure",
    emaStructure
  );


  // ---------- S/R ----------

  const levels =
    calculateLevels(h1);

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


  // ---------- ENGINES ----------

  runSniperEngine(
    h4Trend,
    h1Trend,
    m15Structure,
    m5Structure,
    h4RSI,
    h1RSI,
    m15RSI,
    m5RSI,
    emaStructure,
    levels
  );


  runScalpingEngine(
    h1Trend,
    m5Structure,
    m5RSI,
    levels
  );


  updateProVerdict(
    h4Trend,
    h1Trend,
    m15Structure,
    m5Structure
  );
}


// ================= NEWS =================

async function loadNews() {

  try {

    setText(
      "eurNews",
      "CHECKING..."
    );

    setText(
      "usdNews",
      "CHECKING..."
    );

    setText(
      "newsFilter",
      "CHECKING..."
    );

    const response =
      await fetch(NEWS_URL, {
        cache: "no-store"
      });

    if (!response.ok) {
      throw new Error(
        `News API HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      throw new Error("Invalid news response");
    }

    newsData =
      data.data;

    console.log(
      "Economic calendar loaded:",
      newsData
    );

    processNews();

  } catch (error) {

    console.error(
      "News loading error:",
      error
    );

    setText(
      "eurNews",
      "NOT CONNECTED"
    );

    setText(
      "usdNews",
      "NOT CONNECTED"
    );

    setText(
      "newsFilter",
      "NEWS CHECK REQUIRED"
    );

    setText(
      "nextEvent",
      "ECONOMIC CALENDAR REQUIRED"
    );

    setText(
      "tradingRisk",
      "HIGH — NEWS FILTER CLOSED"
    );

    // Keep both engines closed if news cannot be verified.
    window.newsClear = false;
  }
}


// ================= PROCESS NEWS =================

function processNews() {

  const now =
    Date.now();

  const next2Hours =
    now + (2 * 60 * 60 * 1000);


  const upcoming =
    newsData
      .filter(event => {

        if (!event.scheduledAt) {
          return false;
        }

        const eventTime =
          new Date(event.scheduledAt).getTime();

        return (
          eventTime >= now &&
          eventTime <= next2Hours
        );
      })
      .filter(event =>
        event.importance === "high"
      )
      .sort(
        (a, b) =>
          new Date(a.scheduledAt) -
          new Date(b.scheduledAt)
      );


  // Find EUR/USD-relevant high-impact events.
  const relevant =
    upcoming.filter(event => {

      const name =
        (event.eventName || "")
          .toLowerCase();

      const source =
        (event.source || "")
          .toLowerCase();

      return (
        source === "ecb" ||
        source === "fed" ||
        source === "bls" ||
        source === "bea" ||
        source === "dol" ||
        source === "census" ||
        name.includes("fed") ||
        name.includes("fomc") ||
        name.includes("cpi") ||
        name.includes("payroll") ||
        name.includes("employment") ||
        name.includes("pce") ||
        name.includes("jobless")
      );
    });


  // Determine EUR/USD exposure.
  const eurEvents =
    relevant.filter(event => {

      const name =
        (event.eventName || "")
          .toLowerCase();

      return (
        name.includes("ecb") ||
        name.includes("euro") ||
        name.includes("eur")
      );
    });


  const usdEvents =
    relevant.filter(event => {

      const source =
        (event.source || "")
          .toLowerCase();

      const name =
        (event.eventName || "")
          .toLowerCase();

      return (
        source === "fed" ||
        source === "bls" ||
        source === "bea" ||
        source === "dol" ||
        source === "census" ||
        name.includes("fed") ||
        name.includes("fomc") ||
        name.includes("cpi") ||
        name.includes("payroll") ||
        name.includes("employment") ||
        name.includes("pce") ||
        name.includes("jobless")
      );
    });


  setText(
    "eurNews",
    eurEvents.length
      ? `${eurEvents.length} HIGH-IMPACT`
      : "NO HIGH-IMPACT"
  );


  setText(
    "usdNews",
    usdEvents.length
      ? `${usdEvents.length} HIGH-IMPACT`
      : "NO HIGH-IMPACT"
  );


  if (relevant.length > 0) {

    const event =
      relevant[0];

    const eventTime =
      new Date(event.scheduledAt);

    setText(
      "newsFilter",
      "⚠️ HIGH-IMPACT NEWS WINDOW"
    );

    setText(
      "nextEvent",
      `${event.eventName} — ${eventTime.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      })} IST`
    );

    setText(
      "tradingRisk",
      "HIGH — WAIT FOR NEWS CLEARANCE"
    );

    window.newsClear = false;

  } else {

    setText(
      "newsFilter",
      "✅ NEWS CLEAR"
    );

    setText(
      "nextEvent",
      "No high-impact EUR/USD event in next 2 hours"
    );

    setText(
      "tradingRisk",
      "NORMAL — TECHNICAL FILTER ACTIVE"
    );

    window.newsClear = true;
  }


  // Re-run engines after news status changes.
  if (
    marketData.H1.length &&
    marketData.M5.length
  ) {
    updateTechnicalAnalysis();
  }
}


// ================= SNIPER ENGINE =================

function runSniperEngine(
  h4Trend,
  h1Trend,
  m15Structure,
  m5Structure,
  h4RSI,
  h1RSI,
  m15RSI,
  m5RSI,
  emaStructure,
  levels
) {

  const newsClear =
    window.newsClear === true;


  // Always require news clearance.
  if (!newsClear) {

    setText(
      "sniperStatus",
      "WAIT — NEWS FILTER NOT CONFIRMED"
    );

    setText("direction", "WAIT");
    setText("entry", "—");
    setText("stopLoss", "—");
    setText("tp1", "—");
    setText("tp2", "—");
    setText("tp3", "—");
    setText("riskReward", "—");

    setText(
      "validity",
      "NEWS FILTER CLOSED"
    );

    setText(
      "trigger",
      "H4/H1 direction → M15 confirmation → M5 trigger → news clearance"
    );

    setText(
      "invalidation",
      "No trade while NEWS FILTER is CLOSED"
    );

    return;
  }


  // H4 + H1 must agree.
  if (h4Trend !== h1Trend) {

    setText(
      "sniperStatus",
      "WAIT — HIGHER TIMEFRAME CONFLICT"
    );

    setText("direction", "WAIT");
    setText("entry", "—");
    setText("stopLoss", "—");
    setText("tp1", "—");
    setText("tp2", "—");
    setText("tp3", "—");
    setText("riskReward", "—");

    setText(
      "validity",
      "H4/H1 conflict detected"
    );

    setText(
      "trigger",
      "H4 and H1 must align → M15 confirmation → M5 trigger"
    );

    setText(
      "invalidation",
      "No trade while higher timeframes conflict"
    );

    return;
  }


  const direction =
    h4Trend;


  let score = 0;


  if (h4Trend === direction) {
    score += 2;
  }

  if (h1Trend === direction) {
    score += 2;
  }

  if (m15Structure === direction) {
    score += 2;
  }

  if (m5Structure === direction) {
    score += 1;
  }

  if (emaStructure === direction) {
    score += 1;
  }


  if (
    direction === "BULLISH" &&
    h1RSI !== null &&
    h1RSI < 65
  ) {
    score += 1;
  }


  if (
    direction === "BEARISH" &&
    h1RSI !== null &&
    h1RSI > 35
  ) {
    score += 1;
  }


  if (newsClear) {
    score += 1;
  }


  setText(
    "setupScore",
    `${score} / 11`
  );


  // Require strong alignment.
  if (score < 8) {

    setText(
      "sniperStatus",
      "WAIT — A+ CONDITIONS NOT COMPLETE"
    );

    setText(
      "direction",
      direction
    );

    setText("entry", "—");
    setText("stopLoss", "—");
    setText("tp1", "—");
    setText("tp2", "—");
    setText("tp3", "—");
    setText("riskReward", "—");

    setText(
      "validity",
      "A+ alignment required"
    );

    setText(
      "trigger",
      "Wait for M15 confirmation and M5 trigger"
    );

    setText(
      "invalidation",
      "Setup invalid below required score"
    );

    return;
  }


  createSniperTrade(
    direction,
    levels
  );
}


// ================= CREATE SNIPER TRADE =================

function createSniperTrade(
  direction,
  levels
) {

  if (!currentPrice) {
    return;
  }


  let entry;
  let sl;
  let tp1;
  let tp2;
  let tp3;


  if (direction === "BULLISH") {

    entry =
      currentPrice;

    sl =
      levels.support1
        ? levels.support1 - 0.00020
        : currentPrice - 0.00100;

    const risk =
      entry - sl;

    tp1 =
      entry + risk * 2;

    tp2 =
      entry + risk * 3;

    tp3 =
      entry + risk * 4;


    setText(
      "sniperStatus",
      "🟢 A+ BUY SETUP"
    );

  } else {

    entry =
      currentPrice;

    sl =
      levels.resistance1
        ? levels.resistance1 + 0.00020
        : currentPrice + 0.00100;

    const risk =
      sl - entry;

    tp1 =
      entry - risk * 2;

    tp2 =
      entry - risk * 3;

    tp3 =
      entry - risk * 4;


    setText(
      "sniperStatus",
      "🔴 A+ SELL SETUP"
    );
  }


  const risk =
    Math.abs(entry - sl);

  const reward =
    Math.abs(tp1 - entry);

  const rr =
    risk > 0
      ? reward / risk
      : 0;


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
    formatPrice(sl)
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
    `1 : ${rr.toFixed(1)}`
  );

  setText(
    "validity",
    "Valid while H4/H1/M15/M5 alignment remains intact"
  );

  setText(
    "trigger",
    "M15 confirmation + M5 price-action trigger"
  );

  setText(
    "invalidation",
    formatPrice(sl)
  );
}


// ================= SCALPING ENGINE =================

function runScalpingEngine(
  h1Trend,
  m5Structure,
  m5RSI,
  levels
) {

  const newsClear =
    window.newsClear === true;


  if (!newsClear) {

    setText(
      "scalpVerdict",
      "WAIT — NEWS CHECK REQUIRED"
    );

    setText(
      "scalpDirection",
      "WAIT"
    );

    setText("scalpEntry", "—");
    setText("scalpSL", "—");
    setText("scalpTP1", "—");
    setText("scalpTP2", "—");
    setText("scalpRR", "—");

    setText(
      "scalpValidity",
      "NEXT 2 HOURS — NEWS CHECK REQUIRED"
    );

    setText(
      "scalpTrigger",
      "H1 + M5 technical bias detected. Wait for EUR/USD economic-news clearance."
    );

    setText(
      "scalpInvalidation",
      "NO TRADE WHILE NEWS FILTER IS CLOSED"
    );

    return;
  }


  let score = 0;

  if (
    h1Trend === "BULLISH" ||
    h1Trend === "BEARISH"
  ) {
    score += 2;
  }

  if (
    m5Structure === h1Trend
  ) {
    score += 2;
  }

  if (
    m5RSI !== null
  ) {

    if (
      h1Trend === "BULLISH" &&
      m5RSI > 40 &&
      m5RSI < 70
    ) {
      score += 2;
    }

    if (
      h1Trend === "BEARISH" &&
      m5RSI > 30 &&
      m5RSI < 60
    ) {
      score += 2;
    }
  }


  if (
    levels.support1 &&
    levels.resistance1
  ) {
    score += 2;
  }


  setText(
    "scalpScore",
    `${score} / 8`
  );


  if (
    h1Trend !== "BULLISH" &&
    h1Trend !== "BEARISH"
  ) {

    setText(
      "scalpVerdict",
      "WAIT — NO CLEAR H1 DIRECTION"
    );

    setText(
      "scalpDirection",
      "WAIT"
    );

    setText("scalpEntry", "—");
    setText("scalpSL", "—");
    setText("scalpTP1", "—");
    setText("scalpTP2", "—");
    setText("scalpRR", "—");

    setText(
      "scalpValidity",
      "NEXT 2 HOURS — NO CLEAR DIRECTION"
    );

    return;
  }


  if (score < 6) {

    setText(
      "scalpVerdict",
      "WAIT — SCALP CONDITIONS INCOMPLETE"
    );

    setText(
      "scalpDirection",
      h1Trend
    );

    setText("scalpEntry", "—");
    setText("scalpSL", "—");
    setText("scalpTP1", "—");
    setText("scalpTP2", "—");
    setText("scalpRR", "—");

    setText(
      "scalpValidity",
      "NEXT 2 HOURS"
    );

    setText(
      "scalpTrigger",
      "Wait for M5 confirmation in the H1 direction."
    );

    setText(
      "scalpInvalidation",
      "Technical conditions below required score"
    );

    return;
  }


  createScalpTrade(
    h1Trend,
    levels
  );
}


// ================= CREATE SCALP TRADE =================

function createScalpTrade(
  direction,
  levels
) {

  if (!currentPrice) {
    return;
  }


  let entry =
    currentPrice;

  let sl;
  let tp1;
  let tp2;


  if (direction === "BULLISH") {

    sl =
      levels.support1
        ? levels.support1 - 0.00015
        : entry - 0.00070;

    const risk =
      entry - sl;

    tp1 =
      entry + risk * 1.5;

    tp2 =
      entry + risk * 2;


    setText(
      "scalpVerdict",
      "🟢 SCALP BUY BIAS"
    );

  } else {

    sl =
      levels.resistance1
        ? levels.resistance1 + 0.00015
        : entry + 0.00070;

    const risk =
      sl - entry;

    tp1 =
      entry - risk * 1.5;

    tp2 =
      entry - risk * 2;


    setText(
      "scalpVerdict",
      "🔴 SCALP SELL BIAS"
    );
  }


  const risk =
    Math.abs(entry - sl);

  const reward =
    Math.abs(tp1 - entry);

  const rr =
    risk > 0
      ? reward / risk
      : 0;


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
    `1 : ${rr.toFixed(1)}`
  );

  setText(
    "scalpValidity",
    "NEXT 2 HOURS — VALID WHILE H1 + M5 BIAS REMAINS INTACT"
  );

  setText(
    "scalpTrigger",
    "M5 price-action confirmation in H1 direction"
  );

  setText(
    "scalpInvalidation",
    formatPrice(sl)
  );
}


// ================= PRO VERDICT =================

function updateProVerdict(
  h4Trend,
  h1Trend,
  m15Structure,
  m5Structure
) {

  const newsClear =
    window.newsClear === true;


  if (!newsClear) {

    setText(
      "proVerdict",
      "WAIT — NEWS FILTER NOT CONFIRMED"
    );

    setText(
      "proExplanation",
      "Technical analysis is loaded, but trading remains closed until the EUR/USD economic-news filter is confirmed clear."
    );

    return;
  }


  if (
    h4Trend !== h1Trend
  ) {

    setText(
      "proVerdict",
      "WAIT — HIGHER-TIMEFRAME CONFLICT"
    );

    setText(
      "proExplanation",
      `H4 is ${h4Trend} while H1 is ${h1Trend}. M15 is ${m15Structure} and M5 is ${m5Structure}. No A+ sniper trade until the higher-timeframe direction aligns.`
    );

    return;
  }


  if (
    m15Structure === h4Trend
  ) {

    setText(
      "proVerdict",
      `WATCH — ${h4Trend} ALIGNMENT`
    );

    setText(
      "proExplanation",
      `H4 and H1 are aligned ${h4Trend}. M15 confirms the same direction. Wait for the M5 price-action trigger before considering an entry.`
    );

  } else {

    setText(
      "proVerdict",
      "WAIT — M15 CONFIRMATION REQUIRED"
    );

    set
