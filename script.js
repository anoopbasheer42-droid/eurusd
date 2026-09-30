/* =========================================================
   EUR/USD SNIPER DASHBOARD
   H4 → H1 → M15 → M5 ANALYSIS ENGINE
   ========================================================= */


/* =========================================================
   API KEY
   ========================================================= */

const API_KEY = "8908432b6c784bc49aad6ccf64845991";


/* =========================================================
   SETTINGS
   ========================================================= */

const REFRESH_MS = 60000;


/* =========================================================
   GLOBAL DATA
   ========================================================= */

let marketData = {

    h4: [],
    h1: [],
    m15: [],
    m5: [],

    price: null

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
            data.message || "Twelve Data price error"
        );

    }


    const price =
        num(data.price);


    if (price === null) {

        throw new Error(
            "Invalid EUR/USD live price"
        );

    }


    return price;

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
            `${interval}: ${data.message || "Twelve Data error"}`
        );

    }


    if (!data.values ||
        !Array.isArray(data.values)) {

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

    if (!candles ||
        candles.length < period) {

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

    if (!candles ||
        candles.length < period + 1) {

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
                (averageGain * (period - 1))
                + gain
            ) / period;


        averageLoss =
            (
                (averageLoss * (period - 1))
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
   SWING LEVELS
   ========================================================= */

function findSwingLevels(
    candles,
    lookback = 80
) {

    const data =
        candles.slice(-lookback);


    if (!data.length) {

        return {

            highest: null,
            lowest: null

        };

    }


    const highs =
        data.map(c => c.high);


    const lows =
        data.map(c => c.low);


    return {

        highest:
            Math.max(...highs),

        lowest:
            Math.min(...lows)

    };

}


/* =========================================================
   SUPPORT / RESISTANCE
   =========================================================

   Uses actual recent swing highs/lows.

   Levels are kept on the correct side of
   the current price.

   Nearby levels are clustered together so
   tiny differences are not treated as
   separate major levels.
   ========================================================= */

function calculateSupportResistance(candles) {

    if (!candles ||
        candles.length < 20) {

        return {

            resistance1: null,
            resistance2: null,

            support1: null,
            support2: null

        };

    }


    const current =
        candles[candles.length - 1].close;


    const data =
        candles.slice(-80);


    /*
       Collect highs above current price.
    */

    const rawResistance =
        data
            .map(c => c.high)
            .filter(
                level => level > current
            )
            .sort(
                (a, b) => a - b
            );


    /*
       Collect lows below current price.
    */

    const rawSupport =
        data
            .map(c => c.low)
            .filter(
                level => level < current
            )
            .sort(
                (a, b) => b - a
            );


    /*
       Cluster nearby levels.

       0.00030 = 3 pips.

       Levels closer than this are treated
       as one area.
    */

    function clusterLevels(
        levels,
        distance = 0.00030
    ) {

        const result = [];


        for (const level of levels) {

            if (
                result.length === 0 ||
                Math.abs(
                    level -
                    result[result.length - 1]
                ) > distance
            ) {

                result.push(level);

            }

        }


        return result;

    }


    const resistanceLevels =
        clusterLevels(
            rawResistance
        );


    const supportLevels =
        clusterLevels(
            rawSupport
        );


    let resistance1 =
        resistanceLevels[0] || null;


    let resistance2 =
        resistanceLevels[1] || null;


    let support1 =
        supportLevels[0] || null;


    let support2 =
        supportLevels[1] || null;


    /*
       Fallback to recent swing high/low.
    */

    const swing =
        findSwingLevels(
            candles,
            80
        );


    if (
        resistance1 === null &&
        swing.highest !== null &&
        swing.highest > current
    ) {

        resistance1 =
            swing.highest;

    }


    if (
        support1 === null &&
        swing.lowest !== null &&
        swing.lowest < current
    ) {

        support1 =
            swing.lowest;

    }


    /*
       Do NOT invent a fake S/R level
       if the market data does not provide one.
    */

    if (
        resistance2 === null &&
        resistance1 !== null
    ) {

        const higher =
            data
                .map(c => c.high)
                .filter(
                    level =>
                        level >
                        resistance1
                )
                .sort(
                    (a, b) => a - b
                );


        if (higher.length) {

            resistance2 =
                higher[0];

        }

    }


    if (
        support2 === null &&
        support1 !== null
    ) {

        const lower =
            data
                .map(c => c.low)
                .filter(
                    level =>
                        level <
                        support1
                )
                .sort(
                    (a, b) => b - a
                );


        if (lower.length) {

            support2 =
                lower[0];

        }

    }


    return {

        resistance1,
        resistance2,

        support1,
        support2

    };

}


/* =========================================================
   MARKET STRUCTURE
   ========================================================= */

function calculateStructure(candles) {

    if (!candles ||
        candles.length < 20) {

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

function getEMAAnalysis(candles) {

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


    if (ema20 > ema50) {

        text =
            "Bullish EMA alignment";

    }

    else if (ema20 < ema50) {

        text =
            "Bearish EMA alignment";

    }

    else {

        text =
            "EMA compression";

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

function analyzeTimeframe(candles) {

    if (!candles ||
        candles.length === 0) {

        return {

            price: null,

            structure:
                "INSUFFICIENT DATA",

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
        candles[candles.length - 1];


    return {

        price:
            last.close,

        structure:
            calculateStructure(
                candles
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
   BUILD FULL ANALYSIS
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
   SNIPER SETUP ENGINE
   ========================================================= */

function calculateSniperSetup(a) {

    const price =
        marketData.price;


    if (price === null) {

        return {

            direction: "WAIT",

            entry: null,
            sl: null,

            tp1: null,
            tp2: null,
            tp3: null,

            rr: "—",

            validity:
                "Waiting for live price",

            trigger:
                "Waiting for market data",

            invalidation:
                "—",

            verdict:
                "WAIT — Market data loading."

        };

    }


    /*
       Higher-timeframe direction
    */

    const bullishHigherTF =
        a.H4.structure === "BULLISH" &&
        a.H1.structure === "BULLISH";


    const bearishHigherTF =
        a.H4.structure === "BEARISH" &&
        a.H1.structure === "BEARISH";


    /*
       Entry confirmation
    */

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


    /* =====================================================
       BUY
       ===================================================== */

    if (
        bullishHigherTF &&
        bullishEntry &&
        a.M15.sr.support1 !== null
    ) {

        const entry =
            a.M15.sr.support1;


        /*
           Only consider the setup if entry
           is reasonably close to current price.
        */

        const distance =
            Math.abs(
                price - entry
            );


        if (distance <= 0.0020) {

            const sl =
                entry - 0.0010;


            const risk =
                entry - sl;


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

                rr:
                    "1:3",

                validity:
                    "1–3 hours — invalid if M5 turns bearish",

                trigger:
                    "H4 + H1 bullish, M15 + M5 bullish confirmation",

                invalidation:
                    `M5 closes below ${roundPrice(sl)}`,

                verdict:
                    "BUY — A+ multi-timeframe alignment"

            };

        }

    }


    /* =====================================================
       SELL
       ===================================================== */

    if (
        bearishHigherTF &&
        bearishEntry &&
        a.M15.sr.resistance1 !== null
    ) {

        const entry =
            a.M15.sr.resistance1;


        const distance =
            Math.abs(
                price - entry
            );


        if (distance <= 0.0020) {

            const sl =
                entry + 0.0010;


            const risk =
                sl - entry;


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

                rr:
                    "1:3",

                validity:
                    "1–3 hours — invalid if M5 turns bullish",

                trigger:
                    "H4 + H1 bearish, M15 + M5 bearish confirmation",

                invalidation:
                    `M5 closes above ${roundPrice(sl)}`,

                verdict:
                    "SELL — A+ multi-timeframe alignment"

            };

        }

    }


    /* =====================================================
       WAIT
       ===================================================== */

    return {

        direction:
            "WAIT",

        entry:
            null,

        sl:
            null,

        tp1:
            null,

        tp2:
            null,

        tp3:
            null,

        rr:
            "—",

        validity:
            "No valid A+ setup currently",

        trigger:
            "Wait for H4/H1 direction + M15/M5 confirmation",

        invalidation:
            "—",

        verdict:
            "WAIT — No A+ multi-timeframe alignment."

    };

}


/* =========================================================
   UPDATE MARKET STRUCTURE
   ========================================================= */

function updateMarketStructure(a) {

    const elements =
        document.querySelectorAll(
            ".level"
        );


    elements.forEach(row => {

        const label =
            row.children[0]
                ?.innerText
                ?.trim() || "";


        const value =
            row.children[1];


        if (!value) return;


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

function updateSupportResistance(a) {

    const rows =
        document.querySelectorAll(
            ".level"
        );


    rows.forEach(row => {

        const label =
            row.children[0]
                ?.innerText
                ?.trim() || "";


        const value =
            row.children[1];


        if (!value) return;


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

function updateIndicators(a) {

    const rows =
        document.querySelectorAll(
            ".level"
        );


    rows.forEach(row => {

        const label =
            row.children[0]
                ?.innerText
                ?.trim() || "";


        const value =
            row.children[1];


        if (!value) return;


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
   UPDATE SNIPER SETUP
   ========================================================= */

function updateSniper(setup) {

    const rows =
        document.querySelectorAll(
            ".level"
        );


    rows.forEach(row => {

        const label =
            row.children[0]
                ?.innerText
                ?.trim() || "";


        const value =
            row.children[1];


        if (!value) return;


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


    /*
       IMPORTANT:
       Update only the Sniper Setup verdict,
       not the PRO VERDICT.
    */

    const cards =
        document.querySelectorAll(
            ".card"
        );


    for (const card of cards) {

        const heading =
            card.querySelector("h2");


        if (
            heading &&
            heading.innerText
                .includes("Sniper Setup")
        ) {

            const verdict =
                card.querySelector(".wait");


            if (verdict) {

                verdict.innerText =
                    setup.verdict;

            }

            break;

        }

    }


    /*
       Update PRO VERDICT separately.
    */

    for (const card of cards) {

        const heading =
            card.querySelector("h2");


        if (
            heading &&
            heading.innerText
                .includes("PRO VERDICT")
        ) {

            const verdict =
                card.querySelector(".wait");


            if (verdict) {

                verdict.innerText =
                    setup.verdict;

            }

            break;

        }

    }

}


/* =========================================================
   MAIN DASHBOARD REFRESH
   ========================================================= */

async function refreshDashboard() {

    try {

        setText(
            "trend",
            "Loading H4 → H1 → M15 → M5 market data..."
        );


        /*
           LIVE PRICE
        */

        marketData.price =
            await getLivePrice();


        setText(
            "price",
            marketData.price.toFixed(5)
        );


        /*
           LOAD ALL TIMEFRAMES
        */

        const results =
            await Promise.all([

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
            results[0];


        marketData.h1 =
            results[1];


        marketData.m15 =
            results[2];


        marketData.m5 =
            results[3];


        /*
           BUILD ANALYSIS
        */

        const analysis =
            buildAnalysis();


        /*
           UPDATE DASHBOARD
        */

        updateMarketStructure(
            analysis
        );


        updateSupportResistance(
            analysis
        );


        updateIndicators(
            analysis
        );


        /*
           SNIPER ENGINE
        */

        const sniper =
            calculateSniperSetup(
                analysis
            );


        updateSniper(
            sniper
        );


        /*
           STATUS
        */

        setText(
            "trend",

            `H4 ${analysis.H4.structure} • ` +
            `H1 ${analysis.H1.structure} • ` +
            `M15 ${analysis.M15.structure} • ` +
            `M5 ${analysis.M5.structure} • ` +
            `Updated ${new Date().toLocaleTimeString()}`

        );


        console.log(
            "EUR/USD analysis:",
            analysis
        );


        console.log(
            "Sniper setup:",
            sniper
        );

    }


    catch (error) {

        console.error(
            "DASHBOARD ERROR:",
            error
        );


        /*
           Show the actual error instead
           of leaving the dashboard stuck
           on "Calculating..."
        */

        setText(
            "trend",
            "ERROR: " +
            (
                error.message ||
                "Unknown error"
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
