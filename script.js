/* =========================================================
   EUR/USD SNIPER DASHBOARD
   H4 → H1 → M15 → M5

   PRICE ACTION
   MARKET STRUCTURE
   SUPPORT / RESISTANCE
   EMA
   RSI
   BUY / SELL SNIPER ENGINE
   NEWS SAFETY GATE

   IMPORTANT:
   - Twelve Data free plan has a daily API limit.
   - We therefore refresh the four timeframes every 15 minutes.
   - TradingView chart remains independent/live.
   ========================================================= */


/* =========================================================
   CONFIGURATION
   ========================================================= */

const API_KEY = "8908432b6c784bc49aad6ccf64845991";

const SYMBOL = "EUR/USD";

/*
   15 minutes.

   Four timeframe requests every 15 minutes:

   H4
   H1
   M15
   M5

   ≈ 384 requests/day if running continuously.

   This is intentionally below the Twelve Data
   free 800-request/day limit.
*/
const REFRESH_MS = 900000;


/*
   NEWS SAFETY GATE

   IMPORTANT:

   The script does NOT pretend to know that news is clear.

   Set this to true ONLY after you have checked the
   current economic calendar and there is no high-impact
   EUR/USD event immediately around the trade.

   false = NO TRADE
   true  = news gate open
*/
const NEWS_CLEAR = false;


/*
   Minimum setup score.

   We use a score rather than allowing one candle
   to create an instant trade.
*/
const MIN_SETUP_SCORE = 8;


/*
   Maximum acceptable structural risk.

   0.0030 = 30 pips.
*/
const MAX_RISK = 0.0030;


/*
   Small structural buffer around SL.

   0.00015 = 1.5 pips.
*/
const SL_BUFFER = 0.00015;


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


/* =========================================================
   DOM HELPERS
   ========================================================= */


/*
   Some versions of the dashboard may use slightly
   different element IDs.

   This helper tries multiple IDs.
*/

function setTextAny(ids, value) {

    if (!Array.isArray(ids)) {
        ids = [ids];
    }

    for (const id of ids) {

        const el =
            document.getElementById(id);

        if (el) {

            el.innerText =
                value;

            return true;
        }
    }

    return false;
}


/*
   Safe numeric conversion.
*/

function num(value) {

    const n =
        Number(value);

    return Number.isFinite(n)
        ? n
        : null;
}


/*
   Format EUR/USD price.
*/

function roundPrice(value) {

    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(Number(value))
    ) {

        return "—";
    }

    return Number(value)
        .toFixed(5);
}


/*
   Format RSI.
*/

function roundRSI(value) {

    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(Number(value))
    ) {

        return "—";
    }

    return Number(value)
        .toFixed(2);
}


/* =========================================================
   API ERROR
   ========================================================= */

function apiErrorMessage(error) {

    if (!error) {
        return "Unknown API error";
    }

    return error.message ||
        String(error);
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


    /*
       Handle HTTP errors.
    */

    if (!response.ok) {

        if (response.status === 429) {

            throw new Error(
                `${interval} HTTP 429 — Twelve Data API limit reached`
            );
        }

        throw new Error(
            `${interval} HTTP ${response.status}`
        );
    }


    const data =
        await response.json();


    /*
       Handle Twelve Data API errors.
    */

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
            `No ${interval} candle data returned`
        );
    }


    return data.values

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
   CANDLE DIRECTION
   ========================================================= */

function candleDirection(
    candle
) {

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

function candleBody(
    candle
) {

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

function candleRange(
    candle
) {

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

function candleStrength(
    candle
) {

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

    );
}


/* =========================================================
   FIND SWING LEVELS
   ========================================================= */

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
                        (a, b) => a + b,
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


    /*
       Fallback resistance.
    */

    if (
        !resistances.length
    ) {

        const recentHigh =
            Math.max(
                ...candles
                    .slice(-40)
                    .map(
                        c => c.high
                    )
            );


        if (
            recentHigh > current
        ) {

            resistances.push(
                recentHigh
            );
        }
    }


    /*
       Fallback support.
    */

    if (
        !supports.length
    ) {

        const recentLow =
            Math.min(
                ...candles
                    .slice(-40)
                    .map(
                        c => c.low
                    )
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
            resistances[0] ??
            null,

        resistance2:
            resistances[1] ??
            null,

        support1:
            supports[0] ??
            null,

        support2:
            supports[1] ??
            null

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


    const bullishStructure =

        lastHigh >
        previousHigh &&

        lastLow >
        previousLow;


    const bearishStructure =

        lastHigh <
        previousHigh &&

        lastLow <
        previousLow;


    if (
        bullishStructure
    ) {

        return "BULLISH";
    }


    if (
        bearishStructure
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
                "Calculating...",

            ema20,
            ema50,
            ema200

        };
    }


    let text =
        "EMA mixed / transition";


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

                text:
                    "Calculating..."

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
   BULLISH CANDLE CONFIRMATION
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

        candleStrength(last) >=
        0.45

    );
}


/* =========================================================
   BUY SCORE
   ========================================================= */

function calculateBuyScore(
    a
) {

    let score = 0;


    /*
       H4 structure.
    */

    if (
        a.H4.structure ===
        "BULLISH"
    ) {

        score += 2;
    }


    /*
       H1 structure.
    */

    if (
        a.H1.structure ===
        "BULLISH"
    ) {

        score += 2;
    }


    /*
       M15 structure.
    */

    if (
        a.M15.structure ===
        "BULLISH"
    ) {

        score += 2;
    }


    /*
       M5 structure.
    */

    if (
        a.M5.structure ===
        "BULLISH"
    ) {

        score += 1;
    }


    /*
       M5 candle confirmation.
    */

    if (
        bullishCandleConfirmation(
            marketData.m5
        )
    ) {

        score += 2;
    }


    /*
       RSI momentum.
    */

    if (
        a.M5.rsi !== null &&
        a.M5.rsi >= 45 &&
        a.M5.rsi <= 70
    ) {

        score += 1;
    }


    /*
       EMA alignment.
    */

    if (
        a.M15.ema.text ===
        "Bullish EMA alignment"
    ) {

        score += 1;
    }


    return score;
}


/* =========================================================
   SELL SCORE
   ========================================================= */

function calculateSellScore(
    a
) {

    let score = 0;


    if (
        a.H4.structure ===
        "BEARISH"
    ) {

        score += 2;
    }


    if (
        a.H1.structure ===
        "BEARISH"
    ) {

        score += 2;
    }


    if (
        a.M15.structure ===
        "BEARISH"
    ) {

        score += 2;
    }


    if (
        a.M5.structure ===
        "BEARISH"
    ) {

        score += 1;
    }


    if (
        bearishCandleConfirmation(
            marketData.m5
        )
    ) {

        score += 2;
    }


    if (
        a.M5.rsi !== null &&
        a.M5.rsi >= 30 &&
        a.M5.rsi <= 55
    ) {

        score += 1;
    }


    if (
        a.M15.ema.text ===
        "Bearish EMA alignment"
    ) {

        score += 1;
    }


    return score;
}


/* =========================================================
   BUY SETUP
   ========================================================= */

function calculateBuySetup(
    a,
    price
) {

    const score =
        calculateBuyScore(a);


    /*
       News gate.
    */

    if (!NEWS_CLEAR) {

        return {

            blocked: true,

            direction:
                "WAIT",

            reason:
                "News filter is not confirmed",

            score

        };
    }


    if (
        score <
        MIN_SETUP_SCORE
    ) {

        return null;
    }


    /*
       Higher timeframe direction.
    */

    if (
        a.H4.structure !==
        "BULLISH" ||
        a.H1.structure !==
        "BULLISH"
    ) {

        return null;
    }


    /*
       M15 confirmation.
    */

    if (
        a.M15.structure !==
        "BULLISH"
    ) {

        return null;
    }


    /*
       M5 trigger.
    */

    if (
        a.M5.structure !==
        "BULLISH" ||
        !bullishCandleConfirmation(
            marketData.m5
        )
    ) {

        return null;
    }


    /*
       RSI.
    */

    if (
        a.M5.rsi === null ||
        a.M5.rsi < 45 ||
        a.M5.rsi > 70
    ) {

        return null;
    }


    const entry =
        price;


    /*
       Structural SL from M15.
    */

    let structuralSL =
        a.M15.sr.support1;


    /*
       Fallback to M5 swing low.
    */

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

        blocked: false,

        direction:
            "BUY",

        entry,

        sl,

        tp1,

        tp2,

        tp3,

        score,

        rr:
            "1:3 potential",

        validity:
            "Valid while H4/H1 bullish structure remains intact",

        trigger:
            "H4 + H1 bullish structure → M15 confirmation → M5 bullish breakout candle",

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

    const score =
        calculateSellScore(a);


    /*
       News gate.
    */

    if (!NEWS_CLEAR) {

        return {

            blocked: true,

            direction:
                "WAIT",

            reason:
                "News filter is not confirmed",

            score

        };
    }


    if (
        score <
        MIN_SETUP_SCORE
    ) {

        return null;
    }


    /*
       Higher timeframe direction.
    */

    if (
        a.H4.structure !==
        "BEARISH" ||
        a.H1.structure !==
        "BEARISH"
    ) {

        return null;
    }


    /*
       M15 confirmation.
    */

    if (
        a.M15.structure !==
        "BEARISH"
    ) {

        return null;
    }


    /*
       M5 trigger.
    */

    if (
        a.M5.structure !==
        "BEARISH" ||
        !bearishCandleConfirmation(
            marketData.m5
        )
    ) {

        return null;
    }


    /*
       RSI.
    */

    if (
        a.M5.rsi === null ||
        a.M5.rsi < 30 ||
        a.M5.rsi > 55
    ) {

        return null;
    }


    const entry =
        price;


    /*
       Structural SL from M15.
    */

    let structuralSL =
        a.M15.sr.resistance1;


    /*
       Fallback to M5 swing high.
    */

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

        blocked: false,

        direction:
            "SELL",

        entry,

        sl,

        tp1,

        tp2,

        tp3,

        score,

        rr:
            "1:3 potential",

        validity:
            "Valid while H4/H1 bearish structure remains intact",

        trigger:
            "H4 + H1 bearish structure → M15 confirmation → M5 bearish breakdown candle",

        invalidation:
            `M5 closes above ${roundPrice(sl)}`,

        verdict:
            "SELL — A+ price-action alignment"

    };
}


/* =========================================================
   CHOOSE BEST SETUP
   ========================================================= */

function calculateSniperSetup(
    analysis,
    price
) {

    /*
       News gate has priority.
    */

    if (!NEWS_CLEAR) {

        return {

            direction:
                "WAIT",

            entry: null,

            sl: null,

            tp1: null,

            tp2: null,

            tp3: null,

            rr: null,

            validity:
                "Trading blocked until news is checked",

            trigger:
                "Check current EUR/USD economic calendar before enabling the setup",

            invalidation:
                "No trade while news status is unknown",

            verdict:
                "WAIT — NEWS FILTER NOT CONFIRMED",

            score: 0

        };
    }


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
        !buy.blocked
    ) {

        return buy;
    }


    if (
        sell &&
        !sell.blocked
    ) {

        return sell;
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

        validity:
            "No valid A+ setup currently",

        trigger:
            "Wait for H4/H1 direction + M15 confirmation + M5 trigger",

        invalidation:
            "—",

        verdict:
            "WAIT — NO A+ ALIGNMENT",

        score: 0

    };
}


/* =========================================================
   UPDATE MARKET STRUCTURE
   ========================================================= */

function updateStructureUI(
    a
) {

    setTextAny(
        [
            "h4Trend",
            "h4Structure"
        ],
        a.H4.structure
    );


    setTextAny(
        [
            "h1Trend",
            "h1Structure"
        ],
        a.H1.structure
    );


    setTextAny(
        [
            "m15Structure"
        ],
        a.M15.structure
    );


    setTextAny(
        [
            "m5Structure"
        ],
        a.M5.structure
    );
}


/* =========================================================
   UPDATE SUPPORT / RESISTANCE
   ========================================================= */

function updateSRUI(
    a
) {

    /*
       Use H1 S/R as the dashboard's main
       intraday support/resistance.
    */

    const sr =
        a.H1.sr;


    setTextAny(
        [
            "resistance1",
            "r1"
        ],
        roundPrice(
            sr.resistance1
        )
    );


    setTextAny(
        [
            "resistance2",
            "r2"
        ],
        roundPrice(
            sr.resistance2
        )
    );


    setTextAny(
        [
            "support1",
            "s1"
        ],
        roundPrice(
            sr.support1
        )
    );


    setTextAny(
        [
            "support2",
            "s2"
        ],
        roundPrice(
            sr.support2
        )
    );
}


/* =========================================================
   UPDATE INDICATORS
   ========================================================= */

function updateIndicatorsUI(
    a
) {

    setTextAny(
        [
            "h4Rsi"
        ],
        roundRSI(
            a.H4.rsi
        )
    );


    setTextAny(
        [
            "h1Rsi"
        ],
        roundRSI(
            a.H1.rsi
        )
    );


    setTextAny(
        [
            "m15Rsi"
        ],
        roundRSI(
            a.M15.rsi
        )
    );


    setTextAny(
        [
            "m5Rsi"
        ],
        roundRSI(
            a.M5.rsi
        )
    );


    /*
       Use H1 EMA as the primary dashboard
       EMA structure.
    */

    setTextAny(
        [
            "emaStructure"
        ],
        a.H1.ema.text
    );
}


/* =========================================================
   UPDATE CANDLE INFORMATION
   ========================================================= */

function updateCandleUI(
    a
) {

    setTextAny(
        [
            "h4Candle"
        ],
        a.H4.candle
    );


    setTextAny(
        [
            "h1Candle"
        ],
        a.H1.candle
    );


    setTextAny(
        [
            "m15Candle"
        ],
        a.M15.candle
    );


    setTextAny(
        [
            "m5Candle"
        ],
        a.M5.candle
    );
}


/* =========================================================
   UPDATE LIVE PRICE
   ========================================================= */

function updatePriceUI(
    price
) {

    setTextAny(
        [
            "livePrice",
            "price",
            "currentPrice"
        ],
        roundPrice(price)
    );


    setTextAny(
        [
            "priceStatus",
            "status"
        ],
        "Market data loaded"
    );
}


/* =========================================================
   UPDATE NEWS FILTER
   ========================================================= */

function updateNewsUI() {

    if (NEWS_CLEAR) {

        setTextAny(
            [
                "newsFilter",
                "newsStatus"
            ],
            "NEWS CHECKED — TRADE GATE OPEN"
        );

    } else {

        setTextAny(
            [
                "newsFilter",
                "newsStatus"
            ],
            "NEWS CHECK REQUIRED — TRADING BLOCKED"
        );
    }
}


/* =========================================================
   UPDATE SNIPER SETUP
   ========================================================= */

function updateSniperUI(
    setup
) {

    setTextAny(
        [
            "sniperStatus",
            "setupStatus"
        ],
        setup.verdict
    );


    setTextAny(
        [
            "direction"
        ],
        setup.direction
    );


    setTextAny(
        [
            "entry"
        ],
        roundPrice(
            setup.entry
        )
    );


    setTextAny(
        [
            "stopLoss",
            "sl"
        ],
        roundPrice(
            setup.sl
        )
    );


    setTextAny(
        [
            "tp1"
        ],
        roundPrice(
            setup.tp1
        )
    );


    setTextAny(
        [
            "tp2"
        ],
        roundPrice(
            setup.tp2
        )
    );


    setTextAny(
        [
            "tp3"
        ],
        roundPrice(
            setup.tp3
        )
    );


    setTextAny(
        [
            "riskReward",
            "rr"
        ],
        setup.rr || "—"
    );


    setTextAny(
        [
            "validity"
        ],
        setup.validity
    );


    setTextAny(
        [
            "trigger"
        ],
        setup.trigger
    );


    setTextAny(
        [
            "invalidation"
        ],
        setup.invalidation
    );


    setTextAny(
        [
            "setupScore",
            "score"
        ],
        setup.score !== undefined
            ? `${setup.score}/11`
            : "—"
    );
}


/* =========================================================
   UPDATE PRO VERDICT
   ========================================================= */

function updateProVerdictUI(
    setup
) {

    setTextAny(
        [
            "proVerdict",
            "proStatus"
        ],
        setup.verdict
    );


    let explanation =
        "";


    if (
        setup.direction ===
        "BUY"
    ) {

        explanation =
            "BUY conditions align: H4 + H1 bullish structure, M15 confirmation and M5 price-action trigger.";

    }


    else if (
        setup.direction ===
        "SELL"
    ) {

        explanation =
            "SELL conditions align: H4 + H1 bearish structure, M15 confirmation and M5 price-action trigger.";

    }


    else if (
        !NEWS_CLEAR
    ) {

        explanation =
            "No trade is allowed until the current EUR/USD economic calendar has been checked.";

    }


    else {

        explanation =
            "No A+ multi-timeframe alignment. Stay out and wait.";

    }


    setTextAny(
        [
            "proExplanation",
            "proText"
        ],
        explanation
    );
}


/* =========================================================
   UPDATE LAST UPDATE
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
            "lastUpdate"
        ],
        `Updated: ${text} IST`
    );
}


/* =========================================================
   ERROR UI
   ========================================================= */

function showDashboardError(
    error
) {

    const message =
        apiErrorMessage(error);


    console.error(
        "DASHBOARD ERROR:",
        error
    );


    setTextAny(
        [
            "priceStatus",
            "status"
        ],
        `ERROR: ${message}`
    );


    setTextAny(
        [
            "sniperStatus",
            "setupStatus"
        ],
        "WAIT — MARKET DATA ERROR"
    );


    setTextAny(
        [
            "proVerdict",
            "proStatus"
        ],
        "WAIT — DATA ERROR"
    );


    setTextAny(
        [
            "proExplanation",
            "proText"
        ],
        message
    );
}


/* =========================================================
   LOAD ALL MARKET DATA
   ========================================================= */

async function loadMarketData() {

    /*
       Prevent accidental requests while the previous
       refresh is still running.
    */

    if (
        window.__dashboardLoading
    ) {

        return;
    }


    window.__dashboardLoading =
        true;


    try {

        marketData.apiError =
            null;


        /*
           Four requests.

           They are intentionally performed
           sequentially rather than simultaneously.

           This reduces the chance of triggering
           rate-limit behaviour.
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


        marketData.h4 =
            h4;


        marketData.h1 =
            h1;


        marketData.m15 =
            m15;


        marketData.m5 =
            m5;


        /*
           Price comes from the latest M5 candle.
        */

        if (
            m5.length
        ) {

            marketData.price =
                m5[
                    m5.length - 1
                ].close;
        }


        marketData.lastUpdate =
            new Date();


        /*
           Build analysis.
        */

        const analysis =
            buildAnalysis();


        /*
           Calculate sniper setup.
        */

        const setup =
            calculateSniperSetup(
                analysis,
                marketData.price
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


        updateCandleUI(
            analysis
        );


        updateNewsUI();


        updateSniperUI(
            setup
        );


        updateProVerdictUI(
            setup
        );


        updateTimestamp();


        console.log(
            "EUR/USD dashboard updated",
            {
                price:
                    marketData.price,

                analysis,

                setup
            }
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
   INITIAL LOAD
   ========================================================= */

function startDashboard() {

    console.log(
        "EUR/USD Sniper Dashboard starting..."
    );


    /*
       First load.
    */

    loadMarketData();


    /*
       Refresh every 15 minutes.

       IMPORTANT:
       Do not reduce this to 1 minute on the
       free Twelve Data plan.
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
