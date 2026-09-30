const API_KEY = "8908432b6c784bc49aad6ccf64845991";

const SYMBOL = "EUR/USD";
const REFRESH_MS = 60000;


// =====================================================
// MAIN DASHBOARD
// =====================================================

async function refreshDashboard() {

    const priceElement = document.getElementById("price");
    const trendElement = document.getElementById("trend");

    try {

        trendElement.innerText = "Loading market analysis...";

        // -------------------------------------------------
        // LIVE PRICE
        // -------------------------------------------------

        const priceResponse = await fetch(
            `https://api.twelvedata.com/price?symbol=${encodeURIComponent(SYMBOL)}&apikey=${API_KEY}`
        );

        const priceData = await priceResponse.json();

        if (priceData.status === "error") {
            throw new Error(priceData.message);
        }

        const price = Number(priceData.price);

        if (!Number.isFinite(price)) {
            throw new Error("Invalid live price");
        }

        priceElement.innerText = price.toFixed(5);


        // -------------------------------------------------
        // GET MULTI-TIMEFRAME DATA
        // -------------------------------------------------

        const h1 = await getCandles("1h", 150);
        const m15 = await getCandles("15min", 150);
        const m5 = await getCandles("5min", 150);


        // -------------------------------------------------
        // ANALYSE
        // -------------------------------------------------

        const h1Analysis = analyseTimeframe(h1);
        const m15Analysis = analyseTimeframe(m15);
        const m5Analysis = analyseTimeframe(m5);


        // -------------------------------------------------
        // MARKET STRUCTURE
        // -------------------------------------------------

        setText("h1Trend", h1Analysis.trend);
        setText("m15Structure", m15Analysis.structure);
        setText("m5Structure", m5Analysis.structure);


        // -------------------------------------------------
        // SUPPORT / RESISTANCE
        // -------------------------------------------------

        const levels = findSupportResistance(h1, price);

        setText(
            "resistance1",
            formatPrice(levels.resistance1)
        );

        setText(
            "resistance2",
            formatPrice(levels.resistance2)
        );

        setText(
            "support1",
            formatPrice(levels.support1)
        );

        setText(
            "support2",
            formatPrice(levels.support2)
        );


        // -------------------------------------------------
        // RSI
        // -------------------------------------------------

        setText(
            "h1Rsi",
            formatNumber(h1Analysis.rsi, 2)
        );

        setText(
            "m15Rsi",
            formatNumber(m15Analysis.rsi, 2)
        );

        setText(
            "m5Rsi",
            formatNumber(m5Analysis.rsi, 2)
        );


        // -------------------------------------------------
        // EMA STRUCTURE
        // -------------------------------------------------

        setText(
            "emaStructure",
            "H1: " +
            formatPrice(h1Analysis.ema20) +
            " / " +
            formatPrice(h1Analysis.ema50)
        );


        // -------------------------------------------------
        // SNIPER ENGINE
        // -------------------------------------------------

        buildSniperSetup(
            price,
            h1Analysis,
            m15Analysis,
            m5Analysis,
            levels
        );


        // -------------------------------------------------
        // STATUS
        // -------------------------------------------------

        trendElement.innerText =
            "Twelve Data connected • Updated: " +
            new Date().toLocaleTimeString();

    }

    catch (error) {

        console.error("Dashboard error:", error);

        trendElement.innerText =
            "Analysis error: " + error.message;
    }
}


// =====================================================
// GET CANDLES
// =====================================================

async function getCandles(interval, outputsize) {

    const url =
        "https://api.twelvedata.com/time_series" +
        "?symbol=" + encodeURIComponent(SYMBOL) +
        "&interval=" + interval +
        "&outputsize=" + outputsize +
        "&apikey=" + API_KEY;

    const response = await fetch(url);

    const data = await response.json();

    if (data.status === "error") {
        throw new Error(
            interval + ": " + data.message
        );
    }

    if (!data.values || data.values.length < 60) {
        throw new Error(
            interval + ": not enough candle data"
        );
    }

    return data.values
        .map(candle => ({
            datetime: candle.datetime,
            open: Number(candle.open),
            high: Number(candle.high),
            low: Number(candle.low),
            close: Number(candle.close)
        }))
        .filter(candle =>
            Number.isFinite(candle.open) &&
            Number.isFinite(candle.high) &&
            Number.isFinite(candle.low) &&
            Number.isFinite(candle.close)
        )
        .reverse();
}


// =====================================================
// TIMEFRAME ANALYSIS
// =====================================================

function analyseTimeframe(candles) {

    const closes =
        candles.map(candle => candle.close);

    const ema20Array =
        calculateEMA(closes, 20);

    const ema50Array =
        calculateEMA(closes, 50);

    const rsiArray =
        calculateRSI(closes, 14);

    const last =
        candles[candles.length - 1];

    const ema20 =
        ema20Array[ema20Array.length - 1];

    const ema50 =
        ema50Array[ema50Array.length - 1];

    const rsi =
        rsiArray[rsiArray.length - 1];


    let trend = "NEUTRAL";


    if (
        last.close > ema20 &&
        ema20 > ema50
    ) {
        trend = "BULLISH";
    }

    else if (
        last.close < ema20 &&
        ema20 < ema50
    ) {
        trend = "BEARISH";
    }


    return {

        close: last.close,

        ema20: ema20,

        ema50: ema50,

        rsi: rsi,

        trend: trend,

        structure:
            getMarketStructure(candles)
    };
}


// =====================================================
// EMA
// =====================================================

function calculateEMA(values, period) {

    if (values.length < period) {
        return [];
    }

    const multiplier =
        2 / (period + 1);

    let ema = 0;

    for (
        let i = 0;
        i < period;
        i++
    ) {
        ema += values[i];
    }

    ema /= period;

    const result =
        new Array(period - 1).fill(null);

    result.push(ema);


    for (
        let i = period;
        i < values.length;
        i++
    ) {

        ema =
            (
                values[i] - ema
            ) *
            multiplier +
            ema;

        result.push(ema);
    }

    return result;
}


// =====================================================
// RSI
// =====================================================

function calculateRSI(values, period) {

    if (values.length <= period) {
        return [];
    }

    let gains = 0;
    let losses = 0;


    for (
        let i = 1;
        i <= period;
        i++
    ) {

        const change =
            values[i] - values[i - 1];

        if (change > 0) {
            gains += change;
        }
        else {
            losses += Math.abs(change);
        }
    }


    let averageGain =
        gains / period;

    let averageLoss =
        losses / period;


    const result =
        new Array(period).fill(null);


    for (
        let i = period;
        i < values.length;
        i++
    ) {

        if (i > period) {

            const change =
                values[i] - values[i - 1];

            const gain =
                change > 0 ? change : 0;

            const loss =
                change < 0 ? Math.abs(change) : 0;


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

            result.push(100);

        }

        else {

            const rs =
                averageGain /
                averageLoss;

            result.push(
                100 -
                (100 / (1 + rs))
            );
        }
    }

    return result;
}


// =====================================================
// MARKET STRUCTURE
// =====================================================

function getMarketStructure(candles) {

    const recent =
        candles.slice(-50);

    const highs = [];
    const lows = [];


    for (
        let i = 2;
        i < recent.length - 2;
        i++
    ) {

        const current =
            recent[i];


        if (
            current.high >
            recent[i - 1].high &&
            current.high >
            recent[i - 2].high &&
            current.high >
            recent[i + 1].high &&
            current.high >
            recent[i + 2].high
        ) {

            highs.push(current.high);
        }


        if (
            current.low <
            recent[i - 1].low &&
            current.low <
            recent[i - 2].low &&
            current.low <
            recent[i + 1].low &&
            current.low <
            recent[i + 2].low
        ) {

            lows.push(current.low);
        }
    }


    if (
        highs.length >= 2 &&
        lows.length >= 2
    ) {

        const h1 =
            highs[highs.length - 1];

        const h2 =
            highs[highs.length - 2];

        const l1 =
            lows[lows.length - 1];

        const l2 =
            lows[lows.length - 2];


        if (
            h1 > h2 &&
            l1 > l2
        ) {

            return "BULLISH HH / HL";
        }


        if (
            h1 < h2 &&
            l1 < l2
        ) {

            return "BEARISH LH / LL";
        }
    }


    return "RANGE / TRANSITION";
}


// =====================================================
// SUPPORT & RESISTANCE
// =====================================================

function findSupportResistance(candles, price) {

    const recent =
        candles.slice(-100);

    const resistanceCandidates = [];
    const supportCandidates = [];


    for (
        let i = 2;
        i < recent.length - 2;
        i++
    ) {

        const candle =
            recent[i];


        // LOCAL HIGH

        if (
            candle.high >
            recent[i - 1].high &&
            candle.high >
            recent[i - 2].high &&
            candle.high >
            recent[i + 1].high &&
            candle.high >
            recent[i + 2].high
        ) {

            if (candle.high > price) {
                resistanceCandidates.push(
                    candle.high
                );
            }
        }


        // LOCAL LOW

        if (
            candle.low <
            recent[i - 1].low &&
            candle.low <
            recent[i - 2].low &&
            candle.low <
            recent[i + 1].low &&
            candle.low <
            recent[i + 2].low
        ) {

            if (candle.low < price) {
                supportCandidates.push(
                    candle.low
                );
            }
        }
    }


    resistanceCandidates.sort(
        (a, b) => a - b
    );

    supportCandidates.sort(
        (a, b) => b - a
    );


    return {

        resistance1:
            resistanceCandidates[0] ?? null,

        resistance2:
            resistanceCandidates[1] ?? null,

        support1:
            supportCandidates[0] ?? null,

        support2:
            supportCandidates[1] ?? null
    };
}


// =====================================================
// SNIPER SETUP ENGINE
// =====================================================

function buildSniperSetup(
    price,
    h1,
    m15,
    m5,
    levels
) {

    const status =
        document.getElementById("setupStatus");


    // -------------------------------------------------
    // RESET
    // -------------------------------------------------

    setText("direction", "WAIT");
    setText("entry", "—");
    setText("stopLoss", "—");
    setText("tp1", "—");
    setText("tp2", "—");
    setText("tp3", "—");
    setText("riskReward", "—");
    setText("validity", "—");
    setText("trigger", "—");
    setText("invalidation", "—");


    // -------------------------------------------------
    // SCORE
    // -------------------------------------------------

    let buyScore = 0;
    let sellScore = 0;


    // H1 TREND

    if (h1.trend === "BULLISH") {
        buyScore += 3;
    }

    if (h1.trend === "BEARISH") {
        sellScore += 3;
    }


    // M15 TREND

    if (m15.trend === "BULLISH") {
        buyScore += 2;
    }

    if (m15.trend === "BEARISH") {
        sellScore += 2;
    }


    // M5 TREND

    if (m5.trend === "BULLISH") {
        buyScore += 2;
    }

    if (m5.trend === "BEARISH") {
        sellScore += 2;
    }


    // RSI CONFIRMATION

    if (
        h1.rsi > 50 &&
        m15.rsi > 50
    ) {
        buyScore += 1;
    }

    if (
        h1.rsi < 50 &&
        m15.rsi < 50
    ) {
        sellScore += 1;
    }


    // AVOID EXTREME RSI CHASES

    if (
        m5.rsi > 70
    ) {
        buyScore -= 1;
    }

    if (
        m5.rsi < 30
    ) {
        sellScore -= 1;
    }


    // -------------------------------------------------
    // DETERMINE BIAS
    // -------------------------------------------------

    let direction = "WAIT";

    let score = 0;


    if (
        buyScore >= 7 &&
        buyScore > sellScore
    ) {

        direction = "BUY";
        score = buyScore;

    }

    else if (
        sellScore >= 7 &&
        sellScore > buyScore
    ) {

        direction = "SELL";
        score = sellScore;
    }


    // -------------------------------------------------
    // WAIT
    // -------------------------------------------------

    if (direction === "WAIT") {

        status.innerText =
            "WAIT — No A+ multi-timeframe alignment.";

        status.className =
            "wait";


        setText(
            "proVerdict",
            "STAY OUT — No A+ setup."
        );

        return;
    }


    // -------------------------------------------------
    // DETERMINE ENTRY / SL / TARGETS
    // -------------------------------------------------

    let entry;
    let stopLoss;
    let tp1;
    let tp2;
    let tp3;


    const pip =
        0.0001;


    // -------------------------------------------------
    // BUY SETUP
    // -------------------------------------------------

    if (direction === "BUY") {

        entry =
            levels.support1 &&
            levels.support1 < price
                ? levels.support1
                : price;


        stopLoss =
            entry - (10 * pip);


        tp1 =
            entry + (10 * pip);


        tp2 =
            entry + (20 * pip);


        tp3 =
            entry + (30 * pip);


        // If resistance is closer,
        // use it as a realistic target.

        if (
            levels.resistance1 &&
            levels.resistance1 > entry
        ) {

            if (
                levels.resistance1 <
                tp3
            ) {
                tp3 =
                    levels.resistance1;
            }

            if (
                levels.resistance1 <
                tp2
            ) {
                tp2 =
                    levels.resistance1;
            }
        }
    }


    // -------------------------------------------------
    // SELL SETUP
    // -------------------------------------------------

    if (direction === "SELL") {

        entry =
            levels.resistance1 &&
            levels.resistance1 > price
                ? levels.resistance1
                : price;


        stopLoss =
            entry + (10 * pip);


        tp1 =
            entry - (10 * pip);


        tp2 =
            entry - (20 * pip);


        tp3 =
            entry - (30 * pip);


        // Use support as realistic target

        if (
            levels.support1 &&
            levels.support1 < entry
        ) {

            if (
                levels.support1 >
                tp1
            ) {
                tp1 =
                    levels.support1;
            }

            if (
                levels.support1 >
                tp2
            ) {
                tp2 =
                    levels.support1;
            }

            if (
                levels.support1 >
                tp3
            ) {
                tp3 =
                    levels.support1;
            }
        }
    }


    // -------------------------------------------------
    // RISK / REWARD
    // -------------------------------------------------

    const risk =
        Math.abs(entry - stopLoss);


    const reward =
        Math.abs(tp2 - entry);


    const rr =
        risk > 0
            ? reward / risk
            : 0;


    // -------------------------------------------------
    // DON'T CALL IT A+ IF RR IS BAD
    // -------------------------------------------------

    if (rr < 2) {

        status.innerText =
            "WAIT — Technical bias exists, but RR < 1:2.";

        status.className =
            "wait";


        setText(
            "proVerdict",
            "STAY OUT — Risk/reward is not A+."
        );

        return;
    }


    // -------------------------------------------------
    // OUTPUT
    // -------------------------------------------------

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
        formatPrice(stopLoss)
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
        "1:" + rr.toFixed(1)
    );


    setText(
        "validity",
        direction === "BUY"
            ? "Next 2–4 hours"
            : "Next 2–4 hours"
    );


    setText(
        "trigger",
        direction === "BUY"
            ? "M5 bullish confirmation + hold above support"
            : "M5 bearish confirmation + rejection at resistance"
    );


    setText(
        "invalidation",
        direction === "BUY"
            ? "M15 close below support / SL"
            : "M15 close above resistance / SL"
    );


    status.innerText =
        direction +
        " — Technical A+ candidate (" +
        score +
        "/10)";

    status.className =
        direction === "BUY"
            ? "bullish"
            : "bearish";


    setText(
        "proVerdict",
        direction +
        " setup detected — WAIT for the M5 trigger before execution."
    );
}


// =====================================================
// HELPERS
// =====================================================

function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.innerText = value;
    }
}


function formatPrice(value) {

    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(value)
    ) {
        return "—";
    }

    return Number(value).toFixed(5);
}


function formatNumber(value, decimals) {

    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(value)
    ) {
        return "—";
    }

    return Number(value).toFixed(decimals);
}


// =====================================================
// START
// =====================================================

refreshDashboard();

setInterval(
    refreshDashboard,
    REFRESH_MS
);
