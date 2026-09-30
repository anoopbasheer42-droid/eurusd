const API_KEY = "8908432b6c784bc49aad6ccf64845991";

const SYMBOL = "EUR/USD";

let marketData = {
    h1: null,
    m15: null,
    m5: null
};


// =====================================================
// MAIN DASHBOARD REFRESH
// =====================================================

async function refreshDashboard() {

    const priceElement = document.getElementById("price");
    const trendElement = document.getElementById("trend");

    try {

        priceElement.innerText = "Loading...";

        // Get live price
        const priceResponse = await fetch(
            `https://api.twelvedata.com/price?symbol=${SYMBOL}&apikey=${API_KEY}`
        );

        const priceData = await priceResponse.json();

        if (priceData.status === "error") {
            throw new Error(priceData.message);
        }

        const price = Number(priceData.price);

        if (!Number.isFinite(price)) {
            throw new Error("Invalid price received");
        }

        priceElement.innerText = price.toFixed(5);

        trendElement.innerText =
            "Twelve Data connected • Updated: " +
            new Date().toLocaleTimeString();


        // =================================================
        // GET MULTI-TIMEFRAME CANDLES
        // =================================================

        const [h1, m15, m5] = await Promise.all([
            getCandles("1h", 200),
            getCandles("15min", 200),
            getCandles("5min", 200)
        ]);

        marketData.h1 = h1;
        marketData.m15 = m15;
        marketData.m5 = m5;


        // =================================================
        // ANALYSE EACH TIMEFRAME
        // =================================================

        const h1Analysis = analyseTimeframe(h1);
        const m15Analysis = analyseTimeframe(m15);
        const m5Analysis = analyseTimeframe(m5);


        // =================================================
        // UPDATE MARKET STRUCTURE
        // =================================================

        updateMarketStructure(
            h1Analysis,
            m15Analysis,
            m5Analysis
        );


        // =================================================
        // SUPPORT / RESISTANCE
        // =================================================

        updateSupportResistance(
            h1Analysis,
            price
        );


        // =================================================
        // INDICATORS
        // =================================================

        updateIndicators(
            h1Analysis,
            m15Analysis,
            m5Analysis
        );


        console.log("Dashboard updated", {
            price,
            h1: h1Analysis,
            m15: m15Analysis,
            m5: m5Analysis
        });

    } catch (error) {

        console.error("Dashboard error:", error);

        priceElement.innerText = "Unavailable";

        trendElement.innerText =
            "Market data error: " + error.message;
    }
}


// =====================================================
// GET CANDLE DATA FROM TWELVE DATA
// =====================================================

async function getCandles(interval, outputsize) {

    const url =
        `https://api.twelvedata.com/time_series` +
        `?symbol=${SYMBOL}` +
        `&interval=${interval}` +
        `&outputsize=${outputsize}` +
        `&apikey=${API_KEY}`;

    const response = await fetch(url);

    const data = await response.json();

    if (data.status === "error") {
        throw new Error(
            `${interval}: ${data.message}`
        );
    }

    if (!data.values || data.values.length < 50) {
        throw new Error(
            `${interval}: Not enough candle data`
        );
    }

    // Twelve Data returns newest first.
    // Reverse so calculations run oldest -> newest.
    return data.values
        .map(candle => ({
            datetime: candle.datetime,
            open: Number(candle.open),
            high: Number(candle.high),
            low: Number(candle.low),
            close: Number(candle.close),
            volume: Number(candle.volume || 0)
        }))
        .filter(candle =>
            Number.isFinite(candle.open) &&
            Number.isFinite(candle.high) &&
            Number.isFinite(candle.low) &&
            Number.isFinite(candle.close)
        )
        .reverse();
}


// =====================================================
// TIMEFRAME ANALYSIS
// =====================================================

function analyseTimeframe(candles) {

    const closes = candles.map(c => c.close);

    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const ema200 = calculateEMA(closes, 200);

    const rsi = calculateRSI(closes, 14);

    const last = candles[candles.length - 1];

    const previous = candles[candles.length - 2];

    const lastClose = last.close;

    const lastEMA20 = ema20[ema20.length - 1];
    const lastEMA50 = ema50[ema50.length - 1];
    const lastEMA200 = ema200[ema200.length - 1];

    const lastRSI = rsi[rsi.length - 1];

    const supportResistance =
        findSupportResistance(candles, lastClose);

    const structure =
        detectMarketStructure(candles);


    let trend = "NEUTRAL";

    if (
        lastClose > lastEMA20 &&
        lastEMA20 > lastEMA50
    ) {
        trend = "BULLISH";
    }

    else if (
        lastClose < lastEMA20 &&
        lastEMA20 < lastEMA50
    ) {
        trend = "BEARISH";
    }

    return {

        candles,

        close: lastClose,

        previousClose: previous.close,

        ema20: lastEMA20,

        ema50: lastEMA50,

        ema200: lastEMA200,

        rsi: lastRSI,

        trend,

        structure,

        support1: supportResistance.support1,

        support2: supportResistance.support2,

        resistance1: supportResistance.resistance1,

        resistance2: supportResistance.resistance2
    };
}


// =====================================================
// EMA
// =====================================================

function calculateEMA(values, period) {

    if (values.length < period) {
        return [];
    }

    const multiplier = 2 / (period + 1);

    const result = [];

    let ema = 0;

    // Initial SMA
    for (let i = 0; i < period; i++) {
        ema += values[i];
    }

    ema = ema / period;

    result.push(ema);

    for (let i = period; i < values.length; i++) {

        ema =
            (values[i] - ema) * multiplier +
            ema;

        result.push(ema);
    }

    // Pad beginning so indexes line up
    const padding =
        new Array(period - 1).fill(null);

    return padding.concat(result);
}


// =====================================================
// RSI
// =====================================================

function calculateRSI(values, period = 14) {

    if (values.length <= period) {
        return [];
    }

    const rsi = [];

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {

        const change =
            values[i] - values[i - 1];

        if (change >= 0) {
            gains += change;
        } else {
            losses += Math.abs(change);
        }
    }

    let averageGain = gains / period;
    let averageLoss = losses / period;

    let rs =
        averageLoss === 0
            ? 100
            : averageGain / averageLoss;

    let firstRSI =
        averageLoss === 0
            ? 100
            : 100 - (100 / (1 + rs));

    const padding =
        new Array(period).fill(null);

    rsi.push(firstRSI);

    for (let i = period + 1; i < values.length; i++) {

        const change =
            values[i] - values[i - 1];

        const gain =
            change > 0 ? change : 0;

        const loss =
            change < 0 ? Math.abs(change) : 0;

        averageGain =
            ((averageGain * (period - 1)) + gain)
            / period;

        averageLoss =
            ((averageLoss * (period - 1)) + loss)
            / period;

        if (averageLoss === 0) {
            rsi.push(100);
            continue;
        }

        rs = averageGain / averageLoss;

        const currentRSI =
            100 - (100 / (1 + rs));

        rsi.push(currentRSI);
    }

    return padding.concat(rsi);
}


// =====================================================
// SUPPORT / RESISTANCE
// =====================================================

function findSupportResistance(candles, currentPrice) {

    const lookback =
        candles.slice(-100);

    const swingHighs = [];
    const swingLows = [];

    for (let i = 2; i < lookback.length - 2; i++) {

        const candle = lookback[i];

        const isSwingHigh =
            candle.high > lookback[i - 1].high &&
            candle.high > lookback[i - 2].high &&
            candle.high > lookback[i + 1].high &&
            candle.high > lookback[i + 2].high;

        const isSwingLow =
            candle.low < lookback[i - 1].low &&
            candle.low < lookback[i - 2].low &&
            candle.low < lookback[i + 1].low &&
            candle.low < lookback[i + 2].low;

        if (isSwingHigh) {
            swingHighs.push(candle.high);
        }

        if (isSwingLow) {
            swingLows.push(candle.low);
        }
    }


    const resistances =
        swingHighs
            .filter(level => level > currentPrice)
            .sort((a, b) => a - b);

    const supports =
        swingLows
            .filter(level => level < currentPrice)
            .sort((a, b) => b - a);


    return {

        resistance1:
            resistances.length
                ? resistances[0]
                : null,

        resistance2:
            resistances.length > 1
                ? resistances[1]
                : null,

        support1:
            supports.length
                ? supports[0]
                : null,

        support2:
            supports.length > 1
                ? supports[1]
                : null
    };
}


// =====================================================
// MARKET STRUCTURE
// =====================================================

function detectMarketStructure(candles) {

    const recent =
        candles.slice(-30);

    const highs =
        [];

    const lows =
        [];

    for (let i = 2; i < recent.length - 2; i++) {

        if (
            recent[i].high > recent[i - 1].high &&
            recent[i].high > recent[i - 2].high &&
            recent[i].high > recent[i + 1].high &&
            recent[i].high > recent[i + 2].high
        ) {
            highs.push(recent[i].high);
        }

        if (
            recent[i].low < recent[i - 1].low &&
            recent[i].low < recent[i - 2].low &&
            recent[i].low < recent[i + 1].low &&
            recent[i].low < recent[i + 2].low
        ) {
            lows.push(recent[i].low);
        }
    }


    if (highs.length < 2 || lows.length < 2) {
        return "NEUTRAL";
    }


    const lastHigh =
        highs[highs.length - 1];

    const previousHigh =
        highs[highs.length - 2];

    const lastLow =
        lows[lows.length - 1];

    const previousLow =
        lows[lows.length - 2];


    if (
        lastHigh > previousHigh &&
        lastLow > previousLow
    ) {
        return "HIGHER HIGH / HIGHER LOW";
    }


    if (
        lastHigh < previousHigh &&
        lastLow < previousLow
    ) {
        return "LOWER HIGH / LOWER LOW";
    }


    return "RANGE / TRANSITION";
}


// =====================================================
// UPDATE MARKET STRUCTURE DISPLAY
// =====================================================

function updateMarketStructure(
    h1,
    m15,
    m5
) {

    const card =
        findCard("Market Structure");

    if (!card) return;

    const rows =
        card.querySelectorAll(".level");

    if (rows.length >= 3) {

        rows[0].children[1].innerText =
            h1.trend;

        rows[1].children[1].innerText =
            m15.structure;

        rows[2].children[1].innerText =
            m5.structure;
    }
}


// =====================================================
// UPDATE SUPPORT / RESISTANCE
// =====================================================

function updateSupportResistance(
    analysis,
    currentPrice
) {

    const card =
        findCard("Support & Resistance");

    if (!card) return;

    const rows =
        card.querySelectorAll(".level");

    if (rows.length >= 4) {

        rows[0].children[1].innerText =
            formatPrice(analysis.resistance1);

        rows[1].children[1].innerText =
            formatPrice(analysis.resistance2);

        rows[2].children[1].innerText =
            formatPrice(analysis.support1);

        rows[3].children[1].innerText =
            formatPrice(analysis.support2);
    }
}


// =====================================================
// UPDATE INDICATORS
// =====================================================

function updateIndicators(
    h1,
    m15,
    m5
) {

    const card =
        findCard("Indicators");

    if (!card) return;

    const rows =
        card.querySelectorAll(".level");

    if (rows.length >= 4) {

        rows[0].children[1].innerText =
            formatRSI(h1.rsi);

        rows[1].children[1].innerText =
            formatRSI(m15.rsi);

        rows[2].children[1].innerText =
            formatRSI(m5.rsi);

        rows[3].children[1].innerText =
            "H1 EMA20 " +
            formatPrice(h1.ema20) +
            " | EMA50 " +
            formatPrice(h1.ema50);
    }
}


// =====================================================
// FIND CARD BY TITLE
// =====================================================

function findCard(title) {

    const cards =
        document.querySelectorAll(".card");

    for (const card of cards) {

        const heading =
            card.querySelector("h2");

        if (
            heading &&
            heading.innerText
                .toLowerCase()
                .includes(title.toLowerCase())
        ) {
            return card;
        }
    }

    return null;
}


// =====================================================
// FORMATTING
// =====================================================

function formatPrice(value) {

    if (!Number.isFinite(value)) {
        return "—";
    }

    return value.toFixed(5);
}


function formatRSI(value) {

    if (!Number.isFinite(value)) {
        return "—";
    }

    return value.toFixed(2);
}


// =====================================================
// START DASHBOARD
// =====================================================

refreshDashboard();


// Refresh every 30 seconds
setInterval(
    refreshDashboard,
    30000
);
