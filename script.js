// ============================================================
// EUR/USD SNIPER DASHBOARD
// LIVE MARKET DATA + SNIPER + ELITE SCALPING
// ============================================================

// IMPORTANT:
// Put your NEW Twelve Data API key here.
// Do NOT use an exposed/old key.
const API_KEY = "8908432b6c784bc49aad6ccf64845991";

const SYMBOL = "EUR/USD";

const PRICE_URL = "https://api.twelvedata.com/price";
const TIME_SERIES_URL = "https://api.twelvedata.com/time_series";
const NEWS_URL = "https://xoomar.com/api/markets/calendar?importance=high";

// ------------------------------------------------------------
// SCALPING SETTINGS
// ------------------------------------------------------------

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

// ------------------------------------------------------------
// SNIPER SETTINGS
// ------------------------------------------------------------

const SNIPER_MIN_SCORE = 75;

const SNIPER_MIN_RISK_PIPS = 3;
const SNIPER_MAX_RISK_PIPS = 15;

const SNIPER_SL_BUFFER = 0.00010;

const SNIPER_MIN_TP1_R = 1.0;
const SNIPER_MIN_TP2_R = 2.0;
const SNIPER_MIN_TP3_R = 3.0;

// ------------------------------------------------------------
// GLOBAL DATA
// ------------------------------------------------------------

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

// ------------------------------------------------------------
// SNIPER SETUP MEMORY
// ------------------------------------------------------------

let sniperState = {

    setupActive: false,

    direction: null,

    setupDetectedTime: null,

    m5ConfirmationTime: null,

    lastSetupKey: null
};

// ------------------------------------------------------------
// PAGE LOAD
// ------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {

    loadMarketData();

    // Refresh every 2 minutes
    setInterval(loadMarketData, 120000);

});

// ------------------------------------------------------------
// CHART SWITCHER
// ------------------------------------------------------------

function changeChart(interval) {

    const chart =
        document.getElementById("tradingChart");

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
        "&interval=" +
        tvInterval +
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

            btn.classList.remove("active");

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

        activeButton.classList.add("active");

    }
}

// ------------------------------------------------------------
// MAIN MARKET DATA LOADER
// ------------------------------------------------------------

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

            getCandles("4h", 100),

            getCandles("1h", 100),

            getCandles("15min", 100),

            getCandles("5min", 100),

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

        // ----------------------------------------------------
        // MARKET STRUCTURE
        // ----------------------------------------------------

        marketData.h4.trend =
            getMarketStructure(h4Candles);

        marketData.h1.trend =
            getMarketStructure(h1Candles);

        marketData.m15.structure =
            getMarketStructure(m15Candles);

        marketData.m5.structure =
            getMarketStructure(m5Candles);

        // ----------------------------------------------------
        // RSI
        // ----------------------------------------------------

        marketData.h4.rsi =
            calculateRSI(h4Candles);

        marketData.h1.rsi =
            calculateRSI(h1Candles);

        marketData.m15.rsi =
            calculateRSI(m15Candles);

        marketData.m5.rsi =
            calculateRSI(m5Candles);

        // ----------------------------------------------------
        // EMA
        // ----------------------------------------------------

        marketData.h4.ema20 =
            calculateEMA(h4Candles, 20);

        marketData.h4.ema50 =
            calculateEMA(h4Candles, 50);

        marketData.h1.ema20 =
            calculateEMA(h1Candles, 20);

        marketData.h1.ema50 =
            calculateEMA(h1Candles, 50);

        marketData.m15.ema20 =
            calculateEMA(m15Candles, 20);

        marketData.m15.ema50 =
            calculateEMA(m15Candles, 50);

        marketData.m5.ema20 =
            calculateEMA(m5Candles, 20);

        marketData.m5.ema50 =
            calculateEMA(m5Candles, 50);

        // ----------------------------------------------------
        // SUPPORT / RESISTANCE
        // ----------------------------------------------------

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

        // ----------------------------------------------------
        // EMA STRUCTURE
        // ----------------------------------------------------

        marketData.emaStructure =
            getEMAStructure();

        // ----------------------------------------------------
        // NEWS
        // ----------------------------------------------------

        marketData.news =
            news;

        // ----------------------------------------------------
        // UPDATE UI
        // ----------------------------------------------------

        updateDashboard();

        // ----------------------------------------------------
        // ENGINES
        // ----------------------------------------------------

        runSniperEngine();

        runEliteScalpingEngine();

        runProAnalysis();

        updateEliteTradeGate();

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
            "DATA ERROR — " +
            error.message
        );

        // Clear setup when data fails
        resetSniperState();

        updateEliteTradeGate();

    }
}

// ============================================================
// PRICE
// ============================================================

async function getPrice() {

    const url =
        PRICE_URL +
        "?symbol=" +
        encodeURIComponent(SYMBOL) +
        "&apikey=" +
        encodeURIComponent(API_KEY);

    const response =
        await fetch(url);

    if (!response.ok) {

        throw new Error(
            "Price request HTTP " +
            response.status
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

    return Number(data.price);
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
        encodeURIComponent(SYMBOL) +
        "&interval=" +
        encodeURIComponent(interval) +
        "&outputsize=" +
        outputsize +
        "&apikey=" +
        encodeURIComponent(API_KEY);

    const response =
        await fetch(url);

    if (!response.ok) {

        throw new Error(
            "Candle request HTTP " +
            response.status +
            ": " +
            interval
        );

    }

    const data =
        await response.json();

    if (
        !data.values ||
        !Array.isArray(data.values)
    ) {

        throw new Error(
            data.message ||
            "No candle data: " +
            interval
        );

    }

    return data.values

        .map(c => ({

            datetime: c.datetime,

            open: Number(c.open),

            high: Number(c.high),

            low: Number(c.low),

            close: Number(c.close)

        }))

        .sort(
            (a, b) =>
                new Date(a.datetime) -
                new Date(b.datetime)
        );
}

// ============================================================
// NEWS
// ============================================================

async function getNews() {

    try {

        const response =
            await fetch(NEWS_URL);

        if (!response.ok) {

            console.warn(
                "News service unavailable"
            );

            return {

                clear: false,

                risk: "UNKNOWN",

                events: []

            };

        }

        const raw =
            await response.json();

        let events = [];

        if (Array.isArray(raw)) {

            events = raw;

        } else if (
            Array.isArray(raw.events)
        ) {

            events = raw.events;

        } else if (
            Array.isArray(raw.data)
        ) {

            events = raw.data;

        }

        const now =
            Date.now();

        const futureLimit =
            now +
            SCALP_WINDOW_MINUTES *
            60 *
            1000;

        const relevantEvents =
            events.filter(event => {

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
                    currency.includes("EUR") ||
                    currency.includes("USD") ||
                    title.includes("EUR") ||
                    title.includes("USD");

                if (!relevantCurrency) {

                    return false;

                }

                const timeValue =
                    event.timestamp ||
                    event.time ||
                    event.datetime ||
                    event.date;

                const eventTime =
                    parseEventTime(timeValue);

                if (!eventTime) {

                    return false;

                }

                return (
                    eventTime >= now &&
                    eventTime <= futureLimit
                );

            });

        return {

            clear:
                relevantEvents.length === 0,

            risk:
                relevantEvents.length === 0
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

            return numberValue * 1000;

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

function getMarketStructure(candles) {

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
        movement > threshold
    ) {

        return "BULLISH";

    }

    if (
        movement < -threshold
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
        ] > highs[0];

    const higherLow =
        lows[
            lows.length - 1
        ] > lows[0];

    const lowerHigh =
        highs[
            highs.length - 1
        ] < highs[0];

    const lowerLow =
        lows[
            lows.length - 1
        ] < lows[0];

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

function getStructureThreshold(candles) {

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

    return {

        resistance1:
            resistances[0] ||
            Math.max(
                ...recent.map(
                    c => c.high
                )
            ),

        resistance2:
            resistances[1] ||
            null,

        support1:
            supports[0] ||
            Math.min(
                ...recent.map(
                    c => c.low
                )
            ),

        support2:
            supports[1] ||
            null

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
        100 /
        (1 + rs);
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
            .slice(
                0,
                period
            )
            .reduce(
                (
                    sum,
                    candle
                ) =>
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
        direction === "BULLISH"
    ) {

        return (

            current.close >
            current.open &&

            current.close >
            previous.high

        );

    }

    if (
        direction === "BEARISH"
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
// IST TIMESTAMP
// ============================================================

function getISTTime() {

    return new Intl.DateTimeFormat(
        "en-IN",
        {
            timeZone:
                "Asia/Kolkata",

            day: "2-digit",

            month: "2-digit",

            year: "numeric",

            hour: "2-digit",

            minute: "2-digit",

            second: "2-digit",

            hour12: true
        }
    ).format(
        new Date()
    );
}

// ============================================================
// SETUP TIMESTAMP
// ============================================================

function registerSniperSetup(
    direction,
    entry,
    sl,
    tp1,
    tp2,
    tp3
) {

    const setupKey =
        [
            direction,

            Number(entry).toFixed(5),

            Number(sl).toFixed(5),

            Number(tp1).toFixed(5),

            Number(tp2).toFixed(5),

            Number(tp3).toFixed(5)

        ].join("|");

    // New setup
    if (
        sniperState.lastSetupKey !==
        setupKey
    ) {

        sniperState.setupDetectedTime =
            getISTTime();

        sniperState.m5ConfirmationTime =
            null;

        sniperState.lastSetupKey =
            setupKey;

    }

    sniperState.setupActive =
        true;

    sniperState.direction =
        direction;

    setText(
        "sniperSetupTime",
        sniperState.setupDetectedTime
            ? sniperState.setupDetectedTime +
              " IST"
            : "—"
    );

    setText(
        "sniperConfirmationTime",
        sniperState.m5ConfirmationTime
            ? sniperState.m5ConfirmationTime +
              " IST"
            : "WAITING"
    );
}

// ============================================================
// M5 CONFIRMATION TIMESTAMP
// ============================================================

function registerM5Confirmation(
    direction
) {

    if (
        !sniperState.m5ConfirmationTime
    ) {

        sniperState.m5ConfirmationTime =
            getISTTime();

    }

    setText(
        "sniperConfirmationTime",
        sniperState.m5ConfirmationTime +
        " IST"
    );
}

// ============================================================
// RESET SNIPER
// ============================================================

function resetSniperState() {

    sniperState = {

        setupActive: false,

        direction: null,

        setupDetectedTime: null,

        m5ConfirmationTime: null,

        lastSetupKey: null

    };

    setText(
        "sniperSetupTime",
        "—"
    );

    setText(
        "sniperConfirmationTime",
        "—"
    );
}

// ============================================================
// SNIPER WAIT DISPLAY
// ============================================================

function setSniperWait(
    status,
    direction,
    entry,
    sl,
    tp1,
    tp2,
    tp3,
    validity,
    trigger,
    invalidation
) {

    setText(
        "sniperStatus",
        status
    );

    setText(
        "direction",
        direction || "WAIT"
    );

    setText(
        "entry",
        entry || "—"
    );

    setText(
        "stopLoss",
        sl || "—"
    );

    setText(
        "tp1",
        tp1 || "—"
    );

    setText(
        "tp2",
        tp2 || "—"
    );

    setText(
        "tp3",
        tp3 || "—"
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
        trigger
    );

    setText(
        "invalidation",
        invalidation
    );
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

    // --------------------------------------------------------
    // SCORE
    // --------------------------------------------------------

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
        direction === "BULLISH" &&
        rsi15 !== null &&
        rsi5 !== null &&
        rsi15 > 50 &&
        rsi5 > 50
    ) {

        rsiConfirmed = true;

    }

    if (
        direction === "BEARISH" &&
        rsi15 !== null &&
        rsi5 !== null &&
        rsi15 < 50 &&
        rsi5 < 50
    ) {

        rsiConfirmed = true;

    }

    if (rsiConfirmed) {

        score += 5;

    }

    setText(
        "setupScore",
        score + "/100"
    );

    // --------------------------------------------------------
    // NEWS GATE
    // --------------------------------------------------------

    if (
        !marketData.news.clear
    ) {

        resetSniperState();

        setSniperWait(

            "WAIT — NEWS FILTER",

            "WAIT",

            "—",

            "—",

            "—",

            "—",

            "—",

            "News filter is not clear.",

            "Wait for news confirmation.",

            "News risk."

        );

        return;
    }

    // --------------------------------------------------------
    // HIGHER TIMEFRAME RANGE
    // --------------------------------------------------------

    if (
        h4 === "RANGE" ||
        h1 === "RANGE"
    ) {

        resetSniperState();

        setSniperWait(

            "WAIT — HIGHER TIMEFRAME RANGE",

            "WAIT",

            "—",

            "—",

            "—",

            "—",

            "—",

            "H4/H1 requires directional structure.",

            "Wait for H4 and H1 directional alignment.",

            "Higher timeframe range."

        );

        return;
    }

    // --------------------------------------------------------
    // H4/H1 CONFLICT
    // --------------------------------------------------------

    if (
        h4 !== h1
    ) {

        resetSniperState();

        setSniperWait(

            "WAIT — H4/H1 CONFLICT",

            "WAIT",

            "—",

            "—",

            "—",

            "—",

            "—",

            "H4 " +
            h4 +
            " but H1 " +
            h1 +
            ".",

            "Wait for higher-timeframe alignment.",

            "H4/H1 conflict."

        );

        return;
    }

    // --------------------------------------------------------
    // SCORE
    // --------------------------------------------------------

    if (
        score < SNIPER_MIN_SCORE
    ) {

        resetSniperState();

        setSniperWait(

            "WAIT — SCORE BELOW A+",

            direction,

            "—",

            "—",

            "—",

            "—",

            "—",

            "Score " +
            score +
            "/100.",

            "Wait for additional confirmation.",

            "Score below Sniper minimum."

        );

        return;
    }

    // --------------------------------------------------------
    // ENTRY
    // --------------------------------------------------------

    const entry =
        marketData.price;

    if (
        !Number.isFinite(entry)
    ) {

        resetSniperState();

        setSniperWait(

            "WAIT — INVALID PRICE",

            direction,

            "—",

            "—",

            "—",

            "—",

            "—",

            "Live price unavailable.",

            "Wait for fresh market data.",

            "Invalid price."

        );

        return;
    }

    // --------------------------------------------------------
    // STRUCTURAL SL
    // --------------------------------------------------------

    let sl;

    if (
        direction === "BEARISH"
    ) {

        const structuralHigh =
            Math.max(

                Number.isFinite(
                    Number(
                        marketData.resistance1
                    )
                )
                    ? Number(
                        marketData.resistance1
                    )
                    : -Infinity,

                Number.isFinite(
                    getLastM5High()
                )
                    ? getLastM5High()
                    : -Infinity

            );

        if (
            !Number.isFinite(
                structuralHigh
            )
        ) {

            resetSniperState();

            setSniperWait(

                "WAIT — INVALID SL",

                "SELL",

                formatPrice(entry),

                "—",

                "—",

                "—",

                "—",

                "Unable to calculate structural resistance.",

                "Wait for valid structure.",

                "Invalid structural SL."

            );

            return;
        }

        sl =
            structuralHigh +
            SNIPER_SL_BUFFER;

    } else {

        const structuralLow =
            Math.min(

                Number.isFinite(
                    Number(
                        marketData.support1
                    )
                )
                    ? Number(
                        marketData.support1
                    )
                    : Infinity,

                Number.isFinite(
                    getLastM5Low()
                )
                    ? getLastM5Low()
                    : Infinity

            );

        if (
            !Number.isFinite(
                structuralLow
            )
        ) {

            resetSniperState();

            setSniperWait(

                "WAIT — INVALID SL",

                "BUY",

                formatPrice(entry),

                "—",

                "—",

                "—",

                "—",

                "Unable to calculate structural support.",

                "Wait for valid structure.",

                "Invalid structural SL."

            );

            return;
        }

        sl =
            structuralLow -
            SNIPER_SL_BUFFER;
    }

    // --------------------------------------------------------
    // RISK
    // --------------------------------------------------------

    const risk =
        Math.abs(
            entry - sl
        );

    const riskPips =
        risk / 0.0001;

    if (
        riskPips <
        SNIPER_MIN_RISK_PIPS ||
        riskPips >
        SNIPER_MAX_RISK_PIPS
    ) {

        resetSniperState();

        setSniperWait(

            "WAIT — STRUCTURAL RISK",

            direction,

            formatPrice(entry),

            formatPrice(sl),

            "—",

            "—",

            "—",

            "Structural risk is " +
            riskPips.toFixed(1) +
            " pips.",

            "Required Sniper risk: 3–15 pips.",

            "Risk outside Sniper limits."

        );

        return;
    }

    // ========================================================
    // STRUCTURAL TP LOGIC
    // ========================================================

    let tp1;
    let tp2;
    let tp3;

    // --------------------------------------------------------
    // SELL
    // --------------------------------------------------------

    if (
        direction === "BEARISH"
    ) {

        const s1 =
            Number(
                marketData.support1
            );

        const s2 =
            Number(
                marketData.support2
            );

        const minimumTP1 =
            entry -
            risk *
            SNIPER_MIN_TP1_R;

        const minimumTP2 =
            entry -
            risk *
            SNIPER_MIN_TP2_R;

        const minimumTP3 =
            entry -
            risk *
            SNIPER_MIN_TP3_R;

        // ----------------------------------------------------
        // TP1
        // ----------------------------------------------------

        if (
            !Number.isFinite(s1) ||
            s1 >= entry
        ) {

            resetSniperState();

            setSniperWait(

                "WAIT — NO CLEAN TP1",

                "SELL",

                formatPrice(entry),

                formatPrice(sl),

                "—",

                "—",

                "—",

                "No valid structural support below entry.",

                "Wait for clean downside structure.",

                "No valid TP1."

            );

            return;
        }

        // Support must be at least 1R away.
        if (
            s1 > minimumTP1
        ) {

            resetSniperState();

            setSniperWait(

                "WAIT — TP1 TOO CLOSE",

                "SELL",

                formatPrice(entry),

                formatPrice(sl),

                formatPrice(s1),

                "—",

                "—",

                "Nearest support is only " +
                (
                    (entry - s1) /
                    0.0001
                ).toFixed(1) +
                " pips away.",

                "Need at least 1R of clean room to TP1.",

                "Nearby support blocks 1R."

            );

            return;
        }

        tp1 = s1;

        // ----------------------------------------------------
        // TP2
        // ----------------------------------------------------

        if (
            !Number.isFinite(s2) ||
            s2 >= entry
        ) {

            resetSniperState();

            setSniperWait(

                "WAIT — NO CLEAN TP2",

                "SELL",

                formatPrice(entry),

                formatPrice(sl),

                formatPrice(tp1),

                "—",

                "—",

                "No second structural support available.",

                "Need a clean minimum 1:2 structural target.",

                "No valid TP2."

            );

            return;
        }

        // TP2 must be at least 2R away.
        if (
            s2 > minimumTP2
        ) {

            resetSniperState();

            setSniperWait(

                "WAIT — TP2 BELOW 1:2",

                "SELL",

                formatPrice(entry),

                formatPrice(sl),

                formatPrice(tp1),

                formatPrice(s2),

                "—",

                "Second support is too close for minimum 1:2 RR.",

                "Wait for better structure or entry.",

                "Support blocks 1:2."

            );

            return;
        }

        tp2 = s2;

        // ----------------------------------------------------
        // TP3
        // ----------------------------------------------------

        tp3 =
            minimumTP3;

        // If TP3 would be beyond the available structural
        // range, still use 3R only if no opposing structure
        // blocks it.
        //
        // This is a minimum mathematical target, not a forced
        // claim that price must reach it.
    }

    // --------------------------------------------------------
    // BUY
    // --------------------------------------------------------

    else {

        const r1 =
            Number(
                marketData.resistance1
            );

        const r2 =
            Number(
                marketData.resistance2
            );

        const minimumTP1 =
            entry +
            risk *
            SNIPER_MIN_TP1_R;

        const minimumTP2 =
            entry +
            risk *
            SNIPER_MIN_TP2_R;

        const minimumTP3 =
            entry +
            risk *
            SNIPER_MIN_TP3_R;

        // ----------------------------------------------------
        // TP1
        // ----------------------------------------------------

        if (
            !Number.isFinite(r1) ||
            r1 <= entry
        ) {

            resetSniperState();

            setSniperWait(

                "WAIT — NO CLEAN TP1",

                "BUY",

                formatPrice(entry),

                formatPrice(sl),

                "—",

                "—",

                "—",

                "No valid structural resistance above entry.",

                "Wait for clean upside structure.",

                "No valid TP1."

            );

            return;
        }

        if (
            r1 < minimumTP1
        ) {

            resetSniperState();

            setSniperWait(

                "WAIT — TP1 TOO CLOSE",

                "BUY",

                formatPrice(entry),

                formatPrice(sl),

                formatPrice(r1),

                "—",

                "—",

                "Nearest resistance is too close.",

                "Need at least 1R of clean room to TP1.",

                "Nearby resistance blocks 1R."

            );

            return;
        }

        tp1 = r1;

        // ----------------------------------------------------
        // TP2
        // ----------------------------------------------------

        if (
            !Number.isFinite(r2) ||
            r2 <= entry
        ) {

            resetSniperState();

            setSniperWait(

                "WAIT — NO CLEAN TP2",

                "BUY",

                formatPrice(entry),

                formatPrice(sl),

                formatPrice(tp1),

                "—",

                "—",

                "No second structural resistance available.",

                "Need a clean minimum 1:2 structural target.",

                "No valid TP2."

            );

            return;
        }

        if (
            r2 < minimumTP2
        ) {

            resetSniperState();

            setSniperWait(

                "WAIT — TP2 BELOW 1:2",

                "BUY",

                formatPrice(entry),

                formatPrice(sl),

                formatPrice(tp1),

                formatPrice(r2),

                "—",

                "Second resistance is too close for minimum 1:2 RR.",

                "Wait for better structure or entry.",

                "Resistance blocks 1:2."

            );

            return;
        }

        tp2 = r2;

        tp3 =
            minimumTP3;
    }

    // ========================================================
    // FINAL RR
    // ========================================================

    const actualRR =
        Math.abs(
            tp2 - entry
        ) /
        risk;

    if (
        actualRR < 2
    ) {

        resetSniperState();

        setSniperWait(

            "WAIT — RR BELOW 1:2",

            direction,

            formatPrice(entry),

            formatPrice(sl),

            formatPrice(tp1),

            formatPrice(tp2),

            formatPrice(tp3),

            "Structural targets do not provide minimum 1:2 RR.",

            "Wait for a better entry or improved structure.",

            "Reward insufficient."

        );

        return;
    }

    // ========================================================
    // SNIPER SETUP VALID
    // ========================================================

    registerSniperSetup(

        direction,

        entry,

        sl,

        tp1,

        tp2,

        tp3

    );

    // --------------------------------------------------------
    // M5 CONFIRMATION
    // --------------------------------------------------------

    const m5Confirmed =
        getM5MomentumTrigger(
            direction
        );

    if (
        m5Confirmed
    ) {

        registerM5Confirmation(
            direction
        );

    }

    // --------------------------------------------------------
    // DISPLAY
    // --------------------------------------------------------

    setText(
        "sniperStatus",
        "A+ SETUP"
    );

    setText(
        "direction",
        direction === "BEARISH"
            ? "SELL"
            : "BUY"
    );

    setText(
        "entry",
        formatPrice(entry)
    );

    setText(
        "stopLoss",
        formatPrice(sl)
    );

    setText(
        "tp1",
        formatPrice(tp1)
    );

    setText(
        "tp2",
        formatPrice(tp2)
    );

    setText(
        "tp3",
        formatPrice(tp3)
    );

    setText(
        "riskReward",
        "1:" +
        actualRR.toFixed(2)
    );

    setText(
        "validity",
        "Valid while H4/H1 structure remains aligned."
    );

    setText(
        "trigger",
        m5Confirmed
            ? "M5 bearish confirmation achieved."
            : direction === "BEARISH"
                ? "Wait for bearish M5 confirmation."
                : "Wait for bullish M5 confirmation."
    );

    setText(
        "invalidation",
        direction === "BEARISH"
            ? formatPrice(sl) +
              " / bearish structure failure."
            : formatPrice(sl) +
              " / bullish structure failure."
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
        direction === "BULLISH" &&
        rsi !== null &&
        rsi >= BULLISH_RSI_MIN &&
        rsi <= BULLISH_RSI_MAX
    ) {

        rsiAligned = true;

    }

    if (
        direction === "BEARISH" &&
        rsi !== null &&
        rsi >= BEARISH_RSI_MIN &&
        rsi <= BEARISH_RSI_MAX
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
            h1 +
            " | M15 " +
            m15 +
            " | M5 " +
            m5,

            "Required: H1 → M15 → M5 all " +
            direction +
            "."
        );

        return;
    }

    if (
        ema !== direction
    ) {

        showScalpWait(
            "WAIT — EMA NOT ALIGNED",
            "M5 EMA20/EMA50 does not confirm " +
            direction +
            ".",
            "Required: M5 EMA20/EMA50 alignment."
        );

        return;
    }

    if (
        !rsiAligned
    ) {

        showScalpWait(
            "WAIT — RSI NOT CONFIRMED",
            "M5 RSI is " +
            formatNumber(rsi) +
            ".",
            direction === "BULLISH"
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
            "Completed M5 momentum candle has not confirmed.",
            "Required: completed M5 candle breakout trigger."
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
            "Entry or EMA data unavailable.",
            "Wait for fresh market data."
        );

        return;
    }

    if (
        Math.abs(
            entry - ema20
        ) >
        SCALP_MAX_EMA_DISTANCE
    ) {

        showScalpWait(
            "WAIT — PRICE EXTENDED",
            "Price is too far from M5 EMA20.",
            "Wait for price to return closer to EMA20."
        );

        return;
    }

    let sl;

    if (
        direction === "BULLISH"
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
            entry - sl
        );

    const riskPips =
        risk / 0.0001;

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
        direction === "BULLISH"
            ? entry + risk * 1.5
            : entry - risk * 1.5;

    const tp2 =
        direction === "BULLISH"
            ? entry + risk * 2
            : entry - risk * 2;

    const rr =
        Math.abs(
            tp2 - entry
        ) /
        risk;

    if (
        rr < SCALP_MIN_RR
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
        direction === "BULLISH"
    ) {

        if (
            marketData.resistance1 &&
            marketData.resistance1 <= tp2
        ) {

            showScalpWait(
                "WAIT — RESISTANCE BLOCKS TP2",
                "Higher-timeframe resistance is too close.",
                "Need clear room to TP2."
            );

            return;
        }

    } else {

        if (
            marketData.support1 &&
            marketData.support1 >= tp2
        ) {

            showScalpWait(
                "WAIT — SUPPORT BLOCKS TP2",
                "Higher-timeframe support is too close.",
                "Need clear room to TP2."
            );

            return;
        }
    }

    if (
        score < SCALP_MIN_SCORE
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
        "ELITE SCALP — " +
        direction
    );

    setText(
        "scalpDirection",
        direction
    );

    setText(
        "scalpEntry",
        formatPrice(entry)
    );

    setText(
        "scalpSL",
        formatPrice(sl)
    );

    setText(
        "scalpTP1",
        formatPrice(tp1)
    );

    setText(
        "scalpTP2",
        formatPrice(tp2)
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
        "Valid while M5 structure remains aligned."
    );

    setText(
        "scalpTrigger",
        "Completed M5 momentum trigger confirmed."
    );

    setText(
        "scalpInvalidation",
        direction === "BULLISH"
            ? formatPrice(sl)
            : formatPrice(sl)
    );
}

// ============================================================
// SCALP WAIT
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
        "No scalp until all required conditions align."
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
            ", but M15/M5/EMA confirmation is incomplete."
        );

        return;
    }

    setText(
        "proVerdict",
        "ALIGNED — " +
        h4
    );

    setText(
        "proExplanation",
        "H4, H1, M15, M5 and EMA structure are aligned " +
        h4 +
        "."
    );
}

// ============================================================
// ELITE TRADE GATE
// ============================================================

function updateEliteTradeGate() {

    // --------------------------------------------------------
    // If data is unavailable
    // --------------------------------------------------------

    if (
        marketData.price === null
    ) {

        setText(
            "gateVerdict",
            "STAY AWAY"
        );

        setText(
            "gateExplanation",
            "Market data unavailable."
        );

        setText(
            "sessionDirection",
            "—"
        );

        setText(
            "sessionEntry",
            "—"
        );

        setText(
            "sessionSL",
            "—"
        );

        setText(
            "sessionTP1",
            "—"
        );

        setText(
            "sessionTP2",
            "—"
        );

        setText(
            "sessionRR",
            "—"
        );

        setText(
            "sessionRisk",
            "DATA ERROR"
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

    const newsClear =
        marketData.news.clear;

    const m5Confirmed =
        directionM5Confirmed();

    // --------------------------------------------------------
    // Determine direction
    // --------------------------------------------------------

    let direction = null;

    if (
        h4 === "BULLISH" &&
        h1 === "BULLISH"
    ) {

        direction = "BULLISH";

    }

    if (
        h4 === "BEARISH" &&
        h1 === "BEARISH"
    ) {

        direction = "BEARISH";

    }

    // --------------------------------------------------------
    // HARD NEWS GATE
    // --------------------------------------------------------

    if (
        !newsClear
    ) {

        setGateWait(
            "STAY AWAY",
            "News filter is not clear.",
            "NEWS"
        );

        return;
    }

    // --------------------------------------------------------
    // H4/H1
    // --------------------------------------------------------

    if (
        !direction
    ) {

        setGateWait(
            "STAY AWAY",
            "H4/H1 directional alignment is missing.",
            "H4/H1"
        );

        return;
    }

    // --------------------------------------------------------
    // M15
    // --------------------------------------------------------

    if (
        m15 !== direction
    ) {

        setGateWait(
            "STAY AWAY",
            "M15 confirmation is missing.",
            "M15"
        );

        return;
    }

    // --------------------------------------------------------
    // M5 STRUCTURE
    // --------------------------------------------------------

    if (
        m5 !== direction
    ) {

        setGateWait(
            "STAY AWAY",
            "M5 structure is not confirmed.",
            "M5"
        );

        return;
    }

    // --------------------------------------------------------
    // EMA
    // --------------------------------------------------------

    if (
        ema !== direction
    ) {

        setGateWait(
            "STAY AWAY",
            "M5 EMA20/EMA50 alignment is missing.",
            "EMA"
        );

        return;
    }

    // --------------------------------------------------------
    // M5 MOMENTUM
    // --------------------------------------------------------

    if (
        !m5Confirmed
    ) {

        setGateWait(
            "STAY AWAY",
            direction === "BEARISH"
                ? "SELL setup needs bearish M5 confirmation."
                : "BUY setup needs bullish M5 confirmation.",
            "M5 MOMENTUM"
        );

        return;
    }

    // --------------------------------------------------------
    // IF ALL HARD FILTERS PASS
    // --------------------------------------------------------

    setText(
        "gateVerdict",
        "A+ TRADE READY"
    );

    setText(
        "gateExplanation",
        "All primary filters are aligned. M5 confirmation achieved."
    );

    setText(
        "sessionDirection",
        direction === "BEARISH"
            ? "SELL"
            : "BUY"
    );

    setText(
        "sessionEntry",
        formatPrice(
            marketData.price
        )
    );

    setText(
        "sessionRisk",
        "NORMAL"
    );
}

// ============================================================
// GATE WAIT
// ============================================================

function setGateWait(
    verdict,
    explanation,
    reason
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
        "sessionDirection",
        "—"
    );

    setText(
        "sessionEntry",
        "—"
    );

    setText(
        "sessionSL",
        "—"
    );

    setText(
        "sessionTP1",
        "—"
    );

    setText(
        "sessionTP2",
        "—"
    );

    setText(
        "sessionRR",
        "—"
    );

    setText(
        "sessionRisk",
        reason
    );
}

// ============================================================
// CHECK M5 CONFIRMATION
// ============================================================

function directionM5Confirmed() {

    let direction = null;

    if (
        marketData.h4.trend ===
        marketData.h1.trend &&
        (
            marketData.h4.trend ===
            "BULLISH" ||
            marketData.h4.trend ===
            "BEARISH"
        )
    ) {

        direction =
            marketData.h4.trend;

    }

    if (!direction) {

        return false;

    }

    return getM5MomentumTrigger(
        direction
    );
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
            "CLEAR"
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
        news.risk === "UNKNOWN"
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
            "UNKNOWN"
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
// LAST M5 LOW
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

// ============================================================
// LAST M5 HIGH
// ============================================================

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
// FORMAT PRICE
// ============================================================

function formatPrice(value) {

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
// FORMAT NUMBER
// ============================================================

function formatNumber(value) {

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
        document.getElementById(id);

    if (element) {

        element.textContent =
            value;

    }
}
