// ============================================================
// EUR/USD SNIPER DASHBOARD
// LIVE MARKET DATA + SNIPER + ELITE SCALPING
// ============================================================

// IMPORTANT:
// Use your own Twelve Data API key.
// Do NOT expose a production API key publicly.
const API_KEY = "8908432b6c784bc49aad6ccf64845991";

const SYMBOL = "EUR/USD";

const PRICE_URL =
    "https://api.twelvedata.com/price";

const TIME_SERIES_URL =
    "https://api.twelvedata.com/time_series";

const NEWS_URL =
    "https://xoomar.com/api/markets/calendar?importance=high";

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
// SNIPER SETTINGS
// ============================================================

const SNIPER_MIN_SCORE = 75;

const SNIPER_MIN_RISK_PIPS = 3;
const SNIPER_MAX_RISK_PIPS = 15;

const SNIPER_SL_BUFFER = 0.00010;

// Minimum target multiples
const SNIPER_TP1_R = 1.0;
const SNIPER_TP2_R = 2.0;
const SNIPER_TP3_R = 3.0;

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
    // LOCKED SNIPER SETUP
    // ========================================================

    sniperSetup: {

        active: false,

        detectedTime: null,

        detectedPrice: null,

        direction: null,

        stopLoss: null,

        tp1: null,
        tp2: null,
        tp3: null,

        riskPips: null,

        score: null
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
        // UI
        // ====================================================

        updateDashboard();

        // ====================================================
        // ENGINES
        // ====================================================

        runSniperEngine();

        runEliteScalpingEngine();

        runProAnalysis();

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
        typeof value ===
        "number" ||
        /^\d+$/.test(
            String(value)
        )
    ) {

        const numberValue =
            Number(value);

        if (
            String(value).length <=
            10
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

    return Number.isNaN(
        parsed
    )
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
        i <
        recent.length - 2;
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
                ? Math.abs(
                    change
                )
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
// GET STRUCTURAL STOP
// ============================================================

function calculateSniperSL(
    direction
) {

    const m5 =
        marketData.m5.candles;

    const m15 =
        marketData.m15.candles;

    const completedM5 =
        m5.slice(0, -1);

    const completedM15 =
        m15.slice(0, -1);

    if (
        !completedM5.length ||
        !completedM15.length
    ) {

        return null;
    }

    // Use recent structural swing,
    // not an arbitrary fixed distance.

    const recentM5 =
        completedM5.slice(-6);

    const recentM15 =
        completedM15.slice(-8);

    if (
        direction ===
        "BEARISH"
    ) {

        const swingHigh =
            Math.max(
                ...recentM5.map(
                    c => c.high
                ),
                ...recentM15.map(
                    c => c.high
                )
            );

        return (
            swingHigh +
            SNIPER_SL_BUFFER
        );
    }

    if (
        direction ===
        "BULLISH"
    ) {

        const swingLow =
            Math.min(
                ...recentM5.map(
                    c => c.low
                ),
                ...recentM15.map(
                    c => c.low
                )
            );

        return (
            swingLow -
            SNIPER_SL_BUFFER
        );
    }

    return null;
}

// ============================================================
// CALCULATE SNIPER TARGETS
// ============================================================

function calculateSniperTargets(
    direction,
    entry,
    sl
) {

    if (
        !Number.isFinite(
            entry
        ) ||
        !Number.isFinite(
            sl
        )
    ) {

        return null;
    }

    const risk =
        Math.abs(
            entry - sl
        );

    if (
        risk <= 0
    ) {

        return null;
    }

    // ========================================================
    // BASIC R LEVELS
    // ========================================================

    const r1 =
        direction ===
        "BEARISH"

            ? entry -
              risk *
              SNIPER_TP1_R

            : entry +
              risk *
              SNIPER_TP1_R;

    const r2 =
        direction ===
        "BEARISH"

            ? entry -
              risk *
              SNIPER_TP2_R

            : entry +
              risk *
              SNIPER_TP2_R;

    const r3 =
        direction ===
        "BEARISH"

            ? entry -
              risk *
              SNIPER_TP3_R

            : entry +
              risk *
              SNIPER_TP3_R;

    // ========================================================
    // STRUCTURAL TARGETS
    // ========================================================

    let tp1;
    let tp2;
    let tp3;

    if (
        direction ===
        "BEARISH"
    ) {

        const supports = [
            marketData.support1,
            marketData.support2
        ]
            .filter(
                x =>
                    Number.isFinite(
                        x
                    ) &&
                    x < entry
            )
            .sort(
                (a, b) =>
                    b - a
            );

        // TP1: nearest meaningful
        // support that gives at least 1R.
        const structuralTP1 =
            supports.find(
                x =>
                    x <= r1
            );

        tp1 =
            structuralTP1 !==
            undefined
                ? structuralTP1
                : r1;

        // TP2 must ALWAYS be
        // farther than TP1.
        const structuralTP2 =
            supports.find(
                x =>
                    x < tp1 &&
                    Math.abs(
                        entry - x
                    ) >=
                    risk * 2
            );

        tp2 =
            structuralTP2 !==
            undefined
                ? structuralTP2
                : r2;

        // TP3 must ALWAYS be
        // farther than TP2.
        const structuralTP3 =
            supports.find(
                x =>
                    x < tp2 &&
                    Math.abs(
                        entry - x
                    ) >=
                    risk * 3
            );

        tp3 =
            structuralTP3 !==
            undefined
                ? structuralTP3
                : r3;

        // Final safety ordering
        tp1 =
            Math.min(
                tp1,
                r1
            );

        tp2 =
            Math.min(
                tp2,
                tp1 -
                risk * 0.10
            );

        tp3 =
            Math.min(
                tp3,
                tp2 -
                risk * 0.10
            );

    } else {

        const resistances = [
            marketData.resistance1,
            marketData.resistance2
        ]
            .filter(
                x =>
                    Number.isFinite(
                        x
                    ) &&
                    x > entry
            )
            .sort(
                (a, b) =>
                    a - b
            );

        const structuralTP1 =
            resistances.find(
                x =>
                    x >= r1
            );

        tp1 =
            structuralTP1 !==
            undefined
                ? structuralTP1
                : r1;

        const structuralTP2 =
            resistances.find(
                x =>
                    x > tp1 &&
                    Math.abs(
                        x - entry
                    ) >=
                    risk * 2
            );

        tp2 =
            structuralTP2 !==
            undefined
                ? structuralTP2
                : r2;

        const structuralTP3 =
            resistances.find(
                x =>
                    x > tp2 &&
                    Math.abs(
                        x - entry
                    ) >=
                    risk * 3
            );

        tp3 =
            structuralTP3 !==
            undefined
                ? structuralTP3
                : r3;

        // Final safety ordering
        tp1 =
            Math.max(
                tp1,
                r1
            );

        tp2 =
            Math.max(
                tp2,
                tp1 +
                risk * 0.10
            );

        tp3 =
            Math.max(
                tp3,
                tp2 +
                risk * 0.10
            );
    }

    return {

        tp1,
        tp2,
        tp3,

        risk,

        rr1:
            Math.abs(
                tp1 - entry
            ) /
            risk,

        rr2:
            Math.abs(
                tp2 - entry
            ) /
            risk,

        rr3:
            Math.abs(
                tp3 - entry
            ) /
            risk
    };
}

// ============================================================
// SETUP TIME
// ============================================================

function getSetupTimeIST() {

    const now =
        new Date();

    return now.toLocaleString(
        "en-IN",
        {
            timeZone:
                "Asia/Kolkata",

            year:
                "numeric",

            month:
                "2-digit",

            day:
                "2-digit",

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
// LOCK SNIPER SETUP
// ============================================================

function lockSniperSetup(
    direction,
    entry,
    sl,
    targets,
    score
) {

    if (
        marketData.sniperSetup.active
    ) {

        return;
    }

    marketData.sniperSetup = {

        active: true,

        detectedTime:
            getSetupTimeIST(),

        detectedPrice:
            entry,

        direction:
            direction,

        stopLoss:
            sl,

        tp1:
            targets.tp1,

        tp2:
            targets.tp2,

        tp3:
            targets.tp3,

        riskPips:
            targets.risk /
            0.0001,

        score:
            score
    };
}

// ============================================================
// INVALIDATE SNIPER SETUP
// ============================================================

function invalidateSniperSetup() {

    marketData.sniperSetup = {

        active: false,

        detectedTime: null,

        detectedPrice: null,

        direction: null,

        stopLoss: null,

        tp1: null,
        tp2: null,
        tp3: null,

        riskPips: null,

        score: null
    };

    setText(
        "setupTime",
        "—"
    );
}

// ============================================================
// DISPLAY LOCKED SETUP
// ============================================================

function displayLockedSniperSetup() {

    const setup =
        marketData.sniperSetup;

    if (
        !setup.active
    ) {

        return;
    }

    setText(
        "setupTime",
        setup.detectedTime
    );

    setText(
        "entry",
        formatPrice(
            setup.detectedPrice
        )
    );

    setText(
        "stopLoss",
        formatPrice(
            setup.stopLoss
        )
    );

    setText(
        "tp1",
        formatPrice(
            setup.tp1
        )
    );

    setText(
        "tp2",
        formatPrice(
            setup.tp2
        )
    );

    setText(
        "tp3",
        formatPrice(
            setup.tp3
        )
    );

    setText(
        "riskReward",
        "1:" +
        setup.rr2
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
        direction ===
        "BULLISH" &&
        rsi15 !== null &&
        rsi5 !== null &&
        rsi15 > 50 &&
        rsi5 > 50
    ) {

        rsiConfirmed =
            true;
    }

    if (
        direction ===
        "BEARISH" &&
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
            "News filter not clear.",
            "Wait for news confirmation.",
            "News risk."
        );

        return;
    }

    // ========================================================
    // HIGHER TIMEFRAME GATE
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
            "H4/H1 requires directional structure.",
            "Wait for H4/H1 direction.",
            "Higher timeframe range."
        );

        return;
    }

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
            "H4/H1 conflict.",
            "Wait for alignment.",
            "Higher timeframe conflict."
        );

        return;
    }

    direction = h4;

    // ========================================================
    // MINIMUM A+ SCORE
    // ========================================================

    if (
        score <
        SNIPER_MIN_SCORE
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
            "Score " +
            score +
            "/100.",
            "Wait for additional confirmation.",
            "Score below minimum."
        );

        return;
    }

    // ========================================================
    // ENTRY
    // ========================================================

    const entry =
        marketData.price;

    if (
        !Number.isFinite(
            entry
        )
    ) {

        invalidateSniperSetup();

        return;
    }

    // ========================================================
    // STRUCTURAL SL
    // ========================================================

    const sl =
        calculateSniperSL(
            direction
        );

    if (
        !Number.isFinite(sl)
    ) {

        invalidateSniperSetup();

        showSniperWait(
            "WAIT — STRUCTURAL SL",
            direction,
            "—",
            "—",
            "—",
            "—",
            "—",
            "Structural stop unavailable.",
            "Wait for valid M5/M15 structure.",
            "No valid structural stop."
        );

        return;
    }

    // ========================================================
    // RISK
    // ========================================================

    const riskPips =
        Math.abs(
            entry - sl
        ) /
        0.0001;

    if (
        riskPips <
        SNIPER_MIN_RISK_PIPS ||
        riskPips >
        SNIPER_MAX_RISK_PIPS
    ) {

        invalidateSniperSetup();

        showSniperWait(
            "WAIT — STRUCTURAL RISK",
            direction,
            formatPrice(entry),
            formatPrice(sl),
            "—",
            "—",
            "—",
            "Risk = " +
            riskPips.toFixed(1) +
            " pips. Required: 3–15 pips.",
            "Wait for a cleaner structural entry.",
            "Risk outside permitted range."
        );

        return;
    }

    // ========================================================
    // PROFESSIONAL TARGET CALCULATION
    // ========================================================

    const targets =
        calculateSniperTargets(
            direction,
            entry,
            sl
        );

    if (!targets) {

        invalidateSniperSetup();

        return;
    }

    // ========================================================
    // LOCK SETUP
    // ========================================================

    lockSniperSetup(
        direction,
        entry,
        sl,
        targets,
        score
    );

    // Store RR for display
    marketData.sniperSetup.rr2 =
        targets.rr2.toFixed(2);

    // ========================================================
    // M5 TRIGGER
    // ========================================================

    const momentumTrigger =
        getM5MomentumTrigger(
            direction
        );

    // ========================================================
    // DISPLAY
    // ========================================================

    setText(
        "sniperStatus",
        momentumTrigger
            ? "A+ EXECUTION READY"
            : "A+ SETUP DETECTED"
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
            marketData.sniperSetup
                .detectedPrice
        )
    );

    setText(
        "stopLoss",
        formatPrice(
            marketData.sniperSetup
                .stopLoss
        )
    );

    setText(
        "tp1",
        formatPrice(
            marketData.sniperSetup
                .tp1
        )
    );

    setText(
        "tp2",
        formatPrice(
            marketData.sniperSetup
                .tp2
        )
    );

    setText(
        "tp3",
        formatPrice(
            marketData.sniperSetup
                .tp3
        )
    );

    setText(
        "riskReward",
        "1:" +
        targets.rr2.toFixed(2)
    );

    setText(
        "validity",
        "Setup locked at detection time."
    );

    setText(
        "trigger",
        momentumTrigger
            ? "M5 momentum confirmation CONFIRMED."
            : "WAIT — M5 momentum confirmation."
    );

    setText(
        "invalidation",
        direction ===
            "BEARISH"
            ? formatPrice(sl)
            : formatPrice(sl)
    );

    setText(
        "setupTime",
        marketData.sniperSetup
            .detectedTime
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
        direction
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
// IMPORTANT:
// This remains a separate engine.
// It does NOT use the Sniper TP/SL logic.
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

        rsiAligned =
            true;
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

        rsiAligned =
            true;
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
            "Required: M5 EMA alignment."
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
            "RSI confirmation required."
        );

        return;
    }

    if (
        !momentumTrigger
    ) {

        showScalpWait(
            "WAIT — PRICE ACTION",
            "Completed M5 momentum candle not confirmed.",
            "Required: completed M5 breakout trigger."
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
            "Wait for fresh data."
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
            "Price is too far from EMA20.",
            "Wait for retracement."
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
            tp2 - entry
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
            "Minimum: 1:2."
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
                "Higher-timeframe resistance is too close.",
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
                "Higher-timeframe support is too close.",
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
            "Required: 80/100."
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
        "Conditions currently confirmed."
    );

    setText(
        "scalpTrigger",
        "Completed M5 momentum trigger confirmed."
    );

    setText(
        "scalpInvalidation",
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
            ", but lower timeframe confirmation is incomplete."
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
    // NEWS
    // ========================================================

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
            "NORMAL"
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
            "High-impact event inside next 2 hours."
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
        document.getElementById(
            id
        );

    if (
        element
    ) {

        element.textContent =
            value;
    }
}
