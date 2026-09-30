/* =========================================================
   EUR/USD SNIPER DASHBOARD
   H4 → H1 → M15 → M5
   PRICE ACTION + MARKET STRUCTURE + S/R
   BUY / SELL SNIPER ENGINE
   ========================================================= */

const API_KEY = "8908432b6c784bc49aad6ccf64845991";

/*
   IMPORTANT:
   We deliberately use a slower refresh rate because
   Twelve Data free plans have API request limits.

   The dashboard does NOT request /price separately.
   Price comes from the latest M5 candle.
*/
const REFRESH_MS = 300000; // 5 minutes


/* =========================================================
   GLOBAL DATA
   ========================================================= */

let marketData = {
    h4: [],
    h1: [],
    m15: [],
    m5: [],
    price: null,
    lastUpdate: null
};


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function num(value) {

    const n = Number(value);

    return Number.isFinite(n) ? n : null;
}


function setText(id, value) {

    const el = document.getElementById(id);

    if (el) {
        el.innerText = value;
    }
}


function roundPrice(value) {

    if (value === null || value === undefined) {
        return "—";
    }

    return Number(value).toFixed(5);
}


function pips(a, b) {

    return Math.abs(a - b) * 10000;
}


function clamp(value, min, max) {

    return Math.max(min, Math.min(max, value));
}


/* =========================================================
   FETCH CANDLES
   ========================================================= */

async function getCandles(interval, outputsize = 100) {

    const url =
        `https://api.twelvedata.com/time_series` +
        `?symbol=EUR/USD` +
        `&interval=${interval}` +
        `&outputsize=${outputsize}` +
        `&timezone=Asia/Kolkata` +
        `&apikey=${API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) {

        throw new Error(
            `${interval} HTTP ${response.status}`
        );
    }

    const data = await response.json();

    if (data.status === "error") {

        throw new Error(
            `${interval}: ${data.message || "API error"}`
        );
    }

    if (!data.values || !Array.isArray(data.values)) {

        throw new Error(
            `No ${interval} candle data`
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

function calculateEMA(candles, period) {

    if (candles.length < period) {
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
            ((candles[i].close - ema) *
                multiplier) +
            ema;
    }

    return ema;
}


/* =========================================================
   RSI
   ========================================================= */

function calculateRSI(candles, period = 14) {

    if (candles.length < period + 1) {
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
        (100 / (1 + rs));
}


/* =========================================================
   CANDLE DIRECTION
   ========================================================= */

function candleDirection(candle) {

    if (!candle) {
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
   CANDLE BODY
   ========================================================= */

function candleBody(candle) {

    return Math.abs(
        candle.close -
        candle.open
    );
}


/* =========================================================
   CANDLE RANGE
   ========================================================= */

function candleRange(candle) {

    return candle.high -
        candle.low;
}


/* =========================================================
   CANDLE QUALITY
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

function isSwingHigh(candles, index) {

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

function isSwingLow(candles, index) {

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

    );
}


/* =========================================================
   FIND SWING LEVELS
   ========================================================= */

function getSwingLevels(
    candles,
    lookback = 80
) {

    const data =
        candles.slice(-lookback);

    const swingHighs = [];

    const swingLows = [];


    for (
        let i = 2;
        i < data.length - 2;
        i++
    ) {

        if (
            isSwingHigh(
                data,
                i
            )
        ) {

            swingHighs.push(
                data[i].high
            );
        }


        if (
            isSwingLow(
                data,
                i
            )
        ) {

            swingLows.push(
                data[i].low
            );
        }
    }


    return {
        swingHighs,
        swingLows
    };
}


/* =========================================================
   CLUSTER LEVELS
   ========================================================= */

function clusterLevels(
    levels,
    tolerance = 0.00025
) {

    if (!levels.length) {
        return [];
    }


    const sorted =
        [...levels].sort(
            (a, b) => a - b
        );


    const clusters = [];


    for (const level of sorted) {

        let found = null;


        for (const cluster of clusters) {

            if (
                Math.abs(
                    level -
                    cluster.mean
                ) <= tolerance
            ) {

                cluster.values.push(level);

                cluster.mean =
                    cluster.values.reduce(
                        (a, b) => a + b,
                        0
                    ) /
                    cluster.values.length;

                found = cluster;

                break;
            }
        }


        if (!found) {

            clusters.push({

                mean: level,

                values: [level]

            });
        }
    }


    return clusters
        .sort(
            (a, b) =>
                b.values.length -
                a.values.length
        )
        .map(
            c => c.mean
        );
}


/* =========================================================
   SUPPORT / RESISTANCE
   ========================================================= */

function calculateSupportResistance(
    candles
) {

    if (
        !candles ||
        candles.length < 20
    ) {

        return {

            resistance1: null,
            resistance2: null,

            support1: null,
            support2: null
        };
    }


    const current =
        candles[
            candles.length - 1
        ].close;


    const swings =
        getSwingLevels(
            candles,
            80
        );


    const resistanceLevels =
        clusterLevels(
            swings.swingHighs
        );


    const supportLevels =
        clusterLevels(
            swings.swingLows
        );


    /*
       Only levels on the correct side
       of the current price are accepted.
    */

    const resistances =
        resistanceLevels
            .filter(
                level =>
                    level > current
            )
            .sort(
                (a, b) =>
                    a - b
            );


    const supports =
        supportLevels
            .filter(
                level =>
                    level < current
            )
            .sort(
                (a, b) =>
                    b - a
            );


    /*
       Fallback:
       use highest/lowest recent structure
       only if there are not enough swings.
    */

    if (!resistances.length) {

        const recentHigh =
            Math.max(
                ...candles
                    .slice(-40)
                    .map(c => c.high)
            );

        if (
            recentHigh > current
        ) {

            resistances.push(
                recentHigh
            );
        }
    }


    if (!supports.length) {

        const recentLow =
            Math.min(
                ...candles
                    .slice(-40)
                    .map(c => c.low)
            );

        if (
            recentLow < current
        ) {

            supports.push(
                recentLow
            );
        }
    }


    return {

        resistance1:
            resistances[0] ?? null,

        resistance2:
            resistances[1] ?? null,

        support1:
            supports[0] ?? null,

        support2:
            supports[1] ?? null
    };
}


/* =========================================================
   MARKET STRUCTURE
   ========================================================= */

function calculateStructure(
    candles
) {

    if (
        !candles ||
        candles.length < 30
    ) {

        return "INSUFFICIENT DATA";
    }


    /*
       Use swing structure instead of simply
       comparing the last ten candles.

       This prevents a single red candle from
       automatically making the whole H1 bearish.
    */

    const swings =
        getSwingLevels(
            candles,
            60
        );


    const highs =
        swings.swingHighs;

    const lows =
        swings.swingLows;


    if (
        highs.length < 2 ||
        lows.length < 2
    ) {

        return "RANGE";
    }


    const lastHigh =
        highs[highs.length - 1];

    const previousHigh =
        highs[highs.length - 2];


    const lastLow =
        lows[lows.length - 1];

    const previousLow =
        lows[lows.length - 2];


    const bullishStructure =
        lastHigh > previousHigh &&
        lastLow > previousLow;


    const bearishStructure =
        lastHigh < previousHigh &&
        lastLow < previousLow;


    if (bullishStructure) {
        return "BULLISH";
    }


    if (bearishStructure) {
        return "BEARISH";
    }


    return "RANGE";
}


/* =========================================================
   EMA ANALYSIS
   ========================================================= */

function getEMAAnalysis(
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


    const ema200 =
        calculateEMA(
            candles,
            200
        );


    if (
        ema20 === null ||
        ema50 === null
    ) {

        return {

            text: "Calculating...",

            ema20,

            ema50,

            ema200
        };
    }


    let text;


    if (
        ema20 > ema50 &&
        (
            ema200 === null ||
            ema50 > ema200
        )
    ) {

        text =
            "Bullish EMA alignment";

    }


    else if (
        ema20 < ema50 &&
        (
            ema200 === null ||
            ema50 < ema200
        )
    ) {

        text =
            "Bearish EMA alignment";

    }


    else {

        text =
            "EMA mixed / transition";
    }


    return {

        text,

        ema20,

        ema50,

        ema200
    };
}


/* =========================================================
   TIMEFRAME ANALYSIS
   ========================================================= */

function analyzeTimeframe(
    candles
) {

    if (
        !candles ||
        candles.length < 20
    ) {

        return {

            price: null,

            structure:
                "INSUFFICIENT DATA",

            candle:
                "NEUTRAL",

            candleStrength: 0,

            rsi: null,

            ema: {
                text: "Calculating..."
            },

            sr: {

                resistance1: null,
                resistance2: null,

                support1: null,
                support2: null
            }
        };
    }


    const last =
        candles[
            candles.length - 1
        ];


    return {

        price: last.close,

        structure:
            calculateStructure(
                candles
            ),

        candle:
            candleDirection(
                last
            ),

        candleStrength:
            candleStrength(
                last
            ),

        rsi:
            calculateRSI(
                candles
            ),

        ema:
            getEMAAnalysis(
                candles
            ),

        sr:
            calculateSupportResistance(
                candles
            )
    };
}


/* =========================================================
   BUILD COMPLETE ANALYSIS
   ========================================================= */

function buildAnalysis() {

    return {

        H4:
            analyzeTimeframe(
                marketData.h4
            ),

        H1:
            analyzeTimeframe(
                marketData.h1
            ),

        M15:
            analyzeTimeframe(
                marketData.m15
            ),

        M5:
            analyzeTimeframe(
                marketData.m5
            )
    };
}


/* =========================================================
   PRICE ACTION CONFIRMATION
   ========================================================= */

function bullishCandleConfirmation(
    candles
) {

    if (
        !candles ||
        candles.length < 3
    ) {
        return false;
    }


    const last =
        candles[
            candles.length - 1
        ];

    const previous =
        candles[
            candles.length - 2
        ];


    return (

        last.close >
        last.open &&

        last.close >
        previous.high &&

        candleStrength(last) >= 0.45

    );
}


/* =========================================================
   BEARISH CANDLE CONFIRMATION
   ========================================================= */

function bearishCandleConfirmation(
    candles
) {

    if (
        !candles ||
        candles.length < 3
    ) {
        return false;
    }


    const last =
        candles[
            candles.length - 1
        ];

    const previous =
        candles[
            candles.length - 2
        ];


    return (

        last.close <
        last.open &&

        last.close <
        previous.low &&

        candleStrength(last) >= 0.45

    );
}


/* =========================================================
   BUY SETUP
   ========================================================= */

function calculateBuySetup(
    a,
    price
) {

    /*
       Higher timeframe bias.
    */

    const higherBias =

        (
            a.H4.structure ===
            "BULLISH"
        ) &&

        (
            a.H1.structure ===
            "BULLISH"
        );


    /*
       M15 confirmation.
    */

    const m15Confirmation =

        a.M15.structure ===
        "BULLISH";


    /*
       M5 sniper trigger.
    */

    const m5Trigger =

        a.M5.structure ===
        "BULLISH" &&

        bullishCandleConfirmation(
            marketData.m5
        );


    /*
       RSI should support momentum,
       but avoid buying extremely overbought.
    */

    const rsiOK =

        a.M5.rsi !== null &&

        a.M5.rsi >= 45 &&

        a.M5.rsi <= 70;


    if (
        !higherBias ||
        !m15Confirmation ||
        !m5Trigger ||
        !rsiOK
    ) {

        return null;
    }


    /*
       Entry is based on current price,
       because waiting for an old support price
       would create a fake "instant entry".
    */

    const entry =
        price;


    /*
       Structural stop:

       Use M15 support if available,
       otherwise recent M5 swing low.
    */

    let structuralSL =
        a.M15.sr.support1;


    if (
        !structuralSL ||
        structuralSL >= entry
    ) {

        const lows =
            getSwingLevels(
                marketData.m5,
                30
            ).swingLows;

        structuralSL =
            lows.length
                ? lows[lows.length - 1]
                : entry - 0.0010;
    }


    /*
       Add a small safety buffer.
    */

    let sl =
        structuralSL -
        0.00015;


    const risk =
        entry - sl;


    if (
        risk <= 0 ||
        risk > 0.0030
    ) {

        return null;
    }


    const tp1 =
        entry + risk;

    const tp2 =
        entry + risk * 2;

    const tp3 =
        entry + risk * 3;


    return {

        direction: "BUY",

        entry,

        sl,

        tp1,

        tp2,

        tp3,

        rr: "1:2 minimum",

        validity:
            "Valid while H4/H1 bullish structure remains intact",

        trigger:
            "H4 + H1 bullish bias, M15 bullish structure, M5 bullish breakout candle",

        invalidation:
            `M5 closes below ${roundPrice(sl)}`,

        verdict:
            "BUY — A+ price-action alignment"
    };
}


/* =========================================================
   SELL SETUP
   ========================================================= */

function calculateSellSetup(
    a,
    price
) {

    const higherBias =

        (
            a.H4.structure ===
            "BEARISH"
        ) &&

        (
            a.H1.structure ===
            "BEARISH"
        );


    const m15Confirmation =

        a.M15.structure ===
        "BEARISH";


    const m5Trigger =

        a.M5.structure ===
        "BEARISH" &&

        bearishCandleConfirmation(
            marketData.m5
        );


    const rsiOK =

        a.M5.rsi !== null &&

        a.M5.rsi >= 30 &&

        a.M5.rsi <= 55;


    if (
        !higherBias ||
        !m15Confirmation ||
        !m5Trigger ||
        !rsiOK
    ) {

        return null;
    }


    const entry =
        price;


    let structuralSL =
        a.M15.sr.resistance1;


    if (
        !structuralSL ||
        structuralSL <= entry
    ) {

        const highs =
            getSwingLevels(
                marketData.m5,
                30
            ).swingHighs;

        structuralSL =
            highs.length
                ? highs[highs.length - 1]
                : entry + 0.0010;
    }


    let sl =
        structuralSL +
        0.00015;


    const risk =
        sl - entry;


    if (
        risk <= 0 ||
        risk > 0.0030
    ) {

        return null;
    }


    const tp1 =
        entry - risk;

    const tp2 =
        entry - risk * 2;

    const tp3 =
        entry - risk * 3;


    return {

        direction: "SELL",

        entry,

        sl,

        tp1,

        tp2,

        tp3,

        rr: "1:2 minimum",

        validity:
            "Valid while H4/H1 bearish structure remains intact",

        trigger:
            "H4 + H1 bearish bias, M15 bearish structure, M5 bearish breakdown candle",

        invalidation:
            `M5 closes above ${roundPrice
