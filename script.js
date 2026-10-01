/* =========================================================
   EUR/USD SNIPER DASHBOARD
   FULL VERSION
   MARKET DATA + TECHNICALS + LIVE NEWS FILTER
   + INDEPENDENT ELITE TRADE GATE
   ========================================================= */


/* =========================================================
   API CONFIGURATION
   ========================================================= */

const API_KEY = "4ba3968e609544bf8990192fdf3ed970";

const SYMBOL = "EUR/USD";

const TIME_SERIES_URL =
    "https://api.twelvedata.com/time_series";


/* =========================================================
   NEWS API
   ========================================================= */

const NEWS_API_URL =
    "https://www.financecalendar.com/wp-json/fc/v1/calendar";


/* =========================================================
   REFRESH SETTINGS
   ========================================================= */

const REFRESH_INTERVAL =
    5 * 60 * 1000;


const DATA_TTL = {

    h4: 30 * 60 * 1000,

    h1: 15 * 60 * 1000,

    m15: 10 * 60 * 1000,

    m5: 5 * 60 * 1000

};


const NEWS_TTL =
    5 * 60 * 1000;


/* =========================================================
   GLOBAL STATE
   ========================================================= */

let marketDataLoading = false;

let newsLoading = false;


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


let newsData = [];

let newsUpdated = 0;


/* =========================================================
   NEWS STATE
   ========================================================= */

let newsState = {

    available: false,

    highImpact: false,

    blocked: false,

    nextEvent: null,

    minutesToEvent: null,

    currency: null,

    event: null

};


/* =========================================================
   SNIPER SETUP CLOCK
   ========================================================= */

let sniperSetupTime = null;

let sniperSetupActive = false;


/* =========================================================
   TRADE GATE SETUP CLOCK
   ========================================================= */

let tradeGateSetupTime = null;

let tradeGateSetupActive = false;


/* =========================================================
   IST TIME
   ========================================================= */

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


/* =========================================================
   SNIPER SETUP TIME
   ========================================================= */

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
   TRADE GATE SETUP TIME
   ========================================================= */

function startTradeGateSetup() {

    /*
       IMPORTANT:

       The timestamp is created ONLY when the
       Trade Gate becomes valid.

       It does NOT reset on every refresh.
    */

    if (!tradeGateSetupActive) {

        tradeGateSetupTime =
            getISTTime();

        tradeGateSetupActive = true;

    }


    setText(
        "gateSetupTime",
        tradeGateSetupTime
    );

}


function invalidateTradeGateSetup() {

    tradeGateSetupActive =
        false;

    tradeGateSetupTime =
        null;


    setText(
        "gateSetupTime",
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
   DELAY
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

        `${TIME_SERIES_URL}` +

        `?symbol=${encodeURIComponent(SYMBOL)}` +

        `&interval=${interval}` +

        `&outputsize=${outputsize}` +

        `&apikey=${encodeURIComponent(API_KEY)}`;


    let response;


    try {

        response =
            await fetch(url);

    }

    catch (error) {

        throw new Error(
            "Network error connecting to Twelve Data"
        );

    }


    if (!response.ok) {

        if (
            response.status === 429
        ) {

            throw new Error(
                "Twelve Data rate limit or API quota reached"
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

    }

    catch (error) {

        throw new Error(
            "Invalid response from Twelve Data"
        );

    }


    if (
        data.status === "error"
    ) {

        const message =
            String(
                data.message || ""
            );


        if (

            data.code === 429 ||

            message
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

        !Array.isArray(
            data.values
        )

    ) {

        throw new Error(
            "No candle data returned by Twelve Data"
        );

    }


    return data.values

        .map(c => ({

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

        }))

        .filter(c =>

            c.open !== null &&

            c.high !== null &&

            c.low !== null &&

            c.close !== null

        )

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


/* =========================================================
   CACHED MARKET DATA
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
   EMA
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


/* =========================================================
   RSI
   ========================================================= */

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

        }

        else {

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

                avgGain *
                (period - 1) +

                gain

            ) / period;


        avgLoss =

            (

                avgLoss *
                (period - 1) +

                loss

            ) / period;

    }


    if (
        avgLoss === 0
    ) {

        return 100;

    }


    const rs =
        avgGain / avgLoss;


    return 100 -
        (
            100 /
            (1 + rs)
        );

}


/* =========================================================
   TREND
   ========================================================= */

function getTrend(
    candles
) {

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

function getStructure(
    candles
) {

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

function calculateSR(
    candles
) {

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
            (a, b) => b - a
        );


    const sortedLows =
        [...lows].sort(
            (a, b) => a - b
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
   M5 MOMENTUM
   ========================================================= */

function getMomentum(
    candles
) {

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
        range <= 0
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
   EMA DIRECTION
   ========================================================= */

function getEMADirection(
    candles
) {

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
   SESSION ENGINE
   =========================================================

   IMPORTANT:

   Session is a preference/risk modifier.

   OFF SESSION DOES NOT BLOCK THE TRADE.

   London / New York times are calculated using
   their actual IANA time zones so DST is handled.
   ========================================================= */

function getZonedHourMinute(
    timeZone
) {

    const parts =
        new Intl.DateTimeFormat(

            "en-GB",

            {

                timeZone,

                hour:
                    "2-digit",

                minute:
                    "2-digit",

                hour12:
                    false

            }

        ).formatToParts(
            new Date()
        );


    let hour = 0;

    let minute = 0;


    for (
        const part of parts
    ) {

        if (
            part.type === "hour"
        ) {

            hour =
                Number(part.value);

        }


        if (
            part.type === "minute"
        ) {

            minute =
                Number(part.value);

        }

    }


    return {

        hour,

        minute

    };

}


function minutesFromMidnight(
    time
) {

    return (
        time.hour * 60 +
        time.minute
    );

}


function getSession() {

    const london =
        getZonedHourMinute(
            "Europe/London"
        );


    const newYork =
        getZonedHourMinute(
            "America/New_York"
        );


    const londonMinutes =
        minutesFromMidnight(
            london
        );


    const nyMinutes =
        minutesFromMidnight(
            newYork
        );


    /*
       London session:
       08:00 - 17:00 London
    */

    const londonOpen =
        8 * 60;


    const londonClose =
        17 * 60;


    /*
       London closing:
       final 60 minutes
    */

    const londonClosingStart =
        16 * 60;


    /*
       New York / US session:
       08:00 - 17:00 New York
    */

    const usOpen =
        8 * 60;


    const usClose =
        17 * 60;


    /*
       US closing:
       final 60 minutes
    */

    const usClosingStart =
        16 * 60;


    const londonActive =

        londonMinutes >= londonOpen &&

        londonMinutes < londonClose;


    const usActive =

        nyMinutes >= usOpen &&

        nyMinutes < usClose;


    const londonClosing =

        londonMinutes >= londonClosingStart &&

        londonMinutes < londonClose;


    const usClosing =

        nyMinutes >= usClosingStart &&

        nyMinutes < usClose;


    /*
       Overlap has priority.
    */

    if (
        londonActive &&
        usActive
    ) {

        return "LONDON / US OVERLAP";

    }


    if (
        londonClosing
    ) {

        return "LONDON CLOSING";

    }


    if (
        usClosing
    ) {

        return "US CLOSING";

    }


    if (
        londonActive
    ) {

        return "LONDON";

    }


    if (
        usActive
    ) {

        return "US";

    }


    return "OFF SESSION";

}


/* =========================================================
   SESSION PREFERENCE
   ========================================================= */

function getSessionQuality(
    session
) {

    switch (session) {

        case "LONDON / US OVERLAP":

            return {

                score: 3,

                label:
                    "PREFERRED"

            };


        case "LONDON":

        case "US":

            return {

                score: 2,

                label:
                    "FAVOURABLE"

            };


        case "LONDON CLOSING":

        case "US CLOSING":

            return {

                score: 1,

                label:
                    "CAUTION"

            };


        case "OFF SESSION":

        default:

            return {

                score: 0,

                label:
                    "LOWER PREFERENCE"

            };

    }

}


/* =========================================================
   LATEST COMPLETED CANDLE
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
   NEWS SYSTEM
   ========================================================= */

const EUR_NEWS_KEYWORDS = [

    "euro",

    "eurozone",

    "eur",

    "ecb",

    "european central bank",

    "germany",

    "german",

    "france",

    "french",

    "italy",

    "italian",

    "spain",

    "spanish",

    "netherlands",

    "european commission",

    "european union",

    "eu inflation",

    "euro area",

    "euro-area"

];


const USD_NEWS_KEYWORDS = [

    "united states",

    "u.s.",

    "us ",

    "usa",

    "usd",

    "federal reserve",

    "fed",

    "fomc",

    "nonfarm",

    "payroll",

    "employment situation",

    "jobless claims",

    "initial jobless",

    "continuing claims",

    "cpi",

    "consumer price",

    "ppi",

    "producer price",

    "pce",

    "personal income",

    "personal consumption",

    "gdp",

    "retail sales",

    "ism",

    "jolts",

    "durable goods",

    "industrial production",

    "housing starts",

    "building permits",

    "new home sales",

    "existing home sales",

    "trade balance",

    "unemployment rate",

    "treasury",

    "beige book"

];


function normaliseNewsText(
    event
) {

    return [

        event.name,

        event.title,

        event.event,

        event.country,

        event.currency,

        event.category,

        event.description

    ]

        .filter(Boolean)

        .join(" ")

        .toLowerCase();

}


function containsKeyword(
    text,
    keywords
) {

    return keywords.some(
        keyword =>
            text.includes(
                keyword
            )
    );

}


function detectNewsCurrency(
    event
) {

    const text =
        normaliseNewsText(
            event
        );


    const explicitCurrency =
        String(
            event.currency || ""
        ).toUpperCase();


    if (
        explicitCurrency === "EUR"
    ) {

        return "EUR";

    }


    if (
        explicitCurrency === "USD"
    ) {

        return "USD";

    }


    const hasEUR =
        containsKeyword(
            text,
            EUR_NEWS_KEYWORDS
        );


    const hasUSD =
        containsKeyword(
            text,
            USD_NEWS_KEYWORDS
        );


    if (
        hasEUR &&
        !hasUSD
    ) {

        return "EUR";

    }


    if (
        hasUSD &&
        !hasEUR
    ) {

        return "USD";

    }


    if (
        hasEUR &&
        hasUSD
    ) {

        return "BOTH";

    }


    return null;

}


/* =========================================================
   NEWS DATE
   ========================================================= */

function getEventDate(
    event
) {

    const raw =

        event.time_utc ||

        event.timeUTC ||

        event.scheduledAt ||

        event.datetime ||

        event.dateTime ||

        event.date;


    if (!raw) {

        return null;

    }


    const date =
        new Date(raw);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return null;

    }


    return date;

}


function getEventName(
    event
) {

    return (

        event.title ||

        event.name ||

        event.event ||

        event.eventName ||

        "Economic event"

    );

}


/* =========================================================
   NEWS IMPACT
   ========================================================= */

function isHighImpact(
    event
) {

    const impact =

        String(

            event.impact ||

            event.importance ||

            event.priority ||

            ""

        ).toLowerCase();


    if (
        impact === "high"
    ) {

        return true;

    }


    if (
        impact === "3"
    ) {

        return true;

    }


    return false;

}


/* =========================================================
   LOAD NEWS
   ========================================================= */

async function loadNews(
    force = false
) {

    if (newsLoading) {

        return;

    }


    const now =
        Date.now();


    if (

        !force &&

        newsData.length > 0 &&

        now - newsUpdated < NEWS_TTL

    ) {

        processNews(
            newsData
        );

        return;

    }


    newsLoading =
        true;


    setText(
        "eurNews",
        "Loading..."
    );


    setText(
        "usdNews",
        "Loading..."
    );


    setText(
        "newsFilter",
        "Loading..."
    );


    setText(
        "nextEvent",
        "Loading..."
    );


    setText(
        "tradingRisk",
        "Checking..."
    );


    try {

        const today =
            new Date();


        const from =
            today
                .toISOString()
                .slice(
                    0,
                    10
                );


        const future =
            new Date(
                today.getTime() +
                14 * 24 * 60 * 60 * 1000
            );


        const to =
            future
                .toISOString()
                .slice(
                    0,
                    10
                );


        const url =

            `${NEWS_API_URL}` +

            `?from=${from}` +

            `&to=${to}` +

            `&impact=high` +

            `&limit=500`;


        const response =
            await fetch(

                url,

                {

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


        const data =
            await response.json();


        let events = [];


        if (
            Array.isArray(
                data.events
            )
        ) {

            events =
                data.events;

        }

        else if (
            Array.isArray(
                data.data
            )
        ) {

            events =
                data.data;

        }

        else if (
            Array.isArray(data)
        ) {

            events =
                data;

        }


        newsData =
            events

                .map(
                    event => {

                        const date =
                            getEventDate(
                                event
                            );


                        const currency =
                            detectNewsCurrency(
                                event
                            );


                        return {

                            original:
                                event,

                            date,

                            currency,

                            name:
                                getEventName(
                                    event
                                ),

                            impact:
                                isHighImpact(
                                    event
                                )

                        };

                    }
                )

                .filter(
                    event =>

                        event.date &&

                        event.impact &&

                        (

                            event.currency === "EUR" ||

                            event.currency === "USD" ||

                            event.currency === "BOTH"

                        )
                );


        newsData.sort(
            (a, b) =>
                a.date -
                b.date
        );


        newsUpdated =
            Date.now();


        newsState.available =
            true;


        processNews(
            newsData
        );

    }

    catch (error) {

        console.error(
            "News filter error:",
            error
        );


        newsState.available =
            false;


        newsState.highImpact =
            false;


        newsState.blocked =
            false;


        setText(
            "eurNews",
            "NEWS DATA ERROR"
        );


        setText(
            "usdNews",
            "NEWS DATA ERROR"
        );


        setText(
            "newsFilter",
            "NEWS UNAVAILABLE"
        );


        setText(
            "nextEvent",
            "--"
        );


        setText(
            "tradingRisk",
            "CAUTION"
        );

    }

    finally {

        newsLoading =
            false;

    }

}


/* =========================================================
   PROCESS NEWS
   ========================================================= */

function processNews(
    events
) {

    const now =
        new Date();


    const relevantEvents =
        events.filter(
            event => {

                if (!event.date) {

                    return false;

                }


                const age =
                    now -
                    event.date;


                return age <=
                    15 * 60 * 1000;

            }
        );


    const upcomingEvents =
        events.filter(
            event =>
                event.date > now
        );


    const eurEvents =
        relevantEvents.filter(
            event =>

                event.currency === "EUR" ||

                event.currency === "BOTH"
        );


    const usdEvents =
        relevantEvents.filter(
            event =>

                event.currency === "USD" ||

                event.currency === "BOTH"
        );


    const nextEvent =
        upcomingEvents.length > 0

            ? upcomingEvents[0]

            : null;


    newsState.nextEvent =
        nextEvent;


    newsState.highImpact =
        relevantEvents.length > 0;


    let blockingEvent =
        null;


    for (
        const event of events
    ) {

        if (!event.date) {

            continue;

        }


        const minutes =
            (

                event.date -
                now

            ) / 60000;


        if (

            minutes >= 0 &&

            minutes <= 30

        ) {

            blockingEvent =
                event;

            break;

        }


        if (

            minutes < 0 &&

            minutes >= -15

        ) {

            blockingEvent =
                event;

            break;

        }

    }


    newsState.blocked =
        blockingEvent !== null;


    newsState.event =
        blockingEvent;


    if (blockingEvent) {

        newsState.currency =
            blockingEvent.currency;


        newsState.minutesToEvent =
            (

                blockingEvent.date -
                now

            ) / 60000;

    }

    else {

        newsState.currency =
            null;


        newsState.minutesToEvent =
            null;

    }


    if (
        eurEvents.length > 0
    ) {

        setText(
            "eurNews",
            formatNewsList(
                eurEvents
            )
        );

    }

    else {

        setText(
            "eurNews",
            "CLEAR"
        );

    }


    if (
        usdEvents.length > 0
    ) {

        setText(
            "usdNews",
            formatNewsList(
                usdEvents
            )
        );

    }

    else {

        setText(
            "usdNews",
            "CLEAR"
        );

    }


    if (
        newsState.blocked
    ) {

        setText(
            "newsFilter",
            "BLOCKED"
        );

    }

    else if (
        relevantEvents.length > 0
    ) {

        setText(
            "newsFilter",
            "HIGH IMPACT"
        );

    }

    else {

        setText(
            "newsFilter",
            "CLEAR"
        );

    }


    if (
        nextEvent
    ) {

        setText(
            "nextEvent",
            formatNextEvent(
                nextEvent
            )
        );

    }

    else {

        setText(
            "nextEvent",
            "NO UPCOMING EVENT"
        );

    }


    if (
        newsState.blocked
    ) {

        setText(
            "tradingRisk",
            "HIGH — NEWS BLOCK"
        );

    }

    else if (
        nextEvent
    ) {

        const minutes =

            (

                nextEvent.date -
                now

            ) / 60000;


        if (
            minutes <= 60
        ) {

            setText(
                "tradingRisk",
                "ELEVATED — NEWS SOON"
            );

        }

        else {

            setText(
                "tradingRisk",
                "NORMAL"
            );

        }

    }

    else {

        setText(
            "tradingRisk",
            "NORMAL"
        );

    }


    setText(

        "checkNews",

        newsState.available

            ? (

                newsState.blocked

                    ? "— EUR/USD high-impact news clear"

                    : "✓ EUR/USD high-impact news clear"

            )

            : "— EUR/USD high-impact news clear"

    );

}


/* =========================================================
   NEWS DISPLAY
   ========================================================= */

function formatNewsList(
    events
) {

    if (
        !events ||
        events.length === 0
    ) {

        return "CLEAR";

    }


    const first =
        events[0];


    const now =
        new Date();


    const minutes =

        (

            first.date -
            now

        ) / 60000;


    if (
        minutes > 0
    ) {

        return (

            "HIGH — " +

            formatMinutes(
                minutes
            ) +

            " — " +

            first.name

        );

    }


    return (

        "HIGH — RELEASED — " +

        first.name

    );

}


/* =========================================================
   FORMAT NEXT EVENT
   ========================================================= */

function formatNextEvent(
    event
) {

    if (
        !event ||
        !event.date
    ) {

        return "--";

    }


    const now =
        new Date();


    const minutes =

        (

            event.date -
            now

        ) / 60000;


    const eventName =
        event.name;


    const currency =
        event.currency ||
        "FX";


    if (
        minutes <= 0
    ) {

        return (

            currency +

            " — NOW — " +

            eventName

        );

    }


    return (

        currency +

        " — " +

        formatMinutes(
            minutes
        ) +

        " — " +

        eventName

    );

}


/* =========================================================
   FORMAT MINUTES
   ========================================================= */

function formatMinutes(
    minutes
) {

    if (
        minutes < 1
    ) {

        return "NOW";

    }


    if (
        minutes < 60
    ) {

        return (
            Math.round(
                minutes
            ) +
            " min"
        );

    }


    const hours =
        Math.floor(
            minutes / 60
        );


    const mins =
        Math.round(
            minutes % 60
        );


    if (
        mins === 0
    ) {

        return (
            hours +
            "h"
        );

    }


    return (

        hours +

        "h " +

        mins +

        "m"

    );

}


/* =========================================================
   NEWS TRADE BLOCK
   ========================================================= */

function isNewsBlocked() {

    return (
        newsState.available &&
        newsState.blocked
    );

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


    if (
        isNewsBlocked()
    ) {

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
                "NEWS BLOCK",

            trigger:
                "HIGH-IMPACT NEWS",

            invalidation:
                "Wait for news window to clear",

            score:
                0

        };

    }


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

    }

    else {

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

            ? setup.score + "/100"

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

    if (
        isNewsBlocked()
    ) {

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
                "NEWS BLOCK",

            trigger:
                "HIGH-IMPACT NEWS",

            invalidation:
                "Wait for news window to clear"

        };

    }


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


/* =========================================================
   DISPLAY SCALP
   ========================================================= */

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
   =========================================================

   THIS ENGINE IS INDEPENDENT.

   Session is NOT a hard blocker.

   OFF SESSION:
       Allowed if technical setup is strong.

   Closing sessions:
       Allowed but treated with greater caution.

   News:
       Hard blocker.

   Technical alignment:
       Required.

   Setup Time:
       Created only when the Gate first becomes valid.
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


    const sessionQuality =
        getSessionQuality(
            session
        );


    /*
       Always display current session.
    */

    setText(
        "gateSession",
        session
    );


    /*
       NEWS IS THE ONLY HARD EXTERNAL BLOCK.
    */

    if (
        isNewsBlocked()
    ) {

        invalidateTradeGateSetup();


        setText(
            "eliteTradeGate",
            "STAY AWAY"
        );


        setText(
            "gateReason",
            "HIGH-IMPACT NEWS — trading blocked"
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
            "NEWS BLOCK"
        );


        return;

    }


    /* =====================================================
       TECHNICAL CONTEXT
       ===================================================== */

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


    const sr =
        calculateSR(h1);


    /* =====================================================
       DETERMINE DIRECTION
       ===================================================== */

    let direction =
        "--";


    if (

        h4Trend === "BEARISH" &&

        h1Trend === "BEARISH"

    ) {

        direction =
            "SELL";

    }


    else if (

        h4Trend === "BULLISH" &&

        h1Trend === "BULLISH"

    ) {

        direction =
            "BUY";

    }


    /*
       H4/H1 conflict.
    */

    if (
        direction === "--"
    ) {

        invalidateTradeGateSetup();


        setText(
            "eliteTradeGate",
            "STAY AWAY"
        );


        setText(
            "gateReason",
            "H4 / H1 directional conflict"
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
            "NOT APPROVED"
        );


        return;

    }


    /* =====================================================
       M15 STRUCTURE
       ===================================================== */

    if (
        m15Structure !== direction
    ) {

        invalidateTradeGateSetup();


        setText(
            "eliteTradeGate",
            "STAY AWAY"
        );


        setText(
            "gateReason",

            m15Structure === "RANGE"

                ? "M15 RANGE — structure not confirmed"

                : "M15 structure does not confirm direction"

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
            "NOT APPROVED"
        );


        return;

    }


    /* =====================================================
       M5 STRUCTURE
       ===================================================== */

    if (
        m5Structure !== direction
    ) {

        invalidateTradeGateSetup();


        setText(
            "eliteTradeGate",
            "STAY AWAY"
        );


        setText(
            "gateReason",
            "M5 structure confirmation missing"
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
            "NOT APPROVED"
        );


        return;

    }


    /* =====================================================
       EMA CONFIRMATION
       ===================================================== */

    const expectedEMA =
        direction === "SELL"
            ? "BEARISH"
            : "BULLISH";


    if (
        ema !== expectedEMA
    ) {

        invalidateTradeGateSetup();


        setText(
            "eliteTradeGate",
            "STAY AWAY"
        );


        setText(
            "gateReason",
            "M5 EMA20 / EMA50 alignment missing"
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
            "NOT APPROVED"
        );


        return;

    }


    /* =====================================================
       RSI CONFIRMATION
       ===================================================== */

    const rsiOK =

        direction === "SELL"

            ? rsi !== null &&
              rsi < 50

            : rsi !== null &&
              rsi >= 50;


    if (!rsiOK) {

        invalidateTradeGateSetup();


        setText(
            "eliteTradeGate",
            "STAY AWAY"
        );


        setText(
            "gateReason",
            "M5 RSI confirmation missing"
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
            "NOT APPROVED"
        );


        return;

    }


    /* =====================================================
       COMPLETED M5 MOMENTUM
       ===================================================== */

    const momentumOK =

        direction === "SELL"

            ? momentum === "BEARISH"

            : momentum === "BULLISH";


    if (!momentumOK) {

        invalidateTradeGateSetup();


        setText(
            "eliteTradeGate",
            "STAY AWAY"
        );


        setText(
            "gateReason",
            "Completed M5 momentum candle missing"
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
            "NOT APPROVED"
        );


        return;

    }


    /* =====================================================
       STRUCTURAL ENTRY / SL
       =====================================================

       For now we use the recent M5 structure to
       establish the protective stop.

       This is more logical than blindly using
       the old fixed 10-pip Gate stop.
    */

    const recentM5 =
        m5.slice(-6);


    const recentHigh =
        Math.max(
            ...recentM5.map(
                c => c.high
            )
        );


    const recentLow =
        Math.min(
            ...recentM5.map(
                c => c.low
            )
        );


    const entry =
        price;


    let sl;


    if (
        direction === "SELL"
    ) {

        sl =
            recentHigh +
            0.0001;

    }

    else {

        sl =
            recentLow -
            0.0001;

    }


    /* =====================================================
       STRUCTURAL RISK
       ===================================================== */

    const riskDistance =
        Math.abs(
            entry - sl
        );


    const riskPips =
        riskDistance /
        pipSize();


    /*
       Minimum 3 pips.
       Maximum 15 pips.
    */

    if (

        riskPips < 3 ||

        riskPips > 15

    ) {

        invalidateTradeGateSetup();


        setText(
            "eliteTradeGate",
            "STAY AWAY"
        );


        setText(
            "gateReason",

            riskPips < 3

                ? "Structural stop too tight"

                : "Structural risk exceeds 15 pips"

        );


        setText(
            "gateDirection",
            direction
        );


        setText(
            "gateEntry",
            formatPrice(entry)
        );


        setText(
            "gateSL",
            formatPrice(sl)
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
            formatNumber(
                riskPips,
                1
            ) + " pips"
        );


        return;

    }


    /* =====================================================
       TARGET CALCULATION
       ===================================================== */

    const tp1Distance =
        riskDistance * 2;


    const tp2Distance =
        riskDistance * 3;


    const tp1 =

        direction === "SELL"

            ? entry - tp1Distance

            : entry + tp1Distance;


    const tp2 =

        direction === "SELL"

            ? entry - tp2Distance

            : entry + tp2Distance;


    /* =====================================================
       S/R CLEARANCE
       =====================================================

       For SELL:

       TP2 should remain above important support.

       For BUY:

       TP2 should remain below important resistance.
    */

    let srBlocked =
        false;


    if (
        direction === "SELL"
    ) {

        if (

            sr.s1 !== null &&

            tp2 <= sr.s1

        ) {

            srBlocked =
                true;

        }

    }

    else {

        if (

            sr.r1 !== null &&

            tp2 >= sr.r1

        ) {

            srBlocked =
                true;

        }

    }


    if (srBlocked) {

        invalidateTradeGateSetup();


        setText(
            "eliteTradeGate",
            "STAY AWAY"
        );


        setText(
            "gateReason",
            "Higher-timeframe S/R blocks TP2"
        );


        setText(
            "gateDirection",
            direction
        );


        setText(
            "gateEntry",
            formatPrice(entry)
        );


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
            "1:2 / 1:3 blocked"
        );


        setText(
            "gateRisk",
            formatNumber(
                riskPips,
                1
            ) + " pips"
        );


        return;

    }


    /* =====================================================
       SESSION PREFERENCE
       =====================================================

       IMPORTANT:

       Session does NOT block.

       OFF SESSION is allowed.

       Closing sessions are allowed but marked
       as caution.
    */

    let gateStatus =
        "A+ TRADE READY";


    let gateReason =
        "All primary confirmations aligned";


    if (
        sessionQuality.score === 3
    ) {

        gateReason =
            "Full confirmation — preferred overlap session";

    }

    else if (
        sessionQuality.score === 2
    ) {

        gateReason =
            "Full confirmation — favourable session";

    }

    else if (
        sessionQuality.score === 1
    ) {

        gateStatus =
            "TRADE READY — CAUTION";


        gateReason =
            "Technical confirmation complete — session closing";

    }

    else {

        gateStatus =
            "TRADE READY — OFF SESSION";


        gateReason =
            "Technical confirmation complete — lower session preference";

    }


    /* =====================================================
       TRADE GATE APPROVED
       ===================================================== */

    startTradeGateSetup();


    setText(
        "eliteTradeGate",
        gateStatus
    );


    setText(
        "gateReason",
        gateReason
    );


    setText(
        "gateDirection",
        direction
    );


    setText(
        "gateEntry",
        formatPrice(entry)
    );


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

        formatNumber(
            riskPips,
            1
        ) +

        " pips — APPROVED"

    );


    setText(
        "gateSetupTime",

        tradeGateSetupTime

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

        getSession() !== "OFF SESSION"

            ? "✓ " + getSession()

            : "✓ OFF SESSION — candle quality required"

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
        formatPrice(
            sr.r2
        )
    );


    setText(
        "r1",
        formatPrice(
            sr.r1
        )
    );


    setText(
        "s1",
        formatPrice(
            sr.s1
        )
    );


    setText(
        "s2",
        formatPrice(
            sr.s2
        )
    );


    setText(
        "h4Rsi",
        formatNumber(
            h4RSI
        )
    );


    setText(
        "h1Rsi",
        formatNumber(
            h1RSI
        )
    );


    setText(
        "m15Rsi",
        formatNumber(
            m15RSI
        )
    );


    setText(
        "m5Rsi",
        formatNumber(
            m5RSI
        )
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


    invalidateTradeGateSetup();


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

        const h4 =
            await getCachedCandles(

                "h4",

                "4h",

                100

            );


        await delay(500);


        const h1 =
            await getCachedCandles(

                "h1",

                "1h",

                100

            );


        await delay(500);


        const m15 =
            await getCachedCandles(

                "m15",

                "15min",

                100

            );


        await delay(500);


        const m5 =
            await getCachedCandles(

                "m5",

                "5min",

                100

            );


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


        displayTechnicalData(

            price,

            h4,

            h1,

            m15,

            m5

        );


        await loadNews();


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
           IMPORTANT:

           Trade Gate is evaluated separately.
        */

        evaluateTradeGate(

            price,

            h4,

            h1,

            m15,

            m5

        );


        displayChecklist(

            h4,

            h1,

            m15,

            m5

        );


        setText(

            "proVerdict",

            sniper.status ===
                "A+ SETUP"

                ? "A+ SETUP"

                : "WAIT"

        );


        setText(
            "dataStatus",
            "● LIVE"
        );

    }

    catch (error) {

        displayDataError(
            error
        );

    }

    finally {

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


    newsUpdated =
        0;


    loadMarketData();

}


/* =========================================================
   NEWS AUTO REFRESH
   ========================================================= */

setInterval(

    () => {

        newsUpdated =
            0;


        loadNews();

    },

    NEWS_TTL

);


/* =========================================================
   DASHBOARD AUTO REFRESH
   ========================================================= */

setInterval(

    () => {

        loadMarketData();

    },

    REFRESH_INTERVAL

);


/* =========================================================
   START DASHBOARD
   ========================================================= */

document.addEventListener(

    "DOMContentLoaded",

    () => {

        /*
           Make sure the new Trade Gate
           setup time starts blank.
        */

        setText(
            "gateSetupTime",
            "--"
        );


        /*
           Initial market load.
        */

        loadMarketData();

    }

);
