// ============================================================
// EUR/USD SNIPER DASHBOARD
// LIVE MARKET DATA + SNIPER + ELITE SCALPING
// ============================================================

// IMPORTANT:
// Use your own Twelve Data API key.
// If this key has been exposed publicly, replace it.
const API_KEY = "8908432b6c784bc49aad6ccf64845991";

const SYMBOL = "EUR/USD";

const PRICE_URL =
    "https://api.twelvedata.com/price";

const TIME_SERIES_URL =
    "https://api.twelvedata.com/time_series";

const NEWS_URL =
    "https://xoomar.com/api/markets/calendar?importance=high";


// ============================================================
// SNIPER SETTINGS
// ============================================================

const SNIPER_MIN_SCORE = 75;

// Sniper structural risk limits.
// We do NOT want an ultra-tight SL producing meaningless TP levels.
const SNIPER_MIN_RISK_PIPS = 5;
const SNIPER_MAX_RISK_PIPS = 30;

const SNIPER_SL_BUFFER = 0.00010;


// ============================================================
// ELITE SCALP SETTINGS
// ============================================================

const SCALP_WINDOW_MINUTES = 120;
const SCALP_MIN_SCORE = 80;
const SCALP_MIN_RR = 2.0;

const SCALP_MIN_RISK_PIPS = 3;
const SCALP_MAX_RISK_PIPS = 15;

const SCALP_MAX_EMA_DISTANCE = 0.00050;
const SCALP_SL_BUFFER = 0.00010;

const BULLISH_RSI_MIN = 52;
const BULLISH_RSI_MAX = 68;

const BEARISH_RSI_MIN = 32;
const BEARISH_RSI_MAX = 48;


// ============================================================
// GLOBAL DATA
// ============================================================

let marketData = {

    price: null,

    h4: {
        candles: [],
        trend: "RANGE",
        rsi: null,
        ema20: null,
        ema50: null
    },

    h1: {
        candles: [],
        trend: "RANGE",
        rsi: null,
        ema20: null,
        ema50: null
    },

    m15: {
        candles: [],
        structure: "RANGE",
        rsi: null,
        ema20: null,
        ema50: null
    },

    m5: {
        candles: [],
        structure: "RANGE",
        rsi: null,
        ema20: null,
        ema50: null
    },

    resistance1: null,
    resistance2: null,

    support1: null,
    support2: null,

    emaStructure: "NEUTRAL",

    news: {
        clear: false,
        risk: "UNKNOWN",
        events: []
    }
};


// ============================================================
// LOCKED SETUP STATE
// ============================================================

let sniperSetup = {

    active: false,

    direction: null,

    setupTime: null,

    entry: null,

    stopLoss: null,

    tp1: null,

    tp2: null,

    tp3: null
};


// ============================================================
// PAGE LOAD
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadMarketData();

        // Refresh every 2 minutes
        setInterval(
            loadMarketData,
            120000
        );

    }
);


// ============================================================
// CHART SWITCHER
// ============================================================

function changeChart(interval) {

    const chart =
        document.getElementById(
            "tradingChart"
        );

    if (!chart) return;

    const intervals = {

        "5min": "5",
        "15min": "15",
        "1h": "60",
        "4h": "240"

    };

    const tvInterval =
        intervals[interval] || "15";

    const url =
        "https://www.tradingview.com/widgetembed/" +
        "?frameElementId=tradingviewChart" +
        "&symbol=FX:EURUSD" +
        "&interval=" + tvInterval +
        "&hidesidetoolbar=1" +
        "&symboledit=1" +
        "&saveimage=0" +
        "&toolbarbg=f1f3f6" +
        "&studies=[]" +
        "&hideideas=1" +
        "&theme=dark" +
        "&style=1" +
        "&timezone=Asia%2FKolkata";

    chart.src = url;


    document
        .querySelectorAll(".chart-btn")
        .forEach(btn => {

            btn.classList.remove(
                "active"
            );

        });


    const buttonMap = {

        "5min": "btnM5",
        "15min": "btnM15",
        "1h": "btnH1",
        "4h": "btnH4"

    };


    const activeButton =
        document.getElementById(
            buttonMap[interval]
        );


    if (activeButton) {

        activeButton.classList.add(
            "active"
        );

    }
}


// ============================================================
// MAIN MARKET DATA LOADER
// ============================================================

async function loadMarketData() {

    setText(
        "priceStatus",
        "LOADING MARKET DATA..."
    );


    try {

        const [

            price,
            h4Candles,
            h1Candles,
            m15Candles,
            m5Candles,
            news

        ] = await Promise.all([

            getPrice(),

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
            ),

            getNews()

        ]);


        marketData.price =
            price;


        marketData.h4.candles =
            h4Candles;

        marketData.h1.candles =
            h1Candles;

        marketData.m15.candles =
            m15Candles;

        marketData.m5.candles =
            m5Candles;


        // ====================================================
        // MARKET STRUCTURE
        // ====================================================

        marketData.h4.trend =
            getMarketStructure(
                h4Candles
            );

        marketData.h1.trend =
            getMarketStructure(
                h1Candles
            );

        marketData.m15.structure =
            getMarketStructure(
                m15Candles
            );

        marketData.m5.structure =
            getMarketStructure(
                m5Candles
            );


        // ====================================================
        // RSI
        // ====================================================

        marketData.h4.rsi =
            calculateRSI(
                h4Candles
            );

        marketData.h1.rsi =
            calculateRSI(
                h1Candles
            );

        marketData.m15.rsi =
            calculateRSI(
                m15Candles
            );

        marketData.m5.rsi =
            calculateRSI(
                m5Candles
            );


        // ====================================================
        // EMA
        // ====================================================

        marketData.h4.ema20 =
            calculateEMA(
                h4Candles,
                20
            );

        marketData.h4.ema50 =
            calculateEMA(
                h4Candles,
                50
            );

        marketData.h1.ema20 =
            calculateEMA(
                h1Candles,
                20
            );

        marketData.h1.ema50 =
            calculateEMA(
                h1Candles,
                50
            );

        marketData.m15.ema20 =
            calculateEMA(
                m15Candles,
                20
            );

        marketData.m15.ema50 =
            calculateEMA(
                m15Candles,
                50
            );

        marketData.m5.ema20 =
            calculateEMA(
                m5Candles,
                20
            );

        marketData.m5.ema50 =
            calculateEMA(
                m5Candles,
                50
            );


        // ====================================================
        // SUPPORT / RESISTANCE
        // ====================================================

        const sr =
            calculateSupportResistance(
                h1Candles
            );


        marketData.resistance1 =
            sr.resistance1;

        marketData.resistance2 =
            sr.resistance2;

        marketData.support1 =
            sr.support1;

        marketData.support2 =
            sr.support2;


        // ====================================================
        // EMA STRUCTURE
        // ====================================================

        marketData.emaStructure =
            getEMAStructure();


        // ====================================================
        // NEWS
        // ====================================================

        marketData.news =
            news;


        // ====================================================
        // UPDATE DASHBOARD
        // ====================================================

        updateDashboard();


        // ====================================================
        // ENGINES
        // ====================================================

        runSniperEngine();

        runEliteScalpingEngine();

        runProAnalysis();

        runEliteTradeGate();


        setText(
            "priceStatus",
            "MARKET DATA LOADED"
        );


    } catch (error) {

        console.error(
            "Market data error:",
            error
        );


        setText(
            "priceStatus",
            "DATA LOAD FAILED"
        );

    }
}


// ============================================================
// PRICE
// ============================================================

async function getPrice() {

    const url =
        PRICE_URL +
        "?symbol=" +
        encodeURIComponent(
            SYMBOL
        ) +
        "&apikey=" +
        encodeURIComponent(
            API_KEY
        );


    const response =
        await fetch(url);


    if (!response.ok) {

        throw new Error(
            "Price request failed"
        );

    }


    const data =
        await response.json();


    if (!data.price) {

        throw new Error(
            data.message ||
            "Price unavailable"
        );

    }


    return Number(
        data.price
    );
}


// ============================================================
// CANDLES
// ============================================================

async function getCandles(
    interval,
    outputsize = 100
) {

    const url =
        TIME_SERIES_URL +
        "?symbol=" +
        encodeURIComponent(
            SYMBOL
        ) +
        "&interval=" +
        encodeURIComponent(
            interval
        ) +
        "&outputsize=" +
        outputsize +
        "&apikey=" +
        encodeURIComponent(
            API_KEY
        );


    const response =
        await fetch(url);


    if (!response.ok) {

        throw new Error(
            "Candle request failed: " +
            interval
        );

    }


    const data =
        await response.json();


    if (
        !data.values ||
        !Array.isArray(
            data.values
        )
    ) {

        throw new Error(
            data.message ||
            "No candle data: " +
            interval
        );

    }


    return data.values

        .map(c => ({

            datetime:
                c.datetime,

            open:
                Number(c.open),

            high:
                Number(c.high),

            low:
                Number(c.low),

            close:
                Number(c.close)

        }))

        .sort(
            (a, b) =>
                new Date(
                    a.datetime
                ) -
                new Date(
                    b.datetime
                )
        );
}


// ============================================================
// NEWS
// ============================================================

async function getNews() {

    try {

        const response =
            await fetch(
                NEWS_URL
            );


        if (!response.ok) {

            return {

                clear: false,

                risk: "UNKNOWN",

                events: []

            };

        }


        const raw =
            await response.json();


        let events = [];


        if (
            Array.isArray(raw)
        ) {

            events = raw;

        } else if (
            Array.isArray(
                raw.events
            )
        ) {

            events =
                raw.events;

        } else if (
            Array.isArray(
                raw.data
            )
        ) {

            events =
                raw.data;

        }


        const now =
            Date.now();


        const futureLimit =
            now +
            SCALP_WINDOW_MINUTES *
            60 *
            1000;


        const relevantEvents =
            events.filter(
                event => {

                    const currency =
                        String(
                            event.currency ||
                            event.ccy ||
                            event.country ||
                            ""
                        ).toUpperCase();


                    const title =
                        String(
                            event.title ||
                            event.event ||
                            event.name ||
                            ""
                        ).toUpperCase();


                    const relevantCurrency =
                        currency.includes(
                            "EUR"
                        ) ||
                        currency.includes(
                            "USD"
                        ) ||
                        title.includes(
                            "EUR"
                        ) ||
                        title.includes(
                            "USD"
                        );


                    if (
                        !relevantCurrency
                    ) {

                        return false;

                    }


                    const timeValue =
                        event.timestamp ||
                        event.time ||
                        event.datetime ||
                        event.date;


                    const eventTime =
                        parseEventTime(
                            timeValue
                        );


                    if (!eventTime) {

                        return false;

                    }


                    return (
                        eventTime >= now &&
                        eventTime <=
                        futureLimit
                    );

                }
            );


        return {

            clear:
                relevantEvents.length ===
                0,

            risk:
                relevantEvents.length ===
                0
                    ? "NORMAL"
                    : "HIGH",

            events:
                relevantEvents

        };


    } catch (error) {

        console.error(
            "News error:",
            error
        );


        return {

            clear: false,

            risk: "UNKNOWN",

            events: []

        };

    }
}


// ============================================================
// EVENT TIME
// ============================================================

function parseEventTime(value) {

    if (!value) return null;


    if (
        typeof value === "number" ||
        /^\d+$/.test(
            String(value)
        )
    ) {

        const numberValue =
            Number(value);


        if (
            String(value).length <= 10
        ) {

            return (
                numberValue *
                1000
            );

        }


        return numberValue;

    }


    const parsed =
        Date.parse(
            String(value)
        );


    return Number.isNaN(parsed)
        ? null
        : parsed;
}


// ============================================================
// MARKET STRUCTURE
// ============================================================

function getMarketStructure(
    candles
) {

    if (
        !candles ||
        candles.length < 10
    ) {

        return "RANGE";

    }


    const completed =
        candles.slice(0, -1);


    const recent =
        completed.slice(-8);


    const first =
        recent[0].close;


    const last =
        recent[
            recent.length - 1
        ].close;


    const movement =
        last - first;


    const threshold =
        getStructureThreshold(
            recent
        );


    if (
        movement >
        threshold
    ) {

        return "BULLISH";

    }


    if (
        movement <
        -threshold
    ) {

        return "BEARISH";

    }


    const highs =
        recent.map(
            c => c.high
        );


    const lows =
        recent.map(
            c => c.low
        );


    const higherHigh =
        highs[
            highs.length - 1
        ] >
        highs[0];


    const higherLow =
        lows[
            lows.length - 1
        ] >
        lows[0];


    const lowerHigh =
        highs[
            highs.length - 1
        ] <
        highs[0];


    const lowerLow =
        lows[
            lows.length - 1
        ] <
        lows[0];


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


// ============================================================
// STRUCTURE THRESHOLD
// ============================================================

function getStructureThreshold(
    candles
) {

    const ranges =
        candles.map(
            c =>
                c.high -
                c.low
        );


    const average =
        ranges.reduce(
            (a, b) =>
                a + b,
            0
        ) /
        ranges.length;


    return average * 1.5;
}


// ============================================================
// SUPPORT / RESISTANCE
// ============================================================

function calculateSupportResistance(
    candles
) {

    const completed =
        candles.slice(0, -1);


    const recent =
        completed.slice(-50);


    if (
        recent.length < 10
    ) {

        return {

            resistance1: null,

            resistance2: null,

            support1: null,

            support2: null

        };

    }


    const current =
        recent[
            recent.length - 1
        ].close;


    const swingHighs = [];

    const swingLows = [];


    for (
        let i = 2;
        i < recent.length - 2;
        i++
    ) {

        const c =
            recent[i];


        if (
            c.high >
                recent[i - 1].high &&
            c.high >
                recent[i - 2].high &&
            c.high >
                recent[i + 1].high &&
            c.high >
                recent[i + 2].high
        ) {

            swingHighs.push(
                c.high
            );

        }


        if (
            c.low <
                recent[i - 1].low &&
            c.low <
                recent[i - 2].low &&
            c.low <
                recent[i + 1].low &&
            c.low <
                recent[i + 2].low
        ) {

            swingLows.push(
                c.low
            );

        }

    }


    const resistances =
        swingHighs

            .filter(
                x =>
                    x > current
            )

            .sort(
                (a, b) =>
                    a - b
            );


    const supports =
        swingLows

            .filter(
                x =>
                    x < current
            )

            .sort(
                (a, b) =>
                    b - a
            );


    const highest =
        Math.max(
            ...recent.map(
                c => c.high
            )
        );


    const lowest =
        Math.min(
            ...recent.map(
                c => c.low
            )
        );


    return {

        resistance1:
            resistances[0] ||
            highest,

        resistance2:
            resistances[1] ||
            highest,

        support1:
            supports[0] ||
            lowest,

        support2:
            supports[1] ||
            lowest

    };
}


// ============================================================
// RSI
// ============================================================

function calculateRSI(
    candles,
    period = 14
) {

    const completed =
        candles.slice(0, -1);


    if (
        completed.length <
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
            completed[i].close -
            completed[i - 1].close;


        if (
            change >= 0
        ) {

            gains += change;

        } else {

            losses +=
                Math.abs(
                    change
                );

        }

    }


    let averageGain =
        gains / period;


    let averageLoss =
        losses / period;


    for (
        let i = period + 1;
        i < completed.length;
        i++
    ) {

        const change =
            completed[i].close -
            completed[i - 1].close;


        const gain =
            change > 0
                ? change
                : 0;


        const loss =
            change < 0
                ? Math.abs(change)
                : 0;


        averageGain =
            (
                averageGain *
                (period - 1) +
                gain
            ) /
            period;


        averageLoss =
            (
                averageLoss *
                (period - 1) +
                loss
            ) /
            period;

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
        100 /
        (1 + rs)
    );
}


// ============================================================
// EMA
// ============================================================

function calculateEMA(
    candles,
    period
) {

    const completed =
        candles.slice(0, -1);


    if (
        completed.length <
        period
    ) {

        return null;

    }


    const multiplier =
        2 /
        (period + 1);


    let ema =
        completed
            .slice(0, period)
            .reduce(
                (sum, candle) =>
                    sum +
                    candle.close,
                0
            ) /
        period;


    for (
        let i = period;
        i < completed.length;
        i++
    ) {

        ema =
            (
                completed[i].close -
                ema
            ) *
            multiplier +
            ema;

    }


    return ema;
}


// ============================================================
// EMA STRUCTURE
// ============================================================

function getEMAStructure() {

    const ema20 =
        marketData.m5.ema20;


    const ema50 =
        marketData.m5.ema50;


    const price =
        marketData.price;


    if (
        ema20 === null ||
        ema50 === null ||
        price === null
    ) {

        return "NEUTRAL";

    }


    if (
        price > ema20 &&
        ema20 > ema50
    ) {

        return "BULLISH";

    }


    if (
        price < ema20 &&
        ema20 < ema50
    ) {

        return "BEARISH";

    }


    return "NEUTRAL";
}


// ============================================================
// M5 MOMENTUM TRIGGER
// ============================================================

function getM5MomentumTrigger(
    direction
) {

    const candles =
        marketData.m5.candles;


    if (
        candles.length < 3
    ) {

        return false;

    }


    const completed =
        candles.slice(0, -1);


    const current =
        completed[
            completed.length - 1
        ];


    const previous =
        completed[
            completed.length - 2
        ];


    const range =
        current.high -
        current.low;


    if (
        range <= 0
    ) {

        return false;

    }


    const body =
        Math.abs(
            current.close -
            current.open
        );


    const bodyRatio =
        body / range;


    if (
        bodyRatio < 0.55
    ) {

        return false;

    }


    if (
        direction ===
        "BULLISH"
    ) {

        return (
            current.close >
                current.open &&
            current.close >
                previous.high
        );

    }


    if (
        direction ===
        "BEARISH"
    ) {

        return (
            current.close <
                current.open &&
            current.close <
                previous.low
        );

    }


    return false;
}


// ============================================================
// GET STRUCTURAL SNIPER SL
// ============================================================

function calculateSniperSL(
    direction
) {

    if (
        direction ===
        "BULLISH"
    ) {

        const candidates = [

            marketData.support1,

            marketData.support2,

            getRecentStructuralLow()

        ].filter(
            Number.isFinite
        );


        if (!candidates.length) {

            return null;

        }


        const structuralLow =
            Math.min(
                ...candidates
            );


        return (
            structuralLow -
            SNIPER_SL_BUFFER
        );

    }


    const candidates = [

        marketData.resistance1,

        marketData.resistance2,

        getRecentStructuralHigh()

    ].filter(
        Number.isFinite
    );


    if (!candidates.length) {

        return null;

    }


    const structuralHigh =
        Math.max(
            ...candidates
        );


    return (
        structuralHigh +
        SNIPER_SL_BUFFER
    );
}


// ============================================================
// RECENT STRUCTURAL LOW
// ============================================================

function getRecentStructuralLow() {

    const candles =
        marketData.m15.candles;


    const completed =
        candles.slice(0, -1);


    const recent =
        completed.slice(-12);


    if (!recent.length) {

        return null;

    }


    return Math.min(
        ...recent.map(
            c => c.low
        )
    );
}


// ============================================================
// RECENT STRUCTURAL HIGH
// ============================================================

function getRecentStructuralHigh() {

    const candles =
        marketData.m15.candles;


    const completed =
        candles.slice(0, -1);


    const recent =
        completed.slice(-12);


    if (!recent.length) {

        return null;

    }


    return Math.max(
        ...recent.map(
            c => c.high
        )
    );
}


// ============================================================
// CALCULATE SNIPER TARGETS
// ============================================================
//
// SELL:
// TP1 = Entry - 1R
// TP2 = Entry - 2R
// TP3 = Entry - 3R
//
// BUY:
// TP1 = Entry + 1R
// TP2 = Entry + 2R
// TP3 = Entry + 3R
//
// ============================================================

function calculateSniperTargets(
    direction,
    entry,
    stopLoss
) {

    if (
        !Number.isFinite(entry) ||
        !Number.isFinite(stopLoss)
    ) {

        return null;

    }


    const risk =
        Math.abs(
            entry -
            stopLoss
        );


    if (
        risk <= 0
    ) {

        return null;

    }


    let tp1;

    let tp2;

    let tp3;


    if (
        direction ===
        "BULLISH"
    ) {

        tp1 =
            entry +
            risk * 1;

        tp2 =
            entry +
            risk * 2;

        tp3 =
            entry +
            risk * 3;

    } else {

        tp1 =
            entry -
            risk * 1;

        tp2 =
            entry -
            risk * 2;

        tp3 =
            entry -
            risk * 3;

    }


    return {

        risk,

        tp1,

        tp2,

        tp3

    };
}


// ============================================================
// A+ SNIPER ENGINE
// ============================================================

function runSniperEngine() {

    const h4 =
        marketData.h4.trend;


    const h1 =
        marketData.h1.trend;


    const m15 =
        marketData.m15.structure;


    const m5 =
        marketData.m5.structure;


    const ema =
        marketData.emaStructure;


    const rsi15 =
        marketData.m15.rsi;


    const rsi5 =
        marketData.m5.rsi;


    // ========================================================
    // SCORE
    // ========================================================

    let score = 0;


    if (
        h4 === "BULLISH" ||
        h4 === "BEARISH"
    ) {

        score += 25;

    }


    if (
        h1 === "BULLISH" ||
        h1 === "BEARISH"
    ) {

        score += 25;

    }


    if (
        h4 !== "RANGE" &&
        h1 !== "RANGE" &&
        h4 === h1
    ) {

        score += 20;

    }


    let direction = null;


    if (
        h4 === "BULLISH" ||
        h4 === "BEARISH"
    ) {

        direction = h4;

    } else if (
        h1 === "BULLISH" ||
        h1 === "BEARISH"
    ) {

        direction = h1;

    }


    if (
        direction &&
        m15 === direction
    ) {

        score += 10;

    }


    if (
        direction &&
        m5 === direction
    ) {

        score += 10;

    }


    if (
        direction &&
        ema === direction
    ) {

        score += 5;

    }


    let rsiConfirmed =
        false;


    if (
        direction ===
            "BULLISH" &&
        rsi15 !== null &&
        rsi5 !== null &&
        rsi15 > 50 &&
        rsi5 > 50
    ) {

        rsiConfirmed = true;

    }


    if (
        direction ===
            "BEARISH" &&
        rsi15 !== null &&
        rsi5 !== null &&
        rsi15 < 50 &&
        rsi5 < 50
    ) {

        rsiConfirmed = true;

    }


    if (
        rsiConfirmed
    ) {

        score += 5;

    }


    setText(
        "setupScore",
        score + "/100"
    );


    // ========================================================
    // NEWS GATE
    // ========================================================

    if (
        !marketData.news.clear
    ) {

        invalidateSniperSetup();

        showSniperWait(
            "WAIT — NEWS FILTER",
            "WAIT",
            "—",
            "—",
            "—",
            "—",
            "—",
            "News filter is not clear."
        );

        return;
    }


    // ========================================================
    // H4/H1 MUST BE DIRECTIONAL
    // ========================================================

    if (
        h4 === "RANGE" ||
        h1 === "RANGE"
    ) {

        invalidateSniperSetup();

        showSniperWait(
            "WAIT — HIGHER TIMEFRAME RANGE",
            "WAIT",
            "—",
            "—",
            "—",
            "—",
            "—",
            "H4/H1 directional structure required."
        );

        return;
    }


    // ========================================================
    // H4/H1 MUST AGREE
    // ========================================================

    if (
        h4 !== h1
    ) {

        invalidateSniperSetup();

        showSniperWait(
            "WAIT — H4/H1 CONFLICT",
            "WAIT",
            "—",
            "—",
            "—",
            "—",
            "—",
            "H4 and H1 must align."
        );

        return;
    }


    direction = h4;


    // ========================================================
    // SCORE GATE
    // ========================================================

    if (
        score < SNIPER_MIN_SCORE
    ) {

        invalidateSniperSetup();

        showSniperWait(
            "WAIT — SCORE BELOW A+",
            direction,
            "—",
            "—",
            "—",
            "—",
            "—",
            "Score below A+ threshold."
        );

        return;
    }


    // ========================================================
    // LOWER-TIMEFRAME CONFIRMATION
    // ========================================================

    if (
        m15 !== direction ||
        m5 !== direction ||
        ema !== direction
    ) {

        invalidateSniperSetup();

        showSniperWait(
            "WAIT — LOWER TIMEFRAME CONFIRMATION",
            direction,
            "—",
            "—",
            "—",
            "—",
            "—",
            "M15, M5 and EMA must confirm."
        );

        return;
    }


    // ========================================================
    // M5 MOMENTUM CONFIRMATION
    // ========================================================

    const momentum =
        getM5MomentumTrigger(
            direction
        );


    // IMPORTANT:
    // Sniper does NOT become an executable A+ trade
    // without the M5 confirmation.

    if (!momentum) {

        invalidateSniperSetup();

        showSniperWait(
            "WAIT — M5 CONFIRMATION",
            direction,
            "—",
            "—",
            "—",
            "—",
            "—",
            "Wait for completed M5 momentum confirmation."
        );

        return;
    }


    // ========================================================
    // ENTRY
    // ========================================================

    const entry =
        marketData.price;


    // ========================================================
    // STRUCTURAL SL
    // ========================================================

    const sl =
        calculateSniperSL(
            direction
        );


    if (
        !Number.isFinite(entry) ||
        !Number.isFinite(sl)
    ) {

        invalidateSniperSetup();

        showSniperWait(
            "WAIT — INVALID STRUCTURAL LEVEL",
            direction,
            "—",
            "—",
            "—",
            "—",
            "—",
            "Cannot calculate valid structural stop."
        );

        return;
    }


    const risk =
        Math.abs(
            entry - sl
        );


    const riskPips =
        risk /
        0.0001;


    // ========================================================
    // STRUCTURAL RISK FILTER
    // ========================================================

    if (
        riskPips <
            SNIPER_MIN_RISK_PIPS ||
        riskPips >
            SNIPER_MAX_RISK_PIPS
    ) {

        invalidateSniperSetup();

        showSniperWait(
            "WAIT — STRUCTURAL RISK INVALID",
            direction,
            formatPrice(entry),
            formatPrice(sl),
            "—",
            "—",
            "—",
            "Structural risk is " +
            riskPips.toFixed(1) +
            " pips. Required: " +
            SNIPER_MIN_RISK_PIPS +
            "–" +
            SNIPER_MAX_RISK_PIPS +
            " pips."
        );

        return;
    }


    // ========================================================
    // CORRECT 1R / 2R / 3R TARGETS
    // ========================================================

    const targets =
        calculateSniperTargets(
            direction,
            entry,
            sl
        );


    if (!targets) {

        invalidateSniperSetup();

        showSniperWait(
            "WAIT — TARGET CALCULATION ERROR",
            direction,
            formatPrice(entry),
            formatPrice(sl),
            "—",
            "—",
            "—",
            "Could not calculate R-multiple targets."
        );

        return;
    }


    // ========================================================
    // TP2 STRUCTURAL CHECK
    // ========================================================

    if (
        direction ===
        "BEARISH"
    ) {

        if (
            marketData.support1 &&
            marketData.support1 >
                targets.tp2
        ) {

            invalidateSniperSetup();

            showSniperWait(
                "WAIT — SUPPORT BLOCKS TP2",
                direction,
                formatPrice(entry),
                formatPrice(sl),
                formatPrice(targets.tp1),
                formatPrice(targets.tp2),
                formatPrice(targets.tp3),
                "Higher-timeframe support is above TP2. No clean 2R path."
            );

            return;
        }

    } else {

        if (
            marketData.resistance1 &&
            marketData.resistance1 <
                targets.tp2
        ) {

            invalidateSniperSetup();

            showSniperWait(
                "WAIT — RESISTANCE BLOCKS TP2",
                direction,
                formatPrice(entry),
                formatPrice(sl),
                formatPrice(targets.tp1),
                formatPrice(targets.tp2),
                formatPrice(targets.tp3),
                "Higher-timeframe resistance is below TP2. No clean 2R path."
            );

            return;
        }
    }


    // ========================================================
    // A+ SETUP DETECTED
    // ========================================================

    lockSniperSetup(
        direction,
        entry,
        sl,
        targets.tp1,
        targets.tp2,
        targets.tp3
    );


    // ========================================================
    // DISPLAY A+ SETUP
    // ========================================================

    setText(
        "sniperStatus",
        "A+ SETUP"
    );


    setText(
        "direction",
        direction ===
            "BEARISH"
            ? "SELL"
            : "BUY"
    );


    setText(
        "entry",
        formatPrice(
            entry
        )
    );


    setText(
        "stopLoss",
        formatPrice(
            sl
        )
    );


    setText(
        "tp1",
        formatPrice(
            targets.tp1
        )
    );


    setText(
        "tp2",
        formatPrice(
            targets.tp2
        )
    );


    setText(
        "tp3",
        formatPrice(
            targets.tp3
        )
    );


    setText(
        "riskReward",
        "1:2.00"
    );


    setText(
        "validity",
        "Until structure changes"
    );


    setText(
        "trigger",
        "Bearish M5 confirmation"
    );


    if (
        direction ===
        "BULLISH"
    ) {

        setText(
            "trigger",
            "Bullish M5 confirmation"
        );

    }


    setText(
        "invalidation",
        formatPrice(
            sl
        )
    );


    // ========================================================
    // SETUP TIME
    // ========================================================

    setText(
        "sniperSetupTime",
        formatSetupTime(
            sniperSetup.setupTime
        )
    );
}


// ============================================================
// LOCK SNIPER SETUP
// ============================================================

function lockSniperSetup(
    direction,
    entry,
    sl,
    tp1,
    tp2,
    tp3
) {

    // If the existing setup is still the same direction,
    // DO NOT reset the timestamp.

    const sameSetup =
        sniperSetup.active &&
        sniperSetup.direction ===
            direction;


    if (!sameSetup) {

        sniperSetup.setupTime =
            Date.now();

    }


    sniperSetup.active =
        true;


    sniperSetup.direction =
        direction;


    sniperSetup.entry =
        entry;


    sniperSetup.stopLoss =
        sl;


    sniperSetup.tp1 =
        tp1;


    sniperSetup.tp2 =
        tp2;


    sniperSetup.tp3 =
        tp3;


    setText(
        "sniperSetupTime",
        formatSetupTime(
            sniperSetup.setupTime
        )
    );
}


// ============================================================
// INVALIDATE SNIPER SETUP
// ============================================================

function invalidateSniperSetup() {

    sniperSetup.active =
        false;

    sniperSetup.direction =
        null;

    sniperSetup.setupTime =
        null;

    sniperSetup.entry =
        null;

    sniperSetup.stopLoss =
        null;

    sniperSetup.tp1 =
        null;

    sniperSetup.tp2 =
        null;

    sniperSetup.tp3 =
        null;


    setText(
        "sniperSetupTime",
        "—"
    );
}


// ============================================================
// SNIPER WAIT DISPLAY
// ============================================================

function showSniperWait(
    status,
    direction,
    entry,
    sl,
    tp1,
    tp2,
    tp3,
    validity
) {

    setText(
        "sniperStatus",
        status
    );


    setText(
        "direction",
        direction ===
            "BEARISH"
            ? "SELL"
            : direction ===
              "BULLISH"
                ? "BUY"
                : "WAIT"
    );


    setText(
        "entry",
        entry
    );


    setText(
        "stopLoss",
        sl
    );


    setText(
        "tp1",
        tp1
    );


    setText(
        "tp2",
        tp2
    );


    setText(
        "tp3",
        tp3
    );


    setText(
        "riskReward",
        "—"
    );


    setText(
        "validity",
        validity
    );


    setText(
        "trigger",
        "Wait for required confirmation."
    );


    setText(
        "invalidation",
        "—"
    );


    setText(
        "sniperSetupTime",
        "—"
    );
}


// ============================================================
// ELITE SCALPING ENGINE
// ============================================================

function runEliteScalpingEngine() {

    if (
        !marketData.news.clear
    ) {

        showScalpWait(
            "WAIT — NEWS FILTER",
            "News filter is not clear.",
            "Required: high-impact news clear."
        );

        return;
    }


    const h1 =
        marketData.h1.trend;


    const m15 =
        marketData.m15.structure;


    const m5 =
        marketData.m5.structure;


    const ema =
        marketData.emaStructure;


    const rsi =
        marketData.m5.rsi;


    if (
        h1 !== "BULLISH" &&
        h1 !== "BEARISH"
    ) {

        showScalpWait(
            "WAIT — H1 RANGE",
            "H1 structure is not directional.",
            "Required: H1 bullish or bearish."
        );

        return;
    }


    const direction =
        h1;


    let score = 15;


    if (
        m15 === direction
    ) {

        score += 15;

    }


    if (
        m5 === direction
    ) {

        score += 20;

    }


    if (
        ema === direction
    ) {

        score += 15;

    }


    let rsiAligned =
        false;


    if (
        direction ===
            "BULLISH" &&
        rsi !== null &&
        rsi >=
            BULLISH_RSI_MIN &&
        rsi <=
            BULLISH_RSI_MAX
    ) {

        rsiAligned = true;

    }


    if (
        direction ===
            "BEARISH" &&
        rsi !== null &&
        rsi >=
            BEARISH_RSI_MIN &&
        rsi <=
            BEARISH_RSI_MAX
    ) {

        rsiAligned = true;

    }


    if (
        rsiAligned
    ) {

        score += 15;

    }


    const momentumTrigger =
        getM5MomentumTrigger(
            direction
        );


    if (
        momentumTrigger
    ) {

        score += 20;

    }


    setText(
        "scalpScore",
        score + "/100"
    );


    if (
        m15 !== direction ||
        m5 !== direction
    ) {

        showScalpWait(
            "WAIT — TIMEFRAME ALIGNMENT",
            "H1 " +
                direction +
                " | M15 " +
                m15 +
                " | M5 " +
                m5,
            "Required: H1 → M15 → M5 alignment."
        );

        return;
    }


    if (
        ema !== direction
    ) {

        showScalpWait(
            "WAIT — EMA NOT ALIGNED",
            "M5 EMA20/EMA50 does not confirm.",
            "Required: EMA alignment."
        );

        return;
    }


    if (
        !rsiAligned
    ) {

        showScalpWait(
            "WAIT — RSI NOT CONFIRMED",
            "M5 RSI: " +
                formatNumber(rsi),
            direction ===
                "BULLISH"
                ? "Required RSI: 52–68."
                : "Required RSI: 32–48."
        );

        return;
    }


    if (
        !momentumTrigger
    ) {

        showScalpWait(
            "WAIT — PRICE ACTION",
            "Completed M5 momentum candle not confirmed.",
            "Wait for M5 momentum trigger."
        );

        return;
    }


    const entry =
        marketData.price;


    const ema20 =
        marketData.m5.ema20;


    if (
        !Number.isFinite(entry) ||
        !Number.isFinite(ema20)
    ) {

        showScalpWait(
            "WAIT — DATA",
            "Entry or EMA unavailable.",
            "Wait for fresh market data."
        );

        return;
    }


    if (
        Math.abs(
            entry -
            ema20
        ) >
        SCALP_MAX_EMA_DISTANCE
    ) {

        showScalpWait(
            "WAIT — PRICE EXTENDED",
            "Price too far from EMA20.",
            "Wait for better location."
        );

        return;
    }


    let sl;


    if (
        direction ===
        "BULLISH"
    ) {

        sl =
            Math.min(
                marketData.support1,
                getLastM5Low()
            ) -
            SCALP_SL_BUFFER;

    } else {

        sl =
            Math.max(
                marketData.resistance1,
                getLastM5High()
            ) +
            SCALP_SL_BUFFER;

    }


    const risk =
        Math.abs(
            entry -
            sl
        );


    const riskPips =
        risk /
        0.0001;


    if (
        riskPips <
            SCALP_MIN_RISK_PIPS ||
        riskPips >
            SCALP_MAX_RISK_PIPS
    ) {

        showScalpWait(
            "WAIT — RISK OUT OF RANGE",
            "Current risk: " +
                riskPips.toFixed(1) +
                " pips.",
            "Required: 3–15 pips."
        );

        return;
    }


    const tp1 =
        direction ===
        "BULLISH"
            ? entry +
              risk * 1.5
            : entry -
              risk * 1.5;


    const tp2 =
        direction ===
        "BULLISH"
            ? entry +
              risk * 2
            : entry -
              risk * 2;


    const rr =
        Math.abs(
            tp2 -
            entry
        ) /
        risk;


    if (
        rr <
        SCALP_MIN_RR
    ) {

        showScalpWait(
            "WAIT — RR BELOW MINIMUM",
            "Risk/Reward: 1:" +
                rr.toFixed(2),
            "Required minimum: 1:2."
        );

        return;
    }


    if (
        direction ===
        "BULLISH"
    ) {

        if (
            marketData.resistance1 &&
            marketData.resistance1 <=
                tp2
        ) {

            showScalpWait(
                "WAIT — RESISTANCE BLOCKS TP2",
                "Higher-timeframe resistance too close.",
                "Need clear room to TP2."
            );

            return;
        }

    } else {

        if (
            marketData.support1 &&
            marketData.support1 >=
                tp2
        ) {

            showScalpWait(
                "WAIT — SUPPORT BLOCKS TP2",
                "Higher-timeframe support too close.",
                "Need clear room to TP2."
            );

            return;
        }
    }


    if (
        score <
        SCALP_MIN_SCORE
    ) {

        showScalpWait(
            "WAIT — SCORE BELOW A+",
            "Score: " +
                score +
                "/100.",
            "Required minimum: 80/100."
        );

        return;
    }


    setText(
        "scalpVerdict",
        "A+ SCALP"
    );


    setText(
        "scalpDirection",
        direction ===
            "BEARISH"
            ? "SELL"
            : "BUY"
    );


    setText(
        "scalpEntry",
        formatPrice(
            entry
        )
    );


    setText(
        "scalpSL",
        formatPrice(
            sl
        )
    );


    setText(
        "scalpTP1",
        formatPrice(
            tp1
        )
    );


    setText(
        "scalpTP2",
        formatPrice(
            tp2
        )
    );


    setText(
        "scalpRR",
        "1:" +
            rr.toFixed(2)
    );


    setText(
        "scalpScore",
        score +
            "/100"
    );


    setText(
        "scalpValidity",
        "Until M5 structure changes"
    );


    setText(
        "scalpTrigger",
        direction ===
            "BEARISH"
            ? "BEARISH BREAKDOWN"
            : "BULLISH BREAKOUT"
    );


    setText(
        "scalpInvalidation",
        formatPrice(
            sl
        )
    );
}


// ============================================================
// SCALP WAIT DISPLAY
// ============================================================

function showScalpWait(
    verdict,
    validity,
    trigger
) {

    setText(
        "scalpVerdict",
        verdict
    );


    setText(
        "scalpDirection",
        "WAIT"
    );


    setText(
        "scalpEntry",
        "—"
    );


    setText(
        "scalpSL",
        "—"
    );


    setText(
        "scalpTP1",
        "—"
    );


    setText(
        "scalpTP2",
        "—"
    );


    setText(
        "scalpRR",
        "—"
    );


    setText(
        "scalpValidity",
        validity
    );


    setText(
        "scalpTrigger",
        trigger
    );


    setText(
        "scalpInvalidation",
        "No scalp until required conditions align."
    );
}


// ============================================================
// PRO ANALYSIS
// ============================================================

function runProAnalysis() {

    if (
        !marketData.news.clear
    ) {

        setText(
            "proVerdict",
            "WAIT — NEWS FILTER"
        );

        setText(
            "proExplanation",
            "News filter is not clear."
        );

        return;
    }


    const h4 =
        marketData.h4.trend;


    const h1 =
        marketData.h1.trend;


    const m15 =
        marketData.m15.structure;


    const m5 =
        marketData.m5.structure;


    const ema =
        marketData.emaStructure;


    if (
        h4 === "RANGE" ||
        h1 === "RANGE"
    ) {

        setText(
            "proVerdict",
            "WAIT — HIGHER TIMEFRAME RANGE"
        );


        setText(
            "proExplanation",
            "H4/H1 require directional structure."
        );


        return;
    }


    if (
        h4 !== h1
    ) {

        setText(
            "proVerdict",
            "WAIT — H4/H1 CONFLICT"
        );


        setText(
            "proExplanation",
            "H4 is " +
                h4 +
                " while H1 is " +
                h1 +
                "."
        );


        return;
    }


    if (
        m15 !== h4 ||
        m5 !== h4 ||
        ema !== h4
    ) {

        setText(
            "proVerdict",
            "WAIT — LOWER TIMEFRAME CONFIRMATION"
        );


        setText(
            "proExplanation",
            "H4/H1 agree " +
                h4 +
                ", but lower-timeframe confirmation is incomplete."
        );


        return;
    }


    setText(
        "proVerdict",
        "BEARISH ALIGNMENT"
    );


    if (
        h4 === "BULLISH"
    ) {

        setText(
            "proVerdict",
            "BULLISH ALIGNMENT"
        );

    }


    setText(
        "proExplanation",
        "H4, H1, M15, M5 and EMA structure are aligned " +
            h4 +
            ". H1 RSI: " +
            formatNumber(
                marketData.h1.rsi
            ) +
            "."
    );
}


// ============================================================
// ELITE TRADE GATE
// ============================================================
//
// This is deliberately DIFFERENT from Sniper and Scalp.
//
// It acts as the final execution filter.
// It checks:
//
// 1. Session
// 2. News
// 3. H4/H1 alignment
// 4. M15 alignment
// 5. M5 alignment
// 6. EMA
// 7. RSI
// 8. M5 momentum
// 9. Structural risk
// 10. Minimum RR
// 11. TP2 obstruction
//
// ============================================================

function runEliteTradeGate() {

    const session =
        getTradingSession();


    setText(
        "session",
        session
    );


    // --------------------------------------------------------
    // NEWS
    // --------------------------------------------------------

    if (
        !marketData.news.clear
    ) {

        setGateWait(
            "STAY AWAY",
            "News filter is not clear."
        );

        return;
    }


    // --------------------------------------------------------
    // H4/H1
    // --------------------------------------------------------

    const h4 =
        marketData.h4.trend;


    const h1 =
        marketData.h1.trend;


    if (
        h4 === "RANGE" ||
        h1 === "RANGE" ||
        h4 !== h1
    ) {

        setGateWait(
            "STAY AWAY",
            "Higher-timeframe direction is not aligned."
        );

        return;
    }


    const direction =
        h4;


    // --------------------------------------------------------
    // M15 / M5
    // --------------------------------------------------------

    if (
        marketData.m15.structure !==
            direction ||
        marketData.m5.structure !==
            direction
    ) {

        setGateWait(
            "STAY AWAY",
            "M15/M5 confirmation is incomplete."
        );

        return;
    }


    // --------------------------------------------------------
    // EMA
    // --------------------------------------------------------

    if (
        marketData.emaStructure !==
        direction
    ) {

        setGateWait(
            "STAY AWAY",
            "M5 EMA20/EMA50 alignment is missing."
        );

        return;
    }


    // --------------------------------------------------------
    // RSI
    // --------------------------------------------------------

    const rsi =
        marketData.m5.rsi;


    let rsiOK =
        false;


    if (
        direction ===
        "BEARISH"
    ) {

        rsiOK =
            rsi !== null &&
            rsi >= 32 &&
            rsi <= 48;

    } else {

        rsiOK =
            rsi !== null &&
            rsi >= 52 &&
            rsi <= 68;

    }


    if (!rsiOK) {

        setGateWait(
            "STAY AWAY",
            "M5 RSI is not in the execution zone."
        );

        return;
    }


    // --------------------------------------------------------
    // M5 MOMENTUM
    // --------------------------------------------------------

    const momentum =
        getM5MomentumTrigger(
            direction
        );


    if (!momentum) {

        setGateWait(
            "STAY AWAY",
            direction ===
                "BEARISH"
                ? "SELL setup needs bearish M5 confirmation."
                : "BUY setup needs bullish M5 confirmation."
        );

        return;
    }


    // --------------------------------------------------------
    // STRUCTURAL RISK
    // --------------------------------------------------------

    const entry =
        marketData.price;


    const sl =
        calculateSniperSL(
            direction
        );


    if (
        !Number.isFinite(entry) ||
        !Number.isFinite(sl)
    ) {

        setGateWait(
            "STAY AWAY",
            "Structural SL cannot be calculated."
        );

        return;
    }


    const riskPips =
        Math.abs(
            entry -
            sl
        ) /
        0.0001;


    if (
        riskPips <
            SNIPER_MIN_RISK_PIPS ||
        riskPips >
            SNIPER_MAX_RISK_PIPS
    ) {

        setGateWait(
            "STAY AWAY",
            "Structural risk is " +
                riskPips.toFixed(1) +
                " pips."
        );

        return;
    }


    // --------------------------------------------------------
    // TARGETS
    // --------------------------------------------------------

    const targets =
        calculateSniperTargets(
            direction,
            entry,
            sl
        );


    if (!targets) {

        setGateWait(
            "STAY AWAY",
            "Target calculation failed."
        );

        return;
    }


    // --------------------------------------------------------
    // TP2 ROOM
    // --------------------------------------------------------

    if (
        direction ===
        "BEARISH"
    ) {

        if (
            marketData.support1 &&
            marketData.support1 >
                targets.tp2
        ) {

            setGateWait(
                "STAY AWAY",
                "Higher-timeframe support blocks the 2R target."
            );

            return;
        }

    } else {

        if (
            marketData.resistance1 &&
            marketData.resistance1 <
                targets.tp2
        ) {

            setGateWait(
                "STAY AWAY",
                "Higher-timeframe resistance blocks the 2R target."
            );

            return;
        }
    }


    // ========================================================
    // FINAL GATE APPROVAL
    // ========================================================

    setText(
        "gateVerdict",
        "A+ TRADE READY"
    );


    setText(
        "gateExplanation",
        "All primary filters are aligned. Wait for the stated M5 confirmation before execution."
    );


    setText(
        "session",
        session
    );


    setText(
        "gateDirection",
        direction ===
            "BEARISH"
            ? "SELL"
            : "BUY"
    );


    setText(
        "gateEntry",
        formatPrice(
            entry
        )
    );


    setText(
        "gateSL",
        formatPrice(
            sl
        )
    );


    setText(
        "gateTP1",
        formatPrice(
            targets.tp1
        )
    );


    setText(
        "gateTP2",
        formatPrice(
            targets.tp2
        )
    );


    setText(
        "gateRR",
        "1:2.00"
    );


    setText(
        "gateRisk",
        "NORMAL"
    );
}


// ============================================================
// ELITE GATE WAIT
// ============================================================

function setGateWait(
    verdict,
    explanation
) {

    setText(
        "gateVerdict",
        verdict
    );


    setText(
        "gateExplanation",
        explanation
    );


    setText(
        "gateDirection",
        "—"
    );


    setText(
        "gateEntry",
        "—"
    );


    setText(
        "gateSL",
        "—"
    );


    setText(
        "gateTP1",
        "—"
    );


    setText(
        "gateTP2",
        "—"
    );


    setText(
        "gateRR",
        "—"
    );


    setText(
        "gateRisk",
        "WAIT"
    );
}


// ============================================================
// SESSION
// ============================================================

function getTradingSession() {

    const now =
        new Date();


    const hour =
        Number(
            new Intl.DateTimeFormat(
                "en-US",
                {
                    timeZone:
                        "Asia/Kolkata",
                    hour:
                        "2-digit",
                    hour12:
                        false
                }
            ).format(now)
        );


    // Approximate major EUR/USD trading windows in IST.
    //
    // London:
    // roughly 12:30/13:30 onward depending on DST.
    //
    // New York:
    // roughly 17:30/18:30 onward depending on DST.
    //
    // We intentionally use broad labels rather than pretending
    // the session boundary is exact every day.

    if (
        hour >= 12 &&
        hour < 18
    ) {

        return "LONDON";

    }


    if (
        hour >= 18 &&
        hour < 23
    ) {

        return "NEW YORK";

    }


    if (
        hour >= 12 &&
        hour < 23
    ) {

        return "LONDON / NEW YORK";

    }


    return "OFF-PEAK";
}


// ============================================================
// DASHBOARD UPDATE
// ============================================================

function updateDashboard() {

    setText(
        "price",
        formatPrice(
            marketData.price
        )
    );


    setText(
        "h4Trend",
        marketData.h4.trend
    );


    setText(
        "h1Trend",
        marketData.h1.trend
    );


    setText(
        "m15Structure",
        marketData.m15.structure
    );


    setText(
        "m5Structure",
        marketData.m5.structure
    );


    setText(
        "resistance1",
        formatPrice(
            marketData.resistance1
        )
    );


    setText(
        "resistance2",
        formatPrice(
            marketData.resistance2
        )
    );


    setText(
        "support1",
        formatPrice(
            marketData.support1
        )
    );


    setText(
        "support2",
        formatPrice(
            marketData.support2
        )
    );


    setText(
        "h4Rsi",
        formatNumber(
            marketData.h4.rsi
        )
    );


    setText(
        "h1Rsi",
        formatNumber(
            marketData.h1.rsi
        )
    );


    setText(
        "m15Rsi",
        formatNumber(
            marketData.m15.rsi
        )
    );


    setText(
        "m5Rsi",
        formatNumber(
            marketData.m5.rsi
        )
    );


    setText(
        "emaStructure",
        marketData.emaStructure
    );


    // --------------------------------------------------------
    // NEWS
    // --------------------------------------------------------

    const news =
        marketData.news;


    if (
        news.clear
    ) {

        setText(
            "eurNews",
            "NO EUR HIGH-IMPACT EVENTS FOUND"
        );


        setText(
            "usdNews",
            "NO USD HIGH-IMPACT EVENTS FOUND"
        );


        setText(
            "newsFilter",
            "NEWS CLEAR"
        );


        setText(
            "nextEvent",
            "No upcoming high-impact EUR/USD event found."
        );


        setText(
            "tradingRisk",
            "LOW"
        );

    } else if (
        news.risk ===
        "UNKNOWN"
    ) {

        setText(
            "eurNews",
            "NEWS DATA UNAVAILABLE"
        );


        setText(
            "usdNews",
            "NEWS DATA UNAVAILABLE"
        );


        setText(
            "newsFilter",
            "NEWS UNKNOWN"
        );


        setText(
            "nextEvent",
            "Cannot verify upcoming high-impact news."
        );


        setText(
            "tradingRisk",
            "UNKNOWN"
        );

    } else {

        setText(
            "eurNews",
            "HIGH-IMPACT EUR/USD EVENT DETECTED"
        );


        setText(
            "usdNews",
            "HIGH-IMPACT EUR/USD EVENT DETECTED"
        );


        setText(
            "newsFilter",
            "NEWS RISK"
        );


        setText(
            "nextEvent",
            "High-impact event inside the next 2 hours."
        );


        setText(
            "tradingRisk",
            "HIGH"
        );
    }
}


// ============================================================
// HELPERS
// ============================================================

function getLastM5Low() {

    const candles =
        marketData.m5.candles;


    const completed =
        candles.slice(0, -1);


    if (
        !completed.length
    ) {

        return marketData.price;

    }


    return completed[
        completed.length - 1
    ].low;
}


function getLastM5High() {

    const candles =
        marketData.m5.candles;


    const completed =
        candles.slice(0, -1);


    if (
        !completed.length
    ) {

        return marketData.price;

    }


    return completed[
        completed.length - 1
    ].high;
}


// ============================================================
// SETUP TIME FORMATTER
// ============================================================

function formatSetupTime(
    timestamp
) {

    if (!timestamp) {

        return "—";

    }


    const date =
        new Date(
            timestamp
        );


    return new Intl.DateTimeFormat(
        "en-IN",
        {
            timeZone:
                "Asia/Kolkata",

            day:
                "2-digit",

            month:
                "short",

            year:
                "numeric",

            hour:
                "2-digit",

            minute:
                "2-digit",

            second:
                "2-digit",

            hour12:
                true
        }
    ).format(date) +
        " IST";
}


// ============================================================
// PRICE FORMAT
// ============================================================

function formatPrice(
    value
) {

    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(
            Number(value)
        )
    ) {

        return "—";

    }


    return Number(value)
        .toFixed(5);
}


// ============================================================
// NUMBER FORMAT
// ============================================================

function formatNumber(
    value
) {

    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(
            Number(value)
        )
    ) {

        return "—";

    }


    return Number(value)
        .toFixed(1);
}


// ============================================================
// SET TEXT
// ============================================================

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            value;

    }
}
