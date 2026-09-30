/* =========================================================
   EUR/USD SNIPER DASHBOARD
   H4 → H1 → M15 → M5 ANALYSIS ENGINE
   ========================================================= */

const API_KEY = "8908432b6c784bc49aad6ccf64845991";

/* Refresh every 60 seconds */
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
   HELPER FUNCTIONS
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
    return Number(value).toFixed(5);
}


function pips(a, b) {
    return Math.abs(a - b) * 10000;
}


/* =========================================================
   FETCH LIVE PRICE
   ========================================================= */

async function getLivePrice() {

    const url =
        `https://api.twelvedata.com/price?symbol=EUR/USD&apikey=${API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "error") {
        throw new Error(data.message);
    }

    const price = num(data.price);

    if (!price) {
        throw new Error("Invalid EUR/USD price");
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

    const multiplier = 2 / (period + 1);

    let ema =
        candles
            .slice(0, period)
            .reduce((sum, c) => sum + c.close, 0) / period;

    for (let i = period; i < candles.length; i++) {

        ema =
            ((candles[i].close - ema) * multiplier) + ema;
    }

    return ema;
}


/* =========================================================
   RSI
   ========================================================= */

function calculateRSI(candles, period = 14) {

    if (candles.length < period + 1) {
        return null;
    }

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {

        const change =
            candles[i].close - candles[i - 1].close;

        if (change >= 0) {
            gains += change;
        } else {
            losses += Math.abs(change);
        }
    }

    let averageGain = gains / period;
    let averageLoss = losses / period;

    for (let i = period + 1; i < candles.length; i++) {

        const change =
            candles[i].close - candles[i - 1].close;

        const gain = Math.max(change, 0);
        const loss = Math.max(-change, 0);

        averageGain =
            ((averageGain * (period - 1)) + gain) / period;

        averageLoss =
            ((averageLoss * (period - 1)) + loss) / period;
    }

    if (averageLoss === 0) {
        return 100;
    }

    const rs = averageGain / averageLoss;

    return 100 - (100 / (1 + rs));
}


/* =========================================================
   SWING HIGH / LOW
   ========================================================= */

function findSwingLevels(candles, lookback = 60) {

    const data =
        candles.slice(-lookback);

    const highs =
        data.map(c => c.high);

    const lows =
        data.map(c => c.low);

    return {
        highest: Math.max(...highs),
        lowest: Math.min(...lows)
    };
}


/* =========================================================
   SUPPORT / RESISTANCE
   ========================================================= */

function calculateSupportResistance(candles) {

    const current =
        candles[candles.length - 1].close;

    const data =
        candles.slice(-80);

    const highs =
        data.map(c => c.high)
            .filter(x => x > current)
            .sort((a, b) => a - b);

    const lows =
        data.map(c => c.low)
            .filter(x => x < current)
            .sort((a, b) => b - a);

    let resistance1 =
        highs.length ? highs[0] : null;

    let resistance2 =
        highs.length > 1 ? highs[1] : null;

    let support1 =
        lows.length ? lows[0] : null;

    let support2 =
        lows.length > 1 ? lows[1] : null;


    /*
       If nearby candle levels are unavailable,
       use recent swing levels as fallback.
    */

    const swing =
        findSwingLevels(candles, 80);

    if (!resistance1) {
        resistance1 = swing.highest;
    }

    if (!resistance2) {
        resistance2 = resistance1 + 0.0010;
    }

    if (!support1) {
        support1 = swing.lowest;
    }

    if (!support2) {
        support2 = support1 - 0.0010;
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

    if (candles.length < 20) {
        return "INSUFFICIENT DATA";
    }

    const recent =
        candles.slice(-10);

    const previous =
        candles.slice(-20, -10);

    const recentHigh =
        Math.max(...recent.map(c => c.high));

    const previousHigh =
        Math.max(...previous.map(c => c.high));

    const recentLow =
        Math.min(...recent.map(c => c.low));

    const previousLow =
        Math.min(...previous.map(c => c.low));


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
   EMA STRUCTURE
   ========================================================= */

function getEMAAnalysis(candles) {

    const ema20 =
        calculateEMA(candles, 20);

    const ema50 =
        calculateEMA(candles, 50);

    const ema200 =
        calculateEMA(candles, 200);


    if (!ema20 || !ema50) {

        return {
            text: "Calculating...",
            ema20,
            ema50,
            ema200
        };
    }


    let text = "";


    if (ema20 > ema50) {
        text = "Bullish EMA alignment";
    }

    else if (ema20 < ema50) {
        text = "Bearish EMA alignment";
    }

    else {
        text = "EMA compression";
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

    const last =
        candles[candles.length - 1];

    const structure =
        calculateStructure(candles);

    const rsi =
        calculateRSI(candles);

    const ema =
        getEMAAnalysis(candles);

    const sr =
        calculateSupportResistance(candles);


    return {
        price: last.close,
        structure,
        rsi,
        ema,
        sr
    };
}


/* =========================================================
   H4 / H1 / M15 / M5 ANALYSIS
   ========================================================= */

function buildAnalysis() {

    const H4 =
        analyzeTimeframe(marketData.h4);

    const H1 =
        analyzeTimeframe(marketData.h1);

    const M15 =
        analyzeTimeframe(marketData.m15);

    const M5 =
        analyzeTimeframe(marketData.m5);


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


    /* =====================================================
       BUY SETUP
       ===================================================== */

    if (bullishHigherTF && bullishEntry) {

        const entry =
            a.M15.sr.support1 || price;

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

            direction: "BUY",

            entry,
            sl,
            tp1,
            tp2,
            tp3,

            rr: "1:2 minimum",

            validity:
                "1–3 hours — expires if M5 structure turns bearish",

            trigger:
                "M5 bullish structure + bullish M15 confirmation",

            invalidation:
                `M5 closes below ${roundPrice(sl)}`,

            verdict:
                "BUY — A+ conditions detected"

        };
    }


    /* =====================================================
       SELL SETUP
       ===================================================== */

    if (bearishHigherTF && bearishEntry) {

        const entry =
            a.M15.sr.resistance1 || price;

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

            direction: "SELL",

            entry,
            sl,
            tp1,
            tp2,
            tp3,

            rr: "1:2 minimum",

            validity:
                "1–3 hours — expires if M5 structure turns bullish",

            trigger:
                "M5 bearish structure + bearish M15 confirmation",

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

    const elements =
        document.querySelectorAll(".level");

    /*
       We locate rows by their text so this works
       with the current dashboard layout.
    */

    elements.forEach(row => {

        const label =
            row.children[0]?.innerText || "";

        const value =
            row.children[1];

        if (!value) return;


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
   ========================================================= */

function updateSupportResistance(a) {

    const rows =
        document.querySelectorAll(".level");


    rows.forEach(row => {

        const label =
            row.children[0]?.innerText || "";

        const value =
            row.children[1];

        if (!value) return;


        if (label === "Resistance 1") {

            value.innerText =
                roundPrice(a.H1.sr.resistance1);

        }


        if (label === "Resistance 2") {

            value.innerText =
                roundPrice(a.H1.sr.resistance2);

        }


        if (label === "Support 1") {

            value.innerText =
                roundPrice(a.H1.sr.support1);

        }


        if (label === "Support 2") {

            value.innerText =
                roundPrice(a.H1.sr.support2);

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

        if (!value) return;


        if (label === "H4 RSI") {

            value.innerText =
                a.H4.rsi
                    ? a.H4.rsi.toFixed(2)
                    : "—";

        }


        if (label === "H1 RSI") {

            value.innerText =
                a.H1.rsi
                    ? a.H1.rsi.toFixed(2)
                    : "—";

        }


        if (label === "M15 RSI") {

            value.innerText =
                a.M15.rsi
                    ? a.M15.rsi.toFixed(2)
                    : "—";

        }


        if (label === "M5 RSI") {

            value.innerText =
                a.M5.rsi
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

        if (!value) return;


        if (label === "Direction") {
            value.innerText =
                setup.direction;
        }

        if (label === "Entry") {
            value.innerText =
                setup.entry
                    ? roundPrice(setup.entry)
                    : "—";
        }

        if (label === "Stop Loss") {
            value.innerText =
                setup.sl
                    ? roundPrice(setup.sl)
                    : "—";
        }

        if (label === "TP1") {
            value.innerText =
                setup.tp1
                    ? roundPrice(setup.tp1)
                    : "—";
        }

        if (label === "TP2") {
            value.innerText =
                setup.tp2
                    ? roundPrice(setup.tp2)
                    : "—";
        }

        if (label === "TP3") {
            value.innerText =
                setup.tp3
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


    const wait =
        document.querySelector(".wait");

    if (wait) {
        wait.innerText =
            setup.verdict;
    }
}


/* =========================================================
   MAIN REFRESH
   ========================================================= */

async function refreshDashboard() {

    try {

        setText(
            "trend",
            "Loading H4 → H1 → M15 → M5 market data..."
        );


        /* Get live price */

        marketData.price =
            await getLivePrice();


        setText(
            "price",
            marketData.price.toFixed(5)
        );


        /* Get all timeframes */

        const [
            h4,
            h1,
            m15,
            m5
        ] = await Promise.all([

            getCandles("4h", 100),

            getCandles("1h", 100),

            getCandles("15min", 100),

            getCandles("5min", 100)

        ]);


        marketData.h4 = h4;
        marketData.h1 = h1;
        marketData.m15 = m15;
        marketData.m5 = m5;


        /* Analyze */

        const analysis =
            buildAnalysis();


        /* Update dashboard */

        updateMarketStructure(analysis);

        updateSupportResistance(analysis);

        updateIndicators(analysis);


        const sniper =
            calculateSniperSetup(analysis);


        updateSniper(sniper);


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
            "Dashboard error:",
            error
        );


        setText(
            "trend",
            "Market data error — retrying..."
        );

    }
}


/* =========================================================
   START
   ========================================================= */

refreshDashboard();


setInterval(
    refreshDashboard,
    REFRESH_MS
);
