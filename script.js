// ============================================================
// EUR/USD SNIPER DASHBOARD
// LIVE MARKET DATA + SNIPER + ELITE SCALP + ELITE TRADE GATE
// ============================================================

// IMPORTANT:
// Put your NEW Twelve Data API key here.
// Do NOT use the previously exposed key.
const API_KEY = "8908432b6c784bc49aad6ccf64845991";

const SYMBOL = "EUR/USD";

const TIME_SERIES_URL =
    "https://api.twelvedata.com/time_series";

const NEWS_URL =
    "https://xoomar.com/api/markets/calendar?importance=high";

// ------------------------------------------------------------
// ENGINE SETTINGS
// ------------------------------------------------------------

const REFRESH_MS = 180000; // 3 minutes

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
// SNIPER SETUP CLOCK
// ------------------------------------------------------------

// Time when the CURRENT Sniper setup first became valid.
let sniperSetupTime = null;

// True only while the current setup remains valid.
let sniperSetupActive = false;

// Prevents multiple simultaneous market-data loads.
let marketDataLoading = false;

// ------------------------------------------------------------
// GLOBAL MARKET DATA
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

// ============================================================
// PAGE LOAD
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    loadMarketData();

    setInterval(() => {

        if (!marketDataLoading) {
            loadMarketData();
        }

    }, REFRESH_MS);

});

// ============================================================
// CHART SWITCHER
// ============================================================

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

// ============================================================
// MAIN MARKET DATA LOADER
// ============================================================

async function loadMarketData() {

    if (marketDataLoading) {
        return;
    }

    marketDataLoading = true;

    setText(
        "priceStatus",
        "LOADING MARKET DATA..."
    );

    try {

        // IMPORTANT:
        // No separate /price request.
        // This reduces Twelve Data calls from 5 to 4.

        const [
            h4Candles,
            h1Candles,
            m15Candles,
            m5Candles,
            news
        ] = await Promise.all([

            getCandles("4h", 100),

            getCandles("1h", 100),

            getCandles("15min", 100),

            getCandles("5min", 100),

            getNews()

        ]);

        // ----------------------------------------------------
        // STORE CANDLES
        // ----------------------------------------------------

        marketData.h4.candles =
            h4Candles;

        marketData.h1.candles =
            h1Candles;

        marketData.m15.candles =
            m15Candles;

        marketData.m5.candles =
            m5Candles;

        // ----------------------------------------------------
        // PRICE
        // ----------------------------------------------------
        // Use the latest completed M5 candle instead of
        // making a separate /price API request.

        marketData.price =
            getLatestCompletedClose(
                m5Candles
            );

        if (!Number.isFinite(marketData.price)) {
            throw new Error(
                "Unable to calculate current price"
            );
        }

        // ----------------------------------------------------
        // MARKET STRUCTURE
        // ----------------------------------------------------

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

        // ----------------------------------------------------
        // RSI
        // ----------------------------------------------------

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

        // ----------------------------------------------------
        // EMA
        // ----------------------------------------------------

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
        // UPDATE DASHBOARD
        // ----------------------------------------------------

        updateDashboard();

        // ----------------------------------------------------
        // RUN ENGINES
        // ----------------------------------------------------

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

        invalidateSniperSetup();

        setText(
            "priceStatus",
            "DATA LOAD FAILED"
        );

        showDataError(
            error.message
        );

    } finally {

        marketDataLoading = false;
    }
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
            " (" +
            interval +
            ")"
        );
    }

    const data =
        await response.json();

    if (
        data.code === 429 ||
        data.status === "error" &&
        String(data.message || "")
            .toLowerCase()
            .includes("limit")
    ) {

        throw new Error(
            "Twelve Data rate limit reached."
        );
    }

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
                new Date(a.datetime) -
                new Date(b.datetime)
        );
}

// ============================================================
// LATEST COMPLETED CLOSE
// ============================================================

function getLatestCompletedClose(
    candles
) {

    if (
        !candles ||
        candles.length < 2
    ) {
        return null;
    }

    // Twelve Data normally returns the current
    // incomplete candle first/last depending on
    // endpoint ordering. We sorted ascending above.
    // Therefore the final candle can be the current
    // candle. Use the previous one.

    const completed =
        candles.slice(0, -1);

    if (!completed.length) {
        return null;
    }

    return Number(
        completed[
            completed.length - 1
        ].close
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
                    parseEventTime(
                        timeValue
                    );

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

    if (!value) {
        return null;
    }

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

    if (movement > threshold) {
        return "BULLISH";
    }

    if (movement < -threshold) {
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
        highs[highs.length - 1] >
        highs[0];

    const higherLow =
        lows[lows.length - 1] >
        lows[0];

    const lowerHigh =
        highs[highs.length - 1] <
        highs[0];

    const lowerLow =
        lows[lows.length - 1] <
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
        ) / ranges.length;

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

    if (recent.length < 10) {

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
                x => x > current
            )
            .sort(
                (a, b) =>
                    a - b
            );

    const supports =
        swingLows
            .filter(
                x => x < current
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
            Math.max(
                ...recent.map(
                    c => c.high
                )
            ),

        support1:
            supports[0] ||
            Math.min(
                ...recent.map(
                    c => c.low
                )
            ),

        support2:
            supports[1] ||
            Math.min(
                ...recent.map(
                    c => c.low
                )
            )
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

        if (change >= 0) {

            gains += change;

        } else {

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

    return (
        100 -
        100 / (1 + rs)
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
        2 / (period + 1);

    let ema =
        completed
            .slice(0, period)
            .reduce(
                (sum, candle) =>
                    sum +
                    candle.close,
                0
            ) / period;

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

    if (range <= 0) {
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
// SNIPER SETUP CLOCK
// ============================================================

// This records the time ONLY when a NEW setup starts.

function startSniperSetup() {

    if (!sniperSetupActive) {

        sniperSetupTime =
            getISTTime();

        sniperSetupActive = true;
    }

    setText(
        "setupTime",
        sniperSetupTime
    );
}

// ------------------------------------------------------------
// SETUP INVALIDATION
// ------------------------------------------------------------

function invalidateSniperSetup() {

    sniperSetupActive = false;

    sniperSetupTime = null;

    setText(
        "setupTime",
        "--"
    );
}

// ------------------------------------------------------------
// IST CLOCK
// ------------------------------------------------------------

function getISTTime() {

    return new Date()
        .toLocaleTimeString(
            "en-IN",
            {
                timeZone:
                    "Asia/Kolkata",

                hour:
                    "2-digit",

                minute:
                    "2-digit",

                second:
                    "2-digit",

                hour12:
                    true
            }
        ) + " IST";
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

    let rsiConfirmed = false;

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
    // NEWS
    // --------------------------------------------------------

    if (
        !marketData.news.clear
    ) {

        invalidateSniperSetup();

        setSniperWait(
            "WAIT — NEWS FILTER",
            "News filter not clear.",
            "Wait for EUR/USD news risk to clear.",
            "News risk."
        );

        return;
    }

    // --------------------------------------------------------
    // H4 / H1 RANGE
    // --------------------------------------------------------

    if (
        h4 === "RANGE" ||
        h1 === "RANGE"
    ) {

        invalidateSniperSetup();

        setSniperWait(
            "WAIT — HIGHER TIMEFRAME RANGE",
            "H4/H1 requires directional structure.",
            "Wait for H4 and H1 directional structure.",
            "Higher timeframe range."
        );

        return;
    }

    // --------------------------------------------------------
    // H4 / H1 CONFLICT
    // --------------------------------------------------------

    if (
        h4 !== h1
    ) {

        invalidateSniperSetup();

        setSniperWait(
            "WAIT — H4/H1 CONFLICT",
            "H4 " +
            h4 +
            " but H1 " +
            h1 +
            ".",
            "Wait for H1 to align with H4.",
            "Higher timeframe conflict."
        );

        return;
    }

    direction = h4;

    // --------------------------------------------------------
    // STRICT LOWER-TIMEFRAME CONFIRMATION
    // --------------------------------------------------------

    const momentumTrigger =
        getM5MomentumTrigger(
            direction
        );

    // Sniper should not call an incomplete setup A+.
    if (
        m15 !== direction ||
        m5 !== direction ||
        ema !== direction ||
        !rsiConfirmed ||
        !momentumTrigger
    ) {

        invalidateSniperSetup();

        setSniperWait(
            "WAIT — A+ CONFIRMATION INCOMPLETE",

            "H4/H1 aligned " +
            direction +
            " but lower-timeframe confirmation is incomplete.",

            "Required: M15 + M5 + EMA + RSI + completed M5 momentum.",

            "A+ setup not fully confirmed."
        );

        return;
    }

    // --------------------------------------------------------
    // SCORE
    // --------------------------------------------------------

    if (
        score < 80
    ) {

        invalidateSniperSetup();

        setSniperWait(
            "WAIT — SCORE BELOW A+",

            "Score " +
            score +
            "/100.",

            "Required minimum: 80/100.",

            "Score below A+ threshold."
        );

        return;
    }

    // --------------------------------------------------------
    // ENTRY
    // --------------------------------------------------------

    const entry =
        marketData.price;

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

    if (
        !Number.isFinite(entry) ||
        !Number.isFinite(sl)
    ) {

        invalidateSniperSetup();

        setSniperWait(
            "WAIT — INVALID LEVELS",
            "Entry or stop-loss data unavailable.",
            "Wait for valid support/resistance.",
            "Invalid price levels."
        );

        return;
    }

    const risk =
        Math.abs(
            entry - sl
        );

    const riskPips =
        risk / 0.0001;

    // --------------------------------------------------------
    // RISK
    // --------------------------------------------------------

    if (
        riskPips < 3 ||
        riskPips > 15
    ) {

        invalidateSniperSetup();

        setSniperWait(
            "WAIT — RISK OUT OF RANGE",

            "Structural risk: " +
            riskPips.toFixed(1) +
            " pips.",

            "Required: 3–15 pips.",

            "Risk outside allowed range."
        );

        return;
    }

    // --------------------------------------------------------
    // TARGETS
    // --------------------------------------------------------

    const tp1 =
        direction === "BULLISH"
            ? entry + risk
            : entry - risk;

    const tp2 =
        direction === "BULLISH"
            ? entry + risk * 2
            : entry - risk * 2;

    const tp3 =
        direction === "BULLISH"
            ? entry + risk * 3
            : entry - risk * 3;

    const rr =
        Math.abs(
            tp2 - entry
        ) / risk;

    // --------------------------------------------------------
    // S/R BLOCK
    // --------------------------------------------------------

    if (
        direction === "BULLISH" &&
        marketData.resistance1 &&
        marketData.resistance1 <= tp2
    ) {

        invalidateSniperSetup();

        setSniperWait(
            "WAIT — RESISTANCE BLOCKS TP2",
            "Higher-timeframe resistance is too close.",
            "Need clear room to TP2.",
            "Resistance blocks target."
        );

        return;
    }

    if (
        direction === "BEARISH" &&
        marketData.support1 &&
        marketData.support1 >= tp2
    ) {

        invalidateSniperSetup();

        setSniperWait(
            "WAIT — SUPPORT BLOCKS TP2",
            "Higher-timeframe support is too close.",
            "Need clear room to TP2.",
            "Support blocks target."
        );

        return;
    }

    // --------------------------------------------------------
    // RR
    // --------------------------------------------------------

    if (
        rr < 2
    ) {

        invalidateSniperSetup();

        setSniperWait(
            "WAIT — RR BELOW MINIMUM",
            "Risk/Reward: 1:" +
            rr.toFixed(2),
            "Required minimum: 1:2.",
            "RR below minimum."
        );

        return;
    }

    // ========================================================
    // A+ SETUP IS NOW VALID
    // ========================================================

    // IMPORTANT:
    // If this is the first time the setup became valid,
    // startSniperSetup() records the exact IST time.
    //
    // On subsequent refreshes, the same time remains.
    //
    // If any condition above becomes invalid, the time
    // is cleared by invalidateSniperSetup().
    //
    // When a new setup forms later, a NEW time is recorded.

    startSniperSetup();

    setText(
        "sniperStatus",
        "A+ SNIPER — " +
        direction
    );

    setText(
        "direction",
        direction
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
        rr.toFixed(2)
    );

    setText(
        "validity",
        "A+ setup confirmed. Score " +
        score +
        "/100."
    );

    setText(
        "trigger",
        "Completed M5 momentum candle confirmed."
    );

    setText(
        "invalidation",

        direction === "BULLISH"
            ? "Below stop loss / bullish structure failure."
            : "Above stop loss / bearish structure failure."
    );
}

// ============================================================
// SNIPER WAIT DISPLAY
// ============================================================

function setSniperWait(
    status,
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
        "WAIT"
    );

    setText(
        "entry",
        "—"
    );

    setText(
        "stopLoss",
        "—"
    );

    setText(
        "tp1",
        "—"
    );

    setText(
        "tp2",
        "—"
    );

    setText(
        "tp3",
        "—"
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

    let rsiAligned = false;

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

    if (rsiAligned) {
        score += 15;
    }

    const momentumTrigger =
        getM5MomentumTrigger(
            direction
        );

    if (momentumTrigger) {
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

    if (!rsiAligned) {

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

    if (!momentumTrigger) {

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
        ) / risk;

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
        direction === "BULLISH" &&
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

    if (
        direction === "BEARISH" &&
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
        score + "/100"
    );

    setText(
        "scalpValidity",
        "NEXT 2 HOURS — A+ conditions confirmed."
    );

    setText(
        "scalpTrigger",
        "Completed M5 momentum trigger confirmed."
    );

    setText(
        "scalpInvalidation",

        direction === "BULLISH"
            ? "Below stop loss / bullish structure failure."
            : "Above stop loss / bearish structure failure."
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
            ". Wait for higher-timeframe alignment."
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

function runEliteTradeGate() {

    const gate =
        document.getElementById(
            "eliteTradeGate"
        );

    if (!gate) {
        return;
    }

    // --------------------------------------------------------
    // DATA CHECK
    // --------------------------------------------------------

    if (
        !Number.isFinite(
            marketData.price
        ) ||
        marketData.h4.candles.length < 10 ||
        marketData.h1.candles.length < 10 ||
        marketData.m15.candles.length < 10 ||
        marketData.m5.candles.length < 10
    ) {

        setText(
            "eliteTradeGate",
            "STAY AWAY"
        );

        setText(
            "gateReason",
            "Market data could not be loaded."
        );

        updateChecklist(false);

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

    const rsi =
        marketData.m5.rsi;

    const direction =
        h4;

    const momentum =
        direction === "BULLISH" ||
        direction === "BEARISH"
            ? getM5MomentumTrigger(
                direction
            )
            : false;

    const session =
        isActiveTradingSession();

    const newsClear =
        marketData.news.clear;

    const rsiConfirmed =
        direction === "BULLISH"
            ? rsi !== null &&
              rsi >= BULLISH_RSI_MIN &&
              rsi <= BULLISH_RSI_MAX
            : direction === "BEARISH"
                ? rsi !== null &&
                  rsi >= BEARISH_RSI_MIN &&
                  rsi <= BEARISH_RSI_MAX
                : false;

    const alignment =
        h4 !== "RANGE" &&
        h1 !== "RANGE" &&
        h4 === h1 &&
        m15 === h4 &&
        m5 === h4;

    let riskOK = false;
    let rrOK = false;
    let srOK = false;
    let extensionOK = false;

    if (
        alignment &&
        Number.isFinite(
            marketData.price
        )
    ) {

        const entry =
            marketData.price;

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

        if (
            Number.isFinite(sl)
        ) {

            const risk =
                Math.abs(
                    entry - sl
                );

            const riskPips =
                risk / 0.0001;

            riskOK =
                riskPips >= 3 &&
                riskPips <= 15;

            const tp2 =
                direction === "BULLISH"
                    ? entry + risk * 2
                    : entry - risk * 2;

            const rr =
                risk > 0
                    ? Math.abs(
                        tp2 - entry
                    ) / risk
                    : 0;

            rrOK =
                rr >= 2;

            if (
                direction === "BULLISH"
            ) {

                srOK =
                    !marketData.resistance1 ||
                    marketData.resistance1 > tp2;

            } else {

                srOK =
                    !marketData.support1 ||
                    marketData.support1 < tp2;
            }

            const ema20 =
                marketData.m5.ema20;

            extensionOK =
                Number.isFinite(ema20) &&
                Math.abs(
                    entry - ema20
                ) <=
                SCALP_MAX_EMA_DISTANCE;
        }
    }

    const allReady =
        session &&
        newsClear &&
        alignment &&
        ema === direction &&
        rsiConfirmed &&
        momentum &&
        extensionOK &&
        riskOK &&
        rrOK &&
        srOK;

    updateChecklist({
        session,
        newsClear,
        alignment,
        m15:
            m15 === direction,
        m5:
            m5 === direction,
        ema:
            ema === direction,
        rsi:
            rsiConfirmed,
        momentum,
        extension:
            extensionOK,
        risk:
            riskOK,
        rr:
            rrOK,
        sr:
            srOK
    });

    if (!allReady) {

        setText(
            "eliteTradeGate",
            "STAY AWAY"
        );

        setText(
            "gateReason",
            getGateReason({
                session,
                newsClear,
                alignment,
                ema:
                    ema === direction,
                rsi:
                    rsiConfirmed,
                momentum,
                extension:
                    extensionOK,
                risk:
                    riskOK,
                rr:
                    rrOK,
                sr:
                    srOK
            })
        );

        return;
    }

    setText(
        "eliteTradeGate",
        "A+ TRADE READY"
    );

    setText(
        "gateReason",
        "All primary execution filters are aligned " +
        direction +
        "."
    );
}

// ============================================================
// GATE REASON
// ============================================================

function getGateReason(c) {

    if (!c.session)
        return "Outside preferred London / New York session.";

    if (!c.newsClear)
        return "EUR/USD high-impact news filter is not clear.";

    if (!c.alignment)
        return "H4/H1/M15/M5 structure is not fully aligned.";

    if (!c.ema)
        return "M5 EMA20/EMA50 alignment missing.";

    if (!c.rsi)
        return "M5 RSI confirmation missing.";

    if (!c.momentum)
        return "Completed M5 momentum candle not confirmed.";

    if (!c.extension)
        return "Price is excessively extended from M5 EMA20.";

    if (!c.risk)
        return "Structural risk is outside 3–15 pips.";

    if (!c.rr)
        return "Minimum 1:2 Risk/Reward not available.";

    if (!c.sr)
        return "Higher-timeframe S/R blocks TP2.";

    return "Required conditions are incomplete.";
}

// ============================================================
// SESSION
// ============================================================

function isActiveTradingSession() {

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

    // Broad London + New York trading window in IST.
    // This is intentionally a broad execution window.
    return (
        hour >= 12 &&
        hour < 23
    );
}

// ============================================================
// CHECKLIST
// ============================================================

function updateChecklist(
    checks
) {

    const items = [

        {
            id:
                "checkSession",
            value:
                checks.session
        },

        {
            id:
                "checkNews",
            value:
                checks.newsClear
        },

        {
            id:
                "checkHtf",
            value:
                checks.alignment
        },

        {
            id:
                "checkM15",
            value:
                checks.m15
        },

        {
            id:
                "checkM5",
            value:
                checks.m5
        },

        {
            id:
                "checkEMA",
            value:
                checks.ema
        },

        {
            id:
                "checkRSI",
            value:
                checks.rsi
        },

        {
            id:
                "checkMomentum",
            value:
                checks.momentum
        },

        {
            id:
                "checkExtension",
            value:
                checks.extension
        },

        {
            id:
                "checkRisk",
            value:
                checks.risk
        },

        {
            id:
                "checkRR",
            value:
                checks.rr
        },

        {
            id:
                "checkSR",
            value:
                checks.sr
        }

    ];

    items.forEach(item => {

        const element =
            document.getElementById(
                item.id
            );

        if (!element) {
            return;
        }

        const original =
            element.dataset.label ||
            element.textContent
                .replace(
                    /^.*?\s/,
                    ""
                );

        if (
            !element.dataset.label
        ) {
            element.dataset.label =
                original;
        }

        element.textContent =
            (
                item.value
                    ? "✓ "
                    : "— "
            ) +
            element.dataset.label;
    });
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

    const news =
        marketData.news;

    if (news.clear) {

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
            "✅ NEWS CLEAR"
        );

        setText(
            "nextEvent",
            "No upcoming high-impact EUR/USD event found."
        );

        setText(
            "tradingRisk",
            "NORMAL — TECHNICAL FILTER ACTIVE"
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
            "⚠️ NEWS UNKNOWN"
        );

        setText(
            "nextEvent",
            "Cannot verify upcoming high-impact news."
        );

        setText(
            "tradingRisk",
            "UNKNOWN — NEWS FILTER ACTIVE"
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
            "⚠️ NEWS RISK"
        );

        setText(
            "nextEvent",
            "High-impact event inside the next 2 hours."
        );

        setText(
            "tradingRisk",
            "HIGH — NEWS FILTER ACTIVE"
        );
    }
}

// ============================================================
// DATA ERROR DISPLAY
// ============================================================

function showDataError(
    message
) {

    setText(
        "proVerdict",
        "WAIT"
    );

    setText(
        "proExplanation",
        "Waiting for complete market data..."
    );

    setText(
        "eliteTradeGate",
        "STAY AWAY"
    );

    setText(
        "gateReason",
        message ||
        "Market data could not be loaded."
    );

    setText(
        "tradingRisk",
        "DATA ERROR"
    );

    setText(
        "priceStatus",
        "DATA LOAD FAILED"
    );
}

// ============================================================
// LAST M5 LOW
// ============================================================

function getLastM5Low() {

    const candles =
        marketData.m5.candles;

    const completed =
        candles.slice(0, -1);

    if (!completed.length) {
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

    if (!completed.length) {
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
