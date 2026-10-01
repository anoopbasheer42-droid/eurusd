// ============================================================
// EUR/USD SNIPER DASHBOARD
// INSTITUTIONAL MARKET STRUCTURE + SNIPER + ELITE SCALP
// ============================================================

// IMPORTANT:
// ROTATE YOUR EXPOSED TWELVE DATA API KEY.
// Put your NEW key below.
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

const SNIPER_MIN_RISK_PIPS = 3;

const SNIPER_MAX_RISK_PIPS = 15;

// Minimum structural room required beyond entry.
// Prevents TP from sitting immediately beside entry.
const SNIPER_MIN_TP1_PIPS = 8;

const SNIPER_TP1_RR = 1.5;
const SNIPER_TP2_RR = 2.0;
const SNIPER_TP3_RR = 3.0;

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
    },

    // ========================================================
    // SETUP TRACKING
    // ========================================================

    sniperSetup: {
        active: false,
        direction: null,
        detectedAt: null,
        detectionKey: null
    },

    scalpSetup: {
        active: false,
        direction: null,
        detectedAt: null,
        detectionKey: null
    }
};

// ============================================================
// PAGE LOAD
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadMarketData();

        setInterval(
            loadMarketData,
            120000
        );

        // Default chart
        changeChart("15min");
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
        "&symbol=FX%3AEURUSD" +
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
        // STRUCTURE
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
        // UPDATE
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

        setText(
            "priceError",
            error.message
        );

        // Clear setup states
        marketData.sniperSetup.active =
            false;

        marketData.scalpSetup.active =
            false;

        runEliteTradeGate();
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
            "Candle request HTTP " +
            response.status +
            " — " +
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

    if (!value) {
        return null;
    }

    if (
        typeof value === "number" ||
        /^\d+$/.test(
            String(value)
        )
    ) {

        const n =
            Number(value);

        if (
            String(value).length <= 10
        ) {

            return n * 1000;
        }

        return n;
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

    const highs =
        recent.map(
            c => c.high
        );

    const lows =
        recent.map(
            c => c.low
        );

    return {

        resistance1:
            resistances[0] ||
            Math.max(...highs),

        resistance2:
            resistances[1] ||
            null,

        support1:
            supports[0] ||
            Math.min(...lows),

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
        price >
            ema20 &&
        ema20 >
            ema50
    ) {

        return "BULLISH";
    }

    if (
        price <
            ema20 &&
        ema20 <
            ema50
    ) {

        return "BEARISH";
    }

    return "NEUTRAL";
}

// ============================================================
// COMPLETED M5 MOMENTUM
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
// LAST COMPLETED M5 CANDLE
// ============================================================

function getLastCompletedM5() {

    const candles =
        marketData.m5.candles;

    const completed =
        candles.slice(0, -1);

    if (
        !completed.length
    ) {

        return null;
    }

    return completed[
        completed.length - 1
    ];
}

// ============================================================
// STRUCTURAL SWING LOW
// ============================================================

function getStructuralSwingLow() {

    const candles =
        marketData.m5.candles;

    const completed =
        candles.slice(0, -1);

    if (
        completed.length < 5
    ) {

        return null;
    }

    const recent =
        completed.slice(-10);

    return Math.min(
        ...recent.map(
            c => c.low
        )
    );
}

// ============================================================
// STRUCTURAL SWING HIGH
// ============================================================

function getStructuralSwingHigh() {

    const candles =
        marketData.m5.candles;

    const completed =
        candles.slice(0, -1);

    if (
        completed.length < 5
    ) {

        return null;
    }

    const recent =
        completed.slice(-10);

    return Math.max(
        ...recent.map(
            c => c.high
        )
    );
}

// ============================================================
// SETUP DETECTION TIME
// ============================================================

function recordSetupDetection(
    type,
    direction,
    candle
) {

    if (!candle) {
        return;
    }

    const detectionKey =
        type +
        "|" +
        direction +
        "|" +
        candle.datetime;

    const setup =
        type === "SNIPER"
            ? marketData.sniperSetup
            : marketData.scalpSetup;

    // Do not reset timestamp on every refresh.
    if (
        setup.active &&
        setup.detectionKey ===
            detectionKey
    ) {

        return;
    }

    setup.active =
        true;

    setup.direction =
        direction;

    setup.detectionKey =
        detectionKey;

    setup.detectedAt =
        new Date(
            candle.datetime
        ).toLocaleString(
            "en-IN",
            {
                timeZone:
                    "Asia/Kolkata",
                hour12: true
            }
        );
}

// ============================================================
// CLEAR SETUP DETECTION
// ============================================================

function clearSetupDetection(
    type
) {

    const setup =
        type === "SNIPER"
            ? marketData.sniperSetup
            : marketData.scalpSetup;

    setup.active =
        false;

    setup.direction =
        null;

    setup.detectedAt =
        null;

    setup.detectionKey =
        null;
}

// ============================================================
// DISPLAY SETUP TIME
// ============================================================

function displaySetupTime(
    type
) {

    const setup =
        type === "SNIPER"
            ? marketData.sniperSetup
            : marketData.scalpSetup;

    const ids =
        type === "SNIPER"
            ? [
                "sniperSetupTime",
                "setupDetectionTime"
            ]
            : [
                "scalpSetupTime"
            ];

    ids.forEach(
        id => {

            if (
                setup.active &&
                setup.detectedAt
            ) {

                setText(
                    id,
                    setup.detectedAt +
                    " IST"
                );

            } else {

                setText(
                    id,
                    "Not detected"
                );
            }
        }
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

    if (
        rsiConfirmed
    ) {

        score += 5;
    }

    // ========================================================
    // M5 CONFIRMATION
    // ========================================================

    const momentum =
        direction
            ? getM5MomentumTrigger(
                direction
            )
            : false;

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

        clearSetupDetection(
            "SNIPER"
        );

        showSniperWait(
            "WAIT — NEWS FILTER",
            "—",
            "Wait for news filter.",
            "News risk."
        );

        displaySetupTime(
            "SNIPER"
        );

        return;
    }

    // ========================================================
    // H4/H1 MUST ALIGN
    // ========================================================

    if (
        h4 === "RANGE" ||
        h1 === "RANGE"
    ) {

        clearSetupDetection(
            "SNIPER"
        );

        showSniperWait(
            "WAIT — HIGHER TIMEFRAME RANGE",
            "—",
            "Wait for H4/H1 directional structure.",
            "H4/H1 range."
        );

        displaySetupTime(
            "SNIPER"
        );

        return;
    }

    if (
        h4 !== h1
    ) {

        clearSetupDetection(
            "SNIPER"
        );

        showSniperWait(
            "WAIT — H4/H1 CONFLICT",
            "—",
            "Wait for H4/H1 alignment.",
            "Higher timeframe conflict."
        );

        displaySetupTime(
            "SNIPER"
        );

        return;
    }

    direction =
        h4;

    // ========================================================
    // A+ REQUIREMENTS
    // ========================================================

    if (
        m15 !== direction ||
        m5 !== direction ||
        ema !== direction ||
        !rsiConfirmed ||
        !momentum
    ) {

        clearSetupDetection(
            "SNIPER"
        );

        showSniperWait(
            "WAIT — M5 CONFIRMATION",
            direction,
            "Required: completed M5 momentum confirmation.",
            "Setup is not confirmed."
        );

        displaySetupTime(
            "SNIPER"
        );

        return;
    }

    // ========================================================
    // SCORE GATE
    // ========================================================

    if (
        score < SNIPER_MIN_SCORE
    ) {

        clearSetupDetection(
            "SNIPER"
        );

        showSniperWait(
            "WAIT — SCORE BELOW A+",
            direction,
            "Minimum score: " +
                SNIPER_MIN_SCORE +
                "/100.",
            "Score below A+."
        );

        displaySetupTime(
            "SNIPER"
        );

        return;
    }

    // ========================================================
    // RECORD EXACT M5 CANDLE THAT CREATED SETUP
    // ========================================================

    const triggerCandle =
        getLastCompletedM5();

    recordSetupDetection(
        "SNIPER",
        direction,
        triggerCandle
    );

    displaySetupTime(
        "SNIPER"
    );

    // ========================================================
    // ENTRY
    // ========================================================

    const entry =
        marketData.price;

    // ========================================================
    // STRUCTURAL STOP
    // ========================================================

    let sl;

    if (
        direction === "BEARISH"
    ) {

        const swingHigh =
            getStructuralSwingHigh();

        sl =
            Math.max(
                swingHigh || 0,
                marketData.resistance1 || 0
            ) +
            SNIPER_SL_BUFFER;

    } else {

        const swingLow =
            getStructuralSwingLow();

        sl =
            Math.min(
                swingLow ||
                    Number.MAX_SAFE_INTEGER,
                marketData.support1 ||
                    Number.MAX_SAFE_INTEGER
            ) -
            SNIPER_SL_BUFFER;
    }

    if (
        !Number.isFinite(
            entry
        ) ||
        !Number.isFinite(
            sl
        )
    ) {

        clearSetupDetection(
            "SNIPER"
        );

        showSniperWait(
            "WAIT — INVALID STRUCTURE",
            direction,
            "Fresh structural levels required.",
            "Invalid structural levels."
        );

        displaySetupTime(
            "SNIPER"
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
    // RISK FILTER
    // ========================================================

    if (
        riskPips <
            SNIPER_MIN_RISK_PIPS ||
        riskPips >
            SNIPER_MAX_RISK_PIPS
    ) {

        clearSetupDetection(
            "SNIPER"
        );

        showSniperWait(
            "WAIT — STRUCTURAL RISK",
            direction,
            "Risk: " +
                riskPips.toFixed(1) +
                " pips. Required: " +
                SNIPER_MIN_RISK_PIPS +
                "–" +
                SNIPER_MAX_RISK_PIPS +
                " pips.",
            "Risk outside sniper range."
        );

        displaySetupTime(
            "SNIPER"
        );

        return;
    }

    // ========================================================
    // STRUCTURAL TARGETS
    // ========================================================

    const targets =
        calculateSniperTargets(
            direction,
            entry,
            risk
        );

    if (
        !targets.valid
    ) {

        clearSetupDetection(
            "SNIPER"
        );

        showSniperWait(
            "WAIT — INSUFFICIENT TARGET ROOM",
            direction,
            targets.reason,
            "Do not chase price. Wait for better structure."
        );

        displaySetupTime(
            "SNIPER"
        );

        return;
    }

    const tp1 =
        targets.tp1;

    const tp2 =
        targets.tp2;

    const tp3 =
        targets.tp3;

    const rr =
        Math.abs(
            tp2 - entry
        ) /
        risk;

    if (
        rr < SNIPER_MIN_RR
    ) {

        clearSetupDetection(
            "SNIPER"
        );

        showSniperWait(
            "WAIT — TP2 BELOW 2R",
            direction,
            "Available structural target does not provide minimum 1:2.",
            "Need at least 1:2 with clear structural room."
        );

        displaySetupTime(
            "SNIPER"
        );

        return;
    }

    // ========================================================
    // FINAL SNIPER APPROVAL
    // ========================================================

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
            tp1
        )
    );

    setText(
        "tp2",
        formatPrice(
            tp2
        )
    );

    setText(
        "tp3",
        formatPrice(
            tp3
        )
    );

    setText(
        "riskReward",
        "1:" +
            rr.toFixed(2)
    );

    setText(
        "validity",
        "Until structure changes"
    );

    setText(
        "trigger",
        "Completed M5 " +
            (
                direction ===
                "BEARISH"
                    ? "bearish"
                    : "bullish"
            ) +
            " momentum confirmation"
    );

    setText(
        "invalidation",
        direction === "BEARISH"
            ? formatPrice(sl) +
                " — bearish structure invalidated."
            : formatPrice(sl) +
                " — bullish structure invalidated."
    );

    displaySetupTime(
        "SNIPER"
    );
}

// ============================================================
// SNIPER TARGET CALCULATION
// ============================================================

function calculateSniperTargets(
    direction,
    entry,
    risk
) {

    const minTp1Distance =
        SNIPER_MIN_TP1_PIPS *
        0.0001;

    const rrTp1 =
        risk *
        SNIPER_TP1_RR;

    const rrTp2 =
        risk *
        SNIPER_TP2_RR;

    const rrTp3 =
        risk *
        SNIPER_TP3_RR;

    let tp1;
    let tp2;
    let tp3;

    if (
        direction ===
        "BEARISH"
    ) {

        // ----------------------------------------------------
        // For SELL:
        // TP1 cannot be immediately below entry.
        // ----------------------------------------------------

        const structuralS1 =
            marketData.support1;

        const structuralS2 =
            marketData.support2;

        const candidateTp1 =
            entry -
            Math.max(
                rrTp1,
                minTp1Distance
            );

        if (
            structuralS1 &&
            structuralS1 < entry
        ) {

            // If S1 is too close,
            // do NOT use it as TP1.
            tp1 =
                candidateTp1;

        } else {

            tp1 =
                candidateTp1;
        }

        // ----------------------------------------------------
        // TP2 must be at least 2R.
        // Prefer S2 if it is beyond 2R.
        // ----------------------------------------------------

        const minimumTp2 =
            entry -
            rrTp2;

        if (
            structuralS2 &&
            structuralS2 <
                minimumTp2
        ) {

            tp2 =
                structuralS2;

        } else {

            tp2 =
                minimumTp2;
        }

        // ----------------------------------------------------
        // TP3 = 3R or deeper structural support.
        // ----------------------------------------------------

        const minimumTp3 =
            entry -
            rrTp3;

        if (
            structuralS2 &&
            structuralS2 <
                minimumTp3
        ) {

            tp3 =
                structuralS2;

        } else {

            tp3 =
                minimumTp3;
        }

        // ----------------------------------------------------
        // Ensure correct ordering
        // ----------------------------------------------------

        if (
            tp1 >= entry ||
            tp2 >= tp1 ||
            tp3 >= tp2
        ) {

            return {

                valid: false,

                reason:
                    "Bearish targets do not have sufficient downside room."
            };
        }

    } else {

        // ====================================================
        // BUY
        // ====================================================

        const structuralR1 =
            marketData.resistance1;

        const structuralR2 =
            marketData.resistance2;

        const candidateTp1 =
            entry +
            Math.max(
                rrTp1,
                minTp1Distance
            );

        if (
            structuralR1 &&
            structuralR1 > entry
        ) {

            tp1 =
                candidateTp1;

        } else {

            tp1 =
                candidateTp1;
        }

        const minimumTp2 =
            entry +
            rrTp2;

        if (
            structuralR2 &&
            structuralR2 >
                minimumTp2
        ) {

            tp2 =
                structuralR2;

        } else {

            tp2 =
                minimumTp2;
        }

        const minimumTp3 =
            entry +
            rrTp3;

        if (
            structuralR2 &&
            structuralR2 >
                minimumTp3
        ) {

            tp3 =
                structuralR2;

        } else {

            tp3 =
                minimumTp3;
        }

        if (
            tp1 <= entry ||
            tp2 <= tp1 ||
            tp3 <= tp2
        ) {

            return {

                valid: false,

                reason:
                    "Bullish targets do not have sufficient upside room."
            };
        }
    }

    // ========================================================
    // FINAL MINIMUM TP1 DISTANCE
    // ========================================================

    if (
        Math.abs(
            tp1 - entry
        ) <
        minTp1Distance
    ) {

        return {

            valid: false,

            reason:
                "TP1 is too close to entry. Waiting for better structure."
        };
    }

    return {

        valid: true,

        tp1,
        tp2,
        tp3
    };
}

// ============================================================
// SNIPER WAIT DISPLAY
// ============================================================

function showSniperWait(
    status,
    direction,
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
        "Setup not confirmed."
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

        clearSetupDetection(
            "SCALP"
        );

        showScalpWait(
            "WAIT — NEWS FILTER",
            "News filter is not clear.",
            "Required: high-impact news clear."
        );

        displaySetupTime(
            "SCALP"
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

        clearSetupDetection(
            "SCALP"
        );

        showScalpWait(
            "WAIT — H1 RANGE",
            "H1 structure is not directional.",
            "Required: H1 bullish or bearish."
        );

        displaySetupTime(
            "SCALP"
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

    if (
        rsiAligned
    ) {

        score += 15;
    }

    const momentum =
        getM5MomentumTrigger(
            direction
        );

    if (
        momentum
    ) {

        score += 20;
    }

    setText(
        "scalpScore",
        score + "/100"
    );

    // ========================================================
    // HARD SCALP GATES
    // ========================================================

    if (
        m15 !== direction ||
        m5 !== direction
    ) {

        clearSetupDetection(
            "SCALP"
        );

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

        displaySetupTime(
            "SCALP"
        );

        return;
    }

    if (
        ema !== direction
    ) {

        clearSetupDetection(
            "SCALP"
        );

        showScalpWait(
            "WAIT — EMA NOT ALIGNED",
            "M5 EMA structure does not confirm.",
            "Required: M5 EMA20/EMA50 alignment."
        );

        displaySetupTime(
            "SCALP"
        );

        return;
    }

    if (
        !rsiAligned
    ) {

        clearSetupDetection(
            "SCALP"
        );

        showScalpWait(
            "WAIT — RSI NOT CONFIRMED",
            "M5 RSI: " +
                formatNumber(rsi),
            direction === "BULLISH"
                ? "Required RSI: 52–68."
                : "Required RSI: 32–48."
        );

        displaySetupTime(
            "SCALP"
        );

        return;
    }

    if (
        !momentum
    ) {

        clearSetupDetection(
            "SCALP"
        );

        showScalpWait(
            "WAIT — M5 MOMENTUM",
            "Completed M5 momentum candle not confirmed.",
            "Required: completed M5 momentum trigger."
        );

        displaySetupTime(
            "SCALP"
        );

        return;
    }

    if (
        score < SCALP_MIN_SCORE
    ) {

        clearSetupDetection(
            "SCALP"
        );

        showScalpWait(
            "WAIT — SCORE BELOW A+",
            "Score: " +
                score +
                "/100.",
            "Required: " +
                SCALP_MIN_SCORE +
                "/100."
        );

        displaySetupTime(
            "SCALP"
        );

        return;
    }

    // ========================================================
    // RECORD SCALP DETECTION
    // ========================================================

    recordSetupDetection(
        "SCALP",
        direction,
        getLastCompletedM5()
    );

    displaySetupTime(
        "SCALP"
    );

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
            "Entry/EMA unavailable.",
            "Wait for fresh market data."
        );

        return;
    }

    // ========================================================
    // EXTENSION PROTECTION
    // ========================================================

    if (
        Math.abs(
            entry - ema20
        ) >
        SCALP_MAX_EMA_DISTANCE
    ) {

        showScalpWait(
            "WAIT — PRICE EXTENDED",
            "Price is too far from M5 EMA20.",
            "Wait for controlled pullback."
        );

        return;
    }

    // ========================================================
    // STRUCTURAL SL
    // ========================================================

    let sl;

    if (
        direction === "BULLISH"
    ) {

        sl =
            Math.min(
                getStructuralSwingLow() ||
                    entry,
                marketData.support1 ||
                    entry
            ) -
            SCALP_SL_BUFFER;

    } else {

        sl =
            Math.max(
                getStructuralSwingHigh() ||
                    entry,
                marketData.resistance1 ||
                    entry
            ) +
            SCALP_SL_BUFFER;
    }

    const risk =
        Math.abs(
            entry - sl
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
            "Risk: " +
                riskPips.toFixed(1) +
                " pips.",
            "Required: 3–15 pips."
        );

        return;
    }

    // ========================================================
    // SCALP TARGETS
    // ========================================================

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
            "WAIT — RR BELOW 1:2",
            "RR: 1:" +
                rr.toFixed(2),
            "Required minimum: 1:2."
        );

        return;
    }

    // ========================================================
    // APPROVED SCALP
    // ========================================================

    setText(
        "scalpVerdict",
        "A+ SCALP"
    );

    setText(
        "scalpDirection",
        direction === "BEARISH"
            ? "SELL"
            : "BUY"
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
            ? "BEARISH M5 BREAKDOWN"
            : "BULLISH M5 BREAKOUT"
    );

    setText(
        "scalpInvalidation",
        formatPrice(sl)
    );

    displaySetupTime(
        "SCALP"
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

function runEliteTradeGate() {

    const gate =
        document.getElementById(
            "eliteTradeGate"
        );

    if (!gate) {
        return;
    }

    // ========================================================
    // DATA CHECK
    // ========================================================

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
            "gateDecision",
            "NO TRADE"
        );

        return;
    }

    // ========================================================
    // NEWS
    // ========================================================

    if (
        !marketData.news.clear
    ) {

        setText(
            "gateVerdict",
            "STAY AWAY"
        );

        setText(
            "gateExplanation",
            "News filter is not clear."
        );

        setText(
            "gateDecision",
            "NO TRADE — NEWS RISK"
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

    const direction =
        h4 === "BULLISH" ||
        h4 === "BEARISH"
            ? h4
            : null;

    // ========================================================
    // TIMEFRAME ALIGNMENT
    // ========================================================

    if (
        !direction ||
        h1 !== direction ||
        m15 !== direction ||
        m5 !== direction ||
        ema !== direction
    ) {

        setText(
            "gateVerdict",
            "STAY AWAY"
        );

        setText(
            "gateExplanation",
            "Higher and lower timeframe alignment is incomplete."
        );

        setText(
            "gateDecision",
            "NO TRADE — ALIGNMENT REQUIRED"
        );

        return;
    }

    // ========================================================
    // M5 MOMENTUM
    // ========================================================

    const momentum =
        getM5MomentumTrigger(
            direction
        );

    if (!momentum) {

        setText(
            "gateVerdict",
            "STAY AWAY"
        );

        setText(
            "gateExplanation",
            direction === "BEARISH"
                ? "SELL setup needs completed bearish M5 confirmation."
                : "BUY setup needs completed bullish M5 confirmation."
        );

        setText(
            "gateDecision",
            "NO TRADE — WAIT FOR M5 CONFIRMATION"
        );

        return;
    }

    // ========================================================
    // A+ READY
    // ========================================================

    setText(
        "gateVerdict",
        "A+ TRADE READY"
    );

    setText(
        "gateExplanation",
        "All primary filters are aligned. M5 confirmation is complete."
    );

    setText(
        "gateDecision",
        direction === "BEARISH"
            ? "SELL BIAS — EXECUTION CONDITIONS MET"
            : "BUY BIAS — EXECUTION CONDITIONS MET"
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

    // ========================================================
    // NEWS DISPLAY
    // ========================================================

    const news =
        marketData.news;

    if (
        news.clear
    ) {

        setText(
            "eurNews",
            "No high-impact EUR event detected"
        );

        setText(
            "usdNews",
            "No high-impact USD event detected"
        );

        setText(
            "newsFilter",
            "CLEAR"
        );

        setText(
            "nextEvent",
            "No upcoming high-impact event found"
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
            "HIGH-IMPACT EVENT DETECTED"
        );

        setText(
            "usdNews",
            "HIGH-IMPACT EVENT DETECTED"
        );

        setText(
            "newsFilter",
            "RISK"
        );

        setText(
            "nextEvent",
            "High-impact EUR/USD event inside the next 2 hours."
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
        document.getElementById(
            id
        );

    if (element) {

        element.textContent =
            value;
    }
}
