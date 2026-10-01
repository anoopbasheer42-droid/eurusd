/* =========================================================
   EUR/USD SNIPER DASHBOARD
   API-SAFE VERSION
   H4 → H1 → M15 → M5

   PRICE ACTION
   MARKET STRUCTURE
   SUPPORT / RESISTANCE
   EMA
   RSI
   A+ SNIPER ENGINE
   NEWS SAFETY GATE

   IMPORTANT:
   Twelve Data free limit can be very low.
   This version fetches timeframes ONE AT A TIME
   with a delay to avoid hitting the per-minute limit.
   ========================================================= */


/* =========================================================
   CONFIG
   ========================================================= */

const API_KEY = "8908432b6c784bc49aad6ccf64845991";

const SYMBOL = "EUR/USD";

/*
   Wait 5 minutes between complete dashboard updates.
   This is deliberately conservative for the API limit.
*/
const REFRESH_MS = 300000;

/*
   Delay between individual API requests.
*/
const REQUEST_DELAY_MS = 9000;

/*
   News gate remains CLOSED until a real economic
   calendar source is connected.
*/
const NEWS_CLEAR = false;

const MIN_SETUP_SCORE = 8;

/*
   Maximum allowed stop distance.
*/
const MAX_RISK = 0.0030;

/*
   Small buffer beyond structural level.
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


/*
   Prevent duplicate loading.
*/
window.__dashboardLoading = false;


/* =========================================================
   DOM HELPER
   ========================================================= */

function setTextAny(ids, value) {

    if (!Array.isArray(ids)) {
        ids = [ids];
    }

    for (const id of ids) {

        const el = document.getElementById(id);

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
   WAIT / DELAY
   ========================================================= */

function sleep(ms) {

    return new Promise(resolve => {

        setTimeout(resolve, ms);

    });
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
        "Requesting Twelve Data:",
        interval
    );


    const response = await fetch(url);


    if (!response.ok) {

        throw new Error(
            `${interval}: HTTP ${response.status}`
        );
    }


    const data = await response.json();


    console.log(
        interval,
        "API:",
        data
    );


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
            `No ${interval} candle data received`
        );
    }


    const candles =
        data.values

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
   SWING HIGH / LOW
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


    const c = candles[index];


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


    const c = candles[index];


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
   SWING LEVELS
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
   M5 BUY CONFIRMATION
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
   M5 SELL CONFIRMATION
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
   BUY SETUP
   ========================================================= */

function calculateBuySetup(
    a,
    price
) {

    const score =
        calculateBuyScore(a);


    if (
        score < MIN_SETUP_SCORE
    ) {

        return null;
    }


    if (
        a.H4.structure !== "BULLISH" ||
        a.H1.structure !== "BULLISH" ||
        a.M15.structure !== "BULLISH" ||
        a.M5.structure !== "BULLISH"
    ) {

        return null;
    }


    if (
        !bullishCandleConfirmation(
            marketData.m5
        )
    ) {

        return null;
    }


    if (
        a.M5.rsi === null ||
        a.M5.rsi < 45 ||
        a.M5.rsi > 70
    ) {

        return null;
    }


    const entry = price;


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


    return {

        direction:
            "BUY",

        entry,

        sl,

        tp1:
            entry + risk,

        tp2:
            entry + risk * 2,

        tp3:
            entry + risk * 3,

        score,

        rr:
            "1:3",

        validity:
            "Valid while H4/H1 bullish structure remains intact",

        trigger:
            "H4 + H1 bullish → M15 confirmation → M5 bullish breakout",

        invalidation:
            `M5 closes below ${roundPrice(sl)}`,

        verdict:
            "BUY — A+ PRICE ACTION ALIGNMENT"

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


    if (
        score < MIN_SETUP_SCORE
    ) {

        return null;
    }


    if (
        a.H4.structure !== "BEARISH" ||
        a.H1.structure !== "BEARISH" ||
        a.M15.structure !== "BEARISH" ||
        a.M5.structure !== "BEARISH"
    ) {

        return null;
    }


    if (
        !bearishCandleConfirmation(
            marketData.m5
        )
    ) {

        return null;
    }


    if (
        a.M5.rsi === null ||
        a.M5.rsi < 30 ||
        a.M5.rsi > 55
    ) {

        return null;
    }


    const entry = price;


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


    return {

        direction:
            "SELL",

        entry,

        sl,

        tp1:
            entry - risk,

        tp2:
            entry - risk * 2,

        tp3:
            entry - risk * 3,

        score,

        rr:
            "1:3",

        validity:
            "Valid while H4/H1 bearish structure remains intact",

        trigger:
            "H4 + H1 bearish → M15 confirmation → M5 bearish breakdown",

        invalidation:
            `M5 closes above ${roundPrice(sl)}`,

        verdict:
            "SELL — A+ PRICE ACTION ALIGNMENT"

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


    const bestScore =
        Math.max(
            buyScore,
            sellScore
        );


    /*
       NEWS SAFETY GATE
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

            score:
                bestScore,

            validity:
                "Trading blocked until real economic news is checked",

            trigger:
                "Technical setup may develop, but no trade is allowed while news status is unknown",

            invalidation:
                "No trade while NEWS FILTER is CLOSED",

            verdict:
                "WAIT — NEWS FILTER NOT CONFIRMED"

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
        sell
    ) {

        return buy.score >= sell.score
            ? buy
            : sell;
    }


    if (buy) return buy;

    if (sell) return sell;


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
            bestScore,

        validity:
            "No valid A+ setup currently",

        trigger:
            "Wait for H4/H1 direction → M15 confirmation → M5 trigger",

        invalidation:
            "—",

        verdict:
            "WAIT — NO A+ MULTI-TIMEFRAME ALIGNMENT"

    };
}


/* =========================================================
   UPDATE PRICE
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
   UPDATE STRUCTURE
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
   UPDATE SUPPORT / RESISTANCE
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
   UPDATE INDICATORS
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
       H1 EMA is used as the main dashboard EMA state.
    */

    setTextAny(
        "emaStructure",
        a.H1.ema.text
    );
}


/* =========================================================
   UPDATE NEWS
   ========================================================= */

function updateNewsUI() {

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
   UPDATE SNIPER
   ========================================================= */

function updateSniperUI(setup) {

    setTextAny(
        [
            "sniperStatus",
            "sniperVerdict"
        ],
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
       Your HTML contains setupScore.
       The previous script was not updating it.
    */

    setTextAny(
        "setupScore",
        `${setup.score}/10`
    );
}


/* =========================================================
   UPDATE PRO VERDICT
   ========================================================= */

function updateProVerdictUI(setup) {

    setTextAny(
        "proVerdict",
        setup.verdict
    );


    if (
        setup.direction ===
        "BUY"
    ) {

        setTextAny(
            "proExplanation",
            "BUY: H4 + H1 bullish structure, M15 confirmation and M5 bullish trigger."
        );

    }


    else if (
        setup.direction ===
        "SELL"
    ) {

        setTextAny(
            "proExplanation",
            "SELL: H4 + H1 bearish structure, M15 confirmation and M5 bearish trigger."
        );

    }


    else if (
        !NEWS_CLEAR
    ) {

        setTextAny(
            "proExplanation",
            "Technical analysis is running, but trading remains blocked until the economic news filter is connected."
        );

    }


    else {

        setTextAny(
            "proExplanation",
            "No A+ multi-timeframe alignment. Stay out and wait."
        );
    }
}


/* =========================================================
   UPDATE TIMESTAMP
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

function showDashboardError(error) {

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
        "API LIMIT / MARKET DATA ERROR"
    );


    setTextAny(
        [
            "price"
        ],
        "ERROR"
    );


    setTextAny(
        "sniperStatus",
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


    /*
       Do NOT erase the previous successful
       technical values. They remain visible
       so the user knows what the last valid
       analysis was.
    */
}


/* =========================================================
   LOAD MARKET DATA
   ========================================================= */

async function loadMarketData() {

    if (
        window.__dashboardLoading
    ) {

        console.log(
            "Dashboard already loading."
        );

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
            "===================================="
        );


        console.log(
            "EUR/USD DASHBOARD UPDATE START"
        );


        /*
           IMPORTANT:
           Requests are intentionally sequential.
        */

        const h4 =
            await getCandles(
                "4h",
                100
            );


        await sleep(
            REQUEST_DELAY_MS
        );


        const h1 =
            await getCandles(
                "1h",
                100
            );


        await sleep(
            REQUEST_DELAY_MS
        );


        const m15 =
            await getCandles(
                "15min",
                100
            );


        await sleep(
            REQUEST_DELAY_MS
        );


        const m5 =
            await getCandles(
                "5min",
                100
            );


        /*
           Save successful data.
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


        marketData.apiError =
            null;


        console.log(
            "LIVE PRICE:",
            marketData.price
        );


        /*
           Build analysis.
        */

        const analysis =
            buildAnalysis();


        console.log(
            "ANALYSIS:",
            analysis
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
            "SNIPER SETUP:",
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
            setup
        );


        updateTimestamp();


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
            "EUR/USD DASHBOARD UPDATE COMPLETE"
        );


        console.log(
            "===================================="
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
   MANUAL REFRESH
   ========================================================= */

function manualRefresh() {

    console.log(
        "Manual refresh requested."
    );


    loadMarketData();
}


/*
   Make the function available to the HTML
   if you later add:
   onclick="manualRefresh()"
*/

window.manualRefresh =
    manualRefresh;


/* =========================================================
   CHART TIMEFRAME
   ========================================================= */

function changeChart(interval) {

    const iframe =
        document.getElementById(
            "tradingChart"
        );


    if (!iframe) {

        return;
    }


    const buttons = {

        "5":
            "btn5",

        "15":
            "btn15",

        "60":
            "btn60",

        "4H":
            "btn240"

    };


    /*
       Remove active state.
    */

    Object.values(buttons)
        .forEach(id => {

            const button =
                document.getElementById(id);

            if (button) {

                button.classList.remove(
                    "active"
                );
            }

        });


    /*
       Add active state.
    */

    const activeButton =
        document.getElementById(
            buttons[interval]
        );


    if (activeButton) {

        activeButton.classList.add(
            "active"
        );
    }


    /*
       TradingView interval.
    */

    let tvInterval =
        interval;


    if (
        interval === "4H"
    ) {

        tvInterval = "240";
    }


    const url =
        "https://www.tradingview.com/widgetembed/" +
        "?frameElementId=tradingview_chart" +
        "&symbol=FX%3AEURUSD" +
        "&interval=" +
        tvInterval +
        "&hidesidetoolbar=1" +
        "&hidetoptoolbar=0" +
        "&symboledit=1" +
        "&saveimage=0" +
        "&toolbarbg=f1f3f6" +
        "&theme=dark" +
        "&style=1" +
        "&timezone=Asia%2FKolkata" +
        "&withdateranges=1" +
        "&hideideas=1" +
        "&studies=%5B%5D" +
        "&overrides=%7B%7D" +
        "&locale=en";


    iframe.src =
        url;
}


/*
   Make chart function globally available.
*/

window.changeChart =
    changeChart;


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
       Automatic refresh every 5 minutes.
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
