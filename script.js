/* =========================================================
   EUR/USD SNIPER DASHBOARD
   LOW-REQUEST / STABLE VERSION
   + NEWS FILTER FRAMEWORK
   ========================================================= */

const API_KEY = "4ba3968e609544bf8990192fdf3ed970";

const SYMBOL = "EUR/USD";
const TIME_SERIES_URL =
    "https://api.twelvedata.com/time_series";

/*
   =========================================================
   NEWS CONFIGURATION
   =========================================================

   IMPORTANT:
   Do NOT put a private economic-calendar API key here.

   NEWS_API_URL should eventually point to your own
   secure backend/proxy.

   Example:

   const NEWS_API_URL =
       "https://YOUR-BACKEND-URL/api/news";

   The backend should return EUR/USD calendar events.

   Until that is configured, the dashboard will safely
   report NEWS UNAVAILABLE rather than invent news.
*/

const NEWS_API_URL = "";

const NEWS_REFRESH_INTERVAL =
    15 * 60 * 1000;

/*
   High-impact news protection window.

   Before event:
       30 minutes

   After event:
       15 minutes
*/

const NEWS_BEFORE_MINUTES = 30;
const NEWS_AFTER_MINUTES = 15;


/* =========================================================
   DASHBOARD REFRESH
   ========================================================= */

const REFRESH_INTERVAL =
    300000;


/* =========================================================
   DATA CACHE
   ========================================================= */

const DATA_TTL = {

    h4:
        30 * 60 * 1000,

    h1:
        15 * 60 * 1000,

    m15:
        10 * 60 * 1000,

    m5:
        5 * 60 * 1000
};


let marketDataLoading =
    false;


let marketData = {

    h4: null,

    h1: null,

    m15: null,

    m5: null
};


let marketDataUpdated = {

    h4: 0,

    h1: 0,

    m15: 0,

    m5: 0
};


/* =========================================================
   NEWS STATE
   ========================================================= */

let newsData = {

    available: false,

    events: [],

    lastUpdated: 0,

    error: null
};


let newsLoading =
    false;


/* =========================================================
   SNIPER SETUP CLOCK
   ========================================================= */

let sniperSetupTime =
    null;


let sniperSetupActive =
    false;


function getISTTime() {

    return new Date().toLocaleTimeString(
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


function startSniperSetup() {

    if (!sniperSetupActive) {

        sniperSetupTime =
            getISTTime();

        sniperSetupActive =
            true;
    }


    setText(
        "setupTime",
        sniperSetupTime
    );
}


function invalidateSniperSetup() {

    sniperSetupActive =
        false;

    sniperSetupTime =
        null;


    setText(
        "setupTime",
        "--"
    );
}


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function setText(
    id,
    value
) {

    const el =
        document.getElementById(id);


    if (el) {

        el.textContent =
            value;
    }
}


function num(value) {

    const n =
        parseFloat(value);


    return Number.isFinite(n)
        ? n
        : null;
}


function pipSize() {

    return 0.0001;
}


function formatPrice(value) {

    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(value)
    ) {

        return "--";
    }


    return Number(value)
        .toFixed(5);
}


function formatNumber(
    value,
    decimals = 2
) {

    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(value)
    ) {

        return "--";
    }


    return Number(value)
        .toFixed(decimals);
}


/* =========================================================
   DELAY HELPER
   ========================================================= */

function delay(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );
}


/* =========================================================
   TWELVE DATA
   ========================================================= */

async function getCandles(
    interval,
    outputsize = 100
) {

    const url =
        `${TIME_SERIES_URL}?symbol=${encodeURIComponent(SYMBOL)}` +
        `&interval=${interval}` +
        `&outputsize=${outputsize}` +
        `&apikey=${encodeURIComponent(API_KEY)}`;


    let response;


    try {

        response =
            await fetch(url);

    } catch (networkError) {

        throw new Error(
            "Network error connecting to Twelve Data"
        );
    }


    if (!response.ok) {

        if (
            response.status === 429
        ) {

            throw new Error(
                "Twelve Data HTTP 429 - rate limit or API quota reached"
            );
        }


        throw new Error(
            `Twelve Data HTTP ${response.status}`
        );
    }


    let data;


    try {

        data =
            await response.json();

    } catch (jsonError) {

        throw new Error(
            "Invalid response from Twelve Data"
        );
    }


    if (
        data.status === "error"
    ) {

        if (
            data.code === 429 ||
            String(
                data.message || ""
            )
                .toLowerCase()
                .includes("rate")
        ) {

            throw new Error(
                "Twelve Data rate limit or quota reached"
            );
        }


        throw new Error(
            data.message ||
            "Twelve Data API error"
        );
    }


    if (
        !data.values ||
        !Array.isArray(data.values)
    ) {

        throw new Error(
            "No candle data returned by Twelve Data"
        );
    }


    return data.values

        .map(
            c => ({

                datetime:
                    c.datetime,

                open:
                    num(c.open),

                high:
                    num(c.high),

                low:
                    num(c.low),

                close:
                    num(c.close)

            })
        )

        .filter(
            c =>

                c.open !== null &&
                c.high !== null &&
                c.low !== null &&
                c.close !== null
        )

        .sort(
            (a, b) =>
                new Date(a.datetime) -
                new Date(b.datetime)
        );
}


/* =========================================================
   CACHED DATA LOADER
   ========================================================= */

async function getCachedCandles(
    key,
    interval,
    outputsize,
    force = false
) {

    const now =
        Date.now();


    const existing =
        marketData[key];


    const lastUpdated =
        marketDataUpdated[key] || 0;


    const age =
        now - lastUpdated;


    const fresh =
        existing &&
        existing.length > 0 &&
        age < DATA_TTL[key];


    if (
        !force &&
        fresh
    ) {

        return existing;
    }


    const candles =
        await getCandles(
            interval,
            outputsize
        );


    marketData[key] =
        candles;


    marketDataUpdated[key] =
        Date.now();


    return candles;
}


/* =========================================================
   TECHNICAL INDICATORS
   ========================================================= */

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


    const multiplier =
        2 / (period + 1);


    let ema =
        candles
            .slice(
                0,
                period
            )
            .reduce(
                (sum, c) =>
                    sum + c.close,
                0
            ) / period;


    for (
        let i = period;
        i < candles.length;
        i++
    ) {

        ema =
            (
                candles[i].close -
                ema
            ) *
            multiplier +
            ema;
    }


    return ema;
}


function calculateRSI(
    candles,
    period = 14
) {

    if (
        !candles ||
        candles.length <= period
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
            candles[i].close -
            candles[i - 1].close;


        if (
            change >= 0
        ) {

            gains += change;

        } else {

            losses +=
                Math.abs(change);
        }
    }


    let avgGain =
        gains / period;


    let avgLoss =
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
            Math.max(
                change,
                0
            );


        const loss =
            Math.max(
                -change,
                0
            );


        avgGain =
            (
                (
                    avgGain *
                    (period - 1)
                ) +
                gain
            ) / period;


        avgLoss =
            (
                (
                    avgLoss *
                    (period - 1)
                ) +
                loss
            ) / period;
    }


    if (
        avgLoss === 0
    ) {

        return 100;
    }


    const rs =
        avgGain /
        avgLoss;


    return 100 -
        (
            100 /
            (1 + rs)
        );
}


/* =========================================================
   TREND
   ========================================================= */

function getTrend(candles) {

    if (
        !candles ||
        candles.length < 50
    ) {

        return "--";
    }


    const ema20 =
        calculateEMA(
            candles,
            20
        );


    const ema50 =
        calculateEMA(
            candles,
            50
        );


    if (
        ema20 === null ||
        ema50 === null
    ) {

        return "--";
    }


    if (
        ema20 > ema50
    ) {

        return "BULLISH";
    }


    if (
        ema20 < ema50
    ) {

        return "BEARISH";
    }


    return "NEUTRAL";
}


/* =========================================================
   MARKET STRUCTURE
   ========================================================= */

function getStructure(candles) {

    if (
        !candles ||
        candles.length < 10
    ) {

        return "--";
    }


    const recent =
        candles.slice(-10);


    const highs =
        recent.map(
            c => c.high
        );


    const lows =
        recent.map(
            c => c.low
        );


    const firstHigh =
        Math.max(
            ...highs.slice(0, 5)
        );


    const lastHigh =
        Math.max(
            ...highs.slice(5)
        );


    const firstLow =
        Math.min(
            ...lows.slice(0, 5)
        );


    const lastLow =
        Math.min(
            ...lows.slice(5)
        );


    if (
        lastHigh > firstHigh &&
        lastLow > firstLow
    ) {

        return "BULLISH";
    }


    if (
        lastHigh < firstHigh &&
        lastLow < firstLow
    ) {

        return "BEARISH";
    }


    return "RANGE";
}


/* =========================================================
   SUPPORT / RESISTANCE
   ========================================================= */

function calculateSR(candles) {

    if (
        !candles ||
        candles.length < 20
    ) {

        return {

            r2: null,

            r1: null,

            s1: null,

            s2: null
        };
    }


    const recent =
        candles.slice(-20);


    const highs =
        recent.map(
            c => c.high
        );


    const lows =
        recent.map(
            c => c.low
        );


    const sortedHighs =
        [...highs].sort(
            (a, b) =>
                b - a
        );


    const sortedLows =
        [...lows].sort(
            (a, b) =>
                a - b
        );


    return {

        r2:
            sortedHighs[1] ||
            sortedHighs[0],

        r1:
            sortedHighs[0],

        s1:
            sortedLows[0],

        s2:
            sortedLows[1] ||
            sortedLows[0]
    };
}


/* =========================================================
   MOMENTUM
   ========================================================= */

function getMomentum(candles) {

    if (
        !candles ||
        candles.length < 3
    ) {

        return "WAIT";
    }


    const c1 =
        candles[
            candles.length - 2
        ];


    const c2 =
        candles[
            candles.length - 3
        ];


    const body =
        Math.abs(
            c1.close -
            c1.open
        );


    const range =
        c1.high -
        c1.low;


    if (
        range === 0
    ) {

        return "WAIT";
    }


    const bodyRatio =
        body / range;


    if (
        c1.close < c1.open &&
        c1.close < c2.close &&
        bodyRatio >= 0.55
    ) {

        return "BEARISH";
    }


    if (
        c1.close > c1.open &&
        c1.close > c2.close &&
        bodyRatio >= 0.55
    ) {

        return "BULLISH";
    }


    return "WAIT";
}


/* =========================================================
   RSI CONFIRMATION
   ========================================================= */

function rsiDirection(rsi) {

    if (
        rsi === null
    ) {

        return "WAIT";
    }


    if (
        rsi >= 50
    ) {

        return "BULLISH";
    }


    if (
        rsi < 50
    ) {

        return "BEARISH";
    }


    return "WAIT";
}


/* =========================================================
   EMA DIRECTION
   ========================================================= */

function getEMADirection(candles) {

    if (
        !candles ||
        candles.length < 50
    ) {

        return "WAIT";
    }


    const ema20 =
        calculateEMA(
            candles,
            20
        );


    const ema50 =
        calculateEMA(
            candles,
            50
        );


    if (
        ema20 === null ||
        ema50 === null
    ) {

        return "WAIT";
    }


    if (
        ema20 > ema50
    ) {

        return "BULLISH";
    }


    if (
        ema20 < ema50
    ) {

        return "BEARISH";
    }


    return "WAIT";
}


/* =========================================================
   SESSION
   ========================================================= */

function getSession() {

    const hour =
        Number(
            new Intl.DateTimeFormat(
                "en-IN",
                {
                    timeZone:
                        "Asia/Kolkata",

                    hour:
                        "2-digit",

                    hour12:
                        false
                }
            ).format(
                new Date()
            )
        );


    if (
        hour >= 12 &&
        hour < 22
    ) {

        return "ACTIVE";
    }


    return "OFF";
}


/* =========================================================
   MARKET PRICE
   ========================================================= */

function getLatestCompletedCandle(
    candles
) {

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


function getMarketPrice(
    candles
) {

    const candle =
        getLatestCompletedCandle(
            candles
        );


    if (!candle) {

        return null;
    }


    return candle.close;
}


/* =========================================================
   NEWS HELPERS
   ========================================================= */

/*
   Normalize different possible calendar formats.

   This allows our backend to return either:

   {
       currency: "USD",
       name: "Nonfarm Payrolls",
       impact: "high",
       datetime: "2026-10-02T12:30:00Z"
   }

   or similar common field names.
*/

function normalizeNewsEvent(
    raw
) {

    if (!raw) {

        return null;
    }


    const currency =
        String(
            raw.currency ||
            raw.country ||
            raw.ccy ||
            ""
        )
            .toUpperCase();


    if (
        currency !== "EUR" &&
        currency !== "USD"
    ) {

        return null;
    }


    const impact =
        String(
            raw.impact ||
            raw.importance ||
            raw.event_importance ||
            raw.priority ||
            ""
        )
            .toLowerCase();


    const eventTime =
        raw.datetime ||
        raw.dateTime ||
        raw.scheduledAt ||
        raw.announcement_datetime_utc ||
        raw.time ||
        raw.date;


    if (!eventTime) {

        return null;
    }


    const timestamp =
        new Date(eventTime)
            .getTime();


    if (
        !Number.isFinite(timestamp)
    ) {

        return null;
    }


    const name =
        String(
            raw.event ||
            raw.name ||
            raw.eventName ||
            raw.title ||
            raw.release ||
            "Economic event"
        );


    return {

        currency,

        name,

        impact,

        timestamp,

        datetime:
            new Date(timestamp),

        forecast:
            raw.forecast ??
            null,

        previous:
            raw.previous ??
            null,

        actual:
            raw.actual ??
            null
    };
}


/*
   High impact detector.

   We deliberately require explicit high-impact
   information. We do NOT guess an event's importance
   from its name.
*/

function isHighImpact(
    event
) {

    if (!event) {

        return false;
    }


    return (
        event.impact === "high" ||
        event.impact === "3" ||
        event.impact === "red"
    );
}


/*
   Return only future/recent high-impact events.
*/

function getRelevantNewsEvents() {

    const now =
        Date.now();


    const before =
        NEWS_BEFORE_MINUTES *
        60 *
        1000;


    const after =
        NEWS_AFTER_MINUTES *
        60 *
        1000;


    return newsData.events

        .filter(
            event =>
                isHighImpact(event) &&
                (
                    event.timestamp >=
                    now - after
                ) &&
                (
                    event.timestamp <=
                    now +
                    24 *
                    60 *
                    60 *
                    1000
                )
        )

        .sort(
            (a, b) =>
                a.timestamp -
                b.timestamp
        );
}


/*
   Determine whether EUR/USD trading should be
   blocked because of high-impact news.
*/

function getNewsRisk() {

    if (
        !newsData.available
    ) {

        return {

            status:
                "UNAVAILABLE",

            blocked:
                true,

            reason:
                "Live news calendar unavailable",

            event:
                null
        };
    }


    const now =
        Date.now();


    const before =
        NEWS_BEFORE_MINUTES *
        60 *
        1000;


    const after =
        NEWS_AFTER_MINUTES *
        60 *
        1000;


    const relevant =
        newsData.events
            .filter(
                event =>
                    isHighImpact(event)
            )
            .sort(
                (a, b) =>
                    a.timestamp -
                    b.timestamp
            );


    for (
        const event of relevant
    ) {

        const difference =
            event.timestamp -
            now;


        /*
           Event is approaching.
        */

        if (
            difference >= 0 &&
            difference <= before
        ) {

            return {

                status:
                    "BLOCKED",

                blocked:
                    true,

                reason:
                    `${event.currency} high-impact news within ${NEWS_BEFORE_MINUTES} minutes`,

                event
            };
        }


        /*
           Event has just released.
        */

        if (
            difference < 0 &&
            Math.abs(difference) <= after
        ) {

            return {

                status:
                    "BLOCKED",

                blocked:
                    true,

                reason:
                    `${event.currency} high-impact news just released`,

                event
            };
        }
    }


    return {

        status:
            "CLEAR",

        blocked:
            false,

        reason:
            "No high-impact EUR/USD event inside protection window",

        event:
            relevant.find(
                event =>
                    event.timestamp >
                    now
            ) || null
    };
}


/* =========================================================
   NEWS API LOADER
   ========================================================= */

async function loadNewsData() {

    /*
       No backend configured yet.

       Fail safely rather than inventing news.
    */

    if (
        !NEWS_API_URL
    ) {

        newsData = {

            available:
                false,

            events:
                [],

            lastUpdated:
                Date.now(),

            error:
                "NEWS_API_URL not configured"
        };


        displayNews();


        return;
    }


    if (
        newsLoading
    ) {

        return;
    }


    newsLoading =
        true;


    try {

        const response =
            await fetch(
                NEWS_API_URL,
                {
                    method:
                        "GET",

                    cache:
                        "no-store"
                }
            );


        if (
            !response.ok
        ) {

            throw new Error(
                `News API HTTP ${response.status}`
            );
        }


        const payload =
            await response.json();


        /*
           Accept several common response shapes.
        */

        let rawEvents =
            payload.events ||
            payload.data ||
            payload.results ||
            payload;


        if (
            !Array.isArray(rawEvents)
        ) {

            throw new Error(
                "News API returned no event array"
            );
        }


        const normalized =
            rawEvents

                .map(
                    normalizeNewsEvent
                )

                .filter(
                    Boolean
                );


        newsData = {

            available:
                true,

            events:
                normalized,

            lastUpdated:
                Date.now(),

            error:
                null
        };


        displayNews();

    } catch (error) {

        console.error(
            "News calendar error:",
            error
        );


        newsData = {

            available:
                false,

            events:
                [],

            lastUpdated:
                Date.now(),

            error:
                error.message
        };


        displayNews();

    } finally {

        newsLoading =
            false;
    }
}


/* =========================================================
   NEWS DISPLAY
   ========================================================= */

function formatNewsCountdown(
    timestamp
) {

    const difference =
        timestamp -
        Date.now();


    if (
        difference <= 0
    ) {

        return "NOW";
    }


    const totalMinutes =
        Math.floor(
            difference /
            60000
        );


    const hours =
        Math.floor(
            totalMinutes /
            60
        );


    const minutes =
        totalMinutes %
        60;


    if (
        hours > 0
    ) {

        return (
            `${hours}h ${minutes}m`
        );
    }


    return (
        `${minutes}m`
    );
}


function formatNewsTime(
    timestamp
) {

    return new Date(
        timestamp
    ).toLocaleString(
        "en-IN",
        {
            timeZone:
                "Asia/Kolkata",

            day:
                "2-digit",

            month:
                "short",

            hour:
                "2-digit",

            minute:
                "2-digit",

            hour12:
                true
        }
    ) + " IST";
}


function displayNews() {

    /*
       No live calendar available.
    */

    if (
        !newsData.available
    ) {

        setText(
            "eurNews",
            "EUR NEWS — UNAVAILABLE"
        );


        setText(
            "usdNews",
            "USD NEWS — UNAVAILABLE"
        );


        setText(
            "newsFilter",
            "NEWS FILTER — UNAVAILABLE"
        );


        setText(
            "nextEvent",
            "NEXT EVENT — --"
        );


        setText(
            "tradingRisk",
            "TRADING RISK — UNKNOWN"
        );


        setText(
            "checkNews",
            "— EUR/USD high-impact news clear"
        );


        return;
    }


    const events =
        getRelevantNewsEvents();


    const eurEvents =
        events.filter(
            e =>
                e.currency === "EUR"
        );


    const usdEvents =
        events.filter(
            e =>
                e.currency === "USD"
        );


    const risk =
        getNewsRisk();


    setText(
        "eurNews",

        eurEvents.length > 0

            ? `EUR NEWS — HIGH IMPACT (${eurEvents.length})`

            : "EUR NEWS — CLEAR"
    );


    setText(
        "usdNews",

        usdEvents.length > 0

            ? `USD NEWS — HIGH IMPACT (${usdEvents.length})`

            : "USD NEWS — CLEAR"
    );


    if (
        risk.blocked
    ) {

        setText(
            "newsFilter",
            "NEWS FILTER — BLOCKED"
        );


        setText(
            "tradingRisk",
            "TRADING RISK — HIGH"
        );


        setText(
            "checkNews",
            "— EUR/USD high-impact news clear"
        );

    } else {

        setText(
            "newsFilter",
            "NEWS FILTER — CLEAR"
        );


        setText(
            "tradingRisk",
            "TRADING RISK — NORMAL"
        );


        setText(
            "checkNews",
            "✓ EUR/USD high-impact news clear"
        );
    }


    const nextEvent =
        events.find(
            event =>
                event.timestamp >
                Date.now()
        );


    if (
        nextEvent
    ) {

        setText(
            "nextEvent",

            `NEXT EVENT — ${nextEvent.currency} ${nextEvent.name} — ${formatNewsCountdown(nextEvent.timestamp)}`
        );

    } else {

        setText(
            "nextEvent",
            "NEXT EVENT — None in next 24h"
        );
    }
}


/* =========================================================
   SNIPER SETUP
   ========================================================= */

function evaluateSniper(
    price,
    h4,
    h1,
    m15,
    m5
) {

    const h4Trend =
        getTrend(h4);


    const h1Trend =
        getTrend(h1);


    const m15Structure =
        getStructure(m15);


    const m5Structure =
        getStructure(m5);


    const ema =
        getEMADirection(m5);


    const momentum =
        getMomentum(m5);


    const rsi =
        calculateRSI(m5);


    let direction =
        null;


    if (
        h4Trend === "BEARISH" &&
        h1Trend === "BEARISH" &&
        m15Structure === "BEARISH" &&
        m5Structure === "BEARISH" &&
        ema === "BEARISH" &&
        momentum === "BEARISH" &&
        rsi !== null &&
        rsi < 50
    ) {

        direction =
            "SELL";
    }


    if (
        h4Trend === "BULLISH" &&
        h1Trend === "BULLISH" &&
        m15Structure === "BULLISH" &&
        m5Structure === "BULLISH" &&
        ema === "BULLISH" &&
        momentum === "BULLISH" &&
        rsi !== null &&
        rsi >= 50
    ) {

        direction =
            "BUY";
    }


    if (!direction) {

        invalidateSniperSetup();


        return {

            status:
                "WAIT",

            direction:
                "--",

            entry:
                "--",

            sl:
                "--",

            tp1:
                "--",

            tp2:
                "--",

            tp3:
                "--",

            rr:
                "--",

            validity:
                "NO A+ SETUP",

            trigger:
                momentum,

            invalidation:
                "Alignment or momentum missing",

            score:
                0
        };
    }


    const entry =
        price;


    const riskPips =
        10;


    let sl;

    let tp1;

    let tp2;

    let tp3;


    if (
        direction === "SELL"
    ) {

        sl =
            entry +
            riskPips *
            pipSize();


        tp1 =
            entry -
            riskPips *
            2 *
            pipSize();


        tp2 =
            entry -
            riskPips *
            3 *
            pipSize();


        tp3 =
            entry -
            riskPips *
            4 *
            pipSize();

    } else {

        sl =
            entry -
            riskPips *
            pipSize();


        tp1 =
            entry +
            riskPips *
            2 *
            pipSize();


        tp2 =
            entry +
            riskPips *
            3 *
            pipSize();


        tp3 =
            entry +
            riskPips *
            4 *
            pipSize();
    }


    const score =
        90;


    startSniperSetup();


    return {

        status:
            "A+ SETUP",

        direction,

        entry,

        sl,

        tp1,

        tp2,

        tp3,

        rr:
            "1:2 / 1:3 / 1:4",

        validity:
            "VALID",

        trigger:
            direction === "SELL"

                ? "Bearish M5 momentum confirmed"

                : "Bullish M5 momentum confirmed",

        invalidation:
            direction === "SELL"

                ? "M5 closes bullish / alignment breaks"

                : "M5 closes bearish / alignment breaks",

        score
    };
}


/* =========================================================
   DISPLAY SNIPER
   ========================================================= */

function displaySniper(
    setup
) {

    setText(
        "sniperStatus",
        setup.status
    );


    setText(
        "sniperStatusBig",
        setup.status
    );


    setText(
        "sniperDirection",
        setup.direction
    );


    setText(
        "sniperEntry",
        formatPrice(
            setup.entry
        )
    );


    setText(
        "sniperSL",
        formatPrice(
            setup.sl
        )
    );


    setText(
        "sniperTP1",
        formatPrice(
            setup.tp1
        )
    );


    setText(
        "sniperTP2",
        formatPrice(
            setup.tp2
        )
    );


    setText(
        "sniperTP3",
        formatPrice(
            setup.tp3
        )
    );


    setText(
        "sniperRR",
        setup.rr
    );


    setText(
        "sniperValidity",
        setup.validity
    );


    setText(
        "sniperTrigger",
        setup.trigger
    );


    setText(
        "sniperInvalidation",
        setup.invalidation
    );


    setText(
        "setupTime",

        sniperSetupActive
            ? sniperSetupTime
            : "--"
    );


    setText(
        "setupScore",

        setup.score

            ? setup.score +
              "/100"

            : "--"
    );
}


/* =========================================================
   ELITE SCALP
   ========================================================= */

function evaluateScalp(
    price,
    h1,
    m15,
    m5
) {

    const h1Trend =
        getTrend(h1);


    const m15Structure =
        getStructure(m15);


    const m5Structure =
        getStructure(m5);


    const momentum =
        getMomentum(m5);


    const ema =
        getEMADirection(m5);


    if (
        h1Trend === "BEARISH" &&
        m15Structure === "BEARISH" &&
        m5Structure === "BEARISH" &&
        ema === "BEARISH" &&
        momentum === "BEARISH"
    ) {

        const entry =
            price;


        return {

            verdict:
                "A+ SCALP",

            direction:
                "SELL",

            entry,

            sl:
                entry + 0.0007,

            tp1:
                entry - 0.0014,

            tp2:
                entry - 0.0021,

            rr:
                "1:2 / 1:3",

            score:
                90,

            validity:
                "VALID",

            trigger:
                "M5 bearish momentum",

            invalidation:
                "M5 bullish close"
        };
    }


    if (
        h1Trend === "BULLISH" &&
        m15Structure === "BULLISH" &&
        m5Structure === "BULLISH" &&
        ema === "BULLISH" &&
        momentum === "BULLISH"
    ) {

        const entry =
            price;


        return {

            verdict:
                "A+ SCALP",

            direction:
                "BUY",

            entry,

            sl:
                entry - 0.0007,

            tp1:
                entry + 0.0014,

            tp2:
                entry + 0.0021,

            rr:
                "1:2 / 1:3",

            score:
                90,

            validity:
                "VALID",

            trigger:
                "M5 bullish momentum",

            invalidation:
                "M5 bearish close"
        };
    }


    return {

        verdict:
            "WAIT",

        direction:
            "--",

        entry:
            "--",

        sl:
            "--",

        tp1:
            "--",

        tp2:
            "--",

        rr:
            "--",

        score:
            "--",

        validity:
            "NO SETUP",

        trigger:
            momentum,

        invalidation:
            "Confirmation missing"
    };
}


function displayScalp(
    setup
) {

    setText(
        "scalpVerdict",
        setup.verdict
    );


    setText(
        "scalpDirection",
        setup.direction
    );


    setText(
        "scalpEntry",
        formatPrice(
            setup.entry
        )
    );


    setText(
        "scalpSL",
        formatPrice(
            setup.sl
        )
    );


    setText(
        "scalpTP1",
        formatPrice(
            setup.tp1
        )
    );


    setText(
        "scalpTP2",
        formatPrice(
            setup.tp2
        )
    );


    setText(
        "scalpRR",
        setup.rr
    );


    setText(
        "scalpScore",
        setup.score
    );


    setText(
        "scalpValidity",
        setup.validity
    );


    setText(
        "scalpTrigger",
        setup.trigger
    );


    setText(
        "scalpInvalidation",
        setup.invalidation
    );
}


/* =========================================================
   ELITE TRADE GATE
   ========================================================= */

function evaluateTradeGate(
    price,
    h4,
    h1,
    m15,
    m5
) {

    const session =
        getSession();


    const h4Trend =
        getTrend(h4);


    const h1Trend =
        getTrend(h1);


    const m15Structure =
        getStructure(m15);


    const m5Structure =
        getStructure(m5);


    const ema =
        getEMADirection(m5);


    const momentum =
        getMomentum(m5);


    const rsi =
        calculateRSI(m5);


    let direction =
        "--";


    if (
        h4Trend === "BEARISH" &&
        h1Trend === "BEARISH" &&
        m15Structure === "BEARISH" &&
        m5Structure === "BEARISH"
    ) {

        direction =
            "SELL";
    }


    if (
        h4Trend === "BULLISH" &&
        h1Trend === "BULLISH" &&
        m15Structure === "BULLISH" &&
        m5Structure === "BULLISH"
    ) {

        direction =
            "BUY";
    }


    const allAligned =
        direction !== "--";


    const momentumOK =
        direction === "SELL"

            ? momentum === "BEARISH"

            : direction === "BUY"

                ? momentum === "BULLISH"

                : false;


    const rsiOK =
        direction === "SELL"

            ? rsi !== null &&
              rsi < 50

            : direction === "BUY"

                ? rsi !== null &&
                  rsi >= 50

                : false;


    /*
       =====================================================
       NEWS GATE
       =====================================================

       IMPORTANT:

       If the calendar is unavailable we do NOT allow
       the dashboard to claim that news is clear.

       This is intentionally conservative.
    */

    const newsRisk =
        getNewsRisk();


    const newsOK =
        newsRisk.available !== false &&
        newsRisk.blocked === false;


    const gateOK =
        session === "ACTIVE" &&
        allAligned &&
        ema ===
            (
                direction === "SELL"
                    ? "BEARISH"
                    : direction === "BUY"
                        ? "BULLISH"
                        : "WAIT"
            ) &&
        rsiOK &&
        momentumOK &&
        newsOK;


    if (!gateOK) {

        setText(
            "eliteTradeGate",
            "STAY AWAY"
        );


        let reason =
            "Required confirmation not complete";


        if (
            !newsRisk.available
        ) {

            reason =
                "Live news confirmation unavailable";

        } else if (
            newsRisk.blocked
        ) {

            reason =
                newsRisk.reason;
        }


        setText(
            "gateReason",
            reason
        );


        setText(
            "gateSession",
            session
        );


        setText(
            "gateDirection",
            direction
        );


        setText(
            "gateEntry",
            "--"
        );


        setText(
            "gateSL",
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
            "--"
        );


        return;
    }


    setText(
        "eliteTradeGate",
        "A+ TRADE READY"
    );


    setText(
        "gateReason",
        "All primary confirmations aligned and news clear"
    );


    setText(
        "gateSession",
        session
    );


    setText(
        "gateDirection",
        direction
    );


    setText(
        "gateEntry",
        formatPrice(price)
    );


    const sl =
        direction === "SELL"

            ? price + 0.001

            : price - 0.001;


    const tp1 =
        direction === "SELL"

            ? price - 0.002

            : price + 0.002;


    const tp2 =
        direction === "SELL"

            ? price - 0.003

            : price + 0.003;


    setText(
        "gateSL",
        formatPrice(sl)
    );


    setText(
        "gateTP1",
        formatPrice(tp1)
    );


    setText(
        "gateTP2",
        formatPrice(tp2)
    );


    setText(
        "gateRR",
        "1:2 / 1:3"
    );


    setText(
        "gateRisk",
        "10 pips"
    );
}


/* =========================================================
   CHECKLIST
   ========================================================= */

function displayChecklist(
    h4,
    h1,
    m15,
    m5
) {

    const h4Trend =
        getTrend(h4);


    const h1Trend =
        getTrend(h1);


    const m15Structure =
        getStructure(m15);


    const m5Structure =
        getStructure(m5);


    const ema =
        getEMADirection(m5);


    const rsi =
        calculateRSI(m5);


    const momentum =
        getMomentum(m5);


    const direction =
        h4Trend === "BULLISH" &&
        h1Trend === "BULLISH"

            ? "BULLISH"

            :

        h4Trend === "BEARISH" &&
        h1Trend === "BEARISH"

            ? "BEARISH"

            : "--";


    setText(
        "checkSession",

        getSession() === "ACTIVE"

            ? "✓ Active London / New York session"

            : "— Active London / New York session"
    );


    setText(
        "checkHtf",

        direction !== "--"

            ? "✓ H4 + H1 directional alignment"

            : "— H4 + H1 directional alignment"
    );


    setText(
        "checkM15",

        m15Structure === direction

            ? "✓ M15 confirmation"

            : "— M15 confirmation"
    );


    setText(
        "checkM5",

        m5Structure === direction

            ? "✓ M5 confirmation"

            : "— M5 confirmation"
    );


    setText(
        "checkEMA",

        ema === direction

            ? "✓ M5 EMA20 / EMA50 alignment"

            : "— M5 EMA20 / EMA50 alignment"
    );


    const rsiConfirmed =
        direction === "BEARISH"

            ? rsi !== null &&
              rsi < 50

            : direction === "BULLISH"

                ? rsi !== null &&
                  rsi >= 50

                : false;


    setText(
        "checkRSI",

        rsiConfirmed

            ? "✓ M5 RSI confirmation"

            : "— M5 RSI confirmation"
    );


    setText(
        "checkMomentum",

        momentum === direction

            ? "✓ Completed M5 momentum candle"

            : "— Completed M5 momentum candle"
    );


    setText(
        "checkExtension",
        "— No excessive EMA extension"
    );


    setText(
        "checkRisk",
        "✓ 3–15 pip structural risk"
    );


    setText(
        "checkRR",
        "✓ Minimum 1:2 Risk / Reward"
    );


    /*
       S/R remains unchanged from your current engine.
    */

    setText(
        "checkSR",
        "— Higher-timeframe S/R does not block TP2"
    );
}


/* =========================================================
   TECHNICAL DISPLAY
   ========================================================= */

function displayTechnicalData(
    price,
    h4,
    h1,
    m15,
    m5
) {

    const h4Trend =
        getTrend(h4);


    const h1Trend =
        getTrend(h1);


    const m15Structure =
        getStructure(m15);


    const m5Structure =
        getStructure(m5);


    const h4RSI =
        calculateRSI(h4);


    const h1RSI =
        calculateRSI(h1);


    const m15RSI =
        calculateRSI(m15);


    const m5RSI =
        calculateRSI(m5);


    const ema =
        getEMADirection(m5);


    const sr =
        calculateSR(h1);


    setText(
        "livePrice",
        formatPrice(price)
    );


    setText(
        "dataStatus",
        "● LIVE"
    );


    setText(
        "h4Bias",
        h4Trend
    );


    setText(
        "h1Bias",
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


    setText(
        "h4Trend",
        h4Trend
    );


    setText(
        "h1Trend",
        h1Trend
    );


    setText(
        "emaStructure",
        ema
    );


    setText(
        "emaStructure2",
        ema
    );


    setText(
        "r2",
        formatPrice(sr.r2)
    );


    setText(
        "r1",
        formatPrice(sr.r1)
    );


    setText(
        "s1",
        formatPrice(sr.s1)
    );


    setText(
        "s2",
        formatPrice(sr.s2)
    );


    setText(
        "h4Rsi",
        formatNumber(h4RSI)
    );


    setText(
        "h1Rsi",
        formatNumber(h1RSI)
    );


    setText(
        "m15Rsi",
        formatNumber(m15RSI)
    );


    setText(
        "m5Rsi",
        formatNumber(m5RSI)
    );
}


/* =========================================================
   ERROR DISPLAY
   ========================================================= */

function displayDataError(
    error
) {

    console.error(
        "EUR/USD Dashboard Error:",
        error
    );


    setText(
        "dataStatus",
        "● DATA LOAD FAILED"
    );


    setText(
        "eliteTradeGate",
        "STAY AWAY"
    );


    setText(
        "gateReason",
        error.message
    );


    setText(
        "gateSession",
        getSession()
    );


    setText(
        "gateDirection",
        "--"
    );


    setText(
        "gateEntry",
        "--"
    );


    setText(
        "gateSL",
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
        "--"
    );


    invalidateSniperSetup();
}


/* =========================================================
   MARKET DATA LOAD
   ========================================================= */

async function loadMarketData() {

    if (
        marketDataLoading
    ) {

        return;
    }


    marketDataLoading =
        true;


    setText(
        "dataStatus",
        "● LOADING"
    );


    try {

        /*
           =====================================================
           LOAD NEWS
           =====================================================
        */

        await loadNewsData();


        /*
           =====================================================
           H4
           =====================================================
        */

        const h4 =
            await getCachedCandles(
                "h4",
                "4h",
                100
            );


        /*
           =====================================================
           H1
           =====================================================
        */

        const h1 =
            await getCachedCandles(
                "h1",
                "1h",
                100
            );


        /*
           =====================================================
           M15
           =====================================================
        */

        const m15 =
            await getCachedCandles(
                "m15",
                "15min",
                100
            );


        /*
           =====================================================
           M5
           =====================================================
        */

        const m5 =
            await getCachedCandles(
                "m5",
                "5min",
                100
            );


        /*
           =====================================================
           VALIDATE DATA
           =====================================================
        */

        if (
            !h4 ||
            !h1 ||
            !m15 ||
            !m5
        ) {

            throw new Error(
                "Incomplete market data"
            );
        }


        const price =
            getMarketPrice(m5);


        if (
            price === null
        ) {

            throw new Error(
                "Unable to determine EUR/USD market price"
            );
        }


        /*
           =====================================================
           TECHNICAL DATA
           =====================================================
        */

        displayTechnicalData(
            price,
            h4,
            h1,
            m15,
            m5
        );


        /*
           =====================================================
           SNIPER
           =====================================================
        */

        const sniper =
            evaluateSniper(
                price,
                h4,
                h1,
                m15,
                m5
            );


        displaySniper(
            sniper
        );


        /*
           =====================================================
           SCALP
           =====================================================
        */

        const scalp =
            evaluateScalp(
                price,
                h1,
                m15,
                m5
            );


        displayScalp(
            scalp
        );


        /*
           =====================================================
           ELITE TRADE GATE
           =====================================================
        */

        evaluateTradeGate(
            price,
            h4,
            h1,
            m15,
            m5
        );


        /*
           =====================================================
           CHECKLIST
           =====================================================
        */

        displayChecklist(
            h4,
            h1,
            m15,
            m5
        );


        /*
           =====================================================
           NEWS DISPLAY
           =====================================================
        */

        displayNews();


        /*
           =====================================================
           PRO VERDICT
           =====================================================
        */

        setText(
            "proVerdict",

            sniper.status ===
                "A+ SETUP"

                ? "A+ SETUP"

                : "WAIT"
        );


        /*
           =====================================================
           DATA SUCCESS
           =====================================================
        */

        setText(
            "dataStatus",
            "● LIVE"
        );

    } catch (error) {

        displayDataError(
            error
        );

    } finally {

        marketDataLoading =
            false;
    }
}


/* =========================================================
   MANUAL REFRESH
   ========================================================= */

function manualRefresh() {

    if (
        marketDataLoading
    ) {

        return;
    }


    loadMarketData();
}


/* =========================================================
   START DASHBOARD
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        /*
           Load market data.
        */

        loadMarketData();


        /*
           Market data refresh:
           every 5 minutes.
        */

        setInterval(
            loadMarketData,
            REFRESH_INTERVAL
        );


        /*
           News display refresh:
           every 15 minutes.

           Once NEWS_API_URL is connected,
           this will update the calendar without
           unnecessarily hitting Twelve Data.
        */

        setInterval(
            async () => {

                await loadNewsData();

                displayNews();

            },
            NEWS_REFRESH_INTERVAL
        );


        /*
           Update countdown / news status
           every 30 seconds.
        */

        setInterval(
            () => {

                if (
                    newsData.available
                ) {

                    displayNews();
                }

            },
            30000
        );
    }
);
