const API_KEY = "8908432b6c784bc49aad6ccf64845991";

const SYMBOL = "EUR/USD";
const REFRESH_MS = 60000;


// =====================================================
// MAIN REFRESH
// =====================================================

async function refreshDashboard() {

    const priceElement = document.getElementById("price");
    const trendElement = document.getElementById("trend");

    try {

        trendElement.innerText = "Updating market data...";


        // LIVE PRICE
        const priceResponse = await fetch(
            `https://api.twelvedata.com/price?symbol=${encodeURIComponent(SYMBOL)}&apikey=${API_KEY}`
        );

        const priceData = await priceResponse.json();

        if (priceData.status === "error") {
            throw new Error(priceData.message);
        }

        const price = Number(priceData.price);

        if (!Number.isFinite(price)) {
            throw new Error("Invalid live price");
        }

        priceElement.innerText = price.toFixed(5);


        // GET CANDLE DATA
        const h1 = await getCandles("1h", 120);
        const m15 = await getCandles("15min", 120);
        const m5 = await getCandles("5min", 120);


        // ANALYSIS
        const h1Data = analyse(h1);
        const m15Data = analyse(m15);
        const m5Data = analyse(m5);


        // MARKET STRUCTURE
        setText("h1Trend", h1Data.trend);
        setText("m15Structure", m15Data.structure);
        setText("m5Structure", m5Data.structure);


        // SUPPORT / RESISTANCE
        const sr = findLevels(h1, price);

        setText("resistance1", formatPrice(sr.resistance1));
        setText("resistance2", formatPrice(sr.resistance2));
        setText("support1", formatPrice(sr.support1));
        setText("support2", formatPrice(sr.support2));


        // RSI
        setText("h1Rsi", formatNumber(h1Data.rsi, 2));
        setText("m15Rsi", formatNumber(m15Data.rsi, 2));
        setText("m5Rsi", formatNumber(m5Data.rsi, 2));


        // EMA
        setText(
            "emaStructure",
            "H1 EMA20 " +
            formatPrice(h1Data.ema20) +
            " | EMA50 " +
            formatPrice(h1Data.ema50)
        );


        // SNIPER ENGINE
        buildSniperPlan(
            price,
            h1Data,
            m15Data,
            m5Data,
            sr
        );


        trendElement.innerText =
            "Twelve Data connected • Updated: " +
            new Date().toLocaleTimeString();

    }

    catch (error) {

        console.error("Dashboard error:", error);

        trendElement.innerText =
            "Data error: " + error.message;
    }
}


// =====================================================
// CANDLE DATA
// =====================================================

async function getCandles(interval, outputsize) {

    const url =
        "https://api.twelvedata.com/time_series" +
        "?symbol=" + encodeURIComponent(SYMBOL) +
        "&interval=" + interval +
        "&outputsize=" + outputsize +
        "&apikey=" + API_KEY;

    const response = await fetch(url);

    const data = await response.json();

    if (data.status === "error") {
        throw new Error(
            interval + ": " + data.message
        );
    }

    if (!data.values || data.values.length < 30) {
        throw new Error(
            interval + ": insufficient candle data"
        );
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


// =====================================================
// TIMEFRAME ANALYSIS
// =====================================================

function analyse(candles) {

    const closes =
        candles.map(c => c.close);

    const ema20 =
        calculateEMA(closes, 20);

    const ema50 =
        calculateEMA(closes, 50);

    const rsi =
        calculateRSI(closes, 14);

    const last =
        candles[candles.length - 1];

    const e20 =
        ema20[ema20.length - 1];

    const e50 =
        ema50[ema50.length - 1];

    const currentRSI =
        rsi[rsi.length - 1];


    let trend = "NEUTRAL";


    if (
        last.close > e20 &&
        e20 > e50
    ) {
        trend = "BULLISH";
    }

    else if (
        last.close < e20 &&
        e20 < e50
    ) {
        trend = "BEARISH";
    }


    return {

        close: last.close,
        ema20: e20,
        ema50: e50,
        rsi: currentRSI,
        trend: trend,
        structure: marketStructure(candles)

    };
}


// =====================================================
// EMA
// =====================================================

function calculateEMA(values, period) {

    if (values.length < period) {
        return [];
    }

    const multiplier =
        2 / (period + 1);

    let ema = 0;


    for (let i = 0; i < period; i++) {
        ema += values[i];
    }

    ema /= period;


    const result =
        new Array(period - 1).fill(null);

    result.push(ema);


    for (
        let i = period;
        i < values.length;
        i++
    ) {

        ema =
            (values[i] - ema) *
            multiplier +
            ema;

        result.push(ema);
    }


    return result;
}


// =====================================================
// RSI
// =====================================================

function calculateRSI(values, period) {

    if (values.length <= period) {
        return [];
    }


    let gains = 0;
    let losses = 0;


    for (
        let i = 1;
        i <= period;
        i++
    ) {

        const change =
            values[i] - values[i - 1];

        if (change > 0) {
            gains += change;
        }

        else {
            losses += Math.abs(change);
        }
    }


    let averageGain =
        gains / period;

    let averageLoss =
        losses / period;


    const result =
        new Array(period).fill(null);


    for (
        let i = period;
        i < values.length;
        i++
    ) {

        if (i > period) {

            const change =
                values[i] - values[i - 1];

            const gain =
                change > 0 ? change : 0;

            const loss =
                change < 0 ? Math.abs(change) : 0;


            averageGain =
                (
                    averageGain *
                    (period - 1) +
                    gain
                ) / period;


            averageLoss =
                (
                    averageLoss *
                    (period - 1) +
                    loss
                ) / period;
        }


        if (averageLoss === 0) {
            result.push(100);
        }

        else {

            const rs =
                averageGain /
                averageLoss;

            result.push(
                100 -
                (100 / (1 + rs))
            );
        }
    }


    return result;
}


// =====================================================
// MARKET STRUCTURE
// =====================================================

function marketStructure(candles) {

    const recent =
        candles.slice(-40);

    const highs = [];
    const lows = [];


    for (
        let i = 2;
        i < recent.length - 2;
        i++
    ) {

        if (
            recent[i].high >
            recent[i - 1].high &&
            recent[i].high >
            recent[i - 2].high &&
            recent[i].high >
            recent[i + 1].high &&
            recent[i].high >
            recent[i + 2].high
        ) {
            highs.push(recent[i].high);
        }


        if (
            recent[i].low <
            recent[i - 1].low &&
            recent[i].low <
            recent[i - 2].low &&
            recent[i].low <
            recent[i + 1].low &&
            recent[i].low <
            recent[i + 2].low
        ) {
            lows.push(recent[i].low);
        }
    }


    if (highs.length >= 2 && lows.length >= 2) {

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
            return "BULLISH HH / HL";
        }


        if (
            lastHigh < previousHigh &&
            lastLow < previousLow
        ) {
            return "BEARISH LH / LL";
        }
    }


    return "RANGE / TRANSITION";
}


// =====================================================
// SUPPORT / RESISTANCE
// =====================================================

function findLevels(candles, price) {

    const recent =
        candles.slice(-80);

    const highs = [];
    const lows = [];


    for (
        let i = 2;
        i < recent.length - 2;
        i++
    ) {

        if (
            recent[i].high >
            recent[i - 1].high &&
            recent[i].high >
            recent[i - 2].high &&
            recent[i].high >
            recent[i + 1].high &&
            recent[i].high >
            recent[i + 2].high
        ) {
            highs.push(recent[i].high);
        }


        if (
            recent[i].low <
            recent[i - 1].low &&
            recent[i].low <
            recent[i - 2].low &&
            recent[i].low <
            recent[i + 1].low &&
            recent[i].low <
            recent[i + 2].low
        ) {
            lows.push(recent[i].low);
        }
    }


    const resistance =
        highs
            .filter(x => x > price)
            .sort((a, b) => a - b);


    const support =
        lows
            .filter(x => x < price)
            .sort((a, b) => b - a);


    return {

        resistance1:
            resistance[0] ?? null,

        resistance2:
            resistance[1] ?? null,

        support1:
            support[0] ?? null,

        support2:
            support[1] ?? null
    };
}


// =====================================================
// SNIPER SETUP
// =====================================================

function buildSniperPlan(
    price,
    h1,
    m15,
    m5,
    sr
) {

    const setupStatus =
        document.getElementById("setupStatus");


    let direction = "WAIT";


    if (
        h1.trend === "BEARISH" &&
        m15.trend === "BEARISH" &&
        m5.trend === "BEARISH"
    ) {
        direction = "SELL";
    }


    if (
        h1.trend === "BULLISH" &&
        m15.trend === "BULLISH" &&
        m5.trend === "BULLISH"
    ) {
        direction = "BUY";
    }


    if (direction === "WAIT") {

        setupStatus.innerText =
            "WAIT — No A+ multi-timeframe alignment.";

        setupStatus.className =
            "wait";


        setText("direction", "WAIT");
        setText("entry", "—");
        setText("stopLoss", "—");
        setText("tp1", "—");
        setText("tp2", "—");
        setText("tp3", "—");
        setText("riskReward", "—");
        setText("validity", "—");
        setText("trigger", "Wait for confirmation");
        setText("invalidation", "—");


        setText(
            "proVerdict",
            "WAIT — No A+ setup."
        );


        return;
    }


    setupStatus.innerText =
        direction +
        " bias detected — confirmation required.";

    setupStatus.className =
        direction === "BUY"
            ? "bullish"
            : "bearish";


    setText(
        "direction",
        direction
    );

    setText(
        "entry",
        formatPrice(price)
    );

    setText(
        "stopLoss",
        "Awaiting POI"
    );

    setText(
        "tp1",
        "Awaiting structure"
    );

    setText(
        "tp2",
        "Awaiting structure"
    );

    setText(
        "tp3",
        "Awaiting structure"
    );

    setText(
        "riskReward",
        "Minimum target: 1:2"
    );

    setText(
        "validity",
        "Intraday"
    );

    setText(
        "trigger",
        "M5 confirmation required"
    );

    setText(
        "invalidation",
        "Structure invalidation"
    );

    setText(
        "proVerdict",
        direction +
        " bias — WAIT for A+ confirmation."
    );
}


// =====================================================
// HELPERS
// =====================================================

function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.innerText =
            value;
    }
}


function formatPrice(value) {

    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(value)
    ) {
        return "—";
    }

    return Number(value).toFixed(5);
}


function formatNumber(value, decimals) {

    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(value)
    ) {
        return "—";
    }

    return Number(value).toFixed(decimals);
}


// =====================================================
// START
// =====================================================

refreshDashboard();

setInterval(
    refreshDashboard,
    REFRESH_MS
);
