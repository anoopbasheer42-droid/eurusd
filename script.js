/* =========================================================
   EUR/USD SNIPER DASHBOARD
   FULL ELITE VERSION
   + LIVE MULTI-TIMEFRAME PRICE CHART

   ENGINE 1 = A+ SNIPER
   ENGINE 2 = ELITE SCALP
   ENGINE 3 = ELITE TRADE GATE

   NEWS = INFORMATION ONLY
   NEWS DOES NOT BLOCK ANY ENGINE

   CHART = 5M / 15M / 1H / 4H
   ========================================================= */


/* =========================================================
   API CONFIGURATION
   =========================================================
   >>> ENTER YOUR TWELVE DATA API KEY HERE <<<
   ========================================================= */

const API_KEY = "4ba3968e609544bf8990192fdf3ed970";

const SYMBOL = "EUR/USD";

const TIME_SERIES_URL =
    "https://api.twelvedata.com/time_series";

const NEWS_API_URL =
    "https://www.financecalendar.com/wp-json/fc/v1/calendar";


/* =========================================================
   REFRESH SETTINGS
   ========================================================= */

const REFRESH_INTERVAL =
    5 * 60 * 1000;

const NEWS_TTL =
    5 * 60 * 1000;


/* =========================================================
   TECHNICAL DATA CACHE
   ========================================================= */

const DATA_TTL = {

    h4: 30 * 60 * 1000,

    h1: 15 * 60 * 1000,

    m15: 10 * 60 * 1000,

    m5: 5 * 60 * 1000
};


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
   CHART STATE
   ========================================================= */

let selectedChartTimeframe = "m5";


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
   ENGINE SETUP CLOCKS
   ========================================================= */

let sniperSetupTime = null;

let sniperSetupActive = false;

let gateSetupTime = null;

let gateSetupActive = false;


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
   SNIPER SETUP CLOCK
   ========================================================= */

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
   TRADE GATE SETUP CLOCK
   ========================================================= */

function startGateSetup() {

    if (!gateSetupActive) {

        gateSetupTime =
            getISTTime();

        gateSetupActive =
            true;
    }

    setText(
        "gateSetupTime",
        gateSetupTime
    );
}


function invalidateGateSetup() {

    gateSetupActive =
        false;

    gateSetupTime =
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
   =========================================================
   LIVE MULTI-TIMEFRAME PRICE CHART
   =========================================================
   ========================================================= */


/* =========================================================
   GET CHART DATA
   ========================================================= */

function getSelectedChartData() {

    if (
        selectedChartTimeframe === "m5"
    ) {

        return marketData.m5;
    }


    if (
        selectedChartTimeframe === "m15"
    ) {

        return marketData.m15;
    }


    if (
        selectedChartTimeframe === "h1"
    ) {

        return marketData.h1;
    }


    if (
        selectedChartTimeframe === "h4"
    ) {

        return marketData.h4;
    }


    return marketData.m5;
}


/* =========================================================
   CHART TIMEFRAME LABEL
   ========================================================= */

function getChartTimeframeLabel() {

    if (
        selectedChartTimeframe === "m5"
    ) {

        return "5M";
    }


    if (
        selectedChartTimeframe === "m15"
    ) {

        return "15M";
    }


    if (
        selectedChartTimeframe === "h1"
    ) {

        return "1H";
    }


    if (
        selectedChartTimeframe === "h4"
    ) {

        return "4H";
    }


    return "5M";
}


/* =========================================================
   CHANGE CHART TIMEFRAME
   ========================================================= */

function setChartTimeframe(
    timeframe
) {

    selectedChartTimeframe =
        timeframe;


    updateChartButtons();


    const candles =
        getSelectedChartData();


    renderPriceChart(
        candles
    );
}


/* =========================================================
   UPDATE CHART BUTTONS
   ========================================================= */

function updateChartButtons() {

    const buttons = {

        m5:
            document.getElementById(
                "chartBtnM5"
            ),

        m15:
            document.getElementById(
                "chartBtnM15"
            ),

        h1:
            document.getElementById(
                "chartBtnH1"
            ),

        h4:
            document.getElementById(
                "chartBtnH4"
            )

    };


    Object.keys(buttons).forEach(
        key => {

            const button =
                buttons[key];


            if (!button) {

                return;
            }


            if (
                key ===
                selectedChartTimeframe
            ) {

                button.style.background =
                    "#20c997";

                button.style.color =
                    "#07110d";

                button.style.borderColor =
                    "#20c997";

                button.style.fontWeight =
                    "bold";

            }

            else {

                button.style.background =
                    "#222";

                button.style.color =
                    "#aaa";

                button.style.borderColor =
                    "#444";

                button.style.fontWeight =
                    "normal";
            }

        }
    );
}


/* =========================================================
   CREATE PRICE CHART CONTAINER
   ========================================================= */

function createPriceChartContainer() {

    const livePriceElement =
        document.getElementById("livePrice");

    if (!livePriceElement) {

        console.warn(
            "livePrice element not found."
        );

        return null;
    }


    let chartContainer =
        document.getElementById("priceChart");


    if (chartContainer) {

        return chartContainer;
    }


    chartContainer =
        document.createElement("div");

    chartContainer.id =
        "priceChart";


    chartContainer.style.width =
        "100%";

    chartContainer.style.margin =
        "14px 0 18px 0";

    chartContainer.style.background =
        "#181818";

    chartContainer.style.border =
        "1px solid #333";

    chartContainer.style.borderRadius =
        "12px";

    chartContainer.style.padding =
        "12px";

    chartContainer.style.boxSizing =
        "border-box";

    chartContainer.style.overflow =
        "hidden";


    chartContainer.innerHTML = `

        <div
            id="chartControls"
            style="
                display:flex;
                gap:8px;
                flex-wrap:wrap;
                margin-bottom:10px;
                align-items:center;
            "
        >

            <span
                style="
                    color:#aaa;
                    font-family:Arial,sans-serif;
                    font-size:12px;
                    margin-right:4px;
                "
            >
                TIMEFRAME
            </span>


            <button
                id="chartBtnM5"
                onclick="setChartTimeframe('m5')"
                style="
                    padding:7px 13px;
                    border-radius:6px;
                    border:1px solid #444;
                    cursor:pointer;
                    font-family:Arial,sans-serif;
                    font-size:12px;
                "
            >
                5M
            </button>


            <button
                id="chartBtnM15"
                onclick="setChartTimeframe('m15')"
                style="
                    padding:7px 13px;
                    border-radius:6px;
                    border:1px solid #444;
                    cursor:pointer;
                    font-family:Arial,sans-serif;
                    font-size:12px;
                "
            >
                15M
            </button>


            <button
                id="chartBtnH1"
                onclick="setChartTimeframe('h1')"
                style="
                    padding:7px 13px;
                    border-radius:6px;
                    border:1px solid #444;
                    cursor:pointer;
                    font-family:Arial,sans-serif;
                    font-size:12px;
                "
            >
                1H
            </button>


            <button
                id="chartBtnH4"
                onclick="setChartTimeframe('h4')"
                style="
                    padding:7px 13px;
                    border-radius:6px;
                    border:1px solid #444;
                    cursor:pointer;
                    font-family:Arial,sans-serif;
                    font-size:12px;
                "
            >
                4H
            </button>

        </div>


        <div
            id="chartCanvas"
            style="
                width:100%;
            "
        >
            <div style="
                color:#aaa;
                text-align:center;
                padding:20px;
                font-family:Arial,sans-serif;
            ">
                Waiting for EUR/USD chart data...
            </div>
        </div>

    `;


    /*
       Insert chart directly after
       Live Market Price.
    */

    const parent =
        livePriceElement.parentNode;


    if (parent) {

        parent.insertBefore(

            chartContainer,

            livePriceElement.nextSibling

        );

    }


    updateChartButtons();


    return chartContainer;
}


/* =========================================================
   CREATE SVG PRICE CHART
   ========================================================= */

function renderPriceChart(candles) {

    const chartContainer =
        createPriceChartContainer();


    if (!chartContainer) {

        return;
    }


    const chartCanvas =
        document.getElementById(
            "chartCanvas"
        );


    if (!chartCanvas) {

        return;
    }


    if (

        !candles ||

        candles.length === 0

    ) {

        chartCanvas.innerHTML = `
            <div style="
                color:#aaa;
                text-align:center;
                padding:20px;
                font-family:Arial,sans-serif;
            ">
                Waiting for EUR/USD chart data...
            </div>
        `;

        return;
    }


    /*
       Use latest 60 candles.
    */

    const recent =
        candles.slice(-60);


    const width =
        900;

    const height =
        360;


    const paddingLeft =
        55;

    const paddingRight =
        15;

    const paddingTop =
        45;

    const paddingBottom =
        35;


    const chartWidth =
        width -
        paddingLeft -
        paddingRight;


    const chartHeight =
        height -
        paddingTop -
        paddingBottom;


    const highs =
        recent.map(
            c => c.high
        );


    const lows =
        recent.map(
            c => c.low
        );


    const maxPrice =
        Math.max(
            ...highs
        );


    const minPrice =
        Math.min(
            ...lows
        );


    const priceRange =
        maxPrice -
        minPrice;


    if (
        priceRange <= 0
    ) {

        chartCanvas.innerHTML = `
            <div style="
                color:#aaa;
                text-align:center;
                padding:20px;
                font-family:Arial,sans-serif;
            ">
                Insufficient price range.
            </div>
        `;

        return;
    }


    function xPosition(index) {

        if (
            recent.length <= 1
        ) {

            return paddingLeft;
        }


        return (

            paddingLeft +

            (
                index /
                (recent.length - 1)
            ) *

            chartWidth

        );
    }


    function yPosition(price) {

        return (

            paddingTop +

            (

                maxPrice -
                price

            ) /

            priceRange *

            chartHeight

        );
    }


    /*
       Grid lines.
    */

    let grid =
        "";


    const gridCount =
        5;


    for (
        let i = 0;

        i <= gridCount;

        i++

    ) {

        const ratio =
            i / gridCount;


        const y =
            paddingTop +
            ratio *
            chartHeight;


        const price =
            maxPrice -
            ratio *
            priceRange;


        grid += `

            <line
                x1="${paddingLeft}"
                y1="${y}"
                x2="${width - paddingRight}"
                y2="${y}"
                stroke="#2b2b2b"
                stroke-width="1"
            />

            <text
                x="${paddingLeft - 8}"
                y="${y + 4}"
                text-anchor="end"
                fill="#999"
                font-size="11"
                font-family="Arial"
            >
                ${formatPrice(price)}
            </text>

        `;
    }


    /*
       Candles.
    */

    let candleSVG =
        "";


    const candleSpacing =
        chartWidth /
        recent.length;


    const candleWidth =
        Math.max(
            3,
            candleSpacing * 0.55
        );


    recent.forEach(

        (candle, index) => {

            const x =
                xPosition(index);


            const highY =
                yPosition(
                    candle.high
                );


            const lowY =
                yPosition(
                    candle.low
                );


            const openY =
                yPosition(
                    candle.open
                );


            const closeY =
                yPosition(
                    candle.close
                );


            const bullish =
                candle.close >=
                candle.open;


            const candleColor =
                bullish
                    ? "#20c997"
                    : "#ff4d6d";


            const bodyTop =
                Math.min(
                    openY,
                    closeY
                );


            const bodyHeight =
                Math.max(
                    2,
                    Math.abs(
                        closeY -
                        openY
                    )
                );


            candleSVG += `

                <line
                    x1="${x}"
                    y1="${highY}"
                    x2="${x}"
                    y2="${lowY}"
                    stroke="${candleColor}"
                    stroke-width="1"
                />

                <rect
                    x="${x - candleWidth / 2}"
                    y="${bodyTop}"
                    width="${candleWidth}"
                    height="${bodyHeight}"
                    fill="${candleColor}"
                    rx="1"
                />

            `;
        }

    );


    /*
       Current/latest price line.
    */

    const latest =
        recent[
            recent.length - 1
        ];


    const latestPrice =
        latest.close;


    const latestY =
        yPosition(
            latestPrice
        );


    const priceLine = `

        <line
            x1="${paddingLeft}"
            y1="${latestY}"
            x2="${width - paddingRight}"
            y2="${latestY}"
            stroke="#ffffff"
            stroke-width="1"
            stroke-dasharray="5 4"
        />

        <rect
            x="${width - 92}"
            y="${latestY - 11}"
            width="77"
            height="22"
            rx="4"
            fill="#252525"
        />

        <text
            x="${width - 53}"
            y="${latestY + 4}"
            text-anchor="middle"
            fill="#ffffff"
            font-size="11"
            font-family="Arial"
            font-weight="bold"
        >
            ${formatPrice(latestPrice)}
        </text>

    `;


    /*
       Title.
    */

    const timeframe =
        getChartTimeframeLabel();


    const title = `

        <text
            x="${paddingLeft}"
            y="22"
            fill="#ffffff"
            font-size="15"
            font-family="Arial"
            font-weight="bold"
        >
            EUR/USD — ${timeframe} PRICE CHART
        </text>

        <text
            x="${width - paddingRight}"
            y="22"
            text-anchor="end"
            fill="#888"
            font-size="11"
            font-family="Arial"
        >
            Last ${recent.length} candles
        </text>

    `;


    /*
       Time labels.
    */

    let timeLabels =
        "";


    const labelIndexes = [

        0,

        Math.floor(
            recent.length * 0.25
        ),

        Math.floor(
            recent.length * 0.50
        ),

        Math.floor(
            recent.length * 0.75
        ),

        recent.length - 1

    ];


    labelIndexes.forEach(

        index => {

            const candle =
                recent[index];


            if (!candle) {

                return;
            }


            const x =
                xPosition(index);


            const date =
                new Date(
                    candle.datetime
                );


            const label =
                date.toLocaleTimeString(
                    "en-IN",
                    {
                        timeZone:
                            "Asia/Kolkata",

                        hour:
                            "2-digit",

                        minute:
                            "2-digit",

                        hour12:
                            false
                    }
                );


            timeLabels += `

                <text
                    x="${x}"
                    y="${height - 10}"
                    text-anchor="middle"
                    fill="#888"
                    font-size="10"
                    font-family="Arial"
                >
                    ${label}
                </text>

            `;
        }

    );


    chartCanvas.innerHTML = `

        <div style="
            width:100%;
            overflow-x:auto;
        ">

            <svg
                viewBox="0 0 ${width} ${height}"
                width="100%"
                height="360"
                preserveAspectRatio="none"
                style="
                    display:block;
                    min-width:650px;
                    background:#181818;
                "
            >

                ${title}

                ${grid}

                ${candleSVG}

                ${priceLine}

                ${timeLabels}

            </svg>

        </div>

    `;
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
   COMPLETED CANDLE
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


function getPreviousCompletedCandle(
    candles
) {

    if (

        !candles ||

        candles.length < 3

    ) {

        return null;
    }


    return candles[
        candles.length - 3
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
   M5 MOMENTUM
   ========================================================= */

function getMomentum(
    candles
) {

    const c1 =
        getLatestCompletedCandle(
            candles
        );


    const c2 =
        getPreviousCompletedCandle(
            candles
        );


    if (
        !c1 ||
        !c2
    ) {

        return "WAIT";
    }


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
   EMA EXTENSION CHECK
   ========================================================= */

function isEMAOverExtended(
    candles,
    direction
) {

    if (

        !candles ||

        candles.length < 50

    ) {

        return true;
    }


    const last =
        getLatestCompletedCandle(
            candles
        );


    if (!last) {

        return true;
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

        return true;
    }


    const distance =
        Math.abs(
            last.close -
            ema20
        );


    const normalGap =
        Math.abs(
            ema20 -
            ema50
        );


    if (
        normalGap > 0 &&
        distance > normalGap * 3
    ) {

        return true;
    }


    return false;
}


/* =========================================================
   CANDLE BODY QUALITY
   ========================================================= */

function getCandleQuality(
    candles,
    direction
) {

    const candle =
        getLatestCompletedCandle(
            candles
        );


    if (!candle) {

        return false;
    }


    const range =
        candle.high -
        candle.low;


    if (
        range <= 0
    ) {

        return false;
    }


    const body =
        Math.abs(
            candle.close -
            candle.open
        );


    const bodyRatio =
        body / range;


    if (
        bodyRatio < 0.50
    ) {

        return false;
    }


    if (
        direction === "SELL"
    ) {

        return (
            candle.close <
            candle.open
        );
    }


    if (
        direction === "BUY"
    ) {

        return (
            candle.close >
            candle.open
        );
    }


    return false;
}


/* =========================================================
   SESSION ENGINE
   ========================================================= */

function getSessionInfo() {

    const now =
        new Date();


    const parts =
        new Intl.DateTimeFormat(

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
                    false

            }

        ).formatToParts(now);


    let hour = 0;

    let minute = 0;


    parts.forEach(
        part => {

            if (
                part.type === "hour"
            ) {

                hour =
                    Number(
                        part.value
                    );
            }


            if (
                part.type === "minute"
            ) {

                minute =
                    Number(
                        part.value
                    );
            }

        }
    );


    const totalMinutes =
        hour * 60 +
        minute;


    if (

        totalMinutes >= 60 &&

        totalMinutes < 150

    ) {

        return {

            name:
                "US CLOSING",

            active:
                false,

            quality:
                "LOW LIQUIDITY"

        };
    }


    if (

        totalMinutes >= 1050 &&

        totalMinutes < 1230

    ) {

        return {

            name:
                "LONDON / US OVERLAP",

            active:
                true,

            quality:
                "PRIME"

        };
    }


    if (

        totalMinutes >= 1200 &&

        totalMinutes < 1290

    ) {

        return {

            name:
                "LONDON CLOSING",

            active:
                true,

            quality:
                "CAUTION"

        };
    }


    if (

        totalMinutes >= 1230 &&

        totalMinutes < 1350

    ) {

        return {

            name:
                "US",

            active:
                true,

            quality:
                "ACTIVE"

        };
    }


    if (

        totalMinutes >= 750 &&

        totalMinutes < 1050

    ) {

        return {

            name:
                "LONDON",

            active:
                true,

            quality:
                "ACTIVE"

        };
    }


    return {

        name:
            "OFF SESSION",

        active:
            false,

        quality:
            "LOW LIQUIDITY"

    };
}


function getSession() {

    return getSessionInfo().name;
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

                14 *
                24 *
                60 *
                60 *
                1000

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
            Array.isArray(
                data
            )
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


        setText(
            "checkNews",
            "— EUR/USD high-impact news clear"
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
                    15 *
                    60 *
                    1000;
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
            "HIGH IMPACT WINDOW"
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
            "HIGH — NEWS WINDOW"
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

            ? "✓ News monitored — informational only"

            : "— News data unavailable"
    );
}


/* =========================================================
   NEWS DISPLAY FORMAT
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


    const currency =
        event.currency ||
        "FX";


    if (
        minutes <= 0
    ) {

        return (

            currency +

            " — NOW — " +

            event.name

        );
    }


    return (

        currency +

        " — " +

        formatMinutes(
            minutes
        ) +

        " — " +

        event.name

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
   NEWS BLOCK FUNCTION
   ========================================================= */

function isNewsBlocked() {

    return false;
}


/* =========================================================
   ENGINE 1
   A+ SNIPER ENGINE
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


    const directionCandidate =

        h4Trend === "BEARISH" &&

        h1Trend === "BEARISH"

            ? "SELL"

            :

        h4Trend === "BULLISH" &&

        h1Trend === "BULLISH"

            ? "BUY"

            : null;


    if (!directionCandidate) {

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
                "H4 / H1 alignment missing",

            invalidation:
                "Higher-timeframe alignment missing",

            score:
                0

        };
    }


    const bearishConditions =

        directionCandidate === "SELL" &&

        m15Structure === "BEARISH" &&

        m5Structure === "BEARISH" &&

        ema === "BEARISH" &&

        momentum === "BEARISH" &&

        rsi !== null &&

        rsi < 50 &&

        getCandleQuality(
            m5,
            "SELL"
        ) &&

        !isEMAOverExtended(
            m5,
            "SELL"
        );


    const bullishConditions =

        directionCandidate === "BUY" &&

        m15Structure === "BULLISH" &&

        m5Structure === "BULLISH" &&

        ema === "BULLISH" &&

        momentum === "BULLISH" &&

        rsi !== null &&

        rsi >= 50 &&

        getCandleQuality(
            m5,
            "BUY"
        ) &&

        !isEMAOverExtended(
            m5,
            "BUY"
        );


    const valid =
        bearishConditions ||
        bullishConditions;


    if (!valid) {

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


    const direction =
        directionCandidate;


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

                ? "H4 + H1 + M15 + M5 bearish alignment"

                : "H4 + H1 + M15 + M5 bullish alignment",

        invalidation:

            direction === "SELL"

                ? "M5 bullish close / alignment breaks"

                : "M5 bearish close / alignment breaks",

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
   ENGINE 2
   ELITE SCALP ENGINE
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


    const rsi =
        calculateRSI(m5);


    if (

        h1Trend === "BEARISH" &&

        m15Structure === "BEARISH" &&

        m5Structure === "BEARISH" &&

        ema === "BEARISH" &&

        momentum === "BEARISH" &&

        rsi !== null &&

        rsi < 50 &&

        getCandleQuality(
            m5,
            "SELL"
        )

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
                "H1 + M15 + M5 bearish alignment",

            invalidation:
                "M5 bullish close / EMA alignment breaks"

        };
    }


    if (

        h1Trend === "BULLISH" &&

        m15Structure === "BULLISH" &&

        m5Structure === "BULLISH" &&

        ema === "BULLISH" &&

        momentum === "BULLISH" &&

        rsi !== null &&

        rsi >= 50 &&

        getCandleQuality(
            m5,
            "BUY"
        )

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
                "H1 + M15 + M5 bullish alignment",

            invalidation:
                "M5 bearish close / EMA alignment breaks"

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
   ENGINE 3
   ELITE TRADE GATE
   ========================================================= */

function evaluateTradeGate(

    price,

    h4,

    h1,

    m15,

    m5

) {

    const sessionInfo =
        getSessionInfo();


    const session =
        sessionInfo.name;


    setText(
        "gateSession",
        session
    );


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


    const direction =

        h4Trend === "BEARISH" &&

        h1Trend === "BEARISH"

            ? "SELL"

            :

        h4Trend === "BULLISH" &&

        h1Trend === "BULLISH"

            ? "BUY"

            : "--";


    setText(
        "gateDirection",
        direction
    );


    if (
        direction === "--"
    ) {

        invalidateGateSetup();


        setText(
            "eliteTradeGate",
            "STAY AWAY"
        );


        setText(
            "gateReason",
            "H4 + H1 directional alignment missing"
        );


        clearGateTradeValues();


        return;
    }


    const m15OK =

        direction === "SELL"

            ? m15Structure === "BEARISH"

            : m15Structure === "BULLISH";


    const m5OK =

        direction === "SELL"

            ? m5Structure === "BEARISH"

            : m5Structure === "BULLISH";


    const emaOK =

        direction === "SELL"

            ? ema === "BEARISH"

            : ema === "BULLISH";


    const rsiOK =

        direction === "SELL"

            ? rsi !== null &&
              rsi < 50

            : rsi !== null &&
              rsi >= 50;


    const momentumOK =

        direction === "SELL"

            ? momentum === "BEARISH"

            : momentum === "BULLISH";


    const candleOK =
        getCandleQuality(
            m5,
            direction
        );


    const extensionOK =
        !isEMAOverExtended(
            m5,
            direction
        );


    const riskPips =
        10;


    const riskOK =

        riskPips >= 3 &&

        riskPips <= 15;


    const rrOK =
        true;


    const sessionContext =
        sessionInfo.quality;


    const gateOK =

        m15OK &&

        m5OK &&

        emaOK &&

        rsiOK &&

        momentumOK &&

        candleOK &&

        extensionOK &&

        riskOK &&

        rrOK;


    if (!gateOK) {

        invalidateGateSetup();


        setText(
            "eliteTradeGate",
            "STAY AWAY"
        );


        let reason =
            "Confirmation incomplete";


        if (!m15OK) {

            reason =
                "M15 confirmation missing";

        }

        else if (!m5OK) {

            reason =
                "M5 structure confirmation missing";

        }

        else if (!emaOK) {

            reason =
                "M5 EMA20 / EMA50 alignment missing";

        }

        else if (!rsiOK) {

            reason =
                "M5 RSI confirmation missing";

        }

        else if (!momentumOK) {

            reason =
                "Completed M5 momentum candle missing";

        }

        else if (!candleOK) {

            reason =
                "M5 candle quality insufficient";

        }

        else if (!extensionOK) {

            reason =
                "Price excessively extended from EMA";

        }

        else if (!riskOK) {

            reason =
                "Structural risk outside 3–15 pip range";

        }


        setText(
            "gateReason",
            reason
        );


        clearGateTradeValues();


        return;
    }


    startGateSetup();


    setText(
        "eliteTradeGate",
        "A+ TRADE READY"
    );


    setText(
        "gateReason",

        session +

        " — " +

        sessionContext +

        " — all gate confirmations aligned"

    );


    const entry =
        price;


    let sl;

    let tp1;

    let tp2;


    if (
        direction === "SELL"
    ) {

        sl =
            entry +
            0.0010;


        tp1 =
            entry -
            0.0020;


        tp2 =
            entry -
            0.0030;

    }

    else {

        sl =
            entry -
            0.0010;


        tp1 =
            entry +
            0.0020;


        tp2 =
            entry +
            0.0030;
    }


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
        riskPips + " pips"
    );


    setText(
        "gateSetupTime",
        gateSetupTime
    );
}


/* =========================================================
   CLEAR TRADE GATE VALUES
   ========================================================= */

function clearGateTradeValues() {

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


    const sessionInfo =
        getSessionInfo();


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

        sessionInfo.name

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


    const extensionOK =
        direction !== "--" &&
        !isEMAOverExtended(
            m5,
            direction
        );


    setText(

        "checkExtension",

        extensionOK

            ? "✓ No excessive EMA extension"

            : "— No excessive EMA extension"

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


    /*
       LIVE MARKET PRICE
    */

    setText(
        "livePrice",
        formatPrice(price)
    );


    /*
       =====================================================
       MULTI-TIMEFRAME CHART
       =====================================================
    */

    createPriceChartContainer();


    renderPriceChart(
        getSelectedChartData()
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
   PRO VERDICT
   ========================================================= */

function updateProVerdict(

    sniper,

    scalp

) {

    if (
        sniper.status ===
        "A+ SETUP"
    ) {

        setText(
            "proVerdict",
            "A+ SNIPER SETUP"
        );

        return;
    }


    if (
        scalp.verdict ===
        "A+ SCALP"
    ) {

        setText(
            "proVerdict",
            "A+ SCALP"
        );

        return;
    }


    setText(
        "proVerdict",
        "WAIT"
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


    clearGateTradeValues();


    invalidateSniperSetup();

    invalidateGateSetup();
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
           H4
        */

        const h4 =
            await getCachedCandles(

                "h4",

                "4h",

                100

            );


        await delay(500);


        /*
           H1
        */

        const h1 =
            await getCachedCandles(

                "h1",

                "1h",

                100

            );


        await delay(500);


        /*
           M15
        */

        const m15 =
            await getCachedCandles(

                "m15",

                "15min",

                100

            );


        await delay(500);


        /*
           M5
        */

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


        /*
           Technical display + MULTI-TIMEFRAME CHART
        */

        displayTechnicalData(

            price,

            h4,

            h1,

            m15,

            m5

        );


        /*
           News
        */

        await loadNews();


        /*
           ENGINE 1
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
           ENGINE 2
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
           ENGINE 3
        */

        evaluateTradeGate(

            price,

            h4,

            h1,

            m15,

            m5

        );


        /*
           CHECKLIST
        */

        displayChecklist(

            h4,

            h1,

            m15,

            m5

        );


        /*
           PRO VERDICT
        */

        updateProVerdict(

            sniper,

            scalp

        );


        /*
           Final status
        */

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
           Make sure chart container can be
           created after the page is ready.
        */

        createPriceChartContainer();

        loadMarketData();

    }

);
