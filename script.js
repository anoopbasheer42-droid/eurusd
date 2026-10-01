/* =========================================================
   EUR/USD SNIPER DASHBOARD
   STAGE 1 — STRICT A+ ENGINE

   H4 → H1 → M15 → M5

   RULES:
   1. H4 establishes direction
   2. H1 MUST agree with H4
   3. M15 MUST agree with H4/H1
   4. M5 provides trigger
   5. Minimum 1:2 RR
   6. News gate remains CLOSED
   7. Conflicting timeframe = STAY OUT

   ========================================================= */


/* =========================================================
   CONFIG
   ========================================================= */

const API_KEY = "8908432b6c784bc49aad6ccf64845991";

const SYMBOL = "EUR/USD";

const REFRESH_MS = 900000; // 15 minutes

/*
   NEWS IS NOT CONNECTED YET.

   Keep this FALSE.

   The dashboard must NOT generate a live trade
   until the economic calendar is connected.
*/
const NEWS_CLEAR = false;


/*
   Minimum technical score.

   Maximum possible score:

   H4 = 2
   H1 = 2
   M15 = 2
   M5 = 1
   M5 trigger = 2
   RSI = 1
   M15 EMA = 1

   TOTAL = 11
*/
const MIN_SETUP_SCORE = 8;


/*
   Maximum acceptable price risk.

   0.0030 = 30 pips approximately.
*/
const MAX_RISK = 0.0030;


/*
   Small buffer beyond structural swing.
*/
const SL_BUFFER = 0.00015;


/*
   Minimum RR required.

   We will never approve a setup below this.
*/
const MIN_RR = 2;


/* =========================================================
   GLOBAL MARKET DATA
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


window.__dashboardLoading = false;


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

    return Number(value).toFixed(1);
}


/* =========================================================
   FETCH CANDLES
   ========================================================= */

async function getCandles(
    interval,
    outputsize = 100
) {

    const url =
        "https://api.twelvedata.com/time_series" +
        "?symbol=" +
        encodeURIComponent(SYMBOL) +
        "&interval=" +
        encodeURIComponent(interval) +
        "&outputsize=" +
        outputsize +
        "&timezone=Asia/Kolkata" +
        "&apikey=" +
        encodeURIComponent(API_KEY);


    console.log(
        "Requesting candles:",
        interval
    );


    const response =
        await fetch(url);


    if (!response.ok) {

        throw new Error(
            `${interval}: HTTP ${response.status}`
        );
    }


    const data =
        await response.json();


    console.log(
        interval,
        "API response:",
        data
    );


    if (
        data.status === "error"
    ) {

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
            `No ${interval} candle data received`
        );
    }


    const candles =
        data.values

            .map(c => ({

                datetime:
                    c.datetime,

                open:
                    num(c.open),

                high:
                    num(c.high),

                low:
                    num(c.low),

                close:
                    num(c.close),

                volume:
                    num(c.volume) || 0

            }))

            .filter(c =>

                c.open !== null &&
                c.high !== null &&
                c.low !== null &&
                c.close !== null

            )

            .reverse();


    if (!candles.length) {

        throw new Error(
            `No valid ${interval} candles`
        );
    }


    return candles;
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
                (sum, c) =>
                    sum + c.close,
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


    if (
        averageLoss === 0
    ) {

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
   CANDLE FUNCTIONS
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


function candleBody(candle) {

    if (!candle) {
        return 0;
    }


    return Math.abs(
        candle.close -
        candle.open
    );
}


function candleRange(candle) {

    if (!candle) {
        return 0;
    }


    return (
        candle.high -
        candle.low
    );
}


function candleStrength(candle) {

    const range =
        candleRange(candle);


    if (range <= 0) {
        return 0;
    }


    return (
        candleBody(candle) /
        range
    );
}


/* =========================================================
   SWINGS
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

    );
}


function getSwingLevels(
    candles,
    lookback = 80
) {

    if (
        !candles ||
        candles.length < 10
    ) {

        return {

            swingHighs: [],
            swingLows: []

        };
    }


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

    if (
        !levels ||
        !levels.length
    ) {

        return [];
    }


    const sorted =
        [...levels].sort(
            (a, b) => a - b
        );


    const clusters = [];


    for (
        const level of sorted
    ) {

        let found = null;


        for (
            const cluster of clusters
        ) {

            if (
                Math.abs(
                    level -
                    cluster.mean
                ) <= tolerance
            ) {

                cluster.values.push(
                    level
                );


                cluster.mean =
                    cluster.values.reduce(
                        (a, b) =>
                            a + b,
                        0
                    ) /
                    cluster.values.length;


                found =
                    cluster;

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
        highs[
            highs.length - 1
        ];


    const previousHigh =
        highs[
            highs.length - 2
        ];


    const lastLow =
        lows[
            lows.length - 1
        ];


    const previousLow =
        lows[
            lows.length - 2
        ];


    if (
        lastHigh > previousHigh &&
        lastLow > previousLow
    ) {

        return "BULLISH";
    }


    if (
        lastHigh < previousHigh &&
        lastLow < previousLow
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


    if (
        ema20 === null ||
        ema50 === null
    ) {

        return {

            text:
                "CALCULATING",

            ema20,
            ema50,
            ema200

        };
    }


    let text =
        "MIXED";


    if (
        ema20 > ema50 &&
        (
            ema200 === null ||
            ema50 > ema200
        )
    ) {

        text =
            "BULLISH";
    }


    else if (
        ema20 < ema50 &&
        (
            ema200 === null ||
            ema50 < ema200
        )
    ) {

        text =
            "BEARISH";
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

            candleStrength:
                0,

            rsi:
                null,

            ema: {

                text:
                    "CALCULATING"

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

        price:
            last.close,

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
   COMPLETE ANALYSIS
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
   STRICT TREND ALIGNMENT
   ========================================================= */

function isBullishAlignment(a) {

    return (

        a.H4.structure ===
        "BULLISH" &&

        a.H1.structure ===
        "BULLISH" &&

        a.M15.structure ===
        "BULLISH"

    );
}


function isBearishAlignment(a) {

    return (

        a.H4.structure ===
        "BEARISH" &&

        a.H1.structure ===
        "BEARISH" &&

        a.M15.structure ===
        "BEARISH"

    );
}


/* =========================================================
   M5 TRIGGER
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

        candleStrength(last) >=
        0.45

    );
}


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

        candleStrength(last) >=
        0.45

    );
}


/* =========================================================
   BUY SCORE
   ========================================================= */

function calculateBuyScore(a) {

    let score = 0;


    if (
        a.H4.structure ===
        "BULLISH"
    ) score += 2;


    if (
        a.H1.structure ===
        "BULLISH"
    ) score += 2;


    if (
        a.M15.structure ===
        "BULLISH"
    ) score += 2;


    if (
        a.M5.structure ===
        "BULLISH"
    ) score += 1;


    if (
        bullishCandleConfirmation(
            marketData.m5
        )
    ) score += 2;


    if (
        a.M5.rsi !== null &&
        a.M5.rsi >= 45 &&
        a.M5.rsi <= 70
    ) score += 1;


    if (
        a.M15.ema.text ===
        "BULLISH"
    ) score += 1;


    return score;
}


/* =========================================================
   SELL SCORE
   ========================================================= */

function calculateSellScore(a) {

    let score = 0;


    if (
        a.H4.structure ===
        "BEARISH"
    ) score += 2;


    if (
        a.H1.structure ===
        "BEARISH"
    ) score += 2;


    if (
        a.M15.structure ===
        "BEARISH"
    ) score += 2;


    if (
        a.M5.structure ===
        "BEARISH"
    ) score += 1;


    if (
        bearishCandleConfirmation(
            marketData.m5
        )
    ) score += 2;


    if (
        a.M5.rsi !== null &&
        a.M5.rsi >= 30 &&
        a.M5.rsi <= 55
    ) score += 1;


    if (
        a.M15.ema.text ===
        "BEARISH"
    ) score += 1;


    return score;
}


/* =========================================================
   BUILD BUY SETUP
   ========================================================= */

function calculateBuySetup(
    a,
    price
) {

    /*
       STRICT ALIGNMENT:

       H4 bullish
       H1 bullish
       M15 bullish
    */

    if (
        !isBullishAlignment(a)
    ) {

        return null;
    }


    /*
       M5 must actually trigger.
    */

    if (
        !bullishCandleConfirmation(
            marketData.m5
        )
    ) {

        return null;
    }


    /*
       M5 RSI filter.
    */

    if (
        a.M5.rsi === null ||
        a.M5.rsi < 45 ||
        a.M5.rsi > 70
    ) {

        return null;
    }


    const score =
        calculateBuyScore(a);


    if (
        score < MIN_SETUP_SCORE
    ) {

        return null;
    }


    const entry =
        price;


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


    const sl =
        structuralSL -
        SL_BUFFER;


    const risk =
        entry - sl;


    if (
        risk <= 0 ||
        risk > MAX_RISK
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

        direction:
            "BUY",

        entry,

        sl,

        tp1,

        tp2,

        tp3,

        score,

        rr:
            "1:3",

        validity:
            "Valid while H4/H1/M15 bullish structure remains intact",

        trigger:
            "H4 bullish + H1 bullish + M15 bullish → M5 bullish breakout",

        invalidation:
            `M5 closes below ${roundPrice(sl)}`,

        verdict:
            "BUY — A+ TECHNICAL ALIGNMENT"

    };
}


/* =========================================================
   BUILD SELL SETUP
   ========================================================= */

function calculateSellSetup(
    a,
    price
) {

    /*
       STRICT ALIGNMENT:

       H4 bearish
       H1 bearish
       M15 bearish
    */

    if (
        !isBearishAlignment(a)
    ) {

        return null;
    }


    /*
       M5 must actually trigger.
    */

    if (
        !bearishCandleConfirmation(
            marketData.m5
        )
    ) {

        return null;
    }


    /*
       M5 RSI filter.
    */

    if (
        a.M5.rsi === null ||
        a.M5.rsi < 30 ||
        a.M5.rsi > 55
    ) {

        return null;
    }


    const score =
        calculateSellScore(a);


    if (
        score < MIN_SETUP_SCORE
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


    const sl =
        structuralSL +
        SL_BUFFER;


    const risk =
        sl - entry;


    if (
        risk <= 0 ||
        risk > MAX_RISK
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

        direction:
            "SELL",

        entry,

        sl,

        tp1,

        tp2,

        tp3,

        score,

        rr:
            "1:3",

        validity:
            "Valid while H4/H1/M15 bearish structure remains intact",

        trigger:
            "H4 bearish + H1 bearish + M15 bearish → M5 bearish breakdown",

        invalidation:
            `M5 closes above ${roundPrice(sl)}`,

        verdict:
            "SELL — A+ TECHNICAL ALIGNMENT"

    };
}


/* =========================================================
   FINAL SNIPER ENGINE
   ========================================================= */

function calculateSniperSetup(
    analysis,
    price
) {

    const buyScore =
        calculateBuyScore(
            analysis
        );


    const sellScore =
        calculateSellScore(
            analysis
        );


    const highestScore =
        Math.max(
            buyScore,
            sellScore
        );


    /*
       NEWS SAFETY GATE

       This ALWAYS comes first.
    */

    if (!NEWS_CLEAR) {

        let reason =
            "Trading blocked until real economic news is checked.";


        if (
            analysis.H4.structure !==
            analysis.H1.structure
        ) {

            reason =
                "H4/H1 conflict detected. News filter is also closed.";

        }


        return {

            direction:
                "WAIT",

            entry: null,
            sl: null,
            tp1: null,
            tp2: null,
            tp3: null,

            rr: null,

            score:
                highestScore,

            validity:
                reason,

            trigger:
                "H4/H1 direction → M15 confirmation → M5 trigger → news clearance",

            invalidation:
                "No trade while NEWS FILTER is CLOSED",

            verdict:
                "WAIT — NEWS FILTER NOT CONFIRMED"

        };
    }


    /*
       If news is eventually cleared,
       use the strict technical engine.
    */

    const buy =
        calculateBuySetup(
            analysis,
            price
        );


    const sell =
        calculateSellSetup(
            analysis,
            price
        );


    if (
        buy &&
        sell
    ) {

        return buy.score >= sell.score
            ? buy
            : sell;
    }


    if (buy) {
        return buy;
    }


    if (sell) {
        return sell;
    }


    /*
       Explain the main reason for WAIT.
    */

    let reason =
        "No A+ multi-timeframe alignment.";


    if (
        analysis.H4.structure !==
        analysis.H1.structure
    ) {

        reason =
            "H4/H1 conflict — higher-timeframe direction is not aligned.";
    }

    else if (
        analysis.M15.structure !==
        analysis.H4.structure
    ) {

        reason =
            "M15 does not confirm the H4/H1 direction.";
    }

    else if (
        analysis.M5.structure ===
        "RANGE"
    ) {

        reason =
            "M5 is ranging — waiting for sniper trigger.";
    }


    return {

        direction:
            "WAIT",

        entry: null,
        sl: null,
        tp1: null,
        tp2: null,
        tp3: null,

        rr: null,

        score:
            highestScore,

        validity:
            reason,

        trigger:
            "Wait for H4/H1 direction → M15 confirmation → M5 trigger",

        invalidation:
            "—",

        verdict:
            "WAIT — NO A+ MULTI-TIMEFRAME ALIGNMENT"

    };
}


/* =========================================================
   PRICE UI
   ========================================================= */

function updatePriceUI(price) {

    setTextAny(
        [
            "price",
            "livePrice",
            "currentPrice",
            "live-price"
        ],
        roundPrice(price)
    );


    setTextAny(
        [
            "priceStatus",
            "trend",
            "status",
            "marketStatus"
        ],
        "MARKET DATA LOADED"
    );
}


/* =========================================================
   STRUCTURE UI
   ========================================================= */

function updateStructureUI(a) {

    setTextAny(
        "h4Trend",
        a.H4.structure
    );


    setTextAny(
        "h1Trend",
        a.H1.structure
    );


    setTextAny(
        "m15Structure",
        a.M15.structure
    );


    setTextAny(
        "m5Structure",
        a.M5.structure
    );
}


/* =========================================================
   SUPPORT / RESISTANCE UI
   ========================================================= */

function updateSRUI(a) {

    const sr =
        a.H1.sr;


    setTextAny(
        "resistance1",
        roundPrice(
            sr.resistance1
        )
    );


    setTextAny(
        "resistance2",
        roundPrice(
            sr.resistance2
        )
    );


    setTextAny(
        "support1",
        roundPrice(
            sr.support1
        )
    );


    setTextAny(
        "support2",
        roundPrice(
            sr.support2
        )
    );
}


/* =========================================================
   INDICATOR UI
   ========================================================= */

function updateIndicatorsUI(a) {

    setTextAny(
        "h4Rsi",
        roundRSI(
            a.H4.rsi
        )
    );


    setTextAny(
        "h1Rsi",
        roundRSI(
            a.H1.rsi
        )
    );


    setTextAny(
        "m15Rsi",
        roundRSI(
            a.M15.rsi
        )
    );


    setTextAny(
        "m5Rsi",
        roundRSI(
            a.M5.rsi
        )
    );


    /*
       Use H1 EMA as the main dashboard EMA direction.
    */

    setTextAny(
        "emaStructure",
        a.H1.ema.text
    );
}


/* =========================================================
   NEWS UI
   ========================================================= */

function updateNewsUI() {

    /*
       IMPORTANT:

       This is intentionally NOT pretending
       that we have real calendar data.

       Until a real calendar backend is connected,
       NEWS_CLEAR remains false.
    */

    setTextAny(
        "eurNews",
        "NOT CONNECTED"
    );


    setTextAny(
        "usdNews",
        "NOT CONNECTED"
    );


    setTextAny(
        "newsFilter",
        "NEWS CHECK REQUIRED"
    );


    setTextAny(
        "nextEvent",
        "Economic calendar required"
    );


    setTextAny(
        "tradingRisk",
        "HIGH — NEWS FILTER CLOSED"
    );
}


/* =========================================================
   SNIPER UI
   ========================================================= */

function updateSniperUI(setup) {

    setTextAny(
        "sniperVerdict",
        setup.verdict
    );


    setTextAny(
        "direction",
        setup.direction
    );


    setTextAny(
        "entry",
        roundPrice(
            setup.entry
        )
    );


    setTextAny(
        "stopLoss",
        roundPrice(
            setup.sl
        )
    );


    setTextAny(
        "tp1",
        roundPrice(
            setup.tp1
        )
    );


    setTextAny(
        "tp2",
        roundPrice(
            setup.tp2
        )
    );


    setTextAny(
        "tp3",
        roundPrice(
            setup.tp3
        )
    );


    setTextAny(
        "riskReward",
        setup.rr || "—"
    );


    setTextAny(
        "validity",
        setup.validity
    );


    setTextAny(
        "trigger",
        setup.trigger
    );


    setTextAny(
        "invalidation",
        setup.invalidation
    );


    /*
       FIX:
       Your HTML already has Setup Score.
       The previous script was not updating it.
    */

    setTextAny(
        "setupScore",
        `${setup.score ?? 0} / 11`
    );
}


/* =========================================================
   PRO VERDICT
   ========================================================= */

function updateProVerdictUI(
    setup,
    analysis
) {

    setTextAny(
        "proVerdict",
        setup.verdict
    );


    if (
        analysis.H4.structure !==
        analysis.H1.structure
    ) {

        setTextAny(
            "proExplanation",
            `STAY OUT — H4 is ${analysis.H4.structure} while H1 is ${analysis.H1.structure}. Higher-timeframe conflict.`
        );

        return;
    }


    if (
        analysis.M15.structure !==
        analysis.H4.structure
    ) {

        setTextAny(
            "proExplanation",
            `STAY OUT — M15 (${analysis.M15.structure}) does not confirm the H4/H1 direction.`
        );

        return;
    }


    if (
        analysis.M5.structure ===
        "RANGE"
    ) {

        setTextAny(
            "proExplanation",
            "WAIT — H4/H1/M15 are aligned, but M5 is ranging. Wait for the sniper trigger."
        );

        return;
    }


    if (!NEWS_CLEAR) {

        setTextAny(
            "proExplanation",
            "Technical analysis is running, but trading remains blocked until the real economic news filter is connected."
        );

        return;
    }


    setTextAny(
        "proExplanation",
        setup.verdict
    );
}


/* =========================================================
   TIMESTAMP
   ========================================================= */

function updateTimestamp() {

    const now =
        new Date();


    const text =
        now.toLocaleString(
            "en-IN",
            {
                timeZone:
                    "Asia/Kolkata",

                day:
                    "2-digit",

                month:
                    "2-digit",

                year:
                    "numeric",

                hour:
                    "2-digit",

                minute:
                    "2-digit",

                second:
                    "2-digit",

                hour12:
                    false
            }
        );


    setTextAny(
        [
            "lastUpdate",
            "updateTime"
        ],
        `Updated: ${text} IST`
    );
}


/* =========================================================
   ERROR HANDLER
   ========================================================= */

function showDashboardError(
    error
) {

    console.error(
        "EUR/USD DASHBOARD ERROR:",
        error
    );


    const message =
        error &&
        error.message
            ? error.message
            : String(error);


    setTextAny(
        [
            "priceStatus",
            "trend",
            "status",
            "marketStatus"
        ],
        `ERROR: ${message}`
    );


    setTextAny(
        "sniperVerdict",
        "WAIT — MARKET DATA ERROR"
    );


    setTextAny(
        "proVerdict",
        "WAIT — DATA ERROR"
    );


    setTextAny(
        "proExplanation",
        message
    );
}


/* =========================================================
   LOAD MARKET DATA
   ========================================================= */

async function loadMarketData() {

    if (
        window.__dashboardLoading
    ) {

        return;
    }


    window.__dashboardLoading =
        true;


    setTextAny(
        [
            "priceStatus",
            "trend",
            "status",
            "marketStatus"
        ],
        "CONNECTING TO MARKET DATA..."
    );


    try {

        console.log(
            "================================="
        );

        console.log(
            "EUR/USD SNIPER UPDATE START"
        );

        console.log(
            "================================="
        );


        /*
           Fetch all four timeframes.
        */

        const h4 =
            await getCandles(
                "4h",
                100
            );


        const h1 =
            await getCandles(
                "1h",
                100
            );


        const m15 =
            await getCandles(
                "15min",
                100
            );


        const m5 =
            await getCandles(
                "5min",
                100
            );


        /*
           Store data.
        */

        marketData.h4 =
            h4;

        marketData.h1 =
            h1;

        marketData.m15 =
            m15;

        marketData.m5 =
            m5;


        /*
           Latest M5 close.
        */

        marketData.price =
            m5[
                m5.length - 1
            ].close;


        marketData.lastUpdate =
            new Date();


        /*
           Build analysis.
        */

        const analysis =
            buildAnalysis();


        console.log(
            "H4:",
            analysis.H4
        );


        console.log(
            "H1:",
            analysis.H1
        );


        console.log(
            "M15:",
            analysis.M15
        );


        console.log(
            "M5:",
            analysis.M5
        );


        /*
           Build sniper setup.
        */

        const setup =
            calculateSniperSetup(
                analysis,
                marketData.price
            );


        console.log(
            "FINAL SETUP:",
            setup
        );


        /*
           Update dashboard.
        */

        updatePriceUI(
            marketData.price
        );


        updateStructureUI(
            analysis
        );


        updateSRUI(
            analysis
        );


        updateIndicatorsUI(
            analysis
        );


        updateNewsUI();


        updateSniperUI(
            setup
        );


        updateProVerdictUI(
            setup,
            analysis
        );


        updateTimestamp();


        /*
           Final status.
        */

        setTextAny(
            [
                "priceStatus",
                "trend",
                "status",
                "marketStatus"
            ],
            "MARKET DATA LOADED"
        );


        console.log(
            "EUR/USD SNIPER UPDATE COMPLETE"
        );

    }


    catch (error) {

        marketData.apiError =
            error;


        showDashboardError(
            error
        );

    }


    finally {

        window.__dashboardLoading =
            false;
    }
}


/* =========================================================
   START DASHBOARD
   ========================================================= */

function startDashboard() {

    console.log(
        "EUR/USD SNIPER DASHBOARD STARTING..."
    );


    /*
       First load.
    */

    loadMarketData();


    /*
       Automatic refresh every 15 minutes.
    */

    setInterval(
        loadMarketData,
        REFRESH_MS
    );
}


/* =========================================================
   START
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        startDashboard
    );

} else {

    startDashboard();
}
