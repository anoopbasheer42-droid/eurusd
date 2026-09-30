/* =========================================================
   EUR/USD SNIPER DASHBOARD
   H4 → H1 → M15 → M5 ANALYSIS ENGINE
   VERSION: S/R ENGINE
   ========================================================= */

const API_KEY = "8908432b6c784bc49aad6ccf64845991";

const REFRESH_MS = 60000;


/* =========================================================
   GLOBAL MARKET DATA
   ========================================================= */

let marketData = {
    h4: [],
    h1: [],
    m15: [],
    m5: [],
    price: null
};


/* =========================================================
   HELPERS
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


/* =========================================================
   LIVE PRICE
   ========================================================= */

async function getLivePrice() {

    const url =
        `https://api.twelvedata.com/price` +
        `?symbol=EUR/USD` +
        `&apikey=${API_KEY}`;

    const response = await fetch(url);

    const data = await response.json();

    if (data.status === "error") {
        throw new Error(data.message);
    }

    const price = num(data.price);

    if (price === null) {
        throw new Error("Invalid EUR/USD price");
    }

    return price;
}


/* =========================================================
   CANDLE DATA
   ========================================================= */

async function getCandles(interval, outputsize = 200) {

    const url =
        `https://api.twelvedata.com/time_series` +
        `?symbol=EUR/USD` +
        `&interval=${interval}` +
        `&outputsize=${outputsize}` +
        `&timezone=Asia/Kolkata` +
        `&apikey=${API_KEY}`;

    const response = await fetch(url);

    const data = await response.json();

    if (data.status === "error") {
        throw new Error(data.message);
    }

    if (!data.values || !Array.isArray(data.values)) {
        throw new Error(`No ${interval} candle data`);
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
            ((candles[i].close - ema) * multiplier)
            + ema;
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
                averageGain * (period - 1)
                + gain
            ) / period;


        averageLoss =
            (
                averageLoss * (period - 1)
                + loss
            ) / period;
    }


    if (averageLoss === 0) {
        return 100;
    }


    const rs =
        averageGain / averageLoss;


    return 100 -
        (100 / (1 + rs));
}


/* =========================================================
   SWING DETECTION
   ========================================================= */

function isSwingHigh(
    candles,
    index,
    strength = 2
) {

    if (
        index < strength ||
        index >= candles.length - strength
    ) {
        return false;
    }


    const current =
        candles[index].high;


    for (
        let i = 1;
        i <= strength;
        i++
    ) {

        if (
            current <=
            candles[index - i].high
        ) {
            return false;
        }


        if (
            current <=
            candles[index + i].high
        ) {
            return false;
        }
    }


    return true;
}


function isSwingLow(
    candles,
    index,
    strength = 2
) {

    if (
        index < strength ||
        index >= candles.length - strength
    ) {
        return false;
    }


    const current =
        candles[index].low;


    for (
        let i = 1;
        i <= strength;
        i++
    ) {

        if (
            current >=
            candles[index - i].low
        ) {
            return false;
        }


        if (
            current >=
            candles[index + i].low
        ) {
            return false;
        }
    }


    return true;
}


/* =========================================================
   GET SWING LEVELS
   ========================================================= */

function getSwingLevels(candles) {

    const highs = [];

    const lows = [];


    const start =
        Math.max(
            2,
            candles.length - 120
        );


    for (
        let i = start;
        i < candles.length - 2;
        i++
    ) {

        if (
            isSwingHigh(
                candles,
                i,
                2
            )
        ) {

            highs.push(
                candles[i].high
            );
        }


        if (
            isSwingLow(
                candles,
                i,
                2
            )
        ) {

            lows.push(
                candles[i].low
            );
        }
    }


    return {
        highs,
        lows
    };
}


/* =========================================================
   CLUSTER NEARBY LEVELS
   ========================================================= */

function clusterLevels(
    levels,
    tolerance = 0.00035
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

        let placed = false;


        for (const cluster of clusters) {

            const average =
                cluster.reduce(
                    (a, b) => a + b,
                    0
                ) / cluster.length;


            if (
                Math.abs(
                    level - average
                ) <= tolerance
            ) {

                cluster.push(level);

                placed = true;

                break;
            }
        }


        if (!placed) {

            clusters.push([level]);
        }
    }


    return clusters.map(
        cluster =>
            cluster.reduce(
                (a, b) => a + b,
                0
            ) / cluster.length
    );
}


/* =========================================================
   PRO SUPPORT / RESISTANCE
   ========================================================= */

function calculateSupportResistance(
    candles
) {

    if (!candles || candles.length < 30) {

        return {
            resistance1: null,
            resistance2: null,
            support1: null,
            support2: null
        };
    }


    const current =
        candles[candles.length - 1].close;


    const swings =
        getSwingLevels(candles);


    /*
     * Cluster swing highs/lows.
     * This prevents one random wick from
     * becoming a major level.
     */

    let resistanceLevels =
        clusterLevels(
            swings.highs,
            0.00035
        );


    let supportLevels =
        clusterLevels(
            swings.lows,
            0.00035
        );


    /*
     * Only keep levels on the correct
     * side of current price.
     */

    resistanceLevels =
        resistanceLevels
            .filter(
                level =>
                    level > current
            )
            .sort(
                (a, b) => a - b
            );


    supportLevels =
        supportLevels
            .filter(
                level =>
                    level < current
            )
            .sort(
                (a, b) => b - a
            );


    /*
     * Fallback to recent extreme levels.
     */

    const recent =
        candles.slice(-80);


    const recentHigh =
        Math.max(
            ...recent.map(
                c => c.high
            )
        );


    const recentLow =
        Math.min(
            ...recent.map(
                c => c.low
            )
        );


    if (
        resistanceLevels.length === 0 &&
        recentHigh > current
    ) {

        resistanceLevels.push(
            recentHigh
        );
    }


    if (
        supportLevels.length === 0 &&
        recentLow < current
    ) {

        supportLevels.push(
            recentLow
        );
    }


    /*
     * If only one level exists,
     * search the wider range.
     */

    if (
        resistanceLevels.length < 2
    ) {

        const extra =
            recent
                .map(c => c.high)
                .filter(
                    h =>
                        h > current &&
                        !resistanceLevels.some(
                            r =>
                                Math.abs(
                                    r - h
                                ) < 0.00020
                        )
                )
                .sort(
                    (a, b) => a - b
                );


        for (const level of extra) {

            if (
                resistanceLevels.length >= 2
            ) {
                break;
            }

            resistanceLevels.push(level);
        }
    }


    if (
        supportLevels.length < 2
    ) {

        const extra =
            recent
                .map(c => c.low)
                .filter(
                    l =>
                        l < current &&
                        !supportLevels.some(
                            s =>
                                Math.abs(
                                    s - l
                                ) < 0.00020
                        )
                )
                .sort(
                    (a, b) => b - a
                );


        for (const level of extra) {

            if (
                supportLevels.length >= 2
            ) {
                break;
            }

            supportLevels.push(level);
        }
    }


    return {

        resistance1:
            resistanceLevels[0] || null,

        resistance2:
            resistanceLevels[1] || null,

        support1:
            supportLevels[0] || null,

        support2:
            supportLevels[1] || null
    };
}


/* =========================================================
   MARKET STRUCTURE
   ========================================================= */

function calculateStructure(
    candles
) {

    if (candles.length < 30) {
        return "INSUFFICIENT DATA";
    }


    const recent =
        candles.slice(-10);


    const previous =
        candles.slice(-20, -10);


    const recentHigh =
        Math.max(
            ...recent.map(
                c => c.high
            )
        );


    const previousHigh =
        Math.max(
            ...previous.map(
                c => c.high
            )
        );


    const recentLow =
        Math.min(
            ...recent.map(
                c => c.low
            )
        );


    const previousLow =
        Math.min(
            ...previous.map(
                c => c.low
            )
        );


    if (
        recentHigh > previousHigh &&
        recentLow > previousLow
    ) {

        return "BULLISH";
    }


    if (
        recentHigh < previousHigh &&
        recentLow < previousLow
    ) {

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


    if (!ema20 || !ema50) {

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
        (!ema200 || ema50 > ema200)
    ) {

        text =
            "Bullish EMA alignment";

    }

    else if (
        ema20 < ema50 &&
        (!ema200 || ema50 < ema200)
    ) {

        text =
            "Bearish EMA alignment";

    }

    else {

        text =
            "EMA compression / mixed";
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

    const last =
        candles[candles.length - 1];


    const structure =
        calculateStructure(
            candles
        );


    const rsi =
        calculateRSI(
            candles
        );


    const ema =
        getEMAAnalysis(
            candles
        );


    const sr =
        calculateSupportResistance(
            candles
        );


    return {

        price:
            last.close,

        structure,

        rsi,

        ema,

        sr
    };
}


/* =========================================================
   BUILD MTF ANALYSIS
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
   SNIPER ENGINE
   ========================================================= */

function calculateSniperSetup(
    a
) {

    const price =
        marketData.price;


    const bullishHigherTF =
        a.H4.structure === "BULLISH" &&
        a.H1.structure === "BULLISH";


    const bearishHigherTF =
        a.H4.structure === "BEARISH" &&
        a.H1.structure === "BEARISH";


    const bullishEntry =
        a.M15.structure === "BULLISH" &&
        a.M5.structure === "BULLISH" &&
        a.M5.rsi !== null &&
        a.M5.rsi >= 45 &&
        a.M5.rsi <= 65;


    const bearishEntry =
        a.M15.structure === "BEARISH" &&
        a.M5.structure === "BEARISH" &&
        a.M5.rsi !== null &&
        a.M5.rsi >= 35 &&
        a.M5.rsi <= 55;


    /* ================= BUY ================= */

    if (
        bullishHigherTF &&
        bullishEntry
    ) {

        const entry =
            a.M15.sr.support1 ||
            price;


        const sl =
            entry - 0.0010;


        const risk =
            entry - sl;


        return {

            direction: "BUY",

            entry,

            sl,

            tp1:
                entry + risk,

            tp2:
                entry + risk * 2,

            tp3:
                entry + risk * 3,

            rr:
                "1:2 minimum",

            validity:
                "1–3 hours",

            trigger:
                "M5 bullish structure + M15 confirmation",

            invalidation:
                `M5 close below ${roundPrice(sl)}`,

            verdict:
                "BUY — A+ conditions detected"
        };
    }


    /* ================= SELL ================= */

    if (
        bearishHigherTF &&
        bearishEntry
    ) {

        const entry =
           
