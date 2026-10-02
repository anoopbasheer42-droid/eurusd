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
   COMPLETED-CANDLE SERIES
   ========================================================= */

function getCompletedCandles(
    candles
) {

    if (
        !candles ||
        candles.length < 2
    ) {

        return [];
    }


    return candles.slice(
        0,
        -1
    );
}


/* =========================================================
   TREND — H4 / H1
   =========================================================
   
   Trend is now determined using:

   1. Completed candles only
   2. EMA20 vs EMA50
   3. Completed price vs EMA20
   4. Market structure

   This avoids calling a temporary bullish candle
   a full bullish higher-timeframe trend.
   ========================================================= */

function getTrend(
    candles
) {

    const completed =
        getCompletedCandles(
            candles
        );


    if (
        completed.length < 55
    ) {

        return "--";
    }


    const ema20 =
        calculateEMA(
            completed,
            20
        );


    const ema50 =
        calculateEMA(
            completed,
            50
        );


    const last =
        completed[
            completed.length - 1
        ];


    if (

        ema20 === null ||

        ema50 === null ||

        !last

    ) {

        return "--";
    }


    const structure =
        getStructure(
            completed
        );


    const price =
        Number(
            last.close
        );


    if (
        !Number.isFinite(price)
    ) {

        return "--";
    }


    const bullish =
        ema20 > ema50 &&

        price > ema20 &&

        structure === "BULLISH";


    const bearish =
        ema20 < ema50 &&

        price < ema20 &&

        structure === "BEARISH";


    if (bullish) {

        return "BULLISH";
    }


    if (bearish) {

        return "BEARISH";
    }


    return "RANGE";
}


/* =========================================================
   MARKET STRUCTURE
   ========================================================= */

function getStructure(
    candles
) {

    const completed =
        getCompletedCandles(
            candles
        );


    if (
        completed.length < 10
    ) {

        return "--";
    }


    const recent =
        completed.slice(-10);


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
   =========================================================
   
   IMPORTANT:

   R1 = nearest meaningful resistance ABOVE price
   R2 = next resistance above R1

   S1 = nearest meaningful support BELOW price
   S2 = next support below S1

   This fixes the previous S1/S2 inversion.
   ========================================================= */

function calculateSR(
    candles,
    currentPrice = null
) {

    const completed =
        getCompletedCandles(
            candles
        );


    if (
        completed.length < 20
    ) {

        return {

            r2: null,

            r1: null,

            s1: null,

            s2: null

        };
    }


    const recent =
        completed.slice(-60);


    let swingHighs = [];

    let swingLows = [];


    /*
       Detect local swing points using
       two candles on each side.
    */

    for (
        let i = 2;

        i < recent.length - 2;

        i++

    ) {

        const current =
            recent[i];


        const left1 =
            recent[i - 1];


        const left2 =
            recent[i - 2];


        const right1 =
            recent[i + 1];


        const right2 =
            recent[i + 2];


        const isSwingHigh =

            current.high >= left1.high &&

            current.high >= left2.high &&

            current.high >= right1.high &&

            current.high >= right2.high;


        const isSwingLow =

            current.low <= left1.low &&

            current.low <= left2.low &&

            current.low <= right1.low &&

            current.low <= right2.low;


        if (isSwingHigh) {

            swingHighs.push(
                current.high
            );
        }


        if (isSwingLow) {

            swingLows.push(
                current.low
            );
        }
    }


    /*
       Fallback if not enough local swings.
    */

    if (
        swingHighs.length === 0
    ) {

        swingHighs.push(
            Math.max(
                ...recent.map(
                    c => c.high
                )
            )
        );
    }


    if (
        swingLows.length === 0
    ) {

        swingLows.push(
            Math.min(
                ...recent.map(
                    c => c.low
                )
            )
        );
    }


    let price =
        num(currentPrice);


    if (price === null) {

        const last =
            completed[
                completed.length - 1
            ];

        price =
            last
                ? last.close
                : null;
    }


    if (price === null) {

        return {

            r2: null,

            r1: null,

            s1: null,

            s2: null

        };
    }


    /*
       Remove duplicate / near-identical
       levels.
    */

    function uniqueLevels(
        levels
    ) {

        const sorted =
            [...levels].sort(
                (a, b) => a - b
            );


        const result = [];


        for (
            const level of sorted
        ) {

            if (
                !result.length ||
                Math.abs(
                    level -
                    result[result.length - 1]
                ) >= 0.00015
            ) {

                result.push(level);
            }
        }


        return result;
    }


    const uniqueHighs =
        uniqueLevels(
            swingHighs
        );


    const uniqueLows =
        uniqueLevels(
            swingLows
        );


    /*
       Resistance must be ABOVE current price.
    */

    const resistances =
        uniqueHighs
            .filter(
                level =>
                    level > price
            )
            .sort(
                (a, b) => a - b
            );


    /*
       Support must be BELOW current price.
    */

    const supports =
        uniqueLows
            .filter(
                level =>
                    level < price
            )
            .sort(
                (a, b) => b - a
            );


    /*
       If no swing is above/below current price,
       use historical extremes as fallback.
    */

    if (
        resistances.length === 0
    ) {

        const fallbackResistance =
            Math.max(
                ...recent.map(
                    c => c.high
                )
            );


        if (
            fallbackResistance > price
        ) {

            resistances.push(
                fallbackResistance
            );
        }
    }


    if (
        supports.length === 0
    ) {

        const fallbackSupport =
            Math.min(
                ...recent.map(
                    c => c.low
                )
            );


        if (
            fallbackSupport < price
        ) {

            supports.push(
                fallbackSupport
            );
        }
    }


    return {

        r1:
            resistances[0] ??
            null,

        r2:
            resistances[1] ??
            null,

        s1:
            supports[0] ??
            null,

        s2:
            supports[1] ??
            null

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

    const completed =
        getCompletedCandles(
            candles
        );


    if (

        !completed ||

        completed.length < 50

    ) {

        return "WAIT";
    }


    const ema20 =
        calculateEMA(
            completed,
            20
        );


    const ema50 =
        calculateEMA(
            completed,
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

    const completed =
        getCompletedCandles(
            candles
        );


    if (

        !completed ||

        completed.length < 50

    ) {

        return true;
    }


    const last =
        completed[
            completed.length - 1
        ];


    if (!last) {

        return true;
    }


    const ema20 =
        calculateEMA(
            completed,
            20
        );


    const ema50 =
        calculateEMA(
            completed,
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


    /*
       Absolute emergency extension protection.

       More than 20 pips from EMA20
       is considered excessive.

       The relative EMA gap rule remains
       active as an additional filter.
    */

    if (
        distance > 0.0020
    ) {

        return true;
    }


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
   REAL RR CALCULATION
   ========================================================= */

function calculateRR(
    entry,
    sl,
    tp
) {

    if (

        !Number.isFinite(entry) ||

        !Number.isFinite(sl) ||

        !Number.isFinite(tp)

    ) {

        return null;
    }


    const risk =
        Math.abs(
            entry -
            sl
        );


    const reward =
        Math.abs(
            tp -
            entry
        );


    if (
        risk <= 0
    ) {

        return null;
    }


    return reward / risk;
}


function formatRR(
    rr
) {

    if (
        !Number.isFinite(rr)
    ) {

        return "--";
    }


    return "1:" +
        rr.toFixed(2);
}


/* =========================================================
   STRUCTURAL RISK
   ========================================================= */

function calculateStructuralRisk(
    entry,
    direction,
    sr
) {

    if (

        !Number.isFinite(entry) ||

        !sr

    ) {

        return null;
    }


    let sl = null;


    if (
        direction === "SELL"
    ) {

        /*
           For SELL, resistance above entry
           is the structural invalidation area.

           Prefer R1 if it is reasonably close.
        */

        if (
            Number.isFinite(sr.r1) &&
            sr.r1 > entry
        ) {

            sl =
                sr.r1 +
                0.0002;

        }

    }

    else if (
        direction === "BUY"
    ) {

        /*
           For BUY, support below entry
           is the structural invalidation area.
        */

        if (
            Number.isFinite(sr.s1) &&
            sr.s1 < entry
        ) {

            sl =
                sr.s1 -
                0.0002;
        }
    }


    if (
        !Number.isFinite(sl)
    ) {

        return null;
    }


    const riskPips =
        Math.abs(
            entry -
            sl
        ) /
        pipSize();


    return {

        sl,

        riskPips

    };
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


    /*
       US closing / rollover.
    */

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


    /*
       London / US overlap.
    */

    if (

        totalMinutes >= 1050 &&

        totalMinutes < 1200

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


    /*
       London closing.
    */

    if (

        totalMinutes >= 1200 &&

        totalMinutes < 1230

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


    /*
       US session.
    */

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


    /*
       London session.
    */

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
            "INFORMATION UNAVAILABLE"
        );


        setText(
            "checkNews",
            "— News unavailable — engines remain independent"
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


    /*
       NEWS IS INFORMATIONAL ONLY.

       We still calculate and display the
       news window, but NO ENGINE uses this
       value as a trade blocker.
    */

    let informationEvent =
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

            informationEvent =
                event;

            break;
        }


        if (

            minutes < 0 &&

            minutes >= -15

        ) {

            informationEvent =
                event;

            break;
        }
    }


    newsState.blocked =
        informationEvent !== null;


    newsState.event =
        informationEvent;


    if (informationEvent) {

        newsState.currency =
            informationEvent.currency;

        newsState.minutesToEvent =

            (

                informationEvent.date -
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
            "HIGH IMPACT WINDOW — INFORMATION"
        );

    }

    else if (
        relevantEvents.length > 0
    ) {

        setText(
            "newsFilter",
            "HIGH IMPACT — INFORMATION"
        );

    }

    else {

        setText(
            "newsFilter",
            "CLEAR — INFORMATION ONLY"
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
            "HIGH — NEWS WINDOW — INFORMATION ONLY"
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
                "ELEVATED — NEWS SOON — INFORMATION ONLY"
            );

        }

        else {

            setText(
                "tradingRisk",
                "NORMAL — NEWS INFORMATION ONLY"
            );
        }

    }

    else {

        setText(
            "tradingRisk",
            "NORMAL — NEWS INFORMATION ONLY"
        );
    }


    setText(
        "checkNews",
        newsState.available

            ? "✓ News monitored — INFORMATION ONLY — does not block engines"

            : "— News unavailable — engines remain independent"
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
   =========================================================
   
   INTENTIONALLY FALSE.

   News is informational only.
   It never blocks Engine 1, 2 or 3.
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
        calculateRSI(
            getCompletedCandles(m5)
        );


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


    /*
       RSI protection.

       BUY:
       50 to below 70

       SELL:
       above 30 to below 50
    */

    const rsiSafeForBuy =
        rsi !== null &&
        rsi >= 50 &&
        rsi < 70;


    const rsiSafeForSell =
        rsi !== null &&
        rsi > 30 &&
        rsi < 50;


    const bearishConditions =

        directionCandidate === "SELL" &&

        m15Structure === "BEARISH" &&

        m5Structure === "BEARISH" &&

        ema === "BEARISH" &&

        momentum === "BEARISH" &&

        rsiSafeForSell &&

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

        rsiSafeForBuy &&

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


        let trigger =
            momentum;


        if (
            rsi === null
        ) {

            trigger =
                "RSI unavailable";

        }

        else if (
            directionCandidate === "BUY" &&
            rsi >= 70
        ) {

            trigger =
                "BUY blocked — RSI overbought";

        }

        else if (
            directionCandidate === "SELL" &&
            rsi <= 30
        ) {

            trigger =
                "SELL blocked — RSI oversold";

        }


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

            trigger,

            invalidation:
                "Alignment, RSI, momentum or extension protection missing",

            score:
                0

        };
    }


    const direction =
        directionCandidate;


    const entry =
        price;


    /*
       Engine 1 execution risk.

       10 pip structural baseline.
    */

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


    const rr1 =
        calculateRR(
            entry,
            sl,
            tp1
        );


    const rr2 =
        calculateRR(
            entry,
            sl,
            tp2
        );


    const rr3 =
        calculateRR(
            entry,
            sl,
            tp3
        );


    if (
        rr1 === null ||
        rr1 < 2
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
                "RR FAILED",

            trigger:
                "Minimum real 1:2 RR unavailable",

            invalidation:
                "Trade requires real RR >= 1:2",

            score:
                0

        };
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

            formatRR(rr1) +

            " / " +

            formatRR(rr2) +

            " / " +

            formatRR(rr3),

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
        calculateRSI(
            getCompletedCandles(m5)
        );


    const buyRSISafe =
        rsi !== null &&
        rsi >= 50 &&
        rsi < 70;


    const sellRSISafe =
        rsi !== null &&
        rsi > 30 &&
        rsi < 50;


    /*
       SELL SCALP
    */

    if (

        h1Trend === "BEARISH" &&

        m15Structure === "BEARISH" &&

        m5Structure === "BEARISH" &&

        ema === "BEARISH" &&

        momentum === "BEARISH" &&

        sellRSISafe &&

        getCandleQuality(
            m5,
            "SELL"
        ) &&

        !isEMAOverExtended(
            m5,
            "SELL"
        )

    ) {

        const entry =
            price;


        const riskPips =
            7;


        const sl =
            entry +
            riskPips *
            pipSize();


        const tp1 =
            entry -
            riskPips *
            2 *
            pipSize();


        const tp2 =
            entry -
            riskPips *
            3 *
            pipSize();


        const rr1 =
            calculateRR(
                entry,
                sl,
                tp1
            );


        const rr2 =
            calculateRR(
                entry,
                sl,
                tp2
            );


        if (
            rr1 !== null &&
            rr1 >= 2
        ) {

            return {

                verdict:
                    "A+ SCALP",

                direction:
                    "SELL",

                entry,

                sl,

                tp1,

                tp2,

                rr:

                    formatRR(rr1) +

                    " / " +

                    formatRR(rr2),

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
    }


    /*
       BUY SCALP
    */

    if (

        h1Trend === "BULLISH" &&

        m15Structure === "BULLISH" &&

        m5Structure === "BULLISH" &&

        ema === "BULLISH" &&

        momentum === "BULLISH" &&

        buyRSISafe &&

        getCandleQuality(
            m5,
            "BUY"
        ) &&

        !isEMAOverExtended(
            m5,
            "BUY"
        )

    ) {

        const entry =
            price;


        const riskPips =
            7;


        const sl =
            entry -
            riskPips *
            pipSize();


        const tp1 =
            entry +
            riskPips *
            2 *
            pipSize();


        const tp2 =
            entry +
            riskPips *
            3 *
            pipSize();


        const rr1 =
            calculateRR(
                entry,
                sl,
                tp1
            );


        const rr2 =
            calculateRR(
                entry,
                sl,
                tp2
            );


        if (
            rr1 !== null &&
            rr1 >= 2
        ) {

            return {

                verdict:
                    "A+ SCALP",

                direction:
                    "BUY",

                entry,

                sl,

                tp1,

                tp2,

                rr:

                    formatRR(rr1) +

                    " / " +

                    formatRR(rr2),

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
    }


    let trigger =
        "Confirmation missing";


    if (
        rsi !== null &&
        rsi >= 70
    ) {

        trigger =
            "BUY protection — RSI overbought";

    }

    else if (
        rsi !== null &&
        rsi <= 30
    ) {

        trigger =
            "SELL protection — RSI oversold";

    }

    else {

        trigger =
            momentum;
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

        trigger,

        invalidation:
            "Confirmation, RSI or extension protection missing"

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


/* =========================================================
   ELITE RSI PROTECTION
   ========================================================= */

function getEliteRSIProtection(
    rsi,
    direction
) {

    if (
        rsi === null ||
        !Number.isFinite(rsi)
    ) {

        return {

            valid: false,

            status:
                "RSI DATA UNAVAILABLE",

            reason:
                "RSI data unavailable"

        };
    }


    /*
       CONTINUATION PROTECTION

       BUY:
       50 <= RSI < 70

       SELL:
       30 < RSI < 50
    */

    if (
        direction === "BUY" &&
        rsi >= 70
    ) {

        return {

            valid: false,

            status:
                "RSI OVERBOUGHT",

            reason:
                "BUY blocked — RSI is 70+ (overbought)"

        };
    }


    if (
        direction === "SELL" &&
        rsi <= 30
    ) {

        return {

            valid: false,

            status:
                "RSI OVERSOLD",

            reason:
                "SELL blocked — RSI is 30 or below (oversold)"

        };
    }


    return {

        valid: true,

        status:
            "RSI PROTECTED",

        reason:
            "RSI is inside safe continuation zone"

    };
}


/* =========================================================
   RSI EXTREME DETECTION
   ========================================================= */

function getRSIExtremeType(
    rsi
) {

    if (
        rsi === null ||
        !Number.isFinite(rsi)
    ) {

        return "NONE";
    }


    if (
        rsi >= 70
    ) {

        return "OVERBOUGHT";
    }


    if (
        rsi <= 30
    ) {

        return "OVERSOLD";
    }


    return "NONE";
}


/* =========================================================
   ELITE EMA CALCULATION
   ========================================================= */

function calculateEliteEMA(
    candles,
    period
) {

    const completed =
        getCompletedCandles(
            candles
        );


    if (
        completed.length < period
    ) {

        return null;
    }


    const closes =
        completed
            .map(
                c =>
                    Number(
                        c.close
                    )
            )
            .filter(
                Number.isFinite
            );


    if (
        closes.length < period
    ) {

        return null;
    }


    let ema =
        closes
            .slice(
                0,
                period
            )
            .reduce(
                (sum, value) =>
                    sum + value,
                0
            ) / period;


    const multiplier =
        2 / (period + 1);


    for (
        let i = period;
        i < closes.length;
        i++
    ) {

        ema =
            (
                closes[i] - ema
            ) *
            multiplier +
            ema;
    }


    return ema;
}


/* =========================================================
   EMA EXTENSION PROTECTION
   ========================================================= */

function getEliteEMAExtension(
    candles,
    direction
) {

    const completed =
        getCompletedCandles(
            candles
        );


    if (
        !completed ||
        completed.length < 50
    ) {

        return {

            extended: false,

            distancePips: null,

            status:
                "EMA DATA UNAVAILABLE",

            reason:
                "Insufficient candle data"

        };
    }


    const last =
        completed[
            completed.length - 1
        ];


    const price =
        Number(
            last.close
        );


    const ema20 =
        calculateEliteEMA(
            candles,
            20
        );


    const ema50 =
        calculateEliteEMA(
            candles,
            50
        );


    if (
        !Number.isFinite(price) ||
        ema20 === null ||
        ema50 === null
    ) {

        return {

            extended: false,

            distancePips: null,

            status:
                "EMA DATA UNAVAILABLE",

            reason:
                "Unable to calculate EMA extension"

        };
    }


    const distance =
        Math.abs(
            price -
            ema20
        );


    const distancePips =
        distance * 10000;


    const extended =
        distancePips > 12;


    if (extended) {

        return {

            extended: true,

            distancePips:
                Number(
                    distancePips.toFixed(1)
                ),

            status:
                "EMA OVER-EXTENDED",

            reason:
                "Price is more than 12 pips from EMA20"

        };
    }


    return {

        extended: false,

        distancePips:
            Number(
                distancePips.toFixed(1)
            ),

        status:
            "EMA EXTENSION SAFE",

        reason:
            "Price is within acceptable EMA20 distance"

    };
}


/* =========================================================
   REVERSAL CANDLE DETECTION
   ========================================================= */

function getEliteReversalCandle(
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


    const open =
        Number(candle.open);


    const close =
        Number(candle.close);


    const high =
        Number(candle.high);


    const low =
        Number(candle.low);


    if (
        !Number.isFinite(open) ||
        !Number.isFinite(close) ||
        !Number.isFinite(high) ||
        !Number.isFinite(low)
    ) {

        return false;
    }


    const range =
        high - low;


    if (
        range <= 0
    ) {

        return false;
    }


    const body =
        Math.abs(
            close -
            open
        );


    const upperWick =
        high -
        Math.max(
            open,
            close
        );


    const lowerWick =
        Math.min(
            open,
            close
        ) -
        low;


    const bodyRatio =
        body / range;


    if (
        direction === "BUY"
    ) {

        return (

            close > open &&

            bodyRatio >= 0.35 &&

            lowerWick >=
                body * 0.8

        );
    }


    if (
        direction === "SELL"
    ) {

        return (

            close < open &&

            bodyRatio >= 0.35 &&

            upperWick >=
                body * 0.8

        );
    }


    return false;
}


/* =========================================================
   REVERSAL STRUCTURE DETECTION
   ========================================================= */

function getEliteReversalStructure(
    candles,
    direction
) {

    const completed =
        getCompletedCandles(
            candles
        );


    if (
        !completed ||
        completed.length < 4
    ) {

        return false;
    }


    const c1 =
        completed[
            completed.length - 2
        ];


    const c2 =
        completed[
            completed.length - 1
        ];


    const previousHigh =
        Number(c1.high);


    const previousLow =
        Number(c1.low);


    const currentClose =
        Number(c2.close);


    if (
        !Number.isFinite(previousHigh) ||
        !Number.isFinite(previousLow) ||
        !Number.isFinite(currentClose)
    ) {

        return false;
    }


    if (
        direction === "BUY"
    ) {

        return (
            currentClose >
            previousHigh
        );
    }


    if (
        direction === "SELL"
    ) {

        return (
            currentClose <
            previousLow
        );
    }


    return false;
}


/* =========================================================
   A+ REVERSAL SETUP
   ========================================================= */

function evaluateEliteReversal(
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


    const m5RSI =
        calculateRSI(
            getCompletedCandles(m5)
        );


    const rsiExtreme =
        getRSIExtremeType(
            m5RSI
        );


    /*
       BUY REVERSAL

       HTF bearish
       +
       RSI oversold
       +
       M15 bullish
       +
       M5 bullish
       +
       bullish reversal candle
       +
       bullish structure shift
    */

    const buyReversal =

        h4Trend === "BEARISH" &&

        h1Trend === "BEARISH" &&

        rsiExtreme === "OVERSOLD" &&

        m15Structure === "BULLISH" &&

        m5Structure === "BULLISH" &&

        getEliteReversalCandle(
            m5,
            "BUY"
        ) &&

        getEliteReversalStructure(
            m5,
            "BUY"
        );


    /*
       SELL REVERSAL

       HTF bullish
       +
       RSI overbought
       +
       M15 bearish
       +
       M5 bearish
       +
       bearish reversal candle
       +
       bearish structure shift
    */

    const sellReversal =

        h4Trend === "BULLISH" &&

        h1Trend === "BULLISH" &&

        rsiExtreme === "OVERBOUGHT" &&

        m15Structure === "BEARISH" &&

        m5Structure === "BEARISH" &&

        getEliteReversalCandle(
            m5,
            "SELL"
        ) &&

        getEliteReversalStructure(
            m5,
            "SELL"
        );


    if (buyReversal) {

        return {

            valid:
                true,

            direction:
                "BUY",

            type:
                "A+ REVERSAL",

            reason:
                "Oversold RSI + M15/M5 bullish reversal + structure shift"

        };
    }


    if (sellReversal) {

        return {

            valid:
                true,

            direction:
                "SELL",

            type:
                "A+ REVERSAL",

            reason:
                "Overbought RSI + M15/M5 bearish reversal + structure shift"

        };
    }


    return {

        valid:
            false,

        direction:
            "--",

        type:
            "NONE",

        reason:
            "A+ reversal confirmation incomplete"

    };
}


/* =========================================================
   ELITE SESSION PROTECTION
   ========================================================= */

function getEliteSessionProtection(
    sessionInfo
) {

    if (
        !sessionInfo
    ) {

        return {

            valid:
                false,

            reason:
                "Session information unavailable"

        };
    }


    const sessionName =
        String(
            sessionInfo.name ||
            ""
        ).toUpperCase();


    if (
        sessionName.includes(
            "OFF"
        )
    ) {

        return {

            valid:
                false,

            reason:
                "OFF SESSION — trade execution blocked"

        };
    }


    return {

        valid:
            true,

        reason:
            "Active trading session"

    };
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
        calculateRSI(
            getCompletedCandles(m5)
        );


    const rsiExtreme =
        getRSIExtremeType(
            rsi
        );


    /*
       HTF DIRECTION
    */

    const continuationDirection =

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
        continuationDirection
    );


    /*
       SESSION PROTECTION
    */

    const sessionProtection =
        getEliteSessionProtection(
            sessionInfo
        );


    /*
       REVERSAL CHECK
    */

    const reversal =
        evaluateEliteReversal(

            h4,

            h1,

            m15,

            m5

        );


    /*
       =====================================================
       NO HTF CONTINUATION ALIGNMENT
       =====================================================
    */

    if (
        continuationDirection === "--"
    ) {

        if (
            reversal.valid &&
            sessionProtection.valid
        ) {

            const entry =
                price;


            const sr =
                calculateSR(
                    h1,
                    entry
                );


            const structural =
                calculateStructuralRisk(

                    entry,

                    reversal.direction,

                    sr

                );


            let sl;

            let riskPips;


            /*
               For reversal trades, if structural
               S/R is usable and within 3–15 pips,
               use it.

               Otherwise use 10-pip emergency
               baseline.
            */

            if (

                structural &&

                structural.riskPips >= 3 &&

                structural.riskPips <= 15

            ) {

                sl =
                    structural.sl;

                riskPips =
                    structural.riskPips;

            }

            else {

                riskPips =
                    10;


                if (
                    reversal.direction ===
                    "BUY"
                ) {

                    sl =
                        entry -
                        0.0010;

                }

                else {

                    sl =
                        entry +
                        0.0010;
                }
            }


            let tp1;

            let tp2;


            if (
                reversal.direction ===
                "BUY"
            ) {

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

            }

            else {

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
            }


            /*
               Validate real RR.
            */

            const rr1 =
                calculateRR(
                    entry,
                    sl,
                    tp1
                );


            const rr2 =
                calculateRR(
                    entry,
                    sl,
                    tp2
                );


            if (

                rr1 !== null &&

                rr1 >= 2 &&

                rr2 !== null &&

                rr2 >= 2

            ) {

                startGateSetup();


                setText(
                    "gateDirection",
                    reversal.direction
                );


                setText(
                    "eliteTradeGate",
                    "A+ REVERSAL READY"
                );


                setText(
                    "gateReason",
                    reversal.reason +
                    " — NEWS INFORMATION ONLY"
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

                    formatRR(rr1) +

                    " / " +

                    formatRR(rr2)

                );


                setText(
                    "gateRisk",
                    Number(
                        riskPips.toFixed(1)
                    ) +
                    " pips"
                );


                setText(
                    "gateSetupTime",
                    gateSetupTime
                );


                return;
            }
        }


        invalidateGateSetup();


        setText(
            "eliteTradeGate",
            "STAY AWAY"
        );


        setText(
            "gateReason",
            reversal.reason
        );


        clearGateTradeValues();


        return;
    }


    /*
       =====================================================
       NORMAL CONTINUATION GATE
       =====================================================
    */

    const m15OK =

        continuationDirection === "SELL"

            ? m15Structure === "BEARISH"

            : m15Structure === "BULLISH";


    const m5OK =

        continuationDirection === "SELL"

            ? m5Structure === "BEARISH"

            : m5Structure === "BULLISH";


    const emaOK =

        continuationDirection === "SELL"

            ? ema === "BEARISH"

            : ema === "BULLISH";


    /*
       RSI directional confirmation.
    */

    const rsiDirectionOK =

        continuationDirection === "SELL"

            ? rsi !== null &&
              rsi < 50

            : rsi !== null &&
              rsi >= 50;


    /*
       RSI 30/70 protection.
    */

    const rsiProtection =
        getEliteRSIProtection(

            rsi,

            continuationDirection

        );


    const rsiOK =
        rsiDirectionOK &&
        rsiProtection.valid;


    const momentumOK =

        continuationDirection === "SELL"

            ? momentum === "BEARISH"

            : momentum === "BULLISH";


    const candleOK =
        getCandleQuality(
            m5,
            continuationDirection
        );


    /*
       EMA extension.
    */

    const emaExtension =
        getEliteEMAExtension(
            m5,
            continuationDirection
        );


    const extensionOK =
        !emaExtension.extended;


    /*
       =====================================================
       STRUCTURAL S/R + RISK
       =====================================================
    */

    const sr =
        calculateSR(
            h1,
            price
        );


    const structural =
        calculateStructuralRisk(

            price,

            continuationDirection,

            sr

        );


    let riskPips;

    let sl;


    if (structural) {

        riskPips =
            structural.riskPips;

        sl =
            structural.sl;

    }

    else {

        /*
           If structural S/R cannot provide
           a usable SL, use the 10-pip baseline.

           This is still checked against the
           3–15 pip risk rule.
        */

        riskPips =
            10;


        if (
            continuationDirection ===
            "SELL"
        ) {

            sl =
                price +
                0.0010;

        }

        else {

            sl =
                price -
                0.0010;
        }
    }


    const riskOK =

        Number.isFinite(riskPips) &&

        riskPips >= 3 &&

        riskPips <= 15;


    /*
       =====================================================
       TP2 + REAL RR
       =====================================================
    */

    let tp1;

    let tp2;


    if (
        continuationDirection ===
        "SELL"
    ) {

        tp1 =
            price +
            (
                sl -
                price
            ) *
            2 *
            -1;


        /*
           Use explicit distance instead.
        */

        tp1 =
            price -
            riskPips *
            2 *
            pipSize();


        tp2 =
            price -
            riskPips *
            3 *
            pipSize();

    }

    else {

        tp1 =
            price +
            riskPips *
            2 *
            pipSize();


        tp2 =
            price +
            riskPips *
            3 *
            pipSize();
    }


    /*
       S/R target validation.

       For SELL, R levels don't block a target,
       but support can interfere with the path.

       For BUY, resistance can interfere.

       We therefore verify TP2 has at least
       a minimal structural room.
    */

    let srPathOK =
        true;


    if (
        continuationDirection ===
        "SELL"
    ) {

        if (
            Number.isFinite(sr.s1) &&
            sr.s1 < price &&
            sr.s1 > tp1
        ) {

            srPathOK =
                false;
        }

    }

    else {

        if (
            Number.isFinite(sr.r1) &&
            sr.r1 > price &&
            sr.r1 < tp1
        ) {

            srPathOK =
                false;
        }
    }


    /*
       REAL RR.
    */

    const rr1 =
        calculateRR(
            price,
            sl,
            tp1
        );


    const rr2 =
        calculateRR(
            price,
            sl,
            tp2
        );


    const rrOK =

        rr1 !== null &&

        rr1 >= 2 &&

        rr2 !== null &&

        rr2 >= 2;


    /*
       Session.
    */

    const sessionOK =
        sessionProtection.valid;


    /*
       NEWS IS INTENTIONALLY NOT INCLUDED.

       There is NO:
       newsState.blocked
       isNewsBlocked()
       news currency check

       inside gateOK.
    */

    const gateOK =

        m15OK &&

        m5OK &&

        emaOK &&

        rsiOK &&

        momentumOK &&

        candleOK &&

        extensionOK &&

        riskOK &&

        rrOK &&

        srPathOK &&

        sessionOK;


    /*
       =====================================================
       REJECTION LOGIC
       =====================================================
    */

    if (!gateOK) {

        invalidateGateSetup();


        setText(
            "eliteTradeGate",
            "STAY AWAY"
        );


        let reason =
            "Confirmation incomplete";


        if (!sessionOK) {

            reason =
                sessionProtection.reason;

        }

        else if (
            rsi === null ||
            !Number.isFinite(rsi)
        ) {

            reason =
                "RSI data unavailable";

        }

        else if (
            continuationDirection === "BUY" &&
            rsi >= 70
        ) {

            reason =
                "BUY blocked — RSI overbought (70+)";

        }

        else if (
            continuationDirection === "SELL" &&
            rsi <= 30
        ) {

            reason =
                "SELL blocked — RSI oversold (30-)";

        }

        else if (!m15OK) {

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

        else if (!rsiDirectionOK) {

            reason =
                "M5 RSI directional confirmation missing";

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
                "Price excessively extended from EMA20";

        }

        else if (!riskOK) {

            reason =
                "Structural risk outside 3–15 pip range";

        }

        else if (!rrOK) {

            reason =
                "Real minimum 1:2 Risk / Reward unavailable";

        }

        else if (!srPathOK) {

            reason =
                "Nearby higher-timeframe S/R blocks TP path";

        }


        setText(
            "gateReason",
            reason
        );


        clearGateTradeValues();


        return;
    }


    /*
       =====================================================
       A+ CONTINUATION READY
       =====================================================
    */

    startGateSetup();


    setText(
        "eliteTradeGate",
        "A+ TRADE READY"
    );


    setText(
        "gateReason",

        session +

        " — " +

        sessionInfo.quality +

        " — all Elite Gate confirmations aligned — NEWS INFORMATION ONLY"

    );


    setText(
        "gateEntry",
        formatPrice(price)
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

        formatRR(rr1) +

        " / " +

        formatRR(rr2)

    );


    setText(
        "gateRisk",
        Number(
            riskPips.toFixed(1)
        ) +
        " pips"
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


    setText(
        "gateSetupTime",
        "--"
    );
}


/* =========================================================
   ENGINE 3 CHECKLIST
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
        calculateRSI(
            getCompletedCandles(m5)
        );


    const momentum =
        getMomentum(m5);


    const sessionInfo =
        getSessionInfo();


    const sessionProtection =
        getEliteSessionProtection(
            sessionInfo
        );


    const direction =

        h4Trend === "BULLISH" &&

        h1Trend === "BULLISH"

            ? "BULLISH"

            :

        h4Trend === "BEARISH" &&

        h1Trend === "BEARISH"

            ? "BEARISH"

            : "--";


    /*
       SESSION
    */

    setText(

        "checkSession",

        sessionProtection.valid

            ? "✓ " + sessionInfo.name

            : "— " +
              sessionInfo.name +
              " — execution blocked"

    );


    /*
       HTF
    */

    setText(

        "checkHtf",

        direction !== "--"

            ? "✓ H4 + H1 directional alignment"

            : "— H4 + H1 directional alignment"

    );


    /*
       M15
    */

    setText(

        "checkM15",

        m15Structure === direction

            ? "✓ M15 confirmation"

            : "— M15 confirmation"

    );


    /*
       M5
    */

    setText(

        "checkM5",

        m5Structure === direction

            ? "✓ M5 confirmation"

            : "— M5 confirmation"

    );


    /*
       EMA
    */

    setText(

        "checkEMA",

        ema === direction

            ? "✓ M5 EMA20 / EMA50 alignment"

            : "— M5 EMA20 / EMA50 alignment"

    );


    /*
       RSI
    */

    const rsiExtreme =
        getRSIExtremeType(
            rsi
        );


    let rsiText =
        "— RSI confirmation";


    if (
        direction === "BEARISH"
    ) {

        if (
            rsiExtreme ===
            "OVERSOLD"
        ) {

            rsiText =
                "⚠ RSI OVERSOLD — SELL PROTECTED";

        }

        else if (
            rsi !== null &&
            rsi < 50
        ) {

            rsiText =
                "✓ RSI bearish + safe zone";

        }

    }

    else if (
        direction === "BULLISH"
    ) {

        if (
            rsiExtreme ===
            "OVERBOUGHT"
        ) {

            rsiText =
                "⚠ RSI OVERBOUGHT — BUY PROTECTED";

        }

        else if (
            rsi !== null &&
            rsi >= 50
        ) {

            rsiText =
                "✓ RSI bullish + safe zone";

        }

    }


    setText(
        "checkRSI",
        rsiText
    );


    /*
       MOMENTUM
    */

    setText(

        "checkMomentum",

        momentum === direction

            ? "✓ Completed M5 momentum candle"

            : "— Completed M5 momentum candle"

    );


    /*
       EMA EXTENSION
    */

    const extension =
        direction !== "--"

            ? getEliteEMAExtension(
                m5,
                direction
            )

            : {

                extended:
                    false

            };


    const extensionOK =
        !extension.extended;


    setText(

        "checkExtension",

        extensionOK

            ? "✓ EMA extension safe"

            : "— EMA excessively extended"

    );


    /*
       RISK + RR

       Calculate actual current structural
       values for display.
    */

    const sr =
        calculateSR(
            h1
        );


    let checkRiskText =
        "— Structural risk unavailable";


    let checkRRText =
        "— Real RR unavailable";


    if (
        direction !== "--"
    ) {

        const referencePrice =
            getMarketPrice(m5);


        const structural =
            calculateStructuralRisk(

                referencePrice,

                direction,

                calculateSR(
                    h1,
                    referencePrice
                )

            );


        let riskPips =
            structural
                ? structural.riskPips
                : 10;


        checkRiskText =

            Number.isFinite(
                riskPips
            ) &&

            riskPips >= 3 &&

            riskPips <= 15

                ? "✓ Risk " +
                  Number(
                      riskPips.toFixed(1)
                  ) +
                  " pips — 3–15 range"

                : "— Risk outside 3–15 pip range";


        let sl;


        if (
            structural
        ) {

            sl =
                structural.sl;

        }

        else if (
            direction === "SELL"
        ) {

            sl =
                referencePrice +
                0.0010;

        }

        else {

            sl =
                referencePrice -
                0.0010;
        }


        let tp2;


        if (
            direction === "SELL"
        ) {

            tp2 =
                referencePrice -
                riskPips *
                3 *
                pipSize();

        }

        else {

            tp2 =
                referencePrice +
                riskPips *
                3 *
                pipSize();
        }


        const rr =
            calculateRR(

                referencePrice,

                sl,

                tp2

            );


        checkRRText =

            rr !== null &&

            rr >= 2

                ? "✓ Real RR " +
                  formatRR(rr)

                : "— Real RR below 1:2";
    }


    setText(
        "checkRisk",
        checkRiskText
    );


    setText(
        "checkRR",
        checkRRText
    );


    /*
       S/R
    */

    const referencePrice =
        getMarketPrice(m5);


    const currentSR =
        calculateSR(
            h1,
            referencePrice
        );


    let srText =
        "— S/R unavailable";


    if (
        currentSR
    ) {

        const parts = [];


        if (
            Number.isFinite(
                currentSR.s1
            )
        ) {

            parts.push(
                "S1 " +
                formatPrice(
                    currentSR.s1
                )
            );
        }


        if (
            Number.isFinite(
                currentSR.s2
            )
        ) {

            parts.push(
                "S2 " +
                formatPrice(
                    currentSR.s2
                )
            );
        }


        if (
            Number.isFinite(
                currentSR.r1
            )
        ) {

            parts.push(
                "R1 " +
                formatPrice(
                    currentSR.r1
                )
            );
        }


        if (
            Number.isFinite(
                currentSR.r2
            )
        ) {

            parts.push(
                "R2 " +
                formatPrice(
                    currentSR.r2
                )
            );
        }


        if (
            parts.length > 0
        ) {

            srText =
                "✓ " +
                parts.join(
                    " | "
                );
        }
    }


    setText(
        "checkSR",
        srText
    );


    /*
       NEWS — INFORMATION ONLY
    */

    setText(

        "checkNews",

        newsState.available

            ? "✓ NEWS INFORMATION ONLY — NO ENGINE BLOCK"

            : "— News unavailable — no engine block"

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
        calculateRSI(
            getCompletedCandles(h4)
        );


    const h1RSI =
        calculateRSI(
            getCompletedCandles(h1)
        );


    const m15RSI =
        calculateRSI(
            getCompletedCandles(m15)
        );


    const m5RSI =
        calculateRSI(
            getCompletedCandles(m5)
        );


    const ema =
        getEMADirection(m5);


    const sr =
        calculateSR(
            h1,
            price
        );


    /*
       LIVE MARKET PRICE
    */

    setText(
        "livePrice",
        formatPrice(price)
    );


    /*
       CHART
    */

    createPriceChartContainer();


    renderPriceChart(
        getSelectedChartData()
    );


    setText(
        "dataStatus",
        "● LIVE"
    );


    /*
       H4 / H1
    */

    setText(
        "h4Bias",
        h4Trend
    );


    setText(
        "h1Bias",
        h1Trend
    );


    /*
       M15 / M5
    */

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


    /*
       PRICE-AWARE S/R
    */

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


    /*
       RSI
    */

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
           TECHNICAL DATA
        */

        displayTechnicalData(

            price,

            h4,

            h1,

            m15,

            m5

        );


        /*
           =================================================
           NEWS
           =================================================

           NEWS IS INFORMATION ONLY.

           It does NOT block any engine.
        */

        await loadNews();


        /*
           =================================================
           ENGINE 1
           =================================================
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
           =================================================
           ENGINE 2
           =================================================
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
           =================================================
           ENGINE 3
           =================================================
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

        createPriceChartContainer();

        loadMarketData();

    }

);
