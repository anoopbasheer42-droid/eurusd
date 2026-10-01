// ============================================================
// EUR/USD SNIPER DASHBOARD
// PROFESSIONAL PRICE ACTION + SNIPER + ELITE SCALPING
// ============================================================

// IMPORTANT:
// NEVER publish your real API key in public GitHub repositories.
// Replace this with a NEW Twelve Data API key.
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

const SNIPER_MIN_SCORE = 80;
const SNIPER_MIN_RR = 2.0;

const SNIPER_MIN_RISK_PIPS = 5;
const SNIPER_MAX_RISK_PIPS = 20;

const SNIPER_SL_BUFFER = 0.00010;

// ============================================================
// SCALPING SETTINGS
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
// SETUP MEMORY
// ============================================================

let sniperSetup = {
    active: false,
    direction: null,
    detectedAt: null,
    entry: null,
    stopLoss: null,
    tp1: null,
    tp2: null,
    tp3: null
};

// ============================================================
// GLOBAL MARKET DATA
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
// PAGE LOAD
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    loadMarketData();

    // Refresh every 2 minutes
    setInterval(
        loadMarketData,
        120000
    );

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

    setText(
        "priceStatus",
        "LOADING MARKET DATA..."
    );

    try {

        // ----------------------------------------------------
        // Load separately instead of Promise.all.
        // This reduces simultaneous API requests and helps
        // avoid Twelve Data HTTP 429 rate-limit errors.
        // ----------------------------------------------------

        const price =
            await getPrice();

        await delay(500);

        const h4Candles =
            await getCandles("4h", 100);

        await delay(500);

        const h1Candles =
            await getCandles("1h", 100);

        await delay(500);

        const m15Candles =
            await getCandles("15min", 100);

        await delay(500);

        const m5Candles =
            await getCandles("5min", 100);

        await delay(500);

        const news =
            await getNews();

        // ----------------------------------------------------
        // STORE DATA
        // ----------------------------------------------------

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

        setText(
            "priceStatus",
            "DATA LOAD FAILED — " +
            error.message
        );

        // IMPORTANT:
        // Do not leave an old A+ setup active when
        // current market data failed.
        invalidateSniperSetup(
            "Market data unavailable."
        );
    }
}

// ============================================================
// DELAY
// ============================================================

function delay(ms) {

    return new Promise(
        resolve => setTimeout(
            resolve,
            ms
        )
    );
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
            "Price HTTP " +
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
            "Candle HTTP " +
            response.status +
            " — " +
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
                }
            );

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
                x => x > current
            )
            .sort(
                (a, b) => a - b
            );

    const supports =
        swingLows
            .filter(
                x => x < current
            )
            .sort(
                (a, b) => b - a
            );

    const recentHigh =
        Math.max(
            ...recent.map(
                c => c.high
            )
        );

    const recentLow =
        Math.min(
            ...recent.map(
                c => c.low
            )
        );

    return {

        resistance1:
            resistances[0] ||
            recentHigh,

        resistance2:
            resistances[1] ||
            recentHigh,

        support1:
            supports[0] ||
            recentLow,

        support2:
            supports[1] ||
            recentLow
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

    return 100 -
        100 / (1 + rs);
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
// GET LAST COMPLETED M5 CANDLE
// ============================================================

function getLastCompletedM5() {

    const candles =
        marketData.m5.candles;

    if (
        !candles ||
        candles.length < 2
    ) {
        return null;
    }

    return candles[
        candles.length - 2
    ];
}

// ============================================================
// M5 MOMENTUM CONFIRMATION
// ============================================================

function getM5MomentumTrigger(
    direction
) {

    const candles =
        marketData.m5.candles;

    if (
        !candles ||
        candles.length < 4
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

    // Require strong candle body
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
// RECENT M5 SWING HIGH
// ============================================================

function getRecentM5SwingHigh() {

    const candles =
        marketData.m5.candles;

    if (
        !candles ||
        candles.length < 7
    ) {
        return null;
    }

    const completed =
        candles.slice(0, -1);

    const recent =
        completed.slice(-20);

    const swings = [];

    for (
        let i = 2;
        i < recent.length - 2;
        i++
    ) {

        if (
            recent[i].high >
            recent[i - 1].high &&
            recent[i].high >
            recent[i - 2].high &&
            recent[i].high >
            recent[i + 1].high &&
            recent[i].high >
            recent[i + 2].high
        ) {

            swings.push(
                recent[i].high
            );
        }
    }

    if (!swings.length) {

        return Math.max(
            ...recent.map(
                c => c.high
            )
        );
    }

    return swings[
        swings.length - 1
    ];
}

// ============================================================
// RECENT M5 SWING LOW
// ============================================================

function getRecentM5SwingLow() {

    const candles =
        marketData.m5.candles;

    if (
        !candles ||
        candles.length < 7
    ) {
        return null;
    }

    const completed =
        candles.slice(0, -1);

    const recent =
        completed.slice(-20);

    const swings = [];

    for (
        let i = 2;
        i < recent.length - 2;
        i++
    ) {

        if (
            recent[i].low <
            recent[i - 1].low &&
            recent[i].low <
            recent[i - 2].low &&
            recent[i].low <
            recent[i + 1].low &&
            recent[i].low <
            recent[i + 2].low
        ) {

            swings.push(
                recent[i].low
            );
        }
    }

    if (!swings.length) {

        return Math.min(
            ...recent.map(
                c => c.low
            )
        );
    }

    return swings[
        swings.length - 1
    ];
}

// ============================================================
// RECENT M15 SWING HIGH
// ============================================================

function getRecentM15SwingHigh() {

    const candles =
        marketData.m15.candles;

    if (
        !candles ||
        candles.length < 7
    ) {
        return null;
    }

    const completed =
        candles.slice(0, -1);

    const recent =
        completed.slice(-20);

    let highest =
        recent[0].high;

    for (
        let i = 1;
        i < recent.length;
        i++
    ) {

        if (
            recent[i].high >
            highest
        ) {
            highest =
                recent[i].high;
        }
    }

    return highest;
}

// ============================================================
// RECENT M15 SWING LOW
// ============================================================

function getRecentM15SwingLow() {

    const candles =
        marketData.m15.candles;

    if (
        !candles ||
        candles.length < 7
    ) {
        return null;
    }

    const completed =
        candles.slice(0, -1);

    const recent =
        completed.slice(-20);

    let lowest =
        recent[0].low;

    for (
        let i = 1;
        i < recent.length;
        i++
    ) {

        if (
            recent[i].low <
            lowest
        ) {
            lowest =
                recent[i].low;
        }
    }

    return lowest;
}

// ============================================================
// FIND SNIPER STOP LOSS
// ============================================================

function calculateSniperStopLoss(
    direction,
    entry
) {

    if (
        !Number.isFinite(entry)
    ) {
        return null;
    }

    if (
        direction === "BEARISH"
    ) {

        const m5High =
            getRecentM5SwingHigh();

        const m15High =
            getRecentM15SwingHigh();

        const structuralHigh =
            Math.max(
                m5High || -Infinity,
                m15High || -Infinity
            );

        if (
            !Number.isFinite(
                structuralHigh
            )
        ) {
            return null;
        }

        return (
            structuralHigh +
            SNIPER_SL_BUFFER
        );
    }

    if (
        direction === "BULLISH"
    ) {

        const m5Low =
            getRecentM5SwingLow();

        const m15Low =
            getRecentM15SwingLow();

        const structuralLow =
            Math.min(
                m5Low || Infinity,
                m15Low || Infinity
            );

        if (
            !Number.isFinite(
                structuralLow
            )
        ) {
            return null;
        }

        return (
            structuralLow -
            SNIPER_SL_BUFFER
        );
    }

    return null;
}

// ============================================================
// BUILD SNIPER TARGETS
// ============================================================

function calculateSniperTargets(
    direction,
    entry,
    stopLoss
) {

    const risk =
        Math.abs(
            entry -
            stopLoss
        );

    if (
        !Number.isFinite(risk) ||
        risk <= 0
    ) {
        return null;
    }

    // --------------------------------------------------------
    // SELL TARGETS
    // --------------------------------------------------------

    if (
        direction === "BEARISH"
    ) {

        const supports = [
            marketData.support1,
            marketData.support2
        ]
            .filter(
                x =>
                    Number.isFinite(x) &&
                    x < entry
            )
            .sort(
                (a, b) => b - a
            );

        let tp1 = null;
        let tp2 = null;
        let tp3 = null;

        // First meaningful downside structure
        if (
            supports.length >= 1
        ) {
            tp1 = supports[0];
        }

        // Second meaningful downside structure
        if (
            supports.length >= 2
        ) {
            tp2 = supports[1];
        }

        // ----------------------------------------------------
        // If structural targets are unavailable,
        // use risk-based fallback targets.
        // ----------------------------------------------------

        if (
            !Number.isFinite(tp1)
        ) {

            tp1 =
                entry -
                risk * 1.5;
        }

        // TP2 must NEVER be closer than TP1.
        const minimumTP2 =
            entry -
            risk * 2.0;

        if (
            !Number.isFinite(tp2) ||
            tp2 > minimumTP2
        ) {

            tp2 =
                minimumTP2;
        }

        // TP3 is an extension beyond TP2.
        const minimumTP3 =
            entry -
            risk * 3.0;

        if (
            !Number.isFinite(tp3) ||
            tp3 > minimumTP3
        ) {

            tp3 =
                minimumTP3;
        }

        // Make sure the order is correct.
        tp1 =
            Math.min(
                tp1,
                entry - risk
            );

        tp2 =
            Math.min(
                tp2,
                tp1 - risk * 0.5
            );

        tp3 =
            Math.min(
                tp3,
                tp2 - risk * 0.5
            );

        return {

            tp1,
            tp2,
            tp3,

            rr1:
                Math.abs(
                    tp1 - entry
                ) / risk,

            rr2:
                Math.abs(
                    tp2 - entry
                ) / risk,

            rr3:
                Math.abs(
                    tp3 - entry
                ) / risk
        };
    }

    // --------------------------------------------------------
    // BUY TARGETS
    // --------------------------------------------------------

    if (
        direction === "BULLISH"
    ) {

        const resistances = [
            marketData.resistance1,
            marketData.resistance2
        ]
            .filter(
                x =>
                    Number.isFinite(x) &&
                    x > entry
            )
            .sort(
                (a, b) => a - b
            );

        let tp1 = null;
        let tp2 = null;
        let tp3 = null;

        if (
            resistances.length >= 1
        ) {
            tp1 =
                resistances[0];
        }

        if (
            resistances.length >= 2
        ) {
            tp2 =
                resistances[1];
        }

        if (
            !Number.isFinite(tp1)
        ) {

            tp1 =
                entry +
                risk * 1.5;
        }

        const minimumTP2 =
            entry +
            risk * 2.0;

        if (
            !Number.isFinite(tp2) ||
            tp2 < minimumTP2
        ) {

            tp2 =
                minimumTP2;
        }

        const minimumTP3 =
            entry +
            risk * 3.0;

        if (
            !Number.isFinite(tp3) ||
            tp3 < minimumTP3
        ) {

            tp3 =
                minimumTP3;
        }

        tp1 =
            Math.max(
                tp1,
                entry + risk
            );

        tp2 =
            Math.max(
                tp2,
                tp1 + risk * 0.5
            );

        tp3 =
            Math.max(
                tp3,
                tp2 + risk * 0.5
            );

        return {

            tp1,
            tp2,
            tp3,

            rr1:
                Math.abs(
                    tp1 - entry
                ) / risk,

            rr2:
                Math.abs(
                    tp2 - entry
                ) / risk,

            rr3:
                Math.abs(
                    tp3 - entry
                ) / risk
        };
    }

    return null;
}

// ============================================================
// SNIPER SETUP TIMESTAMP
// ============================================================

function getSetupTimestamp() {

    const now =
        new Date();

    return now.toLocaleString(
        "en-IN",
        {
            timeZone:
                "Asia/Kolkata",

            year: "numeric",
            month: "2-digit",
            day: "2-digit",

            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",

            hour12: false
        }
    );
}

// ============================================================
// INVALIDATE SNIPER SETUP
// ============================================================

function invalidateSniperSetup(
    reason
) {

    sniperSetup = {

        active: false,
        direction: null,
        detectedAt: null,
        entry: null,
        stopLoss: null,
        tp1: null,
        tp2: null,
        tp3: null

    };

    setText(
        "setupDetectedTime",
        "—"
    );

    if (reason) {

        setText(
            "sniperInvalidation",
            reason
        );
    }
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

        direction =
            h4;

    } else if (
        h1 === "BULLISH" ||
        h1 === "BEARISH"
    ) {

        direction =
            h1;
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
        rsiConfirmed =
            true;
    }

    if (
        direction === "BEARISH" &&
        rsi15 !== null &&
        rsi5 !== null &&
        rsi15 < 50 &&
        rsi5 < 50
    ) {
        rsiConfirmed =
            true;
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

        invalidateSniperSetup(
            "News filter is not clear."
        );

        showSniperWait(
            "WAIT — NEWS FILTER",
            "WAIT",
            "—",
            "—",
            "—",
            "—",
            "—",
            "News filter not clear.",
            "Wait for news filter confirmation."
        );

        return;
    }

    // --------------------------------------------------------
    // H4 / H1 REQUIREMENT
    // --------------------------------------------------------

    if (
        h4 === "RANGE" ||
        h1 === "RANGE"
    ) {

        invalidateSniperSetup(
            "Higher timeframe range."
        );

        showSniperWait(
            "WAIT — HIGHER TIMEFRAME RANGE",
            "WAIT",
            "—",
            "—",
            "—",
            "—",
            "—",
            "H4/H1 requires directional structure.",
            "Wait for H4 and H1 directional structure."
        );

        return;
    }

    if (
        h4 !== h1
    ) {

        invalidateSniperSetup(
            "H4/H1 conflict."
        );

        showSniperWait(
            "WAIT — H4/H1 CONFLICT",
            "WAIT",
            "—",
            "—",
            "—",
            "—",
            "—",
            "H4/H1 directional conflict.",
            "Wait for H4 and H1 alignment."
        );

        return;
    }

    direction =
        h4;

    // --------------------------------------------------------
    // LOWER TIMEFRAME STRUCTURE
    // --------------------------------------------------------

    if (
        m15 !== direction ||
        m5 !== direction
    ) {

        invalidateSniperSetup(
            "Lower timeframe structure not aligned."
        );

        showSniperWait(
            "WAIT — STRUCTURE ALIGNMENT",
            direction,
            "—",
            "—",
            "—",
            "—",
            "—",
            "H4/H1 aligned but M15/M5 structure is not confirmed.",
            "Wait for M15 and M5 structure to align."
        );

        return;
    }

    // --------------------------------------------------------
    // EMA
    // --------------------------------------------------------

    if (
        ema !== direction
    ) {

        invalidateSniperSetup(
            "EMA structure not aligned."
        );

        showSniperWait(
            "WAIT — EMA NOT ALIGNED",
            direction,
            "—",
            "—",
            "—",
            "—",
            "—",
            "M5 EMA20/EMA50 does not confirm direction.",
            "Wait for EMA alignment."
        );

        return;
    }

    // --------------------------------------------------------
    // RSI
    // --------------------------------------------------------

    if (
        !rsiConfirmed
    ) {

        invalidateSniperSetup(
            "RSI confirmation missing."
        );

        showSniperWait(
            "WAIT — RSI NOT CONFIRMED",
            direction,
            "—",
            "—",
            "—",
            "—",
            "—",
            "RSI confirmation incomplete.",
            "Wait for RSI confirmation."
        );

        return;
    }

    // --------------------------------------------------------
    // CRITICAL:
    // M5 STRUCTURE IS NOT THE SAME AS M5 ENTRY TRIGGER.
    // --------------------------------------------------------

    const momentumTrigger =
        getM5MomentumTrigger(
            direction
        );

    if (
        !momentumTrigger
    ) {

        // Do NOT call this A+ yet.
        invalidateSniperSetup(
            "Waiting for completed M5 momentum confirmation."
        );

        showSniperWait(
            "WAIT — M5 CONFIRMATION",
            direction,
            "—",
            "—",
            "—",
            "—",
            "—",
            "M5 structure is aligned, but the completed M5 momentum candle has not confirmed.",
            "Wait for bearish/bullish M5 momentum confirmation."
        );

        return;
    }

    // --------------------------------------------------------
    // SCORE GATE
    // --------------------------------------------------------

    if (
        score < SNIPER_MIN_SCORE
    ) {

        invalidateSniperSetup(
            "Sniper score below A+ threshold."
        );

        showSniperWait(
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
            "Required minimum: " +
            SNIPER_MIN_SCORE +
            "/100."
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

        invalidateSniperSetup(
            "Entry data unavailable."
        );

        showSniperWait(
            "WAIT — PRICE DATA",
            direction,
            "—",
            "—",
            "—",
            "—",
            "—",
            "Price unavailable.",
            "Wait for fresh market data."
        );

        return;
    }

    // --------------------------------------------------------
    // STRUCTURAL STOP LOSS
    // --------------------------------------------------------

    const stopLoss =
        calculateSniperStopLoss(
            direction,
            entry
        );

    if (
        !Number.isFinite(
            stopLoss
        )
    ) {

        invalidateSniperSetup(
            "Unable to calculate structural stop."
        );

        showSniperWait(
            "WAIT — STRUCTURAL SL",
            direction,
            formatPrice(entry),
            "—",
            "—",
            "—",
            "—",
            "Structural stop unavailable.",
            "Wait for a valid swing structure."
        );

        return;
    }

    const risk =
        Math.abs(
            entry -
            stopLoss
        );

    const riskPips =
        risk / 0.0001;

    // --------------------------------------------------------
    // STRUCTURAL RISK FILTER
    // --------------------------------------------------------

    if (
        riskPips <
        SNIPER_MIN_RISK_PIPS ||
        riskPips >
        SNIPER_MAX_RISK_PIPS
    ) {

        invalidateSniperSetup(
            "Structural risk outside 5–20 pip range."
        );

        showSniperWait(
            "WAIT — STRUCTURAL RISK",
            direction,
            formatPrice(entry),
            formatPrice(stopLoss),
            "—",
            "—",
            "—",
            "Structural risk: " +
            riskPips.toFixed(1) +
            " pips.",
            "Required Sniper structural risk: 5–20 pips."
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
            stopLoss
        );

    if (!targets) {

        invalidateSniperSetup(
            "Unable to calculate targets."
        );

        showSniperWait(
            "WAIT — TARGETS",
            direction,
            formatPrice(entry),
            formatPrice(stopLoss),
            "—",
            "—",
            "—",
            "Target calculation failed.",
            "Wait for valid market structure."
        );

        return;
    }

    // --------------------------------------------------------
    // TP2 MUST BE AT LEAST 1:2
    // --------------------------------------------------------

    if (
        targets.rr2 <
        SNIPER_MIN_RR
    ) {

        invalidateSniperSetup(
            "TP2 does not provide minimum 1:2 RR."
        );

        showSniperWait(
            "WAIT — TP2 RR",
            direction,
            formatPrice(entry),
            formatPrice(stopLoss),
            formatPrice(targets.tp1),
            formatPrice(targets.tp2),
            formatPrice(targets.tp3),
            "TP2 RR: 1:" +
            targets.rr2.toFixed(2),
            "Required minimum: 1:2."
        );

        return;
    }

    // --------------------------------------------------------
    // CREATE / PRESERVE SETUP TIMESTAMP
    // --------------------------------------------------------

    const sameSetup =
        sniperSetup.active &&
        sniperSetup.direction ===
            direction;

    if (
        !sameSetup
    ) {

        sniperSetup.detectedAt =
            getSetupTimestamp();
    }

    sniperSetup.active =
        true;

    sniperSetup.direction =
        direction;

    sniperSetup.entry =
        entry;

    sniperSetup.stopLoss =
        stopLoss;

    sniperSetup.tp1 =
        targets.tp1;

    sniperSetup.tp2 =
        targets.tp2;

    sniperSetup.tp3 =
        targets.tp3;

    // --------------------------------------------------------
    // FINAL A+ SNIPER
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
        formatPrice(stopLoss)
    );

    setText(
        "tp1",
        formatPrice(targets.tp1)
    );

    setText(
        "tp2",
        formatPrice(targets.tp2)
    );

    setText(
        "tp3",
        formatPrice(targets.tp3)
    );

    setText(
        "riskReward",
        "1:" +
        targets.rr2.toFixed(2)
    );

    setText(
        "validity",
        "Until structure or confirmation changes"
    );

    setText(
        "trigger",
        direction === "BEARISH"
            ? "Bearish M5 momentum CONFIRMED"
            : "Bullish M5 momentum CONFIRMED"
    );

    setText(
        "sniperInvalidation",
        direction === "BEARISH"
            ? "Above structural SL " +
              formatPrice(stopLoss)
            : "Below structural SL " +
              formatPrice(stopLoss)
    );

    setText(
        "setupDetectedTime",
        sniperSetup.detectedAt
    );

    // Useful extra fields if your HTML contains them.
    setText(
        "sniperRiskPips",
        riskPips.toFixed(1) +
        " pips"
    );

    setText(
        "sniperScore",
        score + "/100"
    );
}

// ============================================================
// SNIPER WAIT DISPLAY
// ============================================================

function showSniperWait(
    status,
    direction,
    entry,
    stopLoss,
    tp1,
    tp2,
    tp3,
    validity,
    trigger
) {

    setText(
        "sniperStatus",
        status
    );

    setText(
        "direction",
        direction === "BEARISH"
            ? "SELL"
            : direction === "BULLISH"
                ? "BUY"
                : direction
    );

    setText(
        "entry",
        entry
    );

    setText(
        "stopLoss",
        stopLoss
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
        trigger
    );

    setText(
        "setupDetectedTime",
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
        direction === "BULLISH" &&
        rsi !== null &&
        rsi >= BULLISH_RSI_MIN &&
        rsi <= BULLISH_RSI_MAX
    ) {

        rsiAligned =
            true;
    }

    if (
        direction === "BEARISH" &&
        rsi !== null &&
        rsi >= BEARISH_RSI_MIN &&
        rsi <= BEARISH_RSI_MAX
    ) {

        rsiAligned =
            true;
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
            direction +
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
            "WAIT — M5 CONFIRMATION",
            "M5 structure is aligned, but the completed momentum candle is not confirmed.",
            "Wait for completed M5 momentum candle."
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
                marketData.support1 ||
                    Infinity,
                getLastM5Low() ||
                    Infinity
            ) -
            SCALP_SL_BUFFER;

    } else {

        sl =
            Math.max(
                marketData.resistance1 ||
                    -Infinity,
                getLastM5High() ||
                    -Infinity
            ) +
            SCALP_SL_BUFFER;
    }

    const risk =
        Math.abs(
            entry -
            sl
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
            tp2 -
            entry
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
        "A+ SCALP"
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
        "Until M5 structure changes"
    );

    setText(
        "scalpTrigger",
        direction === "BEARISH"
            ? "BEARISH BREAKDOWN CONFIRMED"
            : "BULLISH BREAKOUT CONFIRMED"
    );

    setText(
        "scalpInvalidation",
        direction === "BULLISH"
            ? "Below " +
              formatPrice(sl)
            : "Above " +
              formatPrice(sl)
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
            ". Wait for alignment."
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

function runEliteTradeGate() {

    const gate =
        calculateTradeGate();

    setText(
        "gateDecision",
        gate.decision
    );

    setText(
        "gateExplanation",
        gate.reason
    );

    setText(
        "session",
        getTradingSession()
    );

    if (
        gate.approved &&
        sniperSetup.active
    ) {

        setText(
            "gateDirection",
            sniperSetup.direction ===
                "BEARISH"
                ? "SELL"
                : "BUY"
        );

        setText(
            "gateEntry",
            formatPrice(
                sniperSetup.entry
            )
        );

        setText(
            "gateStopLoss",
            formatPrice(
                sniperSetup.stopLoss
            )
        );

        setText(
            "gateTP1",
            formatPrice(
                sniperSetup.tp1
            )
        );

        setText(
            "gateTP2",
            formatPrice(
                sniperSetup.tp2
            )
        );

        setText(
            "gateRR",
            "1:" +
            (
                Math.abs(
                    sniperSetup.tp2 -
                    sniperSetup.entry
                ) /
                Math.abs(
                    sniperSetup.entry -
                    sniperSetup.stopLoss
                )
            ).toFixed(2)
        );

        setText(
            "gateRisk",
            "NORMAL"
        );

    } else {

        setText(
            "gateDirection",
            "--"
        );

        setText(
            "gateEntry",
            "--"
        );

        setText(
            "gateStopLoss",
            "--"
        );

        setText(
            "gateTP1",
            "--"
        );

        setText(
            "gateTP2",
            "--"
        );

        setText(
            "gateRR",
            "--"
        );

        setText(
            "gateRisk",
            gate.newsUnknown
                ? "UNKNOWN"
                : "NORMAL"
        );
    }
}

// ============================================================
// TRADE GATE CALCULATION
// ============================================================

function calculateTradeGate() {

    if (
        !marketData.price
    ) {

        return {

            approved: false,

            decision: "STAY AWAY",

            reason:
                "Market data unavailable.",

            newsUnknown: true
        };
    }

    if (
        !marketData.news.clear
    ) {

        return {

            approved: false,

            decision: "STAY AWAY",

            reason:
                marketData.news.risk ===
                "UNKNOWN"
                    ? "News cannot be verified."
                    : "High-impact EUR/USD news risk.",

            newsUnknown:
                marketData.news.risk ===
                "UNKNOWN"
        };
    }

    if (
        marketData.h4.trend ===
        "RANGE" ||
        marketData.h1.trend ===
        "RANGE"
    ) {

        return {

            approved: false,

            decision: "STAY AWAY",

            reason:
                "Higher-timeframe structure is not directional.",

            newsUnknown: false
        };
    }

    if (
        marketData.h4.trend !==
        marketData.h1.trend
    ) {

        return {

            approved: false,

            decision: "STAY AWAY",

            reason:
                "H4 and H1 are not aligned.",

            newsUnknown: false
        };
    }

    if (
        marketData.m15.structure !==
        marketData.h4.trend
    ) {

        return {

            approved: false,

            decision: "STAY AWAY",

            reason:
                "M15 confirmation is missing.",

            newsUnknown: false
        };
    }

    if (
        marketData.m5.structure !==
        marketData.h4.trend
    ) {

        return {

            approved: false,

            decision: "STAY AWAY",

            reason:
                "M5 structure is not aligned.",

            newsUnknown: false
        };
    }

    if (
        marketData.emaStructure !==
        marketData.h4.trend
    ) {

        return {

            approved: false,

            decision: "STAY AWAY",

            reason:
                "M5 EMA20/EMA50 alignment is missing.",

            newsUnknown: false
        };
    }

    // --------------------------------------------------------
    // CRITICAL EXECUTION CONDITION
    // --------------------------------------------------------

    const momentum =
        getM5MomentumTrigger(
            marketData.h4.trend
        );

    if (!momentum) {

        return {

            approved: false,

            decision: "STAY AWAY",

            reason:
                marketData.h4.trend ===
                "BEARISH"
                    ? "SELL setup needs bearish M5 confirmation."
                    : "BUY setup needs bullish M5 confirmation.",

            newsUnknown: false
        };
    }

    if (
        !sniperSetup.active
    ) {

        return {

            approved: false,

            decision: "STAY AWAY",

            reason:
                "Complete Sniper setup has not been calculated.",

            newsUnknown: false
        };
    }

    return {

        approved: true,

        decision:
            "A+ TRADE READY",

        reason:
            "All primary filters are aligned. M5 confirmation is confirmed.",

        newsUnknown: false
    };
}

// ============================================================
// TRADING SESSION
// ============================================================

function getTradingSession() {

    const now =
        new Date();

    const hour =
        Number(
            now.toLocaleString(
                "en-US",
                {
                    timeZone:
                        "Asia/Kolkata",
                    hour:
                        "2-digit",
                    hour12:
                        false
                }
            )
        );

    // Approximate FX session windows in IST.
    // These are informational, not a guarantee of liquidity.
    if (
        hour >= 13 &&
        hour < 18
    ) {

        return "LONDON";
    }

    if (
        hour >= 18 &&
        hour < 23
    ) {

        return "LONDON / NEW YORK";
    }

    if (
        hour >= 23 ||
        hour < 2
    ) {

        return "NEW YORK";
    }

    return "ASIA / LOW-LIQUIDITY";
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
