/* =========================================================
   EUR/USD SNIPER DASHBOARD
   H4 → H1 → M15 → M5
   INSTITUTIONAL PRICE ACTION ENGINE
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

    if (!response.ok) {
        throw new Error("Price API HTTP error");
    }

    const data = await response.json();

    if (data.status === "error") {
        throw new Error(data.message || "Price API error");
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

    if (!response.ok) {
        throw new Error(`${interval} candle HTTP error`);
    }

    const data = await response.json();

    if (data.status === "error") {
        throw new Error(
            `${interval}: ${data.message || "API error"}`
        );
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

    if (!candles || candles.length < period) {
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

function calculateRSI(candles, period = 14) {

    if (!candles || candles.length < period + 1) {
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
   SWING DETECTION
   ========================================================= */

function findSwingHighs(candles, lookback = 80) {

    const data =
        candles.slice(-lookback);


    const swings = [];


    for (
        let i = 2;
        i < data.length - 2;
        i++
    ) {

        const c = data[i];


        if (
            c.high > data[i - 1].high &&
            c.high > data[i - 2].high &&
            c.high >= data[i + 1].high &&
            c.high >= data[i + 2].high
        ) {

            swings.push(c.high);
        }
    }


    return swings;
}


function findSwingLows(candles, lookback = 80) {

    const data =
        candles.slice(-lookback);


    const swings = [];


    for (
        let i = 2;
        i < data.length - 2;
        i++
    ) {

        const c = data[i];


        if (
            c.low < data[i - 1].low &&
            c.low < data[i - 2].low &&
            c.low <= data[i + 1].low &&
            c.low <= data[i + 2].low
        ) {

            swings.push(c.low);
        }
    }


    return swings;
}


/* =========================================================
   SUPPORT / RESISTANCE
   ========================================================= */

function calculateSupportResistance(
    candles,
    referencePrice = null
) {

    if (!candles || candles.length < 10) {

        return {

            resistance1: null,
            resistance2: null,
            support1: null,
            support2: null
        };
    }


    const current =
        referencePrice !== null
            ? referencePrice
            : candles[candles.length - 1].close;


    const highs =
        findSwingHighs(candles, 100);


    const lows =
        findSwingLows(candles, 100);


    /*
       Resistance:
       swing highs above current price.
    */

    const resistanceLevels =
        highs

            .filter(level =>
                level > current
            )

            .sort((a, b) => a - b);


    /*
       Support:
       swing lows below current price.
    */

    const supportLevels =
        lows

            .filter(level =>
                level < current
            )

            .sort((a, b) => b - a);


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
       Fallback using highest/lowest recent price.
    */

    if (resistance1 === null) {

        const recentHigh =
            Math.max(
                ...candles
                    .slice(-50)
                    .map(c => c.high)
            );

        if (recentHigh > current) {
            resistance1 = recentHigh;
        }
    }


    if (support1 === null) {

        const recentLow =
            Math.min(
                ...candles
                    .slice(-50)
                    .map(c => c.low)
            );

        if (recentLow < current) {
            support1 = recentLow;
        }
    }


    /*
       Second levels only if they are genuinely
       different from the first level.
    */

    if (
        resistance2 !== null &&
        resistance1 !== null &&
        Math.abs(resistance2 - resistance1) < 0.00020
    ) {

        resistance2 = null;
    }


    if (
        support2 !== null &&
        support1 !== null &&
        Math.abs(support2 - support1) < 0.00020
    ) {

        support2 = null;
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

    if (!candles || candles.length < 30) {

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
        calculateEMA(candles, 20);


    const ema50 =
        calculateEMA(candles, 50);


    const ema200 =
        calculateEMA(candles, 200);


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
        ema200 !== null &&
        ema20 > ema50 &&
        ema50 > ema200
    ) {

        text =
            "Strong Bullish EMA alignment";

    }

    else if (
        ema200 !== null &&
        ema20 < ema50 &&
        ema50 < ema200
    ) {

        text =
            "Strong Bearish EMA alignment";

    }

    else if (
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
   TIMEFRAME ANALYSIS
   ========================================================= */

function analyzeTimeframe(
    candles,
    livePrice = null
) {

    if (
        !candles ||
        candles.length === 0
    ) {

        return {

            price: null,

            structure: "INSUFFICIENT DATA",

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
        candles[candles.length - 1];


    const structure =
        calculateStructure(candles);


    const rsi =
        calculateRSI(candles);


    const ema =
        getEMAAnalysis(candles);


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
   BUILD COMPLETE ANALYSIS
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
   RECENT STRUCTURE LEVELS
   Used for SNIPER SL
   ========================================================= */

function recentSwingLow(candles) {

    const lows =
        findSwingLows(candles, 40);


    if (lows.length === 0) {

        return null;
    }


    return lows[lows.length - 1];
}


function recentSwingHigh(candles) {

    const highs =
        findSwingHighs(candles, 40);


    if (highs.length === 0) {

        return null;
    }


    return highs[highs.length - 1];
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


    /* =====================================================
       HIGHER TIMEFRAME DIRECTION
       ===================================================== */

    const bullishHigherTF =
        a.H4.structure === "BULLISH" &&
        a.H1.structure === "BULLISH";


    const bearishHigherTF =
        a.H4.structure === "BEARISH" &&
        a.H1.structure === "BEARISH";


    /* =====================================================
       H4 / H1 EMA CONFIRMATION
       ===================================================== */

    const bullishEMA =
        (
            a.H4.ema.text.includes("Bullish") ||
            a.H4.ema.text === "Calculating..."
        ) &&
        (
            a.H1.ema.text.includes("Bullish") ||
            a.H1.ema.text === "Calculating..."
        );


    const bearishEMA =
        (
            a.H4.ema.text.includes("Bearish") ||
            a.H4.ema.text === "Calculating..."
        ) &&
        (
            a.H1.ema.text.includes("Bearish") ||
            a.H1.ema.text === "Calculating..."
        );


    /* =====================================================
       M15 CONFIRMATION
       ===================================================== */

    const bullishM15 =
        a.M15.structure === "BULLISH" &&
        a.M15.rsi !== null &&
        a.M15.rsi >= 45 &&
        a.M15.rsi <= 70;


    const bearishM15 =
        a.M15.structure === "BEARISH" &&
        a.M15.rsi !== null &&
        a.M15.rsi >= 30 &&
        a.M15.rsi <= 55;


    /* =====================================================
       M5 SNIPER TRIGGER
       ===================================================== */

    const bullishM5 =
        a.M5.structure === "BULLISH" &&
        a.M5.rsi !== null &&
        a.M5.rsi >= 45 &&
        a.M5.rsi <= 65;


    const bearishM5 =
        a.M5.structure === "BEARISH" &&
        a.M5.rsi !== null &&
        a.M5.rsi >= 35 &&
        a.M5.rsi <= 55;


    /* =====================================================
       BUY SETUP
       ===================================================== */

    if (
        bullishHigherTF &&
        bullishEMA &&
        bullishM15 &&
        bullishM5
    ) {

        const entry =
            price;


        let sl =
            recentSwingLow(
                marketData.m15
            );


        /*
           If no M15 swing is available,
           use M5 swing.
        */

        if (
            sl === null ||
            sl >= entry
        ) {

            sl =
                recentSwingLow(
                    marketData.m5
                );
        }


        /*
           Final fallback.
        */

        if (
            sl === null ||
            sl >= entry
        ) {

            sl =
                entry - 0.0010;
        }


        /*
           Small safety buffer below structure.
        */

        sl =
            sl - 0.00010;


        const risk =
            entry - sl;


        if (
            risk <= 0 ||
            risk > 0.0030
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
                    "Risk too wide for A+ scalp",

                trigger:
                    "Wait for a tighter structural setup",

                invalidation:
                    "—",

                verdict:
                    "WAIT — Stop distance is not suitable."
            };
        }


        const tp1 =
            entry + risk;


        const tp2 =
            entry + (risk * 2);


        const tp3 =
            entry + (risk * 3);


        return {

            direction: "BUY",

            entry,

            sl,

            tp1,

            tp2,

            tp3,

            rr: "1:2 minimum",

            validity:
                "Valid while H4/H1/M15/M5 alignment remains intact",

            trigger:
                "H4 + H1 bullish, M15 confirmation and M5 bullish trigger",

            invalidation:
                `M5 closes below ${roundPrice(sl)}`,

            verdict:
                "BUY — A+ multi-timeframe setup"
        };
    }


    /* =====================================================
       SELL SETUP
       ===================================================== */

    if (
        bearishHigherTF &&
        bearishEMA &&
        bearishM15 &&
        bearishM5
    ) {

        const entry =
            price;


        let sl =
            recentSwingHigh(
                marketData.m15
            );


        if (
            sl === null ||
            sl <= entry
        ) {

            sl =
                recentSwingHigh(
                    marketData.m5
                );
        }


        if (
            sl === null ||
            sl <= entry
        ) {

            sl =
                entry + 0.0010;
        }


        /*
           Small safety buffer above structure.
        */

        sl =
            sl + 0.00010;


        const risk =
            sl - entry;


        if (
            risk <= 0 ||
            risk > 0.0030
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
                    "Risk too wide for A+ scalp",

                trigger:
                    "Wait for a tighter structural setup",

                invalidation:
                    "—",

                verdict:
                    "WAIT — Stop distance is not suitable."
            };
        }


        const tp1 =
            entry - risk;


        const tp2 =
            entry - (risk * 2);


        const tp3 =
            entry - (risk * 3);


        return {

            direction: "SELL",

            entry,

            sl,

            tp1,

            tp2,

            tp3,

            rr: "1:2 minimum",

            validity:
                "Valid while H4/H1/M15/M5 alignment remains intact",

            trigger:
                "H4 + H1 bearish, M15 confirmation and M5 bearish trigger",

            invalidation:
                `M5 closes above ${roundPrice(sl)}`,

            verdict:
                "SELL — A+ multi-timeframe setup"
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
            "No valid A+ setup currently",

        trigger:
            "Wait for H4/H1 direction + M15 confirmation + M5 trigger",

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
        document.querySelectorAll(".level");


    elements.forEach(row => {

        const label =
            row.children[0]?.innerText || "";


        const value =
            row.children[1];


        if (!value) {
            return;
        }


        if (label === "H4 Trend") {

            value.innerText =
                a.H4.structure;
        }


        if (label === "H1 Trend") {

            value.innerText =
                a.H1.structure;
        }


        if (label === "M15 Structure") {

            value.innerText =
                a.M15.structure;
        }


        if (label === "M5 Structure") {

            value.innerText =
                a.M5.structure;
        }

    });
}


/* =========================================================
   UPDATE SUPPORT / RESISTANCE
   H1 IS THE PRIMARY INTRADAY FRAMEWORK
   ========================================================= */

function updateSupportResistance(a) {

    const rows =
        document.querySelectorAll(".level");


    rows.forEach(row => {

        const label =
            row.children[0]?.innerText || "";


        const value =
            row.children[1];


        if (!value) {
            return;
        }


        if (label === "Resistance 1") {

            value.innerText =
                roundPrice(
                    a.H1.sr.resistance1
                );
        }


        if (label === "Resistance 2") {

            value.innerText =
                roundPrice(
                    a.H1.sr.resistance2
                );
        }


        if (label === "Support 1") {

            value.innerText =
                roundPrice(
                    a.H1.sr.support1
                );
        }


        if (label === "Support 2") {

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
        document.querySelectorAll(".level");


    rows.forEach(row => {

        const label =
            row.children[0]?.innerText || "";


        const value =
            row.children[1];


        if (!value) {
            return;
        }


        if (label === "H4 RSI") {

            value.innerText =
                a.H4.rsi !== null
                    ? a.H4.rsi.toFixed(2)
                    : "—";
        }


        if (label === "H1 RSI") {

            value.innerText =
                a.H1.rsi !== null
                    ? a.H1.rsi.toFixed(2)
                    : "—";
        }


        if (label === "M15 RSI") {

            value.innerText =
                a.M15.rsi !== null
                    ? a.M15.rsi.toFixed(2)
                    : "—";
        }


        if (label === "M5 RSI") {

            value.innerText =
                a.M5.rsi !== null
                    ? a.M5.rsi.toFixed(2)
                    : "—";
        }


        if (label === "EMA Structure") {

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
        document.querySelectorAll(".level");


    rows.forEach(row => {

        const label =
            row.children[0]?.innerText || "";


        const value =
            row.children[1];


        if (!value) {
            return;
        }


        if (label === "Direction") {

            value.innerText =
                setup.direction;
        }


        if (label === "Entry") {

            value.innerText =
                setup.entry !== null
                    ? roundPrice(setup.entry)
                    : "—";
        }


        if (label === "Stop Loss") {

            value.innerText =
                setup.sl !== null
                    ? roundPrice(setup.sl)
                    : "—";
        }


        if (label === "TP1") {

            value.innerText =
                setup.tp1 !== null
                    ? roundPrice(setup.tp1)
                    : "—";
        }


        if (label === "TP2") {

            value.innerText =
                setup.tp2 !== null
                    ? roundPrice(setup.tp2)
                    : "—";
        }


        if (label === "TP3") {

            value.innerText =
                setup.tp3 !== null
                    ? roundPrice(setup.tp3)
                    : "—";
        }


        if (label === "Risk / Reward") {

            value.innerText =
                setup.rr;
        }


        if (label === "Validity") {

            value.innerText =
                setup.validity;
        }


        if (label === "Trigger") {

            value.innerText =
                setup.trigger;
        }


        if (label === "Invalidation") {

            value.innerText =
                setup.invalidation;
        }

    });


    /*
       Only update the Sniper Setup verdict.
       Do not overwrite PRO VERDICT.
    */

    const sniperSection =
        document.querySelector(".sniper-verdict");


    if (sniperSection) {

        sniperSection.innerText =
            setup.verdict;
    }


    /*
       Compatibility fallback:
       if the page uses .wait for the Sniper Setup,
       update it.
    */

    const wait =
        document.querySelector(".wait");


    if (wait) {

        wait.innerText =
            setup.verdict;
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


        /* ---------------------------------------------
           LIVE PRICE
           --------------------------------------------- */

        marketData.price =
            await getLivePrice();


        setText(
            "price",
            marketData.price.toFixed(5)
        );


        /* ---------------------------------------------
           FETCH ALL TIMEFRAMES
           --------------------------------------------- */

        const [

            h4,

            h1,

            m15,

            m5

        ] = await Promise.all([

            getCandles("4h", 200),

            getCandles("1h", 200),

            getCandles("15min", 200),

            getCandles("5min", 200)

        ]);


        marketData.h4 =
            h4;


        marketData.h1 =
            h1;


        marketData.m15 =
            m15;


        marketData.m5 =
            m5;


        /* ---------------------------------------------
           ANALYSIS
           --------------------------------------------- */

        const analysis =
            buildAnalysis();


        /* ---------------------------------------------
           UPDATE DASHBOARD
           --------------------------------------------- */

        updateMarketStructure(
            analysis
        );


        updateSupportResistance(
            analysis
        );


        updateIndicators(
            analysis
        );


        /* ---------------------------------------------
           SNIPER SETUP
           --------------------------------------------- */

        const sniper =
            calculateSniperSetup(
                analysis
            );


        updateSniper(
            sniper
        );


        /* ---------------------------------------------
           STATUS LINE
           --------------------------------------------- */

        setText(
            "trend",

            `H4 ${analysis.H4.structure} • ` +
            `H1 ${analysis.H1.structure} • ` +
            `M15 ${analysis.M15.structure} • ` +
            `M5 ${analysis.M5.structure} • ` +
            `Updated ${new Date().toLocaleTimeString()}`
        );


        /* ---------------------------------------------
           DEBUG CONSOLE
           --------------------------------------------- */

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


        setText(
            "trend",
            "ERROR: " +
            (error.message || "Market data error")
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
