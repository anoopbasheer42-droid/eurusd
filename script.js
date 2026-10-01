/* =========================================================
   EUR/USD SNIPER DASHBOARD
   H4 → H1 → M15 → M5

   A+ SNIPER ENGINE
   +
   2-HOUR SCALPING ENGINE

   API OPTIMIZATION:
   - H1 API request
   - M15 API request
   - M5 API request
   - H4 is BUILT locally from H1 candles

   This reduces Twelve Data usage.
   ========================================================= */


/* =========================================================
   CONFIG
   ========================================================= */

const API_KEY =
  "8908432b6c784bc49aad6ccf64845991";

const SYMBOL =
  "EUR/USD";

/*
   15-minute refresh.

   Do NOT set this lower while using
   the current Twelve Data plan.
*/
const REFRESH_MS =
  900000;


/*
   NEWS SAFETY GATE

   FALSE = all trading blocked.

   It will remain false until a real
   economic-calendar source is connected.
*/
const NEWS_CLEAR =
  false;


/*
   A+ sniper minimum score.
*/
const MIN_SETUP_SCORE =
  8;


/*
   Scalping minimum score.

   Less strict than sniper.
*/
const MIN_SCALP_SCORE =
  5;


/*
   Maximum sniper risk.
*/
const MAX_RISK =
  0.0030;


/*
   Maximum scalping risk.
*/
const MAX_SCALP_RISK =
  0.0015;


/*
   Structural SL buffer.
*/
const SL_BUFFER =
  0.00015;


/*
   Scalping forecast window.
*/
const SCALP_WINDOW_HOURS =
  2;


/*
   Number of candles requested.

   100 is enough for the calculations
   while keeping the response small.
*/
const CANDLE_LIMIT =
  100;


/* =========================================================
   GLOBAL DATA
   ========================================================= */

let marketData = {

  h4: [],
  h1: [],
  m15: [],
  m5: [],

  price: null,

  lastUpdate: null,

  apiError: null

};


window.__dashboardLoading =
  false;


/* =========================================================
   DOM HELPER
   ========================================================= */

function setTextAny(
  ids,
  value
) {

  if (!Array.isArray(ids)) {
    ids = [ids];
  }

  for (const id of ids) {

    const el =
      document.getElementById(id);

    if (el) {

      el.innerText =
        value;

      return true;
    }
  }

  return false;
}


/* =========================================================
   NUMBER HELPERS
   ========================================================= */

function num(value) {

  const n =
    Number(value);

  return Number.isFinite(n)
    ? n
    : null;
}


function roundPrice(value) {

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


function roundRSI(value) {

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


/* =========================================================
   FETCH CANDLES
   ========================================================= */

async function getCandles(
  interval,
  outputsize = CANDLE_LIMIT
) {

  const url =
    "https://api.twelvedata.com/time_series" +
    "?symbol=" +
    encodeURIComponent(SYMBOL) +
    "&interval=" +
    encodeURIComponent(interval) +
    "&outputsize=" +
    outputsize +
    "&timezone=Asia/Kolkata" +
    "&apikey=" +
    encodeURIComponent(API_KEY);


  console.log(
    "Requesting:",
    interval
  );


  const response =
    await fetch(url);


  if (!response.ok) {

    throw new Error(
      `${interval}: HTTP ${response.status}`
    );
  }


  const data =
    await response.json();


  console.log(
    interval,
    data
  );


  if (
    data.status === "error"
  ) {

    throw new Error(
      `${interval}: ${
        data.message ||
        "Twelve Data API error"
      }`
    );
  }


  if (
    !Array.isArray(
      data.values
    )
  ) {

    throw new Error(
      `No ${interval} candle data received`
    );
  }


  const candles =
    data.values

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
          num(c.close),

        volume:
          num(c.volume) || 0

      }))

      .filter(c =>
        c.open !== null &&
        c.high !== null &&
        c.low !== null &&
        c.close !== null
      )

      .reverse();


  if (!candles.length) {

    throw new Error(
      `No valid ${interval} candles`
    );
  }


  return candles;
}


/* =========================================================
   BUILD H4 FROM H1
   ========================================================= */

function buildH4FromH1(
  h1Candles
) {

  if (
    !h1Candles ||
    h1Candles.length < 8
  ) {

    return [];
  }


  const groups = {};


  for (
    const candle of h1Candles
  ) {

    const date =
      new Date(
        candle.datetime
      );


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      continue;
    }


    /*
       UTC four-hour bucket.

       Using a fixed 4-hour bucket avoids
       timezone grouping problems.
    */

    const bucket =
      new Date(
        Math.floor(
          date.getTime() /
          (4 * 60 * 60 * 1000)
        ) *
        (4 * 60 * 60 * 1000)
      );


    const key =
      bucket.toISOString();


    if (!groups[key]) {

      groups[key] = {

        datetime:
          bucket.toISOString(),

        open:
          candle.open,

        high:
          candle.high,

        low:
          candle.low,

        close:
          candle.close,

        volume:
          candle.volume || 0

      };

    } else {

      groups[key].high =
        Math.max(
          groups[key].high,
          candle.high
        );


      groups[key].low =
        Math.min(
          groups[key].low,
          candle.low
        );


      groups[key].close =
        candle.close;


      groups[key].volume +=
        candle.volume || 0;
    }
  }


  return Object.values(groups)
    .sort(
      (a, b) =>
        new Date(a.datetime) -
        new Date(b.datetime)
    );
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
      .slice(0, period)
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
        (candles[i].close - ema) *
        multiplier
      ) + ema;
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
    candles.length < period + 1
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


    if (change >= 0) {

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
    (
      100 /
      (1 + rs)
    );
}


/* =========================================================
   CANDLE HELPERS
   ========================================================= */

function candleDirection(
  candle
) {

  if (!candle) {
    return "NEUTRAL";
  }


  if (
    candle.close >
    candle.open
  ) {

    return "BULLISH";
  }


  if (
    candle.close <
    candle.open
  ) {

    return "BEARISH";
  }


  return "NEUTRAL";
}


function candleBody(
  candle
) {

  if (!candle) {
    return 0;
  }


  return Math.abs(
    candle.close -
    candle.open
  );
}


function candleRange(
  candle
) {

  if (!candle) {
    return 0;
  }


  return (
    candle.high -
    candle.low
  );
}


function candleStrength(
  candle
) {

  const range =
    candleRange(candle);


  if (range <= 0) {
    return 0;
  }


  return (
    candleBody(candle) /
    range
  );
}


/* =========================================================
   SWING DETECTION
   ========================================================= */

function isSwingHigh(
  candles,
  index
) {

  if (
    index < 2 ||
    index >
      candles.length - 3
  ) {

    return false;
  }


  const c =
    candles[index];


  return (

    c.high >
    candles[index - 1].high &&

    c.high >
    candles[index - 2].high &&

    c.high >
    candles[index + 1].high &&

    c.high >
    candles[index + 2].high

  );
}


function isSwingLow(
  candles,
  index
) {

  if (
    index < 2 ||
    index >
      candles.length - 3
  ) {

    return false;
  }


  const c =
    candles[index];


  return (

    c.low <
    candles[index - 1].low &&

    c.low <
    candles[index - 2].low &&

    c.low <
    candles[index + 1].low &&

    c.low <
    candles[index + 2].low

  );
}


function getSwingLevels(
  candles,
  lookback = 80
) {

  if (
    !candles ||
    candles.length < 10
  ) {

    return {

      swingHighs: [],
      swingLows: []

    };
  }


  const data =
    candles.slice(-lookback);


  const swingHighs = [];
  const swingLows = [];


  for (
    let i = 2;
    i < data.length - 2;
    i++
  ) {

    if (
      isSwingHigh(
        data,
        i
      )
    ) {

      swingHighs.push(
        data[i].high
      );
    }


    if (
      isSwingLow(
        data,
        i
      )
    ) {

      swingLows.push(
        data[i].low
      );
    }
  }


  return {

    swingHighs,
    swingLows

  };
}


/* =========================================================
   CLUSTER LEVELS
   ========================================================= */

function clusterLevels(
  levels,
  tolerance = 0.00020
) {

  if (
    !levels ||
    !levels.length
  ) {

    return [];
  }


  const sorted =
    [...levels].sort(
      (a, b) => a - b
    );


  const clusters = [];


  for (
    const level of sorted
  ) {

    let found = null;


    for (
      const cluster of clusters
    ) {

      if (
        Math.abs(
          level -
          cluster.mean
        ) <= tolerance
      ) {

        cluster.values.push(
          level
        );


        cluster.mean =
          cluster.values.reduce(
            (a, b) =>
              a + b,
            0
          ) /
          cluster.values.length;


        found =
          cluster;


        break;
      }
    }


    if (!found) {

      clusters.push({

        mean:
          level,

        values:
          [level]

      });
    }
  }


  return clusters
    .sort(
      (a, b) =>
        b.values.length -
        a.values.length
    )
    .map(
      c => c.mean
    );
}


/* =========================================================
   SUPPORT / RESISTANCE
   ========================================================= */

function calculateSupportResistance(
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


  const current =
    candles[
      candles.length - 1
    ].close;


  const swings =
    getSwingLevels(
      candles,
      Math.min(
        100,
        candles.length
      )
    );


  const resistanceLevels =
    clusterLevels(
      swings.swingHighs
    );


  const supportLevels =
    clusterLevels(
      swings.swingLows
    );


  /*
     Resistance:
     nearest above price first.
  */

  let resistances =
    resistanceLevels
      .filter(
        level =>
          level >
          current
      )
      .sort(
        (a, b) =>
          a - b
      );


  /*
     Support:
     nearest below price first.
  */

  let supports =
    supportLevels
      .filter(
        level =>
          level <
          current
      )
      .sort(
        (a, b) =>
          b - a
      );


  /*
     IMPORTANT FIX:

     If the second level is missing,
     search raw swing levels before
     giving up.
  */

  if (
    resistances.length < 2
  ) {

    const extraResistance =
      swings.swingHighs
        .filter(
          level =>
            level >
            current
        )
        .sort(
          (a, b) =>
            a - b
        );


    for (
      const level of
      extraResistance
    ) {

      if (
        !resistances.some(
          r =>
            Math.abs(
              r - level
            ) < 0.00005
        )
      ) {

        resistances.push(
          level
        );
      }


      if (
        resistances.length >= 2
      ) {
        break;
      }
    }
  }


  if (
    supports.length < 2
  ) {

    const extraSupport =
      swings.swingLows
        .filter(
          level =>
            level <
            current
        )
        .sort(
          (a, b) =>
            b - a
        );


    for (
      const level of
      extraSupport
    ) {

      if (
        !supports.some(
          s =>
            Math.abs(
              s - level
            ) < 0.00005
        )
      ) {

        supports.push(
          level
        );
      }


      if (
        supports.length >= 2
      ) {
        break;
      }
    }
  }


  /*
     Final fallback.

     This guarantees that R2/S2 can
     be produced when enough historical
     candles exist.

     These are NOT artificial trade levels;
     they are derived from recent range.
  */

  if (
    resistances.length < 2
  ) {

    const recentHighs =
      candles
        .slice(-30)
        .map(c => c.high)
        .filter(
          h =>
            h > current
        )
        .sort(
          (a, b) =>
            a - b
        );


    for (
      const h of recentHighs
    ) {

      if (
        !resistances.some(
          r =>
            Math.abs(
              r - h
            ) < 0.00005
        )
      ) {

        resistances.push(h);
      }


      if (
        resistances.length >= 2
      ) {
        break;
      }
    }
  }


  if (
    supports.length < 2
  ) {

    const recentLows =
      candles
        .slice(-30)
        .map(c => c.low)
        .filter(
          l =>
            l < current
        )
        .sort(
          (a, b) =>
            b - a
        );


    for (
      const l of recentLows
    ) {

      if (
        !supports.some(
          s =>
            Math.abs(
              s - l
            ) < 0.00005
        )
      ) {

        supports.push(l);
      }


      if (
        supports.length >= 2
      ) {
        break;
      }
    }
  }


  return {

    resistance1:
      resistances[0] ??
      null,

    resistance2:
      resistances[1] ??
      null,

    support1:
      supports[0] ??
      null,

    support2:
      supports[1] ??
      null
  };
}


/* =========================================================
   MARKET STRUCTURE
   ========================================================= */

function calculateStructure(
  candles
) {

  if (
    !candles ||
    candles.length < 30
  ) {

    return "INSUFFICIENT DATA";
  }


  const swings =
    getSwingLevels(
      candles,
      60
    );


  const highs =
    swings.swingHighs;


  const lows =
    swings.swingLows;


  if (
    highs.length < 2 ||
    lows.length < 2
  ) {

    return "RANGE";
  }


  const lastHigh =
    highs[
      highs.length - 1
    ];


  const previousHigh =
    highs[
      highs.length - 2
    ];


  const lastLow =
    lows[
      lows.length - 1
    ];


  const previousLow =
    lows[
      lows.length - 2
    ];


  if (
    lastHigh >
      previousHigh &&
    lastLow >
      previousLow
  ) {

    return "BULLISH";
  }


  if (
    lastHigh <
      previousHigh &&
    lastLow <
      previousLow
  ) {

    return "BEARISH";
  }


  return "RANGE";
}


/* =========================================================
   EMA ANALYSIS
   ========================================================= */

function getEMAAnalysis(
  candles
) {

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


  const ema200 =
    calculateEMA(
      candles,
      200
    );


  if (
    ema20 === null ||
    ema50 === null
  ) {

    return {

      text:
        "CALCULATING",

      ema20,
      ema50,
      ema200
    };
  }


  let text =
    "MIXED";


  if (
    ema20 > ema50 &&
    (
      ema200 === null ||
      ema50 > ema200
    )
  ) {

    text =
      "BULLISH";
  }


  else if (
    ema20 < ema50 &&
    (
      ema200 === null ||
      ema50 < ema200
    )
  ) {

    text =
      "BEARISH";
  }


  return {

    text,

    ema20,

    ema50,

    ema200
  };
}


/* =========================================================
   TIMEFRAME ANALYSIS
   ========================================================= */

function analyzeTimeframe(
  candles
) {

  if (
    !candles ||
    candles.length < 20
  ) {

    return {

      price: null,

      structure:
        "INSUFFICIENT DATA",

      candle:
        "NEUTRAL",

      candleStrength:
        0,

      rsi:
        null,

      ema: {

        text:
          "CALCULATING"

      },

      sr: {

        resistance1:
          null,

        resistance2:
          null,

        support1:
          null,

        support2:
          null
      }
    };
  }


  const last =
    candles[
      candles.length - 1
    ];


  return {

    price:
      last.close,

    structure:
      calculateStructure(
        candles
      ),

    candle:
      candleDirection(
        last
      ),

    candleStrength:
      candleStrength(
        last
      ),

    rsi:
      calculateRSI(
        candles
      ),

    ema:
      getEMAAnalysis(
        candles
      ),

    sr:
      calculateSupportResistance(
        candles
      )
  };
}


/* =========================================================
   COMPLETE ANALYSIS
   ========================================================= */

function buildAnalysis() {

  return {

    H4:
      analyzeTimeframe(
        marketData.h4
      ),

    H1:
      analyzeTimeframe(
        marketData.h1
      ),

    M15:
      analyzeTimeframe(
        marketData.m15
      ),

    M5:
      analyzeTimeframe(
        marketData.m5
      )
  };
}


/* =========================================================
   CANDLE CONFIRMATION
   ========================================================= */

function bullishCandleConfirmation(
  candles
) {

  if (
    !candles ||
    candles.length < 3
  ) {

    return false;
  }


  const last =
    candles[
      candles.length - 1
    ];


  const previous =
    candles[
      candles.length - 2
    ];


  return (

    last.close >
      last.open &&

    last.close >
      previous.high &&

    candleStrength(last) >=
      0.45

  );
}


function bearishCandleConfirmation(
  candles
) {

  if (
    !candles ||
    candles.length < 3
  ) {

    return false;
  }


  const last =
    candles[
      candles.length - 1
    ];


  const previous =
    candles[
      candles.length - 2
    ];


  return (

    last.close <
      last.open &&

    last.close <
      previous.low &&

    candleStrength(last) >=
      0.45

  );
}


/* =========================================================
   A+ BUY SCORE
   ========================================================= */

function calculateBuyScore(a) {

  let score = 0;


  if (
    a.H4.structure ===
    "BULLISH"
  ) score += 2;


  if (
    a.H1.structure ===
    "BULLISH"
  ) score += 2;


  if (
    a.M15.structure ===
    "BULLISH"
  ) score += 2;


  if (
    a.M5.structure ===
    "BULLISH"
  ) score += 1;


  if (
    bullishCandleConfirmation(
      marketData.m5
    )
  ) score += 2;


  if (
    a.M5.rsi !== null &&
    a.M5.rsi >= 45 &&
    a.M5.rsi <= 70
  ) score += 1;


  if (
    a.M15.ema.text ===
    "BULLISH"
  ) score += 1;


  return score;
}


/* =========================================================
   A+ SELL SCORE
   ========================================================= */

function calculateSellScore(a) {

  let score = 0;


  if (
    a.H4.structure ===
    "BEARISH"
  ) score += 2;


  if (
    a.H1.structure ===
    "BEARISH"
  ) score += 2;


  if (
    a.M15.structure ===
    "BEARISH"
  ) score += 2;


  if (
    a.M5.structure ===
    "BEARISH"
  ) score += 1;


  if (
    bearishCandleConfirmation(
      marketData.m5
    )
  ) score += 2;


  if (
    a.M5.rsi !== null &&
    a.M5.rsi >= 30 &&
    a.M5.rsi <= 55
  ) score += 1;


  if (
    a.M15.ema.text ===
    "BEARISH"
  ) score += 1;


  return score;
}


/* =========================================================
   BUY SETUP
   ========================================================= */

function calculateBuySetup(
  a,
  price
) {

  const score =
    calculateBuyScore(a);


  if (
    score < MIN_SETUP_SCORE
  ) return null;


  if (
    a.H4.structure !==
      "BULLISH" ||
    a.H1.structure !==
      "BULLISH" ||
    a.M15.structure !==
      "BULLISH" ||
    a.M5.structure !==
      "BULLISH"
  ) return null;


  if (
    !bullishCandleConfirmation(
      marketData.m5
    )
  ) return null;


  if (
    a.M5.rsi === null ||
    a.M5.rsi < 45 ||
    a.M5.rsi > 70
  ) return null;


  const entry =
    price;


  let structuralSL =
    a.M15.sr.support1;


  if (
    !structuralSL ||
    structuralSL >= entry
  ) {

    const lows =
      getSwingLevels(
        marketData.m5,
        30
      ).swingLows;


    structuralSL =
      lows.length
        ? lows[lows.length - 1]
        : entry - 0.0010;
  }


  const sl =
    structuralSL -
    SL_BUFFER;


  const risk =
    entry - sl;


  if (
    risk <= 0 ||
    risk > MAX_RISK
  ) return null;


  return {

    direction:
      "BUY",

    entry,

    sl,

    tp1:
      entry + risk,

    tp2:
      entry + risk * 2,

    tp3:
      entry + risk * 3,

    score,

    rr:
      "1:3",

    validity:
      "Valid while H4/H1 bullish structure remains intact",

    trigger:
      "H4 + H1 bullish → M15 confirmation → M5 bullish breakout",

    invalidation:
      `M5 closes below ${roundPrice(sl)}`,

    verdict:
      "BUY — A+ PRICE ACTION ALIGNMENT"
  };
}


/* =========================================================
   SELL SETUP
   ========================================================= */

function calculateSellSetup(
  a,
  price
) {

  const score =
    calculateSellScore(a);


  if (
    score < MIN_SETUP_SCORE
  ) return null;


  if (
    a.H4.structure !==
      "BEARISH" ||
    a.H1.structure !==
      "BEARISH" ||
    a.M15.structure !==
      "BEARISH" ||
    a.M5.structure !==
      "BEARISH"
  ) return null;


  if (
    !bearishCandleConfirmation(
      marketData.m5
    )
  ) return null;


  if (
    a.M5.rsi === null ||
    a.M5.rsi < 30 ||
    a.M5.rsi > 55
  ) return null;


  const entry =
    price;


  let structuralSL =
    a.M15.sr.resistance1;


  if (
    !structuralSL ||
    structuralSL <= entry
  ) {

    const highs =
      getSwingLevels(
        marketData.m5,
        30
      ).swingHighs;


    structuralSL =
      highs.length
        ? highs[highs.length - 1]
        : entry + 0.0010;
  }


  const sl =
    structuralSL +
    SL_BUFFER;


  const risk =
    sl - entry;


  if (
    risk <= 0 ||
    risk > MAX_RISK
  ) return null;


  return {

    direction:
      "SELL",

    entry,

    sl,

    tp1:
      entry - risk,

    tp2:
      entry - risk * 2,

    tp3:
      entry - risk * 3,

    score,

    rr:
      "1:3",

    validity:
      "Valid while H4/H1 bearish structure remains intact",

    trigger:
      "H4 + H1 bearish → M15 confirmation → M5 bearish breakdown",

    invalidation:
      `M5 closes above ${roundPrice(sl)}`,

    verdict:
      "SELL — A+ PRICE ACTION ALIGNMENT"
  };
}


/* =========================================================
   FINAL A+ SNIPER ENGINE
   ========================================================= */

function calculateSniperSetup(
  analysis,
  price
) {

  const buyScore =
    calculateBuyScore(
      analysis
    );


  const sellScore =
    calculateSellScore(
      analysis
    );


  const bestScore =
    Math.max(
      buyScore,
      sellScore
    );


  /*
     H4 / H1 conflict.
  */

  if (
    analysis.H4.structure !==
    analysis.H1.structure
  ) {

    return {

      direction:
        "WAIT",

      entry: null,
      sl: null,
      tp1: null,
      tp2: null,
      tp3: null,

      rr: null,

      score:
        `${bestScore} / 11`,

      validity:
        "H4/H1 conflict detected. News filter is also closed.",

      trigger:
        "H4/H1 direction → M15 confirmation → M5 trigger → news clearance",

      invalidation:
        "No trade while NEWS FILTER is CLOSED",

      verdict:
        "WAIT — NEWS FILTER NOT CONFIRMED"
    };
  }


  /*
     NEWS SAFETY GATE.
  */

  if (!NEWS_CLEAR) {

    return {

      direction:
        "WAIT",

      entry: null,
      sl: null,
      tp1: null,
      tp2: null,
      tp3: null,

      rr: null,

      score:
        `${bestScore} / 11`,

      validity:
        "Trading blocked until real economic news is checked",

      trigger:
        "Technical setup may develop, but no trade is allowed while news status is unknown",

      invalidation:
        "No trade while NEWS FILTER is CLOSED",

      verdict:
        "WAIT — NEWS FILTER NOT CONFIRMED"
    };
  }


  const buy =
    calculateBuySetup(
      analysis,
      price
    );


  const sell =
    calculateSellSetup(
      analysis,
      price
    );


  if (
    buy &&
    sell
  ) {

    return buy.score >=
      sell.score
      ? buy
      : sell;
  }


  if (buy) return buy;

  if (sell) return sell;


  return {

    direction:
      "WAIT",

    entry: null,
    sl: null,
    tp1: null,
    tp2: null,
    tp3: null,

    rr: null,

    score:
      `${bestScore} / 11`,

    validity:
      "No valid A+ setup currently",

    trigger:
      "Wait for H4/H1 direction → M15 confirmation → M5 trigger",

    invalidation:
      "—",

    verdict:
      "WAIT — NO A+ MULTI-TIMEFRAME ALIGNMENT"
  };
}


/* =========================================================
   SCALPING BUY SCORE
   H1 + M5 ONLY
   ========================================================= */

function calculateScalpBuyScore(
  a,
  price
) {

  let score = 0;


  /*
     H1 direction.
  */

  if (
    a.H1.structure ===
    "BULLISH"
  ) {

    score += 2;
  }


  /*
     H1 EMA.
  */

  if (
    a.H1.ema.text ===
    "BULLISH"
  ) {

    score += 1;
  }


  /*
     M5 structure.
  */

  if (
    a.M5.structure ===
    "BULLISH"
  ) {

    score += 2;
  }


  /*
     M5 candle momentum.
  */

  if (
    bullishCandleConfirmation(
      marketData.m5
    )
  ) {

    score += 1;
  }


  /*
     RSI.
  */

  if (
    a.M5.rsi !== null &&
    a.M5.rsi >= 45 &&
    a.M5.rsi <= 68
  ) {

    score += 1;
  }


  /*
     Price above H1 support.
  */

  if (
    a.H1.sr.support1 !== null &&
    price >
      a.H1.sr.support1
  ) {

    score += 1;
  }


  return score;
}


/* =========================================================
   SCALPING SELL SCORE
   ========================================================= */

function calculateScalpSellScore(
  a,
  price
) {

  let score = 0;


  if (
    a.H1.structure ===
    "BEARISH"
  ) {

    score += 2;
  }


  if (
    a.H1.ema.text ===
    "BEARISH"
  ) {

    score += 1;
  }


  if (
    a.M5.structure ===
    "BEARISH"
  ) {

    score += 2;
  }


  if (
    bearishCandleConfirmation(
      marketData.m5
    )
  ) {

    score += 1;
  }


  if (
    a.M5.rsi !== null &&
    a.M5.rsi >= 32 &&
    a.M5.rsi <= 55
  ) {

    score += 1;
  }


  if (
    a.H1.sr.resistance1 !== null &&
    price <
      a.H1.sr.resistance1
  ) {

    score += 1;
  }


  return score;
}


/* =========================================================
   SCALP BUY SETUP
   ========================================================= */

function calculateScalpBuy(
  a,
  price
) {

  const score =
    calculateScalpBuyScore(
      a,
      price
    );


  if (
    score < MIN_SCALP_SCORE
  ) {

    return null;
  }


  const entry =
    price;


  let structuralSL =
    a.H1.sr.support1;


  if (
    !structuralSL ||
    structuralSL >= entry
  ) {

    const lows =
      getSwingLevels(
        marketData.m5,
        30
      ).swingLows;


    structuralSL =
      lows.length
        ? lows[lows.length - 1]
        : entry -
          0.00070;
  }


  let sl =
    structuralSL -
    SL_BUFFER;


  let risk =
    entry - sl;


  /*
     Keep scalping risk tight.
  */

  if (
    risk <= 0 ||
    risk > MAX_SCALP_RISK
  ) {

    sl =
      entry - 0.00070;

    risk =
      0.00070;
  }


  return {

    direction:
      "BUY",

    entry,

    sl,

    tp1:
      entry +
      risk * 1.2,

    tp2:
      entry +
      risk * 2,

    score,

    rr:
      "1:2",

    validity:
      `Next ${SCALP_WINDOW_HOURS} hours only`,

    trigger:
      "H1 bullish bias + M5 bullish momentum / breakout",

    invalidation:
      `M5 closes below ${roundPrice(sl)}`,

    verdict:
      "BUY — 2-HOUR SCALPING BIAS"
  };
}


/* =========================================================
   SCALP SELL SETUP
   ========================================================= */

function calculateScalpSell(
  a,
  price
) {

  const score =
    calculateScalpSellScore(
      a,
      price
    );


  if (
    score < MIN_SCALP_SCORE
  ) {

    return null;
  }


  const entry =
    price;


  let structuralSL =
    a.H1.sr.resistance1;


  if (
    !structuralSL ||
    structuralSL <= entry
  ) {

    const highs =
      getSwingLevels(
        marketData.m5,
        30
      ).swingHighs;


    structuralSL =
      highs.length
        ? highs[highs.length - 1]
        : entry +
          0.00070;
  }


  let sl =
    structuralSL +
    SL_BUFFER;


  let risk =
    sl - entry;


  if (
    risk <= 0 ||
    risk > MAX_SCALP_RISK
  ) {

    sl =
      entry + 0.00070;

    risk =
      0.00070;
  }


  return {

    direction:
      "SELL",

    entry,

    sl,

    tp1:
      entry -
      risk * 1.2,

    tp2:
      entry -
      risk * 2,

    score,

    rr:
      "1:2",

    validity:
      `Next ${SCALP_WINDOW_HOURS} hours only`,

    trigger:
      "H1 bearish bias + M5 bearish momentum / breakdown",

    invalidation:
      `M5 closes above ${roundPrice(sl)}`,

    verdict:
      "SELL — 2-HOUR SCALPING BIAS"
  };
}


/* =========================================================
   FINAL SCALPING ENGINE
   ========================================================= */

function calculateScalpingSetup(
  analysis,
  price
) {

  const buyScore =
    calculateScalpBuyScore(
      analysis,
      price
    );


  const sellScore =
    calculateScalpSellScore(
      analysis,
      price
    );


  const bestScore =
    Math.max(
      buyScore,
      sellScore
    );


  /*
     NEWS SAFETY GATE.

     This is deliberately BEFORE
     returning a trade.
  */

  if (!NEWS_CLEAR) {

    return {

      direction:
        "WAIT",

      entry: null,
      sl: null,
      tp1: null,
      tp2: null,

      rr: null,

      score:
        `${bestScore} / 8`,

      validity:
        `Next ${SCALP_WINDOW_HOURS} hours, but trading blocked until news is checked`,

      trigger:
        "H1 + M5 technical setup detected; waiting for EUR/USD news clearance",

      invalidation:
        "No trade while NEWS FILTER is CLOSED",

      verdict:
        "WAIT — NEWS CHECK REQUIRED"
    };
  }


  const buy =
    calculateScalpBuy(
      analysis,
      price
    );


  const sell =
    calculateScalpSell(
      analysis,
      price
    );


  if (
    buy &&
    sell
  ) {

    return buy.score >=
      sell.score
      ? buy
      : sell;
  }


  if (buy) return buy;

  if (sell) return sell;


  return {

    direction:
      "WAIT",

    entry: null,
    sl: null,
    tp1: null,
    tp2: null,

    rr: null,

    score:
      `${bestScore} / 8`,

    validity:
      `Next ${SCALP_WINDOW_HOURS} hours only`,

    trigger:
      "Wait for H1 direction and M5 confirmation",

    invalidation:
      "—",

    verdict:
      "WAIT — NO VALID SCALPING SETUP"
  };
}


/* =========================================================
   PRICE UI
   ========================================================= */

function updatePriceUI(
  price
) {

  setTextAny(
    [
      "price",
      "livePrice",
      "currentPrice",
      "live-price"
    ],
    roundPrice(price)
  );


  setTextAny(
    [
      "priceStatus",
      "trend",
      "status",
      "marketStatus"
    ],
    "MARKET DATA LOADED"
  );
}


/* =========================================================
   STRUCTURE UI
   ========================================================= */

function updateStructureUI(
  a
) {

  setTextAny(
    "h4Trend",
    a.H4.structure
  );


  setTextAny(
    "h1Trend",
    a.H1.structure
  );


  setTextAny(
    "m15Structure",
    a.M15.structure
  );


  setTextAny(
    "m5Structure",
    a.M5.structure
  );
}


/* =========================================================
   S/R UI
   ========================================================= */

function updateSRUI(
  a
) {

  /*
     H1 is used for the main
     dashboard S/R levels.

     R1/R2/S1/S2 are now independently
     calculated and displayed.
  */

  const sr =
    a.H1.sr;


  setTextAny(
    "resistance1",
    roundPrice(
      sr.resistance1
    )
  );


  setTextAny(
    "resistance2",
    roundPrice(
      sr.resistance2
    )
  );


  setTextAny(
    "support1",
    roundPrice(
      sr.support1
    )
  );


  setTextAny(
    "support2",
    roundPrice(
      sr.support2
    )
  );
}


/* =========================================================
   INDICATORS UI
   ========================================================= */

function updateIndicatorsUI(
  a
) {

  setTextAny(
    "h4Rsi",
    roundRSI(
      a.H4.rsi
    )
  );


  setTextAny(
    "h1Rsi",
    roundRSI(
      a.H1.rsi
    )
  );


  setTextAny(
    "m15Rsi",
    roundRSI(
      a.M15.rsi
    )
  );


  setTextAny(
    "m5Rsi",
    roundRSI(
      a.M5.rsi
    )
  );


  setTextAny(
    "emaStructure",
    a.H1.ema.text
  );
}


/* =========================================================
   NEWS UI
   ========================================================= */

function updateNewsUI() {

  /*
     We are NOT pretending that
     news has been checked.

     Until a real calendar is connected,
     the filter stays CLOSED.
  */

  setTextAny(
    "eurNews",
    "NOT CONNECTED"
  );


  setTextAny(
    "usdNews",
    "NOT CONNECTED"
  );


  setTextAny(
    "newsFilter",
    "NEWS CHECK REQUIRED"
  );


  setTextAny(
    "nextEvent",
    "Economic calendar required"
  );


  setTextAny(
    "tradingRisk",
    "HIGH — NEWS FILTER CLOSED"
  );
}


/* =========================================================
   SNIPER UI
   ========================================================= */

function updateSniperUI(
  setup
) {

  setTextAny(
    "sniperStatus",
    setup.verdict
  );


  setTextAny(
    "direction",
    setup.direction
  );


  setTextAny(
    "entry",
    roundPrice(
      setup.entry
    )
  );


  setTextAny(
    "stopLoss",
    roundPrice(
      setup.sl
    )
  );


  setTextAny(
    "tp1",
    roundPrice(
      setup.tp1
    )
  );


  setTextAny(
    "tp2",
    roundPrice(
      setup.tp2
    )
  );


  setTextAny(
    "tp3",
    roundPrice(
      setup.tp3
    )
  );


  setTextAny(
    "riskReward",
    setup.rr || "—"
  );


  setTextAny(
    "validity",
    setup.validity
  );


  setTextAny(
    "trigger",
    setup.trigger
  );


  setTextAny(
    "invalidation",
    setup.invalidation
  );


  setTextAny(
    "setupScore",
    setup.score
  );
}


/* =========================================================
   SCALPING UI
   ========================================================= */

function updateScalpingUI(
  setup
) {

  setTextAny(
    "scalpVerdict",
    setup.verdict
  );


  setTextAny(
    "scalpDirection",
    setup.direction
  );


  setTextAny(
    "scalpEntry",
    roundPrice(
      setup.entry
    )
  );


  setTextAny(
    "scalpSL",
    roundPrice(
      setup.sl
    )
  );


  setTextAny(
    "scalpTP1",
    roundPrice(
      setup.tp1
    )
  );


  setTextAny(
    "scalpTP2",
    roundPrice(
      setup.tp2
    )
  );


  setTextAny(
    "scalpRR",
    setup.rr || "—"
  );


  setTextAny(
    "scalpScore",
    setup.score
  );


  setTextAny(
    "scalpValidity",
    setup.validity
  );


  setTextAny(
    "scalpTrigger",
    setup.trigger
  );


  setTextAny(
    "scalpInvalidation",
    setup.invalidation
  );
}


/* =========================================================
   PRO VERDICT
   ========================================================= */

function updateProVerdictUI(
  setup,
  scalp
) {

  /*
     If the API failed, don't overwrite
     the useful error message.
  */

  if (
    marketData.apiError
  ) {

    return;
  }


  setTextAny(
    "proVerdict",
    setup.verdict
  );


  if (
    setup.direction ===
    "BUY"
  ) {

    setTextAny(
      "proExplanation",
      "A+ BUY: H4 + H1 bullish structure, M15 confirmation and M5 trigger."
    );

    return;
  }


  if (
    setup.direction ===
    "SELL"
  ) {

    setTextAny(
      "proExplanation",
      "A+ SELL: H4 + H1 bearish structure, M15 confirmation and M5 trigger."
    );

    return;
  }


  if (
    marketData.h4.length &&
    marketData.h1.length
  ) {

    const h4 =
      calculateStructure(
        marketData.h4
      );


    const h1 =
      calculateStructure(
        marketData.h1
      );


    if (
      h4 !== h1
    ) {

      setTextAny(
        "proExplanation",
        `STAY OUT — H4 is ${h4} while H1 is ${h1}. Higher-timeframe conflict.`
      );

      return;
    }
  }


  if (!NEWS_CLEAR) {

    setTextAny(
      "proExplanation",
      "Technical analysis is running, but both trading engines remain blocked until a real EUR/USD economic news filter is connected."
    );

    return;
  }


  setTextAny(
    "proExplanation",
    `Sniper: ${setup.direction}. Scalping window: ${scalp.direction}.`
  );
}


/* =========================================================
   TIMESTAMP
   ========================================================= */

function updateTimestamp() {

  const now =
    new Date();


  const text =
    now.toLocaleString(
      "en-IN",
      {

        timeZone:
          "Asia/Kolkata",

        day:
          "2-digit",

        month:
          "2-digit",

        year:
          "numeric",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",

        hour12:
          false
      }
    );


  setTextAny(
    [
      "lastUpdate",
      "updateTime"
    ],
    `Updated: ${text} IST`
  );
}


/* =========================================================
   ERROR HANDLER
   ========================================================= */

function showDashboardError(
  error
) {

  console.error(
    "EUR/USD DASHBOARD ERROR:",
    error
  );


  const message =
    error &&
    error.message
      ? error.message
      : String(error);


  setTextAny(
    [
      "priceStatus",
      "trend",
      "status",
      "marketStatus"
    ],
    `ERROR: ${message}`
  );


  setTextAny(
    "sniperStatus",
    "WAIT — MARKET DATA ERROR"
  );


  setTextAny(
    "scalpVerdict",
    "WAIT — MARKET DATA ERROR"
  );


  setTextAny(
    "proVerdict",
    "WAIT — DATA ERROR"
  );


  setTextAny(
    "proExplanation",
    message
  );
}


/* =========================================================
   LOAD MARKET DATA
   ========================================================= */

async function loadMarketData() {

  if (
    window.__dashboardLoading
  ) {

    return;
  }


  window.__dashboardLoading =
    true;


  marketData.apiError =
    null;


  setTextAny(
    [
      "priceStatus",
      "trend",
      "status",
      "marketStatus"
    ],
    "CONNECTING TO MARKET DATA..."
  );


  try {

    console.log(
      "================================="
    );


    console.log(
      "EUR/USD DASHBOARD UPDATE START"
    );


    console.log(
      "API OPTIMIZATION: 3 REQUESTS"
    );


    /*
       REQUEST 1
       H1
    */

    const h1 =
      await getCandles(
        "1h",
        CANDLE_LIMIT
      );


    /*
       REQUEST 2
       M15
    */

    const m15 =
      await getCandles(
        "15min",
        CANDLE_LIMIT
      );


    /*
       REQUEST 3
       M5
    */

    const m5 =
      await getCandles(
        "5min",
        CANDLE_LIMIT
      );


    /*
       H4 is locally generated from H1.

       NO additional Twelve Data request.
    */

    const h4 =
      buildH4FromH1(
        h1
      );


    if (
      !h4.length
    ) {

      throw new Error(
        "Unable to build H4 candles from H1 data"
      );
    }


    /*
       Save data.
    */

    marketData.h4 =
      h4;


    marketData.h1 =
      h1;


    marketData.m15 =
      m15;


    marketData.m5 =
      m5;


    /*
       Current price = latest M5 close.
    */

    marketData.price =
      m5[
        m5.length - 1
      ].close;


    marketData.lastUpdate =
      new Date();


    /*
       Analysis.
    */

    const analysis =
      buildAnalysis();


    console.log(
      "ANALYSIS:",
      analysis
    );


    /*
       A+ sniper.
    */

    const sniper =
      calculateSniperSetup(
        analysis,
        marketData.price
      );


    /*
       2-hour scalper.
    */

    const scalp =
      calculateScalpingSetup(
        analysis,
        marketData.price
      );


    console.log(
      "SNIPER:",
      sniper
    );


    console.log(
      "SCALPING:",
      scalp
    );


    /*
       Update dashboard.
    */

    updatePriceUI(
      marketData.price
    );


    updateStructureUI(
      analysis
    );


    updateSRUI(
      analysis
    );


    updateIndicatorsUI(
      analysis
    );


    updateNewsUI();


    updateSniperUI(
      sniper
    );


    updateScalpingUI(
      scalp
    );


    updateProVerdictUI(
      sniper,
      scalp
    );


    updateTimestamp();


    setTextAny(
      [
        "priceStatus",
        "trend",
        "status",
        "marketStatus"
      ],
      "MARKET DATA LOADED"
    );


    console.log(
      "EUR/USD DASHBOARD UPDATE COMPLETE"
    );


    console.log(
      "================================="
    );
  }


  catch (error) {

    marketData.apiError =
      error;


    showDashboardError(
      error
    );
  }


  finally {

    window.__dashboardLoading =
      false;
  }
}


/* =========================================================
   START DASHBOARD
   ========================================================= */

function startDashboard() {

  console.log(
    "EUR/USD SNIPER DASHBOARD STARTING..."
  );


  /*
     First load.
  */

  loadMarketData();


  /*
     Refresh every 15 minutes.

     This is deliberately not every few
     seconds because of the API limit.
  */

  setInterval(
    loadMarketData,
    REFRESH_MS
  );
}


/* =========================================================
   START
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    startDashboard
  );

} else {

  startDashboard();
}
