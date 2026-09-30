/* =========================================================
   EUR/USD SNIPER DASHBOARD
   H4 → H1 → M15 → M5 ANALYSIS ENGINE
   VERSION: STABLE SNIPER ENGINE
   ========================================================= */


/* =========================================================
   API / SETTINGS
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


/* =========================================================
   LIVE EUR/USD PRICE
   ========================================================= */

async function getLivePrice() {

    const url =
        `https://api.twelvedata.com/price` +
        `?symbol=EUR/USD` +
        `&apikey=${API_KEY}`;

    const response = await fetch(url);

    const data = await response.json();

    if (data.status === "error") {

        throw new Error(
            data.message || "Twelve Data price error"
        );

    }

    const price = num(data.price);

    if (price === null) {

        throw new Error(
            "Invalid EUR/USD live price"
        );

    }

    return price;

}


/* =========================================================
   FETCH CANDLE DATA
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

        throw new Error(
            data.message || `${interval} data error`
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
        averageGain /
        averageLoss;


    return 100 -
        (100 / (1 + rs));

}


/* =========================================================
   SWING LEVEL DETECTION
   ========================================================= */

function findSwingHighs(
    candles,
    lookback = 80
) {

    const data =
        candles.slice(-lookback);


    const swings = [];


    for (
        let i = 2;
        i < data.length - 2;
        i++
    ) {

        const high =
            data[i].high;


        if (
            high >= data[i - 1].high &&
            high >= data[i - 2].high &&
            high >= data[i + 1].high &&
            high >= data[i + 2].high
        ) {

            swings.push(high);

        }

    }


    return swings;

}


function findSwingLows(
    candles,
    lookback = 80
) {

    const data =
        candles.slice(-lookback);


    const swings = [];


    for (
        let i = 2;
        i < data.length - 2;
        i++
    ) {

        const low =
            data[i].low;


        if (
            low <= data[i - 1].low &&
            low <= data[i - 2].low &&
            low <= data[i + 1].low &&
            low <= data[i + 2].low
        ) {

            swings.push(low);

        }

    }


    return swings;

}


/* =========================================================
   SUPPORT / RESISTANCE
   ========================================================= */

function calculateSupportResistance(
    candles,
    livePrice = null
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
        livePrice !== null
            ? livePrice
            : candles[candles.length - 1].close;


    const highs =
        findSwingHighs(
            candles,
            80
        );


    const lows =
        findSwingLows(
            candles,
            80
        );


    /*
       RESISTANCE

       Only levels ABOVE current price.
    */

    const resistanceLevels =
        highs

            .filter(level =>
                level > current
            )

            .sort(
                (a, b) => a - b
            );


    /*
       SUPPORT

       Only levels BELOW current price.
    */

    const supportLevels =
        lows

            .filter(level =>
                level < current
            )

            .sort(
                (a, b) => b - a
            );


    let resistance1 =
        resistanceLevels.length > 0
            ? resistanceLevels[0]
            : null;


    let resistance2 =
        resistanceLevels.length > 1
            ? resistanceLevels[1]
            : null;


    let support1 =
        supportLevels.length > 0
            ? supportLevels[0]
            : null;


    let support2 =
        supportLevels.length > 1
            ? supportLevels[1]
            : null;


    /*
       FALLBACKS

       If no swing exists on one side,
       use recent candle extremes.
    */

    const recent =
        candles.slice(-40);


    const recentHigh =
        Math.max(
            ...recent.map(c => c.high)
        );


    const recentLow =
        Math.min(
            ...recent.map(c => c.low)
        );


    if (
        resistance1 === null &&
        recentHigh > current
    ) {

        resistance1 =
            recentHigh;

    }


    if (
        support1 === null &&
        recentLow < current
    ) {

        support1 =
            recentLow;

    }


    /*
       Final emergency fallback.

       This is only used when there is no
       usable level on that side.
    */

    if (resistance1 === null) {

        resistance1 =
            current + 0.0010;

    }


    if (resistance2 === null) {

        resistance2 =
            resistance1 + 0.0010;

    }


    if (support1 === null) {

        support1 =
            current - 0.0010;

    }


    if (support2 === null) {

        support2 =
            support1 - 0.0010;

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

    if (
        !candles ||
        candles.length < 20
    ) {

        return "INSUFFICIENT DATA";

    }


    const recent =
        candles.slice(-10);


    const previous =
        candles.slice(-20, -10);


    const recentHigh =
        Math.max(
            ...recent.map(c => c.high)
        );


    const previousHigh =
        Math.max(
            ...previous.map(c => c.high)
        );


    const recentLow =
        Math.min(
            ...recent.map(c => c.low)
        );


    const previousLow =
        Math.min(
            ...previous.map(c => c.low)
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


    if (
        ema20 > ema50
    ) {

        text =
            "Bullish EMA alignment";

    }

    else if (
        ema20 < ema50
    ) {

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
   COMPLETE TIMEFRAME ANALYSIS
   ========================================================= */

function analyzeTimeframe(
    candles,
    livePrice
) {

    if (
        !candles ||
        candles.length === 0
    ) {

        return {

            price: livePrice,

            structure: "INSUFFICIENT DATA",

            rsi: null,

            ema: {

                text: "Calculating...",

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
            candles,
            livePrice
        );


    return {

        price: last.close,

        structure,

        rsi,

        ema,

        sr

    };

}


/* =========================================================
   BUILD ALL TIMEFRAME ANALYSIS
   ========================================================= */

function buildAnalysis() {

    const H4 =
        analyzeTimeframe(
            marketData.h4,
            marketData.price
        );


    const H1 =
        analyzeTimeframe(
            marketData.h1,
            marketData.price
        );


    const M15 =
        analyzeTimeframe(
            marketData.m15,
            marketData.price
        );


    const M5 =
        analyzeTimeframe(
            marketData.m5,
            marketData.price
        );


    return {

        H4,
        H1,
        M15,
        M5

    };

}


/* =========================================================
   SNIPER ENGINE
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
                "WAIT — Loading market data."

        };

    }


    /*
       HIGHER-TIMEFRAME DIRECTION
    */

    const bullishHigherTF =
        a.H4.structure === "BULLISH" &&
        a.H1.structure === "BULLISH";


    const bearishHigherTF =
        a.H4.structure === "BEARISH" &&
        a.H1.structure === "BEARISH";


    /*
       M15 / M5 CONFIRMATION
    */

    const bullishEntry =
        (
            a.M15.structure === "BULLISH"
        ) &&
        (
            a.M5.structure === "BULLISH"
        ) &&
        (
            a.M5.rsi !== null
        ) &&
        (
            a.M5.rsi >= 45 &&
            a.M5.rsi <= 70
        );


    const bearishEntry =
        (
            a.M15.structure === "BEARISH"
        ) &&
        (
            a.M5.structure === "BEARISH"
        ) &&
        (
            a.M5.rsi !== null
        ) &&
        (
            a.M5.rsi >= 30 &&
            a.M5.rsi <= 55
        );


    /* =====================================================
       BUY SETUP
       ===================================================== */

    if (
        bullishHigherTF &&
        bullishEntry
    ) {

        /*
           Entry is current market price
           rather than an old support level.
        */

        const entry =
            price;


        /*
           SL below H1 support when possible.
        */

        let sl =
            a.H1.sr.support1;


        if (
            !sl ||
            sl >= entry
        ) {

            sl =
                entry - 0.0010;

        }


        /*
           Keep a minimum 10-pip protective distance.
        */

        if (
            entry - sl < 0.0010
        ) {

            sl =
                entry - 0.0010;

        }


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
                "1–3 hours — invalid if M15/M5 structure turns bearish",

            trigger:
                "H4 + H1 bullish direction with M15 + M5 bullish confirmation",

            invalidation:
                `M5 closes below ${roundPrice(sl)}`,

            verdict:
                "BUY — A+ conditions detected"

        };

    }


    /* =====================================================
       SELL SETUP
       ===================================================== */

    if (
        bearishHigherTF &&
        bearishEntry
    ) {

        /*
           Entry at current market price.
        */

        const entry =
            price;


        /*
           SL above H1 resistance.
        */

        let sl =
            a.H1.sr.resistance1;


        if (
            !sl ||
            sl <= entry
        ) {

            sl =
                entry + 0.0010;

        }


        /*
           Minimum 10-pip protection.
        */

        if (
            sl - entry < 0.0010
        ) {

            sl =
                entry + 0.0010;

        }


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
                "1–3 hours — invalid if M15/M5 structure turns bullish",

            trigger:
                "H4 + H1 bearish direction with M15 + M5 bearish confirmation",

            invalidation:
                `M5 closes above ${roundPrice(sl)}`,

            verdict:
                "SELL — A+ conditions detected"

        };

    }


    /* =====================================================
       NO A+ SETUP
       ===================================================== */

    return {

        direction: "WAIT",

        entry: null,

        sl: null,

        tp1: null,

        tp2: null,

        tp3: null,

        rr: "—",

        validity:
            "No valid setup currently",

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

    const rows =
        document.querySelectorAll(
            ".level"
        );


    rows.forEach(row => {

        const label =
            row.children[0]?.innerText
                ?.trim() || "";


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

function updateSupportResistance(a) {

    const rows =
        document.querySelectorAll(
            ".level"
        );


    rows.forEach(row => {

        const label =
            row.children[0]?.innerText
                ?.trim() || "";


        const value =
            row.children[1];


        if (!value) {
            return;
        }


        /*
           IMPORTANT:

           H1 is used as the primary
           intraday support/resistance
           framework.
        */

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
            row.children[0]?.innerText
                ?.trim() || "";


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
   UPDATE SNIPER SETUP
   ========================================================= */

function updateSniper(setup) {

    const rows =
        document.querySelectorAll(
            ".level"
        );


    rows.forEach(row => {

        const label =
            row.children[0]?.innerText
                ?.trim() || "";


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


    /*
       Update Sniper Setup verdict.
    */

    const sniperVerdicts =
        document.querySelectorAll(
            ".wait"
        );


    sniperVerdicts.forEach(el => {

        el.innerText =
            setup.verdict;

    });

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
           FETCH ALL TIMEFRAMES
        */

        const [

            h4,
            h1,
            m15,
            m5

        ] = await Promise.all([

            getCandles(
                "4h",
                200
            ),

            getCandles(
                "1h",
                200
            ),

            getCandles(
                "15min",
                200
            ),

            getCandles(
                "5min",
                200
            )

        ]);


        /*
           SAVE MARKET DATA
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
           SNIPER SETUP
        */

        const sniper =
            calculateSniperSetup(
                analysis
            );


        updateSniper(
            sniper
        );


        /*
           STATUS LINE
        */

        setText(
            "trend",

            `H4 ${analysis.H4.structure} • ` +
            `H1 ${analysis.H1.structure} • ` +
            `M15 ${analysis.M15.structure} • ` +
            `M5 ${analysis.M5.structure} • ` +
            `Updated ${new Date().toLocaleTimeString()}`
        );


        /*
           CONSOLE DEBUG
        */

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
           Show actual error instead of
           leaving the dashboard stuck on
           "Calculating..."
        */

        setText(
            "trend",
            "ERROR: " +
            (
                error.message ||
                "Unknown dashboard error"
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
