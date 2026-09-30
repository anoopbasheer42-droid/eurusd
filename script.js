/* =========================================================
   EUR/USD SNIPER DASHBOARD
   H4 → H1 → M15 → M5
   STABLE DATA ENGINE
   ========================================================= */

const API_KEY = "8908432b6c784bc49aad6ccf64845991";

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
   HELPERS
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
   FETCH WITH TIMEOUT
   ========================================================= */

async function fetchJSON(url) {

    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, 15000);

    try {

        const response =
            await fetch(url, {
                signal: controller.signal,
                cache: "no-store"
            });

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }

        return await response.json();

    } finally {

        clearTimeout(timeout);

    }
}


/* =========================================================
   LIVE PRICE
   ========================================================= */

async function getLivePrice() {

    const url =
        `https://api.twelvedata.com/price` +
        `?symbol=EUR/USD` +
        `&apikey=${API_KEY}`;

    const data =
        await fetchJSON(url);


    if (data.status === "error") {

        throw new Error(
            "Price API: " + data.message
        );

    }


    const price =
        num(data.price);


    if (price === null) {

        throw new Error(
            "Invalid price received"
        );

    }


    return price;
}


/* =========================================================
   CANDLE DATA
   ========================================================= */

async function getCandles(interval, outputsize = 100) {

    const url =
        `https://api.twelvedata.com/time_series` +
        `?symbol=EUR/USD` +
        `&interval=${interval}` +
        `&outputsize=${outputsize}` +
        `&timezone=Asia/Kolkata` +
        `&apikey=${API_KEY}`;


    const data =
        await fetchJSON(url);


    if (data.status === "error") {

        throw new Error(
            `${interval} API: ${data.message}`
        );

    }


    if (
        !data.values ||
        !Array.isArray(data.values) ||
        data.values.length < 20
    ) {

        throw new Error(
            `${interval}: insufficient candle data`
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

    if (candles.length < period) {
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

function calculateRSI(candles, period = 14) {

    if (candles.length < period + 1) {
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
                averageGain * (period - 1)
                + gain
            ) / period;


        averageLoss =
            (
                averageLoss * (period - 1)
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

function getSwingLevels(
    candles,
    lookback = 60
) {

    const data =
        candles.slice(-lookback);


    if (!data.length) {

        return {
            high: null,
            low: null
        };

    }


    return {

        high:
            Math.max(
                ...data.map(c => c.high)
            ),

        low:
            Math.min(
                ...data.map(c => c.low)
            )

    };
}


/* =========================================================
   SUPPORT / RESISTANCE
   ========================================================= */

function calculateSupportResistance(
    candles
) {

    if (!candles.length) {

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
       Find meaningful swing highs
       above current price.
    */

    const resistanceCandidates =
        data
            .map(c => c.high)
            .filter(
                level => level > current
            )
            .sort(
                (a, b) => a - b
            );


    /*
       Find meaningful swing lows
       below current price.
    */

    const supportCandidates =
        data
            .map(c => c.low)
            .filter(
                level => level < current
            )
            .sort(
                (a, b) => b - a
            );


    let resistance1 =
        resistanceCandidates[0] || null;


    let resistance2 =
        resistanceCandidates.find(
            level =>
                resistance1 !== null &&
                Math.abs(level - resistance1)
                > 0.00030
        ) || null;


    let support1 =
        supportCandidates[0] || null;


    let support2 =
        supportCandidates.find(
            level =>
                support1 !== null &&
                Math.abs(level - support1)
                > 0.00030
        ) || null;


    const swing =
        getSwingLevels(
            candles,
            80
        );


    if (
        resistance1 === null &&
        swing.high !== null &&
        swing.high > current
    ) {

        resistance1 =
            swing.high;

    }


    if (
        support1 === null &&
        swing.low !== null &&
        swing.low < current
    ) {

        support1 =
            swing.low;

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

    const last =
        candles[candles.length - 1];


    return {

        price:
            last.close,

        structure:
            calculateStructure(candles),

        rsi:
            calculateRSI(candles),

        ema:
            getEMAAnalysis(candles),

        sr:
            calculateSupportResistance(candles)

    };
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
   UPDATE MARKET STRUCTURE
   ========================================================= */

function updateMarketStructure(a) {

    document
        .querySelectorAll(".level")
        .forEach(row => {

            const label =
                row.children[0]?.innerText || "";

            const value =
                row.children[1];


            if (!value) return;


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
   UPDATE S/R
   ========================================================= */

function updateSupportResistance(a) {

    document
        .querySelectorAll(".level")
        .forEach(row => {

            const label =
                row.children[0]?.innerText || "";

            const value =
                row.children[1];


            if (!value) return;


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

    document
        .querySelectorAll(".level")
        .forEach(row => {

            const label =
                row.children[0]?.innerText || "";

            const value =
                row.children[1];


            if (!value) return;


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


    if (
        bullishHigherTF &&
        bullishEntry
    ) {

        const entry =
            price;


        const sl =
            Math.min(
                a.M15.sr.support1 || entry - 0.0010,
                entry - 0.0005
            );


        const risk =
            entry - sl;


        return {

            direction: "BUY",

            entry,

            sl,

            tp1:
                entry + risk,

            tp2:
                entry + risk * 2,

            tp3:
                entry + risk * 3,

            rr:
                "1:2 minimum",

            validity:
                "Valid while M5 remains bullish",

            trigger:
                "M5 bullish confirmation + M15 bullish structure",

            invalidation:
                `M5 closes below ${roundPrice(sl)}`,

            verdict:
                "BUY — A+ conditions detected"

        };
    }


    if (
        bearishHigherTF &&
        bearishEntry
    ) {

        const entry =
            price;


        const sl =
            Math.max(
                a.M15.sr.resistance1 || entry + 0.0010,
                entry + 0.0005
            );


        const risk =
            sl - entry;


        return {

            direction: "SELL",

            entry,

            sl,

            tp1:
                entry - risk,

            tp2:
                entry - risk * 2,

            tp3:
                entry - risk * 3,

            rr:
                "1:2 minimum",

            validity:
                "Valid while M5 remains bearish",

            trigger:
                "M5 bearish confirmation + M15 bearish structure",

            invalidation:
                `M5 closes above ${roundPrice(sl)}`,

            verdict:
                "SELL — A+ conditions detected"

        };
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
   UPDATE SNIPER
   ========================================================= */

function updateSniper(setup) {

    document
        .querySelectorAll(".level")
        .forEach(row => {

            const label =
                row.children[0]?.innerText || "";

            const value =
                row.children[1];


            if (!value) return;


            if (label === "Direction")
                value.innerText =
                    setup.direction;


            if (label === "Entry")
                value.innerText =
                    roundPrice(setup.entry);


            if (label === "Stop Loss")
                value.innerText =
                    roundPrice(setup.sl);


            if (label === "TP1")
                value.innerText =
                    roundPrice(setup.tp1);


            if (label === "TP2")
                value.innerText =
                    roundPrice(setup.tp2);


            if (label === "TP3")
                value.innerText =
                    roundPrice(setup.tp3);


            if (label === "Risk / Reward")
                value.innerText =
                    setup.rr;


            if (label === "Validity")
                value.innerText =
                    setup.validity;


            if (label === "Trigger")
                value.innerText =
                    setup.trigger;


            if (label === "Invalidation")
                value.innerText =
                    setup.invalidation;

        });


    /*
       Only update the PRO VERDICT.
       Do not overwrite the Sniper Setup heading.
    */

    const verdict =
        document.querySelector(
            ".card:nth-last-of-type(2) .wait"
        );


    if (verdict) {

        verdict.innerText =
            setup.verdict;

    }


    console.log(
        "SNIPER:",
        setup
    );
}


/* =========================================================
   MAIN REFRESH
   ========================================================= */

async function refreshDashboard() {

    setText(
        "trend",
        "Connecting to Twelve Data..."
    );


    try {

        /*
         * PRICE
         */

        const price =
            await getLivePrice();


        marketData.price =
            price;


        setText(
            "price",
            price.toFixed(5)
        );


        /*
         * CANDLES
         */

        setText(
            "trend",
            "Loading H4 → H1 → M15 → M5..."
        );


        const h4 =
            await getCandles("4h", 100);


        const h1 =
            await getCandles("1h", 100);


        const m15 =
            await getCandles("15min", 100);


        const m5 =
            await getCandles("5min", 100);


        marketData.h4 =
            h4;

        marketData.h1 =
            h1;

        marketData.m15 =
            m15;

        marketData.m5 =
            m5;


        /*
         * ANALYSIS
         */

        const analysis =
            buildAnalysis();


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
         * SNIPER
         */

        const sniper =
            calculateSniperSetup(
                analysis
            );


        updateSniper(
            sniper
        );


        /*
         * STATUS
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


    } catch (error) {

    console.error("DASHBOARD ERROR:", error);

    setText(
        "trend",
        "ERROR: " + error.message
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
