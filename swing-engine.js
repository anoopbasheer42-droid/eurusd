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
const CACHE_TTL = { D1: 4*3600*1000, H4: 1*3600*1000, H1: 30*60*1000 };
const cache = { D1: {data:null,ts:0}, H4: {data:null,ts:0}, H1: {data:null,ts:0} };
const STATE_KEY = "swing_state_v1";
let state = null;
function emptyModeState() {
  return { open_trade: null, today: { date: new Date().toISOString().slice(0,10), wins: 0, losses: 0 }, cooldown_until: null, closed_trades: [] };
}
function emptyState() {
  return { HIGH_OPPORTUNITY: emptyModeState(), BALANCED: emptyModeState(), SNIPER: emptyModeState() };
}
function loadState() {
  try { const raw = localStorage.getItem(STATE_KEY); state = raw ? JSON.parse(raw) : emptyState(); } catch(e) { state = emptyState(); }
  for (const m of ["HIGH_OPPORTUNITY","BALANCED","SNIPER"]) if (!state[m]) state[m] = emptyModeState();
}
function saveState() { try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch(e){} }

function ema(values, period) {
  if (!values || !values.length) return [];
  const k = 2/(period+1); const out = new Array(values.length); out[0] = values[0];
  for (let i=1;i<values.length;i++) out[i] = values[i]*k + out[i-1]*(1-k);
  return out;
}
function emaWilder(values, period) {
  if (!values || !values.length) return [];
  const a = 1/period; const out = new Array(values.length); out[0] = values[0];
  for (let i=1;i<values.length;i++) out[i] = values[i]*a + out[i-1]*(1-a);
  return out;
}
function rsi(closes, period=14) {
  const n = closes.length; const out = new Array(n).fill(50); if (n<2) return out;
  const gains = new Array(n).fill(0), losses = new Array(n).fill(0);
  for (let i=1;i<n;i++) { const d = closes[i]-closes[i-1]; if (d>0) gains[i]=d; else losses[i]=-d; }
  const ag = emaWilder(gains, period), al = emaWilder(losses, period);
  for (let i=0;i<n;i++) { if (al[i]===0) { out[i]=50; continue; } out[i] = 100 - 100/(1 + ag[i]/al[i]); }
  return out;
}
function atrSeries(candles, period=14) {
  const n = candles.length; const tr = new Array(n).fill(0);
  for (let i=1;i<n;i++) { const c=candles[i], p=candles[i-1]; tr[i] = Math.max(c.high-c.low, Math.abs(c.high-p.close), Math.abs(c.low-p.close)); }
  return emaWilder(tr, period);
}
function adxSeries(candles, period=14) {
  const n = candles.length;
  const pdm = new Array(n).fill(0), mdm = new Array(n).fill(0), tr = new Array(n).fill(0);
  for (let i=1;i<n;i++) {
    const up = candles[i].high - candles[i-1].high, dn = candles[i-1].low - candles[i].low;
    pdm[i] = (up>dn && up>0) ? up : 0; mdm[i] = (dn>up && dn>0) ? dn : 0;
    const c=candles[i], p=candles[i-1]; tr[i] = Math.max(c.high-c.low, Math.abs(c.high-p.close), Math.abs(c.low-p.close));
  }
  const atr_ = emaWilder(tr, period);
  const pdi = emaWilder(pdm, period).map((v,i)=>atr_[i]>0?100*v/atr_[i]:0);
  const mdi = emaWilder(mdm, period).map((v,i)=>atr_[i]>0?100*v/atr_[i]:0);
  const dx = pdi.map((p,i)=>{ const s = p+mdi[i]; return s===0?0:100*Math.abs(p-mdi[i])/s; });
  return emaWilder(dx, period);
}
function addIndicators(candles) {
  if (!candles || !candles.length) return candles;
  const closes = candles.map(c=>c.close);
  const e20 = ema(closes, 20), e50 = ema(closes, 50), e200 = ema(closes, 200);
  const r = rsi(closes, 14), a = atrSeries(candles, 14), x = adxSeries(candles, 14);
  return candles.map((c,i)=>({ ...c, ema20:e20[i], ema50:e50[i], ema200:e200[i], rsi:r[i], atr:a[i], adx:x[i] }));
}

function findSwings(candles, lookback=5) {
  const n = candles.length; const swings = [];
  for (let i=lookback;i<n-lookback;i++) {
    const hi = candles[i].high, lo = candles[i].low;
    let isH = true, isL = true, hc = 0, lc = 0;
    for (let j=i-lookback;j<=i+lookback;j++) {
      if (candles[j].high > hi) isH = false; if (candles[j].high === hi) hc++;
      if (candles[j].low < lo) isL = false; if (candles[j].low === lo) lc++;
    }
    if (isH && hc===1) swings.push({ idx:i, time:candles[i].time, price:hi, type:"H" });
    if (isL && lc===1) swings.push({ idx:i, time:candles[i].time, price:lo, type:"L" });
  }
  return swings.sort((a,b)=>a.idx-b.idx);
}
function classifySwings(swings) {
  const out = []; let lastH = null, lastL = null;
  for (const s of swings) {
    let tag = null;
    if (s.type === "H") { if (lastH !== null) tag = s.price > lastH.price ? "HH" : "LH"; lastH = s; }
    else { if (lastL !== null) tag = s.price > lastL.price ? "HL" : "LL"; lastL = s; }
    out.push({ ...s, tag });
  }
  return out;
}
function structureState(labeled) {
  const tags = labeled.filter(x=>x.tag).map(x=>x.tag);
  const recent = tags.slice(-6);
  const hh = recent.filter(t=>t==="HH").length, hl = recent.filter(t=>t==="HL").length;
  const lh = recent.filter(t=>t==="LH").length, ll = recent.filter(t=>t==="LL").length;
  const bull = hh+hl, bear = lh+ll;
  let bias = "MIXED";
  if (bull > bear+1) bias = "BULLISH"; else if (bear > bull+1) bias = "BEARISH";
  return { bias, recent };
}
function detectBosChoch(candles, labeled) {
  if (!labeled.length) return { bos: null, choch: null };
  const lc = candles[candles.length-1].close;
  let lastH = null, lastL = null;
  for (let i=labeled.length-1;i>=0;i--) {
    if (labeled[i].type==="H" && lastH===null) lastH = labeled[i];
    if (labeled[i].type==="L" && lastL===null) lastL = labeled[i];
    if (lastH && lastL) break;
  }
  const st = structureState(labeled); let bos = null, choch = null;
  if (lastH && lc > lastH.price) { if (st.bias==="BULLISH") bos = {type:"BOS_UP",level:lastH.price}; else choch = {type:"CHOCH_UP",level:lastH.price}; }
  if (lastL && lc < lastL.price) { if (st.bias==="BEARISH") bos = {type:"BOS_DOWN",level:lastL.price}; else choch = {type:"CHOCH_DOWN",level:lastL.price}; }
  return { bos, choch };
}
function structureSnapshot(candles) {
  const labeled = classifySwings(findSwings(candles));
  const st = structureState(labeled);
  const ev = detectBosChoch(candles, labeled);
  let lastH = null, lastL = null;
  for (let i=labeled.length-1;i>=0;i--) {
    if (labeled[i].type==="H" && lastH===null) lastH = labeled[i];
    if (labeled[i].type==="L" && lastL===null) lastL = labeled[i];
    if (lastH && lastL) break;
  }
  return { bias: st.bias, recent: st.recent, last_high: lastH?lastH.price:null, last_low: lastL?lastL.price:null, bos: ev.bos, choch: ev.choch };
}
function detectSweep(candles, lookback=10, wickRatio=0.5) {
  if (candles.length < lookback+3) return { side: null, level: null };
  const swings = findSwings(candles); if (!swings.length) return { side: null, level: null };
  const recent = swings.slice(-(lookback*2)); let lastHigh=null, lastLow=null;
  for (let i=recent.length-1;i>=0;i--) {
    if (recent[i].type==="H" && lastHigh===null) lastHigh = recent[i];
    if (recent[i].type==="L" && lastLow===null) lastLow = recent[i];
    if (lastHigh && lastLow) break;
  }
  const tail = candles.slice(-3);
  for (const row of tail) {
    const o=row.open, c=row.close, h=row.high, l=row.low;
    const body = Math.max(Math.abs(c-o), Config.PIP_SIZE);
    const lw = Math.min(o,c)-l, uw = h-Math.max(o,c);
    if (lastLow && l < lastLow.price && c > lastLow.price && lw >= wickRatio*body) return { side: "BUY", level: lastLow.price };
    if
