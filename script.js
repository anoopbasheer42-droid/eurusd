/* =========================================================
   EUR/USD SNIPER DASHBOARD — UPDATED ENGINE
   H4 → H1 → M15 → M5

   PRICE ACTION
   MARKET STRUCTURE
   SUPPORT / RESISTANCE
   EMA
   RSI
   BUY / SELL SCORE
   A+ SNIPER SETUP
   NEWS SAFETY GATE

   IMPORTANT:
   - This script calculates the technical setup even when
     the news gate is closed.
   - NEWS_CLEAR only controls whether a trade may execute.
   - Price is taken from the latest M5 candle.
   ========================================================= */


/* =========================================================
   CONFIGURATION
   ========================================================= */

const API_KEY = "8908432b6c784bc49aad6ccf64845991";

const SYMBOL = "EUR/USD";

/*
   Refresh candles every 15 minutes.
*/
const REFRESH_MS = 900000;


/*
   NEWS SAFETY GATE

   false = technical analysis still works,
           but actual trade is BLOCKED.

   true = trade is allowed IF an A+ setup exists.

   Change this to true ONLY after checking the
   current EUR/USD economic calendar yourself.
*/
const NEWS_CLEAR = false;


/*
   Minimum score for an A+ setup.

   Maximum technical score = 11.
*/
const MIN_SETUP_SCORE = 8;


/*
   Maximum structural risk.

   0.0030 = 30 pips.
*/
const MAX_RISK = 0.0030;


/*
   Structural SL buffer.

   0.00015 = 1.5 pips.
*/
const SL_BUFFER = 0.00015;


/* =========================================================
   GLOBAL DATA
   ========================================================= */

let marketData = {

    h4: [],
    h1: [],
    m15: [],
    m5: [],

    price: null,

    lastUpdate: null,

    apiError: null

};


/* =========================================================
   DOM HELPER
   ========================================================= */

function setTextAny(ids, value) {

    if (!Array.isArray(ids)) {
        ids = [ids];
    }

    for (const id of ids) {

        const el =
            document.getElementById(id);

        if (el) {

            el.innerText = value;

            return true;
        }
    }

    return false;
}


/* =========================================================
   NUMBER HELPERS
   ========================================================= */

function num(value) {

    const n = Number(value);

    return Number.isFinite(n)
        ? n
        : null;
}


function roundPrice(value) {

    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(Number(value))
    ) {

        return "—";
    }

    return Number(value).toFixed(5);
}


function roundRSI(value) {

    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(Number(value))
    ) {

        return "—";
    }

    return Number(value).toFixed(2);
}


/* =========================================================
   FETCH CANDLES
   ========================================================= */

async function getCandles(
    interval,
    outputsize = 100
) {

    const url =
        `https://api.twelvedata.com/time_series` +
        `?symbol=${encodeURIComponent(SYMBOL)}` +
        `&interval=${encodeURIComponent(interval)}` +
        `&outputsize=${outputsize}` +
        `&timezone=Asia/Kolkata` +
        `&apikey=${encodeURIComponent(API_KEY)}`;


    const response =
        await fetch(url);


    if (!response.ok) {

        if (response.status === 429) {

            throw new Error(
                `${interval} HTTP 429 — API limit reached`
            );
        }

        throw new Error(
            `${interval} HTTP ${response.status}`
        );
    }


    const data =
        await response.json();


    if (data.status === "error") {

        throw new Error(
            `${interval}: ${
                data.message ||
                "Twelve Data API error"
            }`
        );
    }


    if (
        !data.values ||
        !Array.isArray(data.values)
    ) {

        throw new Error(
            `No ${interval} candle data returned`
        );
    }


    return data.values

        .map(c => ({

            datetime: c.datetime,

            open: num(c.open),

            high: num(c.high),

            low: num(c.low),

            close: num(c.close),

            volume: num(c.volume) || 0

        }))

        .filter(c =>

            c.open !== null &&
            c.high !== null &&
            c.low !== null &&
            c.close !== null

        )

        .reverse();
}


/* =========================================================
   EMA
   ========================================================= */

function calculateEMA(
    candles,
    period
) {

    if (
        !candles ||
        candles.length < period
    ) {

        return null;
    }


    const multiplier =
        2 / (period + 1);


    let ema =
        candles
            .slice(0, period)
            .reduce(
                (sum, candle) =>
                    sum + candle.close,
                0
            ) / period;


    for (
        let i = period;
        i < candles.length;
        i++
    ) {

        ema =
            (
                (candles[i].close - ema) *
                multiplier
            ) + ema;
    }


    return ema;
}


/* =========================================================
   RSI
   ========================================================= */

function calculateRSI(
    candles,
    period = 14
) {

    if (
        !candles ||
        candles.length < period + 1
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


        if (change >= 0) {

            gains += change;

        } else {

            losses +=
                Math.abs(change);
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
            Math.max(change, 0);


        const loss =
            Math.max(-change, 0);


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

        return 100;
    }


    const rs =
        averageGain /
        averageLoss;


    return 100 -
        (
            100 /
            (1 + rs)
        );
}


/* =========================================================
   CANDLE DIRECTION
   ========================================================= */

function candleDirection(candle) {

    if (!candle) {
        return "NEUTRAL";
    }


    if (
        candle.close >
        candle.open
    ) {

        return "BULLISH";
    }


    if (
        candle.close <
        candle.open
    ) {

        return "BEARISH";
    }


    return "NEUTRAL";
}


/* =========================================================
   CANDLE BODY
   ========================================================= */

function candleBody(candle) {

    if (!candle) {
        return 0;
    }


    return Math.abs(
        candle.close -
        candle.open
    );
}


/* =========================================================
   CANDLE RANGE
   ========================================================= */

function candleRange(candle) {

    if (!candle) {
        return 0;
    }


    return (
        candle.high -
        candle.low
    );
}


/* =========================================================
   CANDLE STRENGTH
   ========================================================= */

function candleStrength(candle) {

    const range =
        candleRange(candle);


    const body =
        candleBody(candle);


    if (range <= 0) {
        return 0;
    }


    return body / range;
}


/* =========================================================
   SWING HIGH
   ========================================================= */

function isSwingHigh(
    candles,
    index
) {

    if (
        index < 2 ||
        index > candles.length - 3
    ) {

        return false;
    }


    const c =
        candles[index];


    return (

        c.high >
        candles[index - 1].high &&

        c.high >
        candles[index - 2].high &&

        c.high >
        candles[index + 1].high &&

        c.high >
        candles[index + 2].high

    );
}


/* =========================================================
   SWING LOW
   ========================================================= */

function isSwingLow(
    candles,
    index
) {

    if (
        index < 2 ||
        index > candles.length - 3
    ) {

        return false;
    }


    const c =
        candles[index];


    return (

        c.low <
        candles[index - 1].low &&

        c.low <
        candles[index - 2].low &&

        c.low <
        candles[index + 1].low &&

        c.low <
        candles[index + 2].low
