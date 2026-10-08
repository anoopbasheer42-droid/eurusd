
/* =========================================================
   SWING COMMANDER — DATA ENGINE (JavaScript Port)
   ========================================================= */

"use strict";

const TWELVE_DATA_API_KEY = "4ba3968e609544bf8990192fdf3ed970";
const SYMBOL = "EUR/USD";
const REFRESH_INTERVAL = 120000;

const Config = {
  MODES: {
    HIGH_OPPORTUNITY: { min_score: 70, min_rr: 0.0, close_at_tp1: true, min_confirmations: 2, max_conflict: "MODERATE" },
    BALANCED: { min_score: 75, min_rr: 2.0, close_at_tp1: false, min_confirmations: 3, max_conflict: "LOW" },
    SNIPER: { min_score: 85, min_rr: 2.5, close_at_tp1: false, min_confirmations: 4, max_conflict: "NONE" }
  },
  EMA_FAST: 20, EMA_MID: 50, EMA_SLOW: 200,
  RSI_PERIOD: 14, ATR_PERIOD: 14, ADX_PERIOD: 14,
  ADX_TREND_THRESHOLD: 25, ADX_RANGE_THRESHOLD: 20,
  HIGH_VOL_ATR_MULT: 1.8, LOW_VOL_ATR_MULT: 0.6,
  ENGINE_WEIGHTS: { PULLBACK: 0.25, BREAKOUT: 0.20, LIQUIDITY: 0.20, RANGE: 0.15, MOMENTUM: 0.20 },
  ENGINE_FIRE_THRESHOLD: 65,
  SWING_LOOKBACK: 5,
  PIP_SIZE: 0.0001,
  SL_FIXED_PIPS: 15, TP1_FIXED_PIPS: 10,
  TP2_R_MULTIPLE: 2.0, TP3_R_MULTIPLE: 3.0,
  ACCOUNT_SIZE_USD: 100.0, RISK_PER_TRADE_PCT: 1.0,
  PIP_VALUE_PER_MICRO: 0.10, MICRO_LOT_UNITS: 1000,
  MIN_RR_ABSOLUTE: 2.0, BLOCK_EXTENDED_ENTRY_ATR: 2.5,
  COOLDOWN_MIN: 60
};

const CACHE_TTL = { D1: 4*3600*1000, H4: 1*3600*1000, H1: 30*60*1000, price: 2*60*1000 };
const cache = {
  D1: { data: null, ts: 0 }, H4: { data: null, ts: 0 },
  H1: { data: null, ts: 0 }, price: { value: null, ts: 0 }
};

const STATE_KEY = "swing_state_v1";
let state = null;

function emptyModeState() {
  return {
    open_trade: null,
    today: { date: new Date().toISOString().slice(0,10), wins: 0, losses: 0 },
    cooldown_until: null,
    closed_trades: []
  };
}
function emptyState() {
  return {
    HIGH_OPPORTUNITY: emptyModeState(),
    BALANCED: emptyModeState(),
    SNIPER: emptyModeState()
  };
}
function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) state = JSON.parse(raw);
    else state = emptyState();
    for (const m of ["HIGH_OPPORTUNITY","BALANCED","SNIPER"]) {
      if (!state[m]) state[m] = emptyModeState();
    }
  } catch(e) { state = emptyState(); }
}
function saveState() {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch(e){}
}

/* =========================================================
   INDICATORS
   ========================================================= */
function ema(values, period) {
  if (!values || values.length < 1) return [];
  const k = 2 / (period + 1);
  const out = new Array(values.length);
  out[0] = values[0];
  for (let i = 1; i < values.length; i++) out[i] = values[i] * k + out[i-1] * (1 - k);
  return out;
}
function emaWilder(values, period) {
  if (!values || values.length < 1) return [];
  const a = 1 / period;
  const out = new Array(values.length);
  out[0] = values[0];
  for (let i = 1; i < values.length; i++) out[i] = values[i] * a + out[i-1] * (1 - a);
  return out;
}
function rsi(closes, period = 14) {
  const n = closes.length;
  const out = new Array(n).fill(50);
  if (n < 2) return out;
  const gains = new Array(n).fill(0);
  const losses = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const d = closes[i] - closes[i-1];
    if (d > 0) gains[i] = d; else losses[i] = -d;
  }
  const avgGain = emaWilder(gains, period);
  const avgLoss = emaWilder(losses, period);
  for (let i = 0; i < n; i++) {
    if (avgLoss[i] === 0) { out[i] = 50; continue; }
    const rs = avgGain[i] / avgLoss[i];
    out[i] = 100 - 100 / (1 + rs);
  }
  return out;
}
function atrSeries(candles, period = 14) {
  const n = candles.length;
  const tr = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const c = candles[i], p = candles[i-1];
    tr[i] = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
  }
  return emaWilder(tr, period);
}
function adxSeries(candles, period = 14) {
  const n = candles.length;
  const plusDM = new Array(n).fill(0);
  const minusDM = new Array(n).fill(0);
  const tr = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const up = candles[i].high - candles[i-1].high;
    const down = candles[i-1].low - candles[i].low;
    plusDM[i]  = (up > down && up > 0)   ? up   : 0;
    minusDM[i] = (down > up && down > 0) ? down : 0;
    const c = candles[i], p = candles[i-1];
    tr[i] = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
  }
  const atr_ = emaWilder(tr, period);
  const plusDI  = emaWilder(plusDM, period).map((v,i) => atr_[i] > 0 ? 100*v/atr_[i] : 0);
  const minusDI = emaWilder(minusDM, period).map((v,i) => atr_[i] > 0 ? 100*v/atr_[i] : 0);
  const dx = plusDI.map((p,i) => {
    const sum = p + minusDI[i];
    return sum === 0 ? 0 : 100 * Math.abs(p - minusDI[i]) / sum;
  });
  return emaWilder(dx, period);
}
function addIndicators(candles) {
  if (!candles || candles.length < 1) return candles;
  const closes = candles.map(c => c.close);
  const e20 = ema(closes, Config.EMA_FAST);
  const e50 = ema(closes, Config.EMA_MID);
  const e200 = ema(closes, Config.EMA_SLOW);
  const r = rsi(closes, Config.RSI_PERIOD);
  const a = atrSeries(candles, Config.ATR_PERIOD);
  const x = adxSeries(candles, Config.ADX_PERIOD);
  return candles.map((c, i) => ({
    ...c,
    ema20: e20[i], ema50: e50[i], ema200: e200[i],
    rsi: r[i], atr: a[i], adx: x[i]
  }));
}

/* =========================================================
   STRUCTURE
   ========================================================= */
function findSwings(candles, lookback = 5) {
  const n = candles.length;
  const swings = [];
  for (let i = lookback; i < n - lookback; i++) {
    const hi = candles[i].high;
    const lo = candles[i].low;
    let isH = true, isL = true, hiCount = 0, loCount = 0;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (candles[j].high > hi) isH = false;
      if (candles[j].high === hi) hiCount++;
      if (candles[j].low < lo) isL = false;
      if (candles[j].low === lo) loCount++;
    }
    if (isH && hiCount === 1) swings.push({ idx: i, time: candles[i].time, price: hi, type: "H" });
    if (isL && loCount === 1) swings.push({ idx: i, time: candles[i].time, price: lo, type: "L" });
  }
  swings.sort((a, b) => a.idx - b.idx);
  return swings;
}
function classifySwings(swings) {
  const out = [];
  let lastH = null, lastL = null;
  for (const s of swings) {
    let tag = null;
    if (s.type === "H") {
      if (lastH !== null) tag = s.price > lastH.price ? "HH" : "LH";
      lastH = s;
    } else {
      if (lastL !== null) tag = s.price > lastL.price ? "HL" : "LL";
      lastL = s;
    }
    out.push({ ...s, tag });
  }
  return out;
}
function structureState(labeled) {
  const tags = labeled.filter(x => x.tag).map(x => x.tag);
  const recent = tags.slice(-6);
  const hh = recent.filter(t => t === "HH").length;
  const hl = recent.filter(t => t === "HL").length;
  const lh = recent.filter(t => t === "LH").length;
  const ll = recent.filter(t => t === "LL").length;
  const bull = hh + hl, bear = lh + ll;
  let bias = "MIXED";
  if (bull > bear + 1) bias = "BULLISH";
  else if (bear > bull + 1) bias = "BEARISH";
  return { bias, recent, hh, hl, lh, ll };
}
function detectBosChoch(candles, labeled) {
  if (!labeled.length) return { bos: null, choch: null };
  const lastClose = candles[candles.length - 1].close;
  let lastH = null, lastL = null;
  for (let i = labeled.length - 1; i >= 0; i--) {
    if (labeled[i].type === "H" && lastH === null) lastH = labeled[i];
    if (labeled[i].type === "L" && lastL === null) lastL = labeled[i];
    if (lastH && lastL) break;
  }
  const state_ = structureState(labeled);
  let bos = null, choch = null;
  if (lastH && lastClose > lastH.price) {
    if (state_.bias === "BULLISH") bos = { type: "BOS_UP", level: lastH.price };
    else choch = { type: "CHOCH_UP", level: lastH.price };
  }
  if (lastL && lastClose < lastL.price) {
    if (state_.bias === "BEARISH") bos = { type: "BOS_DOWN", level: lastL.price };
    else choch = { type: "CHOCH_DOWN", level: lastL.price };
  }
  return { bos, choch };
}
function structureSnapshot(candles) {
  const swings = findSwings(candles);
  const labeled = classifySwings(swings);
  const st = structureState(labeled);
  const events = detectBosChoch(candles, labeled);
  let lastH = null, lastL = null;
  for (let i = labeled.length - 1; i >= 0; i--) {
    if (labeled[i].type === "H" && lastH === null) lastH = labeled[i];
    if (labeled[i].type === "L" && lastL === null) lastL = labeled[i];
    if (lastH && lastL) break;
  }
  return {
    bias: st.bias, recent: st.recent,
    last_high: lastH ? lastH.price : null,
    last_low: lastL ? lastL.price : null,
    bos: events.bos, choch: events.choch,
    n_swings: labeled.length
  };
}

/* =========================================================
   LIQUIDITY
   ========================================================= */
function detectSweep(candles, lookback = 10, wickRatio = 0.5) {
  if (candles.length < lookback + 3) return { side: null, level: null };
  const swings = findSwings(candles);
  if (!swings.length) return { side: null, level: null };
  const recent = swings.slice(-(lookback * 2));
  let lastHigh = null, lastLow = null;
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i].type === "H" && lastHigh === null) lastHigh = recent[i];
    if (recent[i].type === "L" && lastLow === null) lastLow = recent[i];
    if (lastHigh && lastLow) break;
  }
  const tail = candles.slice(-3);
  for (const row of tail) {
    const o = row.open, c = row.close, h = row.high, l = row.low;
    const body = Math.max(Math.abs(c - o), Config.PIP_SIZE);
    const lowerWick = Math.min(o, c) - l;
    const upperWick = h - Math.max(o, c);
    if (lastLow && l < lastLow.price && c > lastLow.price && lowerWick >= wickRatio * body) {
      return { side: "BUY", level: lastLow.price };
    }
    if (lastHigh && h > lastHigh.price && c < lastHigh.price && upperWick >= wickRatio * body) {
      return { side: "SELL", level: lastHigh.price };
    }
  }
  return { side: null, level: null };
}

/* =========================================================
   REGIME
   ========================================================= */
function volatilityState(candles) {
  if (!candles || candles.length < 30) return "NORMAL_VOL";
  const n = candles.length;
  const atr = candles.map(c => c.atr);
  const avg20 = atr.slice(-20).reduce((s,v) => s+v, 0) / 20;
  const last = atr[n - 1];
  if (avg20 <= 0) return "NORMAL_VOL";
  const ratio = last / avg20;
  if (ratio >= Config.HIGH_VOL_ATR_MULT) return "HIGH_VOL";
  if (ratio <= Config.LOW_VOL_ATR_MULT) return "LOW_VOL";
  return "NORMAL_VOL";
}
function directionalState(candles) {
  if (!candles || candles.length < 30) return "UNKNOWN";
  const last = candles[candles.length - 1];
  const close = last.close, e20 = last.ema20, e50 = last.ema50, adx = last.adx;
  const s = structureSnapshot(candles);
  if (adx >= Config.ADX_TREND_THRESHOLD) {
    if (close > e20 && e20 > e50 && s.bias === "BULLISH") return "TREND_UP";
    if (close < e20 && e20 < e50 && s.bias === "BEARISH") return "TREND_DOWN";
  }
  if (adx <= Config.ADX_RANGE_THRESHOLD && s.bias === "MIXED") return "RANGE";
  if (s.choch !== null) return "TRANSITION";
  if (s.bias === "BULLISH" && close > e50) return "TREND_UP";
  if (s.bias === "BEARISH" && close < e50) return "TREND_DOWN";
  return "TRANSITION";
}
function classifyRegime(candles) {
  const vol = volatilityState(candles);
  const dir = directionalState(candles);
  let primary;
  if (vol === "HIGH_VOL") primary = "HIGH_VOLATILITY";
  else if (vol === "LOW_VOL") primary = "LOW_VOLATILITY";
  else primary = dir;
  return { primary, direction: dir, volatility: vol };
}
function multiTfRegime(dfs) {
  const per = {};
  for (const tf of ["D1","H4","H1"]) {
    if (dfs[tf] && dfs[tf].length) per[tf] = classifyRegime(dfs[tf]);
  }
  const dirs = Object.values(per).map(v => v.direction);
  const bull = dirs.filter(d => d === "TREND_UP").length;
  const bear = dirs.filter(d => d === "TREND_DOWN").length;
  const rng  = dirs.filter(d => d === "RANGE").length;
  const trns = dirs.filter(d => d === "TRANSITION").length;
  let master;
  if (bull >= 2 && bear === 0) master = "TREND_UP";
  else if (bear >= 2 && bull === 0) master = "TREND_DOWN";
  else if (rng >= 2) master = "RANGE";
  else if (trns >= 1 && (bull + bear) <= 1) master = "TRANSITION";
  else master = "TRANSITION";
  const vols = Object.values(per).map(v => v.volatility);
  if (vols.filter(v => v === "HIGH_VOL").length >= 2) master = "HIGH_VOLATILITY";
  else if (vols.filter(v => v === "LOW_VOL").length >= 2 && master !== "TREND_UP" && master !== "TREND_DOWN") master = "LOW_VOLATILITY";
  return { master, per_tf: per };
}

/* =========================================================
   SUPPORT / RESISTANCE
   ========================================================= */
function collectSwings(dfDict) {
  const levels = [];
  for (const tf of ["D1","H4","H1"]) {
    const df = dfDict[tf];
    if (!df || !df.length) continue;
    const sw = findSwings(df);
    for (const s of sw) levels.push({ price: s.price, type: s.type, source: tf });
  }
  return levels;
}
function clusterLevels(levels, tolPips = 15) {
  if (!levels.length) return [];
  const tol = tolPips * Config.PIP_SIZE;
  const sorted = [...levels].sort((a,b) => a.price - b.price);
  const clusters = [];
  let cur = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].price - cur[cur.length-1].price) <= tol) cur.push(sorted[i]);
    else { clusters.push(cur); cur = [sorted[i]]; }
  }
  clusters.push(cur);
  const out = [];
  for (const cl of clusters) {
    const prices = cl.map(c => c.price);
    const sources = [...new Set(cl.map(c => c.source))];
    const types = [...new Set(cl.map(c => c.type))];
    const price = prices.reduce((s,p) => s+p, 0) / prices.length;
    const touches = cl.length;
    let weight = touches + 2 * (sources.length - 1);
    if (types.length === 2) weight += 1;
    let strength = "WEAK";
    if (weight >= 8) strength = "STRONG";
    else if (weight >= 4) strength = "MEDIUM";
    out.push({ price, touches, sources, types, weight, strength });
  }
  return out;
}
function getLevels(dfDict, currentPrice, tolPips = 15, maxLevels = 8) {
  const raw = collectSwings(dfDict);
  const clusters = clusterLevels(raw, tolPips);
  const resistance = clusters.filter(c => c.price > currentPrice).sort((a,b) => a.price - b.price).slice(0, maxLevels);
  const support = clusters.filter(c => c.price < currentPrice).sort((a,b) => b.price - a.price).slice(0, maxLevels);
  resistance.forEach((r,i) => r.label = "R" + (i+1));
  support.forEach((s,i) => s.label = "S" + (i+1));
  return { resistance, support };
}

/* =========================================================
   RISK
   ========================================================= */
function structuralSL(dfH1, dfH4, side, entry) {
  const distance = Config.SL_FIXED_PIPS * Config.PIP_SIZE;
  const sl = side === "BUY" ? entry - distance : entry + distance;
  return [sl, `fixed ${Config.SL_FIXED_PIPS}p SL`];
}
function computeTargets(side, entry, sl, sr) {
  const risk = Math.abs(entry - sl);
  if (risk <= 0) return null;
  const tp1Dist = Config.TP1_FIXED_PIPS * Config.PIP_SIZE;
  const tp2Dist = Config.TP2_R_MULTIPLE * risk;
  const tp3Dist = Config.TP3_R_MULTIPLE * risk;
  let tp1, tp2, tp3;
  if (side === "BUY") {
    tp1 = entry + tp1Dist; tp2 = entry + tp2Dist; tp3 = entry + tp3Dist;
  } else {
    tp1 = entry - tp1Dist; tp2 = entry - tp2Dist; tp3 = entry - tp3Dist;
  }
  return {
    risk,
    tp1, rr_tp1: Math.abs(tp1 - entry) / risk,
    tp2, rr_tp2: Math.abs(tp2 - entry) / risk,
    tp3, rr_tp3: Math.abs(tp3 - entry) / risk
  };
}
function computePositionSize(entry, sl) {
  const riskMoney = Config.ACCOUNT_SIZE_USD * (Config.RISK_PER_TRADE_PCT / 100);
  const slPips = Math.abs(entry - sl) / Config.PIP_SIZE;
  if (slPips <= 0) return null;
  const microLots = riskMoney / (slPips * Config.PIP_VALUE_PER_MICRO);
  return {
    risk_money_usd: Number(riskMoney.toFixed(2)),
    sl_pips: Number(slPips.toFixed(1)),
    micro_lots: Number(microLots.toFixed(2)),
    units: Math.round(microLots * Config.MICRO_LOT_UNITS)
  };
}

/* =========================================================
   ENGINES
   ========================================================= */
function closest(levels, price, maxDistPips) {
  if (!levels.length) return null;
  const tol = maxDistPips * Config.PIP_SIZE;
  let best = null;
  for (const lv of levels) {
    const d = Math.abs(lv.price - price);
    if (d <= tol) { if (!best || d < Math.abs(best.price - price)) best = lv; }
  }
  return best;
}

/* PULLBACK */
function pullbackScoreBull(d1, h4, h1, sr) {
  let score = 0; const confs = []; const notes = [];
  const lastH1 = h1[h1.length - 1];
  const price = lastH1.close;
  const sD1 = structureSnapshot(d1), sH4 = structureSnapshot(h4), sH1 = structureSnapshot(h1);
  if (sD1.bias === "BULLISH") { score += 15; confs.push("D1 bullish"); }
  else if (sD1.bias === "MIXED") score += 7;
  if (sH4.bias === "BULLISH") { score += 20; confs.push("H4 bullish"); }
  else if (sH4.bias === "MIXED") score += 10;
  else return { score: 0, confs, notes: ["H4 not bullish"] };
  if (sH1.bias === "BULLISH") { score += 15; confs.push("H1 bullish"); }
  else if (sH1.bias === "MIXED") { score += 8; confs.push("H1 pullback"); }
  const nearSup = closest(sr.support, price, 20);
  if (nearSup) { score += 15; confs.push(`near ${nearSup.label}`); }
  if (price < lastH1.ema20) { score += 6; confs.push("below EMA20"); }
  if (sH4.last_high && sH4.last_low) {
    const leg = sH4.last_high - sH4.last_low;
    if (leg > 0) {
      const retr = (sH4.last_high - price) / leg;
      if (retr >= 0.30 && retr <= 0.70) { score += 4; confs.push(`fib ${(retr*100).toFixed(0)}%`); }
    }
  }
  if (lastH1.close > lastH1.open) { score += 6; confs.push("bull candle"); }
  if (lastH1.close > lastH1.high - 0.3*(lastH1.high - lastH1.low)) { score += 4; confs.push("strong close"); }
  if (price > lastH1.ema20 && lastH1.ema20 > lastH1.ema50) { score += 5; confs.push("EMA aligned"); }
  else if (lastH1.ema20 > lastH1.ema50) score += 3;
  const r = lastH1.rsi;
  if (r >= 40 && r <= 65) { score += 5; confs.push(`RSI ${r.toFixed(1)}`); }
  else if (r < 30) score += 3;
  const adx = lastH1.adx;
  if (adx >= 25) { score += 5; confs.push(`ADX ${adx.toFixed(1)}`); }
  else if (adx >= 20) score += 3;
  return { score: Math.min(score, 100), confs, notes };
}
function pullbackScoreBear(d1, h4, h1, sr) {
  let score = 0; const confs = []; const notes = [];
  const lastH1 = h1[h1.length - 1];
  const price = lastH1.close;
  const sD1 = structureSnapshot(d1), sH4 = structureSnapshot(h4), sH1 = structureSnapshot(h1);
  if (sD1.bias === "BEARISH") { score += 15; confs.push("D1 bearish"); }
  else if (sD1.bias === "MIXED") score += 7;
  if (sH4.bias === "BEARISH") { score += 20; confs.push("H4 bearish"); }
  else if (sH4.bias === "MIXED") score += 10;
  else return { score: 0, confs, notes: ["H4 not bearish"] };
  if (sH1.bias === "BEARISH") { score += 15; confs.push("H1 bearish"); }
  else if (sH1.bias === "MIXED") { score += 8; confs.push("H1 pullback"); }
  const nearRes = closest(sr.resistance, price, 20);
  if (nearRes) { score += 15; confs.push(`near ${nearRes.label}`); }
  if (price > lastH1.ema20) { score += 6; confs.push("above EMA20"); }
  if (sH4.last_high && sH4.last_low) {
    const leg = sH4.last_high - sH4.last_low;
    if (leg > 0) {
      const retr = (price - sH4.last_low) / leg;
      if (retr >= 0.30 && retr <= 0.70) { score += 4; confs.push(`fib ${(retr*100).toFixed(0)}%`); }
    }
  }
  if (lastH1.close < lastH1.open) { score += 6; confs.push("bear candle"); }
  if (lastH1.close < lastH1.low + 0.3*(lastH1.high - lastH1.low)) { score += 4; confs.push("weak close"); }
  if (price < lastH1.ema20 && lastH1.ema20 < lastH1.ema50) { score += 5; confs.push("EMA aligned"); }
  else if (lastH1.ema20 < lastH1.ema50) score += 3;
  const r = lastH1.rsi;
  if (r >= 35 && r <= 60) { score += 5; confs.push(`RSI ${r.toFixed(1)}`); }
  else if (r > 70) score += 3;
  const adx = lastH1.adx;
  if (adx >= 25) { score += 5; confs.push(`ADX ${adx.toFixed(1)}`); }
  else if (adx >= 20) score += 3;
  return { score: Math.min(score, 100), confs, notes };
}
const pullbackEngine = {
  run(d1, h4, h1, sr, regime) {
    const bull = pullbackScoreBull(d1, h4, h1, sr);
    const bear = pullbackScoreBear(d1, h4, h1, sr);
    const T = Config.ENGINE_FIRE_THRESHOLD;
    if (bull.score >= bear.score && bull.score >= T) return { engine: "PULLBACK", side: "BUY", score: bull.score, confirmations: bull.confs, notes: bull.notes };
    if (bear.score > bull.score && bear.score >= T) return { engine: "PULLBACK", side: "SELL", score: bear.score, confirmations: bear.confs, notes: bear.notes };
    if (bull.score >= bear.score) return { engine: "PULLBACK", side: "WAIT", score: bull.score, confirmations: bull.confs, notes: bull.notes };
    return { engine: "PULLBACK", side: "WAIT", score: bear.score, confirmations: bear.confs, notes: bear.notes };
  }
};

/* BREAKOUT */
function breakoutScoreBull(d1, h4, h1, sr) {
  let score = 0; const confs = []; const notes = [];
  const lastH1 = h1[h1.length - 1];
  const price = lastH1.close;
  const sH4 = structureSnapshot(h4);
  if (sH4.bias === "BULLISH") { score += 15; confs.push("H4 bullish"); }
  else if (sH4.bias === "MIXED") score += 5;
  let aboveRes = null;
  for (const r of sr.resistance) { if (r.price < price - 5*Config.PIP_SIZE) { aboveRes = r; break; } }
  if (!aboveRes) return { score: 0, confs, notes: ["no broken resistance below price"] };
  score += 20; confs.push(`broken ${aboveRes.label}`);
  const last3 = h1.slice(-3);
  const upCandles = last3.filter(r => r.close > r.open).length;
  if (upCandles >= 2) { score += 15; confs.push(`${upCandles}/3 bullish`); }
  else if (upCandles === 1) score += 7;
  const tol = 10 * Config.PIP_SIZE;
  const recent = h1.slice(-10);
  let tested = false;
  for (const row of recent) { if (Math.abs(row.low - aboveRes.price) <= tol) { tested = true; break; } }
  if (tested) { score += 15; confs.push("retested"); }
  if (lastH1.close > lastH1.open) { score += 10; confs.push("bull confirm"); }
  if (lastH1.adx >= 25) { score += 10; confs.push(`ADX ${lastH1.adx.toFixed(1)}`); }
  else if (lastH1.adx >= 20) score += 5;
  if (lastH1.rsi >= 45 && lastH1.rsi <= 70) { score += 10; confs.push(`RSI ${lastH1.rsi.toFixed(1)}`); }
  const dist = price - aboveRes.price;
  if (dist > 30 * Config.PIP_SIZE) notes.push(`${Math.round(dist/Config.PIP_SIZE)}p above break`);
  return { score: Math.min(score, 100), confs, notes };
}
function breakoutScoreBear(d1, h4, h1, sr) {
  let score = 0; const confs = []; const notes = [];
  const lastH1 = h1[h1.length - 1];
  const price = lastH1.close;
  const sH4 = structureSnapshot(h4);
  if (sH4.bias === "BEARISH") { score += 15; confs.push("H4 bearish"); }
  else if (sH4.bias === "MIXED") score += 5;
  let belowSup = null;
  for (const s of sr.support) { if (s.price > price + 5*Config.PIP_SIZE) { belowSup = s; break; } }
  if (!belowSup) return { score: 0, confs, notes: ["no broken support above price"] };
  score += 20; confs.push(`broken ${belowSup.label}`);
  const last3 = h1.slice(-3);
  const dnCandles = last3.filter(r => r.close < r.open).length;
  if (dnCandles >= 2) { score += 15; confs.push(`${dnCandles}/3 bearish`); }
  else if (dnCandles === 1) score += 7;
  const tol = 10 * Config.PIP_SIZE;
  const recent = h1.slice(-10);
  let tested = false;
  for (const row of recent) { if (Math.abs(row.high - belowSup.price) <= tol) { tested = true; break; } }
  if (tested) { score += 15; confs.push("retested"); }
  if (lastH1.close < lastH1.open) { score += 10; confs.push("bear confirm"); }
  if (lastH1.adx >= 25) { score += 10; confs.push(`ADX ${lastH1.adx.toFixed(1)}`); }
  else if (lastH1.adx >= 20) score += 5;
  if (lastH1.rsi >= 30 && lastH1.rsi <= 55) { score += 10; confs.push(`RSI ${lastH1.rsi.toFixed(1)}`); }
  const dist = belowSup.price - price;
  if (dist > 30 * Config.PIP_SIZE) notes.push(`${Math.round(dist/Config.PIP_SIZE)}p below break`);
  return { score: Math.min(score, 100), confs, notes };
}
const breakoutEngine = {
  run(d1, h4, h1, sr, regime) {
    const bull = breakoutScoreBull(d1, h4, h1, sr);
    const bear = breakoutScoreBear(d1, h4, h1, sr);
    const T = Config.ENGINE_FIRE_THRESHOLD;
    if (bull.score >= bear.score && bull.score >= T) return { engine: "BREAKOUT", side: "BUY", score: bull.score, confirmations: bull.confs, notes: bull.notes };
    if (bear.score > bull.score && bear.score >= T) return { engine: "BREAKOUT", side: "SELL", score: bear.score, confirmations: bear.confs, notes: bear.notes };
    if (bull.score >= bear.score) return { engine: "BREAKOUT", side: "WAIT", score: bull.score, confirmations: bull.confs, notes: bull.notes };
    return { engine: "BREAKOUT", side: "WAIT", score: bear.score, confirmations: bear.confs, notes: bear.notes };
  }
};

/* LIQUIDITY */
function liquidityScore(d1, h4, h1, sr, wanted) {
  let score = 0; const confs = []; const notes = [];
  const lastH1 = h1[h1.length - 1];
  const price = lastH1.close;
  const swH1 = detectSweep(h1), swH4 = detectSweep(h4);
  if (swH1.side === wanted) { score += 25; confs.push(`H1 sweep @ ${swH1.level.toFixed(5)}`); }
  else if (swH4.side === wanted) { score += 20; confs.push(`H4 sweep @ ${swH4.level.toFixed(5)}`); }
  else return { score: 0, confs, notes: ["no sweep"] };
  const sH1 = structureSnapshot(h1), sH4 = structureSnapshot(h4);
  if (wanted === "BUY" && (sH1.bias === "BULLISH" || sH1.bias === "MIXED")) { score += 15; confs.push(`H1 ${sH1.bias}`); }
  else if (wanted === "SELL" && (sH1.bias === "BEARISH" || sH1.bias === "MIXED")) { score += 15; confs.push(`H1 ${sH1.bias}`); }
  if (wanted === "BUY" && sH4.bias === "BULLISH") { score += 10; confs.push("H4 bullish"); }
  else if (wanted === "SELL" && sH4.bias === "BEARISH") { score += 10; confs.push("H4 bearish"); }
  else score += 3;
  if (wanted === "BUY") {
    for (const lv of sr.support.slice(0,3)) { if (Math.abs(lv.price - price) < 15*Config.PIP_SIZE) { score += 15; confs.push(`near ${lv.label}`); break; } }
  } else {
    for (const lv of sr.resistance.slice(0,3)) { if (Math.abs(lv.price - price) < 15*Config.PIP_SIZE) { score += 15; confs.push(`near ${lv.label}`); break; } }
  }
  const o = lastH1.open, c = lastH1.close, h = lastH1.high, l = lastH1.low;
  const body = Math.max(Math.abs(c - o), Config.PIP_SIZE);
  if (wanted === "BUY") {
    const lw = Math.min(o, c) - l;
    if (lw >= 0.4 * body && c > o) { score += 15; confs.push("bull wick"); }
  } else {
    const uw = h - Math.max(o, c);
    if (uw >= 0.4 * body && c < o) { score += 15; confs.push("bear wick"); }
  }
  if (lastH1.adx >= 20) { score += 10; confs.push(`ADX ${lastH1.adx.toFixed(1)}`); }
  const r = lastH1.rsi;
  if (wanted === "BUY") {
    if (r < 35) { score += 10; confs.push(`RSI ${r.toFixed(1)}`); }
    else if (r <= 55) score += 5;
  } else {
    if (r > 65) { score += 10; confs.push(`RSI ${r.toFixed(1)}`); }
    else if (r >= 45) score += 5;
  }
  return { score: Math.min(score, 100), confs, notes };
}
const liquidityEngine = {
  run(d1, h4, h1, sr, regime) {
    const bull = liquidityScore(d1, h4, h1, sr, "BUY");
    const bear = liquidityScore(d1, h4, h1, sr, "SELL");
    const T = Config.ENGINE_FIRE_THRESHOLD;
    if (bull.score >= bear.score && bull.score >= T) return { engine: "LIQUIDITY", side: "BUY", score: bull.score, confirmations: bull.confs, notes: bull.notes };
    if (bear.score > bull.score && bear.score >= T) return { engine: "LIQUIDITY", side: "SELL", score: bear.score, confirmations: bear.confs, notes: bear.notes };
    if (bull.score >= bear.score) return { engine: "LIQUIDITY", side: "WAIT", score: bull.score, confirmations: bull.confs, notes: bull.notes };
    return { engine: "LIQUIDITY", side: "WAIT", score: bear.score, confirmations: bear.confs, notes: bear.notes };
  }
};

/* RANGE */
function rangeBounds(h4, lookback = 30) {
  if (h4.length < lookback) return null;
  const w = h4.slice(-lookback);
  const hi = Math.max(...w.map(c => c.high));
  const lo = Math.min(...w.map(c => c.low));
  return { high: hi, low: lo, mid: (hi + lo) / 2 };
}
function isRanging(h4) {
  if (!h4 || !h4.length) return false;
  return h4[h4.length - 1].adx <= 25;
}
function rangeScore(h4, h1, sr, wanted) {
  let score = 0; const confs = []; const notes = [];
  if (!isRanging(h4)) return { score: 0, confs, notes: ["not ranging"] };
  const rng = rangeBounds(h4);
  if (!rng) return { score: 0, confs, notes: ["insufficient data"] };
  const lastH1 = h1[h1.length - 1];
  const price = lastH1.close;
  const width = rng.high - rng.low;
  if (width <= 0) return { score: 0, confs, notes: ["invalid range"] };
  const pos = (price - rng.low) / width;
  if (pos >= 0.35 && pos <= 0.65) return { score: 0, confs, notes: ["in middle"] };
  if (wanted === "BUY") {
    if (pos > 0.35) return { score: 0, confs, notes: ["BUY only near low"] };
    score += 20; confs.push(`lower ${(pos*100).toFixed(0)}%`);
    const distHigh = rng.high - price;
    if (distHigh >= 2 * (price - rng.low)) { score += 15; confs.push("room to high"); }
  } else {
    if (pos < 0.65) return { score: 0, confs, notes: ["SELL only near high"] };
    score += 20; confs.push(`upper ${(pos*100).toFixed(0)}%`);
    const distLow = price - rng.low;
    if (distLow >= 2 * (rng.high - price)) { score += 15; confs.push("room to low"); }
  }
  if (wanted === "BUY") {
    for (const lv of sr.support.slice(0,3)) { if (Math.abs(lv.price - price) < 15*Config.PIP_SIZE) { score += 15; confs.push(`sup ${lv.label}`); break; } }
  } else {
    for (const lv of sr.resistance.slice(0,3)) { if (Math.abs(lv.price - price) < 15*Config.PIP_SIZE) { score += 15; confs.push(`res ${lv.label}`); break; } }
  }
  const o = lastH1.open, c = lastH1.close, h = lastH1.high, l = lastH1.low;
  const body = Math.max(Math.abs(c - o), Config.PIP_SIZE);
  if (wanted === "BUY") {
    const wick = Math.min(o, c) - l;
    if (wick >= 0.4 * body && c > o) { score += 15; confs.push("bull rejection"); }
  } else {
    const wick = h - Math.max(o, c);
    if (wick >= 0.4 * body && c < o) { score += 15; confs.push("bear rejection"); }
  }
  const r = lastH1.rsi;
  if (wanted === "BUY" && r < 40) { score += 15; confs.push(`RSI ${r.toFixed(1)}`); }
  else if (wanted === "SELL" && r > 60) { score += 15; confs.push(`RSI ${r.toFixed(1)}`); }
  const adx = lastH1.adx;
  if (adx < 20) { score += 20; confs.push(`ADX ${adx.toFixed(1)}`); }
  else if (adx < 25) score += 10;
  return { score: Math.min(score, 100), confs, notes };
}
const rangeEngine = {
  run(d1, h4, h1, sr, regime) {
    if (regime !== "RANGE") return { engine: "RANGE", side: "WAIT", score: 0, confirmations: [], notes: [`regime=${regime}`] };
    const bull = rangeScore(h4, h1, sr, "BUY");
    const bear = rangeScore(h4, h1, sr, "SELL");
    const T = Config.ENGINE_FIRE_THRESHOLD;
    if (bull.score >= bear.score && bull.score >= T) return { engine: "RANGE", side: "BUY", score: bull.score, confirmations: bull.confs, notes: bull.notes };
    if (bear.score > bull.score && bear.score >= T) return { engine: "RANGE", side: "SELL", score: bear.score, confirmations: bear.confs, notes: bear.notes };
    if (bull.score >= bear.score) return { engine: "RANGE", side: "WAIT", score: bull.score, confirmations: bull.confs, notes: bull.notes };
    return { engine: "RANGE", side: "WAIT", score: bear.score, confirmations: bear.confs, notes: bear.notes };
  }
};

/* MOMENTUM */
function momentumScore(d1, h4, h1, sr, wanted) {
  let score = 0; const confs = []; const notes = [];
  const lastH1 = h1[h1.length - 1];
  const price = lastH1.close;
  const sH4 = structureSnapshot(h4), sH1 = structureSnapshot(h1);
  const adxH4 = h4[h4.length - 1].adx;
  const adxH1 = lastH1.adx;
  if (wanted === "BUY") {
    if (sH4.bias === "BULLISH" && adxH4 >= 25) { score += 25; confs.push(`H4 bull ADX ${adxH4.toFixed(1)}`); }
    else if (sH1.bias === "BULLISH" && adxH1 >= 25) { score += 15; confs.push(`H1 bull ADX ${adxH1.toFixed(1)}`); }
    else return { score: 0, confs, notes: ["no bull momentum"] };
  } else {
    if (sH4.bias === "BEARISH" && adxH4 >= 25) { score += 25; confs.push(`H4 bear ADX ${adxH4.toFixed(1)}`); }
    else if (sH1.bias === "BEARISH" && adxH1 >= 25) { score += 15; confs.push(`H1 bear ADX ${adxH1.toFixed(1)}`); }
    else return { score: 0, confs, notes: ["no bear momentum"] };
  }
  const last3 = h1.slice(-3);
  let big;
  if (wanted === "BUY") big = last3.filter(r => r.close > r.open && (r.close - r.open) > 0.5 * r.atr).length;
  else big = last3.filter(r => r.close < r.open && (r.open - r.close) > 0.5 * r.atr).length;
  if (big >= 1) { score += 20; confs.push(`${big} strong`); }
  const ema20 = lastH1.ema20, atrH1 = lastH1.atr;
  const dist = Math.abs(price - ema20);
  if (atrH1 > 0) {
    const ext = dist / atrH1;
    if (wanted === "BUY" && price > ema20) {
      if (ext <= 2.0) { score += 20; confs.push(`ext ${ext.toFixed(1)}`); }
      else return { score: 0, confs, notes: [`too extended`] };
    } else if (wanted === "SELL" && price < ema20) {
      if (ext <= 2.0) { score += 20; confs.push(`ext ${ext.toFixed(1)}`); }
      else return { score: 0, confs, notes: [`too extended`] };
    }
  }
  if (wanted === "BUY") {
    const nearestR = sr.resistance[0];
    if (nearestR) {
      const dp = (nearestR.price - price) / Config.PIP_SIZE;
      if (dp >= 40) { score += 20; confs.push(`${Math.round(dp)}p room`); }
      else if (dp >= 25) score += 10;
    }
  } else {
    const nearestS = sr.support[0];
    if (nearestS) {
      const dp = (price - nearestS.price) / Config.PIP_SIZE;
      if (dp >= 40) { score += 20; confs.push(`${Math.round(dp)}p room`); }
      else if (dp >= 25) score += 10;
    }
  }
  const r = lastH1.rsi;
  if (wanted === "BUY") {
    if (r >= 45 && r <= 70) { score += 15; confs.push(`RSI ${r.toFixed(1)}`); }
  } else {
    if (r >= 30 && r <= 55) { score += 15; confs.push(`RSI ${r.toFixed(1)}`); }
  }
  return { score: Math.min(score, 100), confs, notes };
}
const momentumEngine = {
  run(d1, h4, h1, sr, regime) {
    if (regime !== "TREND_UP" && regime !== "TREND_DOWN") {
      return { engine: "MOMENTUM", side: "WAIT", score: 0, confirmations: [], notes: [`regime=${regime}`] };
    }
    const bull = momentumScore(d1, h4, h1, sr, "BUY");
    const bear = momentumScore(d1, h4, h1, sr, "SELL");
    const T = Config.ENGINE_FIRE_THRESHOLD;
    if (bull.score >= bear.score && bull.score >= T) return { engine: "MOMENTUM", side: "BUY", score: bull.score, confirmations: bull.confs, notes: bull.notes };
    if (bear.score > bull.score && bear.score >= T) return { engine: "MOMENTUM", side: "SELL", score: bear.score, confirmations: bear.confs, notes: bear.notes };
    if (bull.score >= bear.score) return { engine: "MOMENTUM", side: "WAIT", score: bull.score, confirmations: bull.confs, notes: bull.notes };
    return { engine: "MOMENTUM", side: "WAIT", score: bear.score, confirmations: bear.confs, notes: bear.notes };
  }
};

/* =========================================================
   AGGREGATOR
   ========================================================= */
const ENGINES = [
  ["PULLBACK",  pullbackEngine],
  ["BREAKOUT",  breakoutEngine],
  ["LIQUIDITY", liquidityEngine],
  ["RANGE",     rangeEngine],
  ["MOMENTUM",  momentumEngine]
];
function unavailableResult(mode, reason) {
  return {
    price: null, regime: { master: "UNKNOWN" }, signals: {},
    bias: "WAIT", bias_score: 0, conflict: "NONE", conflicts: [],
    sr: { resistance: [], support: [] },
    mode, entry: null, sl: null, sl_reason: null, tp: null, pos: null,
    final: "WAIT", blockers: [], warnings: [reason], data_available: false
  };
}
function evaluateMode(mode, dfs) {
  const d1 = dfs.D1, h4 = dfs.H4, h1 = dfs.H1;
  if (!d1 || !h4 || !h1 || !d1.length || !h4.length || !h1.length) {
    return unavailableResult(mode, "DATA UNAVAILABLE");
  }
  const price = h1[h1.length - 1].close;
  const levels = getLevels({ D1: d1, H4: h4, H1: h1 }, price);
  const sr = {
    resistance: levels.resistance.map(r => ({ label: r.label, price: r.price, strength: r.strength, touches: r.touches, sources: r.sources })),
    support:    levels.support.map(s => ({ label: s.label, price: s.price, strength: s.strength, touches: s.touches, sources: s.sources }))
  };
  const reg = multiTfRegime({ D1: d1, H4: h4, H1: h1 });
  const signals = {};
  for (const [name, eng] of ENGINES) signals[name] = eng.run(d1, h4, h1, sr, reg.master);

  const buyVotes = Object.entries(signals).filter(([_,s]) => s.side === "BUY").map(([n]) => n);
  const sellVotes = Object.entries(signals).filter(([_,s]) => s.side === "SELL").map(([n]) => n);
  let buyScoreRaw = 0, sellScoreRaw = 0, buyW = 0, sellW = 0;
  for (const [name, sig] of Object.entries(signals)) {
    const w = Config.ENGINE_WEIGHTS[name] || 0.2;
    if (sig.side === "BUY") { buyScoreRaw += sig.score * w; buyW += w; }
    else if (sig.side === "SELL") { sellScoreRaw += sig.score * w; sellW += w; }
  }
  const buyScore = buyW > 0 ? buyScoreRaw / buyW : 0;
  const sellScore = sellW > 0 ? sellScoreRaw / sellW : 0;
  let bias, biasScore, conflicts;
  if (buyVotes.length > sellVotes.length) { bias = "BUY"; biasScore = buyScore; conflicts = sellVotes; }
  else if (sellVotes.length > buyVotes.length) { bias = "SELL"; biasScore = sellScore; conflicts = buyVotes; }
  else { bias = "WAIT"; biasScore = 0; conflicts = []; }
  const nAgree = bias === "BUY" ? buyVotes.length : sellVotes.length;
  if (nAgree >= 3) biasScore = Math.min(biasScore + 8, 100);
  else if (nAgree === 2) biasScore = Math.min(biasScore + 3, 100);
  let conflict = "NONE";
  if (conflicts.length === 1) conflict = "LOW";
  else if (conflicts.length === 2) conflict = "MODERATE";
  else if (conflicts.length >= 3) conflict = "HIGH";

  const result = {
    price, regime: reg, signals, bias,
    bias_score: Math.round(biasScore * 10) / 10,
    conflict, conflicts, sr, mode,
    entry: null, sl: null, sl_reason: null, tp: null, pos: null,
    final: "WAIT", blockers: [], warnings: [], data_available: true
  };
  if (bias === "WAIT") return result;

  const entry = price;
  const [sl, slReason] = structuralSL(h1, h4, bias, entry);
  const tp = computeTargets(bias, entry, sl, sr);
  const ps = computePositionSize(entry, sl);
  result.entry = entry; result.sl = sl; result.sl_reason = slReason;
  result.tp = tp; result.pos = ps;

  const blockers = [];
  if (!tp || (mode !== "HIGH_OPPORTUNITY" && tp.rr_tp2 < Config.MIN_RR_ABSOLUTE)) {
    const rr = tp ? tp.rr_tp2 : 0;
    blockers.push(`R:R to TP2 ${rr.toFixed(2)} < min ${Config.MIN_RR_ABSOLUTE}`);
  }
  const atrH1 = h1[h1.length - 1].atr;
  const ema20H1 = h1[h1.length - 1].ema20;
  if (atrH1 > 0) {
    const ext = Math.abs(entry - ema20H1) / atrH1;
    if (ext > Config.BLOCK_EXTENDED_ENTRY_ATR) blockers.push(`entry ${ext.toFixed(2)} ATR from EMA20`);
  }
  result.blockers = blockers;

  const m = Config.MODES[mode];
  const gateFail = [];
  if (biasScore < m.min_score) gateFail.push(`score ${biasScore.toFixed(1)} < ${m.min_score}`);
  const rr2 = tp ? tp.rr_tp2 : 0;
  if (!tp || (mode !== "HIGH_OPPORTUNITY" && rr2 < m.min_rr)) gateFail.push(`R:R ${rr2.toFixed(2)} < ${m.min_rr}`);
  const nConfs = 1 + Object.values(signals).filter(s => s.side === bias).length;
  if (nConfs < m.min_confirmations) gateFail.push(`confirmations ${nConfs} < ${m.min_confirmations}`);
  const conflictOrder = { NONE: 0, LOW: 1, MODERATE: 2, HIGH: 3 };
  if ((conflictOrder[conflict] || 0) > (conflictOrder[m.max_conflict] || 0)) gateFail.push(`conflict ${conflict} > ${m.max_conflict}`);

  if (blockers.length) result.final = "NO_TRADE";
  else if (gateFail.length) { result.final = "WAIT"; result.warnings = gateFail; }
  else result.final = bias;
  return result;
}

/* =========================================================
   STATE MANAGER
   ========================================================= */
function nowIST() { return new Date(); }
function resetDailyIfNeeded(mode) {
  const today = new Date().toISOString().slice(0,10);
  if (state[mode].today.date !== today) {
    state[mode].today = { date: today, wins: 0, losses: 0 };
    state[mode].cooldown_until = null;
  }
}
function isInCooldown(mode) {
  const cu = state[mode].cooldown_until;
  if (!cu) return false;
  return new Date() < new Date(cu);
}
function dailyLossesReached(mode) { return state[mode].today.losses >= 3; }
function freezeNewTrade(mode, aggResult, enginesFiring) {
  const trade = {
    side: aggResult.final,
    fired_at: nowIST().toISOString(),
    entry: aggResult.entry, sl: aggResult.sl,
    tp1: aggResult.tp.tp1, tp2: aggResult.tp.tp2, tp3: aggResult.tp.tp3,
    rr_tp2: aggResult.tp.rr_tp2,
    sl_original: aggResult.sl, sl_reason: aggResult.sl_reason,
    size_micro_lots: aggResult.pos.micro_lots, units: aggResult.pos.units,
    risk_usd: aggResult.pos.risk_money_usd, risk_pips: aggResult.pos.sl_pips,
    score_at_fire: aggResult.bias_score,
    engines_firing: enginesFiring,
    tp1_hit: false, tp1_hit_at: null, sl_moved_to_be: false,
    status: "OPEN"
  };
  state[mode].open_trade = trade;
  saveState();
  return trade;
}
function closeTrade(mode, result, closePrice, closeReason) {
  const t = state[mode].open_trade;
  if (!t) return;
  const closed = { ...t, closed_at: nowIST().toISOString(), close_price: closePrice, close_reason: closeReason, result };
  state[mode].closed_trades.push(closed);
  state[mode].open_trade = null;
  resetDailyIfNeeded(mode);
  if (result === "WIN") state[mode].today.wins++;
  else state[mode].today.losses++;
  const cdTs = new Date(Date.now() + Config.COOLDOWN_MIN * 60 * 1000);
  state[mode].cooldown_until = cdTs.toISOString();
  saveState();
}
function checkAndUpdateLifecycle(mode, candleHigh, candleLow) {
  if (candleHigh == null || candleLow == null) return [];
  const t = state[mode].open_trade;
  if (!t) return [];
  const events = [];
  const side = t.side, tp1 = t.tp1, tp2 = t.tp2, sl = t.sl;
  if (side === "SELL") {
    if (candleHigh >= sl) {
      const result = t.tp1_hit ? "WIN" : "LOSS";
      closeTrade(mode, result, sl, "SL"); return [`SL_HIT_${result}`];
    }
    if (candleLow <= tp2) { closeTrade(mode, "WIN", tp2, "TP2"); return ["TP2_HIT"]; }
    if (!t.tp1_hit && candleLow <= tp1) {
      if (Config.MODES[mode].close_at_tp1) { closeTrade(mode, "WIN", tp1, "TP1"); return ["TP1_HIT","TP1_CLOSE_WIN"]; }
      t.tp1_hit = true; t.tp1_hit_at = nowIST().toISOString();
      t.sl = t.entry; t.sl_moved_to_be = true; saveState();
      events.push("TP1_HIT");
    }
  } else {
    if (candleLow <= sl) {
      const result = t.tp1_hit ? "WIN" : "LOSS";
      closeTrade(mode, result, sl, "SL"); return [`SL_HIT_${result}`];
    }
    if (candleHigh >= tp2) { closeTrade(mode, "WIN", tp2, "TP2"); return ["TP2_HIT"]; }
    if (!t.tp1_hit && candleHigh >= tp1) {
      if (Config.MODES[mode].close_at_tp1) { closeTrade(mode, "WIN", tp1, "TP1"); return ["TP1_HIT","TP1_CLOSE_WIN"]; }
      t.tp1_hit = true; t.tp1_hit_at = nowIST().toISOString();
      t.sl = t.entry; t.sl_moved_to_be = true; saveState();
      events.push("TP1_HIT");
    }
  }
  return events;
}
function modeStats(mode) {
  resetDailyIfNeeded(mode);
  const w = state[mode].today.wins;
  const l = state[mode].today.losses;
  const total = w + l;
  const wr = total > 0 ? (w / total) * 100 : 0;
  return { w, l, wr };
}

/* =========================================================
   MODE ENGINE
   ========================================================= */
function processModes(dfs) {
  const MODES = ["HIGH_OPPORTUNITY","BALANCED","SNIPER"];
  const rawResults = {};
  const signalsFired = [];
  const lifecycleEvents = [];
  const rHO = evaluateMode("HIGH_OPPORTUNITY", dfs);
  rawResults.HIGH_OPPORTUNITY = rHO;
  const currentPrice = rHO.price;

  for (const mode of MODES) {
    resetDailyIfNeeded(mode);
    const high = currentPrice, low = currentPrice;
    const events = checkAndUpdateLifecycle(mode, high, low);
    events.forEach(e => lifecycleEvents.push(mode + ":" + e));
    let r;
    if (mode === "HIGH_OPPORTUNITY") r = rHO;
    else { r = evaluateMode(mode, dfs); rawResults[mode] = r; }
    resetDailyIfNeeded(mode);
    const inCd = isInCooldown(mode);
    const lossesMaxed = dailyLossesReached(mode);
    const hasOpen = state[mode].open_trade !== null;
    if (!hasOpen && !inCd && !lossesMaxed && (r.final === "BUY" || r.final === "SELL")) {
      const enginesFiring = Object.entries(r.signals).filter(([_,s]) => s.side === r.final).map(([n]) => n);
      freezeNewTrade(mode, r, enginesFiring);
      signalsFired.push(mode);
    }
  }
  saveState();
  return {
    price: currentPrice,
    market: {
      regime: rHO.regime.master,
      bias: rHO.bias,
      conflict: rHO.conflict,
      sr: rHO.sr,
      signals: rHO.signals,
      regime_per_tf: rHO.regime.per_tf
    },
    aggregator: rawResults,
    state, signals_fired: signalsFired, lifecycle_events: lifecycleEvents
  };
}

/* =========================================================
   TWELVE DATA FETCHER
   ========================================================= */
function trackApiCall() {
  const today = new Date().toISOString().slice(0,10);
  let day = localStorage.getItem("swing_api_day");
  let count = parseInt(localStorage.getItem("swing_api_count") || "0", 10);
  if (day !== today) { count = 0; day = today; localStorage.setItem("swing_api_day", day); }
  count++;
  localStorage.setItem("swing_api_count", String(count));
}
async function fetchTwelve(interval, outputsize) {
  trackApiCall();
  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", SYMBOL);
  url.searchParams.set("interval", interval);
  url.searchParams.set("outputsize", outputsize);
  url.searchParams.set("apikey", TWELVE_DATA_API_KEY);
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("order", "ASC");
  const r = await fetch(url.toString(), { cache: "no-store" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const data = await r.json();
  if (data.status === "error") throw new Error(data.message);
  if (!data.values) throw new Error("No values");
  return data.values.map(v => ({
    time: Math.floor(new Date(v.datetime).getTime() / 1000),
    open: Number(v.open), high: Number(v.high),
    low: Number(v.low), close: Number(v.close),
    volume: Number(v.volume || 0)
  })).filter(c => Number.isFinite(c.open) && Number.isFinite(c.close));
}
function isFresh(entry, ttl) { return (Date.now() - entry.ts) < ttl; }
async function loadCandlesCached(tf, interval, size, ttl) {
  if (cache[tf].data && isFresh(cache[tf], ttl)) return cache[tf].data;
  const raw = await fetchTwelve(interval, size);
  const withInd = addIndicators(raw);
  cache[tf] = { data: withInd, ts: Date.now() };
  return withInd;
}
async function loadAll() {
  const D1 = await loadCandlesCached("D1", "1day", 300, CACHE_TTL.D1);
  const H4 = await loadCandlesCached("H4", "4h", 300, CACHE_TTL.H4);
  const H1 = await loadCandlesCached("H1", "1h", 500, CACHE_TTL.H1);
  return { D1, H4, H1 };
}

/* =========================================================
   UI RENDER
   ========================================================= */
function serialise(processResult) {
  const r = processResult;
  const outModes = {};
  for (const mode of ["HIGH_OPPORTUNITY","BALANCED","SNIPER"]) {
    const mstate = r.state[mode];
    const t = mstate.open_trade;
    const { w, l, wr } = modeStats(mode);
    const inCd = isInCooldown(mode);
    const agg = r.aggregator[mode] || {};
    let trade = null;
    if (t) trade = {
      side: t.side, entry: t.entry, sl: t.sl, tp1: t.tp1, tp2: t.tp2,
      tp1_hit: !!t.tp1_hit
    };
    outModes[mode] = {
      open_trade: trade, wins: w, losses: l, wr,
      in_cooldown: inCd,
      final: agg.final, bias: agg.bias,
      bias_score: agg.bias_score,
      warnings: agg.warnings || []
    };
  }
  const sig = {};
  for (const [name, s] of Object.entries(r.market.signals || {})) {
    sig[name] = { side: s.side, score: s.score };
  }
  const sr = {};
  (r.market.sr?.resistance || []).forEach(x => sr[x.label] = { price: x.price, strength: x.strength, sources: x.sources || [] });
  (r.market.sr?.support || []).forEach(x => sr[x.label] = { price: x.price, strength: x.strength, sources: x.sources || [] });
  return {
    price: r.price,
    regime: r.market.regime,
    bias: r.market.bias,
    conflict: r.market.conflict,
    signals: sig,
    sr,
    modes: outModes,
    signals_fired: r.signals_fired || [],
    lifecycle_events: r.lifecycle_events || [],
    server_time: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false })
  };
}

function render(d) {
  const root = document.getElementById("root");
  if (!root) return;
  const clockEl = document.getElementById("clock");
  if (clockEl) clockEl.textContent = d.server_time || "--:--:--";
  if (d.error) {
    root.innerHTML = '<div class="err">' + d.error + '</div>';
    return;
  }
  const price = d.price;
  const regime = d.regime || "UNKNOWN";
  const bias = d.bias || "WAIT";
  const conflict = d.conflict || "NONE";
  let html = "";

  html += '<div class="sec-title">MARKET</div>';
  html += '<div class="market">';
  html += '<div class="market-row">';
  html += '<span><span class="mk">price:</span> <span class="mv">' + (price != null ? price.toFixed(5) : "—") + '</span></span>';
  html += '<span><span class="mk">regime:</span> <span class="mv regime-' + regime + '">' + regime + '</span></span>';
  html += '</div>';
  html += '<div class="market-row">';
  html += '<span><span class="mk">bias:</span> <span class="mv bias-' + bias + '">' + bias + '</span></span>';
  html += '<span><span class="mk">conflict:</span> <span class="mv">' + conflict + '</span></span>';
  html += '</div>';
  html += '</div>';

  html += '<div class="two-col">';
  html += '<div>';
  html += '<div class="sec-title">ENGINES</div>';
  html += '<table class="engines-table">';
  html += '<tr><th>ENGINE</th><th>SIDE</th><th style="text-align:right;">SCORE</th></tr>';
  const order = ["PULLBACK","BREAKOUT","LIQUIDITY","RANGE","MOMENTUM"];
  for (const name of order) {
    const s = (d.signals && d.signals[name]) || { side: "WAIT", score: 0 };
    const side = s.side || "WAIT";
    const score = s.score != null ? Math.round(s.score) : 0;
    html += '<tr>';
    html += '<td class="name">' + name + '</td>';
    html += '<td class="side-' + side + '">' + side + '</td>';
    html += '<td class="score">' + score + '</td>';
    html += '</tr>';
  }
  html += '</table>';
  html += '</div>';

  html += '<div>';
  html += '<div class="sec-title">S/R</div>';
  html += '<table class="sr-table">';
  html += '<tr><th>LEVEL</th><th style="text-align:right;">PRICE</th><th>STR</th><th>SRC</th></tr>';
  const sr = d.sr || {};
  const rLabels = Object.keys(sr).filter(k => k.startsWith("R")).sort((a,b) => parseInt(b.slice(1)) - parseInt(a.slice(1)));
  for (const label of rLabels) {
    const v = sr[label];
    if (!v || v.price == null) continue;
    html += '<tr>';
    html += '<td class="level">' + label + '</td>';
    html += '<td class="price">' + v.price.toFixed(5) + '</td>';
    html += '<td class="str-' + (v.strength||"") + '">' + (v.strength||"") + '</td>';
    html += '<td class="src">' + ((v.sources||[]).join(",")) + '</td>';
    html += '</tr>';
  }
  html += '<tr class="price-row"><td colspan="4">--- price ' + (price != null ? price.toFixed(5) : "—") + ' ---</td></tr>';
  const sLabels = Object.keys(sr).filter(k => k.startsWith("S")).sort((a,b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
  for (const label of sLabels) {
    const v = sr[label];
    if (!v || v.price == null) continue;
    html += '<tr>';
    html += '<td class="level">' + label + '</td>';
    html += '<td class="price">' + v.price.toFixed(5) + '</td>';
    html += '<td class="str-' + (v.strength||"") + '">' + (v.strength||"") + '</td>';
    html += '<td class="src">' + ((v.sources||[]).join(",")) + '</td>';
    html += '</tr>';
  }
  html += '</table>';
  html += '</div>';
  html += '</div>';

  html += '<div class="mode-section">';
  html += '<div class="sec-title">MODE COMPARISON</div>';
  html += '<table class="mode-table">';
  html += '<tr><th>MODE</th><th>STATE</th><th>BIAS</th><th>SCORE</th><th>OPEN TRADE</th><th>TODAY</th><th>REASON</th></tr>';
  for (const mode of ["HIGH_OPPORTUNITY","BALANCED","SNIPER"]) {
    const m = (d.modes && d.modes[mode]) || {};
    const t = m.open_trade;
    let stateTxt = "WAITING", stateCls = "state";
    if (t) { stateTxt = "OPEN"; stateCls = "state state-open"; }
    else if (m.in_cooldown) { stateTxt = "COOLDOWN"; stateCls = "state state-cooldown"; }
    const biasTxt = m.final || "WAIT";
    const score = m.bias_score != null ? m.bias_score.toFixed(1) : "0.0";
    const tradeTxt = t ? (t.side + " @" + t.entry.toFixed(5)) : "—";
    const todayTxt = "W" + (m.wins || 0) + " L" + (m.losses || 0);
    const reasonTxt = (m.warnings && m.warnings.length) ? m.warnings[0] : "";
    html += '<tr>';
    html += '<td class="mode">' + mode + '</td>';
    html += '<td class="' + stateCls + '">' + stateTxt + '</td>';
    html += '<td class="bias-' + biasTxt + '">' + biasTxt + '</td>';
    html += '<td class="score">' + score + '</td>';
    html += '<td class="trade">' + tradeTxt + '</td>';
    html += '<td class="today">' + todayTxt + '</td>';
    html += '<td class="reason">' + reasonTxt + '</td>';
    html += '</tr>';
  }
  html += '</table>';
  html += '</div>';

  const anyOpen = Object.values(d.modes || {}).some(m => m.open_trade);
  html += '<div class="setups">';
  if (anyOpen) {
    html += '<span class="active">● trade active</span>';
    for (const mode of ["HIGH_OPPORTUNITY","BALANCED","SNIPER"]) {
      const m = d.modes[mode];
      if (m && m.open_trade) {
        const t = m.open_trade;
        html += '<br>' + mode + ': ' + t.side + ' entry ' + t.entry.toFixed(5)
             + ' SL ' + t.sl.toFixed(5)
             + ' TP1 ' + t.tp1.toFixed(5)
             + ' TP2 ' + t.tp2.toFixed(5);
      }
    }
  } else {
    html += 'no active trade - waiting for signal';
  }
  html += '</div>';

  root.innerHTML = html;
}

/* =========================================================
   BOOTSTRAP
   ========================================================= */
let loading = false;
async function tick() {
  if (loading) return;
  loading = true;
  try {
    const dfs = await loadAll();
    const result = processModes(dfs);
    const data = serialise(result);
    render(data);
  } catch (e) {
    console.error("Tick error:", e);
    const root = document.getElementById("root");
    if (root) root.innerHTML = '<div class="err">Error: ' + e.message + '</div>';
  } finally {
    loading = false;
  }
}
async function start() {
  loadState();
  await tick();
  setInterval(tick, REFRESH_INTERVAL);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
window.Swing = {
  state, cache,
  refresh: tick,
  reset: () => {
    state = emptyState();
    saveState();
    cache.D1 = { data: null, ts: 0 };
    cache.H4 = { data: null, ts: 0 };
    cache.H1 = { data: null, ts: 0 };
    cache.price = { value: null, ts: 0 };
  }
};
