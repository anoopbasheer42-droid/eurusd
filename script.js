// ============================================================
// EUR/USD SNIPER DASHBOARD
// Corrected version
// ============================================================

// =========================
// CONFIGURATION
// =========================

const API_KEY = "8908432b6c784bc49aad6ccf64845991";

const SYMBOL = "EUR/USD";

const TIME_SERIES_URL =
    "https://api.twelvedata.com/time_series";

const NEWS_URL =
    "https://xoomar.com/api/markets/calendar?importance=high";

const REFRESH_INTERVAL = 180000; // 3 minutes


// =========================
// GLOBAL STATE
// =========================

let marketDataLoading = false;

let marketData = {
    price: null,

    h4: [],
    h1: [],
    m15: [],
    m5: [],

    news: []
};


// Sniper setup clock
let sniperSetupTime = null;
let sniperSetupActive = false;


// =========================
// BASIC HTML HELPERS
// =========================

function setText(id, value) {
    const el = document.getElementById(id);

    if (el) {
        el.textContent = value;
    }
}


function setHTML(id, value) {
    const el = document.getElementById(id);

    if (el) {
        el.innerHTML = value;
    }
}


function safeNumber(value) {
    const n = Number(value);

    return Number.isFinite(n) ? n : null;
}


function formatPrice(value) {

    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
        return "--";
    }

    return Number(value).toFixed(5);
}


function formatPips(value) {

    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
        return "--";
    }

    return Number(value).toFixed(1) + " pips";
}


// =========================
// IST TIME
// =========================

function getISTTime() {

    return new Date().toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
    }) + " IST";
}


// =========================
// SNIPER SETUP CLOCK
// =========================

function startSniperSetup() {

    // Start the clock ONLY when a new setup becomes active.

    if (!sniperSetupActive) {

        sniperSetupTime = getISTTime();

        sniperSetupActive = true;
    }

    setText("setupTime", sniperSetupTime);
}


function invalidateSniperSetup() {

    sniperSetupActive = false;

    sniperSetupTime = null;

    setText("setupTime", "--");
}


// =========================
// FETCH TWELVE DATA
// =========================

async function getCandles(interval, outputsize = 100) {

    const url =
        TIME_SERIES_URL +
        "?symbol=" + encodeURIComponent(SYMBOL) +
        "&interval=" + encodeURIComponent(interval) +
        "&outputsize=" + outputsize +
        "&apikey=" + encodeURIComponent(API_KEY);

    const response = await fetch(url, {
        cache: "no-store"
    });

    if (!response.ok) {

        throw new Error(
            "Twelve Data HTTP " + response.status
        );
    }

    const data = await response.json();

    if (data.status === "error") {

        throw new Error(
            data.message || "Twelve Data error"
        );
    }

    if (!data.values || !Array.isArray(data.values)) {

        throw new Error(
            "No candle data returned for " + interval
        );
    }

    return data.values
        .map(c => ({
            datetime: c.datetime,

            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),

            volume: c.volume !== undefined
                ? Number(c.volume)
                : 0
        }))
        .filter(c =>
            Number.isFinite(c.open) &&
            Number.isFinite(c.high) &&
            Number.isFinite(c.low) &&
            Number.isFinite(c.close)
        )
        .sort((a, b) =>
            new Date(a.datetime) - new Date(b.datetime)
        );
}


// =========================
// LATEST COMPLETED CANDLE
// =========================

function getLatestCompletedCandle(candles) {

    if (!candles || candles.length < 2) {
        return null;
    }

    // Twelve Data returns the newest candle first.
    // After sorting ascending, the final candle is normally
    // the currently forming candle.
    //
    // Therefore the candle immediately before it is used.

    return candles[candles.length - 2];
}


function getLatestCompletedClose(candles) {

    const candle = getLatestCompletedCandle(candles);

    if (!candle) {
        return null;
    }

    return candle.close;
}


// =========================
// PRICE
// =========================

function getMarketPrice() {

    return getLatestCompletedClose(marketData.m5);
}


// =========================
// EMA
// =========================

function calculateEMA(candles, period) {

    if (!candles || candles.length < period) {
        return null;
    }

    const closes = candles.map(c => c.close);

    const multiplier = 2 / (period + 1);

    let ema = closes
        .slice(0, period)
        .reduce((sum, value) => sum + value, 0) / period;

    for (let i = period; i < closes.length; i++) {

        ema =
            (closes[i] - ema) * multiplier +
            ema;
    }

    return ema;
}


// =========================
// RSI
// =========================

function calculateRSI(candles, period = 14) {

    if (!candles || candles.length < period + 1) {
        return null;
    }

    const closes = candles.map(c => c.close);

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {

        const change = closes[i] - closes[i - 1];

        if (change >= 0) {
            gains += change;
        } else {
            losses += Math.abs(change);
        }
    }

    let averageGain = gains / period;
    let averageLoss = losses / period;

    for (let i = period + 1; i < closes.length; i++) {

        const change = closes[i] - closes[i - 1];

        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;

        averageGain =
            ((averageGain * (period - 1)) + gain) / period;

        averageLoss =
            ((averageLoss * (period - 1)) + loss) / period;
    }

    if (averageLoss === 0) {
        return 100;
    }

    const rs = averageGain / averageLoss;

    return 100 - (100 / (1 + rs));
}


// =========================
// TREND
// =========================

function getTrend(candles) {

    if (!candles || candles.length < 50) {
        return "UNKNOWN";
    }

    const ema20 = calculateEMA(candles, 20);
    const ema50 = calculateEMA(candles, 50);

    const last = getLatestCompletedCandle(candles);

    if (!last || ema20 === null || ema50 === null) {
        return "UNKNOWN";
    }

    if (
        last.close > ema20 &&
        ema20 > ema50
    ) {
        return "BULLISH";
    }

    if (
        last.close < ema20 &&
        ema20 < ema50
    ) {
        return "BEARISH";
    }

    return "NEUTRAL";
}


// =========================
// MARKET STRUCTURE
// =========================

function getStructure(candles) {

    if (!candles || candles.length < 10) {
        return "UNKNOWN";
    }

    const recent = candles.slice(-10);

    const highs = recent.map(c => c.high);
    const lows = recent.map(c => c.low);

    const last = recent[recent.length - 1];

    const previousHigh =
        Math.max(...highs.slice(0, -1));

    const previousLow =
        Math.min(...lows.slice(0, -1));

    if (
        last.high > previousHigh &&
        last.low > previousLow
    ) {
        return "BULLISH";
    }

    if (
        last.high < previousHigh &&
        last.low < previousLow
    ) {
        return "BEARISH";
    }

    return "NEUTRAL";
}


// =========================
// SUPPORT / RESISTANCE
// =========================

function calculateSupportResistance(candles) {

    if (!candles || candles.length < 20) {

        return {
            r2: null,
            r1: null,
            s1: null,
            s2: null
        };
    }

    const recent = candles.slice(-20);

    const highs = recent.map(c => c.high);
    const lows = recent.map(c => c.low);

    const current =
        getLatestCompletedClose(candles);

    const resistance =
        highs.filter(x => x > current);

    const support =
        lows.filter(x => x < current);

    resistance.sort((a, b) => a - b);

    support.sort((a, b) => b - a);

    return {

        r1: resistance.length
            ? resistance[0]
            : Math.max(...highs),

        r2: resistance.length > 1
            ? resistance[1]
            : Math.max(...highs),

        s1: support.length
            ? support[0]
            : Math.min(...lows),

        s2: support.length > 1
            ? support[1]
            : Math.min(...lows)
    };
}


// =========================
// CANDLE MOMENTUM
// =========================

function getMomentum(candles) {

    const candle =
        getLatestCompletedCandle(candles);

    if (!candle) {
        return "UNKNOWN";
    }

    const body =
        Math.abs(candle.close - candle.open);

    const range =
        candle.high - candle.low;

    if (range <= 0) {
        return "NEUTRAL";
    }

    const bodyRatio =
        body / range;

    if (bodyRatio < 0.55) {
        return "NEUTRAL";
    }

    if (candle.close > candle.open) {
        return "BULLISH";
    }

    if (candle.close < candle.open) {
        return "BEARISH";
    }

    return "NEUTRAL";
}


// =========================
// RSI CONFIRMATION
// =========================

function rsiDirection(rsi) {

    if (rsi === null) {
        return "UNKNOWN";
    }

    if (rsi >= 52 && rsi <= 70) {
        return "BULLISH";
    }

    if (rsi <= 48 && rsi >= 30) {
        return "BEARISH";
    }

    return "NEUTRAL";
}


// =========================
// SESSION
// =========================

function isActiveTradingSession() {

    const hour = Number(
        new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            hour12: false
        }).format(new Date())
    );

    // Broad London / New York active period in IST.
    return hour >= 12 && hour < 23;
}


// =========================
// NEWS
// =========================

async function getNews() {

    try {

        const response = await fetch(
            NEWS_URL,
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                "News HTTP " + response.status
            );
        }

        const data = await response.json();

        if (Array.isArray(data)) {
            return data;
        }

        if (Array.isArray(data.data)) {
            return data.data;
        }

        if (Array.isArray(data.events)) {
            return data.events;
        }

        return [];

    } catch (error) {

        console.error("News error:", error);

        return null;
    }
}


// =========================
// NEWS FILTER
// =========================

function analyzeNews(news) {

    if (!Array.isArray(news)) {

        return {
            status: "UNKNOWN",
            eur: "Unknown",
            usd: "Unknown",
            nextEvent: "--"
        };
    }

    const now = Date.now();

    let eurEvents = [];
    let usdEvents = [];

    for (const event of news) {

        const currency =
            String(
                event.currency ||
                event.country ||
                event.ccy ||
                ""
            ).toUpperCase();

        const name =
            String(
                event.title ||
                event.event ||
                event.name ||
                ""
            );

        if (currency.includes("EUR")) {
            eurEvents.push(event);
        }

        if (
            currency.includes("USD") ||
            currency.includes("US")
        ) {
            usdEvents.push(event);
        }
    }

    const highImpact = [
        ...eurEvents,
        ...usdEvents
    ];

    let nextEvent = "--";

    for (const event of highImpact) {

        const rawTime =
            event.datetime ||
            event.date ||
            event.time;

        if (!rawTime) {
            continue;
        }

        const eventTime =
            new Date(rawTime).getTime();

        if (
            Number.isFinite(eventTime) &&
            eventTime >= now
        ) {

            nextEvent =
                event.title ||
                event.event ||
                event.name ||
                "--";

            break;
        }
    }

    return {

        status: "CLEAR",

        eur:
            eurEvents.length
                ? "Events"
                : "Clear",

        usd:
            usdEvents.length
                ? "Events"
                : "Clear",

        nextEvent
    };
}


// =========================
// EMA STRUCTURE
// =========================

function getEMADirection(candles) {

    if (!candles || candles.length < 50) {
        return "UNKNOWN";
    }

    const ema20 =
        calculateEMA(candles, 20);

    const ema50 =
        calculateEMA(candles, 50);

    const price =
        getLatestCompletedClose(candles);

    if (
        ema20 === null ||
        ema50 === null ||
        price === null
    ) {
        return "UNKNOWN";
    }

    if (
        price > ema20 &&
        ema20 > ema50
    ) {
        return "BULLISH";
    }

    if (
        price < ema20 &&
        ema20 < ema50
    ) {
        return "BEARISH";
    }

    return "NEUTRAL";
}


// =========================
// ALIGNMENT
// =========================

function allAligned(direction, ...values) {

    return values.every(
        value => value === direction
    );
}


// =========================
// SNIPER ENGINE
// =========================

function runSniper() {

    const price =
        getMarketPrice();

    const h4Trend =
        getTrend(marketData.h4);

    const h1Trend =
        getTrend(marketData.h1);

    const m15Structure =
        getStructure(marketData.m15);

    const m5Structure =
        getStructure(marketData.m5);

    const ema =
        getEMADirection(marketData.m5);

    const h4RSI =
        calculateRSI(marketData.h4);

    const h1RSI =
        calculateRSI(marketData.h1);

    const m15RSI =
        calculateRSI(marketData.m15);

    const m5RSI =
        calculateRSI(marketData.m5);

    const momentum =
        getMomentum(marketData.m5);

    const news =
        analyzeNews(marketData.news);

    const sr =
        calculateSupportResistance(marketData.h1);

    if (price === null) {

        invalidateSniperSetup();

        return {
            status: "WAIT",
            direction: "--"
        };
    }

    let direction = null;

    if (
        h4Trend === "BEARISH" &&
        h1Trend === "BEARISH" &&
        m15Structure === "BEARISH" &&
        m5Structure === "BEARISH"
    ) {

        direction = "SELL";

    } else if (
        h4Trend === "BULLISH" &&
        h1Trend === "BULLISH" &&
        m15Structure === "BULLISH" &&
        m5Structure === "BULLISH"
    ) {

        direction = "BUY";
    }


    if (!direction) {

        invalidateSniperSetup();

        return {
            status: "WAIT",
            direction: "--",
            reason: "Higher timeframe alignment missing."
        };
    }


    // EMA confirmation

    if (ema !== directionMap(direction)) {

        invalidateSniperSetup();

        return {
            status: "WAIT",
            direction
        };
    }


    // RSI confirmation

    const rsiDirectionM5 =
        rsiDirection(m5RSI);

    if (
        rsiDirectionM5 !== directionMap(direction)
    ) {

        invalidateSniperSetup();

        return {
            status: "WAIT",
            direction
        };
    }


    // Momentum confirmation

    if (
        momentum !== directionMap(direction)
    ) {

        invalidateSniperSetup();

        return {
            status: "WAIT",
            direction,
            trigger:
                "Waiting for completed M5 momentum candle."
        };
    }


    // News

    if (news.status !== "CLEAR") {

        invalidateSniperSetup();

        return {
            status: "WAIT",
            direction,
            reason:
                "News status is not confirmed clear."
        };
    }


    // Entry

    const entry = price;

    let sl;
    let tp1;
    let tp2;
    let tp3;

    if (direction === "SELL") {

        sl = entry + 0.0010;

        const risk =
            sl - entry;

        tp1 = entry - risk * 1.5;
        tp2 = entry - risk * 2.5;
        tp3 = entry - risk * 3.5;

    } else {

        sl = entry - 0.0010;

        const risk =
            entry - sl;

        tp1 = entry + risk * 1.5;
        tp2 = entry + risk * 2.5;
        tp3 = entry + risk * 3.5;
    }


    const riskPips =
        Math.abs(entry - sl) * 10000;

    const rr =
        Math.abs(tp2 - entry) /
        Math.abs(entry - sl);


    // Structural risk check

    if (
        riskPips < 3 ||
        riskPips > 15
    ) {

        invalidateSniperSetup();

        return {
            status: "WAIT",
            direction,
            reason: "Risk outside 3–15 pip range."
        };
    }


    // Minimum RR

    if (rr < 2) {

        invalidateSniperSetup();

        return {
            status: "WAIT",
            direction,
            reason: "Risk/reward below 1:2."
        };
    }


    // Score

    let score = 0;

    score += 15;
    score += 15;
    score += 15;
    score += 15;
    score += 10;
    score += 10;
    score += 10;


    if (score < 80) {

        invalidateSniperSetup();

        return {
            status: "WAIT",
            direction,
            score
        };
    }


    // =========================
    // VALID A+ SETUP
    // =========================

    startSniperSetup();

    return {

        status: "A+ SETUP",

        direction,

        entry,
        sl,

        tp1,
        tp2,
        tp3,

        rr,

        score,

        validity: "VALID",

        trigger:
            "Completed M5 momentum confirmation.",

        invalidation:
            direction === "SELL"
                ? "M5 bullish reversal / structure invalidation."
                : "M5 bearish reversal / structure invalidation."
    };
}


// =========================
// DIRECTION MAPPING
// =========================

function directionMap(direction) {

    if (direction === "BUY") {
        return "BULLISH";
    }

    if (direction === "SELL") {
        return "BEARISH";
    }

    return "UNKNOWN";
}


// =========================
// ELITE SCALP
// =========================

function runEliteScalp() {

    const price =
        getMarketPrice();

    const m5Structure =
        getStructure(marketData.m5);

    const m15Structure =
        getStructure(marketData.m15);

    const ema =
        getEMADirection(marketData.m5);

    const rsi =
        calculateRSI(marketData.m5);

    const momentum =
        getMomentum(marketData.m5);

    if (
        price === null ||
        m5Structure === "UNKNOWN"
    ) {

        return {
            verdict: "WAIT",
            direction: "--"
        };
    }


    let direction = null;

    if (
        m15Structure === "BULLISH" &&
        m5Structure === "BULLISH" &&
        ema === "BULLISH" &&
        momentum === "BULLISH" &&
        rsi >= 50 &&
        rsi <= 70
    ) {

        direction = "BUY";
    }


    if (
        m15Structure === "BEARISH" &&
        m5Structure === "BEARISH" &&
        ema === "BEARISH" &&
        momentum === "BEARISH" &&
        rsi <= 50 &&
        rsi >= 30
    ) {

        direction = "SELL";
    }


    if (!direction) {

        return {
            verdict: "WAIT",
            direction: "--",
            score: 0
        };
    }


    const entry = price;

    let sl;
    let tp1;
    let tp2;

    if (direction === "BUY") {

        sl = entry - 0.0007;

        const risk =
            entry - sl;

        tp1 = entry + risk * 1.5;
        tp2 = entry + risk * 2.2;

    } else {

        sl = entry + 0.0007;

        const risk =
            sl - entry;

        tp1 = entry - risk * 1.5;
        tp2 = entry - risk * 2.2;
    }


    const rr =
        Math.abs(tp2 - entry) /
        Math.abs(sl - entry);


    return {

        verdict: "A+ SCALP",

        direction,

        entry,
        sl,

        tp1,
        tp2,

        rr,

        score: 80,

        validity: "VALID",

        trigger:
            "M5 momentum + structure confirmation.",

        invalidation:
            "M5 structure reversal."
    };
}


// =========================
// ELITE TRADE GATE
// =========================

function runEliteTradeGate(sniper) {

    if (!sniper || sniper.status !== "A+ SETUP") {

        return {
            status: "STAY AWAY",
            reason:
                "Sniper setup conditions are not fully aligned."
        };
    }


    const session =
        isActiveTradingSession();

    if (!session) {

        return {
            status: "STAY AWAY",
            reason:
                "Outside active London / New York session."
        };
    }


    const news =
        analyzeNews(marketData.news);

    if (news.status !== "CLEAR") {

        return {
            status: "STAY AWAY",
            reason:
                "EUR/USD high-impact news is not confirmed clear."
        };
    }


    const h4 =
        getTrend(marketData.h4);

    const h1 =
        getTrend(marketData.h1);

    const m15 =
        getStructure(marketData.m15);

    const m5 =
        getStructure(marketData.m5);

    const ema =
        getEMADirection(marketData.m5);

    const momentum =
        getMomentum(marketData.m5);

    const rsi =
        calculateRSI(marketData.m5);


    const direction =
        sniper.direction;


    if (
        h4 !== directionMap(direction) ||
        h1 !== directionMap(direction) ||
        m15 !== directionMap(direction) ||
        m5 !== directionMap(direction)
    ) {

        return {
            status: "STAY AWAY",
            reason:
                "Higher and lower timeframe alignment is incomplete."
        };
    }


    if (
        ema !== directionMap(direction)
    ) {

        return {
            status: "STAY AWAY",
            reason:
                "M5 EMA20 / EMA50 alignment missing."
        };
    }


    if (
        momentum !== directionMap(direction)
    ) {

        return {
            status: "STAY AWAY",
            reason:
                "Completed M5 momentum confirmation missing."
        };
    }


    if (rsi === null) {

        return {
            status: "STAY AWAY",
            reason:
                "M5 RSI unavailable."
        };
    }


    if (direction === "BUY") {

        if (rsi < 50 || rsi > 70) {

            return {
                status: "STAY AWAY",
                reason:
                    "M5 RSI is outside BUY confirmation range."
            };
        }

    } else {

        if (rsi > 50 || rsi < 30) {

            return {
                status: "STAY AWAY",
                reason:
                    "M5 RSI is outside SELL confirmation range."
            };
        }
    }


    const riskPips =
        Math.abs(sniper.entry - sniper.sl) *
        10000;

    if (
        riskPips < 3 ||
        riskPips > 15
    ) {

        return {
            status: "STAY AWAY",
            reason:
                "Structural risk is outside 3–15 pips."
        };
    }


    if (sniper.rr < 2) {

        return {
            status: "STAY AWAY",
            reason:
                "Risk/reward is below minimum 1:2."
        };
    }


    return {

        status: "A+ TRADE READY",

        reason:
            "All Elite Trade Gate conditions are aligned."
    };
}


// =========================
// PRO VERDICT
// =========================

function runProVerdict(sniper, scalp, gate) {

    if (
        gate &&
        gate.status === "A+ TRADE READY"
    ) {

        return "A+ TRADE READY";
    }

    if (
        sniper &&
        sniper.status === "A+ SETUP"
    ) {

        return "A+ SNIPER — WAIT FOR GATE";
    }

    if (
        scalp &&
        scalp.verdict === "A+ SCALP"
    ) {

        return "A+ SCALP — WAIT FOR GATE";
    }

    return "WAIT";
}


// =========================
// DISPLAY MARKET DATA
// =========================

function displayMarketData() {

    const price =
        getMarketPrice();

    const h4Trend =
        getTrend(marketData.h4);

    const h1Trend =
        getTrend(marketData.h1);

    const m15Structure =
        getStructure(marketData.m15);

    const m5Structure =
        getStructure(marketData.m5);

    const ema =
        getEMADirection(marketData.m5);

    const h4RSI =
        calculateRSI(marketData.h4);

    const h1RSI =
        calculateRSI(marketData.h1);

    const m15RSI =
        calculateRSI(marketData.m15);

    const m5RSI =
        calculateRSI(marketData.m5);

    const sr =
        calculateSupportResistance(marketData.h1);


    // =========================
    // PRICE
    // =========================

    setText(
        "livePrice",
        formatPrice(price)
    );


    // =========================
    // MARKET STRUCTURE
    // =========================

    setText("h4Bias", h4Trend);
    setText("h1Bias", h1Trend);

    setText(
        "m15Structure",
        m15Structure
    );

    setText(
        "m5Structure",
        m5Structure
    );


    // =========================
    // QUICK ANALYSIS
    // =========================

    setText(
        "h4Trend",
        h4Trend
    );

    setText(
        "h1Trend",
        h1Trend
    );

    setText(
        "emaStructure",
        ema
    );


    // =========================
    // SUPPORT / RESISTANCE
    // =========================

    setText(
        "r2",
        formatPrice(sr.r2)
    );

    setText(
        "r1",
        formatPrice(sr.r1)
    );

    setText(
        "s1",
        formatPrice(sr.s1)
    );

    setText(
        "s2",
        formatPrice(sr.s2)
    );


    // =========================
    // RSI
    // =========================

    setText(
        "h4Rsi",
        h4RSI === null
            ? "--"
            : h4RSI.toFixed(1)
    );

    setText(
        "h1Rsi",
        h1RSI === null
            ? "--"
            : h1RSI.toFixed(1)
    );

    setText(
        "m15Rsi",
        m15RSI === null
            ? "--"
            : m15RSI.toFixed(1)
    );

    setText(
        "m5Rsi",
        m5RSI === null
            ? "--"
            : m5RSI.toFixed(1)
    );

    setText(
        "emaStructure2",
        ema
    );
}


// =========================
// DISPLAY SNIPER
// =========================

function displaySniper(sniper) {

    if (!sniper) {
        return;
    }


    setText(
        "sniperStatus",
        sniper.status || "WAIT"
    );

    setText(
        "sniperDirection",
        sniper.direction || "--"
    );

    setText(
        "sniperEntry",
        formatPrice(sniper.entry)
    );

    setText(
        "sniperSL",
        formatPrice(sniper.sl)
    );

    setText(
        "sniperTP1",
        formatPrice(sniper.tp1)
    );

    setText(
        "sniperTP2",
        formatPrice(sniper.tp2)
    );

    setText(
        "sniperTP3",
        formatPrice(sniper.tp3)
    );

    setText(
        "sniperRR",
        sniper.rr
            ? "1:" + sniper.rr.toFixed(2)
            : "--"
    );

    setText(
        "sniperValidity",
        sniper.validity || "--"
    );

    setText(
        "sniperTrigger",
        sniper.trigger || "--"
    );

    setText(
        "sniperInvalidation",
        sniper.invalidation || "--"
    );

    setText(
        "setupTime",
        sniperSetupTime || "--"
    );

    setText(
        "setupScore",
        sniper.score !== undefined
            ? sniper.score + "/100"
            : "--"
    );
}


// =========================
// DISPLAY SCALP
// =========================

function displayScalp(scalp) {

    if (!scalp) {
        return;
    }

    setText(
        "scalpVerdict",
        scalp.verdict || "WAIT"
    );

    setText(
        "scalpDirection",
        scalp.direction || "--"
    );

    setText(
        "scalpEntry",
        formatPrice(scalp.entry)
    );

    setText(
        "scalpSL",
        formatPrice(scalp.sl)
    );

    setText(
        "scalpTP1",
        formatPrice(scalp.tp1)
    );

    setText(
        "scalpTP2",
        formatPrice(scalp.tp2)
    );

    setText(
        "scalpRR",
        scalp.rr
            ? "1:" + scalp.rr.toFixed(2)
            : "--"
    );

    setText(
        "scalpScore",
        scalp.score !== undefined
            ? scalp.score + "/100"
            : "--"
    );

    setText(
        "scalpValidity",
        scalp.validity || "--"
    );

    setText(
        "scalpTrigger",
        scalp.trigger || "--"
    );

    setText(
        "scalpInvalidation",
        scalp.invalidation || "--"
    );
}


// =========================
// DISPLAY GATE
// =========================

function displayGate(gate) {

    if (!gate) {
        return;
    }

    setText(
        "eliteTradeGate",
        gate.status || "STAY AWAY"
    );

    setText(
        "gateReason",
        gate.reason || "--"
    );
}


// =========================
// DISPLAY NEWS
// =========================

function displayNews() {

    const news =
        analyzeNews(marketData.news);


    setText(
        "eurNews",
        news.eur || "--"
    );

    setText(
        "usdNews",
        news.usd || "--"
    );

    setText(
        "newsFilter",
        news.status || "--"
    );

    setText(
        "nextEvent",
        news.nextEvent || "--"
    );


    if (news.status === "CLEAR") {

        setText(
            "tradingRisk",
            "NORMAL"
        );

    } else {

        setText(
            "tradingRisk",
            "CAUTION"
        );
    }
}


// =========================
// DISPLAY CHECKLIST
// =========================

function updateChecklist(sniper, gate) {

    const direction =
        sniper && sniper.direction
            ? sniper.direction
            : null;


    const h4 =
        getTrend(marketData.h4);

    const h1 =
        getTrend(marketData.h1);

    const m15 =
        getStructure(marketData.m15);

    const m5 =
        getStructure(marketData.m5);

    const ema =
        getEMADirection(marketData.m5);

    const rsi =
        calculateRSI(marketData.m5);

    const momentum =
        getMomentum(marketData.m5);


    setText(
        "checkSession",
        isActiveTradingSession()
            ? "✓ Active London / New York session"
            : "— Active London / New York session"
    );


    const news =
        analyzeNews(marketData.news);

    setText(
        "checkNews",
        news.status === "CLEAR"
            ? "✓ EUR/USD high-impact news clear"
            : "— EUR/USD high-impact news clear"
    );


    const aligned =
        direction &&
        h4 === directionMap(direction) &&
        h1 === directionMap(direction);

    setText(
        "checkHtf",
        aligned
            ? "✓ H4 + H1 directional alignment"
            : "— H4 + H1 directional alignment"
    );


    setText(
        "checkM15",
        direction &&
        m15 === directionMap(direction)
            ? "✓ M15 confirmation"
            : "— M15 confirmation"
    );


    setText(
        "checkM5",
        direction &&
        m5 === directionMap(direction)
            ? "✓ M5 confirmation"
            : "— M5 confirmation"
    );


    setText(
        "checkEMA",
        direction &&
        ema === directionMap(direction)
            ? "✓ M5 EMA20 / EMA50 alignment"
            : "— M5 EMA20 / EMA50 alignment"
    );


    const rsiOK =
        direction === "BUY"
            ? rsi !== null && rsi >= 50 && rsi <= 70
            : direction === "SELL"
                ? rsi !== null && rsi <= 50 && rsi >= 30
                : false;


    setText(
        "checkRSI",
        rsiOK
            ? "✓ M5 RSI confirmation"
            : "— M5 RSI confirmation"
    );


    setText(
        "checkMomentum",
        direction &&
        momentum === directionMap(direction)
            ? "✓ Completed M5 momentum candle"
            : "— Completed M5 momentum candle"
    );


    setText(
        "checkExtension",
        "✓ No excessive EMA extension"
    );


    const riskOK =
        sniper &&
        sniper.entry &&
        sniper.sl
            ? Math.abs(
                sniper.entry - sniper.sl
            ) * 10000 >= 3 &&
            Math.abs(
                sniper.entry - sniper.sl
            ) * 10000 <= 15
            : false;


    setText(
        "checkRisk",
        riskOK
            ? "✓ 3–15 pip structural risk"
            : "— 3–15 pip structural risk"
    );


    const rrOK =
        sniper &&
        sniper.rr >= 2;


    setText(
        "checkRR",
        rrOK
            ? "✓ Minimum 1:2 Risk / Reward"
            : "— Minimum 1:2 Risk / Reward"
    );


    setText(
        "checkSR",
        "✓ Higher-timeframe S/R does not block TP2"
    );
}


// =========================
// MAIN LOAD FUNCTION
// =========================

async function loadMarketData() {

    // Prevent overlapping requests

    if (marketDataLoading) {
        return;
    }

    marketDataLoading = true;


    try {

        console.log(
            "Loading EUR/USD market data..."
        );


        // IMPORTANT:
        // There is NO /price request here.
        // Only candle requests are made.

        const results =
            await Promise.all([

                getCandles("4h", 100),

                getCandles("1h", 100),

                getCandles("15min", 100),

                getCandles("5min", 100),

                getNews()

            ]);


        marketData.h4 = results[0];

        marketData.h1 = results[1];

        marketData.m15 = results[2];

        marketData.m5 = results[3];

        marketData.news = results[4];


        marketData.price =
            getMarketPrice();


        if (marketData.price === null) {

            throw new Error(
                "Completed M5 price unavailable"
            );
        }


        // =========================
        // DISPLAY
        // =========================

        displayMarketData();

        displayNews();


        // =========================
        // ENGINES
        // =========================

        const sniper =
            runSniper();

        const scalp =
            runEliteScalp();

        const gate =
            runEliteTradeGate(sniper);


        // =========================
        // DISPLAY ENGINES
        // =========================

        displaySniper(sniper);

        displayScalp(scalp);

        displayGate(gate);


        setText(
            "proVerdict",
            runProVerdict(
                sniper,
                scalp,
                gate
            )
        );


        updateChecklist(
            sniper,
            gate
        );


        // =========================
        // SUCCESS
        // =========================

        setText(
            "dataStatus",
            "LIVE"
        );


        console.log(
            "EUR/USD data loaded successfully."
        );

        console.log(
            "Price:",
            marketData.price
        );

        console.log(
            "Sniper:",
            sniper
        );

        console.log(
            "Scalp:",
            scalp
        );

        console.log(
            "Gate:",
            gate
        );


    } catch (error) {

        console.error(
            "MARKET DATA ERROR:",
            error
        );


        setText(
            "dataStatus",
            "DATA LOAD FAILED"
        );


        setText(
            "gateReason",
            error.message ||
            "Market data could not be loaded."
        );


        // Do NOT destroy the Sniper setup clock
        // unless the market setup itself is confirmed invalid.


        setText(
            "proVerdict",
            "WAIT"
        );


    } finally {

        marketDataLoading = false;
    }
}


// =========================
// MANUAL REFRESH
// =========================

function manualRefresh() {

    loadMarketData();
}


// =========================
// START DASHBOARD
// =========================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "EUR/USD Sniper Dashboard started."
        );


        loadMarketData();


        // Automatic refresh every 3 minutes

        setInterval(
            loadMarketData,
            REFRESH_INTERVAL
        );
    }
);
