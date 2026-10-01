/* =========================================================
   EUR/USD SNIPER DASHBOARD
   LOW-REQUEST / STABLE VERSION
   + NEWS FILTER FRAMEWORK
   ========================================================= */

const API_KEY = "4ba3968e609544bf8990192fdf3ed970";
const SYMBOL = "EUR/USD";

/* =========================================================
   TWELVE DATA SETTINGS
   ========================================================= */

const REFRESH_INTERVAL = 300000; // 5 minutes

const DATA_TTL = {
    h4: 30 * 60 * 1000,
    h1: 15 * 60 * 1000,
    m15: 10 * 60 * 1000,
    m5: 5 * 60 * 1000
};

/* =========================================================
   NEWS SETTINGS
   ========================================================= */

/*
   IMPORTANT:

   Leave this empty until you have a real economic-calendar
   endpoint.

   Example:
   const NEWS_API_URL =
       "https://your-server.example.com/economic-calendar";

   DO NOT put a private calendar API key directly into
   GitHub Pages JavaScript.
*/

const NEWS_API_URL = "";

const NEWS_REFRESH_INTERVAL = 15 * 60 * 1000;

// Do not trade this many minutes before a high-impact event.
const NEWS_BLOCK_BEFORE_MINUTES = 30;

// Do not trade this many minutes after a high-impact event.
const NEWS_BLOCK_AFTER_MINUTES = 15;


/* =========================================================
   GLOBAL STATE
   ========================================================= */

let marketData = {
    h4: null,
    h1: null,
    m15: null,
    m5: null
};

let marketDataUpdated = {
    h4: 0,
    h1: 0,
    m15: 0,
    m5: 0
};

let marketDataLoading = false;

let newsData = {
    available: false,
    events: [],
    lastUpdated: 0,
    error: null
};


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}

function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
}

function round(value, decimals = 5) {
    if (!Number.isFinite(value)) return "--";
    return Number(value).toFixed(decimals);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function safeNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}


/* =========================================================
   TIME / SESSION
   ========================================================= */

function getISTDate() {
    return new Date(
        new Date().toLocaleString("en-US", {
            timeZone: "Asia/Kolkata"
        })
    );
}

function getISTHour() {
    return getISTDate().getHours();
}

function isTradingSessionActive() {
    const hour = getISTHour();

    // London + New York active window in IST.
    return hour >= 12 && hour < 22;
}


/* =========================================================
   PRICE FORMAT
   ========================================================= */

function formatPrice(value) {
    if (!Number.isFinite(value)) return "--";
    return value.toFixed(5);
}


/* =========================================================
   TWELVE DATA
   ========================================================= */

async function fetchCandles(interval, outputsize = 100) {

    const url =
        "https://api.twelvedata.com/time_series" +
        "?symbol=" + encodeURIComponent(SYMBOL) +
        "&interval=" + interval +
        "&outputsize=" + outputsize +
        "&apikey=" + encodeURIComponent(API_KEY);

    try {

        const response = await fetch(url);

        if (response.status === 429) {
            throw new Error("Twelve Data rate limit reached (429)");
        }

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        const data = await response.json();

        if (data.status === "error") {
            throw new Error(data.message || "Twelve Data error");
        }

        if (!Array.isArray(data.values)) {
            throw new Error("No candle data returned");
        }

        return data.values.reverse().map(c => ({
            datetime: c.datetime,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close)
        }));

    } catch (error) {

        console.error("Candle fetch error:", interval, error);

        throw error;
    }
}


/* =========================================================
   CACHE LOADER
   ========================================================= */

async function loadTimeframe(key, interval, ttl) {

    const now = Date.now();

    if (
        marketData[key] &&
        marketDataUpdated[key] &&
        now - marketDataUpdated[key] < ttl
    ) {
        return marketData[key];
    }

    const candles = await fetchCandles(interval, 100);

    marketData[key] = candles;
    marketDataUpdated[key] = now;

    return candles;
}


/* =========================================================
   EMA
   ========================================================= */

function calculateEMA(candles, period) {

    if (!candles || candles.length < period) {
        return null;
    }

    const multiplier = 2 / (period + 1);

    let ema = candles
        .slice(0, period)
        .reduce((sum, candle) => sum + candle.close, 0) / period;

    for (let i = period; i < candles.length; i++) {

        ema =
            (candles[i].close - ema) * multiplier +
            ema;
    }

    return ema;
}


/* =========================================================
   RSI
   ========================================================= */

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

    let averageGain = gains / period;
    let averageLoss = losses / period;

    for (let i = period + 1; i < candles.length; i++) {

        const change =
            candles[i].close -
            candles[i - 1].close;

        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;

        averageGain =
            ((averageGain * (period - 1)) + gain) / period;

        averageLoss =
            ((averageLoss * (period - 1)) + loss) / period;
    }

    if (averageLoss === 0) return 100;

    const rs = averageGain / averageLoss;

    return 100 - (100 / (1 + rs));
}


/* =========================================================
   TREND
   ========================================================= */

function getTrend(candles) {

    const ema20 = calculateEMA(candles, 20);
    const ema50 = calculateEMA(candles, 50);

    if (
        !Number.isFinite(ema20) ||
        !Number.isFinite(ema50)
    ) {
        return "WAIT";
    }

    if (ema20 > ema50) return "BULLISH";

    if (ema20 < ema50) return "BEARISH";

    return "NEUTRAL";
}


/* =========================================================
   MARKET STRUCTURE
   ========================================================= */

function getStructure(candles) {

    if (!candles || candles.length < 10) {
        return "WAIT";
    }

    const recent = candles.slice(-10);

    const highs = recent.map(c => c.high);
    const lows = recent.map(c => c.low);

    const firstHigh = highs[0];
    const lastHigh = highs[highs.length - 1];

    const firstLow = lows[0];
    const lastLow = lows[lows.length - 1];

    if (
        lastHigh < firstHigh &&
        lastLow < firstLow
    ) {
        return "BEARISH";
    }

    if (
        lastHigh > firstHigh &&
        lastLow > firstLow
    ) {
        return "BULLISH";
    }

    return "RANGE";
}


/* =========================================================
   SUPPORT / RESISTANCE
   ========================================================= */

function getSupportResistance(candles) {

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

    const sortedHighs = [...highs].sort((a, b) => b - a);
    const sortedLows = [...lows].sort((a, b) => a - b);

    return {
        r2: sortedHighs[1],
        r1: sortedHighs[0],
        s1: sortedLows[0],
        s2: sortedLows[1]
    };
}


/* =========================================================
   MOMENTUM
   ========================================================= */

function getMomentum(candles) {

    if (!candles || candles.length < 2) {
        return "WAIT";
    }

    const candle = candles[candles.length - 1];

    const range =
        candle.high -
        candle.low;

    if (range <= 0) {
        return "WAIT";
    }

    const body =
        Math.abs(candle.close - candle.open);

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


/* =========================================================
   RSI DIRECTION
   ========================================================= */

function getRSIDirection(rsi) {

    if (!Number.isFinite(rsi)) {
        return "WAIT";
    }

    if (rsi >= 55) return "BULLISH";

    if (rsi <= 45) return "BEARISH";

    return "NEUTRAL";
}


/* =========================================================
   EMA DIRECTION
   ========================================================= */

function getEMADirection(candles) {

    const ema20 = calculateEMA(candles, 20);
    const ema50 = calculateEMA(candles, 50);

    if (
        !Number.isFinite(ema20) ||
        !Number.isFinite(ema50)
    ) {
        return "WAIT";
    }

    if (ema20 > ema50) return "BULLISH";

    if (ema20 < ema50) return "BEARISH";

    return "NEUTRAL";
}


/* =========================================================
   CURRENT MARKET PRICE
   ========================================================= */

function getMarketPrice() {

    if (
        !marketData.m5 ||
        marketData.m5.length === 0
    ) {
        return null;
    }

    return marketData.m5[
        marketData.m5.length - 1
    ].close;
}


/* =========================================================
   NEWS NORMALIZER
   ========================================================= */

function normalizeNewsEvent(event) {

    if (!event) return null;

    const currency =
        String(
            event.currency ||
            event.country ||
            event.ccy ||
            ""
        ).toUpperCase();

    const title =
        event.title ||
        event.name ||
        event.event ||
        event.report_name ||
        event.indicator ||
        "Economic event";

    const impactRaw =
        event.impact ??
        event.importance ??
        event.priority ??
        event.impact_level;

    let impact = "UNKNOWN";

    if (
        impactRaw === 3 ||
        String(impactRaw).toLowerCase() === "high" ||
        String(impactRaw).toLowerCase() === "red"
    ) {
        impact = "HIGH";
    } else if (
        impactRaw === 2 ||
        String(impactRaw).toLowerCase() === "medium" ||
        String(impactRaw).toLowerCase() === "orange"
    ) {
        impact = "MEDIUM";
    } else if (
        impactRaw === 1 ||
        String(impactRaw).toLowerCase() === "low" ||
        String(impactRaw).toLowerCase() === "yellow"
    ) {
        impact = "LOW";
    }

    let datetime =
        event.datetime ||
        event.date ||
        event.time ||
        event.timestamp ||
        event.announcement_datetime;

    let timestamp = null;

    if (typeof datetime === "number") {

        timestamp =
            datetime < 10000000000
                ? datetime * 1000
                : datetime;

    } else if (datetime) {

        timestamp =
            new Date(datetime).getTime();
    }

    if (!Number.isFinite(timestamp)) {
        timestamp = null;
    }

    return {
        currency,
        title: String(title),
        impact,
        timestamp
    };
}


/* =========================================================
   HIGH IMPACT CHECK
   ========================================================= */

function isHighImpact(event) {

    if (!event) return false;

    return (
        event.impact === "HIGH" &&
        (
            event.currency === "USD" ||
            event.currency === "EUR" ||
            event.currency === "US" ||
            event.currency === "EU" ||
            event.currency === "EURO"
        )
    );
}


/* =========================================================
   NEWS RISK ENGINE
   ========================================================= */

function getNewsRisk() {

    if (!newsData.available) {

        return {
            available: false,
            blocked: true,
            reason: "Live news confirmation unavailable",
            event: null
        };
    }

    const now = Date.now();

    const relevantEvents =
        newsData.events.filter(event => {

            if (!isHighImpact(event)) {
                return false;
            }

            if (!Number.isFinite(event.timestamp)) {
                return false;
            }

            const minutesAway =
                (event.timestamp - now) / 60000;

            return (
                minutesAway >= -NEWS_BLOCK_AFTER_MINUTES &&
                minutesAway <= NEWS_BLOCK_BEFORE_MINUTES
            );
        });

    if (relevantEvents.length > 0) {

        relevantEvents.sort(
            (a, b) =>
                Math.abs(a.timestamp - now) -
                Math.abs(b.timestamp - now)
        );

        const event = relevantEvents[0];

        const minutesAway =
            (event.timestamp - now) / 60000;

        let timing;

        if (minutesAway > 0) {
            timing =
                Math.round(minutesAway) +
                " min before";
        } else {
            timing =
                Math.round(Math.abs(minutesAway)) +
                " min after";
        }

        return {
            available: true,
            blocked: true,
            reason:
                "High-impact " +
                event.currency +
                " news: " +
                event.title +
                " (" +
                timing +
                ")",
            event
        };
    }

    return {
        available: true,
        blocked: false,
        reason: "No high-impact EUR/USD event in protection window",
        event: null
    };
}


/* =========================================================
   NEWS LOADER
   ========================================================= */

async function loadNewsData() {

    if (!NEWS_API_URL) {

        newsData = {
            available: false,
            events: [],
            lastUpdated: Date.now(),
            error: "NEWS_API_URL is not configured"
        };

        displayNews();

        return;
    }

    try {

        const response =
            await fetch(NEWS_API_URL, {
                cache: "no-store"
            });

        if (!response.ok) {
            throw new Error(
                "News HTTP " + response.status
            );
        }

        const data =
            await response.json();

        let rawEvents = [];

        if (Array.isArray(data)) {
            rawEvents = data;
        } else if (Array.isArray(data.events)) {
            rawEvents = data.events;
        } else if (
            data.result &&
            Array.isArray(data.result.output)
        ) {
            rawEvents = data.result.output;
        } else if (Array.isArray(data.data)) {
            rawEvents = data.data;
        }

        const normalized =
            rawEvents
                .map(normalizeNewsEvent)
                .filter(Boolean);

        newsData = {
            available: true,
            events: normalized,
            lastUpdated: Date.now(),
            error: null
        };

        displayNews();

    } catch (error) {

        console.error(
            "News loading error:",
            error
        );

        newsData = {
            available: false,
            events: [],
            lastUpdated: Date.now(),
            error: error.message
        };

        displayNews();
    }
}


/* =========================================================
   NEWS DISPLAY
   ========================================================= */

function displayNews() {

    const eurNews = $("eurNews");
    const usdNews = $("usdNews");
    const newsFilter = $("newsFilter");
    const nextEvent = $("nextEvent");
    const tradingRisk = $("tradingRisk");

    if (!newsData.available) {

        setText(
            "eurNews",
            "EUR NEWS — UNAVAILABLE"
        );

        setText(
            "usdNews",
            "USD NEWS — UNAVAILABLE"
        );

        setText(
            "newsFilter",
            "NEWS FILTER — UNAVAILABLE"
        );

        setText(
            "nextEvent",
            "NEXT EVENT — --"
        );

        setText(
            "tradingRisk",
            "TRADING RISK — UNKNOWN"
        );

        setText(
            "checkNews",
            "— EUR/USD high-impact news clear"
        );

        return;
    }

    const risk = getNewsRisk();

    const now = Date.now();

    const eurEvents =
        newsData.events.filter(
            e =>
                (
                    e.currency === "EUR" ||
                    e.currency === "EU" ||
                    e.currency === "EURO"
                ) &&
                Number.isFinite(e.timestamp) &&
                e.timestamp > now
        );

    const usdEvents =
        newsData.events.filter(
            e =>
                (
                    e.currency === "USD" ||
                    e.currency === "US"
                ) &&
                Number.isFinite(e.timestamp) &&
                e.timestamp > now
        );

    function eventText(events) {

        if (!events.length) {
            return "No upcoming high-impact event";
        }

        events.sort(
            (a, b) =>
                a.timestamp - b.timestamp
        );

        const event = events[0];

        return (
            event.title +
            " — " +
            new Date(
                event.timestamp
            ).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "short"
            })
        );
    }

    setText(
        "eurNews",
        "EUR NEWS — " +
        eventText(eurEvents)
    );

    setText(
        "usdNews",
        "USD NEWS — " +
        eventText(usdEvents)
    );

    if (risk.blocked) {

        setText(
            "newsFilter",
            "NEWS FILTER — BLOCKED"
        );

        setText(
            "tradingRisk",
            "TRADING RISK — HIGH"
        );

        setText(
            "checkNews",
            "✗ High-impact EUR/USD news protection active"
        );

    } else {

        setText(
            "newsFilter",
            "NEWS FILTER — CLEAR"
        );

        setText(
            "tradingRisk",
            "TRADING RISK — NORMAL"
        );

        setText(
            "checkNews",
            "✓ EUR/USD high-impact news clear"
        );
    }

    if (risk.event) {

        setText(
            "nextEvent",
            "NEXT EVENT — " +
            risk.event.currency +
            " " +
            risk.event.title
        );

    } else {

        const allUpcoming =
            [...eurEvents, ...usdEvents]
                .sort(
                    (a, b) =>
                        a.timestamp - b.timestamp
                );

        if (allUpcoming.length) {

            setText(
                "nextEvent",
                "NEXT EVENT — " +
                allUpcoming[0].currency +
                " " +
                allUpcoming[0].title
            );

        } else {

            setText(
                "nextEvent",
                "NEXT EVENT — NONE FOUND"
            );
        }
    }
}


/* =========================================================
   SNIPER SETUP
   ========================================================= */

function evaluateSniper() {

    const h4 = marketData.h4;
    const h1 = marketData.h1;
    const m15 = marketData.m15;
    const m5 = marketData.m5;

    if (!h4 || !h1 || !m15 || !m5) {
        return {
            status: "WAIT",
            direction: null
        };
    }

    const h4Trend = getTrend(h4);
    const h1Trend = getTrend(h1);
    const m15Trend = getTrend(m15);
    const m5Trend = getTrend(m5);

    const emaDirection = getEMADirection(m5);

    const m5Rsi =
        calculateRSI(m5, 14);

    const rsiDirection =
        getRSIDirection(m5Rsi);

    const momentum =
        getMomentum(m5);

    let direction = null;

    if (
        h4Trend === "BEARISH" &&
        h1Trend === "BEARISH" &&
        m15Trend === "BEARISH" &&
        m5Trend === "BEARISH" &&
        emaDirection === "BEARISH" &&
        momentum === "BEARISH" &&
        rsiDirection === "BEARISH"
    ) {
        direction = "SELL";
    }

    if (
        h4Trend === "BULLISH" &&
        h1Trend === "BULLISH" &&
        m15Trend === "BULLISH" &&
        m5Trend === "BULLISH" &&
        emaDirection === "BULLISH" &&
        momentum === "BULLISH" &&
        rsiDirection === "BULLISH"
    ) {
        direction = "BUY";
    }

    if (!direction) {

        return {
            status: "WAIT",
            direction: null,
            trigger:
                direction || "WAIT",
            invalidation:
                "Alignment or momentum missing"
        };
    }

    const price =
        getMarketPrice();

    if (!price) {
        return {
            status: "WAIT",
            direction: null
        };
    }

    const riskPips = 10;

    const pip = 0.0001;

    let sl;
    let tp1;
    let tp2;
    let tp3;

    if (direction === "SELL") {

        sl = price + riskPips * pip;
        tp1 = price - 2 * riskPips * pip;
        tp2 = price - 3 * riskPips * pip;
        tp3 = price - 4 * riskPips * pip;

    } else {

        sl = price - riskPips * pip;
        tp1 = price + 2 * riskPips * pip;
        tp2 = price + 3 * riskPips * pip;
        tp3 = price + 4 * riskPips * pip;
    }

    return {
        status: "A+ SETUP",
        direction,
        entry: price,
        sl,
        tp1,
        tp2,
        tp3,
        rr: "1:2 / 1:3 / 1:4",
        validity: "VALID",
        trigger: "Full alignment confirmed",
        invalidation: "Setup invalid if alignment breaks"
    };
}


/* =========================================================
   SCALP SETUP
   ========================================================= */

function evaluateScalp() {

    const h1 = marketData.h1;
    const m15 = marketData.m15;
    const m5 = marketData.m5;

    if (!h1 || !m15 || !m5) {

        return {
            status: "WAIT"
        };
    }

    const h1Trend = getTrend(h1);
    const m15Trend = getTrend(m15);
    const m5Trend = getTrend(m5);

    const ema =
        getEMADirection(m5);

    const momentum =
        getMomentum(m5);

    let direction = null;

    if (
        h1Trend === "BEARISH" &&
        m15Trend === "BEARISH" &&
        m5Trend === "BEARISH" &&
        ema === "BEARISH" &&
        momentum === "BEARISH"
    ) {
        direction = "SELL";
    }

    if (
        h1Trend === "BULLISH" &&
        m15Trend === "BULLISH" &&
        m5Trend === "BULLISH" &&
        ema === "BULLISH" &&
        momentum === "BULLISH"
    ) {
        direction = "BUY";
    }

    if (!direction) {

        return {
            status: "WAIT",
            direction: null,
            trigger: "WAIT",
            invalidation: "Confirmation missing"
        };
    }

    const price =
        getMarketPrice();

    if (!price) {
        return {
            status: "WAIT"
        };
    }

    const riskPips = 7;
    const pip = 0.0001;

    let sl;
    let tp1;
    let tp2;

    if (direction === "SELL") {

        sl = price + riskPips * pip;
        tp1 = price - 2 * riskPips * pip;
        tp2 = price - 3 * riskPips * pip;

    } else {

        sl = price - riskPips * pip;
        tp1 = price + 2 * riskPips * pip;
        tp2 = price + 3 * riskPips * pip;
    }

    return {
        status: "SETUP",
        direction,
        entry: price,
        sl,
        tp1,
        tp2,
        rr: "1:2 / 1:3",
        score: "A",
        validity: "VALID",
        trigger: "H1 + M15 + M5 alignment",
        invalidation: "Momentum or EMA alignment breaks"
    };
}


/* =========================================================
   ELITE TRADE GATE
   ========================================================= */

function evaluateTradeGate(sniper, scalp) {

    const newsRisk =
        getNewsRisk();

    const sessionOK =
        isTradingSessionActive();

    const direction =
        sniper.direction ||
        scalp.direction ||
        null;

    const price =
        getMarketPrice();

    let momentum =
        marketData.m5
            ? getMomentum(marketData.m5)
            : "WAIT";

    const momentumOK =
        direction === "SELL"
            ? momentum === "BEARISH"
            : direction === "BUY"
                ? momentum === "BULLISH"
                : false;

    const h4 =
        marketData.h4
            ? getTrend(marketData.h4)
            : "WAIT";

    const h1 =
        marketData.h1
            ? getTrend(marketData.h1)
            : "WAIT";

    const m15 =
        marketData.m15
            ? getTrend(marketData.m15)
            : "WAIT";

    const m5 =
        marketData.m5
            ? getTrend(marketData.m5)
            : "WAIT";

    const htfOK =
        direction === "BUY"
            ? h4 === "BULLISH" &&
              h1 === "BULLISH"
            : direction === "SELL"
                ? h4 === "BEARISH" &&
                  h1 === "BEARISH"
                : false;

    const m15OK =
        direction === "BUY"
            ? m15 === "BULLISH"
            : direction === "SELL"
                ? m15 === "BEARISH"
                : false;

    const m5OK =
        direction === "BUY"
            ? m5 === "BULLISH"
            : direction === "SELL"
                ? m5 === "BEARISH"
                : false;

    const newsOK =
        newsRisk.available &&
        !newsRisk.blocked;

    const allOK =
        sessionOK &&
        direction &&
        htfOK &&
        m15OK &&
        m5OK &&
        momentumOK &&
        newsOK;

    if (!allOK) {

        let reason =
            "Required confirmation not complete";

        if (!sessionOK) {
            reason =
                "Trading session inactive";
        } else if (!newsRisk.available) {
            reason =
                "Live news confirmation unavailable";
        } else if (newsRisk.blocked) {
            reason =
                newsRisk.reason;
        } else if (!direction) {
            reason =
                "No trade direction";
        } else if (!htfOK) {
            reason =
                "H4/H1 alignment missing";
        } else if (!m15OK) {
            reason =
                "M15 confirmation missing";
        } else if (!m5OK) {
            reason =
                "M5 confirmation missing";
        } else if (!momentumOK) {
            reason =
                "Momentum confirmation missing";
        }

        return {
            allowed: false,
            reason,
            direction,
            entry: null,
            sl: null,
            tp1: null,
            tp2: null,
            rr: null
        };
    }

    const setup =
        sniper.status === "A+ SETUP"
            ? sniper
            : scalp;

    return {
        allowed: true,
        reason: "All elite conditions confirmed",
        direction,
        entry: setup.entry,
        sl: setup.sl,
        tp1: setup.tp1,
        tp2: setup.tp2,
        rr: setup.rr
    };
}


/* =========================================================
   DISPLAY MARKET STRUCTURE
   ========================================================= */

function displayMarketStructure() {

    setText(
        "h4Bias",
        getTrend(marketData.h4)
    );

    setText(
        "h1Bias",
        getTrend(marketData.h1)
    );

    setText(
        "m15Structure",
        getStructure(marketData.m15)
    );

    setText(
        "m5Structure",
        getStructure(marketData.m5)
    );
}


/* =========================================================
   DISPLAY QUICK ANALYSIS
   ========================================================= */

function displayQuickAnalysis() {

    const h4Trend =
        getTrend(marketData.h4);

    const h1Trend =
        getTrend(marketData.h1);

    const ema =
        getEMADirection(marketData.m5);

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

    setText(
        "setupScore",
        "--"
    );
}


/* =========================================================
   DISPLAY SUPPORT / RESISTANCE
   ========================================================= */

function displaySupportResistance() {

    const sr =
        getSupportResistance(marketData.h1);

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
}


/* =========================================================
   DISPLAY TECHNICALS
   ========================================================= */

function displayTechnicals() {

    const h4Rsi =
        calculateRSI(marketData.h4);

    const h1Rsi =
        calculateRSI(marketData.h1);

    const m15Rsi =
        calculateRSI(marketData.m15);

    const m5Rsi =
        calculateRSI(marketData.m5);

    setText(
        "h4Rsi",
        round(h4Rsi, 2)
    );

    setText(
        "h1Rsi",
        round(h1Rsi, 2)
    );

    setText(
        "m15Rsi",
        round(m15Rsi, 2)
    );

    setText(
        "m5Rsi",
        round(m5Rsi, 2)
    );

    setText(
        "emaStructure2",
        getEMADirection(marketData.m5)
    );
}


/* =========================================================
   DISPLAY SNIPER
   ========================================================= */

function displaySniper(result) {

    setText(
        "sniperStatusBig",
        result.status || "WAIT"
    );

    setText(
        "sniperStatus",
        result.status || "WAIT"
    );

    setText(
        "sniperDirection",
        result.direction || "--"
    );

    setText(
        "sniperEntry",
        result.entry
            ? formatPrice(result.entry)
            : "--"
    );

    setText(
        "sniperSL",
        result.sl
            ? formatPrice(result.sl)
            : "--"
    );

    setText(
        "sniperTP1",
        result.tp1
            ? formatPrice(result.tp1)
            : "--"
    );

    setText(
        "sniperTP2",
        result.tp2
            ? formatPrice(result.tp2)
            : "--"
    );

    setText(
        "sniperTP3",
        result.tp3
            ? formatPrice(result.tp3)
            : "--"
    );

    setText(
        "sniperRR",
        result.rr || "--"
    );

    setText(
        "sniperValidity",
        result.validity ||
        "NO A+ SETUP"
    );

    setText(
        "sniperTrigger",
        result.trigger || "WAIT"
    );

    setText(
        "sniperInvalidation",
        result.invalidation ||
        "Alignment or momentum missing"
    );

    setText(
        "setupTime",
        result.status === "A+ SETUP"
            ? new Date().toLocaleTimeString(
                "en-IN",
                {
                    timeZone: "Asia/Kolkata"
                }
            )
            : "--"
    );
}


/* =========================================================
   DISPLAY SCALP
   ========================================================= */

function displayScalp(result) {

    setText(
        "scalpVerdict",
        result.status || "WAIT"
    );

    setText(
        "scalpDirection",
        result.direction || "--"
    );

    setText(
        "scalpEntry",
        result.entry
            ? formatPrice(result.entry)
            : "--"
    );

    setText(
        "scalpSL",
        result.sl
            ? formatPrice(result.sl)
            : "--"
    );

    setText(
        "scalpTP1",
        result.tp1
            ? formatPrice(result.tp1)
            : "--"
    );

    setText(
        "scalpTP2",
        result.tp2
            ? formatPrice(result.tp2)
            : "--"
    );

    setText(
        "scalpRR",
        result.rr || "--"
    );

    setText(
        "scalpScore",
        result.score || "--"
    );

    setText(
        "scalpValidity",
        result.validity ||
        "NO SETUP"
    );

    setText(
        "scalpTrigger",
        result.trigger ||
        "WAIT"
    );

    setText(
        "scalpInvalidation",
        result.invalidation ||
        "Confirmation missing"
    );
}


/* =========================================================
   DISPLAY PRO VERDICT
   ========================================================= */

function displayProVerdict(sniper, scalp, gate) {

    if (gate.allowed) {

        setText(
            "proVerdict",
            "TRADE READY"
        );

        return;
    }

    if (
        sniper.status === "A+ SETUP" ||
        scalp.status === "SETUP"
    ) {

        setText(
            "proVerdict",
            "WAIT — NEWS / GATE"
        );

        return;
    }

    setText(
        "proVerdict",
        "WAIT"
    );
}


/* =========================================================
   DISPLAY ELITE GATE
   ========================================================= */

function displayTradeGate(gate) {

    setText(
        "eliteTradeGate",
        gate.allowed
            ? "TRADE READY"
            : "STAY AWAY"
    );

    setText(
        "gateReason",
        gate.reason
    );

    setText(
        "gateSession",
        isTradingSessionActive()
            ? "SESSION ACTIVE"
            : "SESSION INACTIVE"
    );

    setText(
        "gateDirection",
        gate.direction || "--"
    );

    setText(
        "gateEntry",
        gate.entry
            ? formatPrice(gate.entry)
            : "--"
    );

    setText(
        "gateSL",
        gate.sl
            ? formatPrice(gate.sl)
            : "--"
    );

    setText(
        "gateTP1",
        gate.tp1
            ? formatPrice(gate.tp1)
            : "--"
    );

    setText(
        "gateTP2",
        gate.tp2
            ? formatPrice(gate.tp2)
            : "--"
    );

    setText(
        "gateRR",
        gate.rr || "--"
    );

    setText(
        "gateRisk",
        gate.allowed
            ? "CONFIRMED"
            : "NOT APPROVED"
    );
}


/* =========================================================
   EXECUTION CHECKLIST
   ========================================================= */

function displayChecklist(sniper, scalp, gate) {

    const direction =
        gate.direction;

    const sessionOK =
        isTradingSessionActive();

    const h4 =
        getTrend(marketData.h4);

    const h1 =
        getTrend(marketData.h1);

    const m15 =
        getTrend(marketData.m15);

    const m5 =
        getTrend(marketData.m5);

    const ema =
        getEMADirection(marketData.m5);

    const rsi =
        calculateRSI(marketData.m5);

    const momentum =
        getMomentum(marketData.m5);

    const news =
        getNewsRisk();

    const htfOK =
        direction === "BUY"
            ? h4 === "BULLISH" &&
              h1 === "BULLISH"
            : direction === "SELL"
                ? h4 === "BEARISH" &&
                  h1 === "BEARISH"
                : false;

    const m15OK =
        direction === "BUY"
            ? m15 === "BULLISH"
            : direction === "SELL"
                ? m15 === "BEARISH"
                : false;

    const m5OK =
        direction === "BUY"
            ? m5 === "BULLISH"
            : direction === "SELL"
                ? m5 === "BEARISH"
                : false;

    const emaOK =
        direction === "BUY"
            ? ema === "BULLISH"
            : direction === "SELL"
                ? ema === "BEARISH"
                : false;

    const rsiOK =
        direction === "BUY"
            ? rsi >= 55
            : direction === "SELL"
                ? rsi <= 45
                : false;

    const momentumOK =
        direction === "BUY"
            ? momentum === "BULLISH"
            : direction === "SELL"
                ? momentum === "BEARISH"
                : false;

    setText(
        "checkSession",
        sessionOK
            ? "✓ Active London / New York session"
            : "— Active London / New York session"
    );

    setText(
        "checkNews",
        news.available && !news.blocked
            ? "✓ EUR/USD high-impact news clear"
            : "— EUR/USD high-impact news clear"
    );

    setText(
        "checkHtf",
        htfOK
            ? "✓ H4 + H1 directional alignment"
            : "— H4 + H1 directional alignment"
    );

    setText(
        "checkM15",
        m15OK
            ? "✓ M15 confirmation"
            : "— M15 confirmation"
    );

    setText(
        "checkM5",
        m5OK
            ? "✓ M5 confirmation"
            : "— M5 confirmation"
    );

    setText(
        "checkEMA",
        emaOK
            ? "✓ M5 EMA20 / EMA50 alignment"
            : "— M5 EMA20 / EMA50 alignment"
    );

    setText(
        "checkRSI",
        rsiOK
            ? "✓ M5 RSI confirmation"
            : "— M5 RSI confirmation"
    );

    setText(
        "checkMomentum",
        momentumOK
            ? "✓ Completed M5 momentum candle"
            : "— Completed M5 momentum candle"
    );

    setText(
        "checkExtension",
        "— No excessive EMA extension"
    );

    setText(
        "checkRisk",
        "✓ 3–15 pip structural risk"
    );

    setText(
        "checkRR",
        "✓ Minimum 1:2 Risk / Reward"
    );

    setText(
        "checkSR",
        "— Higher-timeframe S/R does not block TP2"
    );
}


/* =========================================================
   LOAD ALL MARKET DATA
   ========================================================= */

async function loadMarketData() {

    if (marketDataLoading) {
        return;
    }

    marketDataLoading = true;

    try {

        /*
         * NEWS IS LOADED FIRST.
         * If no news API is configured, this returns immediately.
         */

        await loadNewsData();

        /*
         * LOW REQUEST MODE
         */

        await loadTimeframe(
            "h4",
            "4h",
            DATA_TTL.h4
        );

        await delay(250);

        await loadTimeframe(
            "h1",
            "1h",
            DATA_TTL.h1
        );

        await delay(250);

        await loadTimeframe(
            "m15",
            "15min",
            DATA_TTL.m15
        );

        await delay(250);

        await loadTimeframe(
            "m5",
            "5min",
            DATA_TTL.m5
        );

        const price =
            getMarketPrice();

        if (price) {

            setText(
                "livePrice",
                formatPrice(price)
            );
        }

        displayMarketStructure();

        displayQuickAnalysis();

        displaySupportResistance();

        displayTechnicals();

        const sniper =
            evaluateSniper();

        const scalp =
            evaluateScalp();

        const gate =
            evaluateTradeGate(
                sniper,
                scalp
            );

        displaySniper(sniper);

        displayScalp(scalp);

        displayProVerdict(
            sniper,
            scalp,
            gate
        );

        displayTradeGate(gate);

        displayChecklist(
            sniper,
            scalp,
            gate
        );

        setText(
            "livePrice",
            formatPrice(price)
        );

    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );

        setText(
            "livePrice",
            "ERROR"
        );

        setText(
            "proVerdict",
            "DATA ERROR"
        );

    } finally {

        marketDataLoading = false;
    }
}


/* =========================================================
   MANUAL REFRESH
   ========================================================= */

async function manualRefresh() {

    /*
     * Force refresh of all timeframes.
     */

    marketDataUpdated = {
        h4: 0,
        h1: 0,
        m15: 0,
        m5: 0
    };

    newsData.lastUpdated = 0;

    await loadMarketData();
}


/* =========================================================
   AUTOMATIC REFRESH
   ========================================================= */

setInterval(
    async () => {

        await loadMarketData();

    },
    REFRESH_INTERVAL
);


/* =========================================================
   NEWS AUTO REFRESH
   ========================================================= */

setInterval(
    async () => {

        await loadNewsData();

    },
    NEWS_REFRESH_INTERVAL
);


/* =========================================================
   START DASHBOARD
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadMarketData();

    }
);
