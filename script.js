/* =========================================================
   EUR/USD SNIPER DASHBOARD
   A+ SNIPER + 2-HOUR SCALPING ENGINE
   H4 → H1 → M15 → M5
   SCALPER: H1 → M5

   IMPORTANT:
   Replace API_KEY with your NEW Twelve Data API key.
   ========================================================= */


/* =========================================================
   CONFIG
   ========================================================= */

const API_KEY = "8908432b6c784bc49aad6ccf64845991";

const SYMBOL = "EUR/USD";

/*
   Free Twelve Data plan:
   8 API credits/minute.

   We use only 4 market-data requests per refresh:
   H4, H1, M15, M5.

   The scalper REUSES H1 and M5 data.
*/
const REFRESH_MS = 15 * 60 * 1000;

/*
   Prevent accidental repeated refreshes.
*/
const MIN_REQUEST_INTERVAL = 60 * 1000;


/*
   A+ sniper requirements
*/
const MIN_SETUP_SCORE = 8;


/*
   Scalper requirements
*/
const MIN_SCALP_SCORE = 5;


/*
   Maximum price risk.
   0.0030 = 30 pips approximately.
*/
const MAX_RISK = 0.0030;


/*
   SL safety buffer.
*/
const SL_BUFFER = 0.00015;


/*
   News protection.

   High impact news:
   block 60 minutes BEFORE
   and 30 minutes AFTER.

   Medium impact:
   block 30 minutes BEFORE
   and 15 minutes AFTER.
*/
const NEWS_BLOCK_BEFORE_HIGH = 60;
const NEWS_BLOCK_AFTER_HIGH = 30;

const NEWS_BLOCK_BEFORE_MEDIUM = 30;
const NEWS_BLOCK_AFTER_MEDIUM = 15;


/*
   Free Forex Factory calendar feed.

   This feed is fetched only once per hour,
   not every market refresh.

   If it fails, the dashboard remains SAFE:
   NEWS UNKNOWN = NO TRADE.
*/
const NEWS_URL =
    "https://nfs.faireconomy.media/ff_calendar_thisweek.json";


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

    apiError: null,

    news: {

        status: "UNKNOWN",

        events: [],

        nextEvent: null,

        lastChecked: null,

        error: null

    }

};


window.__dashboardLoading = false;

window.__lastMarketRequest = 0;

window.__lastNewsRequest = 0;


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
   TIME HELPERS
   ========================================================= */

function nowIST() {

    return new Date();
}


function formatIST(date) {

    if (!date) {
        return "—";
    }

    return new Date(date).toLocaleString(
        "en-IN",
        {
            timeZone: "Asia/Kolkata",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        }
    );
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
        "Requesting:",
        interval
    );


    const response =
        await fetch(url);


    if (
        response.status === 429
    ) {

        throw new Error(
            `${interval}: Twelve Data rate limit reached. Wait for the next minute.`
        );
    }


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


    let resistanceLevels =
        clusterLevels(
            swings.swingHighs
        );


    let supportLevels =
        clusterLevels(
            swings.swingLows
        );


    let resistances =
        resistanceLevels

            .filter(
                level =>
                    level > current
            )

            .sort(
                (a, b) =>
                    a - b
            );


    let supports =
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
       FALLBACK:
       If R2/S2 is missing, use nearby
       raw swing levels instead of leaving
       the dashboard empty.
    */

    if (
        resistances.length < 2
    ) {

        const raw =
            swings.swingHighs

                .filter(
                    level =>
                        level > current
                )

                .sort(
                    (a, b) =>
                        a - b
                );


        for (
            const level of raw
        ) {

            if (
                !resistances.some(
                    x =>
                        Math.abs(
                            x - level
                        ) < 0.00005
                )
            ) {

                resistances.push(
                    level
                );
            }
        }
    }


    if (
        supports.length < 2
    ) {

        const raw =
            swings.swingLows

                .filter(
                    level =>
                        level < current
                )

                .sort(
                    (a, b) =>
                        b - a
                );


        for (
            const level of raw
        ) {

            if (
                !supports.some(
                    x =>
                        Math.abs(
                            x - level
                        ) < 0.00005
                )
            ) {

                supports.push(
                    level
                );
            }
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

function parseNewsDate(value) {

    if (!value) {
        return null;
    }


    const d =
        new Date(value);


    if (
        Number.isNaN(
            d.getTime()
        )
    ) {

        return null;
    }


    return d;
}


function isRelevantCurrency(
    event
) {

    const currency =
        String(
            event.currency ||
            event.country ||
            ""
        ).toUpperCase();


    return (
        currency === "EUR" ||
        currency === "USD"
    );
}


function normalizeImpact(
    event
) {

    return String(
        event.impact ||
        ""
    ).toLowerCase();
}


function isHighImpact(event) {

    const impact =
        normalizeImpact(event);

    return (
        impact.includes("high") ||
        impact === "red"
    );
}


function isMediumImpact(event) {

    const impact =
        normalizeImpact(event);

    return (
        impact.includes("medium") ||
        impact === "orange"
    );
}


async function loadNewsCalendar(
    force = false
) {

    const now =
        Date.now();


    /*
       Don't request the news feed more than
       once per hour unless manually forced.
    */
    if (
        !force &&
        marketData.news.lastChecked &&
        (
            now -
            marketData.news.lastChecked
        ) < 60 * 60 * 1000
    ) {

        return;
    }


    try {

        console.log(
            "Checking economic calendar..."
        );


        const response =
            await fetch(
                NEWS_URL +
                "?_=" +
                Date.now()
            );


        if (!response.ok) {

            throw new Error(
                `News HTTP ${response.status}`
            );
        }


        const raw =
            await response.json();


        if (
            !Array.isArray(raw)
        ) {

            throw new Error(
                "Invalid news calendar format"
            );
        }


        const events =
            raw

                .filter(
                    event =>
                        isRelevantCurrency(event)
                )

                .map(event => {

                    const date =
                        parseNewsDate(
                            event.date ||
                            event.datetime ||
                            event.time
                        );


                    return {

                        date,

                        currency:
                            String(
                                event.currency ||
                                event.country ||
                                ""
                            ).toUpperCase(),

                        title:
                            event.title ||
                            event.event ||
                            "Economic Event",

                        impact:
                            event.impact ||
                            ""

                    };

                })

                .filter(
                    event =>
                        event.date !== null
                )

                .sort(
                    (a, b) =>
                        a.date - b.date
                );


        marketData.news.events =
            events;


        marketData.news.status =
            "CLEAR";


        marketData.news.error =
            null;


        marketData.news.lastChecked =
            now;


        console.log(
            "NEWS EVENTS:",
            events
        );


    }
    catch (error) {

        console.error(
            "NEWS ERROR:",
            error
        );


        marketData.news.status =
            "UNKNOWN";


        marketData.news.error =
            error;


        marketData.news.lastChecked =
            now;
    }


    updateNewsUI();
}


/* =========================================================
   NEWS RISK CHECK
   ========================================================= */

function getNewsRisk(
    direction = null
) {

    const now =
        new Date();


    if (
        marketData.news.status !==
        "CLEAR"
    ) {

        return {

            blocked:
                true,

            status:
                "UNKNOWN",

            event:
                null,

            reason:
                "Economic calendar could not be confirmed."

        };
    }


    const relevantEvents =
        marketData.news.events
            .filter(
                event =>
                    event.currency ===
                    "EUR" ||
                    event.currency ===
                    "USD"
            );


    let blockingEvent =
        null;


    for (
        const event of relevantEvents
    ) {

        const diffMinutes =
            (
                event.date.getTime() -
                now.getTime()
            ) / 60000;


        const high =
            isHighImpact(event);


        const medium =
            isMediumImpact(event);


        if (
            high &&
            diffMinutes <=
                NEWS_BLOCK_BEFORE_HIGH &&
            diffMinutes >=
                -NEWS_BLOCK_AFTER_HIGH
        ) {

            blockingEvent =
                event;

            break;
        }


        if (
            medium &&
            diffMinutes <=
                NEWS_BLOCK_BEFORE_MEDIUM &&
            diffMinutes >=
                -NEWS_BLOCK_AFTER_MEDIUM
        ) {

            blockingEvent =
                event;

            break;
        }
    }


    if (blockingEvent) {

        return {

            blocked:
                true,

            status:
                "BLOCKED",

            event:
                blockingEvent,

            reason:
                `${blockingEvent.currency} ${blockingEvent.title}`

        };
    }


    const nextEvent =
        relevantEvents.find(
            event =>
                event.date >
                now
        );


    return {

        blocked:
            false,

        status:
            "CLEAR",

        event:
            nextEvent || null,

        reason:
            "No EUR/USD high-impact news inside the protection window."

    };
}


/* =========================================================
   SCALPER SCORE
   ========================================================= */

function calculateScalpBuyScore(
    a
) {

    let score = 0;


    /*
       H1 direction = strongest factor
    */
    if (
        a.H1.structure ===
        "BULLISH"
    ) score += 2;


    /*
       H1 EMA
    */
    if (
        a.H1.ema.text ===
        "BULLISH"
    ) score += 1;


    /*
       M5 structure
    */
    if (
        a.M5.structure ===
        "BULLISH"
    ) score += 2;


    /*
       M5 candle
    */
    if (
        bullishCandleConfirmation(
            marketData.m5
        )
    ) score += 2;


    /*
       RSI
    */
    if (
        a.M5.rsi !== null &&
        a.M5.rsi >= 45 &&
        a.M5.rsi <= 70
    ) score += 1;


    /*
       M5 EMA
    */
    if (
        a.M5.ema.text ===
        "BULLISH"
    ) score += 1;


    return score;
}


function calculateScalpSellScore(
    a
) {

    let score = 0;


    if (
        a.H1.structure ===
        "BEARISH"
    ) score += 2;


    if (
        a.H1.ema.text ===
        "BEARISH"
    ) score += 1;


    if (
        a.M5.structure ===
        "BEARISH"
    ) score += 2;


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
        a.M5.ema.text ===
        "BEARISH"
    ) score += 1;


    return score;
}


/* =========================================================
   SCALP SETUP
   ========================================================= */

function calculateScalpSetup(
    a,
    price
) {

    const news =
        getNewsRisk();


    /*
       News is a HARD safety gate.
    */

    if (
        news.blocked
    ) {

        return {

            direction:
                "WAIT",

            entry: null,
            sl: null,
            tp1: null,
            tp2: null,

            rr:
                "—",

            score:
                Math.max(
                    calculateScalpBuyScore(a),
                    calculateScalpSellScore(a)
                ),

            validity:
                news.status ===
                "UNKNOWN"
                    ? "NEWS UNKNOWN — NO SCALP"
                    : "NEWS WINDOW BLOCKED",

            trigger:
                news.reason,

            invalidation:
                "Do not trade while news protection is active.",

            verdict:
                news.status ===
                "UNKNOWN"
                    ? "WAIT — NEWS NOT CONFIRMED"
                    : "WAIT — NEWS RISK HIGH"

        };
    }


    const buyScore =
        calculateScalpBuyScore(a);


    const sellScore =
        calculateScalpSellScore(a);


    /*
       BUY
    */

    if (
        buyScore >= MIN_SCALP_SCORE &&
        a.H1.structure ===
            "BULLISH" &&
        a.M5.structure ===
            "BULLISH"
    ) {

        let support =
            a.M5.sr.support1;


        if (
            !support ||
            support >= price
        ) {

            support =
                price -
                0.00070;
        }


        const sl =
            support -
            SL_BUFFER;


        const risk =
            price - sl;


        if (
            risk > 0 &&
            risk <= MAX_RISK
        ) {

            return {

                direction:
                    "BUY",

                entry:
                    price,

                sl,

                tp1:
                    price +
                    risk * 1.5,

                tp2:
                    price +
                    risk * 2,

                rr:
                    "1:2",

                score:
                    buyScore,

                validity:
                    "Valid for the next 2 hours while H1/M5 bullish structure remains intact.",

                trigger:
                    "H1 bullish + M5 bullish structure + M5 momentum confirmation.",

                invalidation:
                    `M5 closes below ${roundPrice(sl)}`,

                verdict:
                    "BUY — 2-HOUR SCALP"

            };
        }
    }


    /*
       SELL
    */

    if (
        sellScore >= MIN_SCALP_SCORE &&
        a.H1.structure ===
            "BEARISH" &&
        a.M5.structure ===
            "BEARISH"
    ) {

        let resistance =
            a.M5.sr.resistance1;


        if (
            !resistance ||
            resistance <= price
        ) {

            resistance =
                price +
                0.00070;
        }


        const sl =
            resistance +
            SL_BUFFER;


        const risk =
            sl - price;


        if (
            risk > 0 &&
            risk <= MAX_RISK
        ) {

            return {

                direction:
                    "SELL",

                entry:
                    price,

                sl,

                tp1:
                    price -
                    risk * 1.5,

                tp2:
                    price -
                    risk * 2,

                rr:
                    "1:2",

                score:
                    sellScore,

                validity:
                    "Valid for the next 2 hours while H1/M5 bearish structure remains intact.",

                trigger:
                    "H1 bearish + M5 bearish structure + M5 momentum confirmation.",

                invalidation:
                    `M5 closes above ${roundPrice(sl)}`,

                verdict:
                    "SELL — 2-HOUR SCALP"

            };
        }
    }


    return {

        direction:
            "WAIT",

        entry: null,
        sl: null,
        tp1: null,
        tp2: null,

        rr:
            "—",

        score:
            Math.max(
                buyScore,
                sellScore
            ),

        validity:
            "No clean H1 + M5 scalping alignment for the next 2 hours.",

        trigger:
            "Wait for H1 direction and M5 confirmation.",

        invalidation:
            "—",

        verdict:
            "WAIT — NO 2-HOUR SCALP"

    };
}


/* =========================================================
   A+ SNIPER SETUP
   ========================================================= */

function calculateSniperSetup(
    analysis,
    price
) {

    /*
       News is still a HARD gate.
    */

    const news =
        getNewsRisk();


    if (
        news.blocked
    ) {

        return {

            direction:
                "WAIT",

            entry: null,
            sl: null,
            tp1: null,
            tp2: null,
            tp3: null,

            rr:
                null,

            score:
                Math.max(
                    calculateBuyScore(analysis),
                    calculateSellScore(analysis)
                ),

            validity:
                news.status ===
                "UNKNOWN"
                    ? "Trading blocked because economic news status is unknown."
                    : "Trading blocked by the news protection window.",

            trigger:
                news.reason,

            invalidation:
                "No trade while NEWS FILTER is CLOSED.",

            verdict:
                news.status ===
                "UNKNOWN"
                    ? "WAIT — NEWS FILTER NOT CONFIRMED"
                    : "WAIT — NEWS RISK HIGH"

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

        rr:
            null,

        score:
            Math.max(
                calculateBuyScore(analysis),
                calculateSellScore(analysis)
            ),

        validity:
            "No valid A+ setup currently.",

        trigger:
            "Wait for H4/H1 direction → M15 confirmation → M5 trigger.",

        invalidation:
            "—",

        verdict:
            "WAIT — NO A+ MULTI-TIMEFRAME ALIGNMENT"

    };
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
    ) return null;


    if (
        a.H4.structure !== "BULLISH" ||
        a.H1.structure !== "BULLISH" ||
        a.M15.structure !== "BULLISH" ||
        a.M5.structure !== "BULLISH"
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
            "Valid while H4/H1 bullish structure remains intact.",

        trigger:
            "H4 + H1 bullish → M15 confirmation → M5 bullish breakout.",

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
    ) return null;


    if (
        a.H4.structure !== "BEARISH" ||
        a.H1.structure !== "BEARISH" ||
        a.M15.structure !== "BEARISH" ||
        a.M5.structure !== "BEARISH"
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
            "Valid while H4/H1 bearish structure remains intact.",

        trigger:
            "H4 + H1 bearish → M15 confirmation → M5 bearish breakdown.",

        invalidation:
            `M5 closes above ${roundPrice(sl)}`,

        verdict:
            "SELL — A+ PRICE ACTION ALIGNMENT"

    };
}


/* =========================================================
   PRICE UI
   ========================================================= */

function updatePriceUI(price) {

    setTextAny(
        [
            "livePrice",
            "price",
            "currentPrice",
            "live-price"
        ],
        roundPrice(price)
    );


    setTextAny(
        [
            "trend",
            "priceStatus",
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
   SR UI
   ========================================================= */

function updateSRUI(a) {

    /*
       H1 levels are used for the dashboard.
    */

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
   INDICATORS UI
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
   NEWS UI
   ========================================================= */

function updateNewsUI() {

    const events =
        marketData.news.events ||
        [];


    const now =
        new Date();


    const eurHigh =
        events.find(
            e =>
                e.currency === "EUR" &&
                isHighImpact(e) &&
                e.date > now
        );


    const usdHigh =
        events.find(
            e =>
                e.currency === "USD" &&
                isHighImpact(e) &&
                e.date > now
        );


    const risk =
        getNewsRisk();


    setTextAny(
        "eurNews",
        eurHigh
            ? `HIGH — ${formatIST(eurHigh.date)}`
            : "NO HIGH-IMPACT EVENT"
    );


    setTextAny(
        "usdNews",
        usdHigh
            ? `HIGH — ${formatIST(usdHigh.date)}`
            : "NO HIGH-IMPACT EVENT"
    );


    if (
        marketData.news.status ===
        "UNKNOWN"
    ) {

        setTextAny(
            "newsFilter",
            "NEWS UNKNOWN"
        );


        setTextAny(
            "nextEvent",
            "Calendar unavailable"
        );


        setTextAny(
            "tradingRisk",
            "HIGH — NEWS CHECK FAILED"
        );

        return;
    }


    if (
        risk.blocked
    ) {

        setTextAny(
            "newsFilter",
            "BLOCKED — NEWS WINDOW"
        );


        setTextAny(
            "nextEvent",
            risk.event
                ? `${risk.event.currency} ${risk.event.title} — ${formatIST(risk.event.date)}`
                : "News event"
        );


        setTextAny(
            "tradingRisk",
            "HIGH — DO NOT TRADE"
        );

        return;
    }


    const next =
        events.find(
            e =>
                e.date >
                now
        );


    setTextAny(
        "newsFilter",
        "CLEAR"
    );


    setTextAny(
        "nextEvent",
        next
            ? `${next.currency} ${next.title} — ${formatIST(next.date)}`
            : "No upcoming EUR/USD event"
    );


    setTextAny(
        "tradingRisk",
        "NORMAL — NEWS CLEAR"
    );
}


/* =========================================================
   SNIPER UI
   ========================================================= */

function updateSniperUI(
    setup
) {

    setTextAny(
        [
            "sniperVerdict",
            "sniperStatus"
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
        `${setup.score} / 11`
    );
}


/* =========================================================
   SCALPER UI
   ========================================================= */

function updateScalperUI(
    setup
) {

    setTextAny(
        [
            "scalpVerdict",
            "scalpStatus"
        ],
        setup.verdict
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
        "scalpStopLoss",
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
        "scalpRiskReward",
        setup.rr ||
        "—"
    );


    setTextAny(
        "scalpValidity",
        setup.validity
    );


    setTextAny(
        "scalpTrigger",
        setup.trigger
    );


    setTextAny(
        "scalpInvalidation",
        setup.invalidation
    );


    setTextAny(
        "scalpScore",
        `${setup.score} / 9`
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
        setup.direction ===
        "BUY"
    ) {

        setTextAny(
            "proExplanation",
            "BUY: H4 + H1 bullish structure, M15 confirmation and M5 bullish trigger."
        );

        return;
    }


    if (
        setup.direction ===
        "SELL"
    ) {

        setTextAny(
            "proExplanation",
            "SELL: H4 + H1 bearish structure, M15 confirmation and M5 bearish trigger."
        );

        return;
    }


    if (
        marketData.news.status !==
        "CLEAR"
    ) {

        setTextAny(
            "proExplanation",
            "Technical analysis is running, but trading remains blocked because the economic calendar could not be confirmed."
        );

        return;
    }


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


    setTextAny(
        "proExplanation",
        "No A+ multi-timeframe alignment. Stay out and wait."
    );
}


/* =========================================================
   TIMESTAMP
   ========================================================= */

function updateTimestamp() {

    const text =
        formatIST(
            new Date()
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
            "trend",
            "priceStatus",
            "status",
            "marketStatus"
        ],
        `ERROR: ${message}`
    );


    setTextAny(
        [
            "sniperVerdict",
            "sniperStatus"
        ],
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
       Do not erase previous valid
       technical data if one refresh fails.
    */
}


/* =========================================================
   LOAD MARKET DATA
   ========================================================= */

async function loadMarketData(
    force = false
) {

    if (
        window.__dashboardLoading
    ) {

        return;
    }


    const now =
        Date.now();


    /*
       Protect Twelve Data free quota.
    */

    if (
        !force &&
        (
            now -
            window.__lastMarketRequest
        ) < MIN_REQUEST_INTERVAL
    ) {

        console.log(
            "Market refresh skipped — rate protection."
        );

        return;
    }


    window.__dashboardLoading =
        true;


    window.__lastMarketRequest =
        now;


    setTextAny(
        [
            "trend",
            "priceStatus",
            "status",
            "marketStatus"
        ],
        "CONNECTING TO MARKET DATA..."
    );


    try {

        console.log(
            "EUR/USD DASHBOARD UPDATE START"
        );


        /*
           Four calls only.
           The scalper reuses H1 and M5.
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


        marketData.price =
            m5[
                m5.length - 1
            ].close;


        marketData.lastUpdate =
            new Date();


        const analysis =
            buildAnalysis();


        /*
           News is checked separately
           and cached for one hour.
        */

        await loadNewsCalendar();


        const sniper =
            calculateSniperSetup(
                analysis,
                marketData.price
            );


        const scalper =
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
            sniper
        );


        updateScalperUI(
            scalper
        );


        updateProVerdictUI(
            sniper,
            analysis
        );


        updateTimestamp();


        setTextAny(
            [
                "trend",
                "priceStatus",
                "status",
                "marketStatus"
            ],
            "MARKET DATA LOADED"
        );


        console.log(
            "SNIPER:",
            sniper
        );


        console.log(
            "SCALPER:",
            scalper
        );


        console.log(
            "EUR/USD DASHBOARD UPDATE COMPLETE"
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

    /*
       Manual refresh is allowed only if
       at least 60 seconds have passed.

       This prevents accidental API-credit
       exhaustion from repeated taps.
    */

    const now =
        Date.now();


    if (
        (
            now -
            window.__lastMarketRequest
        ) <
        MIN_REQUEST_INTERVAL
    ) {

        const remaining =
            Math.ceil(
                (
                    MIN_REQUEST_INTERVAL -
                    (
                        now -
                        window.__lastMarketRequest
                    )
                ) / 1000
            );


        setTextAny(
            [
                "trend",
                "priceStatus",
                "status",
                "marketStatus"
            ],
            `PLEASE WAIT ${remaining}s — API RATE PROTECTION`
        );


        return;
    }


    loadMarketData(true);
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

    loadMarketData(
        true
    );


    /*
       Refresh every 15 minutes.
    */

    setInterval(
        () =>
            loadMarketData(false),
        REFRESH_MS
    );
}


/* =========================================================
   CHART
   ========================================================= */

function changeChart(
    interval
) {

    const chart =
        document.getElementById(
            "tradingChart"
        );


    if (!chart) {
        return;
    }


    const buttons = [
        "btn5",
        "btn15",
        "btn60",
        "btn240"
    ];


    buttons.forEach(
        id => {

            const btn =
                document.getElementById(
                    id
                );

            if (btn) {

                btn.classList.remove(
                    "active"
                );
            }

        }
    );


    if (
        interval === "5"
    ) {

        document
            .getElementById("btn5")
            ?.classList.add("active");

    }


    if (
        interval === "15"
    ) {

        document
            .getElementById("btn15")
            ?.classList.add("active");

    }


    if (
        interval === "60"
    ) {

        document
            .getElementById("btn60")
            ?.classList.add("active");

    }


    if (
        interval === "4H"
    ) {

        document
            .getElementById("btn240")
            ?.classList.add("active");

    }


    chart.src =
        "https://www.tradingview.com/widgetembed/" +
        "?frameElementId=tradingview_chart" +
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
