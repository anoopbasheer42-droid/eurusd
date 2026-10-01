/* =========================================================
   EUR/USD SNIPER DASHBOARD
   VERSION 3
   ---------------------------------------------------------
   A+ ENGINE:
   H4 → H1 → M15 → M5

   SCALPING ENGINE:
   H1 → M5
   Next 2 Hours

   NEWS SAFETY GATE:
   EUR + USD High Impact

   API OPTIMIZATION:
   Local caching prevents unnecessary Twelve Data calls.
   ========================================================= */


/* =========================================================
   CONFIG
   ========================================================= */

const API_KEY = "8908432b6c784bc49aad6ccf64845991";

const SYMBOL = "EUR/USD";

const TIMEZONE = "Asia/Kolkata";

/*
   Normal dashboard refresh.
   Cached timeframe data prevents this from consuming
   4 API credits every time.
*/
const REFRESH_MS = 60000;


/*
   Twelve Data free plan:
   8 API credits/minute.

   Cache durations:
*/
const CACHE_TTL = {

    h4: 15 * 60 * 1000,

    h1: 5 * 60 * 1000,

    m15: 5 * 60 * 1000,

    m5: 60 * 1000

};


/*
   News feed.

   If this feed cannot be reached, the dashboard will
   BLOCK trading rather than pretending news is clear.
*/
const NEWS_URL =
    "https://nfs.faireconomy.media/ff_calendar_thisweek.json";


/*
   High-impact news safety windows.
*/
const NEWS_BLOCK_BEFORE_MINUTES = 30;

const NEWS_BLOCK_AFTER_MINUTES = 15;


/*
   A+ engine.
*/
const MIN_SETUP_SCORE = 8;


/*
   Maximum price risk.
*/
const MAX_RISK = 0.0030;


/*
   Stop-loss buffer.
*/
const SL_BUFFER = 0.00015;


/*
   Scalping engine.

   Less strict than A+ engine.
*/
const SCALP_MIN_SCORE = 5;

const SCALP_RISK_MAX = 0.0012;


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


let newsData = {

    checked: false,

    available: false,

    error: null,

    events: [],

    lastChecked: null

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

            el.innerText =
                value;

            return true;

        }

    }


    return false;
}


/* =========================================================
   NUMBER HELPERS
   ========================================================= */

function num(value) {

    const n =
        Number(value);


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
   CACHE
   ========================================================= */

function cacheKey(interval) {

    return (
        "eurusd_" +
        interval +
        "_v3"
    );

}


function getCachedCandles(interval) {

    try {

        const raw =
            localStorage.getItem(
                cacheKey(interval)
            );


        if (!raw) {

            return null;

        }


        const parsed =
            JSON.parse(raw);


        if (
            !parsed ||
            !parsed.timestamp ||
            !Array.isArray(parsed.data)
        ) {

            return null;

        }


        const ttl =
            interval === "4h"
                ? CACHE_TTL.h4
                : interval === "1h"
                ? CACHE_TTL.h1
                : interval === "15min"
                ? CACHE_TTL.m15
                : CACHE_TTL.m5;


        if (
            Date.now() -
            parsed.timestamp >
            ttl
        ) {

            return null;

        }


        return parsed.data;

    }

    catch {

        return null;

    }

}


function saveCachedCandles(
    interval,
    data
) {

    try {

        localStorage.setItem(

            cacheKey(interval),

            JSON.stringify({

                timestamp:
                    Date.now(),

                data

            })

        );

    }

    catch {

        /*
           Ignore localStorage errors.
        */

    }

}


/* =========================================================
   FETCH CANDLES
   ========================================================= */

async function getCandles(
    interval,
    outputsize = 100
) {

    /*
       First try cache.
    */

    const cached =
        getCachedCandles(
            interval
        );


    if (cached) {

        console.log(
            interval,
            "USING CACHE"
        );

        return cached;

    }


    console.log(
        interval,
        "REQUESTING TWELVE DATA"
    );


    const url =

        "https://api.twelvedata.com/time_series" +

        "?symbol=" +
        encodeURIComponent(SYMBOL) +

        "&interval=" +
        encodeURIComponent(interval) +

        "&outputsize=" +
        outputsize +

        "&timezone=" +
        TIMEZONE +

        "&apikey=" +
        encodeURIComponent(API_KEY);


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
        "API:",
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


    saveCachedCandles(
        interval,
        candles
    );


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
                (
                    candles[i].close -
                    ema
                ) *
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
        candles.length <
        period + 1
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

        }

        else {

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
            Math.max(
                change,
                0
            );


        const loss =
            Math.max(
                -change,
                0
            );


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


    return (
        100 -
        (
            100 /
            (1 + rs)
        )
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
        index >
        candles.length - 3
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
        index >
        candles.length - 3
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
   CANDLE CONFIRMATION
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
   A+ BUY SCORE
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
   A+ SELL SCORE
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
   NEWS ENGINE
   ========================================================= */

async function loadNews() {

    try {

        const response =
            await fetch(
                NEWS_URL +
                "?_=" +
                Date.now(),
                {
                    cache:
                        "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                `News HTTP ${response.status}`
            );

        }


        const data =
            await response.json();


        if (
            !Array.isArray(data)
        ) {

            throw new Error(
                "Invalid news response"
            );

        }


        const now =
            new Date();


        const relevantEvents =
            data.filter(event => {

                const currency =
                    String(
                        event.country ||
                        event.currency ||
                        ""
                    ).toUpperCase();


                const impact =
                    String(
                        event.impact ||
                        ""
                    ).toLowerCase();


                const title =
                    String(
                        event.title ||
                        event.event ||
                        ""
                    );


                if (
                    currency !== "EUR" &&
                    currency !== "USD"
                ) {

                    return false;

                }


                if (
                    impact !== "high" &&
                    impact !== "red"
                ) {

                    return false;

                }


                const eventDate =
                    parseNewsDate(event);


                if (!eventDate) {

                    return false;

                }


                const diffMinutes =
                    (
                        eventDate -
                        now
                    ) / 60000;


                /*
                   Keep events:

                   30 min before
                   through
                   15 min after
                */

                return (
                    diffMinutes >=
                    -NEWS_BLOCK_AFTER_MINUTES &&

                    diffMinutes <=
                    120
                );

            });


        newsData = {

            checked:
                true,

            available:
                true,

            error:
                null,

            events:
                relevantEvents,

            lastChecked:
                new Date()

        };


        updateNewsUI();


        return newsData;

    }

    catch (error) {

        console.error(
            "NEWS ERROR:",
            error
        );


        newsData = {

            checked:
                true,

            available:
                false,

            error:
                error.message,

            events: [],

            lastChecked:
                new Date()

        };


        updateNewsUI();


        return newsData;

    }

}


/* =========================================================
   NEWS DATE PARSER
   ========================================================= */

function parseNewsDate(event) {

    const candidates = [

        event.date,

        event.datetime,

        event.time,

        event.timestamp

    ];


    for (
        const value of candidates
    ) {

        if (!value) {

            continue;

        }


        const date =
            new Date(value);


        if (
            !Number.isNaN(
                date.getTime()
            )
        ) {

            return date;

        }

    }


    return null;

}


/* =========================================================
   NEWS SAFETY STATUS
   ========================================================= */

function getNewsSafety() {

    if (
        !newsData.checked ||
        !newsData.available
    ) {

        return {

            status:
                "BLOCKED",

            reason:
                "NEWS DATA NOT VERIFIED"

        };

    }


    const now =
        new Date();


    let activeDanger =
        false;


    let upcomingDanger =
        false;


    for (
        const event of
        newsData.events
    ) {

        const eventDate =
            parseNewsDate(event);


        if (!eventDate) {

            continue;

        }


        const diffMinutes =
            (
                eventDate -
                now
            ) / 60000;


        if (
            diffMinutes >=
            -NEWS_BLOCK_AFTER_MINUTES &&

            diffMinutes <=
            NEWS_BLOCK_BEFORE_MINUTES
        ) {

            activeDanger =
                true;

        }


        else if (
            diffMinutes >
            NEWS_BLOCK_BEFORE_MINUTES &&

            diffMinutes <=
            120
        ) {

            upcomingDanger =
                true;

        }

    }


    if (activeDanger) {

        return {

            status:
                "BLOCKED",

            reason:
                "HIGH-IMPACT EUR/USD NEWS WINDOW"

        };

    }


    if (upcomingDanger) {

        return {

            status:
                "CAUTION",

            reason:
                "HIGH-IMPACT NEWS WITHIN NEXT 2 HOURS"

        };

    }


    return {

        status:
            "CLEAR",

        reason:
            "NO HIGH-IMPACT EUR/USD NEWS IN NEXT 2 HOURS"

    };

}


/* =========================================================
   A+ BUY SETUP
   ========================================================= */

function calculateBuySetup(
    a,
    price
) {

    const score =
        calculateBuyScore(a);


    if (
        score < MIN_SETUP_SCORE
    ) return null;


    if (
        a.H4.structure !==
        "BULLISH" ||
        a.H1.structure !==
        "BULLISH" ||
        a.M15.structure !==
        "BULLISH" ||
        a.M5.structure !==
        "BULLISH"
    ) return null;


    if (
        !bullishCandleConfirmation(
            marketData.m5
        )
    ) return null;


    if (
        a.M5.rsi === null ||
        a.M5.rsi < 45 ||
        a.M5.rsi > 70
    ) return null;


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
    ) return null;


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
   A+ SELL SETUP
   ========================================================= */

function calculateSellSetup(
    a,
    price
) {

    const score =
        calculateSellScore(a);


    if (
        score < MIN_SETUP_SCORE
    ) return null;


    if (
        a.H4.structure !==
        "BEARISH" ||
        a.H1.structure !==
        "BEARISH" ||
        a.M15.structure !==
        "BEARISH" ||
        a.M5.structure !==
        "BEARISH"
    ) return null;


    if (
        !bearishCandleConfirmation(
            marketData.m5
        )
    ) return null;


    if (
        a.M5.rsi === null ||
        a.M5.rsi < 30 ||
        a.M5.rsi > 55
    ) return null;


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
    ) return null;


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
   A+ ENGINE
   ========================================================= */

function calculateSniperSetup(
    analysis,
    price
) {

    /*
       A+ engine requires verified news.
    */

    if (
        !newsData.checked ||
        !newsData.available
    ) {

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
                Math.max(
                    calculateBuyScore(
                        analysis
                    ),
                    calculateSellScore(
                        analysis
                    )
                ),

            validity:
                "Trading blocked until news is verified",

            trigger:
                "H4/H1 → M15 → M5 → NEWS CLEARANCE",

            invalidation:
                "No trade while news is unknown",

            verdict:
                "WAIT — NEWS FILTER NOT CONFIRMED"

        };

    }


    const news =
        getNewsSafety();


    if (
        news.status ===
        "BLOCKED"
    ) {

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
                Math.max(
                    calculateBuyScore(
                        analysis
                    ),
                    calculateSellScore(
                        analysis
                    )
                ),

            validity:
                news.reason,

            trigger:
                "Wait for news risk to clear",

            invalidation:
                "No trade during high-impact news window",

            verdict:
                "WAIT — NEWS RISK BLOCKED"

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
            Math.max(
                calculateBuyScore(
                    analysis
                ),
                calculateSellScore(
                    analysis
                )
            ),

        validity:
            "No valid A+ setup",

        trigger:
            "Wait for H4/H1 direction → M15 confirmation → M5 trigger",

        invalidation:
            "—",

        verdict:
            "WAIT — NO A+ MULTI-TIMEFRAME ALIGNMENT"

    };

}


/* =========================================================
   SCALPING SCORE
   ========================================================= */

function calculateScalpBuyScore(a) {

    let score = 0;


    /*
       H1 direction.
    */

    if (
        a.H1.structure ===
        "BULLISH"
    ) score += 3;


    /*
       H1 EMA.
    */

    if (
        a.H1.ema.text ===
        "BULLISH"
    ) score += 2;


    /*
       M5 structure.
    */

    if (
        a.M5.structure ===
        "BULLISH"
    ) score += 2;


    /*
       M5 momentum.
    */

    if (
        a.M5.rsi !== null &&
        a.M5.rsi >= 45 &&
        a.M5.rsi <= 70
    ) score += 1;


    /*
       Bullish candle.
    */

    if (
        bullishCandleConfirmation(
            marketData.m5
        )
    ) score += 2;


    return score;

}


function calculateScalpSellScore(a) {

    let score = 0;


    if (
        a.H1.structure ===
        "BEARISH"
    ) score += 3;


    if (
        a.H1.ema.text ===
        "BEARISH"
    ) score += 2;


    if (
        a.M5.structure ===
        "BEARISH"
    ) score += 2;


    if (
        a.M5.rsi !== null &&
        a.M5.rsi >= 30 &&
        a.M5.rsi <= 55
    ) score += 1;


    if (
        bearishCandleConfirmation(
            marketData.m5
        )
    ) score += 2;


    return score;

}


/* =========================================================
   SCALP BUY
   ========================================================= */

function calculateScalpBuy(
    a,
    price
) {

    const score =
        calculateScalpBuyScore(a);


    if (
        score <
        SCALP_MIN_SCORE
    ) {

        return null;

    }


    if (
        a.H1.structure !==
        "BULLISH"
    ) {

        return null;

    }


    /*
       Need M5 confirmation.
    */

    const m5Bullish =
        a.M5.structure ===
        "BULLISH" ||

        bullishCandleConfirmation(
            marketData.m5
        );


    if (!m5Bullish) {

        return null;

    }


    /*
       Avoid overbought entries.
    */

    if (
        a.M5.rsi !== null &&
        a.M5.rsi > 75
    ) {

        return null;

    }


    const sr =
        a.M5.sr;


    let sl =
        sr.support1;


    if (
        !sl ||
        sl >= price
    ) {

        const lows =
            getSwingLevels(
                marketData.m5,
                20
            ).swingLows;


        sl =
            lows.length
                ? lows[lows.length - 1]
                : price - 0.0006;

    }


    sl -=
        SL_BUFFER;


    const risk =
        price - sl;


    if (
        risk <= 0 ||
        risk >
        SCALP_RISK_MAX
    ) {

        return null;

    }


    return {

        direction:
            "BUY",

        entry:
            price,

        sl,

        tp1:
            price + risk,

        tp2:
            price + risk * 2,

        score,

        confidence:
            Math.min(
                95,
                50 +
                score * 5
            ),

        window:
            "Next 2 hours",

        trigger:
            "H1 bullish bias + M5 bullish confirmation",

        invalidation:
            `M5 closes below ${roundPrice(sl)}`

    };

}


/* =========================================================
   SCALP SELL
   ========================================================= */

function calculateScalpSell(
    a,
    price
) {

    const score =
        calculateScalpSellScore(a);


    if (
        score <
        SCALP_MIN_SCORE
    ) {

        return null;

    }


    if (
        a.H1.structure !==
        "BEARISH"
    ) {

        return null;

    }


    const m5Bearish =
        a.M5.structure ===
        "BEARISH" ||

        bearishCandleConfirmation(
            marketData.m5
        );


    if (!m5Bearish) {

        return null;

    }


    if (
        a.M5.rsi !== null &&
        a.M5.rsi < 25
    ) {

        return null;

    }


    const sr =
        a.M5.sr;


    let sl =
        sr.resistance1;


    if (
        !sl ||
        sl <= price
    ) {

        const highs =
            getSwingLevels(
                marketData.m5,
                20
            ).swingHighs;


        sl =
            highs.length
                ? highs[highs.length - 1]
                : price + 0.0006;

    }


    sl +=
        SL_BUFFER;


    const risk =
        sl - price;


    if (
        risk <= 0 ||
        risk >
        SCALP_RISK_MAX
    ) {

        return null;

    }


    return {

        direction:
            "SELL",

        entry:
            price,

        sl,

        tp1:
            price - risk,

        tp2:
            price - risk * 2,

        score,

        confidence:
            Math.min(
                95,
                50 +
                score * 5
            ),

        window:
            "Next 2 hours",

        trigger:
            "H1 bearish bias + M5 bearish confirmation",

        invalidation:
            `M5 closes above ${roundPrice(sl)}`

    };

}


/* =========================================================
   SCALPING ENGINE
   ========================================================= */

function calculateScalpSetup(
    analysis,
    price
) {

    const news =
        getNewsSafety();


    /*
       NEWS IS A HARD GATE.
    */

    if (
        news.status ===
        "BLOCKED"
    ) {

        return {

            direction:
                "BLOCKED",

            reason:
                news.reason,

            entry: null,
            sl: null,
            tp1: null,
            tp2: null,

            score: 0,

            confidence: 0,

            window:
                "Next 2 hours",

            trigger:
                "Wait until news risk clears",

            invalidation:
                "No scalp while news is blocked"

        };

    }


    if (
        news.status !==
        "CLEAR"
    ) {

        return {

            direction:
                "CAUTION",

            reason:
                news.reason,

            entry: null,
            sl: null,
            tp1: null,
            tp2: null,

            score: 0,

            confidence: 0,

            window:
                "Next 2 hours",

            trigger:
                "High-impact news approaching — wait",

            invalidation:
                "Do not enter before news clearance"

        };

    }


    /*
       News clear.
    */

    const buy =
        calculateScalpBuy(
            analysis,
            price
        );


    const sell =
        calculateScalpSell(
            analysis,
            price
        );


    if (
        buy &&
        sell
    ) {

        return buy.score >=
            sell.score
            ? buy
            : sell;

    }


    if (buy) {

        return buy;

    }


    if (sell) {

        return sell;

    }


    return {

        direction:
            "WAIT",

        reason:
            "No valid H1 + M5 scalp alignment",

        entry: null,
        sl: null,
        tp1: null,
        tp2: null,

        score:
            Math.max(
                calculateScalpBuyScore(
                    analysis
                ),
                calculateScalpSellScore(
                    analysis
                )
            ),

        confidence: 0,

        window:
            "Next 2 hours",

        trigger:
            "Wait for H1 direction + M5 confirmation",

        invalidation:
            "No trade until setup develops"

    };

}


/* =========================================================
   DYNAMIC SCALP CARD
   ========================================================= */

function createScalpCard() {

    if (
        document.getElementById(
            "scalpCard"
        )
    ) {

        return;

    }


    const card =
        document.createElement(
            "div"
        );


    card.className =
        "card";


    card.id =
        "scalpCard";


    card.innerHTML = `

        <h2>⚡ Scalping Window — Next 2 Hours</h2>

        <p class="wait"
           id="scalpVerdict">
           WAIT — Calculating...
        </p>

        <div class="level">
          <span>Direction</span>
          <span id="scalpDirection">—</span>
        </div>

        <div class="level">
          <span>Entry</span>
          <span id="scalpEntry">—</span>
        </div>

        <div class="level">
          <span>Stop Loss</span>
          <span id="scalpSL">—</span>
        </div>

        <div class="level">
          <span>TP1</span>
          <span id="scalpTP1">—</span>
        </div>

        <div class="level">
          <span>TP2</span>
          <span id="scalpTP2">—</span>
        </div>

        <div class="level">
          <span>Risk / Reward</span>
          <span id="scalpRR">—</span>
        </div>

        <div class="level">
          <span>Confidence</span>
          <span id="scalpConfidence">—</span>
        </div>

        <div class="level">
          <span>Window</span>
          <span id="scalpWindow">Next 2 hours</span>
        </div>

        <div class="level">
          <span>Trigger</span>
          <span id="scalpTrigger">—</span>
        </div>

        <div class="level">
          <span>Invalidation</span>
          <span id="scalpInvalidation">—</span>
        </div>

        <div class="level">
          <span>News Safety</span>
          <span id="scalpNews">—</span>
        </div>

    `;


    /*
       Put scalping card immediately before
       the PRO VERDICT card.
    */

    const proCard =
        document.getElementById(
            "proVerdict"
        );


    if (
        proCard &&
        proCard.closest(".card")
    ) {

        proCard
            .closest(".card")
            .before(card);

    }

    else {

        document.body.appendChild(
            card
        );

    }

}


/* =========================================================
   UPDATE SCALPING UI
   ========================================================= */

function updateScalpUI(
    setup
) {

    createScalpCard();


    const news =
        getNewsSafety();


    let verdict =
        "SCALP WAIT";


    if (
        setup.direction ===
        "BUY"
    ) {

        verdict =
            "🟢 SCALP BUY";

    }

    else if (
        setup.direction ===
        "SELL"
    ) {

        verdict =
            "🔴 SCALP SELL";

    }

    else if (
        setup.direction ===
        "BLOCKED"
    ) {

        verdict =
            "🔴 SCALP BLOCKED — NEWS";

    }

    else if (
        setup.direction ===
        "CAUTION"
    ) {

        verdict =
            "🟠 SCALP CAUTION — NEWS";

    }

    else {

        verdict =
            "WAIT — NO SCALP SETUP";

    }


    setTextAny(
        "scalpVerdict",
        verdict
    );


    setTextAny(
        "scalpDirection",
        setup.direction
    );


    setTextAny(
        "scalpEntry",
        roundPrice(
            setup.entry
        )
    );


    setTextAny(
        "scalpSL",
        roundPrice(
            setup.sl
        )
    );


    setTextAny(
        "scalpTP1",
        roundPrice(
            setup.tp1
        )
    );


    setTextAny(
        "scalpTP2",
        roundPrice(
            setup.tp2
        )
    );


    setTextAny(
        "scalpRR",
        setup.entry &&
        setup.sl
            ? "1:2"
            : "—"
    );


    setTextAny(
        "scalpConfidence",
        setup.confidence
            ? `${setup.confidence}%`
            : "—"
    );


    setTextAny(
        "scalpWindow",
        setup.window ||
        "Next 2 hours"
    );


    setTextAny(
        "scalpTrigger",
        setup.trigger ||
        "—"
    );


    setTextAny(
        "scalpInvalidation",
        setup.invalidation ||
        "—"
    );


    setTextAny(
        "scalpNews",
        news.status +
        " — " +
        news.reason
    );

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
   UPDATE SR
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


    setTextAny(
        "emaStructure",
        a.H1.ema.text
    );

}


/* =========================================================
   UPDATE NEWS UI
   ========================================================= */

function updateNewsUI() {

    if (
        !newsData.available
    ) {

        setTextAny(
            "eurNews",
            "NOT VERIFIED"
        );


        setTextAny(
            "usdNews",
            "NOT VERIFIED"
        );


        setTextAny(
            "newsFilter",
            "NEWS CHECK FAILED"
        );


        setTextAny(
            "nextEvent",
            "NEWS DATA UNAVAILABLE"
        );


        setTextAny(
            "tradingRisk",
            "HIGH — NEWS BLOCKED"
        );


        return;

    }


    let eurCount = 0;

    let usdCount = 0;


    for (
        const event of
        newsData.events
    ) {

        const currency =
            String(
                event.country ||
                event.currency ||
                ""
            ).toUpperCase();


        if (
            currency ===
            "EUR"
        ) {

            eurCount++;

        }


        if (
            currency ===
            "USD"
        ) {

            usdCount++;

        }

    }


    const safety =
        getNewsSafety();


    setTextAny(
        "eurNews",
        eurCount > 0
            ? `${eurCount} HIGH-IMPACT`
            : "CLEAR"
    );


    setTextAny(
        "usdNews",
        usdCount > 0
            ? `${usdCount} HIGH-IMPACT`
            : "CLEAR"
    );


    setTextAny(
        "newsFilter",
        safety.status
    );


    let next =
        "No high-impact EUR/USD event found";


    if (
        newsData.events.length
    ) {

        const sorted =
            [...newsData.events]
                .sort(
                    (a, b) =>
                        parseNewsDate(a) -
                        parseNewsDate(b)
                );


        const event =
            sorted[0];


        const currency =
            event.country ||
            event.currency ||
            "";


        const title =
            event.title ||
            event.event ||
            "Important event";


        next =
            `${currency} — ${title}`;

    }


    setTextAny(
        "nextEvent",
        next
    );


    setTextAny(
        "tradingRisk",
        safety.status ===
        "CLEAR"
            ? "LOW — NEWS CLEAR"
            : safety.status ===
              "CAUTION"
            ? "MEDIUM — NEWS APPROACHING"
            : "HIGH — NEWS BLOCKED"
    );

}


/* =========================================================
   UPDATE SNIPER UI
   ========================================================= */

function updateSniperUI(
    setup
) {

    setTextAny(
        "sniperStatus",
        setup.verdict
    );


    /*
       Compatibility with older HTML.
    */

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
        setup.rr ||
        "—"
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


    setTextAny(
        "setupScore",
        setup.score !== undefined
            ? `${setup.score} / 11`
            : "—"
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
        analysis.H4.structure ===
            "BEARISH" &&
        analysis.H1.structure ===
            "BULLISH"
    ) {

        setTextAny(
            "proExplanation",
            "STAY OUT — H4 is BEARISH while H1 is BULLISH. Higher-timeframe conflict."
        );


        return;

    }


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


    else {

        setTextAny(
            "proExplanation",
            "No A+ multi-timeframe alignment. Stay out and wait."
        );

    }

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
                    TIMEZONE,

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
       Never allow a data error to produce
       a trading signal.
    */

    updateScalpUI({

        direction:
            "BLOCKED",

        reason:
            "MARKET DATA ERROR",

        entry: null,
        sl: null,
        tp1: null,
        tp2: null,

        confidence: 0,

        window:
            "Next 2 hours",

        trigger:
            "Market data unavailable",

        invalidation:
            "No trade"

    });

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


    try {

        console.log(
            "EUR/USD DASHBOARD UPDATE"
        );


        /*
           Load all required timeframes.

           Cache ensures we don't repeatedly
           consume API credits.
        */

        const [
            h4,
            h1,
            m15,
            m5
        ] = await Promise.all([

            getCandles(
                "4h",
                100
            ),

            getCandles(
                "1h",
                100
            ),

            getCandles(
                "15min",
                100
            ),

            getCandles(
                "5min",
                100
            )

        ]);


        marketData.h4 =
            h4;


        marketData.h1 =
            h1;


        marketData.m15 =
            m15;


        marketData.m5 =
            m5;


        marketData.price =
            m5[
                m5.length - 1
            ].close;


        marketData.lastUpdate =
            new Date();


        /*
           News is checked separately.
        */

        await loadNews();


        const analysis =
            buildAnalysis();


        const sniperSetup =
            calculateSniperSetup(
                analysis,
                marketData.price
            );


        const scalpSetup =
            calculateScalpSetup(
                analysis,
                marketData.price
            );


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
            sniperSetup
        );


        updateProVerdictUI(
            sniperSetup,
            analysis
        );


        updateScalpUI(
            scalpSetup
        );


        updateTimestamp();


        console.log(
            "EUR/USD DASHBOARD COMPLETE"
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
   CHART SWITCHER
   ========================================================= */

function changeChart(
    interval
) {

    const iframe =
        document.getElementById(
            "tradingChart"
        );


    if (!iframe) {

        return;

    }


    iframe.src =

        "https://www.tradingview.com/widgetembed/?" +

        "frameElementId=tradingview_chart" +

        "&symbol=FX%3AEURUSD" +

        "&interval=" +
        encodeURIComponent(interval) +

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


    document
        .querySelectorAll(
            ".timeframes button"
        )
        .forEach(
            button =>
                button.classList
                    .remove(
                        "active"
                    )
        );


    const map = {

        "5":
            "btn5",

        "15":
            "btn15",

        "60":
            "btn60",

        "4H":
            "btn240"

    };


    const button =
        document.getElementById(
            map[interval]
        );


    if (button) {

        button.classList.add(
            "active"
        );

    }

}


/* =========================================================
   START DASHBOARD
   ========================================================= */

function startDashboard() {

    console.log(
        "EUR/USD SNIPER DASHBOARD V3 STARTING..."
    );


    /*
       Create scalping section immediately.
    */

    createScalpCard();


    /*
       First load.
    */

    loadMarketData();


    /*
       Refresh every minute.

       Cache means only expired timeframe data
       will actually call Twelve Data.
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

}

else {

    startDashboard();

}
