
"use strict";

const API_KEY = "4ba3968e609544bf8990192fdf3ed970";
const SYMBOL = "EUR/USD";
const REFRESH = 120000;
const PIP = 0.0001;
const STATE_KEY = "swing_state_v1";

const Modes = {
  HIGH_OPPORTUNITY: { min_score: 70, min_rr: 0.0, close_at_tp1: true, min_confirms: 2, max_conflict: "MODERATE" },
  BALANCED: { min_score: 75, min_rr: 2.0, close_at_tp1: false, min_confirms: 3, max_conflict: "LOW" },
  SNIPER: { min_score: 85, min_rr: 2.5, close_at_tp1: false, min_confirms: 4, max_conflict: "NONE" }
};
const WEIGHTS = { PULLBACK: 0.25, BREAKOUT: 0.20, LIQUIDITY: 0.20, RANGE: 0.15, MOMENTUM: 0.20 };
const COOLDOWN_MIN = 60;

let marketData = { D1: [], H4: [], H1: [] };
let state = loadState();
let loading = false;

/* ---- STATE ---- */
function emptyMode() {
  return { open_trade: null, today: { date: new Date().toISOString().slice(0,10), wins: 0, losses: 0 }, cooldown_until: null };
}
function emptyState() {
  return { HIGH_OPPORTUNITY: emptyMode(), BALANCED: emptyMode(), SNIPER: emptyMode() };
}
function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      for (const m of ["HIGH_OPPORTUNITY","BALANCED","SNIPER"]) if (!s[m]) s[m] = emptyMode();
      return s;
    }
  } catch(e) {}
  return emptyState();
}
function saveState() {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch(e) {}
}

/* ---- INDICATORS ---- */
function ema(v, p) {
  if (!v.length) return [];
  const k = 2/(p+1), out = new Array(v.length);
  out[0] = v[0];
  for (let i=1;i<v.length;i++) out[i] = v[i]*k + out[i-1]*(1-k);
  return out;
}
function emaWild(v, p) {
  if (!v.length) return [];
  const a = 1/p, out = new Array(v.length);
  out[0] = v[0];
  for (let i=1;i<v.length;i++) out[i] = v[i]*a + out[i-1]*(1-a);
  return out;
}
function computeRSI(closes, p) {
  p = p || 14;
  const n = closes.length, out = new Array(n).fill(50);
  if (n < 2) return out;
  const g = new Array(n).fill(0), l = new Array(n).fill(0);
  for (let i=1;i<n;i++) { const d = closes[i]-closes[i-1]; if (d>0) g[i]=d; else l[i]=-d; }
  const ag = emaWild(g, p), al = emaWild(l, p);
  for (let i=0;i<n;i++) out[i] = al[i]===0 ? 50 : 100 - 100/(1 + ag[i]/al[i]);
  return out;
}
function computeATR(c, p) {
  p = p || 14;
  const n = c.length, tr = new Array(n).fill(0);
  for (let i=1;i<n;i++) tr[i] = Math.max(c[i].high-c[i].low, Math.abs(c[i].high-c[i-1].close), Math.abs(c[i].low-c[i-1].close));
  return emaWild(tr, p);
}
function computeADX(c, p) {
  p = p || 14;
  const n = c.length, pdm = new Array(n).fill(0), mdm = new Array(n).fill(0), tr = new Array(n).fill(0);
  for (let i=1;i<n;i++) {
    const up = c[i].high - c[i-1].high, dn = c[i-1].low - c[i].low;
    pdm[i] = (up>dn && up>0) ? up : 0;
    mdm[i] = (dn>up && dn>0) ? dn : 0;
    tr[i] = Math.max(c[i].high-c[i].low, Math.abs(c[i].high-c[i-1].close), Math.abs(c[i].low-c[i-1].close));
  }
  const atr = emaWild(tr, p);
  const pdi = emaWild(pdm, p).map((v,i)=>atr[i]>0?100*v/atr[i]:0);
  const mdi = emaWild(mdm, p).map((v,i)=>atr[i]>0?100*v/atr[i]:0);
  const dx = pdi.map((v,i)=>{ const s = v+mdi[i]; return s===0?0:100*Math.abs(v-mdi[i])/s; });
  return emaWild(dx, p);
}
function addIndicators(c) {
  if (!c.length) return c;
  const closes = c.map(x=>x.close);
  const e20 = ema(closes,20), e50 = ema(closes,50);
  const r = computeRSI(closes), a = computeATR(c), x = computeADX(c);
  return c.map((row,i)=>({ ...row, ema20:e20[i], ema50:e50[i], rsi:r[i], atr:a[i], adx:x[i] }));
}

/* ---- STRUCTURE ---- */
function findSwings(c, lb) {
  lb = lb || 5;
  const n = c.length, out = [];
  for (let i=lb;i<n-lb;i++) {
    let isH = true, isL = true, hc = 0, lc = 0;
    for (let j=i-lb;j<=i+lb;j++) {
      if (c[j].high > c[i].high) isH = false;
      if (c[j].high === c[i].high) hc++;
      if (c[j].low < c[i].low) isL = false;
      if (c[j].low === c[i].low) lc++;
    }
    if (isH && hc===1) out.push({ idx:i, price:c[i].high, type:"H" });
    if (isL && lc===1) out.push({ idx:i, price:c[i].low, type:"L" });
  }
  return out.sort((a,b)=>a.idx-b.idx);
}
function classifySwings(sw) {
  const out = []; let lastH = null, lastL = null;
  for (const s of sw) {
    let tag = null;
    if (s.type === "H") { if (lastH) tag = s.price > lastH.price ? "HH" : "LH"; lastH = s; }
    else { if (lastL) tag = s.price > lastL.price ? "HL" : "LL"; lastL = s; }
    out.push({ ...s, tag });
  }
  return out;
}
function structureSnapshot(c) {
  const labeled = classifySwings(findSwings(c));
  const tags = labeled.filter(x=>x.tag).map(x=>x.tag).slice(-6);
  const hh = tags.filter(t=>t==="HH").length, hl = tags.filter(t=>t==="HL").length;
  const lh = tags.filter(t=>t==="LH").length, ll = tags.filter(t=>t==="LL").length;
  const bull = hh+hl, bear = lh+ll;
  let bias = "MIXED";
  if (bull > bear+1) bias = "BULLISH";
  else if (bear > bull+1) bias = "BEARISH";
  let lastH = null, lastL = null;
  for (let i=labeled.length-1;i>=0;i--) {
    if (labeled[i].type==="H" && !lastH) lastH = labeled[i];
    if (labeled[i].type==="L" && !lastL) lastL = labeled[i];
    if (lastH && lastL) break;
  }
  return { bias, last_high: lastH?lastH.price:null, last_low: lastL?lastL.price:null };
}
function detectSweep(c) {
  if (c.length < 13) return { side: null, level: null };
  const sw = findSwings(c);
  let lastH = null, lastL = null;
  for (let i=sw.length-1;i>=0;i--) {
    if (sw[i].type==="H" && !lastH) lastH = sw[i];
    if (sw[i].type==="L" && !lastL) lastL = sw[i];
    if (lastH && lastL) break;
  }
  for (const row of c.slice(-3)) {
    const o = row.open, cl = row.close, h = row.high, l = row.low;
    const body = Math.max(Math.abs(cl-o), PIP);
    const lw = Math.min(o,cl)-l, uw = h-Math.max(o,cl);
    if (lastL && l < lastL.price && cl > lastL.price && lw >= 0.5*body) return { side: "BUY", level: lastL.price };
    if (lastH && h > lastH.price && cl < lastH.price && uw >= 0.5*body) return { side: "SELL", level: lastH.price };
  }
  return { side: null, level: null };
}

/* ---- REGIME ---- */
function regime(c) {
  if (c.length < 30) return "TRANSITION";
  const last = c[c.length-1];
  const s = structureSnapshot(c);
  if (last.adx >= 25) {
    if (last.close > last.ema20 && last.ema20 > last.ema50 && s.bias === "BULLISH") return "TREND_UP";
    if (last.close < last.ema20 && last.ema20 < last.ema50 && s.bias === "BEARISH") return "TREND_DOWN";
  }
  if (last.adx <= 20 && s.bias === "MIXED") return "RANGE";
  return "TRANSITION";
}

/* ---- S/R ---- */
function collectLevels() {
  const levels = [];
  for (const tf of ["D1","H4","H1"]) {
    const c = marketData[tf];
    if (!c || !c.length) continue;
    for (const s of findSwings(c)) levels.push({ price: s.price, source: tf });
  }
  return levels;
}
function clusterLevels(levels) {
  if (!levels.length) return [];
  const tol = 15 * PIP;
  const sorted = [...levels].sort((a,b)=>a.price-b.price);
  const clusters = []; let cur = [sorted[0]];
  for (let i=1;i<sorted.length;i++) {
    if (Math.abs(sorted[i].price - cur[cur.length-1].price) <= tol) cur.push(sorted[i]);
    else { clusters.push(cur); cur = [sorted[i]]; }
  }
  clusters.push(cur);
  return clusters.map(cl => {
    const price = cl.reduce((s,x)=>s+x.price,0)/cl.length;
    const srcs = [...new Set(cl.map(x=>x.source))];
    let w = cl.length + 2*(srcs.length-1);
    let strength = w >= 8 ? "STRONG" : w >= 4 ? "MEDIUM" : "WEAK";
    return { price, sources: srcs, strength, touches: cl.length };
  });
}
function getSR(price) {
  const clusters = clusterLevels(collectLevels());
  const R = clusters.filter(c=>c.price > price).sort((a,b)=>a.price-b.price).slice(0,3);
  const S = clusters.filter(c=>c.price < price).sort((a,b)=>b.price-a.price).slice(0,3);
  R.forEach((r,i) => r.label = "R"+(i+1));
  S.forEach((s,i) => s.label = "S"+(i+1));
  return { resistance: R, support: S };
}

/* ---- ENGINES ---- */
function scorePullback(h4, h1, sr, dir) {
  let s = 0; const confs = [];
  const sh4 = structureSnapshot(h4), sh1 = structureSnapshot(h1);
  const last = h1[h1.length-1], price = last.close;
  const needBias = dir === "BUY" ? "BULLISH" : "BEARISH";
  if (sh4.bias === needBias) { s += 30; confs.push("H4 aligned"); }
  else if (sh4.bias === "MIXED") s += 10; else return 0;
  if (sh1.bias === needBias) { s += 20; confs.push("H1 aligned"); }
  else if (sh1.bias === "MIXED") s += 8;
  const near = (dir === "BUY" ? sr.support : sr.resistance).find(lv => Math.abs(lv.price - price) < 20*PIP);
  if (near) { s += 15; confs.push("near " + near.label); }
  if (last.adx >= 25) { s += 15; confs.push("ADX " + last.adx.toFixed(0)); }
  const r = last.rsi;
  if (dir === "BUY" && r >= 40 && r <= 65) { s += 10; confs.push("RSI " + r.toFixed(0)); }
  if (dir === "SELL" && r >= 35 && r <= 60) { s += 10; confs.push("RSI " + r.toFixed(0)); }
  return Math.min(s, 100);
}
function scoreBreakout(h4, h1, sr, dir) {
  let s = 0; const confs = [];
  const sh4 = structureSnapshot(h4);
  const last = h1[h1.length-1], price = last.close;
  const needBias = dir === "BUY" ? "BULLISH" : "BEARISH";
  if (sh4.bias === needBias) s += 20;
  const broken = (dir === "BUY" ? sr.resistance : sr.support).find(lv => {
    return dir === "BUY" ? lv.price < price - 5*PIP : lv.price > price + 5*PIP;
  });
  if (!broken) return 0;
  s += 25; confs.push("broken " + broken.label);
  const last3 = h1.slice(-3);
  const dirCount = last3.filter(r => dir === "BUY" ? r.close > r.open : r.close < r.open).length;
  if (dirCount >= 2) s += 20;
  if (last.adx >= 25) s += 15;
  if (last.rsi >= 40 && last.rsi <= 70) s += 10;
  return Math.min(s, 100);
}
function scoreLiquidity(h1, sr, dir) {
  let s = 0; const confs = [];
  const sw = detectSweep(h1);
  if (sw.side !== dir) return 0;
  s += 30; confs.push("sweep");
  const sh1 = structureSnapshot(h1);
  if (sh1.bias === (dir === "BUY" ? "BULLISH" : "BEARISH")) s += 15;
  else if (sh1.bias === "MIXED") s += 8;
  const last = h1[h1.length-1], price = last.close;
  const near = (dir === "BUY" ? sr.support : sr.resistance).find(lv => Math.abs(lv.price - price) < 15*PIP);
  if (near) s += 15;
  if (last.adx >= 20) s += 10;
  return Math.min(s, 100);
}
function scoreRange(h4, h1, dir) {
  const last = h1[h1.length-1], price = last.close;
  if (last.adx > 25) return 0;
  if (h4.length < 30) return 0;
  const w = h4.slice(-30);
  const hi = Math.max(...w.map(c=>c.high)), lo = Math.min(...w.map(c=>c.low));
  const width = hi - lo; if (width <= 0) return 0;
  const pos = (price - lo) / width;
  let s = 0;
  if (dir === "BUY") { if (pos > 0.35) return 0; s += 30; }
  else { if (pos < 0.65) return 0; s += 30; }
  if (last.adx < 20) s += 20;
  if (dir === "BUY" && last.rsi < 40) s += 15;
  if (dir === "SELL" && last.rsi > 60) s += 15;
  return Math.min(s, 100);
}
function scoreMomentum(h4, h1, sr, dir) {
  const sh4 = structureSnapshot(h4);
  const last = h1[h1.length-1], price = last.close;
  const needBias = dir === "BUY" ? "BULLISH" : "BEARISH";
  if (sh4.bias !== needBias) return 0;
  if (last.adx < 25) return 0;
  let s = 30;
  if (dir === "BUY" && last.rsi >= 45 && last.rsi <= 70) s += 20;
  if (dir === "SELL" && last.rsi >= 30 && last.rsi <= 55) s += 20;
  const near = (dir === "BUY" ? sr.resistance : sr.support)[0];
  if (near) {
    const dist = dir === "BUY" ? (near.price - price)/PIP : (price - near.price)/PIP;
    if (dist >= 40) s += 20;
  }
  return Math.min(s, 100);
}

function runEngines() {
  const { D1, H4, H1 } = marketData;
  if (!H1.length || H1.length < 60) return null;
  const price = H1[H1.length-1].close;
  const sr = getSR(price);
  const reg = regime(H1);
  const signals = {
    PULLBACK: { buy: scorePullback(H4, H1, sr, "BUY"), sell: scorePullback(H4, H1, sr, "SELL") },
    BREAKOUT: { buy: scoreBreakout(H4, H1, sr, "BUY"), sell: scoreBreakout(H4, H1, sr, "SELL") },
    LIQUIDITY: { buy: scoreLiquidity(H1, sr, "BUY"), sell: scoreLiquidity(H1, sr, "SELL") },
    RANGE: { buy: scoreRange(H4, H1, "BUY"), sell: scoreRange(H4, H1, "SELL") },
    MOMENTUM: { buy: scoreMomentum(H4, H1, sr, "BUY"), sell: scoreMomentum(H4, H1, sr, "SELL") }
  };
  const out = {};
  for (const [name, sc] of Object.entries(signals)) {
    const best = sc.buy >= sc.sell ? "BUY" : "SELL";
    const score = Math.max(sc.buy, sc.sell);
    out[name] = { side: score >= 65 ? best : "WAIT", score };
  }
  const buyVotes = Object.values(out).filter(s=>s.side==="BUY").length;
  const sellVotes = Object.values(out).filter(s=>s.side==="SELL").length;
  let bias = "WAIT";
  if (buyVotes > sellVotes) bias = "BUY";
  else if (sellVotes > buyVotes) bias = "SELL";
  let biasScore = 0;
  if (bias !== "WAIT") {
    let wsum = 0, ssum = 0;
    for (const [name, sig] of Object.entries(out)) {
      if (sig.side === bias) { wsum += WEIGHTS[name]; ssum += sig.score * WEIGHTS[name]; }
    }
    biasScore = wsum > 0 ? ssum / wsum : 0;
    const n = bias === "BUY" ? buyVotes : sellVotes;
    if (n >= 3) biasScore = Math.min(biasScore+8, 100);
    else if (n === 2) biasScore = Math.min(biasScore+3, 100);
  }
  const conflict = buyVotes > 0 && sellVotes > 0 ? (Math.min(buyVotes, sellVotes) >= 2 ? "MODERATE" : "LOW") : "NONE";
  return { price, regime: reg, sr, signals: out, bias, biasScore, conflict, buyVotes, sellVotes };
}

/* ---- MODES ---- */
function processModes() {
  const r = runEngines();
  if (!r) return null;
  const result = { modes: {} };
  for (const mode of ["HIGH_OPPORTUNITY","BALANCED","SNIPER"]) {
    const cfg = Modes[mode];
    let final = "WAIT", reason = "";
    if (r.bias === "WAIT") reason = "bias not aligned";
    else if (r.biasScore < cfg.min_score) reason = "score " + r.biasScore.toFixed(0) + " < " + cfg.min_score;
    else {
      const n = r.bias === "BUY" ? r.buyVotes : r.sellVotes;
      if (n < cfg.min_confirms) reason = "confirmations " + n + " < " + cfg.min_confirms;
      else final = r.bias;
    }
    result.modes[mode] = {
      final, reason,
      bias_score: r.biasScore,
      wins: state[mode].today.wins,
      losses: state[mode].today.losses,
      open_trade: state[mode].open_trade,
      in_cooldown: state[mode].cooldown_until && new Date() < new Date(state[mode].cooldown_until)
    };
  }
  result.market = { price: r.price, regime: r.regime, bias: r.bias, conflict: r.conflict, sr: r.sr, signals: r.signals };
  return result;
}

/* ---- FETCH ---- */
async function fetchCandles(interval, size) {
  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", SYMBOL);
  url.searchParams.set("interval", interval);
  url.searchParams.set("outputsize", size);
  url.searchParams.set("apikey", API_KEY);
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("order", "ASC");
  const res = await fetch(url.toString(), { cache: "no-store" });
  const data = await res.json();
  if (data.status === "error") throw new Error(data.message);
  if (!data.values) throw new Error("no values");
  const out = data.values.map(v => ({
    time: new Date(v.datetime).getTime(),
    open: +v.open, high: +v.high, low: +v.low, close: +v.close
  })).filter(c => isFinite(c.open) && isFinite(c.close));
  return addIndicators(out);
}

async function loadAll() {
  marketData.D1 = await fetchCandles("1day", 300);
  marketData.H4 = await fetchCandles("4h", 300);
  marketData.H1 = await fetchCandles("1h", 500);
}

/* ---- RENDER ---- */
function render(r) {
  const root = document.getElementById("root");
  if (!root) return;
  if (!r) { root.innerHTML = '<div class="card">loading candles...</div>'; return; }
  const m = r.market;
  const timeEl = document.getElementById("time");
  if (timeEl) timeEl.textContent = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });

  let html = '<div class="row"><div class="card" style="flex:1;">'
    + '<div class="price-box">'
    + '<div class="price">' + (m.price ? m.price.toFixed(5) : "—") + '</div>'
    + '<div class="regime ' + m.regime + '">' + m.regime + '</div>'
    + '<div class="bias ' + m.bias + '">BIAS ' + m.bias + '</div>'
    + '</div>'
    + '<div style="font-size:11px;color:#666;margin-top:4px;">conflict: ' + m.conflict + '</div>'
    + '</div></div>';

  html += '<div class="section-title">engines</div><div class="engines">';
  const order = ["MOMENTUM","PULLBACK","BREAKOUT","LIQUIDITY","RANGE"];
  for (const name of order) {
    const s = m.signals[name] || { side: "WAIT", score: 0 };
    const cls = s.side.toLowerCase();
    html += '<div class="eng ' + cls + '"><div class="name">' + name.slice(0,4) + '</div><div class="score">' + Math.round(s.score) + '</div><div class="side">' + s.side + '</div></div>';
  }
  html += '</div>';

  html += '<div class="section-title">modes</div><div class="mode-grid">';
  for (const mode of ["HIGH_OPPORTUNITY","BALANCED","SNIPER"]) {
    const md = r.modes[mode];
    const t = md.open_trade;
    let statusCls = "status-wait", statusTxt = "WAITING";
    if (t) { statusCls = "status-open"; statusTxt = t.side + " OPEN"; }
    else if (md.in_cooldown) { statusCls = "status-cooldown"; statusTxt = "COOLDOWN"; }
    const cardCls = t ? ("open" + (t.side === "SELL" ? " sell" : "")) : "";
    html += '<div class="mode-card ' + cardCls + '">'
      + '<div class="mode-name">' + mode + '</div>'
      + '<div class="mode-status ' + statusCls + '">' + statusTxt + '</div>';
    if (t) {
      html += '<div class="trade-line"><span class="k">entry</span><span class="v">' + t.entry.toFixed(5) + '</span></div>';
      html += '<div class="trade-line"><span class="k">SL</span><span class="v">' + t.sl.toFixed(5) + '</span></div>';
      html += '<div class="trade-line"><span class="k">TP1</span><span class="v">' + t.tp1.toFixed(5) + '</span></div>';
      html += '<div class="trade-line"><span class="k">TP2</span><span class="v">' + t.tp2.toFixed(5) + '</span></div>';
    } else {
      html += '<div class="trade-line"><span class="k">score</span><span class="v">' + md.bias_score.toFixed(1) + '</span></div>';
      html += '<div class="trade-line"><span class="k">final</span><span class="v">' + md.final + '</span></div>';
      if (md.reason) html += '<div style="font-size:11px;color:#666;margin-top:6px;">' + md.reason + '</div>';
    }
    html += '<div class="wl">today: <span class="w">' + md.wins + 'W</span> / <span class="l">' + md.losses + 'L</span></div>';
    html += '</div>';
  }
  html += '</div>';

  const srItems = [];
  for (const r2 of m.sr.resistance) srItems.push('<div class="sr-item res"><span class="lbl">' + r2.label + '</span><span class="val">' + r2.price.toFixed(5) + '</span><span class="lbl">' + r2.strength + '</span><span class="src">' + r2.sources.join(",") + '</span></div>');
  srItems.push('<div class="sr-item" style="background:#0a2a2a;"><span class="lbl">price</span><span class="val">' + m.price.toFixed(5) + '</span></div>');
  for (const s2 of m.sr.support) srItems.push('<div class="sr-item sup"><span class="lbl">' + s2.label + '</span><span class="val">' + s2.price.toFixed(5) + '</span><span class="lbl">' + s2.strength + '</span><span class="src">' + s2.sources.join(",") + '</span></div>');
  html += '<div class="section-title">s/r levels</div><div class="sr-list">' + srItems.join("") + '</div>';

  root.innerHTML = html;
}

/* ---- MAIN LOOP ---- */
async function tick() {
  if (loading) return;
  loading = true;
  try {
    await loadAll();
    const r = processModes();
    render(r);
  } catch(e) {
    console.error(e);
    const root = document.getElementById("root");
    if (root) root.innerHTML = '<div class="err">Error: ' + e.message + '</div>';
  } finally {
    loading = false;
  }
}

async function start() {
  render(null);
  await tick();
  setInterval(tick, REFRESH);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
