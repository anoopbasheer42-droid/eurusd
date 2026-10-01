const API_KEY = "8908432b6c784bc49aad6ccf64845991";

const PRICE_URL =
    `https://api.twelvedata.com/price?symbol=EUR/USD&apikey=${API_KEY}`;

const TIME_SERIES_URL =
    "https://api.twelvedata.com/time_series";

const NEWS_URL =
    "https://xoomar.com/api/markets/calendar?importance=high";

let currentPrice = null;

let marketData = {
    H4: [],
    H1: [],
    M15: [],
    M5: []
};

let newsData = [];

let newsClear = false;


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

        const response = await fetch(
            PRICE_URL,
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                `Price HTTP ${response.status}`
            );
        }

        const data = await response.json();

        if (!data.price) {
            throw new Error(
                data.message || "Price unavailable"
            );
        }

        currentPrice = Number(data.price);

        setText(
            "price",
            formatPrice(currentPrice)
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
// FETCH CANDLES
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

    const response = await fetch(
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

    const data = await response.json();

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
// LOAD CANDLES — EACH TIMEFRAME INDEPENDENTLY
// ============================================================

async function loadCandles() {

    const results = {

        H4: false,
        H1: false,
        M15: false,
        M5: false
    };


    // H4
    try {

        marketData.H4 =
            await fetchCandles("4h");

        results.H4 = true;

    } catch (error) {

        console.error(
            "H4 ERROR:",
            error
        );

        marketData.H4 = [];
    }


    // H1
    try {

        marketData.H1 =
            await fetchCandles("1h");

        results.H1 = true;

    } catch (error) {

        console.error(
            "H1 ERROR:",
            error
        );

        marketData.H1 = [];
    }


    // M15
    try {

        marketData.M15 =
            await fetchCandles("15min");

        results.M15 = true;

    } catch (error) {

        console.error(
            "M15 ERROR:",
            error
        );

        marketData.M15 = [];
    }


    // M5
    try {

        marketData.M5 =
            await fetchCandles("5min");

        results.M5 = true;

    } catch (error) {

        console.error(
            "M5 ERROR:",
            error
        );

        marketData.M5 = [];
    }


    console.log(
        "CANDLE LOAD STATUS:",
        results
    );


    return results;
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


    const rs =
        averageGain /
        averageLoss;


    return (
        100 -
        (
            100 /
            (1 + rs)
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

function calculateLevels(candles) {

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
        [...highs].sort(
            (a, b) => b - a
        );


    const sortedLows =
        [...lows].sort(
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

    const ema20 =
        calculateEMA(
            h1,
            20
        );

    const ema50 =
        calculateEMA(
            h1,
            50
        );


    let emaStructure =
        "NEUTRAL";


    if (
        ema20 !== null &&
        ema50 !== null
    ) {

        if (ema20 > ema50) {

            emaStructure =
                "BULLISH";

        } else if (ema20 < ema50) {

            emaStructure =
                "BEARISH";
        }
    }


    setText(
        "emaStructure",
        emaStructure
    );


    // --------------------------------------------------------
    // LEVELS
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
    // ENGINES
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
        levels,
        newsClear
    );


    runScalpingEngine(
        h1Trend,
        m5Structure,
        m5RSI,
        levels,
        newsClear
    );


    updateProVerdict(
        h4Trend,
        h1Trend,
        m15Structure,
        m5Structure,
        newsClear
    );
}


// ============================================================
// NEWS
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
            "NEWS LOADED:",
            newsData.length
        );


        return true;


    } catch (error) {

        console.error(
            "NEWS ERROR:",
            error
        );


        newsClear = false;


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
// EVENT TIME
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
// HIGH IMPACT
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
// USD EVENT
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


    if (
        currency.includes("usd") ||
        currency.includes("united states") ||
        currency === "us"
    ) {

        return true;
    }


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


    const keywords = [

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


    return keywords.some(
        keyword =>
            name.includes(keyword)
    );
}


// ============================================================
// EUR EVENT
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
        source.includes(
            "european central bank"
        )
    ) {

        return true;
    }


    const keywords = [

        "ecb",
        "euro area",
        "eurozone",
        "euro zone",
        "germany",
        "france",
        "italy",
        "spain"

    ];


    return keywords.some(
        keyword =>
            name.includes(keyword)
    );
}


// ============================================================
// IST TIME
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
// PROCESS NEWS
// ============================================================

function processNews() {

    const now =
        Date.now();


    const events =
        newsData
            .map(event => {

                const date =
                    getEventTime(event);


                return {

                    original:
                        event,

                    date:
                        date,

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
    // EUR
    // --------------------------------------------------------

    const eurEvents =
        events
            .filter(
                event =>
                    event.high &&
                    event.eur &&
                    event.date.getTime() >= now
            )
            .sort(
                (a, b) =>
                    a.date - b.date
            );


    // --------------------------------------------------------
    // USD
    // --------------------------------------------------------

    const usdEvents =
        events
            .filter(
                event =>
                    event.high &&
                    event.usd &&
                    event.date.getTime() >= now
            )
            .sort(
                (a, b) =>
                    a.date - b.date
            );


    // --------------------------------------------------------
    // EUR DISPLAY
    // --------------------------------------------------------

    if (eurEvents.length > 0) {

        const event =
            eurEvents[0];

        setText(
            "eurNews",
            `HIGH — ${event.name} @ ${formatIST(event.date)}`
        );

    } else {

        setText(
            "eurNews",
            "NO EUR HIGH-IMPACT EVENTS FOUND"
        );
    }


    // --------------------------------------------------------
    // USD DISPLAY
    // --------------------------------------------------------

    if (usdEvents.length > 0) {

        const event =
            usdEvents[0];

        setText(
            "usdNews",
            `HIGH — ${event.name} @ ${formatIST(event.date)}`
        );

    } else {

        setText(
            "usdNews",
            "NO USD HIGH-IMPACT EVENTS FOUND"
        );
    }


    // --------------------------------------------------------
    // EUR/USD EVENTS
    // --------------------------------------------------------

    const relevantEvents =
        events
            .filter(
                event =>
                    event.high &&
                    (
                        event.usd ||
                        event.eur
                    )
            )
            .sort(
                (a, b) =>
                    a.date - b.date
            );


    const nextEvent =
        relevantEvents.find(
            event =>
                event.date.getTime() >= now
        );


    // --------------------------------------------------------
    // NEXT EVENT
    // --------------------------------------------------------

    if (nextEvent) {

        setText(
            "nextEvent",
            `${nextEvent.name} — ${formatIST(nextEvent.date)}`
        );

    } else {

        setText(
            "nextEvent",
            "No upcoming high-impact EUR/USD event found"
        );
    }


    // ========================================================
    // NEWS BLOCK
    // ========================================================

    const BEFORE =
        30 * 60 * 1000;

    const AFTER =
        30 * 60 * 1000;


    let blockedEvent = null;


    for (
        const event of relevantEvents
    ) {

        const eventTime =
            event.date.getTime();


        const difference =
            now - eventTime;


        if (
            difference >= -BEFORE &&
            difference <= AFTER
        ) {

            blockedEvent =
                event;

            break;
        }
    }


    // --------------------------------------------------------
    // NEWS BLOCK ACTIVE
    // --------------------------------------------------------

    if (blockedEvent) {

        const difference =
            now -
            blockedEvent.date.getTime();


        if (difference < 0) {

            const minutes =
                Math.ceil(
                    Math.abs(difference) /
                    60000
                );


            setText(
                "newsFilter",
                `🚫 NEWS BLOCK — ${blockedEvent.name} IN ${minutes} MIN`
            );

        } else {

            const minutes =
                Math.ceil(
                    difference /
                    60000
                );


            setText(
                "newsFilter",
                `🚫 NEWS BLOCK — ${blockedEvent.name} (${minutes} MIN AGO)`
            );
        }


        setText(
            "tradingRisk",
            "HIGH — NEWS FILTER CLOSED"
        );


        newsClear = false;


        return;
    }


    // --------------------------------------------------------
    // NEWS WITHIN 2 HOURS
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


            newsClear = false;


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


    newsClear = true;
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
    levels,
    newsStatus
) {

    // --------------------------------------------------------
    // NEWS CHECK
    // --------------------------------------------------------

    if (!newsStatus) {

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
        setText("riskReward", "—");

        setText(
            "validity",
            "NEWS FILTER CLOSED"
        );

        setText(
            "trigger",
            "Wait for EUR/USD economic-news clearance"
        );

        setText(
            "invalidation",
            "NO TRADE WHILE NEWS FILTER IS CLOSED"
        );

        setText(
            "setupScore",
            "—"
        );

        return;
    }


    // --------------------------------------------------------
    // RANGE IS NOT A DIRECTION
    // --------------------------------------------------------

    if (
        h4Trend !== "BULLISH" &&
        h4Trend !== "BEARISH"
    ) {

        setText(
            "sniperStatus",
            "WAIT — H4 NO CLEAR DIRECTION"
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
            `H4 is ${h4Trend}. Clear H4 trend required.`
        );

        setText(
            "trigger",
            "Wait for H4 directional structure"
        );

        setText(
            "invalidation",
            "No A+ setup while H4 remains RANGE"
        );

        setText(
            "setupScore",
            "—"
        );

        return;
    }


    // --------------------------------------------------------
    // H4 / H1 CONFLICT
    // --------------------------------------------------------

    if (
        h1Trend !== h4Trend
    ) {

        setText(
            "sniperStatus",
            "WAIT — H4/H1 CONFLICT"
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
            `H4 ${h4Trend} / H1 ${h1Trend}`
        );

        setText(
            "trigger",
            "H4 and H1 must align"
        );

        setText(
            "invalidation",
            "No trade while H4/H1 conflict"
        );

        setText(
            "setupScore",
            "—"
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


    if (newsStatus) {
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
            "Wait for M15 confirmation + M5 trigger"
        );

        setText(
            "invalidation",
            "Setup score below A+ requirement"
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


    const entry =
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
    levels,
    newsStatus
) {

    // --------------------------------------------------------
    // NEWS
    // --------------------------------------------------------

    if (!newsStatus) {

        setText(
            "scalpVerdict",
            "WAIT — NEWS CHECK REQUIRED"
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
        setText("scalpScore", "—");

        setText(
            "scalpValidity",
            "NEXT 2 HOURS — NEWS CHECK REQUIRED"
        );

        setText(
            "scalpTrigger",
            "Wait for EUR/USD economic-news clearance."
        );

        setText(
            "scalpInvalidation",
            "NO TRADE WHILE NEWS FILTER IS CLOSED"
        );

        return;
    }


    // --------------------------------------------------------
    // H1 MUST HAVE DIRECTION
    // --------------------------------------------------------

    if (
        h1Trend !== "BULLISH" &&
        h1Trend !== "BEARISH"
    ) {

        setText(
            "scalpVerdict",
            "WAIT — H1 NO CLEAR DIRECTION"
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
            "scalpScore",
            "—"
        );

        setText(
            "scalpValidity",
            "NEXT 2 HOURS — H1 IS RANGE"
        );

        setText(
            "scalpTrigger",
            "Wait for H1 directional structure"
        );

        setText(
            "scalpInvalidation",
            "No scalp while H1 remains RANGE"
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
            "Wait for M5 confirmation in H1 direction."
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
    m5Structure,
    newsStatus
) {

    // --------------------------------------------------------
    // NEWS
    // --------------------------------------------------------

    if (!newsStatus) {

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


    // --------------------------------------------------------
    // H4 RANGE
    // --------------------------------------------------------

    if (
        h4Trend !== "BULLISH" &&
        h4Trend !== "BEARISH"
    ) {

        setText(
            "proVerdict",
            "WAIT — H4 RANGE"
        );

        setText(
            "proExplanation",
            "H4 does not currently show a clear directional structure. Wait for a confirmed H4 directional move before looking for an A+ setup."
        );

        return;
    }


    // --------------------------------------------------------
    // H1 CONFLICT
    // --------------------------------------------------------

    if (
        h1Trend !== h4Trend
    ) {

        setText(
            "proVerdict",
            "WAIT — H4/H1 CONFLICT"
        );

        setText(
            "proExplanation",
            `H4 is ${h4Trend} while H1 is ${h1Trend}. Wait for higher-timeframe alignment.`
        );

        return;
    }


    // --------------------------------------------------------
    // M15 CONFIRMATION
    // --------------------------------------------------------

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
            `H4 and H1 are aligned ${h4Trend}, but M15 is ${m15Structure}.`
        );
    }
}


// ============================================================
// MAIN DASHBOARD LOADER
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


    // --------------------------------------------------------
    // 1. PRICE
    // --------------------------------------------------------

    await fetchPrice();


    // --------------------------------------------------------
    // 2. CANDLES
    // --------------------------------------------------------

    const candleStatus =
        await loadCandles();


    // --------------------------------------------------------
    // 3. NEWS FIRST
    // --------------------------------------------------------

    await loadNews();


    // --------------------------------------------------------
    // 4. TECHNICAL ANALYSIS
    //
    // IMPORTANT:
    // newsClear is now already known.
    // --------------------------------------------------------

    const minimumDataAvailable =
        marketData.H4.length > 0 &&
        marketData.H1.length > 0;


    if (minimumDataAvailable) {

        updateTechnicalAnalysis();

    }


    // --------------------------------------------------------
    // STATUS
    // --------------------------------------------------------

    const allCandlesLoaded =
        candleStatus.H4 &&
        candleStatus.H1 &&
        candleStatus.M15 &&
        candleStatus.M5;


    if (
        allCandlesLoaded &&
        currentPrice !== null
    ) {

        setText(
            "priceStatus",
            "MARKET DATA LOADED"
        );

    } else {

        setText(
            "priceStatus",
            "MARKET DATA PARTIALLY LOADED"
        );
    }


    console.log(
        "FINAL NEWS STATUS:",
        newsClear
    );

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
// AUTO REFRESH — 60 SECONDS
// ============================================================

setInterval(
    function () {

        loadMarketData();

    },
    60000
);
