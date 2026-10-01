// ============================================================
// EUR/USD SNIPER DASHBOARD
// FULL script.js
// ============================================================

const API_KEY = "8908432b6c784bc49aad6ccf64845991";

// ============================================================
// API URLs
// ============================================================

const PRICE_URL =
    `https://api.twelvedata.com/price?symbol=EUR/USD&apikey=${API_KEY}`;

const TIME_SERIES_URL =
    "https://api.twelvedata.com/time_series";

// CORRECT XOOMAR HIGH-IMPACT CALENDAR ENDPOINT
const NEWS_URL =
    "https://xoomar.com/api/markets/calendar?importance=high";


// ============================================================
// GLOBAL VARIABLES
// ============================================================

let currentPrice = null;

let marketData = {
    H4: [],
    H1: [],
    M15: [],
    M5: []
};

let newsData = [];

window.newsClear = false;


// ============================================================
// BASIC HELPERS
// ============================================================

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}


function formatPrice(value) {

    if (
        value === null ||
        value === undefined ||
        isNaN(value)
    ) {
        return "—";
    }

    return Number(value).toFixed(5);
}


// ============================================================
// LIVE PRICE
// ============================================================

async function fetchPrice() {

    try {

        const response =
            await fetch(PRICE_URL, {
                cache: "no-store"
            });

        if (!response.ok) {
            throw new Error(
                `Price HTTP ${response.status}`
            );
        }

        const data =
            await response.json();

        if (!data.price) {
            throw new Error(
                data.message || "Price unavailable"
            );
        }

        currentPrice =
            Number(data.price);

        setText(
            "price",
            formatPrice(currentPrice)
        );

        setText(
            "priceStatus",
            "MARKET DATA LOADED"
        );

        return true;

    } catch (error) {

        console.error(
            "PRICE ERROR:",
            error
        );

        setText(
            "priceStatus",
            "PRICE CONNECTION ERROR"
        );

        return false;
    }
}


// ============================================================
// CANDLE DATA
// ============================================================

async function fetchCandles(
    interval,
    outputsize = 100
) {

    const url =
        `${TIME_SERIES_URL}` +
        `?symbol=EUR/USD` +
        `&interval=${interval}` +
        `&outputsize=${outputsize}` +
        `&apikey=${API_KEY}`;

    const response =
        await fetch(
            url,
            {
                cache: "no-store"
            }
        );

    if (!response.ok) {
        throw new Error(
            `Candle HTTP ${response.status}`
        );
    }

    const data =
        await response.json();

    if (!data.values) {
        throw new Error(
            data.message ||
            `No ${interval} candle data`
        );
    }

    return data.values
        .map(candle => ({
            time:
                new Date(
                    candle.datetime
                ).getTime(),

            open:
                Number(candle.open),

            high:
                Number(candle.high),

            low:
                Number(candle.low),

            close:
                Number(candle.close)
        }))
        .sort(
            (a, b) =>
                a.time - b.time
        );
}


// ============================================================
// LOAD ALL TIMEFRAMES
// ============================================================

async function loadCandles() {

    try {

        marketData.H4 =
            await fetchCandles("4h");

        marketData.H1 =
            await fetchCandles("1h");

        marketData.M15 =
            await fetchCandles("15min");

        marketData.M5 =
            await fetchCandles("5min");

        console.log(
            "ALL CANDLE DATA LOADED",
            marketData
        );

        return true;

    } catch (error) {

        console.error(
            "CANDLE ERROR:",
            error
        );

        return false;
    }
}


// ============================================================
// EMA
// ============================================================

function calculateEMA(
    candles,
    period
) {

    if (
        !candles ||
        candles.length < period
    ) {
        return null;
    }

    const closes =
        candles.map(
            candle => candle.close
        );

    const multiplier =
        2 / (period + 1);

    let ema =
        closes
            .slice(0, period)
            .reduce(
                (a, b) => a + b,
                0
            ) / period;

    for (
        let i = period;
        i < closes.length;
        i++
    ) {

        ema =
            (
                (closes[i] - ema) *
                multiplier
            ) + ema;
    }

    return ema;
}


// ============================================================
// RSI
// ============================================================

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

    const closes =
        candles.map(
            candle => candle.close
        );

    let gains = 0;
    let losses = 0;

    for (
        let i = 1;
        i <= period;
        i++
    ) {

        const change =
            closes[i] -
            closes[i - 1];

        if (change >= 0) {
            gains += change;
        } else {
            losses -= change;
        }
    }

    let averageGain =
        gains / period;

    let averageLoss =
        losses / period;

    for (
        let i = period + 1;
        i < closes.length;
        i++
    ) {

        const change =
            closes[i] -
            closes[i - 1];

        const gain =
            change > 0
                ? change
                : 0;

        const loss =
            change < 0
                ? -change
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

    if (averageLoss === 0) {
        return 100;
    }

    const relativeStrength =
        averageGain /
        averageLoss;

    return (
        100 -
        (
            100 /
            (1 + relativeStrength)
        )
    );
}


// ============================================================
// MARKET STRUCTURE
// ============================================================

function getStructure(candles) {

    if (
        !candles ||
        candles.length < 10
    ) {
        return "INSUFFICIENT DATA";
    }

    const recent =
        candles.slice(-10);

    const first =
        recent.slice(0, 5);

    const last =
        recent.slice(-5);

    const firstHigh =
        Math.max(
            ...first.map(
                c => c.high
            )
        );

    const lastHigh =
        Math.max(
            ...last.map(
                c => c.high
            )
        );

    const firstLow =
        Math.min(
            ...first.map(
                c => c.low
            )
        );

    const lastLow =
        Math.min(
            ...last.map(
                c => c.low
            )
        );

    const firstClose =
        first[first.length - 1]
            .close;

    const lastClose =
        last[last.length - 1]
            .close;


    if (
        lastHigh < firstHigh &&
        lastLow < firstLow &&
        lastClose < firstClose
    ) {
        return "BEARISH";
    }


    if (
        lastHigh > firstHigh &&
        lastLow > firstLow &&
        lastClose > firstClose
    ) {
        return "BULLISH";
    }


    return "RANGE";
}


// ============================================================
// SUPPORT / RESISTANCE
// ============================================================

function calculateLevels(
    candles
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

    const recent =
        candles.slice(-50);

    const highs =
        recent.map(
            candle => candle.high
        );

    const lows =
        recent.map(
            candle => candle.low
        );

    const sortedHighs =
        [...highs]
            .sort(
                (a, b) => b - a
            );

    const sortedLows =
        [...lows]
            .sort(
                (a, b) => a - b
            );

    return {

        resistance1:
            sortedHighs[0],

        resistance2:
            sortedHighs[1],

        support1:
            sortedLows[0],

        support2:
            sortedLows[1]
    };
}


// ============================================================
// TECHNICAL ANALYSIS
// ============================================================

function updateTechnicalAnalysis() {

    const h4 =
        marketData.H4;

    const h1 =
        marketData.H1;

    const m15 =
        marketData.M15;

    const m5 =
        marketData.M5;


    // --------------------------------------------------------
    // STRUCTURE
    // --------------------------------------------------------

    const h4Trend =
        getStructure(h4);

    const h1Trend =
        getStructure(h1);

    const m15Structure =
        getStructure(m15);

    const m5Structure =
        getStructure(m5);


    setText(
        "h4Trend",
        h4Trend
    );

    setText(
        "h1Trend",
        h1Trend
    );

    setText(
        "m15Structure",
        m15Structure
    );

    setText(
        "m5Structure",
        m5Structure
    );


    // --------------------------------------------------------
    // RSI
    // --------------------------------------------------------

    const h4RSI =
        calculateRSI(h4);

    const h1RSI =
        calculateRSI(h1);

    const m15RSI =
        calculateRSI(m15);

    const m5RSI =
        calculateRSI(m5);


    setText(
        "h4Rsi",
        h4RSI !== null
            ? h4RSI.toFixed(1)
            : "—"
    );

    setText(
        "h1Rsi",
        h1RSI !== null
            ? h1RSI.toFixed(1)
            : "—"
    );

    setText(
        "m15Rsi",
        m15RSI !== null
            ? m15RSI.toFixed(1)
            : "—"
    );

    setText(
        "m5Rsi",
        m5RSI !== null
            ? m5RSI.toFixed(1)
            : "—"
    );


    // --------------------------------------------------------
    // EMA
    // --------------------------------------------------------

    const h1EMA20 =
        calculateEMA(
            h1,
            20
        );

    const h1EMA50 =
        calculateEMA(
            h1,
            50
        );

    let emaStructure =
        "NEUTRAL";


    if (
        h1EMA20 !== null &&
        h1EMA50 !== null
    ) {

        if (
            h1EMA20 >
            h1EMA50
        ) {

            emaStructure =
                "BULLISH";

        } else if (
            h1EMA20 <
            h1EMA50
        ) {

            emaStructure =
                "BEARISH";
        }
    }


    setText(
        "emaStructure",
        emaStructure
    );


    // --------------------------------------------------------
    // SUPPORT / RESISTANCE
    // --------------------------------------------------------

    const levels =
        calculateLevels(h1);


    setText(
        "resistance1",
        formatPrice(
            levels.resistance1
        )
    );

    setText(
        "resistance2",
        formatPrice(
            levels.resistance2
        )
    );

    setText(
        "support1",
        formatPrice(
            levels.support1
        )
    );

    setText(
        "support2",
        formatPrice(
            levels.support2
        )
    );


    // --------------------------------------------------------
    // SNIPER
    // --------------------------------------------------------

    runSniperEngine(
        h4Trend,
        h1Trend,
        m15Structure,
        m5Structure,
        h4RSI,
        h1RSI,
        m15RSI,
        m5RSI,
        emaStructure,
        levels
    );


    // --------------------------------------------------------
    // SCALPING
    // --------------------------------------------------------

    runScalpingEngine(
        h1Trend,
        m5Structure,
        m5RSI,
        levels
    );


    // --------------------------------------------------------
    // PRO VERDICT
    // --------------------------------------------------------

    updateProVerdict(
        h4Trend,
        h1Trend,
        m15Structure,
        m5Structure
    );
}


// ============================================================
// NEWS / ECONOMIC CALENDAR
// ============================================================

async function loadNews() {

    try {

        setText(
            "eurNews",
            "CONNECTING..."
        );

        setText(
            "usdNews",
            "CONNECTING..."
        );

        setText(
            "newsFilter",
            "CHECKING..."
        );

        setText(
            "nextEvent",
            "CHECKING..."
        );

        setText(
            "tradingRisk",
            "CHECKING..."
        );


        const response =
            await fetch(
                NEWS_URL,
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                `News HTTP ${response.status}`
            );
        }


        const json =
            await response.json();


        console.log(
            "XOOMAR RESPONSE:",
            json
        );


        // XOOMAR response is:
        // {
        //   data: [...]
        // }


        if (
            !json.data ||
            !Array.isArray(json.data)
        ) {

            throw new Error(
                "XOOMAR data array not found"
            );
        }


        newsData =
            json.data;


        processNews();


        console.log(
            "NEWS CONNECTED:",
            newsData.length,
            "events"
        );


        return true;


    } catch (error) {

        console.error(
            "NEWS ERROR:",
            error
        );


        window.newsClear =
            false;


        setText(
            "eurNews",
            "NO EUR DATA"
        );

        setText(
            "usdNews",
            "NEWS CONNECTION ERROR"
        );

        setText(
            "newsFilter",
            "NEWS CHECK REQUIRED"
        );

        setText(
            "nextEvent",
            "ECONOMIC CALENDAR CONNECTION ERROR"
        );

        setText(
            "tradingRisk",
            "HIGH — NEWS FILTER CLOSED"
        );


        return false;
    }
}


// ============================================================
// NEWS EVENT TIME
// ============================================================

function getEventTime(event) {

    const possibleTimes = [

        event.scheduledAt,

        event.date,

        event.datetime,

        event.time,

        event.releaseDate

    ];


    for (
        const value of possibleTimes
    ) {

        if (!value) {
            continue;
        }

        const date =
            new Date(value);

        if (
            !isNaN(
                date.getTime()
            )
        ) {
            return date;
        }
    }


    return null;
}


// ============================================================
// EVENT NAME
// ============================================================

function getEventName(event) {

    return (
        event.eventName ||
        event.name ||
        event.title ||
        event.event ||
        "Economic Event"
    );
}


// ============================================================
// EVENT IMPORTANCE
// ============================================================

function isHighImpact(event) {

    const importance =
        String(
            event.importance ||
            event.impact ||
            ""
        )
        .toLowerCase()
        .trim();


    return (
        importance === "high" ||
        importance === "3" ||
        importance === "red"
    );
}


// ============================================================
// USD EVENT DETECTION
// ============================================================

function isUSDEvent(event) {

    const name =
        getEventName(event)
            .toLowerCase();

    const source =
        String(
            event.source ||
            event.provider ||
            ""
        )
        .toLowerCase();

    const currency =
        String(
            event.currency ||
            event.country ||
            ""
        )
        .toLowerCase();


    // Direct USD/currency information.
    if (
        currency.includes("usd") ||
        currency.includes("united states") ||
        currency === "us"
    ) {
        return true;
    }


    // Sources present in the XOOMAR
    // data you showed.
    if (
        source.includes("bls") ||
        source.includes("bea") ||
        source.includes("dol") ||
        source.includes("census") ||
        source.includes("treasury") ||
        source.includes("federal reserve") ||
        source.includes("fed")
    ) {
        return true;
    }


    // Important US releases.
    const usdKeywords = [

        "nonfarm payroll",
        "employment situation",
        "jobless claims",
        "initial jobless claims",
        "continuing jobless claims",
        "consumer price index",
        "cpi",
        "core cpi",
        "producer price index",
        "ppi",
        "core ppi",
        "retail sales",
        "core retail sales",
        "pce",
        "core pce",
        "personal consumption",
        "fomc",
        "fed interest rate",
        "federal funds",
        "fomc minutes",
        "ism manufacturing",
        "ism services",
        "unemployment rate",
        "adp employment",
        "gdp",
        "durable goods",
        "factory orders",
        "construction spending",
        "trade balance"
    ];


    return usdKeywords.some(
        keyword =>
            name.includes(keyword)
    );
}


// ============================================================
// EUR EVENT DETECTION
// ============================================================

function isEURRelevant(event) {

    const name =
        getEventName(event)
            .toLowerCase();

    const source =
        String(
            event.source ||
            event.provider ||
            ""
        )
        .toLowerCase();

    const currency =
        String(
            event.currency ||
            event.country ||
            ""
        )
        .toLowerCase();


    if (
        currency.includes("eur") ||
        currency.includes("euro") ||
        currency.includes("europe") ||
        currency.includes("eurozone")
    ) {
        return true;
    }


    if (
        source.includes("ecb") ||
        source.includes("european central bank")
    ) {
        return true;
    }


    const eurKeywords = [

        "ecb",
        "euro area",
        "eurozone",
        "euro zone",
        "germany",
        "france",
        "italy",
        "spain"

    ];


    return eurKeywords.some(
        keyword =>
            name.includes(keyword)
    );
}


// ============================================================
// IST FORMAT
// ============================================================

function formatIST(date) {

    return date.toLocaleString(
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

            hour12:
                false
        }
    ) + " IST";
}


// ============================================================
// NEWS PROCESSOR
// ============================================================

function processNews() {

    const now =
        Date.now();


    // --------------------------------------------------------
    // Get valid events
    // --------------------------------------------------------

    const events =
        newsData
            .map(event => {

                const date =
                    getEventTime(event);

                return {
                    original: event,
                    date: date,
                    name:
                        getEventName(event),
                    high:
                        isHighImpact(event),
                    usd:
                        isUSDEvent(event),
                    eur:
                        isEURRelevant(event)
                };

            })
            .filter(
                event =>
                    event.date !== null
            );


    // --------------------------------------------------------
    // High impact EUR events
    // --------------------------------------------------------

    const eurEvents =
        events
            .filter(
                event =>
                    event.high &&
                    event.eur
            )
            .sort(
                (a, b) =>
                    a.date - b.date
            );


    // --------------------------------------------------------
    // High impact USD events
    // --------------------------------------------------------

    const usdEvents =
        events
            .filter(
                event =>
                    event.high &&
                    event.usd
            )
            .sort(
                (a, b) =>
                    a.date - b.date
            );


    // --------------------------------------------------------
    // EUR display
    // --------------------------------------------------------

    const nextEUR =
        eurEvents.find(
            event =>
                event.date.getTime() >= now
        );


    if (nextEUR) {

        setText(
            "eurNews",
            `HIGH — ${nextEUR.name} @ ${formatIST(nextEUR.date)}`
        );

    } else {

        setText(
            "eurNews",
            "NO EUR HIGH-IMPACT EVENTS FOUND"
        );
    }


    // --------------------------------------------------------
    // USD display
    // --------------------------------------------------------

    const nextUSD =
        usdEvents.find(
            event =>
                event.date.getTime() >= now
        );


    if (nextUSD) {

        setText(
            "usdNews",
            `HIGH — ${nextUSD.name} @ ${formatIST(nextUSD.date)}`
        );

    } else {

        setText(
            "usdNews",
            "NO USD HIGH-IMPACT EVENTS FOUND"
        );
    }


    // --------------------------------------------------------
    // Relevant EUR/USD events
    // --------------------------------------------------------

    const relevantHighImpact =
        events
            .filter(
                event =>
                    event.high &&
                    (event.usd || event.eur)
            )
            .sort(
                (a, b) =>
                    a.date - b.date
            );


    // --------------------------------------------------------
    // Find nearest future high impact
    // --------------------------------------------------------

    const nextEvent =
        relevantHighImpact.find(
            event =>
                event.date.getTime() >= now
        );


    if (!nextEvent) {

        setText(
            "nextEvent",
            "No upcoming high-impact EUR/USD event found"
        );

    } else {

        setText(
            "nextEvent",
            `${nextEvent.name} — ${formatIST(nextEvent.date)}`
        );
    }


    // ========================================================
    // NEWS BLOCK WINDOW
    //
    // Block trading:
    // 30 minutes BEFORE high-impact news
    // through
    // 30 minutes AFTER high-impact news.
    // ========================================================

    const BLOCK_BEFORE =
        30 * 60 * 1000;

    const BLOCK_AFTER =
        30 * 60 * 1000;


    let activeNews = null;


    for (
        const event of relevantHighImpact
    ) {

        const eventTime =
            event.date.getTime();

        const difference =
            now - eventTime;


        if (
            difference >= -BLOCK_BEFORE &&
            difference <= BLOCK_AFTER
        ) {

            activeNews =
                event;

            break;
        }
    }


    // --------------------------------------------------------
    // ACTIVE NEWS = BLOCK
    // --------------------------------------------------------

    if (activeNews) {

        const eventTime =
            activeNews.date.getTime();

        const difference =
            now - eventTime;


        if (difference < 0) {

            const minutes =
                Math.ceil(
                    Math.abs(difference) /
                    60000
                );


            setText(
                "newsFilter",
                `🚫 NEWS BLOCK — ${activeNews.name} IN ${minutes} MIN`
            );

        } else {

            const minutes =
                Math.ceil(
                    difference /
                    60000
                );


            setText(
                "newsFilter",
                `🚫 NEWS BLOCK — ${activeNews.name} (${minutes} MIN AGO)`
            );
        }


        setText(
            "tradingRisk",
            "HIGH — NEWS FILTER CLOSED"
        );


        window.newsClear =
            false;


        return;
    }


    // --------------------------------------------------------
    // UPCOMING NEWS BUT OUTSIDE BLOCK WINDOW
    // --------------------------------------------------------

    if (nextEvent) {

        const minutesUntil =
            Math.ceil(
                (
                    nextEvent.date.getTime() -
                    now
                ) / 60000
            );


        if (
            minutesUntil > 0 &&
            minutesUntil <= 120
        ) {

            setText(
                "newsFilter",
                `⚠️ NEWS AHEAD — ${nextEvent.name} IN ${minutesUntil} MIN`
            );


            setText(
                "tradingRisk",
                "MEDIUM — NEWS APPROACHING"
            );


            // Keep filter closed if news
            // is within 2 hours.
            window.newsClear =
                false;


            return;
        }
    }


    // --------------------------------------------------------
    // NEWS CLEAR
    // --------------------------------------------------------

    setText(
        "newsFilter",
        "✅ NEWS CLEAR"
    );


    setText(
        "tradingRisk",
        "NORMAL — TECHNICAL FILTER ACTIVE"
    );


    window.newsClear =
        true;
}


// ============================================================
// SNIPER ENGINE
// ============================================================

function runSniperEngine(
    h4Trend,
    h1Trend,
    m15Structure,
    m5Structure,
    h4RSI,
    h1RSI,
    m15RSI,
    m5RSI,
    emaStructure,
    levels
) {

    const newsClear =
        window.newsClear === true;


    // --------------------------------------------------------
    // NEWS MUST BE CLEAR
    // --------------------------------------------------------

    if (!newsClear) {

        setText(
            "sniperStatus",
            "WAIT — NEWS FILTER NOT CONFIRMED"
        );

        setText(
            "direction",
            "WAIT"
        );

        setText("entry", "—");
        setText("stopLoss", "—");
        setText("tp1", "—");
        setText("tp2", "—");
        setText("tp3", "—");

        setText(
            "riskReward",
            "—"
        );

        setText(
            "validity",
            "H4/H1 conflict detected. News filter is also closed."
        );

        setText(
            "trigger",
            "H4/H1 direction → M15 confirmation → M5 trigger → news clearance"
        );

        setText(
            "invalidation",
            "No trade while NEWS FILTER is CLOSED"
        );

        return;
    }


    // --------------------------------------------------------
    // H4 / H1 MUST AGREE
    // --------------------------------------------------------

    if (
        h4Trend !== h1Trend
    ) {

        setText(
            "sniperStatus",
            "WAIT — HIGHER TIMEFRAME CONFLICT"
        );

        setText(
            "direction",
            "WAIT"
        );

        setText("entry", "—");
        setText("stopLoss", "—");
        setText("tp1", "—");
        setText("tp2", "—");
        setText("tp3", "—");
        setText("riskReward", "—");

        setText(
            "validity",
            "H4/H1 conflict detected"
        );

        setText(
            "trigger",
            "H4 and H1 must align → M15 confirmation → M5 trigger"
        );

        setText(
            "invalidation",
            "No trade while higher timeframes conflict"
        );

        return;
    }


    const direction =
        h4Trend;


    let score = 0;


    if (
        h4Trend === direction
    ) {
        score += 2;
    }


    if (
        h1Trend === direction
    ) {
        score += 2;
    }


    if (
        m15Structure === direction
    ) {
        score += 2;
    }


    if (
        m5Structure === direction
    ) {
        score += 1;
    }


    if (
        emaStructure === direction
    ) {
        score += 1;
    }


    if (
        direction === "BULLISH" &&
        h1RSI !== null &&
        h1RSI < 65
    ) {
        score += 1;
    }


    if (
        direction === "BEARISH" &&
        h1RSI !== null &&
        h1RSI > 35
    ) {
        score += 1;
    }


    if (newsClear) {
        score += 1;
    }


    setText(
        "setupScore",
        `${score} / 11`
    );


    if (score < 8) {

        setText(
            "sniperStatus",
            "WAIT — A+ CONDITIONS NOT COMPLETE"
        );

        setText(
            "direction",
            direction
        );

        setText("entry", "—");
        setText("stopLoss", "—");
        setText("tp1", "—");
        setText("tp2", "—");
        setText("tp3", "—");
        setText("riskReward", "—");

        setText(
            "validity",
            "A+ alignment required"
        );

        setText(
            "trigger",
            "Wait for M15 confirmation and M5 trigger"
        );

        setText(
            "invalidation",
            "Setup below required score"
        );

        return;
    }


    createSniperTrade(
        direction,
        levels
    );
}


// ============================================================
// SNIPER TRADE
// ============================================================

function createSniperTrade(
    direction,
    levels
) {

    if (!currentPrice) {
        return;
    }


    let entry =
        currentPrice;

    let sl;
    let tp1;
    let tp2;
    let tp3;


    if (
        direction === "BULLISH"
    ) {

        sl =
            levels.support1
                ? levels.support1 - 0.00020
                : entry - 0.00100;

        const risk =
            entry - sl;

        tp1 =
            entry + risk * 2;

        tp2 =
            entry + risk * 3;

        tp3 =
            entry + risk * 4;


        setText(
            "sniperStatus",
            "🟢 A+ BUY SETUP"
        );

    } else {

        sl =
            levels.resistance1
                ? levels.resistance1 + 0.00020
                : entry + 0.00100;

        const risk =
            sl - entry;

        tp1 =
            entry - risk * 2;

        tp2 =
            entry - risk * 3;

        tp3 =
            entry - risk * 4;


        setText(
            "sniperStatus",
            "🔴 A+ SELL SETUP"
        );
    }


    const risk =
        Math.abs(
            entry - sl
        );

    const reward =
        Math.abs(
            tp1 - entry
        );

    const rr =
        risk > 0
            ? reward / risk
            : 0;


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
        `1 : ${rr.toFixed(1)}`
    );

    setText(
        "validity",
        "Valid while H4/H1/M15/M5 alignment remains intact"
    );

    setText(
        "trigger",
        "M15 confirmation + M5 price-action trigger"
    );

    setText(
        "invalidation",
        formatPrice(sl)
    );
}


// ============================================================
// SCALPING ENGINE
// ============================================================

function runScalpingEngine(
    h1Trend,
    m5Structure,
    m5RSI,
    levels
) {

    const newsClear =
        window.newsClear === true;


    if (!newsClear) {

        setText(
            "scalpVerdict",
            "WAIT — NEWS CHECK REQUIRED"
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
            "NEXT 2 HOURS — NEWS CHECK REQUIRED"
        );

        setText(
            "scalpTrigger",
            "H1 + M5 technical bias detected. Wait for EUR/USD economic-news clearance."
        );

        setText(
            "scalpInvalidation",
            "NO TRADE WHILE NEWS FILTER IS CLOSED"
        );

        return;
    }


    let score = 0;


    if (
        h1Trend === "BULLISH" ||
        h1Trend === "BEARISH"
    ) {
        score += 2;
    }


    if (
        m5Structure === h1Trend
    ) {
        score += 2;
    }


    if (
        m5RSI !== null
    ) {

        if (
            h1Trend === "BULLISH" &&
            m5RSI > 40 &&
            m5RSI < 70
        ) {
            score += 2;
        }


        if (
            h1Trend === "BEARISH" &&
            m5RSI > 30 &&
            m5RSI < 60
        ) {
            score += 2;
        }
    }


    if (
        levels.support1 &&
        levels.resistance1
    ) {
        score += 2;
    }


    setText(
        "scalpScore",
        `${score} / 8`
    );


    if (
        h1Trend !== "BULLISH" &&
        h1Trend !== "BEARISH"
    ) {

        setText(
            "scalpVerdict",
            "WAIT — NO CLEAR H1 DIRECTION"
        );

        setText(
            "scalpDirection",
            "WAIT"
        );

        setText("scalpEntry", "—");
        setText("scalpSL", "—");
        setText("scalpTP1", "—");
        setText("scalpTP2", "—");
        setText("scalpRR", "—");

        setText(
            "scalpValidity",
            "NEXT 2 HOURS — NO CLEAR DIRECTION"
        );

        return;
    }


    if (score < 6) {

        setText(
            "scalpVerdict",
            "WAIT — SCALP CONDITIONS INCOMPLETE"
        );

        setText(
            "scalpDirection",
            h1Trend
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
            "NEXT 2 HOURS"
        );

        setText(
            "scalpTrigger",
            "Wait for M5 confirmation in the H1 direction."
        );

        setText(
            "scalpInvalidation",
            "Technical conditions below required score"
        );

        return;
    }


    createScalpTrade(
        h1Trend,
        levels
    );
}


// ============================================================
// SCALP TRADE
// ============================================================

function createScalpTrade(
    direction,
    levels
) {

    if (!currentPrice) {
        return;
    }


    const entry =
        currentPrice;

    let sl;
    let tp1;
    let tp2;


    if (
        direction === "BULLISH"
    ) {

        sl =
            levels.support1
                ? levels.support1 - 0.00015
                : entry - 0.00070;

        const risk =
            entry - sl;

        tp1 =
            entry + risk * 1.5;

        tp2 =
            entry + risk * 2;


        setText(
            "scalpVerdict",
            "🟢 SCALP BUY BIAS"
        );

    } else {

        sl =
            levels.resistance1
                ? levels.resistance1 + 0.00015
                : entry + 0.00070;

        const risk =
            sl - entry;

        tp1 =
            entry - risk * 1.5;

        tp2 =
            entry - risk * 2;


        setText(
            "scalpVerdict",
            "🔴 SCALP SELL BIAS"
        );
    }


    const risk =
        Math.abs(
            entry - sl
        );

    const reward =
        Math.abs(
            tp1 - entry
        );

    const rr =
        risk > 0
            ? reward / risk
            : 0;


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
        `1 : ${rr.toFixed(1)}`
    );

    setText(
        "scalpValidity",
        "NEXT 2 HOURS — VALID WHILE H1 + M5 BIAS REMAINS INTACT"
    );

    setText(
        "scalpTrigger",
        "M5 price-action confirmation in H1 direction"
    );

    setText(
        "scalpInvalidation",
        formatPrice(sl)
    );
}


// ============================================================
// PRO VERDICT
// ============================================================

function updateProVerdict(
    h4Trend,
    h1Trend,
    m15Structure,
    m5Structure
) {

    const newsClear =
        window.newsClear === true;


    if (!newsClear) {

        setText(
            "proVerdict",
            "WAIT — NEWS FILTER NOT CONFIRMED"
        );

        setText(
            "proExplanation",
            "Technical analysis is loaded, but trading remains closed until the EUR/USD economic-news filter is confirmed clear."
        );

        return;
    }


    if (
        h4Trend !== h1Trend
    ) {

        setText(
            "proVerdict",
            "WAIT — HIGHER-TIMEFRAME CONFLICT"
        );

        setText(
            "proExplanation",
            `H4 is ${h4Trend} while H1 is ${h1Trend}. Higher-timeframe direction is not aligned. Scalping is monitored separately using H1 + M5.`
        );

        return;
    }


    if (
        m15Structure === h4Trend
    ) {

        setText(
            "proVerdict",
            `WATCH — ${h4Trend} ALIGNMENT`
        );

        setText(
            "proExplanation",
            `H4, H1 and M15 are aligned ${h4Trend}. Wait for the M5 price-action trigger before considering an entry.`
        );

    } else {

        setText(
            "proVerdict",
            "WAIT — M15 CONFIRMATION REQUIRED"
        );

        setText(
            "proExplanation",
            `H4 and H1 are aligned ${h4Trend}, but M15 is ${m15Structure}. Wait for M15 confirmation and an M5 trigger.`
        );
    }
}


// ============================================================
// MAIN MARKET DATA LOADER
// ============================================================

async function loadMarketData() {

    console.log(
        "================================"
    );

    console.log(
        "EUR/USD DASHBOARD UPDATE"
    );

    console.log(
        "================================"
    );


    setText(
        "priceStatus",
        "CONNECTING TO MARKET DATA..."
    );


    // 1. Price
    await fetchPrice();


    // 2. Candles
    const candlesLoaded =
        await loadCandles();


    // 3. Technical analysis
    if (candlesLoaded) {

        updateTechnicalAnalysis();

    } else {

        setText(
            "priceStatus",
            "MARKET DATA PARTIALLY LOADED"
        );
    }


    // 4. Economic calendar
    await loadNews();


    console.log(
        "DASHBOARD UPDATE COMPLETE"
    );
}


// ============================================================
// INITIAL LOAD
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        loadMarketData();

    }
);


// ============================================================
// AUTO REFRESH
// ============================================================

// Refresh every 60 seconds.

setInterval(
    function () {

        loadMarketData();

    },
    60000
);
