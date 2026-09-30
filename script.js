/* =========================================================
   EUR/USD SNIPER DASHBOARD
   ELITE PRICE ACTION ENGINE

   H4 → H1 → M15 → M5

   FEATURES
   ---------------------------------------------------------
   • Live EUR/USD price
   • H4 / H1 / M15 / M5 structure
   • Confirmed-candle analysis
   • Swing highs / lows
   • Clustered Support / Resistance
   • RSI
   • EMA
   • ATR
   • Liquidity sweeps
   • Break of Structure
   • Bullish / Bearish engulfing
   • Rejection candles
   • Structural Stop Loss
   • 1R / 2R / 3R targets
   • BUY / SELL / WAIT
   • News-risk protection
   • Reduced API refresh rate
   ========================================================= */


/* =========================================================
   API
   ========================================================= */

const API_KEY = "8908432b6c784bc49aad6ccf64845991";


/* =========================================================
   REFRESH
   =========================================================

   Twelve Data Basic currently allows 800 API requests/day.

   We deliberately use 10 minutes instead of 1 minute to
   reduce the chance of HTTP 429 errors.
*/

const REFRESH_MS = 600000;


/* =========================================================
   NEWS RISK CONTROL
   =========================================================

   NORMAL = engine allowed to trade

   MEDIUM = only very strong setups

   HIGH = NO NEW TRADE

   IMPORTANT:
   This is currently a MANUAL news-risk switch.

   We will connect a real economic calendar later.
*/

const NEWS_RISK = "NORMAL";


/* =========================================================
   MARKET DATA
   ========================================================= */

let marketData = {

    h4: [],
    h1: [],
    m15: [],
    m5: [],

    price: null,

    lastH4Fetch: 0,
    lastH1Fetch: 0,
    lastM15Fetch: 0,
    lastM5Fetch: 0,
    lastPriceFetch: 0

};


/* =========================================================
   HELPER FUNCTIONS
   ========================================================= */

function num(value) {

    const n = Number(value);

    return Number.isFinite(n)
        ? n
        : null;

}


function setText(id, value) {

    const el =
        document.getElementById(id);

    if (el) {
        el.innerText = value;
    }

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


function pips(a, b) {

    if (
        a === null ||
        b === null
    ) {
        return null;
    }

    return Math.abs(a - b) * 10000;

}


/* =========================================================
   FETCH LIVE PRICE
   ========================================================= */

async function getLivePrice() {

    const url =
        `https://api.twelvedata.com/price` +
        `?symbol=EUR/USD` +
        `&apikey=${API_KEY}`;


    const response =
        await fetch(url);


    if (!response.ok) {

        throw new Error(
            `Price HTTP error ${response.status}`
        );

    }


    const data =
        await response.json();


    if (data.status === "error") {

        throw new Error(
            data.message || "Price API error"
        );

    }


    const price =
        num(data.price);


    if (price === null) {

        throw new Error(
            "Invalid EUR/USD price"
        );

    }


    return price;

}


/* =========================================================
   FETCH CANDLES
   ========================================================= */

async function getCandles(
    interval,
    outputsize = 120
) {

    const url =
        `https://api.twelvedata.com/time_series` +
        `?symbol=EUR/USD` +
        `&interval=${interval}` +
        `&outputsize=${outputsize}` +
        `&timezone=Asia/Kolkata` +
        `&apikey=${API_KEY}`;


    const response =
        await fetch(url);


    if (!response.ok) {

        throw new Error(
            `${interval} HTTP error ${response.status}`
        );

    }


    const data =
        await response.json();


    if (data.status === "error") {

        throw new Error(
            `${interval}: ${data.message || "API error"}`
        );

    }


    if (
        !data.values ||
        !Array.isArray(data.values)
    ) {

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
                (candles[i].close - ema)
                * multiplier
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


    return (
        100 -
        (100 / (1 + rs))
    );

}


/* =========================================================
   ATR
   ========================================================= */

function calculateATR(
    candles,
    period = 14
) {

    if (
        !candles ||
        candles.length < period + 1
    ) {
        return null;
    }


    const ranges = [];


    for (
        let i = candles.length - period;
        i < candles.length;
        i++
    ) {

        const current =
            candles[i];

        const previous =
            candles[i - 1];


        const trueRange =
            Math.max(

                current.high -
                current.low,

                Math.abs(
                    current.high -
                    previous.close
                ),

                Math.abs(
                    current.low -
                    previous.close
                )

            );


        ranges.push(trueRange);

    }


    return (

        ranges.reduce(
            (sum, value) =>
                sum + value,
            0
        ) / ranges.length

    );

}


/* =========================================================
   CLOSED CANDLES
   =========================================================

   The newest candle may still be forming.

   Therefore all structure calculations use candles
   EXCEPT the final currently-forming candle.
*/

function getClosedCandles(candles) {

    if (
        !candles ||
        candles.length < 5
    ) {
        return [];
    }


    return candles.slice(
        0,
        -1
    );

}


/* =========================================================
   SWING HIGH
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


    const high =
        candles[index].high;


    for (
        let i = 1;
        i <= strength;
        i++
    ) {

        if (
            high <=
            candles[index - i].high
        ) {
            return false;
        }


        if (
            high <=
            candles[index + i].high
        ) {
            return false;
        }

    }


    return true;

}


/* =========================================================
   SWING LOW
   ========================================================= */

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


    const low =
        candles[index].low;


    for (
        let i = 1;
        i <= strength;
        i++
    ) {

        if (
            low >=
            candles[index - i].low
        ) {
            return false;
        }


        if (
            low >=
            candles[index + i].low
        ) {
            return false;
        }

    }


    return true;

}


/* =========================================================
   GET SWING POINTS
   ========================================================= */

function getSwingPoints(
    candles,
    lookback = 80
) {

    const data =
        candles.slice(-lookback);


    const highs = [];

    const lows = [];


    for (
        let i = 2;
        i < data.length - 2;
        i++
    ) {

        if (
            isSwingHigh(
                data,
                i,
                2
            )
        ) {

            highs.push({

                price: data[i].high,

                index: i,

                datetime:
                    data[i].datetime

            });

        }


        if (
            isSwingLow(
                data,
                i,
                2
            )
        ) {

            lows.push({

                price: data[i].low,

                index: i,

                datetime:
                    data[i].datetime

            });

        }

    }


    return {
        highs,
        lows
    };

}


/* =========================================================
   MARKET STRUCTURE
   =========================================================

   IMPORTANT FIX:

   We compare the most recent CONFIRMED swing highs/lows.

   We do NOT classify H1 as bullish merely because the
   latest 10 candles have a higher maximum.

   This is why a single red candle will not automatically
   turn H1 bearish either.
*/

function calculateStructure(
    candles
) {

    if (
        !candles ||
        candles.length < 20
    ) {
        return "INSUFFICIENT DATA";
    }


    const closed =
        getClosedCandles(candles);


    const swings =
        getSwingPoints(
            closed,
            80
        );


    if (
        swings.highs.length < 2 ||
        swings.lows.length < 2
    ) {

        return "RANGE";

    }


    const lastHigh =
        swings.highs[
            swings.highs.length - 1
        ];

    const previousHigh =
        swings.highs[
            swings.highs.length - 2
        ];


    const lastLow =
        swings.lows[
            swings.lows.length - 1
        ];

    const previousLow =
        swings.lows[
            swings.lows.length - 2
        ];


    const higherHigh =
        lastHigh.price >
        previousHigh.price;


    const higherLow =
        lastLow.price >
        previousLow.price;


    const lowerHigh =
        lastHigh.price <
        previousHigh.price;


    const lowerLow =
        lastLow.price <
        previousLow.price;


    if (
        higherHigh &&
        higherLow
    ) {

        return "BULLISH";

    }


    if (
        lowerHigh &&
        lowerLow
    ) {

        return "BEARISH";

    }


    return "RANGE";

}


/* =========================================================
   STRUCTURE DETAILS
   ========================================================= */

function getStructureDetails(
    candles
) {

    const closed =
        getClosedCandles(candles);


    const swings =
        getSwingPoints(
            closed,
            80
        );


    if (
        swings.highs.length < 2 ||
        swings.lows.length < 2
    ) {

        return {

            lastHigh: null,
            previousHigh: null,
            lastLow: null,
            previousLow: null

        };

    }


    return {

        lastHigh:
            swings.highs[
                swings.highs.length - 1
            ].price,

        previousHigh:
            swings.highs[
                swings.highs.length - 2
            ].price,

        lastLow:
            swings.lows[
                swings.lows.length - 1
            ].price,

        previousLow:
            swings.lows[
                swings.lows.length - 2
            ].price

    };

}


/* =========================================================
   SUPPORT / RESISTANCE
   =========================================================

   Uses swing highs/lows.

   Nearby levels are clustered together so several touches
   around the same price become ONE meaningful level.

   Always attempts to return R1/R2/S1/S2.
*/

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


    for (
        const level of sorted
    ) {

        let placed = false;


        for (
            const cluster of clusters
        ) {

            const average =
                cluster.reduce(
                    (sum, value) =>
                        sum + value,
                    0
                ) /
                cluster.length;


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

            clusters.push([
                level
            ]);

        }

    }


    return clusters.map(
        cluster =>

            cluster.reduce(
                (sum, value) =>
                    sum + value,
                0
            ) /
            cluster.length

    );

}


/* =========================================================
   SUPPORT / RESISTANCE CALCULATION
   ========================================================= */

function calculateSupportResistance(
    candles
) {

    const closed =
        getClosedCandles(candles);


    if (
        closed.length < 20
    ) {

        return {

            resistance1: null,
            resistance2: null,
            support1: null,
            support2: null

        };

    }


    const current =
        closed[
            closed.length - 1
        ].close;


    const swings =
        getSwingPoints(
            closed,
            80
        );


    const resistanceRaw =
        swings.highs
            .map(x => x.price)
            .filter(
                price =>
                    price > current
            );


    const supportRaw =
        swings.lows
            .map(x => x.price)
            .filter(
                price =>
                    price < current
            );


    const resistances =
        clusterLevels(
            resistanceRaw
        ).sort(
            (a, b) => a - b
        );


    const supports =
        clusterLevels(
            supportRaw
        ).sort(
            (a, b) => b - a
        );


    let resistance1 =
        resistances[0] || null;


    let resistance2 =
        resistances[1] || null;


    let support1 =
        supports[0] || null;


    let support2 =
        supports[1] || null;


    /*
       FALLBACKS

       These prevent R2/S2 from remaining blank when
       the market has too few clean swing levels.
    */

    const atr =
        calculateATR(
            closed
        );


    const fallback =
        atr || 0.0010;


    if (
        resistance1 === null
    ) {

        const recentHigh =
            Math.max(
                ...closed
                    .slice(-30)
                    .map(
                        c => c.high
                    )
            );


        if (
            recentHigh > current
        ) {

            resistance1 =
                recentHigh;

        }

    }


    if (
        resistance2 === null &&
        resistance1 !== null
    ) {

        resistance2 =
            resistance1 +
            fallback * 0.75;

    }


    if (
        support1 === null
    ) {

        const recentLow =
            Math.min(
                ...closed
                    .slice(-30)
                    .map(
                        c => c.low
                    )
            );


        if (
            recentLow < current
        ) {

            support1 =
                recentLow;

        }

    }


    if (
        support2 === null &&
        support1 !== null
    ) {

        support2 =
            support1 -
            fallback * 0.75;

    }


    return {

        resistance1,
        resistance2,
        support1,
        support2

    };

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


    if (
        ema200 !== null &&
        ema20 > ema50 &&
        ema50 > ema200
    ) {

        return {

            text:
                "Strong bullish EMA alignment",

            ema20,
            ema50,
            ema200

        };

    }


    if (
        ema200 !== null &&
        ema20 < ema50 &&
        ema50 < ema200
    ) {

        return {

            text:
                "Strong bearish EMA alignment",

            ema20,
            ema50,
            ema200

        };

    }


    if (
        ema20 > ema50
    ) {

        return {

            text:
                "Bullish EMA alignment",

            ema20,
            ema50,
            ema200

        };

    }


    if (
        ema20 < ema50
    ) {

        return {

            text:
                "Bearish EMA alignment",

            ema20,
            ema50,
            ema200

        };

    }


    return {

        text:
            "EMA compression",

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

            rsi: null,

            atr: null,

            ema: {

                text:
                    "Calculating...",

                ema20: null,

                ema50: null,

                ema200: null

            },

            sr: {

                resistance1: null,
                resistance2: null,
                support1: null,
                support2: null

            }

        };

    }


    const closed =
        getClosedCandles(candles);


    const last =
        closed[
            closed.length - 1
        ];


    return {

        price:
            last.close,

        structure:
            calculateStructure(
                candles
            ),

        structureDetails:
            getStructureDetails(
                candles
            ),

        rsi:
            calculateRSI(
                closed
            ),

        atr:
            calculateATR(
                closed
            ),

        ema:
            getEMAAnalysis(
                closed
            ),

        sr:
            calculateSupportResistance(
                candles
            )

    };

}


/* =========================================================
   CANDLE FUNCTIONS
   ========================================================= */

function candleBody(c) {

    return Math.abs(
        c.close - c.open
    );

}


function candleRange(c) {

    return (
        c.high - c.low
    );

}


function isBullishCandle(c) {

    return (
        c.close > c.open
    );

}


function isBearishCandle(c) {

    return (
        c.close < c.open
    );

}


/* =========================================================
   BULLISH ENGULFING
   ========================================================= */

function isBullishEngulfing(
    previous,
    current
) {

    if (
        !previous ||
        !current
    ) {
        return false;
    }


    return (

        isBearishCandle(
            previous
        ) &&

        isBullishCandle(
            current
        ) &&

        current.open <=
        previous.close &&

        current.close >=
        previous.open &&

        candleBody(current) >
        candleBody(previous)

    );

}


/* =========================================================
   BEARISH ENGULFING
   ========================================================= */

function isBearishEngulfing(
    previous,
    current
) {

    if (
        !previous ||
        !current
    ) {
        return false;
    }


    return (

        isBullishCandle(
            previous
        ) &&

        isBearishCandle(
            current
        ) &&

        current.open >=
        previous.close &&

        current.close <=
        previous.open &&

        candleBody(current) >
        candleBody(previous)

    );

}


/* =========================================================
   BULLISH REJECTION
   ========================================================= */

function isBullishRejection(c) {

    if (!c) {
        return false;
    }


    const body =
        candleBody(c);


    const range =
        candleRange(c);


    if (
        range <= 0
    ) {
        return false;
    }


    const lowerWick =
        Math.min(
            c.open,
            c.close
        ) - c.low;


    const upperWick =
        c.high -
        Math.max(
            c.open,
            c.close
        );


    return (

        lowerWick >=
        body * 1.5 &&

        lowerWick >
        upperWick &&

        lowerWick / range >=
        0.45

    );

}


/* =========================================================
   BEARISH REJECTION
   ========================================================= */

function isBearishRejection(c) {

    if (!c) {
        return false;
    }


    const body =
        candleBody(c);


    const range =
        candleRange(c);


    if (
        range <= 0
    ) {
        return false;
    }


    const upperWick =
        c.high -
        Math.max(
            c.open,
            c.close
        );


    const lowerWick =
        Math.min(
            c.open,
            c.close
        ) - c.low;


    return (

        upperWick >=
        body * 1.5 &&

        upperWick >
        lowerWick &&

        upperWick / range >=
        0.45

    );

}


/* =========================================================
   LIQUIDITY SWEEP LOW
   ========================================================= */

function bullishLiquiditySweep(
    candles
) {

    if (
        candles.length < 7
    ) {
        return false;
    }


    const current =
        candles[
            candles.length - 1
        ];


    const previous =
        candles.slice(
            -7,
            -1
        );


    const previousLow =
        Math.min(
            ...previous.map(
                c => c.low
            )
        );


    return (

        current.low <
        previousLow &&

        current.close >
        previousLow &&

        isBullishCandle(
            current
        )

    );

}


/* =========================================================
   LIQUIDITY SWEEP HIGH
   ========================================================= */

function bearishLiquiditySweep(
    candles
) {

    if (
        candles.length < 7
    ) {
        return false;
    }


    const current =
        candles[
            candles.length - 1
        ];


    const previous =
        candles.slice(
            -7,
            -1
        );


    const previousHigh =
        Math.max(
            ...previous.map(
                c => c.high
            )
        );


    return (

        current.high >
        previousHigh &&

        current.close <
        previousHigh &&

        isBearishCandle(
            current
        )

    );

}


/* =========================================================
   BULLISH BREAK OF STRUCTURE
   ========================================================= */

function bullishBOS(
    candles
) {

    if (
        candles.length < 12
    ) {
        return false;
    }


    const current =
        candles[
            candles.length - 1
        ];


    const previous =
        candles.slice(
            -11,
            -1
        );


    const previousHigh =
        Math.max(
            ...previous.map(
                c => c.high
            )
        );


    return (

        current.close >
        previousHigh &&

        isBullishCandle(
            current
        )

    );

}


/* =========================================================
   BEARISH BREAK OF STRUCTURE
   ========================================================= */

function bearishBOS(
    candles
) {

    if (
        candles.length < 12
    ) {
        return false;
    }


    const current =
        candles[
            candles.length - 1
        ];


    const previous =
        candles.slice(
            -11,
            -1
        );


    const previousLow =
        Math.min(
            ...previous.map(
                c => c.low
            )
        );


    return (

        current.close <
        previousLow &&

        isBearishCandle(
            current
        )

    );

}


/* =========================================================
   BUY CANDLE SIGNAL
   ========================================================= */

function getBullishCandleSignal(
    candles
) {

    if (
        candles.length < 3
    ) {

        return {
            confirmed: false,
            reason: "No candle confirmation"
        };

    }


    const current =
        candles[
            candles.length - 1
        ];


    const previous =
        candles[
            candles.length - 2
        ];


    if (
        isBullishEngulfing(
            previous,
            current
        )
    ) {

        return {

            confirmed: true,

            reason:
                "Bullish engulfing"

        };

    }


    if (
        bullishLiquiditySweep(
            candles
        )
    ) {

        return {

            confirmed: true,

            reason:
                "Bullish liquidity sweep"

        };

    }


    if (
        bullishBOS(
            candles
        )
    ) {

        return {

            confirmed: true,

            reason:
                "Bullish break of structure"

        };

    }


    if (
        isBullishRejection(
            current
        )
    ) {

        return {

            confirmed: true,

            reason:
                "Bullish rejection candle"

        };

    }


    return {

        confirmed: false,

        reason:
            "No bullish candle confirmation"

    };

}


/* =========================================================
   SELL CANDLE SIGNAL
   ========================================================= */

function getBearishCandleSignal(
    candles
) {

    if (
        candles.length < 3
    ) {

        return {

            confirmed: false,

            reason:
                "No candle confirmation"

        };

    }


    const current =
        candles[
            candles.length - 1
        ];


    const previous =
        candles[
            candles.length - 2
        ];


    if (
        isBearishEngulfing(
            previous,
            current
        )
    ) {

        return {

            confirmed: true,

            reason:
                "Bearish engulfing"

        };

    }


    if (
        bearishLiquiditySweep(
            candles
        )
    ) {

        return {

            confirmed: true,

            reason:
                "Bearish liquidity sweep"

        };

    }


    if (
        bearishBOS(
            candles
        )
    ) {

        return {

            confirmed: true,

            reason:
                "Bearish break of structure"

        };

    }


    if (
        isBearishRejection(
            current
        )
    ) {

        return {

            confirmed: true,

            reason:
                "Bearish rejection candle"

        };

    }


    return {

        confirmed: false,

        reason:
            "No bearish candle confirmation"

    };

}


/* =========================================================
   STRUCTURAL STOP LOSS
   ========================================================= */

function calculateBuySL(
    candles,
    entry,
    atr
) {

    const swingLow =
        getRecentSwingLow(
            candles,
            15
        );


    if (
        swingLow === null
    ) {

        return (
            entry -
            atr * 1.2
        );

    }


    const structuralSL =
        swingLow -
        atr * 0.20;


    const minimumSL =
        entry -
        atr * 1.20;


    return Math.min(
        structuralSL,
        minimumSL
    );

}


/* =========================================================
   SELL STOP LOSS
   ========================================================= */

function calculateSellSL(
    candles,
    entry,
    atr
) {

    const swingHigh =
        getRecentSwingHigh(
            candles,
            15
        );


    if (
        swingHigh === null
    ) {

        return (
            entry +
            atr * 1.2
        );

    }


    const structuralSL =
        swingHigh +
        atr * 0.20;


    const minimumSL =
        entry +
        atr * 1.20;


    return Math.max(
        structuralSL,
        minimumSL
    );

}


/* =========================================================
   RECENT SWING LOW
   ========================================================= */

function getRecentSwingLow(
    candles,
    lookback = 15
) {

    const data =
        candles.slice(
            -lookback
        );


    if (
        !data.length
    ) {
        return null;
    }


    return Math.min(
        ...data.map(
            c => c.low
        )
    );

}


/* =========================================================
   RECENT SWING HIGH
   ========================================================= */

function getRecentSwingHigh(
    candles,
    lookback = 15
) {

    const data =
        candles.slice(
            -lookback
        );


    if (
        !data.length
    ) {
        return null;
    }


    return Math.max(
        ...data.map(
            c => c.high
        )
    );

}


/* =========================================================
   NEWS FILTER
   ========================================================= */

function newsAllowsTrade() {

    if (
        NEWS_RISK === "HIGH"
    ) {

        return {

            allowed: false,

            reason:
                "HIGH-IMPACT NEWS RISK — WAIT"

        };

    }


    if (
        NEWS_RISK === "MEDIUM"
    ) {

        return {

            allowed: true,

            strict: true,

            reason:
                "MEDIUM NEWS RISK — A+ setup required"

        };

    }


    return {

        allowed: true,

        strict: false,

        reason:
            "NORMAL NEWS RISK"

    };

}


/* =========================================================
   ELITE SNIPER ENGINE
   ========================================================= */

function calculateSniperSetup(
    a
) {

    const price =
        marketData.price;


    const news =
        newsAllowsTrade();


    /* -----------------------------------------------------
       NEWS BLOCK
       ----------------------------------------------------- */

    if (
        !news.allowed
    ) {

        return {

            direction: "WAIT",

            entry: null,

            sl: null,

            tp1: null,

            tp2: null,

            tp3: null,

            rr: "—",

            validity:
                "Trading paused because of news risk",

            trigger:
                news.reason,

            invalidation:
                "Wait until high-impact news volatility settles",

            verdict:
                "WAIT — NEWS FILTER ACTIVE"

        };

    }


    /* -----------------------------------------------------
       DATA CHECK
       ----------------------------------------------------- */

    if (
        !a.H4 ||
        !a.H1 ||
        !a.M15 ||
        !a.M5
    ) {

        return {

            direction: "WAIT",

            entry: null,

            sl: null,

            tp1: null,

            tp2: null,

            tp3: null,

            rr: "—",

            validity:
                "Waiting for timeframe data",

            trigger:
                "H4/H1/M15/M5 required",

            invalidation:
                "—",

            verdict:
                "WAIT — DATA NOT READY"

        };

    }


    /* -----------------------------------------------------
       CLOSED CANDLES
       ----------------------------------------------------- */

    const h4 =
        getClosedCandles(
            marketData.h4
        );


    const h1 =
        getClosedCandles(
            marketData.h1
        );


    const m15 =
        getClosedCandles(
            marketData.m15
        );


    const m5 =
        getClosedCandles(
            marketData.m5
        );


    if (
        h4.length < 20 ||
        h1.length < 20 ||
        m15.length < 20 ||
        m5.length < 20
    ) {

        return {

            direction: "WAIT",

            entry: null,

            sl: null,

            tp1: null,

            tp2: null,

            tp3: null,

            rr: "—",

            validity:
                "Waiting for sufficient candle data",

            trigger:
                "H4/H1/M15/M5 data required",

            invalidation:
                "—",

            verdict:
                "WAIT — INSUFFICIENT DATA"

        };

    }


    /* -----------------------------------------------------
       CANDLE SIGNALS
       ----------------------------------------------------- */

    const buySignal =
        getBullishCandleSignal(
            m5
        );


    const sellSignal =
        getBearishCandleSignal(
            m5
        );


    /* -----------------------------------------------------
       STRUCTURE
       ----------------------------------------------------- */

    const h4Bull =
        a.H4.structure ===
        "BULLISH";


    const h4Bear =
        a.H4.structure ===
        "BEARISH";


    const h1Bull =
        a.H1.structure ===
        "BULLISH";


    const h1Bear =
        a.H1.structure ===
        "BEARISH";


    const m15Bull =
        a.M15.structure ===
        "BULLISH";


    const m15Bear =
        a.M15.structure ===
        "BEARISH";


    const m5Bull =
        a.M5.structure ===
        "BULLISH";


    const m5Bear =
        a.M5.structure ===
        "BEARISH";


    /* -----------------------------------------------------
       RSI
       ----------------------------------------------------- */

    const buyRSI =
        a.M5.rsi !== null &&
        a.M5.rsi >= 40 &&
        a.M5.rsi <= 68;


    const sellRSI =
        a.M5.rsi !== null &&
        a.M5.rsi >= 32 &&
        a.M5.rsi <= 60;


    /* =====================================================
       BUY SCORE
       ===================================================== */

    let buyScore = 0;


    if (h4Bull) {
        buyScore += 2;
    }


    if (h1Bull) {
        buyScore += 2;
    }


    if (m15Bull) {
        buyScore += 2;
    }


    if (m5Bull) {
        buyScore += 1;
    }


    if (buySignal.confirmed) {
        buyScore += 2;
    }


    if (buyRSI) {
        buyScore += 1;
    }


    /* =====================================================
       SELL SCORE
       ===================================================== */

    let sellScore = 0;


    if (h4Bear) {
        sellScore += 2;
    }


    if (h1Bear) {
        sellScore += 2;
    }


    if (m15Bear) {
        sellScore += 2;
    }


    if (m5Bear) {
        sellScore += 1;
    }


    if (sellSignal.confirmed) {
        sellScore += 2;
    }


    if (sellRSI) {
        sellScore += 1;
    }


    /* =====================================================
       A+ THRESHOLD
       =====================================================

       Maximum score = 10.

       We require:
       • strong directional agreement
       • M15/M5 confirmation
       • actual candle confirmation
       • acceptable RSI
    */

    const BUY_THRESHOLD = 8;

    const SELL_THRESHOLD = 8;


    /* =====================================================
       BUY SETUP
       ===================================================== */

    if (
        buyScore >= BUY_THRESHOLD &&
        h4Bull &&
        h1Bull &&
        m15Bull &&
        m5Bull &&
        buySignal.confirmed &&
        buyRSI
    ) {

        const entry =
            m5[
                m5.length - 1
            ].close;


        const atr =
            a.M5.atr ||
            calculateATR(
                m5
            );


        if (!atr) {

            return {

                direction: "WAIT",

                entry: null,

                sl: null,

                tp1: null,

                tp2: null,

                tp3: null,

                rr: "—",

                validity:
                    "Waiting for volatility calculation",

                trigger:
                    "ATR not ready",

                invalidation:
                    "—",

                verdict:
                    "WAIT — CALCULATING"

            };

        }


        const sl =
            calculateBuySL(
                m5,
                entry,
                atr
            );


        const risk =
            entry - sl;


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
                "Valid while M5 bullish structure remains intact",

            trigger:
                `BUY confirmation: ${buySignal.reason} | H4/H1/M15/M5 bullish | RSI ${a.M5.rsi.toFixed(1)} | Score ${buyScore}/10`,

            invalidation:
                `M5 closes below ${roundPrice(sl)}`,

            verdict:
                "BUY — A+ PRICE ACTION SETUP"

        };

    }


    /* =====================================================
       SELL SETUP
       ===================================================== */

    if (
        sellScore >= SELL_THRESHOLD &&
        h4Bear &&
        h1Bear &&
        m15Bear &&
        m5Bear &&
        sellSignal.confirmed &&
        sellRSI
    ) {

        const entry =
            m5[
                m5.length - 1
            ].close;


        const atr =
            a.M5.atr ||
            calculateATR(
                m5
            );


        if (!atr) {

            return {

                direction: "WAIT",

                entry: null,

                sl: null,

                tp1: null,

                tp2: null,

                tp3: null,

                rr: "—",

                validity:
                    "Waiting for volatility calculation",

                trigger:
                    "ATR not ready",

                invalidation:
                    "—",

                verdict:
                    "WAIT — CALCULATING"

            };

        }


        const sl =
            calculateSellSL(
                m5,
                entry,
                atr
            );


        const risk =
            sl - entry;


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
                "Valid while M5 bearish structure remains intact",

            trigger:
                `SELL confirmation: ${sellSignal.reason} | H4/H1/M15/M5 bearish | RSI ${a.M5.rsi.toFixed(1)} | Score ${sellScore}/10`,

            invalidation:
                `M5 closes above ${roundPrice(sl)}`,

            verdict:
                "SELL — A+ PRICE ACTION SETUP"

        };

    }


    /* =====================================================
       WAIT
       ===================================================== */

    let waitReason =
        "No A+ setup";


    if (
        buyScore > sellScore
    ) {

        waitReason =
            `BUY bias ${buyScore}/10 but confirmation is incomplete`;

    }


    if (
        sellScore > buyScore
    ) {

        waitReason =
            `SELL bias ${sellScore}/10 but confirmation is incomplete`;

    }


    if (
        buyScore === sellScore
    ) {

        waitReason =
            `BUY ${buyScore}/10 | SELL ${sellScore}/10`;

    }


    return {

        direction: "WAIT",

        entry: null,

        sl: null,

        tp1: null,

        tp2: null,

        tp3: null,

        rr: "—",

        validity:
            "Wait for A+ confirmation",

        trigger:
            `${waitReason} | BUY candle: ${buySignal.reason} | SELL candle: ${sellSignal.reason}`,

        invalidation:
            "—",

        verdict:
            "WAIT — NO A+ MULTI-TIMEFRAME ALIGNMENT"

    };

}


/* =========================================================
   UPDATE MARKET STRUCTURE
   ========================================================= */

function updateMarketStructure(
    a
) {

    const rows =
        document.querySelectorAll(
            ".level"
        );


    rows.forEach(row => {

        const label =
            row.children[0]?.innerText
            || "";


        const value =
            row.children[1];


        if (!value) {
            return;
        }


        if (
            label === "H4 Trend"
        ) {

            value.innerText =
                a.H4.structure;

        }


        if (
            label === "H1 Trend"
        ) {

            value.innerText =
                a.H1.structure;

        }


        if (
            label === "M15 Structure"
        ) {

            value.innerText =
                a.M15.structure;

        }


        if (
            label === "M5 Structure"
        ) {

            value.innerText =
                a.M5.structure;

        }

    });

}


/* =========================================================
   UPDATE SUPPORT / RESISTANCE
   ========================================================= */

function updateSupportResistance(
    a
) {

    const rows =
        document.querySelectorAll(
            ".level"
        );


    rows.forEach(row => {

        const label =
            row.children[0]?.innerText
            || "";


        const value =
            row.children[1];


        if (!value) {
            return;
        }


        if (
            label === "Resistance 1"
        ) {

            value.innerText =
                roundPrice(
                    a.H1.sr.resistance1
                );

        }


        if (
            label === "Resistance 2"
        ) {

            value.innerText =
                roundPrice(
                    a.H1.sr.resistance2
                );

        }


        if (
            label === "Support 1"
        ) {

            value.innerText =
                roundPrice(
                    a.H1.sr.support1
                );

        }


        if (
            label === "Support 2"
        ) {

            value.innerText =
                roundPrice(
                    a.H1.sr.support2
                );

        }

    });

}


/* =========================================================
   UPDATE INDICATORS
   ========================================================= */

function updateIndicators(
    a
) {

    const rows =
        document.querySelectorAll(
            ".level"
        );


    rows.forEach(row => {

        const label =
            row.children[0]?.innerText
            || "";


        const value =
            row.children[1];


        if (!value) {
            return;
        }


        if (
            label === "H4 RSI"
        ) {

            value.innerText =
                a.H4.rsi !== null
                    ? a.H4.rsi.toFixed(2)
                    : "—";

        }


        if (
            label === "H1 RSI"
        ) {

            value.innerText =
                a.H1.rsi !== null
                    ? a.H1.rsi.toFixed(2)
                    : "—";

        }


        if (
            label === "M15 RSI"
        ) {

            value.innerText =
                a.M15.rsi !== null
                    ? a.M15.rsi.toFixed(2)
                    : "—";

        }


        if (
            label === "M5 RSI"
        ) {

            value.innerText =
                a.M5.rsi !== null
                    ? a.M5.rsi.toFixed(2)
                    : "—";

        }


        if (
            label === "EMA Structure"
        ) {

            value.innerText =
                a.H1.ema.text;

        }

    });

}


/* =========================================================
   UPDATE SNIPER
   ========================================================= */

function updateSniper(
    setup
) {

    const rows =
        document.querySelectorAll(
            ".level"
        );


    rows.forEach(row => {

        const label =
            row.children[0]?.innerText
            || "";


        const value =
            row.children[1];


        if (!value) {
            return;
        }


        if (
            label === "Direction"
        ) {

            value.innerText =
                setup.direction;

        }


        if (
            label === "Entry"
        ) {

            value.innerText =
                setup.entry !== null
                    ? roundPrice(
                        setup.entry
                    )
                    : "—";

        }


        if (
            label === "Stop Loss"
        ) {

            value.innerText =
                setup.sl !== null
                    ? roundPrice(
                        setup.sl
                    )
                    : "—";

        }


        if (
            label === "TP1"
        ) {

            value.innerText =
                setup.tp1 !== null
                    ? roundPrice(
                        setup.tp1
                    )
                    : "—";

        }


        if (
            label === "TP2"
        ) {

            value.innerText =
                setup.tp2 !== null
                    ? roundPrice(
                        setup.tp2
                    )
                    : "—";

        }


        if (
            label === "TP3"
        ) {

            value.innerText =
                setup.tp3 !== null
                    ? roundPrice(
                        setup.tp3
                    )
                    : "—";

        }


        if (
            label === "Risk / Reward"
        ) {

            value.innerText =
                setup.rr;

        }


        if (
            label === "Validity"
        ) {

            value.innerText =
                setup.validity;

        }


        if (
            label === "Trigger"
        ) {

            value.innerText =
                setup.trigger;

        }


        if (
            label === "Invalidation"
        ) {

            value.innerText =
                setup.invalidation;

        }

    });


    const wait =
        document.querySelector(
            ".wait"
        );


    if (wait) {

        wait.innerText =
            setup.verdict;

    }

}


/* =========================================================
   UPDATE NEWS STATUS
   ========================================================= */

function updateNewsStatus() {

    const rows =
        document.querySelectorAll(
            ".level"
        );


    rows.forEach(row => {

        const label =
            row.children[0]?.innerText
            || "";


        const value =
            row.children[1];


        if (!value) {
            return;
        }


        if (
            label === "News Risk"
        ) {

            value.innerText =
                NEWS_RISK;

        }

    });

}


/* =========================================================
   LOAD MARKET DATA
   ========================================================= */

async function loadMarketData() {

    const now =
        Date.now();


    /* -----------------------------------------------------
       PRICE
       ----------------------------------------------------- */

    if (
        !marketData.price ||
        now -
        marketData.lastPriceFetch
        >= REFRESH_MS
    ) {

        marketData.price =
            await getLivePrice();

        marketData.lastPriceFetch =
            now;

    }


    /* -----------------------------------------------------
       M5
       ----------------------------------------------------- */

    if (
        !marketData.m5.length ||
        now -
        marketData.lastM5Fetch
        >= REFRESH_MS
    ) {

        marketData.m5 =
            await getCandles(
                "5min",
                120
            );

        marketData.lastM5Fetch =
            now;

    }


    /* -----------------------------------------------------
       M15
       ----------------------------------------------------- */

    if (
        !marketData.m15.length ||
        now -
        marketData.lastM15Fetch
        >= REFRESH_MS
    ) {

        marketData.m15 =
            await getCandles(
                "15min",
                120
            );

        marketData.lastM15Fetch =
            now;

    }


    /* -----------------------------------------------------
       H1
       -----------------------------------------------------

       H1 does not need to be downloaded every 10 minutes.
    */

    if (
        !marketData.h1.length ||
        now -
        marketData.lastH1Fetch
        >= 1800000
    ) {

        marketData.h1 =
            await getCandles(
                "1h",
                120
            );

        marketData.lastH1Fetch =
            now;

    }


    /* -----------------------------------------------------
       H4
       -----------------------------------------------------

       H4 changes slowly, so update once per hour.
    */

    if (
        !marketData.h4.length ||
        now -
        marketData.lastH4Fetch
        >= 3600000
    ) {

        marketData.h4 =
            await getCandles(
                "4h",
                120
            );

        marketData.lastH4Fetch =
            now;

    }

}


/* =========================================================
   BUILD ANALYSIS
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
   MAIN REFRESH
   ========================================================= */

async function refreshDashboard() {

    try {

        setText(
            "trend",
            "Updating H4 → H1 → M15 → M5..."
        );


        await loadMarketData();


        /* -------------------------------------------------
           LIVE PRICE
           ------------------------------------------------- */

        setText(
            "price",
            marketData.price !== null
                ? marketData.price.toFixed(5)
                : "Loading..."
        );


        /* -------------------------------------------------
           ANALYSIS
           ------------------------------------------------- */

        const analysis =
            buildAnalysis();


        /* -------------------------------------------------
           UPDATE DASHBOARD
           ------------------------------------------------- */

        updateMarketStructure(
            analysis
        );


        updateSupportResistance(
            analysis
        );


        updateIndicators(
            analysis
        );


        updateNewsStatus();


        /* -------------------------------------------------
           SNIPER
           ------------------------------------------------- */

        const sniper =
            calculateSniperSetup(
                analysis
            );


        updateSniper(
            sniper
        );


        /* -------------------------------------------------
           STATUS
           ------------------------------------------------- */

        setText(

            "trend",

            `H4 ${analysis.H4.structure} • ` +
            `H1 ${analysis.H1.structure} • ` +
            `M15 ${analysis.M15.structure} • ` +
            `M5 ${analysis.M5.structure} • ` +
            `Updated ${new Date().toLocaleTimeString()}`

        );


        console.log(
            "EUR/USD Analysis:",
            analysis
        );


        console.log(
            "Sniper Setup:",
            sniper
        );


    }

    catch (error) {

        console.error(
            "DASHBOARD ERROR:",
            error
        );


        setText(
            "trend",
            "ERROR: " +
            (
                error.message ||
                "Market data error"
            )
        );

    }

}


/* =========================================================
   START DASHBOARD
   ========================================================= */

refreshDashboard();


setInterval(
    refreshDashboard,
    REFRESH_MS
);
