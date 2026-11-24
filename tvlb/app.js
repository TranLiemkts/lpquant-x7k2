/* TVLB (từ Bildol Gold Terminal của anh Thắng; sửa 1 dòng: ẩn vạch strike phụ theo menu TVLB+) — giao diện kiểu RyanFX.
   Giá realtime: Binance XAUUSDT perp (dự phòng PAXG/USDT; kline có taker-buy volume => CVD theo phe chủ động).
   Mốc Options / vĩ mô: backend /api/state, làm mới mỗi 20 giây.
   Lớp phủ (canvas) vẽ mốc GC bên trái, GLD bên phải, đường cong Net GEX ngay trên chart.
   SMC (smc.js): cấu trúc H4 + khung chart, OTE/Extreme, thanh khoản, nến quét, CL1 Buy/Sell hồi & CL2 thuận (KB1/KB2/KB3). */
"use strict";
// 7n số 135: chế độ gọn (window.TVLB_COMPACT do tvlb_plus.js đặt)

const $ = (s) => document.querySelector(s);
const LC = window.LightweightCharts;
const TZ = 7 * 3600; // trục thời gian theo giờ Việt Nam
const TF_SEC = { "1m": 60, "3m": 180, "5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "4h": 14400, "1d": 86400 };
const C = { gc: "#e0a83a", gld: "#a78bfa", up: "#26b384", down: "#e5534b", vp: "#6b8aa8", muted: "#85909c", fg: "#e4e1d9", flip: "#c4b5fd", mag: "#f2b84b", bg: "#0b0e12" };
const PAPER_KEY = "bildol.paper.v1";
// Bản web tĩnh (GitHub Pages / điện thoại): đọc file JSON do máy đẩy lên thay cho API của engine; không gửi gì về máy.
const STATIC = !!window.BILDOL_STATIC;
const API = (p) => {
  if (!STATIC) return p;
  const [path, q] = p.split("?");
  if (path === "/api/klines") return `klines_${new URLSearchParams(q).get("tf")}.json`;
  return ({ "/api/state": "state.json", "/api/tv": "tv.json", "/api/journal": "journal.json" })[path] || p;
};

const S = {
  state: null, cfg: null, tf: "5m", candles: [], ws: null, demoTimer: null,
  signals: [], lastSigIdx: -1e9, primary: "GC", profSrc: "GC", profScrolled: false, tenor: "all",
  paper: null, planLines: [],
  h4: [], smc: null, h4Ts: 0,
};

// ─────────────────────────── tiện ích ───────────────────────────
const fmt = (x, d = 2) => (x == null || !isFinite(x) ? "—" : Number(x).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
const fmtK = (v) => {
  if (v == null || !isFinite(v)) return "—";
  const a = Math.abs(v);
  return a >= 1e9 ? (v / 1e9).toFixed(2) + "B" : a >= 1e6 ? (v / 1e6).toFixed(1) + "M" : a >= 1e3 ? (v / 1e3).toFixed(1) + "K" : String(Math.round(v));
};
const sgn = (x, d = 1) => (x == null || !isFinite(x) ? "—" : (x >= 0 ? "+" : "") + x.toFixed(d));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const vnClock = (t) => new Date((t + TZ) * 1000).toISOString().slice(11, 16);
const vnDate = (t) => new Date((t + TZ) * 1000).toISOString().slice(0, 10);
const nowSec = () => Math.floor(Date.now() / 1000);
function chip(sel, cls, text) { const el = $(sel); el.className = "chip " + cls; el.lastChild.textContent = text; }
const opt = (src) => S.state?.options?.[src] || null;
const prim = () => opt(S.primary) || opt(S.primary === "GC" ? "GLD" : "GC");
// Bước 3: ô chọn kỳ hạn chỉ đổi phần XEM (Strike Profile + mốc vẽ trên chart); tín hiệu & Agent luôn dùng "Mọi kỳ hạn"
const optV = (src) => { const o = opt(src); return !o || S.tenor === "all" ? o : (o.by_tenor?.[S.tenor] || o); };
const primV = () => optV(S.primary) || optV(S.primary === "GC" ? "GLD" : "GC");
const TENOR_TXT = { all: "Mọi kỳ hạn", short: "0DTE + Tuần (≤ 7 ngày)", month: "> 7 ngày (Tháng)" };
function lastPrice() { const c = S.candles; return c.length ? c[c.length - 1].close : null; }

// ─────────────────────────── chart ───────────────────────────
function baseOpts() {
  return {
    autoSize: true,
    layout: { background: { type: "solid", color: C.bg }, textColor: C.muted, fontFamily: "IBM Plex Mono, monospace", fontSize: 11 },
    grid: { vertLines: { color: "#141a20" }, horzLines: { color: "#141a20" } },
    rightPriceScale: { borderColor: "#232b35", scaleMargins: { top: 0.08, bottom: 0.08 } },
    timeScale: { borderColor: "#232b35", timeVisible: true, secondsVisible: false, rightOffset: 30 },
    crosshair: { mode: 0 },
  };
}
let chart, candleS, cvdChart, cvdLine, deltaHist, bigLine, bigBuyLine, bigSellLine;
function initCharts() {
  chart = LC.createChart($("#chart"), baseOpts());
  candleS = chart.addCandlestickSeries({ upColor: C.up, downColor: C.down, borderVisible: false, wickUpColor: C.up, wickDownColor: C.down, priceFormat: { type: "price", precision: 2, minMove: 0.01 } });
  cvdChart = LC.createChart($("#cvd"), baseOpts());
  deltaHist = cvdChart.addHistogramSeries({ priceScaleId: "delta", priceFormat: { type: "volume" } });
  cvdChart.priceScale("delta").applyOptions({ scaleMargins: { top: 0.55, bottom: 0 } });
  cvdLine = cvdChart.addLineSeries({ color: C.gc, lineWidth: 2, priceFormat: { type: "volume" } });
  // CVD lệnh lớn (oz) – thang riêng bên trái
  bigLine = cvdChart.addLineSeries({ color: C.gld, lineWidth: 2, priceScaleId: "big", priceFormat: { type: "volume" }, title: "Ròng lớn" });
  bigBuyLine = cvdChart.addLineSeries({ color: C.up, lineWidth: 1, lineStyle: 2, priceScaleId: "big", priceFormat: { type: "volume" }, title: "Mua lớn" });
  bigSellLine = cvdChart.addLineSeries({ color: C.down, lineWidth: 1, lineStyle: 2, priceScaleId: "big", priceFormat: { type: "volume" }, title: "Bán lớn" });
  cvdChart.priceScale("big").applyOptions({ visible: true, scaleMargins: { top: 0.08, bottom: 0.5 } });
  cvdChart.applyOptions({ leftPriceScale: { visible: false } });
  let syncing = false;
  const link = (a, b) => a.timeScale().subscribeVisibleLogicalRangeChange((r) => {
    if (syncing || !r) return; syncing = true; b.timeScale().setVisibleLogicalRange(r); syncing = false;
  });
  link(chart, cvdChart); link(cvdChart, chart);
}

// ─────────────────────────── dữ liệu giá ───────────────────────────
// Nến lấy từ Binance (XAUUSDT) rồi cộng chênh lệch về XAUUSD giao ngay (S.basis) để khớp giá TradingView/broker
const mk = (openMs, o, h, l, c, v, takerBuy) => { const b = S.basis || 0; return { time: Math.floor(openMs / 1000), open: o + b, high: h + b, low: l + b, close: c + b, vol: v, delta: 2 * takerBuy - v }; };
function basisNow(sym) {
  // chênh lệch XAUUSD giao ngay − giá nguồn nến, đo riêng cho TỪNG nguồn (XAUUSDT, PAXGUSDT) → nguồn dự phòng cũng khớp TradingView
  const by = S.state?.basis_by, b = S.state?.basis;
  if (sym && by && isFinite(by[sym])) return by[sym];
  if (!sym || sym === feeds()[0].symbol) return b && isFinite(b.value) ? b.value : 0;
  return 0;
}
const sessKey = (t) => Math.floor((t + 2 * 3600) / 86400); // phiên vàng mở 05:00 giờ VN
const shift = (c) => ({ time: c.time + TZ, open: c.open, high: c.high, low: c.low, close: c.close });
const dcol = (d) => (d >= 0 ? "rgba(38,179,132,.55)" : "rgba(229,83,75,.55)");

function recomputeCvd(from = 0) {
  const c = S.candles;
  for (let i = Math.max(0, from); i < c.length; i++) {
    const p = c[i - 1];
    c[i].cvd = (p && sessKey(p.time) === sessKey(c[i].time) ? p.cvd : 0) + c[i].delta;
  }
}

function feeds() {
  const f = S.cfg.price_feeds;
  if (f && f.length) return f;
  return S.cfg.binance_rest.map((h, i) => ({ symbol: S.cfg.price_symbol, name: S.cfg.price_symbol, rest: h, kpath: "/api/v3/klines", ws: S.cfg.binance_ws[i % S.cfg.binance_ws.length] }));
}
// ── Khớp nến với TradingView (FXCM:XAUUSD) ──
// Binance chạy 24/7 còn FXCM nghỉ cuối tuần + 17:00–18:00 New York mỗi ngày -> bỏ các nến ngoài giờ đó.
// Nến H4/D1 của TradingView neo 18:00 New York (không phải 00:00 UTC như Binance) -> gộp lại từ nến 1h.
const AGG = { "4h": 14400, "1d": 86400 };
const h4From = () => Math.floor(Date.parse(S.cfg?.smc?.h4_from || "2026-06-01T00:00:00+07:00") / 1000);
async function fetchRange(f, interval, fromSec) {
  const out = [], lim = /fapi/.test(f.kpath) ? 1500 : 1000;
  let from = fromSec * 1000;
  for (let page = 0; page < 14; page++) {
    const r = await fetch(`${f.rest}${f.kpath}?symbol=${f.symbol}&interval=${interval}&limit=${lim}&startTime=${from}`);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const a = await r.json();
    out.push(...a);
    if (a.length < lim) break;
    from = a[a.length - 1][0] + 1;
  }
  return out.map((k) => mk(k[0], +k[1], +k[2], +k[3], +k[4], +k[5], +k[9])).filter((k) => SMC.fxOpen(k.time));
}
async function loadTF(f, tf, fromSec) {
  if (AGG[tf]) { const h1 = await fetchRange(f, "1h", fromSec); return { rows: SMC.aggregate(h1, AGG[tf]), h1 }; }
  return { rows: await fetchRange(f, tf, fromSec), h1: null };
}
// giữ từ nến ngay TRƯỚC mốc t0 (nến mồi, giống Pine: trạng thái khởi tạo bằng nến này, xử lý từ nến kế tiếp)
const fromSeed = (a, t0) => { const k = a.findIndex((x) => x.time >= t0); return k < 0 ? a : a.slice(Math.max(0, k - 1)); };
async function loadHistory() {
  // mốc bắt đầu cấu trúc khung chart: CÙNG công thức với Pine (00:00 giờ VN, theo ltf_bars), không sớm hơn mốc H4
  const t0 = SMC.ltfStart(nowSec(), TF_SEC[S.tf], S.cfg?.smc?.ltf_bars ?? 1000, h4From());
  for (const f of feeds()) {
    try {
      S.basis = basisNow(f.symbol);
      const { rows, h1 } = await loadTF(f, S.tf, t0 - 3 * 86400); // lùi 3 ngày để có nến mồi kể cả qua cuối tuần
      if (rows.length < (AGG[S.tf] && TF_SEC[S.tf] > 86400 ? 3 : 30)) continue; /* va_142b: tuan/thang it nen */
      S.candles = fromSeed(rows, t0); S.h1 = h1; S.ltfT0 = t0;
      S.feed = f;
      $("#sym").textContent = S.basis ? `XAUUSD (${f.symbol} ${S.basis >= 0 ? "+" : ""}${S.basis.toFixed(2)})` : f.symbol;
      return true;
    } catch (e) { /* thử nguồn khác */ }
  }
  return false;
}

// ─────────────────────────── SMC: nến H4 + phân tích ───────────────────────────
const H4_SEC = 14400;
function smcCfg() {
  const m = S.cfg?.smc || {}, sc = S.cfg?.signals || {};
  return {
    oteLo: m.ote_lo ?? 0.705, oteHi: m.ote_hi ?? 0.79, eqTol: m.eq_tol ?? 1.5, trendline: m.trendline ?? true,
    sweepWin: m.sweep_window ?? 6, slBuf: Math.min(5, m.sl_buffer ?? 3), tol: m.touch_tol ?? sc.touch_tol ?? 2, expiryH4: m.expiry_h4 ?? 6, kb3Atr: m.kb3_atr ?? 2, kb2Once: m.kb2_once ?? true,
    kb2: [300, 900].includes(TF_SEC[S.tf]),   // KB2 (confirm) chỉ theo cấu trúc M5 / M15
    sessionOk: m.session_only ? inUsSession : null, tfSec: TF_SEC[S.tf], tfName: S.tf.toUpperCase().replace(/^(\d+)M$/, "M$1").replace(/^(\d+)H$/, "H$1"),
    nextStrike: (p, above) => nextStrike(p, above),
    levels: (() => { const L = primaryLevels(); return L ? { cw: L.call_wall, pw: L.put_wall, flip: L.gamma_flip } : {}; })(),
  };
}
async function loadHTF() {
  const f = S.feed; if (!f) return false;
  try {
    // dựng H4 từ mốc cố định (config smc.h4_from) để khớp TradingView và không trôi theo thời gian
    // nến H4 theo giờ FXCM, gộp từ 1h; khung chart đang là H4 thì dùng luôn dữ liệu chart (cùng mốc bắt đầu)
    if (S.tf === "4h" && S.candles.length) S.h4 = S.candles;
    else S.h4 = fromSeed((await loadTF(f, "4h", h4From() - 3 * 86400)).rows, h4From());
    S.h4Ts = Date.now();
    return true;
  } catch { return false; }
}
// lệnh SMC hợp lệ (bỏ lệnh bị loại vì RR < 1) và lệnh đã khớp dưới dạng "tín hiệu" cho Agent
const smcOrders = () => (S.smc?.orders || []).filter((o) => o.status !== "skip");
const oid = (o) => `${o.name}${o.side}${o.src}`;
function smcFilled() {
  const c = S.candles;
  return smcOrders().filter((o) => o.fillI != null && c[o.fillI]).map((o) => ({ ...o, i: o.fillI, time: c[o.fillI].time, type: o.txt, smc: true }));
}
function runSMC(lastClosed = false) {
  const c = S.candles;
  if (typeof SMC === "undefined" || c.length < 30 || S.h4.length < 10) { S.smc = null; return; }
  // chỉ dùng nến ĐÃ ĐÓNG (bỏ nến đang chạy) để không vẽ lại
  S.smc = SMC.analyze(lastClosed ? c : c.slice(0, -1), S.h4, H4_SEC, smcCfg());
}
function demoHistory() {
  const step = TF_SEC[S.tf], now = Math.floor(nowSec() / step) * step;
  let p = S.state?.refs?.chart || 4000, seed = 42;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  S.candles = [];
  for (let i = 600; i >= 0; i--) {
    const o = p; p += (rnd() - 0.5) * 2.4 * Math.sqrt(step / 60);
    const v = 20 + rnd() * 120;
    S.candles.push({ time: now - i * step, open: o, high: Math.max(o, p) + rnd(), low: Math.min(o, p) - rnd(), close: p, vol: v, delta: (p > o ? 1 : -1) * v * rnd() * 0.8 });
  }
}

function stopFeeds() {
  if (S.ws) { const w = S.ws; S.ws = null; w.close(); }
  if (S.demoTimer) { clearInterval(S.demoTimer); S.demoTimer = null; }
}

function startDemoFeed() {
  stopFeeds();
  chip("#chipWs", "mid", "Feed DEMO");
  S.demoTimer = setInterval(() => {
    const step = TF_SEC[S.tf], t = Math.floor(nowSec() / step) * step, last = S.candles[S.candles.length - 1];
    if (last.time !== t) { onCandle(last, true); onCandle({ time: t, open: last.close, high: last.close, low: last.close, close: last.close, vol: 0, delta: 0 }, false); return; }
    const p = last.close + (Math.random() - 0.5) * 0.8, v = Math.random() * 6;
    onCandle({ ...last, close: p, high: Math.max(last.high, p), low: Math.min(last.low, p), vol: last.vol + v, delta: last.delta + (p >= last.close ? v : -v) }, false);
  }, 1000);
}

function connectWs(i = 0) {
  // luồng nến realtime; Binance Futures đã chuyển sang /market/ws -> thử lần lượt các URL, có watchdog chống "LIVE mà đứng giá"
  const f = S.feed || feeds()[0];
  let urls = [f.ws, ...(f.ws_alt || [])];
  if (/fstream\.binance\.com\/ws$/.test(f.ws)) urls = ["wss://fstream.binance.com/market/ws", f.ws]; // URL cũ đã bị Binance ngừng 23/04/2026
  const ws = new WebSocket(`${urls[i % urls.length]}/${f.symbol.toLowerCase()}@kline_${AGG[S.tf] ? "1h" : S.tf}`);
  S.ws = ws; S.wsMsg = Date.now(); S.wsIdx = i;
  ws.onopen = () => { chip("#chipWs", "ok", "Feed giá"); $("#livePill").className = "live"; $("#livePill").textContent = "LIVE"; if (i > 0) resync(); };
  ws.onmessage = (ev) => {
    S.wsMsg = Date.now(); const k = JSON.parse(ev.data).k; if (!k) return;
    const c = mk(k.t, +k.o, +k.h, +k.l, +k.c, +k.v, +k.V);
    if (!SMC.fxOpen(c.time)) return; // ngoài giờ FXCM: bỏ (khớp TradingView)
    if (AGG[S.tf]) onAggHour(c, k.x); else onCandle(c, k.x);
  };
  ws.onclose = () => {
    if (S.ws !== ws) return;
    chip("#chipWs", "bad", "Mất feed – đang nối lại"); $("#livePill").className = "live off"; $("#livePill").textContent = "OFF";
    setTimeout(() => { if (S.ws === ws) connectWs(i + 1); }, 3000);
  };
  ws.onerror = () => ws.close();
}
// tải lại nến bị lỡ khi mất kết nối / tab ngủ, rồi vẽ lại
async function resync() {
  if (S.resyncing || !S.feed) return;
  S.resyncing = true;
  try {
    if (await loadHistory()) { await loadHTF(); drawAll(); runSMC(); setMarkers(); renderAll(); }
  } finally { S.resyncing = false; }
}
setInterval(() => {
  if (!S.ws || S.ws.readyState !== 1) return;
  if (Date.now() - S.wsMsg > 20000) { S.ws.close(); } // 20 giây không có dữ liệu -> nối lại (thử URL kế tiếp)
}, 5000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && S.ws && Date.now() - (S.wsMsg || 0) > 15000) resync();
});

// khung 4h/1d: nhận nến 1h, gộp lại nến lớn đang chạy theo giờ FXCM
function onAggHour(c1, closed1) {
  const sec = AGG[S.tf], h = S.h1 || (S.h1 = []), last = h[h.length - 1];
  if (last && last.time === c1.time) h[h.length - 1] = c1; else if (!last || c1.time > last.time) h.push(c1); else return;
  const b = SMC.bucketOf(c1.time, sec);
  let i = h.length; while (i > 0 && SMC.bucketOf(h[i - 1].time, sec) === b) i--;
  if (h.length > 2000) h.splice(0, h.length - 2000);
  const agg = SMC.aggregate(h.slice(i), sec)[0];
  let nx = c1.time + 3600; for (let g = 0; g < 80 && !SMC.fxOpen(nx); g++) nx += 3600; // giờ mở cửa kế tiếp
  onCandle(agg, closed1 && SMC.bucketOf(nx, sec) !== b);
}
function onCandle(c, closed) {
  const a = S.candles, last = a[a.length - 1];
  if (last && last.time === c.time) a[a.length - 1] = c; else if (!last || c.time > last.time) a.push(c); else return;
  recomputeCvd(a.length - 1);
  const x = a[a.length - 1];
  candleS.update(shift(x));
  cvdLine.update({ time: x.time + TZ, value: x.cvd });
  deltaHist.update({ time: x.time + TZ, value: x.delta, color: dcol(x.delta) });
  paperTick(x.close);
  renderQuote();
  if (closed) {
    renderBig();
    if (STATIC) staticRecompute();
    const s = evaluate(a.length - 1, true);
    if (s) addSignal(s, true);
    smcOnClose(a.length - 1);
    renderAgent();
  }
}

async function smcOnClose(idx) {
  // nến H4 vừa đóng (hoặc dữ liệu H4 cũ hơn 10 phút) -> tải lại H4
  // nến H4 (giờ FXCM) vừa đóng: nến mở cửa kế tiếp thuộc nến H4 khác
  const k = S.candles[idx], st = Math.min(TF_SEC[S.tf], 3600);
  let nx = k.time + TF_SEC[S.tf]; for (let g = 0; g < 400 && !SMC.fxOpen(nx); g++) nx += st;
  if (S.tf === "4h" || SMC.bucketOf(k.time, H4_SEC) !== SMC.bucketOf(nx, H4_SEC) || Date.now() - S.h4Ts > 600000) await loadHTF();
  const known = new Set(smcOrders().map(oid));
  runSMC(true); // nến idx vừa đóng và đang là nến cuối của S.candles
  for (const o of smcOrders()) {
    if (o.fillI === idx) addSmcSignal({ ...o, type: o.txt });           // lệnh vừa khớp (KB2 vào ngay, KB1/KB3 chạm giá Limit)
    else if (o.status === "pending" && !known.has(oid(o))) notifyPending(o); // lệnh chờ mới
  }
  setMarkers();
  journalSyncSMC(); journalTrack(); renderJournal();
}
function notifyPending(o) {
  if ("Notification" in window && Notification.permission === "granted")
    new Notification(`${o.name} ${o.side} LIMIT ${fmt(o.entry)}`, { body: `${o.txt}\nSL ${fmt(o.sl)} · TP1 ${fmt(o.tp1)} · TP2 ${fmt(o.tp2)}` });
}
function addSmcSignal(s) {
  if ($("#autoTrade").checked && !S.paper.pos) {
    const plan = planFor(s);
    paperOpen(s.side, plan.lots, s.sl, s.tp1, `Tự động: ${s.type}`);
  }
  if ("Notification" in window && Notification.permission === "granted")
    new Notification(`${s.side} – ${s.type}`, { body: `Entry ${fmt(s.entry)} · SL ${fmt(s.sl)} · TP1 ${fmt(s.tp1)} · TP2 ${fmt(s.tp2)}` });
}
function drawAll() {
  recomputeCvd();
  candleS.setData(S.candles.map(shift));
  cvdLine.setData(S.candles.map((c) => ({ time: c.time + TZ, value: c.cvd })));
  deltaHist.setData(S.candles.map((c) => ({ time: c.time + TZ, value: c.delta, color: dcol(c.delta) })));
  chart.timeScale().scrollToRealTime();
}

async function startFeed() {
  stopFeeds();
  setTimeout(startBig, 1500);
  const demo = !!S.state?.demo;
  const ok = !demo && (await loadHistory());
  if (!ok) demoHistory();
  if (ok) await loadHTF();
  drawAll();
  runSMC();
  replaySignals();
  renderAll();
  if (ok) connectWs();
  else {
    startDemoFeed();
    if (!demo) addWarn("Không tải được giá Binance, đang hiển thị giá DEMO. Kiểm tra mạng hoặc đổi binance_rest trong config.json.");
    $("#livePill").className = "live demo"; $("#livePill").textContent = "DEMO";
  }
}

// ─────────────────────────── lớp phủ: mốc GC / GLD + đường cong GEX ───────────────────────────
const ov = { cv: null, ctx: null, dpr: 1, tags: [] };
function initOverlay() {
  ov.cv = $("#ov"); ov.ctx = ov.cv.getContext("2d");
  const resize = () => {
    const r = $("#chartWrap").getBoundingClientRect();
    ov.dpr = window.devicePixelRatio || 1;
    ov.cv.width = Math.round(r.width * ov.dpr); ov.cv.height = Math.round(r.height * ov.dpr);
    ov.cv.style.width = r.width + "px"; ov.cv.style.height = r.height + "px";
    drawOverlay();
  };
  new ResizeObserver(resize).observe($("#chartWrap"));
  chart.timeScale().subscribeVisibleLogicalRangeChange(() => drawOverlay());
  setInterval(drawOverlay, 400); // thang giá tự co giãn theo giá, vẽ lại định kỳ
  resize();
}

function tagBox(ctx, x, y, text, color, align, strong, meta) {
  ctx.font = `${strong ? 600 : 500} 10.5px "IBM Plex Mono", monospace`;
  const w = ctx.measureText(text).width + 10, h = 15, x0 = align === "right" ? x - w : x;
  ctx.fillStyle = strong ? color : "rgba(11,14,18,.88)";
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0, y - h / 2, w, h, 3) : ctx.rect(x0, y - h / 2, w, h); ctx.fill(); ctx.stroke();
  ctx.fillStyle = strong ? "#0b0e12" : color;
  ctx.textBaseline = "middle"; ctx.textAlign = "left";
  ctx.fillText(text, x0 + 5, y + 0.5);
  if (meta && ov.tags) ov.tags.push({ x0, x1: x0 + w, y0: y - h / 2, y1: y + h / 2, ...meta });   // 7f: để chú giải rê chuột trỏ ĐÚNG nhãn
}

// 7h: cách vẽ tường. Menu TVLB+ (tvlb_tinhieu.js, mục Hiển thị, ô "Cách vẽ tường") đặt window.TVLB_WALLSTYLE = "old" (Kiểu 2) hoặc "tvlb" (Kiểu 1, như cũ);
// menu tự lưu lựa chọn cùng các ô chọn khác. Không có hoặc giá trị lạ thì dùng Kiểu 1.
function wallStyle() { return window.TVLB_WALLSTYLE === "old" ? "old" : "tvlb"; }
// Kiểu 2: vạch tường chia 3 BẬC để nhìn là biết mức quan trọng: bậc 1 = Call/Put Wall (dày, liền, đậm); bậc 2 = tường lớn (OI >= 60% tường lớn nhất của nguồn: vừa, liền);
// bậc 3 = tường phụ có nhãn (mảnh, nét đứt, nhạt). Ngưỡng 60% và các độ dày/độ đậm do Claude chọn, chưa kiểm trên màn hình thật.
const OLD_TIER = { 1: { w: 2.2, dash: [], a: 1 }, 2: { w: 1.5, dash: [], a: 0.85 }, 3: { w: 1, dash: [6, 4], a: 0.5 } }, OLD_TIER2_SHARE = 0.6;
// Màu riêng cho Flip / Magnet / Max Pain ở kiểu 2 để không lẫn với tường GC (vàng) và GLD (tím): Flip trắng, Magnet xanh lơ, Max Pain xám chấm.
const OLD_COL = { flip: C.fg, mag: "#4cc3d9", mp: "#9aa3ad" };
// Xếp nhãn kiểu cũ: duyệt theo độ ưu tiên (tường lớn nhất, Flip, Magnet trước), mỗi nhãn bắt đầu ở x = 6;
// nếu chạm nhãn đã đặt (lệch dọc dưới 16 px và chồng ngang) thì dời sang phải ngay sau nhãn đó; tối đa 12 lần dời.
// Hết chỗ (quá maxX) thì lùi về maxX − bề rộng. 16 px và khoảng đệm 6 px là do Claude chọn, chưa đo trên màn hình thật.
function placeOldTags(items, widthOf, maxX) {
  const placed = [], order = [...items].sort((a, b) => a.pri - b.pri || a.y - b.y);
  for (const it of order) {
    const w = widthOf(it); let x = 6;
    for (let g = 0; g < 12; g++) {
      const hit = placed.find((p) => Math.abs(p.y - it.y) < 16 && x < p.x + p.w + 4 && p.x < x + w + 4);
      if (!hit) break;
      x = hit.x + hit.w + 6;
    }
    if (x + w > maxX) x = Math.max(6, maxX - w);
    placed.push({ y: it.y, x, w }); it.x = x;
  }
  return order;
}

function hline(ctx, y, x0, x1, color, width, dash, alpha) {
  ctx.save(); ctx.globalAlpha = alpha ?? 1; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
  ctx.beginPath(); ctx.moveTo(x0, Math.round(y) + 0.5); ctx.lineTo(x1, Math.round(y) + 0.5); ctx.stroke(); ctx.restore();
}

function drawOverlayBase() {
  if (!ov.ctx || !candleS) return;
  const ctx = ov.ctx, dpr = ov.dpr;
  const W = ov.cv.width / dpr, H = ov.cv.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ov.tags = []; window.TVLB_TAGS = ov.tags; ov.drawn = []; window.TVLB_DRAWN = ov.drawn;   // TVLB B9b1: vạch strike thật sự được vẽ (chú giải chỉ cho các vạch này)   // 7f: nhãn vẽ ở lần này (hình chữ nhật + loại)
  const psW = chart.priceScale("right").width() || 70;
  const plotW = W - psW, tsH = 28, plotH = H - tsH;
  const Y = (p) => { const y = candleS.priceToCoordinate(p); return y == null || y < 2 || y > plotH - 2 ? null : y; };
  const p0 = lastPrice();

  // 7h: kiểu hiển thị tường (menu TVLB+): "tvlb" (mặc định, như cũ) hoặc "old" (kiểu chart cũ: vạch nét liền, mọi nhãn một cột bên trái, nhãn gần nhau dịch ngang)
  const OLD = wallStyle() === "old", oldItems = [];
  // Mốc theo nguồn: GC nhãn trái, GLD nhãn phải (giống RyanFX)
  const layers =[["GC", C.gc, $("#lyKey").checked, "left"], ["GLD", C.gld, $("#lyGLD").checked, "right"]];
  for (const [src, color, on, side] of layers) {
    const o = optV(src);
    if (!o || !on) continue;
    const maxOI = Math.max(1, ...o.strikes.map((s) => s.call_oi + s.put_oi));
    const labelSet = new Set([...o.strikes].sort((x, y) => (y.call_oi + y.put_oi) - (x.call_oi + x.put_oi)).slice(0, window.TVLB_TOPN || 10).map((s) => s.strike));   // TVLB+: số tường có nhãn mỗi nguồn (menu)
    for (const s of o.strikes) {
      const y = Y(s.chart); if (y == null) continue;
      const oi = s.call_oi + s.put_oi, share = oi / maxOI;
      const isCW = s.strike === o.call_wall, isPW = s.strike === o.put_wall;
      if (share < 0.12 && !isCW && !isPW) continue;
      if (window.TVLB_MINOR === false && !labelSet.has(s.strike) && !isCW && !isPW) continue;   // TVLB+: ẩn vạch strike phụ không có nhãn
      const lc = OLD ? color : isCW ? C.down : isPW ? C.up : color, labelled = labelSet.has(s.strike) || isCW || isPW;   // kiểu 2: màu theo nguồn (GC cam/vàng, GLD tím, theo Master Plan Trụ cột 3); Call/Put phân biệt bằng độ dày và chữ CW/PW trên nhãn
      if (!OLD || labelled) ov.drawn.push({ src, strike: s.strike });   // TVLB B9b1
      if (OLD) {
        if (!labelled) continue;   // kiểu cũ: chỉ vẽ tường có nhãn, không vẽ vạch phụ
        const tr = OLD_TIER[isCW || isPW ? 1 : share >= OLD_TIER2_SHARE ? 2 : 3];
        hline(ctx, y, 0, plotW, lc, tr.w, tr.dash, tr.a);
      } else hline(ctx, y, 0, plotW, lc, isCW || isPW ? 1.6 : 1, isCW || isPW ? [] : [4, 4], isCW || isPW ? 0.95 : 0.25 + 0.6 * share);
      if (labelled) {
        const d = s.d_oi != null ? ` ${s.d_oi >= 0 ? "+" : ""}${fmtK(s.d_oi)}` : "";
        const txt = window.TVLB_COMPACT ? `${s.strike}${isCW ? " CW" : isPW ? " PW" : ""}` : `${src} ${s.strike} · ${Math.round(share * 100)}%${isCW ? " CW" : isPW ? " PW" : ""}${d}`;   // 7n số 135: chế độ gọn chỉ ghi strike + CW/PW (màu và bên trái/phải cho biết GC hay GLD; % và ΔOI xem ở bảng Strike Profile)
        if (OLD) oldItems.push({ y, txt, color: lc, strong: isCW || isPW, pri: isCW || isPW ? 0 : 3 + (1 - share), meta: { k: "strike", src, strike: s.strike } });
        else tagBox(ctx, side === "left" ? 6 : plotW - 6, y, txt, lc, side, isCW || isPW, { k: "strike", src, strike: s.strike });
      }
    }
  }

  // Flip / Magnet / Max Pain của nguồn chính
  const P = primV();
  if (P && $("#lyKey").checked) {
    const c = P.chart;
    const yF = c.gamma_flip != null ? Y(c.gamma_flip) : null;
    if (yF != null) {
      const t = window.TVLB_COMPACT ? `Γ ${Math.round(c.gamma_flip)}` : `Γ FLIP ${fmt(c.gamma_flip)}`;
      if (OLD) { hline(ctx, yF, 0, plotW, OLD_COL.flip, 1.8, [], 0.95); oldItems.push({ y: yF, txt: t, color: OLD_COL.flip, strong: true, pri: 1, meta: { k: "flip" } }); }
      else { hline(ctx, yF, 0, plotW, C.flip, 1.2, [6, 4], 0.9); tagBox(ctx, plotW * 0.5, yF, t, C.flip, "left", true, { k: "flip" }); }
    }
    const yM = c.magnet != null ? Y(c.magnet) : null;
    if (yM != null) {
      const t = window.TVLB_COMPACT ? `◎ ${Math.round(c.magnet)}` : `◎ MAGNET ${fmt(c.magnet)}`;
      if (OLD) { hline(ctx, yM, 0, plotW, OLD_COL.mag, 1.6, [], 0.9); oldItems.push({ y: yM, txt: t, color: OLD_COL.mag, strong: true, pri: 2, meta: { k: "magnet" } }); }   // kiểu cũ có thêm vạch Magnet (kiểu TVLB chỉ có nhãn)
      else tagBox(ctx, plotW * 0.5, yM, t, C.mag, "left", true, { k: "magnet" });
    }
    const yP = c.max_pain != null ? Y(c.max_pain) : null;
    if (yP != null) {
      const t = window.TVLB_COMPACT ? `MP ${Math.round(c.max_pain)}` : `MaxPain ${fmt(c.max_pain)}`;
      if (OLD) { hline(ctx, yP, 0, plotW, OLD_COL.mp, 1, [2, 3], 0.7); oldItems.push({ y: yP, txt: t, color: OLD_COL.mp, strong: false, pri: 5, meta: { k: "mp" } }); }
      else { hline(ctx, yP, 0, plotW, "#9aa3ad", 1, [2, 3], 0.6); tagBox(ctx, plotW * 0.5 + 150, yP, t, "#9aa3ad", "left", false, { k: "mp" }); }
    }
  }
  // 7h: kiểu cũ — xếp mọi nhãn vào cột bên trái; nhãn nào chạm nhãn đã đặt thì dịch sang phải (nhãn quan trọng đặt trước, ở sát mép trái)
  if (OLD && oldItems.length) {
    const wOf = (it) => { ctx.font = `${it.strong ? 600 : 500} 10.5px "IBM Plex Mono", monospace`; return ctx.measureText(it.txt).width + 10; };
    for (const it of placeOldTags(oldItems, wOf, plotW * 0.7)) tagBox(ctx, it.x, it.y, it.txt, it.color, "left", it.strong, it.meta);
  }

  // Volume profile phiên
  const vp = S.state?.volume_profile;
  if (vp && $("#lyVP").checked) {
    // TVLB B9b0: nhãn VAH/POC/VAL đặt ở giữa biểu đồ (không đè nhãn tường ở mép trái), và dãn ra nếu 2 nhãn sát nhau
    const vpl = [];
    for (const [k, lab] of [["poc", "POC"], ["vah", "VAH"], ["val", "VAL"]]) {
      const y = Y(vp[k]); if (y == null) continue;
      hline(ctx, y, 0, plotW, C.vp, k === "poc" ? 1.5 : 1, k === "poc" ? [] : [3, 3], 0.8);
      vpl.push({ y, t: `${lab} ${Math.round(vp[k])}`, vk: k });   // v23o: vk để chú giải rê chuột biết là POC/VAH/VAL
    }
    vpl.sort((u, v) => u.y - v.y);
    for (let j = 1; j < vpl.length; j++) if (vpl[j].y - vpl[j - 1].y < 12) vpl[j].y = vpl[j - 1].y + 12;
    ctx.fillStyle = C.vp; ctx.font = "9.5px 'IBM Plex Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    // B9b1: nhãn ra mép trái; nếu đè lên nhãn tường/Flip/Magnet đã vẽ thì dịch sang phải, hết nhãn đó rồi đặt tiếp (xếp hàng như tường)
    const placed = [];
    for (const it of vpl) {
      const w = ctx.measureText(it.t).width, y0 = it.y - 14, y1 = it.y;
      let x = 6;
      for (let g = 0; g < 12; g++) {
        const hit = [...(ov.tags || []), ...placed].find((t) => t.y0 != null && t.x0 < x + w + 3 && t.x1 > x - 3 && t.y0 < y1 && t.y1 > y0);
        if (!hit) break; x = hit.x1 + 6;
      }
      ctx.fillText(it.t, x, it.y - 2); placed.push({ x0: x, x1: x + w, y0, y1 }); ov.tags.push({ x0: x - 2, x1: x + w + 2, y0, y1: y1 + 2, k: "vp", vk: it.vk });   // v23o
    }
  }

  // TVLB B9b0: vùng xem xét Option Flow (TL1·TL2·HG), vẽ như KH1-KH3
  if (ofOn("zones") && S.ofChk && S.ofChk.checked && S.ofPlans) {
    const labs = [];
    for (const p of S.ofPlans) {
      if (!p.on || p.lo == null) continue;
      const yc = (v) => { const yy = candleS.priceToCoordinate(v); return yy == null ? null : Math.max(2, Math.min(plotH - 2, yy)); }, y1 = yc(p.hi), y0 = yc(p.lo); if (y1 == null || y0 == null || y0 - y1 < 1) continue;   // v23o: mép vùng nằm ngoài khung giá thì kẹp vào mép khung (trước đây bỏ cả vùng, mất nhãn)
      const h = Math.max(6, y0 - y1), top = (y0 + y1) / 2 - h / 2, col = p.side === "SELL" ? "239,83,80" : p.side === "BOTH" ? "240,180,41" : "38,166,154";
      const x0 = Math.round(plotW * 0.54);   // vùng ngắn, chỉ nằm ở nửa phải như KH1-KH3 (không kéo ngang cả chart)
      if (!(/^hg/.test(p.id) && OFS.hg_show !== true)) {   // B9b1: vùng HG HEDGE trùng vùng HEDGE −Γ → mặc định chỉ giữ nhãn, ẩn nền + viền (tick "hg_show" để hiện lại)
        ctx.fillStyle = `rgba(${col},${p.blocked ? 0.05 : 0.11})`; ctx.fillRect(x0, top, plotW - x0, h);
        ctx.strokeStyle = `rgba(${col},.35)`; ctx.lineWidth = 0.6; ctx.setLineDash([3, 3]); ctx.strokeRect(x0 + 0.5, top, plotW - x0 - 1, h); ctx.setLineDash([]); ctx.lineWidth = 1;
      }
      labs.push({ sell: p.side === "SELL", y: p.side === "SELL" ? top - 2 : top + h + 12, col, t: `${p.short} ${p.side} · ${p.state}${p.chk && p.chk.tot ? " · " + ofSimple(p.chk) : ""}` });   // SELL: nhãn nằm TRÊN vùng · BUY: nhãn nằm DƯỚI vùng
    }
    const up = labs.filter((l) => l.sell).sort((u, v) => v.y - u.y), dn = labs.filter((l) => !l.sell).sort((u, v) => u.y - v.y);
    for (let j = 1; j < up.length; j++) if (up[j - 1].y - up[j].y < 13) up[j].y = up[j - 1].y - 13;   // nhãn SELL sát nhau: xếp chồng lên trên
    for (let j = 1; j < dn.length; j++) if (dn[j].y - dn[j - 1].y < 13) dn[j].y = dn[j - 1].y + 13;   // nhãn BUY sát nhau: xếp chồng xuống dưới
    ctx.font = "600 10px 'IBM Plex Mono', monospace"; ctx.textAlign = "right"; ctx.textBaseline = "bottom";
    for (const l of labs) { const w = ctx.measureText(l.t).width; ctx.fillStyle = "rgba(10,14,20,.88)"; ctx.fillRect(plotW - 9 - w, l.y - 11, w + 6, 12); ctx.fillStyle = `rgb(${l.col})`; ctx.fillText(l.t, plotW - 6, l.y); }
  }

  // TVLB B9b0: khung đo SL/TP kiểu TradingView + dấu vào lệnh cho các tín hiệu Option Flow hôm nay
  if (ofOn("rr") && S.ofChk && S.ofChk.checked && S.signals.length) {
    const tsc = chart.timeScale(), cc = S.candles, P = (v) => candleS.priceToCoordinate(v);
    ctx.font = "600 10px 'IBM Plex Mono', monospace"; ctx.textBaseline = "middle";
    for (const g of S.signals.slice(-6)) {
      const x0 = tsc.timeToCoordinate(g.time + TZ); if (x0 == null || x0 > plotW) continue;
      const nx = cc[g.i + 1] ? tsc.timeToCoordinate(cc[g.i + 1].time + TZ) : null, bs = nx != null ? Math.max(3, nx - x0) : 8;
      let hit = null;
      for (let j = g.i + 1; j < cc.length; j++) { const k2 = cc[j]; if (g.side === "BUY" ? k2.low <= g.sl : k2.high >= g.sl) { hit = { j, t: "chạm SL" }; break; } if (g.tp1 != null && (g.side === "BUY" ? k2.high >= g.tp1 : k2.low <= g.tp1)) { hit = { j, t: "chạm TP1" }; break; } }
      let x1 = hit ? tsc.timeToCoordinate(cc[hit.j].time + TZ) : null; if (x1 == null) x1 = x0 + 14 * bs;
      x1 = Math.min(plotW - 2, Math.max(x1, x0 + 6 * bs));
      const yE = P(g.entry), yS = P(g.sl), yT = g.tp1 != null ? P(g.tp1) : null; if (yE == null || yS == null) continue;
      const risk = Math.abs(g.entry - g.sl), gain = g.tp1 != null ? Math.abs(g.tp1 - g.entry) : null, w = x1 - x0;
      if (yT != null) { ctx.fillStyle = "rgba(38,166,154,.20)"; ctx.fillRect(x0, Math.min(yE, yT), w, Math.abs(yT - yE)); }
      ctx.fillStyle = "rgba(239,83,80,.20)"; ctx.fillRect(x0, Math.min(yE, yS), w, Math.abs(yS - yE));
      ctx.strokeStyle = "#f0b429"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, yE); ctx.lineTo(x1, yE); ctx.stroke();
      ctx.fillStyle = "#f0b429"; ctx.beginPath(); ctx.moveTo(x0, yE - 5); ctx.lineTo(x0 + 5, yE); ctx.lineTo(x0, yE + 5); ctx.lineTo(x0 - 5, yE); ctx.closePath(); ctx.fill();   // dấu vào lệnh (hình thoi)
      ctx.textAlign = "left";
      ctx.fillStyle = "#f0b429"; ctx.fillText(`VÀO ${g.tag || ""} ${g.side} ${g.entry.toFixed(1)}`, x0 + 8, yE + (g.side === "BUY" ? -9 : 9));
      ctx.fillStyle = "#ef5350"; ctx.fillText(`SL −${risk.toFixed(1)}$`, x0 + 6, yS + (g.side === "BUY" ? -7 : 7));
      if (yT != null) { ctx.fillStyle = "#26a69a"; ctx.fillText(`TP1 +${gain.toFixed(1)}$ · 1:${(gain / Math.max(risk, 0.01)).toFixed(1)}`, x0 + 6, yT + (g.side === "BUY" ? 7 : -7)); }
      if (hit) { ctx.textAlign = "right"; ctx.fillStyle = hit.t === "chạm SL" ? "#ef5350" : "#26a69a"; ctx.fillText(hit.t, x1 - 3, yE); }
    }
  }

  // Đường cong Net GEX theo strike (nguồn chính)
  if (P && $("#lyGex").checked && P.strikes.length > 1) {
    const cx = plotW * 0.78, half = plotW * 0.1;
    const gmax = Math.max(1, ...P.strikes.map((s) => Math.abs(s.net_gex)));
    const pts = P.strikes.map((s) => ({ s, y: candleS.priceToCoordinate(s.chart) })).filter((p) => p.y != null && p.y > -50 && p.y < plotH + 50).sort((a, b) => a.y - b.y);
    if (pts.length > 1) {
      let gap = Infinity; for (let i = 1; i < pts.length; i++) gap = Math.min(gap, pts[i].y - pts[i - 1].y);
      const bh = Math.max(2, Math.min(10, gap * 0.6));
      ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = "#9aa3ad"; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(cx, Math.max(0, pts[0].y)); ctx.lineTo(cx, Math.min(plotH, pts[pts.length - 1].y)); ctx.stroke(); ctx.restore();
      for (const p of pts) {
        const x = cx + (p.s.net_gex / gmax) * half;
        ctx.fillStyle = p.s.net_gex >= 0 ? "rgba(38,179,132,.45)" : "rgba(229,83,75,.45)";
        ctx.fillRect(Math.min(cx, x), p.y - bh / 2, Math.abs(x - cx), bh);
      }
      ctx.strokeStyle = C.mag; ctx.lineWidth = 1.6; ctx.setLineDash([]);
      ctx.beginPath(); pts.forEach((p, i) => { const x = cx + (p.s.net_gex / gmax) * half; i ? ctx.lineTo(x, p.y) : ctx.moveTo(x, p.y); }); ctx.stroke();
      const top = [...pts].sort((a, b) => Math.abs(b.s.net_gex) - Math.abs(a.s.net_gex)).slice(0, 6);
      ctx.font = "10px 'IBM Plex Mono', monospace"; ctx.textBaseline = "middle";
      for (const p of top) {
        if (p.y < 4 || p.y > plotH - 4) continue;
        const g = p.s.net_gex, x = cx + (g / gmax) * half;
        ctx.fillStyle = g >= 0 ? C.up : C.down; ctx.textAlign = g >= 0 ? "left" : "right";
        ctx.fillText(`${g >= 0 ? "+" : ""}${fmtK(g)}`, x + (g >= 0 ? 4 : -4), p.y);
      }
      ctx.fillStyle = C.muted; ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText(`Net GEX ${P.source} /1%`, cx, 30);
      { const tw = ctx.measureText(`Net GEX ${P.source} /1%`).width; ov.tags.push({ x0: cx - tw / 2 - 3, x1: cx + tw / 2 + 3, y0: 28, y1: 44, k: "gexcurve" }); }
    }
  }
  // Bước 5: vùng hedge lớn của LP (≥ ngưỡng HĐ/10 USD) — tô dải ngang mờ
  const hz = hedgeSt();
  if (hz && $("#lyGex").checked) {
    for (const z of hz.zones) {
      const y1 = candleS.priceToCoordinate(z.hi), y2 = candleS.priceToCoordinate(z.lo);
      if (y1 == null || y2 == null || y2 < 0 || y1 > plotH) continue;
      const a = Math.max(0, y1), b = Math.min(plotH, y2), col = z.kind === "accel" ? C.down : C.up;
      ctx.fillStyle = z.kind === "accel" ? "rgba(229,83,75,.07)" : "rgba(38,179,132,.07)"; ctx.fillRect(0, a, plotW, Math.max(1, b - a));
      if (b - a > 8) tagBox(ctx, plotW * 0.78, (a + b) / 2, (window.TVLB_COMPACT ? `${z.kind === "accel" ? "−Γ" : "+Γ"} ${Math.abs(z.peak).toLocaleString("en-US")}` : `HEDGE ${z.kind === "accel" ? "−Γ" : "+Γ"} ${Math.abs(z.peak).toLocaleString("en-US")} HĐ/${hz.win}$`), col, "left", false, { k: "hedge", z, win: hz.win });
    }
  }
  if ($("#lySMC")?.checked && S.smc) drawSMC(ctx, plotW, plotH);
  { const rg = P ? regimePct(P.underlying, P.gamma_flip) : null;
    $("#chartInfo").textContent = P ? `${P.source} · ${P.strikes.length} strikes · Σ ${fmtK(P.net_gex)} · ${rg.pct == null ? "?" : rg.far ? `? không rõ (${rg.pctTxt} Flip)` : `${rg.pct >= 0 ? "+Γ" : "−Γ"} ${rg.pctTxt} Flip`} · mốc chưa kiểm định` : "Chưa có dữ liệu Options";
    if (window.TVLB_COMPACT && P) { const el = $("#chartInfo"); el.textContent = el.textContent.replace(/ · \d+ strikes/, "").replace("mốc chưa kiểm định", "chưa kiểm định"); } }   // 7o số 141: chế độ gọn rút gọn ô thông tin
}

// Vẽ SMC: vùng Premium/Discount, thanh khoản, trendline, HH/HL/LH/LL, BOS/CHoCH
function drawSMC(ctx, plotW, plotH) {
  const R = S.smc, c = S.candles, ts = chart.timeScale(), fr = R.frame;
  if (!c.length) return;
  const X = (t) => { if (t == null) return 0; const x = ts.timeToCoordinate(t + TZ); return x == null ? (t < c[0].time ? 0 : plotW) : Math.max(0, Math.min(plotW, x)); };
  const Yr = (p) => { const y = candleS.priceToCoordinate(p); return y == null ? null : Math.max(-2, Math.min(plotH + 2, y)); };
  const box = (t0, p1, p2, fill, stroke, label, where) => {
    const y1 = Yr(p1), y2 = Yr(p2); if (y1 == null || y2 == null) return;
    const x0 = X(t0), top = Math.min(y1, y2), hh = Math.abs(y2 - y1);
    if (hh < 0.5 || top > plotH || top + hh < 0) return;
    ctx.fillStyle = fill; ctx.fillRect(x0, top, plotW - x0, hh);
    ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.setLineDash([]); ctx.strokeRect(x0 + 0.5, top + 0.5, plotW - x0 - 1, hh - 1);
    if (label) {
      ctx.font = "600 10px 'IBM Plex Mono', monospace"; ctx.fillStyle = stroke; ctx.textAlign = "right";
      ctx.textBaseline = where === "top" ? "top" : "bottom";
      const ly = where === "top" ? Math.max(top + 2, 2) : Math.min(top + hh - 2, plotH - 2);
      ctx.fillText(label, plotW - 6, ly);
    }
  };
  const f = (x) => fmt(x), tfN = smcCfg().tfName;
  if (fr) {
    const [o1, o2] = [Math.min(...fr.ote), Math.max(...fr.ote)];
    if (fr.dir === -1) {
      // H4 giảm: vùng Premium để SELL thuận (CL2); đáy H4 (Fibo 0) là nơi canh BUY hồi (CL1)
      box(fr.hiT, o1, o2, "rgba(229,83,75,.09)", "rgba(229,83,75,.7)", `H4 PREMIUM · OTE ${f(o1)}–${f(o2)} (CL2 Sell thuận)`, "bottom");
      box(fr.hiT, o2, fr.hi, "rgba(229,83,75,.17)", "rgba(229,83,75,.7)", `H4 EXTREME → ${f(fr.hi)}`, "top");
    } else {
      box(fr.hiT, o2, o1, "rgba(38,179,132,.09)", "rgba(38,179,132,.7)", `H4 DISCOUNT · OTE ${f(o1)}–${f(o2)} (CL2 Buy thuận)`, "top");
      box(fr.hiT, o1, fr.lo, "rgba(38,179,132,.17)", "rgba(38,179,132,.7)", `H4 EXTREME → ${f(fr.lo)}`, "bottom");
    }
    const y5 = Yr(fr.fib05); if (y5 != null && y5 > 0 && y5 < plotH) { hline(ctx, y5, X(fr.hiT), plotW, "#9aa3ad", 1, [5, 4], 0.7); ctx.fillStyle = "#9aa3ad"; ctx.font = "10px 'IBM Plex Mono', monospace"; ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText(`H4 Fibo 0.5 · ${f(fr.fib05)}`, plotW - 6, y5 - 2); }
    // vùng chờ KB2 trên khung chart (CL1 hồi / CL2 thuận)
    for (const [zz, cl] of [[fr.z1, 1], [fr.z2, 2]]) {
      if (!zz || !c[zz.from]) continue;
      const vals = [zz.lo, zz.top, zz.hi, zz.bot].filter((x) => x != null), a = Math.min(...vals), b = Math.max(...vals);
      const buy = (cl === 1) === (fr.dir === -1);
      box(c[zz.from].time, a, b, buy ? "rgba(76,195,217,.10)" : "rgba(242,184,75,.10)", buy ? "rgba(76,195,217,.8)" : "rgba(242,184,75,.8)", `${tfN} vùng chờ CL${cl}-KB2 ${buy ? "BUY" : "SELL"} ${f(a)}–${f(b)}`, buy ? "top" : "bottom");
    }
  }
  // lệnh chờ / đang chạy: Entry, SL, TP1
  ctx.font = "600 10px 'IBM Plex Mono', monospace"; ctx.textBaseline = "middle";
  for (const o of smcOrders()) {
    if (o.status !== "pending" && o.status !== "open") continue;
    const x0 = c[o.created] ? X(c[o.created].time) : 0, col = o.side === "BUY" ? C.up : C.down;
    for (const [p, lab, cc, dash] of [[o.entry, `SMC ${o.name} ${o.side} ${o.status === "pending" ? "LIMIT" : "ĐANG CHẠY"} ${f(o.entry)}`, col, []], [o.sl, `SMC SL ${f(o.sl)}`, C.down, [4, 3]], [o.tp1, `SMC TP1 ${f(o.tp1)}${o.tpNote || ""}`, C.up, [4, 3]], [o.tp2, `SMC TP2 ${f(o.tp2)}`, C.up, [2, 4]]]) {
      const y = Yr(p); if (p == null || y == null || y < 0 || y > plotH) continue;
      hline(ctx, y, x0, plotW, cc, 1.2, dash, 0.9);
      ctx.fillStyle = cc; ctx.textAlign = "left"; ctx.fillText(lab, x0 + 4, y - 7);
    }
  }
  // thanh khoản đang chờ
  ctx.font = "10px 'IBM Plex Mono', monospace"; ctx.textBaseline = "middle"; ctx.textAlign = "right";
  const p0 = lastPrice();
  for (const [arr, kind] of [[R.liqH, "đỉnh"], [R.liqL, "đáy"]]) {
    // chỉ vẽ 4 vùng gần giá nhất mỗi phía cho gọn (EQH/EQL luôn vẽ)
    const near = [...arr].sort((a, b) => Math.abs(a.p - p0) - Math.abs(b.p - p0)).filter((L, j) => j < 4 || L.n >= 2);
    for (const L of near) {
      const y = Yr(L.p); if (y == null || y < 0 || y > plotH || !c[L.i]) continue;
      hline(ctx, y, X(c[L.i].time), plotW, C.mag, L.n >= 2 ? 1.6 : 1, [2, 3], L.n >= 2 ? 0.95 : 0.6);
      ctx.fillStyle = C.mag; ctx.fillText(`${L.n >= 2 ? (kind === "đỉnh" ? "EQH×" : "EQL×") + L.n : "$ " + kind} ${f(L.p)}`, plotW - 6, y - 7);
    }
  }
  // trendline nối 2 đỉnh/đáy chính thức
  if (R.tl && c[R.tl.a.i] && c[R.tl.b.i]) {
    const xa = X(c[R.tl.a.i].time), ya = Yr(R.tl.a.p), xb = X(c[R.tl.b.i].time), yb = Yr(R.tl.b.p);
    if (ya != null && yb != null && xb > xa) {
      const k = (yb - ya) / (xb - xa);
      ctx.save(); ctx.strokeStyle = C.mag; ctx.globalAlpha = 0.8; ctx.lineWidth = 1.2; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(plotW, ya + k * (plotW - xa)); ctx.stroke(); ctx.restore();
    }
  }
  // HH/HL/LH/LL và BOS/CHoCH (30 mốc gần nhất)
  ctx.font = "600 9.5px 'IBM Plex Mono', monospace"; ctx.textAlign = "center";
  for (const e of R.events.slice(-40)) {
    if (!c[e.i]) continue;
    const x = ts.timeToCoordinate(c[e.i].time + TZ); if (x == null || x < 0 || x > plotW) continue;
    const y = Yr(e.p); if (y == null || y < 0 || y > plotH) continue;
    if (e.kind === "BOS" || e.kind === "CHoCH") {
      const col = e.dir > 0 ? C.up : C.down, x0 = c[e.from] ? X(c[e.from].time) : x;
      hline(ctx, y, x0, x, col, 1, e.kind === "BOS" ? [4, 3] : [], 0.9);
      ctx.fillStyle = col; ctx.textBaseline = e.dir > 0 ? "bottom" : "top"; ctx.fillText(e.kind, (x0 + x) / 2, y + (e.dir > 0 ? -2 : 2));
    } else {
      ctx.fillStyle = e.side === "top" ? C.down : C.up; ctx.textBaseline = e.side === "top" ? "bottom" : "top";
      ctx.fillText(e.kind, x, y + (e.side === "top" ? -4 : 4));
    }
  }
}

// ─────────────────────────── tín hiệu (cùng luật với indicator TradingView) ───────────────────────────
function inUsSession(t) { const [a, b] = S.cfg.signals.us_session_vn, hm = vnClock(t); return hm >= a && hm < b; }
function primaryLevels() { const p = prim(); return p ? { src: p.source, ...p.chart } : null; }
function nextStrike(price, above) {
  const p = prim(); if (!p) return null;
  const xs = p.strikes.map((s) => s.chart).filter((x) => (above ? x > price + 0.01 : x < price - 0.01));
  return xs.length ? (above ? Math.min(...xs) : Math.max(...xs)) : null;
}
function nearDoi(price) {
  const p = prim(); if (!p) return null;
  let best = null;
  for (const s of p.strikes) {
    if (s.d_oi == null) continue;
    if (Math.abs(s.chart - price) <= S.cfg.signals.doi_zone && (!best || Math.abs(s.chart - price) < Math.abs(best.chart - price))) best = s;
  }
  return best;
}
function divAt(i) {
  const c = S.candles, n = S.cfg.signals.div_lookback;
  if (i < n + 1) return { bear: false, bull: false };
  const win = c.slice(i - n + 1, i + 1), prev = c.slice(i - n, i), k = c[i];
  return {
    bear: k.high >= Math.max(...win.map((x) => x.high)) && k.cvd < Math.max(...prev.map((x) => x.cvd)),
    bull: k.low <= Math.min(...win.map((x) => x.low)) && k.cvd > Math.min(...prev.map((x) => x.cvd)),
  };
}
// ── TVLB B9b0: bật/tắt từng điều kiện Option Flow (lưu localStorage "tvlb.of"; false = tắt) ──
const OF_LS = "tvlb.of";
const OFS = (() => { try { const o = JSON.parse(localStorage.getItem(OF_LS) || "{}"); return o && typeof o === "object" && !Array.isArray(o) ? o : {}; } catch { return {}; } })();
const ofOn = (k) => OFS[k] !== false;
// TVLB B9b1: bộ lọc theo anh Nam, MẶC ĐỊNH TẮT (= hành vi TL1/TL2 cũ). Chỉ bật khi bạn tick ở hộp "Bật/tắt điều kiện". Chờ anh Nam xác nhận câu 4, 5 (bản 3.3).
const ofX = (k) => OFS[k] === true;
const OF_FILTERS = [
  ["x_flipfar", "Ngày Flip xa (cách giá > 2,5%) thì ĐỨNG NGOÀI (theo B6; chờ xác nhận câu 4)"],
  ["x_near", "Hiện thêm TƯỜNG GẦN theo B10b: top 3 OI trong ±2,5% quanh giá mở ngày (xấp xỉ, THAM KHẢO, chưa kiểm định; chờ xác nhận câu 3)"],
  ["x_regime", "Bẫy chỉ khi Gamma DƯƠNG, Thủng/Squeeze chỉ khi Gamma ÂM (theo B1; chờ xác nhận câu 5)"],
];
const OF_GROUPS = [
  ["g_tl1", "TL1 · Thủng Put Wall / Squeeze Call Wall (đi theo xu hướng)"],
  ["g_trap", "TL1+TL2 · Bẫy tại Call/Put Wall (đánh ngược)"],
  ["g_hedge", "HG · Vùng Hedge −Γ (không có trong TL1/TL2)"],
  ["session", "Chỉ xét phiên Mỹ 19:00-23:00 giờ VN (bỏ tick = xét cả ngày)"],
  ["zones", "Vẽ vùng xem xét TL1·TL2·HG lên chart"],
  ["rr", "Vẽ khung đo SL/TP kiểu TradingView cho tín hiệu hôm nay"],
  ["watch", "Đánh dấu NẾN ĐANG QUAN SÁT trên chart: ◉ vàng = đang quan sát, ✔ = đủ mọi điều kiện theo menu; kèm tên kế hoạch + x/y (trên nến = SELL, dưới nến = BUY; chỉ hiển thị, không phải lệnh)"],
];
const OF_CONDS = [
  ["gamma", "Lọc Gamma: Gamma âm thì không BUY bắt đáy (TL1)", ["gamma"]],
  ["Phân kỳ CVD", "Phân kỳ CVD với giá (TL2)", ["Phân kỳ CVD âm", "Phân kỳ CVD dương"]],
  ["CVD dốc", "CVD dốc cùng chiều lệnh", ["CVD dốc xuống", "CVD dốc lên"]],
  ["Delta nến", "Delta của nến cùng chiều lệnh", ["Delta nến âm", "Delta nến dương"]],
  ["DXY", "DXY ngược chiều vàng (chỉ có khi live)", ["DXY tăng", "DXY giảm"]],
  ["Volume spike", "Volume spike ≥ 1.8× SMA20", ["Volume spike"]],
  ["Vol↑ΔOI", "Vol↑ mà ΔOI≤0 (TL2)", ["Vol↑ mà ΔOI≤0"]],
  ["ΔOI lớn", "ΔOI ≥ 1500 tại vùng (TL2)", ["ΔOI≥1500 tại vùng"]],
  ["Quét", "Nến quét thanh khoản (chỉ nhóm HG)", ["Nến quét thanh khoản"]],
  ["Lệnh lớn", "Lệnh lớn ròng cùng chiều (chỉ live)", ["Lệnh lớn mua ròng", "Lệnh lớn bán ròng"]],
];

// ── TVLB B9b0: bảng theo dõi Option Flow (cảnh báo cấu hình + đang chờ gì + tín hiệu hôm nay) ──
function ofWarnText() {
  const minC = Number.isInteger(OFS.minConf) ? OFS.minConf : S.cfg.signals.min_confirm;
  const nC = OF_CONDS.filter(([k]) => k !== "gamma").filter(([, , n]) => ofOn("c:" + n[0])).length;
  const nG = OF_GROUPS.filter(([k]) => k !== "session" && k !== "zones" && k !== "rr" && k !== "watch").filter(([k]) => ofOn(k)).length;
  if (nG === 0) return "Đã tắt cả 3 nhóm tín hiệu → sẽ không có tín hiệu nào. Hãy tick ít nhất 1 nhóm.";
  if (nC < minC) return `Chỉ đang bật ${nC} điều kiện xác nhận nhưng cần tối thiểu ${minC} → sẽ KHÔNG BAO GIỜ có tín hiệu. Hãy tick thêm điều kiện hoặc hạ "Số xác nhận tối thiểu".`;
  return "";
}
const OFV = { tab: "new" };
const ofFm = (v) => (v == null || !isFinite(v) ? "—" : Number(v).toFixed(2));
function ofModel() {
  const c = S.candles, sc = S.cfg.signals, L = primaryLevels();
  if (!L || L.call_wall == null || L.put_wall == null || c.length < 30) return null;
  const i = c.length - 2, k = c[i], px = c[c.length - 1].close, tol = sc.touch_tol, buf = sc.sl_buffer;
  const cw = L.call_wall, pw = L.put_wall, flip = L.gamma_flip, negG = flip != null && px < flip, blockG = ofOn("gamma") && negG;
  const rgp = regimePct(px, flip), flipFar = ofX("x_flipfar") && flip != null && rgp.far, regX = ofX("x_regime") && flip != null;   // TVLB B9b1
  const tfOk = (TF_SEC[S.tf] || 0) >= 300, sessOn = sc.session_only && ofOn("session"), inS = inUsSession(c[c.length - 1].time);
  const since = i - S.lastSigIdx, cdOk = since > sc.cooldown_bars, gatesOk = tfOk && (!sessOn || inS) && !flipFar;
  const gates = [[tfOk, "Khung nến ≥ M5 (đang " + S.tf + ")"], [!sessOn || inS, sessOn ? (inS ? "Trong phiên Mỹ 19:00-23:00 VN" : "Ngoài phiên Mỹ 19:00-23:00 VN") : "Không lọc phiên"], [!flipFar, flipFar ? `Flip cách giá ${rgp.pctTxt}: ngày "không rõ", đứng ngoài (bộ lọc B6 đang bật)` : "Không lọc ngày Flip xa"], [cdOk, cdOk ? "Hết nghỉ sau tín hiệu trước" : "Đang nghỉ " + (sc.cooldown_bars - since + 1) + " nến sau tín hiệu trước"]];
  const plans = [];
  const add = (o) => {
    o.past = (o.id === "bd" && px < o.lo) || (o.id === "sq" && px > o.hi); // giá đã ở phía bên kia tường: không còn "chờ tới vùng"
    o.dist = o.hi == null || o.past ? null : px < o.lo ? o.lo - px : px > o.hi ? px - o.hi : 0;
    o.state = !o.on ? "TẮT" : o.blocked ? "CHẶN Γ" : !gatesOk ? "NGOÀI CỔNG" : o.past ? "ĐÃ QUA" : o.dist <= tol ? (o.side === "BOTH" ? "TRONG VÙNG" : "SẴN SÀNG") : o.dist <= 6 ? "GẦN" : "CHỜ";
    plans.push(o);
  };
  add({ id: "ts", short: "TL1·2 BẪY", name: "TL1·2 · Bẫy SELL tại Call Wall", side: "SELL", on: ofOn("g_trap"), blocked: regX && negG, why: "Gamma âm: bộ lọc B1 chặn bẫy", lo: cw - tol, hi: cw + tol,
    cond: `nến chạm ≥ ${ofFm(cw - tol)} rồi đóng DƯỚI tường, nến giảm, đủ xác nhận`, sl: `đỉnh nến + ${buf}$`, tp1: nextStrike(cw, false), tp2: pw, cancel: `nến đóng trên ${ofFm(cw + tol)} (thành Squeeze)` });
  add({ id: "tb", short: "TL1·2 BẪY", name: "TL1·2 · Bẫy BUY tại Put Wall", side: "BUY", on: ofOn("g_trap"), blocked: blockG || (regX && negG), why: blockG ? "Gamma âm: không bắt đáy" : "Gamma âm: bộ lọc B1 chặn bẫy", lo: pw - tol, hi: pw + tol,
    cond: `nến chạm ≤ ${ofFm(pw + tol)} rồi đóng TRÊN tường, nến tăng, đủ xác nhận${blockG ? " · đang bị chặn vì Gamma âm" : ""}`, sl: `đáy nến − ${buf}$`, tp1: nextStrike(pw, true), tp2: cw, cancel: `nến đóng dưới ${ofFm(pw - tol)} (thành Thủng)` });
  add({ id: "bd", short: "TL1 THỦNG", name: "TL1 · Thủng Put Wall (đi theo xu hướng)", side: "SELL", on: ofOn("g_tl1"), blocked: regX && !negG, why: "Gamma dương: bộ lọc B1 chặn thủng/squeeze", lo: pw - tol, hi: pw - tol,
    cond: `nến đóng DƯỚI ${ofFm(pw - tol)} (nến trước còn ở trên), đủ xác nhận`, sl: `${ofFm(pw + buf)} (tường + ${buf}$)`, tp1: nextStrike(pw - tol, false), tp2: null, cancel: `giá quay lại trên ${ofFm(pw)}` });
  add({ id: "sq", short: "TL1 SQUEEZE", name: "TL1 · Squeeze qua Call Wall (đi theo xu hướng)", side: "BUY", on: ofOn("g_tl1"), blocked: regX && !negG, why: "Gamma dương: bộ lọc B1 chặn thủng/squeeze", lo: cw + tol, hi: cw + tol,
    cond: `nến đóng TRÊN ${ofFm(cw + tol)} (nến trước còn ở dưới), đủ xác nhận`, sl: `${ofFm(cw - buf)} (tường − ${buf}$)`, tp1: nextStrike(cw + tol, true), tp2: null, cancel: `giá quay lại dưới ${ofFm(cw)}` });
  try {
    const hz = hedgeSt(), zs = ((hz && hz.zones) || []).filter((z) => z.kind === "accel");
    zs.slice(0, 3).forEach((z, n) => add({ id: "hg" + n, short: "HG HEDGE", name: `HG · Vùng Hedge −Γ ${Math.round(z.lo)}–${Math.round(z.hi)}`, side: px > z.hi ? "BUY" : px < z.lo ? "SELL" : "BOTH", on: ofOn("g_hedge"), lo: z.lo, hi: z.hi,
      cond: px >= z.lo && px <= z.hi ? "giá ĐANG TRONG vùng nên CHƯA có điểm vào. Chờ giá ra khỏi vùng rồi quay lại chọc vào: chọc từ dưới lên rồi đóng ngược xuống = SELL; chọc từ trên xuống rồi đóng ngược lên = BUY (hoặc 2 nến đóng liên tiếp trong vùng = đi theo đà)" : px > z.hi ? "giá ở TRÊN vùng: chờ nến chọc xuống vùng rồi đóng ngược lên trên = BUY (trap), hoặc 2 nến đóng liên tiếp trong vùng theo chiều xuống = đi theo đà" : "giá ở DƯỚI vùng: chờ nến chọc lên vùng rồi đóng ngược xuống dưới = SELL (trap), hoặc 2 nến đóng liên tiếp trong vùng theo chiều lên = đi theo đà", sl: `cực trị 3 nến gần nhất ± ${buf}$`, tp1: "mốc OI kế tiếp", tp2: null, cancel: "nến đóng xuyên hẳn vùng" }));
  } catch { /* bỏ qua */ }
  // TVLB B9b1: "tường gần" của Bộ B (B10b): top 3 OI trong ±2,5% quanh giá. Giá mốc = giá MỞ của ngày giờ VN (xấp xỉ t0, chưa có giờ OI thật). Chỉ HIỂN THỊ, không phát tín hiệu.
  try {
    const o = ofX("x_near") ? prim() : null;
    if (o) {
      const day = vnDate(c[c.length - 1].time), f0 = c.find((x) => vnDate(x.time) === day), ref = f0 ? f0.open : px, unclear = flip == null || flipFar;   // v23u: "ngày không rõ" theo Ô TICK "Ngày Flip xa" (trước đây bỏ qua ô tick)
      o.strikes.filter((s) => Math.abs(s.chart / ref - 1) <= 0.025).sort((a, b) => (b.call_oi + b.put_oi) - (a.call_oi + a.put_oi)).slice(0, 3).forEach((s, n) => {
        const lvl = s.chart, up = lvl > px, brk = !unclear && negG, side = brk ? (up ? "BUY" : "SELL") : (up ? "SELL" : "BUY"), oi = s.call_oi + s.put_oi;
        add({ id: (brk ? "nwb" : "nwa") + n, short: brk ? "9B TƯỜNG GẦN" : "9A TƯỜNG GẦN", name: `${brk ? "9B phá vỡ (Gamma âm)" : "9A bật lại (Gamma dương)"} · tường gần ${ofFm(lvl)} (OI ${fmtK(oi)})`, side, on: true, blocked: unclear, why: "Flip xa > 2,5% (ngày không rõ): B10b đứng ngoài", zone: "tường gần", lo: lvl * 0.999, hi: lvl * 1.001,
          cond: brk ? "nến M5 đóng vượt tường ≥ 0,15% và thân nến lớn hơn trung bình 10 nến M5 trước, vào ở giá mở nến kế" : "chạm vùng ±0,10% quanh tường, trong 3 nến M5 có 1 nến đóng quay ngược ≥ 0,10% từ tường (chưa đóng xuyên quá 0,10%), vào ở giá mở nến kế · chỉ lần chạm đầu trong phiên",
          sl: "0,30% từ giá vào", tp1: "0,60% từ giá vào (R:R 1:2)", tp2: null, cancel: "nến đóng xuyên tường quá 0,10% hoặc 12:30 Chicago" });
      });
    }
  } catch { /* bỏ qua */ }
  const avg = c.slice(i - sc.vol_sma, i).reduce((a, x) => a + x.vol, 0) / sc.vol_sma, slope = k.cvd - c[i - sc.cvd_slope_bars].cvd, doi = nearDoi(k.close);
  // TVLB B9b1/v23o: đếm điều kiện đạt x/y cho từng kế hoạch = hình thái nến + số xác nhận TỐI THIỂU cần + cổng. Tính trên nến ĐÃ ĐÓNG gần nhất (giống evaluate). Chỉ hiển thị.
  // v23o: tách thành mkCtx(j) + chkFor(p, X) để dùng lại cho nến quá khứ (đánh dấu nến quan sát). Với nến cuối (live) kết quả giữ NGUYÊN như v23n (trừ điều kiện "quay ngược" của 9A).
  let watchAt = null;
  try {
    const minC = Number.isInteger(OFS.minConf) ? OFS.minConf : sc.min_confirm;
    const mkCtx = (j, hist) => {
      const kk = c[j], pv = c[j - 1], q2 = c[j - 2], dx = S.state?.macro?.DXY?.chg_n_pct ?? 0;
      const av = c.slice(j - sc.vol_sma, j).reduce((a, x) => a + x.vol, 0) / sc.vol_sma, sl = kk.cvd - c[j - sc.cvd_slope_bars].cvd, dd = nearDoi(kk.close);
      const vs = av > 0 && kk.vol >= sc.vol_spike_mult * av;
      return { k: kk, prev: pv, p2: q2, slope: sl, d0: divAt(j), d1: divAt(j - 1), dUp: dx >= sc.dxy_thr_pct, dDn: dx <= -sc.dxy_thr_pct, vSp: vs, dFlat: !!dd && dd.d_oi <= 0, dBig: !!dd && Math.abs(dd.d_oi) >= sc.doi_big,
        bf: hist ? bigFlowAt(j, sc.cvd_slope_bars) : bigFlow(sc.cvd_slope_bars), swp: (S.smc?.sweeps || []).some((w) => w.i >= j - 2 && w.i <= j),
        bod: c.slice(j - 10, j).reduce((a, x) => a + Math.abs(x.close - x.open), 0) / 10, lo3: Math.min(kk.low, pv.low, q2.low), hi3: Math.max(kk.high, pv.high, q2.high),
        a: hist ? j : j - 2, b: hist ? Math.min(j + 2, c.length - 2) : j, inS: hist ? inUsSession(kk.time) : inS, cdOk: hist ? !S.signals.some((g) => g.i <= j && j - g.i <= sc.cooldown_bars) : cdOk };
    };
    const chkFor = (p, X) => {
      const { k, prev, p2, slope, d0, d1, dUp, dDn, vSp, dFlat, dBig, bf, swp, bod, lo3, hi3, inS, cdOk } = X;   // X.a..X.b = cửa sổ nến (9A)
      const id = p.id, sell = p.side === "SELL", nw = /^nw/.test(id), lvl = (p.lo + p.hi) / 2;
      if (/^hg/.test(id) && p.side === "BOTH") return { ok: 0, tot: 0, shape: [], conf: [], gate: [], need: 0, note: "giá đang TRONG vùng: chưa có điểm vào, chờ giá ra khỏi vùng rồi quay lại" };
      let shape = [], conf = [];
      if (id === "ts") { shape = [[k.high >= cw - tol, `Nến chạm vùng (cao nhất ≥ ${ofFm(cw - tol)})`], [k.close < cw, "Nến đóng dưới tường"], [k.close < k.open, "Nến giảm"]]; conf = [["Phân kỳ CVD âm", d0.bear || d1.bear], ["CVD dốc xuống", slope < 0], ["DXY tăng", dUp], ["Volume spike", vSp], ["Vol↑ mà ΔOI≤0", vSp && dFlat], ["ΔOI≥1500 tại vùng", dBig]]; }
      else if (id === "tb") { shape = [[k.low <= pw + tol, `Nến chạm vùng (thấp nhất ≤ ${ofFm(pw + tol)})`], [k.close > pw, "Nến đóng trên tường"], [k.close > k.open, "Nến tăng"]]; conf = [["Phân kỳ CVD dương", d0.bull || d1.bull], ["CVD dốc lên", slope > 0], ["DXY giảm", dDn], ["Volume spike", vSp], ["Vol↑ mà ΔOI≤0", vSp && dFlat], ["ΔOI≥1500 tại vùng", dBig]]; }
      else if (id === "bd") { shape = [[k.close < pw - tol, `Nến đóng dưới ${ofFm(pw - tol)}`], [prev.close >= pw - tol, "Nến trước còn ở trên"]]; conf = [["CVD dốc xuống", slope < 0], ["Delta nến âm", k.delta < 0], ["DXY tăng", dUp], ["Volume spike", vSp]]; }
      else if (id === "sq") { shape = [[k.close > cw + tol, `Nến đóng trên ${ofFm(cw + tol)}`], [prev.close <= cw + tol, "Nến trước còn ở dưới"]]; conf = [["CVD dốc lên", slope > 0], ["Delta nến dương", k.delta > 0], ["DXY giảm", dDn], ["Volume spike", vSp]]; }
      else if (/^hg/.test(id)) {
        if (sell) { shape = [[hi3 >= p.lo, "Nến chọc lên vùng (cao nhất 3 nến ≥ mép dưới)"], [k.close < p.lo, "Nến đóng dưới vùng"], [k.close < k.open, "Nến giảm"]]; conf = [["CVD dốc xuống", slope < 0], ["Delta nến âm", k.delta < 0], ["Nến quét thanh khoản", swp], ["DXY tăng", dUp], ["Volume spike", vSp]]; }
        else { shape = [[lo3 <= p.hi, "Nến chọc xuống vùng (thấp nhất 3 nến ≤ mép trên)"], [k.close > p.hi, "Nến đóng trên vùng"], [k.close > k.open, "Nến tăng"]]; conf = [["CVD dốc lên", slope > 0], ["Delta nến dương", k.delta > 0], ["Nến quét thanh khoản", swp], ["DXY giảm", dDn], ["Volume spike", vSp]]; }
      } else if (/^nwa/.test(id)) {   // v23q: theo B10b, xét CỬA SỔ 3 nến M5 (không phải 1 nến): chạm vùng, rồi trong 3 nến có 1 nến đóng quay ngược, và chưa đóng xuyên quá 0,10%
        const tch = (x) => (sell ? x.high >= p.lo : x.low <= p.hi), rv = (x) => (sell ? x.close <= lvl * 0.999 : x.close >= lvl * 1.001), thr = (x) => (sell ? x.close > lvl * 1.001 : x.close < lvl * 0.999);
        let f = -1; for (let m = X.a; m <= X.b; m++) if (tch(c[m])) { f = m; break; }
        // quét lần lượt từ nến chạm, TỐI ĐA 3 nến (1, 2 hoặc 3): gặp nến đóng xuyên qua tường trước → hỏng; gặp nến đóng quay ngược → ĐẠT và dừng (các nến sau không còn liên quan)
        let st = f < 0 ? "none" : "wait", r = -1;
        if (f >= 0) for (let m = f; m <= Math.min(f + 2, X.b); m++) { if (thr(c[m])) { st = "through"; break; } if (rv(c[m])) { st = "rev"; r = m; break; } }
        if (st === "wait" && f + 2 <= X.b) st = "expired";
        const rvTxt = "Có nến đóng quay ngược ≥ 0,10% từ tường (trong 1–3 nến kể từ nến chạm" + (st === "rev" ? `; đạt ở nến thứ ${r - f + 1}` : st === "wait" ? `; mới ${X.b - f + 1} nến, còn chờ` : st === "expired" ? "; đã hết 3 nến mà chưa có" : "") + ")";
        shape = [[f >= 0, "Chạm vùng ±0,10% quanh tường"], [st === "rev", rvTxt], [f >= 0 && st !== "through", "Chưa đóng xuyên quá 0,10% qua tường (trước nến quay ngược)"]];
        // v23s: xác nhận theo MENU (cùng bộ với bẫy TL1·2; B10b gốc không có xác nhận, đây là phần gắn thêm theo yêu cầu: điều kiện phải theo menu)
        conf = sell ? [["Phân kỳ CVD âm", d0.bear || d1.bear], ["CVD dốc xuống", slope < 0], ["DXY tăng", dUp], ["Volume spike", vSp], ["Vol↑ mà ΔOI≤0", vSp && dFlat], ["ΔOI≥1500 tại vùng", dBig]] : [["Phân kỳ CVD dương", d0.bull || d1.bull], ["CVD dốc lên", slope > 0], ["DXY giảm", dDn], ["Volume spike", vSp], ["Vol↑ mà ΔOI≤0", vSp && dFlat], ["ΔOI≥1500 tại vùng", dBig]];
      }
      else if (/^nwb/.test(id)) { shape = [[sell ? k.close <= lvl * 0.9985 : k.close >= lvl * 1.0015, "Nến đóng vượt tường ≥ 0,15%"], [Math.abs(k.close - k.open) > bod, "Thân nến lớn hơn trung bình 10 nến trước"]];
        conf = sell ? [["CVD dốc xuống", slope < 0], ["Delta nến âm", k.delta < 0], ["DXY tăng", dUp], ["Volume spike", vSp]] : [["CVD dốc lên", slope > 0], ["Delta nến dương", k.delta > 0], ["DXY giảm", dDn], ["Volume spike", vSp]];   // v23s: xác nhận theo menu
      }
      if ((bf && (nw || ["ts", "tb", "bd", "sq"].includes(id))) || (/^hg/.test(id) && bf)) conf.push([sell ? "Lệnh lớn bán ròng" : "Lệnh lớn mua ròng", sell ? bf.d < 0 : bf.d > 0]);
      conf = conf.filter(([n]) => ofOn("c:" + n));   // điều kiện bị tắt thì không tính (giống mkSig)
      const gate = [];
      gate.push([tfOk, "Khung nến ≥ M5"]); if (sessOn) gate.push([inS, "Trong phiên Mỹ 19:00-23:00 VN"]); if (!nw) gate.push([cdOk, "Hết nghỉ sau tín hiệu trước"]);   // v23s
      if (ofX("x_flipfar")) gate.push([!flipFar, "Flip không xa quá 2,5%"]);
      if (typeof p.blocked === "boolean" && !nw) gate.push([!p.blocked, "Chế độ Gamma cho phép"]);   // v23u: 9A/9B bị chặn vì Flip xa đã có dòng cổng Flip riêng, không lặp lại
      if (nw && flip == null) gate.push([false, "Có mốc Gamma Flip"]);
      const cOk = conf.filter((x) => x[1]).length, need = minC;   // v23v: đúng như engine (score >= minConf): ít ô tick hơn mức tối thiểu thì KHÔNG BAO GIỜ đủ
      // v23t: số x/y hiển thị bên ngoài = các ô XÁC NHẬN đang tick trong menu (không cộng hình thái + cổng như v23s). Hình thái và cổng vẫn bắt buộc: "full" = đủ cả ba.
      const shOk = shape.filter((x) => x[0]).length, gOk = gate.filter((x) => x[0]).length, xOk = Math.min(cOk, need), full = shOk === shape.length && cOk >= need && gOk === gate.length;
      return { shape, conf, gate, need, cOk, xOk, shOk, gOk, full, time: k.time, ok: shOk + xOk + gOk, tot: shape.length + need + gate.length };   // v23v: ok/tot chỉ để biết có dữ liệu; hiển thị luôn dùng ofSum(h)
    };
    plans.forEach((p) => { p.chk = chkFor(p, mkCtx(i, false)); });
    watchAt = (j) => { const X = mkCtx(j, true); return plans.map((p) => ({ p, chk: chkFor(p, X) })); };
  } catch (e) { /* bỏ qua */ }
  return { px, cw, pw, flip, negG, blockG, rgp, flipFar, tol, gates, gatesOk, plans, k, avg, slope, doi, sc, watchAt };
}
// ── TVLB B9b0: hình minh họa mini cho từng kế hoạch (SVG, không theo tỉ lệ giá) ──
function ofIllu(p, nocap) {
  const W = 300, H = 108, flip = p.side === "BUY", Y = (y) => (flip ? H - y : y), up = "#26a69a", dn = "#ef5350";
  const kind = p.id === "ts" || p.id === "tb" || /^nwa/.test(p.id) ? "trap" : p.id === "bd" || p.id === "sq" || /^nwb/.test(p.id) ? "break" : "hedge";
  const cd = (x, o, h, l, c) => { const col = Y(c) < Y(o) ? up : dn, t = Math.min(Y(o), Y(c)); return `<line x1="${x}" x2="${x}" y1="${Y(h)}" y2="${Y(l)}" stroke="${col}" stroke-width="1.8"/><rect x="${x - 6}" y="${t}" width="12" height="${Math.max(2, Math.abs(Y(c) - Y(o)))}" fill="${col}"/>`; };
  const ln = (y, col, txt, dash, x2 = 152) => `<line x1="6" x2="${x2}" y1="${Y(y)}" y2="${Y(y)}" stroke="${col}" stroke-width="1" ${dash ? 'stroke-dasharray="4 3"' : ""}/><text x="${x2 + 5}" y="${Y(y) + 3}" font-size="10.5" fill="${col}">${txt}</text>`;
  const wick = flip ? "đáy" : "đỉnh", wallName = p.zone || (p.id === "ts" || p.id === "sq" ? "Call Wall" : "Put Wall"), G = "#9aa4b2";
  let g = "";
  if (kind === "trap") {
    g += ln(30, G, `${wallName} (tường)`) + ln(14, dn, `SL = ${wick} râu + 3$`, true) + ln(50, "#f0b429", "vào lệnh (đóng nến)", true) + ln(74, up, "TP1: mốc OI kế", true) + ln(92, up, "TP2: tường đối diện", true);
    g += cd(30, 66, 62, 68, 60) + cd(50, 60, 52, 62, 54) + cd(70, 54, 42, 56, 44) + cd(90, 36, 20, 52, 50) + cd(110, 50, 48, 62, 60) + cd(130, 60, 58, 74, 72) + cd(150, 72, 70, 84, 82);
    g += `<text x="8" y="${flip ? H - 3 : 9}" font-size="10.5" fill="#cfd6e0">râu chọc qua tường</text>`;
  } else if (kind === "break") {
    g += ln(54, G, `${wallName} (tường)`) + ln(42, dn, "SL = tường + 3$", true) + ln(70, "#f0b429", "vào lệnh (đóng nến)", true) + ln(90, up, "TP1: mốc OI kế", true);
    g += cd(30, 28, 24, 34, 32) + cd(50, 32, 30, 42, 40) + cd(70, 40, 38, 54, 50) + cd(90, 48, 46, 74, 70) + cd(110, 70, 68, 84, 82) + cd(130, 82, 80, 90, 88);
    g += `<text x="8" y="${flip ? H - 3 : 9}" font-size="10.5" fill="#cfd6e0">nến ĐÓNG xuyên tường</text>`;
  } else {
    g += `<rect x="6" y="${Math.min(Y(48), Y(66))}" width="146" height="18" fill="rgba(240,180,41,.14)" stroke="rgba(240,180,41,.5)" stroke-dasharray="3 3"/><text x="157" y="${Y(57) + 3}" font-size="10.5" fill="#f0b429">vùng Hedge −Γ</text>`;
    g += ln(34, dn, "SL = cực trị 3 nến ± 3$", true) + ln(78, "#f0b429", "vào lệnh (đóng nến)", true) + ln(96, up, "TP1: mốc OI kế", true);
    g += cd(30, 86, 82, 88, 84) + cd(50, 84, 78, 86, 80) + cd(70, 80, 72, 82, 74) + cd(90, 70, 50, 78, 76) + cd(110, 76, 74, 90, 88);
    g += `<text x="8" y="${flip ? H - 3 : 9}" font-size="10.5" fill="#cfd6e0">râu chọc vào vùng</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:460px;display:block;margin:4px 0 2px;border-radius:4px" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">${g}</svg>${nocap ? "" : '<div class="muted" style="font-size:10.5px">Hình minh họa tình huống (không theo tỉ lệ giá). Xanh = nến tăng, đỏ = nến giảm.</div>'}`;
}
// ── TVLB B9b0: thêm hình minh họa vào ghi chú rê chuột (tường) và vào thẻ KH1-KH3 của trang ③ Vào lệnh ──
function ofIlluPair(fade) {
  const brk = fade === "SELL" ? "BUY" : "SELL";
  const small = (h) => h.replace("max-width:460px", "max-width:100%").replace("margin:4px 0 2px", "margin:2px 0 0");
  const box = (t, p) => `<div style="flex:1 1 220px;min-width:0"><b style="font-size:11px">${t}</b>${small(ofIllu(p, true))}</div>`;
  return `<div data-ofillu="1" style="margin:4px 0 6px"><div style="display:flex;flex-wrap:wrap;gap:8px">`
    + box(`Chính: ${fade} (chạm rồi đóng ngược)`, { id: fade === "SELL" ? "ts" : "tb", side: fade, zone: "vùng tường" })
    + box(`Phá: ${brk} (đóng xuyên vùng, huỷ ${fade})`, { id: brk === "SELL" ? "bd" : "sq", side: brk, zone: "vùng tường" })
    + `</div><div class="muted" style="font-size:10px">Hình minh họa (không theo tỉ lệ giá). Xanh = nến tăng, đỏ = nến giảm.</div></div>`;
}
const ofNorm = (t) => String(t || "").normalize("NFC").replace(/ /g, " ");
// Hình minh họa cho ghi chú "Vùng HEDGE −Γ": giá đi vào vùng thì dealer phải hedge CÙNG chiều giá → đẩy giá chạy nhanh hơn
function ofIlluHedgeTip() {
  const W = 300, H = 108, up = "#26a69a", dn = "#ef5350", gold = "#f0b429";
  const cd = (x, o, h, l, c) => { const col = c < o ? up : dn, t = Math.min(o, c); return `<line x1="${x}" x2="${x}" y1="${h}" y2="${l}" stroke="${col}" stroke-width="1.8"/><rect x="${x - 6}" y="${t}" width="12" height="${Math.max(3, Math.abs(c - o))}" fill="${col}"/>`; };
  const fig = (dir) => {
    const upc = dir === "up", X = [18, 36, 54, 72, 90, 108];
    let g = `<rect x="6" y="40" width="114" height="28" fill="rgba(240,180,41,.14)" stroke="rgba(240,180,41,.55)" stroke-dasharray="3 3"/>`;
    const tx = (y, col, t) => `<text x="130" y="${y}" font-size="10.5" fill="${col}">${t}</text>`;
    if (upc) {
      const c = [[94, 90, 98, 90], [88, 82, 92, 84], [82, 70, 86, 72], [70, 52, 74, 54], [54, 36, 58, 38], [38, 18, 42, 22]];
      c.forEach((v, i) => { g += cd(X[i], ...v); });
      g += tx(26, gold, "vùng Hedge −Γ") + tx(46, up, "giá đi LÊN vào vùng") + tx(66, gold, "dealer phải MUA đuổi theo") + tx(86, "#cfd6e0", "→ giá chạy lên nhanh hơn");
    } else {
      const c = [[14, 10, 20, 18], [20, 16, 30, 28], [28, 24, 44, 40], [40, 36, 62, 58], [58, 54, 80, 76], [76, 72, 96, 92]];
      c.forEach((v, i) => { g += cd(X[i], ...v); });
      g += tx(26, gold, "vùng Hedge −Γ") + tx(46, dn, "giá đi XUỐNG vào vùng") + tx(66, gold, "dealer phải BÁN đuổi theo") + tx(86, "#cfd6e0", "→ giá rơi xuống nhanh hơn");
    }
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:100%;display:block;margin:2px 0 0;border-radius:4px" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">${g}</svg>`;
  };
  return `<div data-ofillu="1" style="margin:4px 0 6px"><b style="font-size:11px">Hình minh họa: vì sao vùng này làm giá chạy nhanh</b>`
    + `<div style="display:flex;flex-wrap:wrap;gap:8px"><div style="flex:1 1 220px;min-width:0">${fig("up")}</div><div style="flex:1 1 220px;min-width:0">${fig("down")}</div></div>`
    + `<div class="muted" style="font-size:10px">Minh họa ý tưởng (không theo tỉ lệ giá, không phải dòng lệnh thật).</div></div>`;
}
// tìm khung ghi chú nổi (position fixed/absolute) chứa phần tử el
function ofTipRoot(el) {
  for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    const ps = getComputedStyle(n).position;
    if (ps === "fixed" || ps === "absolute") return n;
  }
  return null;
}
const OF_TIPS = new Set();
// kẹp ghi chú nằm gọn trong màn hình: cao quá thì thu nhỏ, tràn đáy/phải thì đẩy lên/trái
function ofFitTip(el) {
  if (!el || !el.isConnected) { OF_TIPS.delete(el); return; }
  const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") return;
  el.style.setProperty("pointer-events", "none");
  el.style.removeProperty("translate"); el.style.removeProperty("zoom");
  let r = el.getBoundingClientRect(); const vh = window.innerHeight, vw = window.innerWidth, M = 6;
  if (r.width > vw * 0.75) { OF_TIPS.delete(el); return; }
  let z = 1; if (r.height > vh - 2 * M) { z = Math.max(0.5, (vh - 2 * M) / r.height); el.style.setProperty("zoom", String(z)); r = el.getBoundingClientRect(); }
  let dy = 0, dx = 0;
  if (r.bottom > vh - M) dy = vh - M - r.bottom;
  if (r.top + dy < M) dy = M - r.top;
  if (r.right > vw - M) dx = vw - M - r.right;
  if (r.left + dx < M) dx = M - r.left;
  if (dx || dy) el.style.setProperty("translate", `${dx / z}px ${dy / z}px`);
}
function ofFitAll() { OF_TIPS.forEach(ofFitTip); }
// bỏ số tròn ①②③… đứng đầu tên các nút menu trang (và cột chữ dọc bên phải)
const OF_NUMRE = /^[\s①-⑳⓪⓵-⓾❶-➓㉑-㉟]+|^\s*\(?\d{1,2}[.)]\s+/;
function ofStripNums() {
  for (const b of document.querySelectorAll('#pgbar button, .wrail button')) {
    for (const n of b.childNodes) if (n.nodeType === 3 && OF_NUMRE.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(OF_NUMRE, "");
    if (b.title && OF_NUMRE.test(b.title)) b.title = b.title.replace(OF_NUMRE, "");
  }
}
function ofScanTip() {
  // ghi chú vùng HEDGE: chưa có hình → chèn hình trước dòng "Lưu ý"
  const wh = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (/^\s*Vùng HEDGE/.test(ofNorm(t.nodeValue)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  let hn;
  while ((hn = wh.nextNode())) {
    const root = ofTipRoot(hn.parentElement); if (!root) continue;
    OF_TIPS.add(root);
    if (root.querySelector("[data-ofillu]")) continue;
    let note = null;
    for (const el of root.querySelectorAll("div,p,span,b")) if (/^\s*Lưu ý/.test(ofNorm(el.textContent)) && el.children.length < 3 && !el.querySelector("div")) { note = el; break; }
    // nếu "Lưu ý" nằm trong khối riêng, chèn trước khối đó
    if (note) { let t = note; while (t.parentElement && t.parentElement !== root && t.parentElement.children.length === 1) t = t.parentElement; t.insertAdjacentHTML("beforebegin", ofIlluHedgeTip()); }
    else root.insertAdjacentHTML("beforeend", ofIlluHedgeTip());
  }
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (/Uy tín tường/.test(ofNorm(t.nodeValue)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  let tn;
  while ((tn = w.nextNode())) {
    let h = tn.parentElement; if (!h || h.closest("[data-ofillu]")) continue;
    while (h.parentElement && /^\s*2\.\s*Uy tín tường/.test(ofNorm(h.parentElement.textContent))) h = h.parentElement;
    if (!/^\s*2\.\s*Uy tín tường/.test(ofNorm(h.textContent))) continue;
    if (h.previousElementSibling && h.previousElementSibling.dataset && h.previousElementSibling.dataset.ofillu) continue;
    let root = h; for (let k = 0; k < 6 && root && !/1\.\s*Tình huống/.test(ofNorm(root.textContent)); k++) root = root.parentElement;
    const txt = ofNorm(root ? root.textContent : ""), a = txt.search(/1\.\s*Tình huống/), b = txt.search(/2\.\s*Uy tín/);
    const m = a >= 0 && b > a ? /canh (BUY|SELL)/.exec(txt.slice(a, b)) : null; if (!m) continue;
    h.insertAdjacentHTML("beforebegin", ofIlluPair(m[1]));
  }
  for (const e of document.querySelectorAll("[data-ofillu]")) { const r = ofTipRoot(e); if (r && !r.closest("#v3plan, .right")) OF_TIPS.add(r); }
  ofFitAll(); ofStripNums();
}
function ofDecorateKH() {
  for (const card of document.querySelectorAll("#v3plan .v3c")) {
    if (card.querySelector("[data-ofillu]")) continue;
    const kt = card.querySelector(".kt"), t = kt ? kt.textContent : "", m = /(SELL|BUY)/.exec(t); if (!m) continue;
    const side = m[1], brk = /KH2/.test(t) || /theo hướng phá/.test(t);
    const id = brk ? (side === "SELL" ? "bd" : "sq") : (side === "SELL" ? "ts" : "tb");
    card.insertAdjacentHTML("beforeend", `<div data-ofillu="1">${ofIllu({ id, side, zone: "vùng KH" })}</div>`);
  }
}
// Thu gọn cụm menu trên cùng: chữ nhỏ lại + bỏ khoảng trống thừa (chạy lặp vì một số phần tử dựng muộn)
function ofShrinkTop() {
  const z = (el, f) => { if (el) el.style.setProperty("zoom", f, "important"); };
  const ai = $("#btnAI"), tfs = $("#tfs"); if (!ai || !tfs) return;
  const hdr = ai.closest("header") || ai.parentElement;
  if (!hdr.dataset.ofz) { hdr.dataset.ofz = "1"; z(hdr, 0.88); hdr.style.setProperty("padding-top", "2px", "important"); hdr.style.setProperty("padding-bottom", "2px", "important"); }
  const bar2 = tfs.parentElement; if (!bar2.dataset.ofz) { bar2.dataset.ofz = "1"; z(bar2, 0.9); bar2.style.setProperty("margin", "0", "important"); bar2.style.setProperty("padding-top", "1px", "important"); bar2.style.setProperty("padding-bottom", "1px", "important"); }
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (/^\s*GC: CME|^\s*GC:/.test(ofNorm(t.nodeValue)) && t.parentElement && t.parentElement.getBoundingClientRect().top < 260 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  const tn = w.nextNode(), info = tn && tn.parentElement;
  if (info && !info.dataset.ofz) { info.dataset.ofz = "1"; z(info, 0.9); info.style.setProperty("margin-top", "0", "important"); info.style.setProperty("margin-bottom", "0", "important"); info.style.setProperty("padding-top", "1px", "important"); info.style.setProperty("padding-bottom", "1px", "important"); }
  // các phần tử rỗng nằm giữa dòng thông báo và hàng khung giờ: bỏ chiều cao thừa
  let P = info || bar2; while (P && !(P.contains(bar2) && P.contains(info || bar2))) P = P.parentElement;
  if (P && info) {
    let a = info; while (a.parentElement && a.parentElement !== P) a = a.parentElement;
    let b = bar2; while (b.parentElement && b.parentElement !== P) b = b.parentElement;
    for (let el = a.nextElementSibling; el && el !== b; el = el.nextElementSibling) if (!ofNorm(el.textContent).trim()) { el.style.setProperty("min-height", "0", "important"); el.style.setProperty("padding", "0", "important"); el.style.setProperty("margin", "0", "important"); el.style.setProperty("height", "auto", "important"); }
    for (const el of [a, b]) if (el !== P) { el.style.setProperty("margin-top", "0", "important"); el.style.setProperty("margin-bottom", "0", "important"); }
  }
}
function ofStartDecor() {
  // thẻ KH trang ③: chèn hình NGAY trong lúc trang vẽ lại (trước khi trình duyệt tô màu) nên không còn nháy
  const hook = () => { const el = document.getElementById("v3plan"); if (!el || el.dataset.ofobs) return !!el; el.dataset.ofobs = "1"; new MutationObserver(() => ofDecorateKH()).observe(el, { childList: true, subtree: true }); ofDecorateKH(); return true; };
  const t0 = setInterval(() => { if (hook()) clearInterval(t0); }, 700);
  // ghi chú rê chuột: quét nhanh, chuẩn hoá Unicode
  let scT = 0; new MutationObserver(() => { if (scT) return; scT = setTimeout(() => { scT = 0; ofScanTip(); }, 80); }).observe(document.body, { childList: true, subtree: true });
  setInterval(ofScanTip, 500);
  let fT = 0; document.addEventListener("mousemove", () => { if (fT || !OF_TIPS.size) return; fT = requestAnimationFrame(() => { fT = 0; ofFitAll(); }); }, true);
  [1500, 4000, 9000].forEach((ms) => setTimeout(ofShrinkTop, ms));
}
const OF_COL = { SELL: "#ef5350", BUY: "#26a69a", BOTH: "#f0b429" };
// TVLB B9b1: chip "x/y" và danh sách điều kiện của một kế hoạch
// v23v: MỘT cách hiển thị duy nhất cho mọi nơi (nhãn vùng, danh sách, nhãn nến, thẻ, chú giải, tab): H = hình thái nến (quy tắc kế hoạch) · X = xác nhận (ô tick trong menu, cần ≥ "Số xác nhận tối thiểu") · C = cổng (M5, Flip xa, Gamma, phiên…).
// ✔ = đủ cả ba (đủ điều kiện) · ◉ = đang theo dõi · ⛔ = có cổng chưa qua (đứng ngoài).
const ofSym = (h) => (h.full ? "✔" : h.gOk < h.gate.length ? "⛔" : "◉");
const ofSum = (h) => (h && h.tot ? `H${h.shOk}/${h.shape.length} ${h.need > 0 ? "X" + h.xOk + "/" + h.need : "X–"} ${h.gate.length ? "C" + h.gOk + "/" + h.gate.length : "C–"}` : "");
const ofSimple = (h) => { if (!h || !h.tot) return ""; return `${h.full ? "✔ " : h.gOk < h.gate.length ? "⛔ " : ""}${h.shOk + h.xOk}/${h.shape.length + h.need}`; };
const ofColH = (h) => (h.full ? "#26b384" : h.gOk < h.gate.length ? "#9aa4b2" : "#f0b429");
const ofXNote = (h) => `đang tick ${h.conf.length} ô, đạt ${h.cOk}, cần ≥ ${h.need}${h.conf.length < h.need ? " → tick thêm ô hoặc hạ số tối thiểu (hiện KHÔNG BAO GIỜ đủ)" : ""}`;
function ofChip(p) {
  const h = p.chk; if (!h) return "";
  if (!h.tot) return `<span title="${h.note || ""}" style="font:700 10.5px/1 monospace;padding:2px 5px;border-radius:4px;background:rgba(255,255,255,.08);color:#9aa4b2">—</span>`;
  const col = ofColH(h);
  return `<span title="Số điều kiện đạt / cần (hình thái nến + xác nhận trong menu), tính trên nến vừa đóng. ⛔ = cổng chưa qua · ✔ = đủ. Bấm kế hoạch để xem chi tiết." style="font:700 8px/1 monospace;white-space:nowrap;padding:2px 3px;border-radius:4px;background:rgba(255,255,255,.08);color:${col};border:1px solid ${col}55">${ofSimple(h)}</span>`;
}
function ofChkHtml(p) {
  const h = p.chk; if (!h) return "";
  if (!h.tot) return `<div class="muted" style="font-size:11px;margin:3px 0">${h.note || ""}</div>`;
  const li = (a, rev) => a.map((x) => { const ok = rev ? x[1] : x[0], t = rev ? x[0] : x[1]; return `<div style="color:${ok ? "#26b384" : "#85909c"}">${ok ? "✔" : "✘"} ${t}</div>`; }).join("");
  const cnt = (a) => a.filter((x) => x[0]).length, open = !!(OFV.chk && OFV.chk[p.id]);
  return `<div style="font-size:11px;margin:4px 0 4px 6px"><div data-ofchk="${p.id}" style="cursor:pointer;user-select:none;color:#f0b429" title="Bấm để sổ xuống / thu gọn danh sách điều kiện">${open ? "▾" : "▸"} <b>${ofSimple(h)}</b> · ${h.full ? '<b style="color:#26b384">ĐỦ ĐIỀU KIỆN</b>' : "chưa đủ"} <span class="muted">${open ? "(bấm để thu gọn)" : "(bấm để xem chi tiết)"}</span></div>`
    + (open ? `<div style="padding-left:8px;margin-top:3px;border-left:2px solid rgba(255,255,255,.12)"><div class="muted">Tính theo nến ${S.tf} đóng lúc ${vnClock(h.time)}. <b>${ofSum(h)}</b> (H hình thái · X xác nhận · C cổng). Vào lệnh khi đủ cả 3 nhóm.</div>`
      + (h.shape.length ? `<div class="muted" style="margin-top:3px">H · Hình thái nến ${cnt(h.shape)}/${h.shape.length}</div>${li(h.shape)}` : "")
      + (h.conf.length || h.need > 0 ? `<div class="muted" style="margin-top:3px">X · Xác nhận (menu): ${ofXNote(h)}</div>${li(h.conf, true)}` : "")
      + (h.gate.length ? `<div class="muted" style="margin-top:3px">C · Cổng ${cnt(h.gate)}/${h.gate.length}</div>${li(h.gate)}` : "") + `</div>` : "") + `</div>`;
}
document.addEventListener("click", (e) => { const t = e.target.closest && e.target.closest("[data-ofchk]"); if (!t) return; OFV.chk = OFV.chk || {}; OFV.chk[t.dataset.ofchk] = !OFV.chk[t.dataset.ofchk]; try { ofRender(); } catch (x) { /* bỏ qua */ } });
function ofBadge(st, side) {
  // xám = chưa thoả / bị chặn; sáng lên theo màu BUY (xanh) / SELL (đỏ) / BOTH (vàng) khi kế hoạch đang hoạt động
  const live = st === "SẴN SÀNG" || st === "GẦN" || st === "TRONG VÙNG" || st === "XÁC NHẬN", col = live ? (OF_COL[side] || "#f0b429") : "#7d8796";
  return `<span style="display:inline-block;white-space:nowrap;font:700 8px/1 monospace;padding:2px 2px;border-radius:3px;color:${col};background:${live ? col + "22" : "transparent"};border:1px solid ${col}${live ? "" : "66"}">${st}</span>`;
}
// v23o: NẾN ĐANG QUAN SÁT. Với mỗi nến đã đóng HÔM NAY, kiểm từng kế hoạch (trừ HG): bẫy TL1·2 và 9A = nến chạm vùng (lần chạm đầu của một đợt);
// TL1 Thủng/Squeeze = nến đóng xuyên tường (nến trước còn bên kia); 9B = nến đóng vượt ≥0,15% và thân lớn. Gắn x/y của nến đó. Tính theo MỐC TƯỜNG và CHẾ ĐỘ GAMMA HIỆN TẠI. Chỉ hiển thị.
function ofWatchList(M0) {
  if (!ofOn("watch")) return [];
  const M = M0 || ofModel(); if (!M || !M.watchAt) return [];
  const c = S.candles, sc = S.cfg.signals, day = vnDate(c[c.length - 1].time), j0 = Math.max(sc.vol_sma, sc.cvd_slope_bars, sc.div_lookback + 1, 12) + 2, out = [], was = {};
  for (let j = j0; j <= c.length - 2; j++) {
    if (vnDate(c[j].time) !== day) continue;
    const k = c[j];
    for (const { p, chk } of M.watchAt(j)) {
      if (!p.on || /^hg/.test(p.id) || !chk || !chk.tot) continue;
      const ev = /^(ts|tb|nwa)/.test(p.id) ? k.high >= p.lo && k.low <= p.hi : chk.shape.length >= 2 && chk.shape[0][0] && chk.shape[1][0];
      const was1 = was[p.id]; was[p.id] = ev;
      if (ev) out.push({ j, time: k.time, p, chk, tot: chk.tot, first: !was1 });   // first = nến đầu của một đợt; các nến sau trong cùng đợt cũng được chấm (chấm nhỏ)
    }
  }
  return out;
}
// v23t: ký hiệu NẾN QUAN SÁT vẽ trên lớp overlay (cùng lớp với nhãn VAH/POC/VAL, vùng HG), không dùng setMarkers của biểu đồ.
// ◉ vàng = nến chạm vùng, kèm x/y = số ô XÁC NHẬN (tick trong menu) đạt / số ô đang tick · ✔ = đủ hình thái + xác nhận tối thiểu + cổng. Chỉ hiển thị, không phải lệnh.
function ofWatchCached() {
  const c = S.candles; if (!c || c.length < 30) return [];
  const key = [c.length, c[c.length - 1].time, c[c.length - 1].close, S.tf, JSON.stringify(OFS)].join("|"), now = Date.now();
  if (S.watchC && S.watchC.key === key && now - S.watchC.t < 5000) return S.watchC.list;
  let list = []; try { list = ofWatchList(ofModel()); S.watchErr = null; } catch (e) { S.watchErr = String(e && e.message || e); }
  S.watchC = { key, t: now, list }; S.watchN = list.filter((w) => w.first).length; return list;
}
function ofWatchTip(w) {
  const h = w.chk, col = w.chk.full ? (w.p.side === "SELL" ? "#ef5350" : "#26a69a") : ofColH(w.chk), li = (a, rev) => a.map((x) => { const ok = rev ? x[1] : x[0], t = rev ? x[0] : x[1]; return `<div style="color:${ok ? "#7be0b0" : "#9aa4b2"}">${ok ? "✔" : "✘"} ${t}</div>`; }).join("");
  const sec = (t, body) => body ? `<div style="margin-top:5px;padding-top:4px;border-top:1px solid #2b3440"><b style="color:#f3d38c">${t}</b>${body}</div>` : "";
  return `<div style="font-weight:700;color:${col};margin-bottom:3px">${h.full ? "✔ ĐỦ ĐIỀU KIỆN" : h.gOk < h.gate.length ? "⛔ Cổng chưa qua (đứng ngoài)" : "Đang theo dõi"} · ${w.p.short} ${w.p.side} · nến ${vnClock(w.time)}</div>`
    + `<div><b>${ofSimple(h)}</b> <span style="color:#9aa4b2">(${ofSum(h)})</span></div>`
    + sec(`H · Hình thái ${h.shOk}/${h.shape.length}`, li(h.shape)) + sec(`X · Xác nhận (menu): ${ofXNote(h)}`, li(h.conf, true)) + sec(`C · Cổng ${h.gOk}/${h.gate.length}`, li(h.gate))
    + `<div style="margin-top:5px;color:#9aa4b2">Tính theo mốc tường và chế độ Gamma HIỆN TẠI. Chỉ để quan sát, không phải lệnh. Vào lệnh khi đủ cả 3 nhóm.</div>`;
}
function ofDrawWatch() {
  const ctx = ov.ctx; if (!ctx || !candleS) return;
  const badge = (() => { let b = document.getElementById("tvWatchN"); if (!b) { const s = document.getElementById("sigCount"); if (!s || !s.parentNode) return null; b = document.createElement("span"); b.id = "tvWatchN"; b.style.cssText = "margin-left:8px;color:#f0b429"; s.parentNode.insertBefore(b, s.nextSibling); } return b; })();
  if (!ofOn("watch")) { if (badge) badge.textContent = ""; return; }
  const W = ofWatchCached(); if (badge) badge.textContent = S.watchErr ? `· lỗi nến quan sát: ${S.watchErr}` : `· ◉ ${S.watchN} nến quan sát`;
  const c = S.candles, tsc = chart.timeScale(), dpr = ov.dpr, Wd = ov.cv.width / dpr, Hd = ov.cv.height / dpr, psW = chart.priceScale("right").width() || 70, plotW = Wd - psW, plotH = Hd - 28, per = {};
  ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.font = "700 10.5px 'IBM Plex Mono', monospace"; ctx.textBaseline = "middle"; ctx.textAlign = "center";
  const nAt = {}; for (const w of W) nAt[w.j] = (nAt[w.j] || 0) + 1;
  for (const w of W) {
    const k = c[w.j]; if (!k) continue; const x = tsc.timeToCoordinate(w.time + TZ); if (x == null || x < 0 || x > plotW) continue;
    const sell = w.p.side === "SELL", ye = candleS.priceToCoordinate(sell ? k.high : k.low); if (ye == null) continue;
    const n = per[w.j] = (per[w.j] || 0) + 1; if (n > 3) continue;
    const col = w.chk.full ? (sell ? "#ef5350" : "#26a69a") : ofColH(w.chk), dy = 3 + (n - 1) * 22, tipY = ye + (sell ? -dy : dy), dir = sell ? -1 : 1;
    ctx.fillStyle = col;
    if (!w.first) { ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(x, tipY + dir * 3, 2.2, 0, 7); ctx.fill(); ctx.globalAlpha = 1; continue; }   // nến tiếp theo trong cùng đợt chạm: chỉ chấm nhỏ
    // tam giác nhỏ chỉ vào nến (SELL: ▼ phía trên nến · BUY: ▲ phía dưới nến) + số x/y; chi tiết khi rê chuột
    ctx.beginPath(); ctx.moveTo(x, tipY); ctx.lineTo(x - 4.5, tipY + dir * 7); ctx.lineTo(x + 4.5, tipY + dir * 7); ctx.closePath(); ctx.fill();
    const t = (nAt[w.j] > 1 ? w.p.short.replace(" TƯỜNG GẦN", "") + " " : "") + ofSimple(w.chk), ty = tipY + dir * 15, tw = ctx.measureText(t).width;
    if (ty < 8 || ty > plotH - 8) continue;
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(10,14,20,.9)"; ctx.strokeText(t, x, ty); ctx.fillStyle = col; ctx.fillText(t, x, ty);
    ov.tags.push({ x0: x - Math.max(tw / 2, 5) - 3, x1: x + Math.max(tw / 2, 5) + 3, y0: Math.min(tipY, ty) - 8, y1: Math.max(tipY + dir * 7, ty) + 8, k: "watch", tip: ofWatchTip(w) });
  }
  ctx.restore();
}
function drawOverlay() { drawOverlayBase(); try { ofDrawWatch(); } catch (e) { S.watchErr = String(e && e.message || e); } }
const ofChkLines = (h) => { const li = (a, rev) => a.map((x) => { const ok = rev ? x[1] : x[0], t = rev ? x[0] : x[1]; return `<div style="color:${ok ? "#26b384" : "#85909c"}">${ok ? "✔" : "✘"} ${t}</div>`; }).join(""); return li(h.shape) + li(h.conf, true) + li(h.gate); };
function ofRender() {
  const wn = $("#ofWarn"), T = $("#ofT"); let w = ""; try { w = ofWarnText(); } catch { /* chưa có cấu hình */ }
  if (wn) { wn.textContent = w ? "⚠ " + w : ""; wn.style.display = w ? "block" : "none"; }
  if (!T) return;
  let M = null; try { M = ofModel(); } catch (e) { T.textContent = "Lỗi: " + e.message; return; }
  S.ofPlans = M ? M.plans : []; S.ofM = M;
  const warnH = w ? `<div style="color:#ff6b6b;font-weight:600;margin-bottom:6px">⚠ ${w}</div>` : "";
  if (!M) { T.innerHTML = warnH + '<span class="muted">Chưa đủ dữ liệu (mốc tường hoặc nến).</span>'; return; }
  const live = M.plans.filter((p) => p.on);
  const near = live.filter((p) => p.dist != null && !p.blocked).sort((a, b) => a.dist - b.dist)[0];
  $("#ofReg").textContent = M.flip == null ? "" : (M.negG ? "GAMMA ÂM" : "GAMMA DƯƠNG") + ` (giá ${M.negG ? "dưới" : "trên"} Flip ${ofFm(M.flip)}, cách ${M.rgp.pctTxt})`;
  const gate = (g) => `<div style="color:${g[0] ? "#26b384" : "#ff6b6b"}">${g[0] ? "✔" : "✘"} ${g[1]}</div>`;
  const nb = $("#ofNear"); if (nb) nb.innerHTML = near ? `Gần nhất: <b style="color:${OF_COL[near.side]}">${near.name}</b> · ${near.dist === 0 ? "giá ĐANG TRONG vùng" : "còn " + near.dist.toFixed(2) + "$ tới vùng"}` : "Chưa có nhóm nào được bật.";
  const lgMin = Number.isInteger(OFS.minConf) ? OFS.minConf : M.sc.min_confirm;
  T.innerHTML = warnH
    + `<div class="muted" style="font-size:9.5px;line-height:1.35;margin:2px 0 5px">Số x/y = điều kiện đạt / cần (hình thái nến + xác nhận theo menu, tối thiểu ${lgMin}) trên nến ${S.tf} vừa đóng${M.k ? " lúc " + vnClock(M.k.time) : ""}. ⛔ = cổng chưa qua · ✔ = đủ. Bấm ▸ trong kế hoạch hoặc rê chuột vào ký hiệu trên nến để xem chi tiết.</div>`
    + live.map((p) => { const full = p.blocked ? (p.why || "Gamma âm: không bắt đáy") : p.past ? "giá đã ở bên kia tường (đã qua)" : p.dist === 0 ? "giá trong vùng" : "còn " + p.dist.toFixed(2) + "$ tới vùng";
      const sh = p.blocked ? (/Flip xa/.test(full) ? "Flip xa > 2,5%: ngày không rõ, đứng ngoài" : full.replace(/^Gamma /, "Gamma ")) : p.past ? "giá đã qua tường" : p.dist === 0 ? "giá đang trong vùng" : "còn " + p.dist.toFixed(1) + "$ tới vùng";
      return `<div title="${full.replace(/"/g, "&quot;")}" style="display:grid;grid-template-columns:62px 50px 42px 26px 1fr;gap:3px;align-items:start;margin:3px 0;font-size:9px;line-height:1.25"><b style="color:${OF_COL[p.side]};font-size:9px;white-space:nowrap">${p.short}</b><span style="text-align:center">${ofBadge(p.state, p.side)}</span><span style="text-align:center">${ofChip(p)}</span><span style="color:${OF_COL[p.side]};font-weight:700;font-size:9px">${p.side}</span><span class="muted" style="font-size:9px">${sh}</span></div>`; }).join("")
    + `<div style="margin-top:8px"><b>Cổng kiểm</b>${M.gates.map(gate).join("")}</div>`;
  const kv = (a, b) => `<div class="muted">${a}</div><div>${b}</div>`, k = M.k, sc = M.sc, dxy = S.state?.macro?.DXY?.chg_n_pct;
  $("#ofC").innerHTML = kv("Giá / Tường", `${ofFm(M.px)} · Call Wall ${ofFm(M.cw)} (cách ${Math.abs(M.cw - M.px).toFixed(1)}$) · Put Wall ${ofFm(M.pw)} (cách ${Math.abs(M.pw - M.px).toFixed(1)}$)`)
    + kv("Gamma", M.flip == null ? "chưa rõ Flip" : `${M.negG ? "ÂM" : "DƯƠNG"} · Flip ${ofFm(M.flip)} · cách ${M.rgp.pctTxt}${M.rgp.far ? " (xa hơn 2,5%: B6 coi là ngày không rõ)" : ""}` + (M.blockG ? " → BUY bắt đáy bị chặn" : ""))
    + kv(`Nến đóng ${vnClock(k.time)}`, `CVD dốc ${M.slope > 0 ? "lên ↑" : M.slope < 0 ? "xuống ↓" : "phẳng"} · Delta ${k.delta > 0 ? "+" : k.delta < 0 ? "−" : ""}${Math.abs(k.delta).toFixed(0)} · Volume ${M.avg > 0 ? (k.vol / M.avg).toFixed(2) : "?"}× SMA${sc.vol_sma} (cần ≥ ${sc.vol_spike_mult}×)`)
    + kv("ΔOI gần nhất", M.doi ? `${M.doi.d_oi} tại strike ${M.doi.chart}` : `không có strike trong ${sc.doi_zone}$`)
    + kv("DXY", dxy == null ? "—" : `${dxy >= 0 ? "+" : ""}${Number(dxy).toFixed(3)}% (ngưỡng ${sc.dxy_thr_pct}%) · chỉ tính khi live`)
    + kv("Cấu hình", `xác nhận tối thiểu ${Number.isInteger(OFS.minConf) ? OFS.minConf : sc.min_confirm} · nghỉ ${sc.cooldown_bars} nến · chạm tường ≤ ${sc.touch_tol}$ · SL ± ${sc.sl_buffer}$`);
  const sg = S.signals.slice().reverse(), c = S.candles;
  let W = []; try { W = ofWatchList(M).filter((w) => w.first); } catch (e) { /* bỏ qua */ }
  const stt = (g) => { for (let j = g.i + 1; j < c.length; j++) { const x = c[j]; if (g.side === "BUY" ? x.low <= g.sl : x.high >= g.sl) return "chạm SL"; if (g.tp1 != null && (g.side === "BUY" ? x.high >= g.tp1 : x.low <= g.tp1)) return "chạm TP1"; } return "đang chạy"; };
  const run = sg.filter((g) => stt(g) === "đang chạy").length;
  $("#ofAct").textContent = near ? near.state : "";
  $("#ofTabs").innerHTML = `<button type="button" data-oftab="new" class="${OFV.tab === "new" ? "on" : ""}" style="margin:0 6px 6px 0;padding:3px 10px;border-radius:5px;border:1px solid rgba(255,255,255,.2);background:${OFV.tab === "new" ? "#f0b429" : "transparent"};color:${OFV.tab === "new" ? "#1b1407" : "inherit"};cursor:pointer">Kế hoạch mới</button>`
    + `<button type="button" data-oftab="run" style="margin:0 6px 6px 0;padding:3px 10px;border-radius:5px;border:1px solid rgba(255,255,255,.2);background:${OFV.tab === "run" ? "#f0b429" : "transparent"};color:${OFV.tab === "run" ? "#1b1407" : "inherit"};cursor:pointer">Lệnh hôm nay (${sg.length}${run ? " · " + run + " đang chạy" : ""})</button>`
    + `<button type="button" data-oftab="watch" style="margin:0 6px 6px 0;padding:3px 10px;border-radius:5px;border:1px solid rgba(255,255,255,.2);background:${OFV.tab === "watch" ? "#f0b429" : "transparent"};color:${OFV.tab === "watch" ? "#1b1407" : "inherit"};cursor:pointer">Nến quan sát (${W.length})</button>`;
  const watchHtml = `<div class="muted" style="font-size:10.5px;margin-bottom:6px">◉ trên chart = nến chạm vùng / đóng xuyên tường của một kế hoạch. x/y tính trên chính nến đó, theo mốc tường và chế độ Gamma HIỆN TẠI. Chỉ để quan sát, chưa kiểm định.</div>`
    + (W.slice().reverse().map((w) => `<div style="border-left:3px solid ${OF_COL[w.p.side]};padding:4px 8px;margin:0 0 8px;border-radius:4px"><div><b style="color:${OF_COL[w.p.side]}">${vnClock(w.time)} ${w.p.short} ${w.p.side}</b> · <b>${ofSimple(w.chk)}</b>${w.chk.full ? " · <b style=\"color:#26b384\">ĐỦ</b>" : ""}${w.p.blocked ? ` · <span class="muted">bị chặn: ${w.p.why || ""}</span>` : ""}</div><div style="font-size:11px;margin-left:6px">${ofChkLines(w.chk)}</div></div>`).join("") || '<span class="muted">Hôm nay chưa có nến nào chạm vùng / đóng xuyên tường của kế hoạch nào.</span>');
  $("#ofP").innerHTML = OFV.tab === "new"
    ? live.map((p) => `<div style="border-left:3px solid ${OF_COL[p.side]};padding:4px 8px;margin:0 0 8px;border-radius:4px"><div><b style="color:${OF_COL[p.side]}">${p.name}</b> ${ofBadge(p.state, p.side)}</div>`
      + `<div>Vùng: <b>${p.lo === p.hi ? ofFm(p.lo) : ofFm(p.lo) + "–" + ofFm(p.hi)}</b>${p.past ? " · giá ĐÃ QUA tường (chờ giá quay lại rồi mới tính)" : p.dist ? " · cách " + p.dist.toFixed(2) + "$" : ""}</div><div>Điều kiện: ${p.cond}</div>${ofChkHtml(p)}${p.side === "BOTH" ? `<div class="muted" style="margin-top:4px">Hai kịch bản sau khi giá ra khỏi vùng rồi quay lại:</div>` + ofIllu({ id: "hg0", side: "SELL" }, true) + ofIllu({ id: "hg0", side: "BUY" }) : ofIllu(p)}`
      + `<div>SL ${p.sl} · TP1 <b>${typeof p.tp1 === "number" ? ofFm(p.tp1) : p.tp1 || "—"}</b>${p.tp2 != null ? " · TP2 " + ofFm(p.tp2) : ""}</div><div class="muted">Huỷ khi: ${p.cancel}</div></div>`).join("") || '<span class="muted">Chưa có nhóm nào được bật.</span>'
    : OFV.tab === "watch" ? watchHtml
    : sg.map((g) => `<div style="border-left:3px solid ${OF_COL[g.side]};padding:4px 8px;margin:0 0 8px;border-radius:4px"><div><b style="color:${OF_COL[g.side]}">${vnClock(g.time)} ${g.tag || ""} ${g.side} ${g.score}/${g.max}</b> · <b>${stt(g)}</b></div><div>Vào ${ofFm(g.entry)} · SL ${ofFm(g.sl)} · TP1 ${ofFm(g.tp1)}${g.tp2 != null ? " · TP2 " + ofFm(g.tp2) : ""}</div><div class="muted">${g.type.replace("[Options Flow] ", "")}</div></div>`).join("") || '<span class="muted">Hôm nay chưa có tín hiệu.</span>';
}
let ofTry = 0;
function ofInitUI() {
  if ($("#ofOpts")) return;
  // tìm ô tick "Option Flow (mũi tên ...)": có thể là <label> hoặc phần tử khác bao quanh ô input
  const inp = [...document.querySelectorAll('input[type="checkbox"]')].find((x) => /Option Flow \(mũi tên/.test((x.closest("label") || x.parentElement || x).textContent));
  const lab = inp && (inp.closest("label") || inp.parentElement); if (inp) S.ofChk = inp;
  if (!lab) { ofTry = (ofTry || 0) + 1; if (ofTry < 20) setTimeout(ofInitUI, 500); else console.warn("[TVLB] không thấy ô Option Flow để gắn hộp bật/tắt"); return; }
  const d = document.createElement("details"); d.id = "ofOpts"; d.style.cssText = "font-size:12px;margin:4px 0 8px 4px";
  const row = (k, t, names) => `<label style="display:block;margin:2px 0;cursor:pointer"><input type="checkbox" data-of="${names.join("|")}"${ofOn(names[0]) ? " checked" : ""}> ${t}</label>`;
  d.innerHTML = `<summary style="cursor:pointer;font-weight:600">Bật/tắt điều kiện (TL1 · TL2 · HG)</summary>
    <div id="ofWarn" style="display:none;color:#ff6b6b;font-weight:600;margin:4px 0"></div>
    <div class="muted" style="margin:2px 0 4px">Bảng theo dõi nằm ở trang "Vào lệnh OF" bên phải (đứng trước trang "Vào lệnh").</div>
    <div class="muted" style="margin:4px 0">Nhóm tín hiệu</div>${OF_GROUPS.map(([k, t]) => row(k, t, [k])).join("")}
    <div class="muted" style="margin:6px 0 4px">Bộ lọc theo anh Nam (MẶC ĐỊNH TẮT = như TL1/TL2 cũ; chờ anh Nam xác nhận)</div>${OF_FILTERS.map(([k, t]) => `<label style="display:block;margin:2px 0;cursor:pointer"><input type="checkbox" data-ofx="${k}"${ofX(k) ? " checked" : ""}> ${t}</label>`).join("")}<div class="muted" style="margin:6px 0 4px">Hiển thị trên chart</div><label style="display:block;margin:2px 0;cursor:pointer"><input type="checkbox" data-ofx="hg_show"${ofX("hg_show") ? " checked" : ""}> Hiện nền màu + viền nét đứt của vùng HG HEDGE (bỏ tick = ẩn, chỉ còn nhãn, vì trùng vùng HEDGE −Γ)</label>
    <div class="muted" style="margin:6px 0 4px">Số xác nhận tối thiểu: <select id="ofMin" style="font-size:12px">${[0, 1, 2, 3, 4].map((n) => `<option value="${n}"${(Number.isInteger(OFS.minConf) ? OFS.minConf : S.cfg.signals.min_confirm) === n ? " selected" : ""}>${n}</option>`).join("")}</select> (mặc định 2; nhớ để các điều kiện bên dưới được tick)</div>${OF_CONDS.map(([k, t, n]) => row(k, t, n.map((x) => (x === "gamma" ? x : "c:" + x)))).join("")}`;
  d.addEventListener("change", (e) => {
    if (e.target.id === "ofMin") { OFS.minConf = +e.target.value; try { localStorage.setItem(OF_LS, JSON.stringify(OFS)); } catch { } replaySignals(); ofRender(); return; }
    const ex = e.target.closest("input[data-ofx]");   // TVLB B9b1
    if (ex) { if (ex.checked) OFS[ex.dataset.ofx] = true; else delete OFS[ex.dataset.ofx]; try { localStorage.setItem(OF_LS, JSON.stringify(OFS)); } catch { } replaySignals(); ofRender(); drawOverlay(); return; }
    const el = e.target.closest("input[data-of]"); if (!el) return;
    for (const k of el.dataset.of.split("|")) { if (el.checked) delete OFS[k]; else OFS[k] = false; }
    try { localStorage.setItem(OF_LS, JSON.stringify(OFS)); } catch { /* bỏ qua */ }
    replaySignals(); ofRender();
  });
  lab.insertAdjacentElement("afterend", d);
  ofCompactTop(); ofStartDecor();
  ofRender(); setInterval(ofRender, 3000);
  setTimeout(ofInitPage, 1500);   // đợi các trang ③④⑤ dựng xong để nút ⑥ nằm sau chúng
}
// Trang ⑥ bên phải: theo dõi TL1·TL2 (trang ③ Vào lệnh vẫn giữ KH1-KH3)
function ofCompactTop() {
  if (document.getElementById("ofCompactCss")) return;
  const st = document.createElement("style"); st.id = "ofCompactCss";
  st.textContent = "#btnCopyTV,#btnRefresh,#btnAI{padding:3px 10px!important;font-size:12px!important;line-height:1.2!important;min-height:0!important}";
  document.head.appendChild(st);
  const sq = (el) => { if (el) { el.style.setProperty("padding-top", "2px", "important"); el.style.setProperty("padding-bottom", "2px", "important"); el.style.setProperty("margin-top", "0", "important"); el.style.setProperty("margin-bottom", "2px", "important"); el.style.setProperty("min-height", "0", "important"); } };
  sq($("#btnAI")?.parentElement);   // hàng khung giờ + nhãn FEED/OPTIONS/PHIÊN giữ nguyên chiều cao gốc để không chồng lên hàng nút trang
}
let ofPgTry = 0;
function ofInitPage() {
  const bar = document.querySelector("#pgbar"), aside = document.querySelector(".right");
  if (!bar || !aside) { if (++ofPgTry < 20) setTimeout(ofInitPage, 500); return; }
  if (bar.querySelector('[data-pg="6"]')) return;
  const b3 = bar.querySelector('button[data-pg="3"]');
  if (!b3 && ++ofPgTry < 20) { setTimeout(ofInitPage, 500); return; }   // đợi nút ③ dựng xong để đặt ⑥ ngay TRƯỚC nó
  const btn = document.createElement("button"); btn.type = "button"; btn.dataset.pg = "6"; btn.className = "v3btn"; btn.textContent = "Vào lệnh OF"; btn.title = "Vào lệnh Option Flow (TL1·TL2)";
  if (b3) bar.insertBefore(btn, b3); else bar.appendChild(btn);
  const page = document.createElement("div"); page.className = "page"; page.dataset.pg = "6"; page.hidden = true;
  page.innerHTML = `<div class="v3grid ofgrid">
    <section class="panel v3track"><header><h2>Theo dõi diễn biến</h2><span class="muted small" id="ofReg"></span><span style="margin-left:auto;display:inline-flex;gap:4px"><button type="button" id="ofWide" title="Mở rộng sang ngang (bảng chiếm cả hàng trên)" style="cursor:pointer;border:1px solid #2b3440;background:#141a22;color:#9aa4b2;border-radius:5px;padding:2px 7px;font-size:12px;line-height:1.1">⇔</button><button type="button" id="ofTall" title="Phóng to chiều cao bảng" style="cursor:pointer;border:1px solid #2b3440;background:#141a22;color:#9aa4b2;border-radius:5px;padding:2px 7px;font-size:12px;line-height:1.1">⤢</button></span></header><div id="ofNear" class="v3box">—</div><div id="ofT"></div></section>
    <section class="panel v3ctx"><header><h2>Bối cảnh thị trường</h2></header><div class="v3kv" id="ofC"></div></section>
    <section class="panel v3plan"><header><h2>Kế hoạch giao dịch</h2><span class="muted small" id="ofAct"></span></header><div id="ofTabs"></div><div id="ofP"></div></section></div>`;
  { // B9b1: nút ⇔ (rộng ngang) và ⤢ (cao) cho bảng "Theo dõi diễn biến"; bảng luôn có thanh trượt khi nội dung dài
    const st = document.createElement("style");
    st.textContent = `.v3grid.ofwide > .v3track { grid-column: 1 / -1; grid-row: 1; }
.v3grid.ofwide > .v3ctx { grid-column: 1; grid-row: 2; } .v3grid.ofwide > .v3plan { grid-column: 2; grid-row: 2; }
.v3grid.ofgrid { grid-template-rows: minmax(0, 1fr) fit-content(42%); }
.v3grid.ofgrid.oftall { grid-template-rows: minmax(0, 2.4fr) minmax(0, 1fr); }
.v3grid.ofgrid .v3plan svg { background: transparent !important; }
.v3grid > .v3track { overflow: auto; }`;
    document.head.appendChild(st);
    const g = page.querySelector(".v3grid"), wb = page.querySelector("#ofWide"), tb = page.querySelector("#ofTall"), K = "tvlb.ofsz";
    let z = {}; try { z = JSON.parse(localStorage.getItem(K) || "{}") || {}; } catch { z = {}; }
    const ap = () => { g.classList.toggle("ofwide", !!z.w); g.classList.toggle("oftall", !!z.t); try { localStorage.setItem(K, JSON.stringify(z)); } catch { } };
    wb.onclick = () => { z.w = !z.w; ap(); }; tb.onclick = () => { z.t = !z.t; ap(); }; ap();
  }
  page.addEventListener("click", (e) => { const b = e.target.closest("button[data-oftab]"); if (b) { OFV.tab = b.dataset.oftab; ofRender(); } });
  aside.insertBefore(page, aside.querySelector("#pineOut") || null);
  // tự xử lý đổi trang cho nút này (nút thêm sau khi trang tải xong thì bộ đổi trang có sẵn không biết tới)
  btn.addEventListener("click", () => {
    aside.querySelectorAll(":scope > .page").forEach((pg) => { pg.hidden = pg !== page; });
    bar.querySelectorAll("button[data-pg]").forEach((b) => b.classList.toggle("on", b === btn));
    ofRender();
  });
  bar.addEventListener("click", (e) => { const b = e.target.closest("button[data-pg]"); if (b && b !== btn) { page.hidden = true; btn.classList.remove("on"); } }, true);
  // thu nhỏ hàng nút trang để vừa 1 hàng, còn chỗ cho 1-2 nút nữa
  const st = document.createElement("style");
  st.textContent = "#pgbar{display:flex!important;flex-wrap:nowrap!important;gap:4px!important;overflow:visible!important;height:auto!important}#pgbar button{padding:4px 7px!important;font-size:11.5px!important;line-height:1.3!important;white-space:nowrap!important;flex:0 1 auto;min-width:0;overflow:visible!important}";
  document.head.appendChild(st);
  ofRender();
}
function evaluate(i, live) {
  const sc = S.cfg.signals, c = S.candles, k = c[i], L = primaryLevels();
  if (!L || L.call_wall == null || L.put_wall == null) return null;
  if (i < Math.max(sc.div_lookback, sc.vol_sma, sc.cvd_slope_bars) + 2) return null;
  if (sc.session_only && ofOn("session") && !inUsSession(k.time)) return null;
  if (ofX("x_flipfar") && L.gamma_flip != null && regimePct(k.close, L.gamma_flip).far) return null;   // TVLB B9b1: lọc ngày Flip xa (mặc định tắt)
  if ((TF_SEC[S.tf] || 0) < 300) return null;   // Options Flow: chỉ báo trên khung từ M5 trở lên (giống TradingView)
  if (i - S.lastSigIdx <= sc.cooldown_bars) return null;
  const cw = L.call_wall, pw = L.put_wall, tol = sc.touch_tol, d0 = divAt(i), d1 = divAt(i - 1), prev = c[i - 1];
  const slope = k.cvd - c[i - sc.cvd_slope_bars].cvd;
  const vavg = c.slice(i - sc.vol_sma, i).reduce((a, x) => a + x.vol, 0) / sc.vol_sma;
  const volSpike = vavg > 0 && k.vol >= sc.vol_spike_mult * vavg;
  const dxy = live ? (S.state?.macro?.DXY?.chg_n_pct ?? 0) : 0, dxyUp = dxy >= sc.dxy_thr_pct, dxyDn = dxy <= -sc.dxy_thr_pct;
  const doi = nearDoi(k.close), doiFlat = !!doi && doi.d_oi <= 0;
  // TVLB B9b0 (TL1): Gamma ÂM (giá dưới Flip) = đi theo xu hướng, KHÔNG bắt đáy -> chặn Bear Trap BUY. TL2: ΔOI ≥ doi_big = vùng nghi vấn.
  const negG = ofOn("gamma") && L.gamma_flip != null && k.close < L.gamma_flip, doiBig = !!doi && Math.abs(doi.d_oi) >= sc.doi_big;
  const bf = live ? bigFlow(sc.cvd_slope_bars) : null;   // lệnh lớn ròng (chỉ có dữ liệu cho nến live)
  const mkSig = (type, side, conf, sl, tp1, tp2) => {
    if (bf) conf = { ...conf, [side === "BUY" ? "Lệnh lớn mua ròng" : "Lệnh lớn bán ròng"]: side === "BUY" ? bf.d > 0 : bf.d < 0 };
    const grp = /Thủng Put Wall|Squeeze/.test(type) ? "g_tl1" : /^HEDGE/.test(type) ? "g_hedge" : "g_trap";
    if (!ofOn(grp)) return null;                                            // nhóm bị tắt
    if (ofX("x_regime") && L.gamma_flip != null) { const ng = k.close < L.gamma_flip; if ((grp === "g_trap" && ng) || (grp === "g_tl1" && !ng)) return null; }   // TVLB B9b1: lọc theo chế độ Gamma (mặc định tắt)
    for (const kk of Object.keys(conf)) if (!ofOn("c:" + kk)) delete conf[kk]; // điều kiện bị tắt
    const tag = grp === "g_tl1" ? "TL1" : grp === "g_trap" ? "TL1·2" : "HG";
    const score = Object.values(conf).filter(Boolean).length;
    return score >= (Number.isInteger(OFS.minConf) ? OFS.minConf : sc.min_confirm) ? { i, time: k.time, type: "[Options Flow] " + type, side, conf, score, max: Object.keys(conf).length, entry: k.close, sl, tp1, tp2, live, tag } : null;
  };
  let s = null;
  if (k.close < pw - tol && prev.close >= pw - tol) {
    const tp1 = nextStrike(k.close, false);
    s = mkSig("Thủng Put Wall", "SELL", { "CVD dốc xuống": slope < 0, "Delta nến âm": k.delta < 0, "DXY tăng": dxyUp, "Volume spike": volSpike }, pw + sc.sl_buffer, tp1, tp1 != null ? nextStrike(tp1, false) : null);
  }
  if (!s && k.close > cw + tol && prev.close <= cw + tol) {
    const tp1 = nextStrike(k.close, true);
    s = mkSig("Squeeze qua Call Wall", "BUY", { "CVD dốc lên": slope > 0, "Delta nến dương": k.delta > 0, "DXY giảm": dxyDn, "Volume spike": volSpike }, cw - sc.sl_buffer, tp1, tp1 != null ? nextStrike(tp1, true) : null);
  }
  if (!s && k.high >= cw - tol && k.close < cw && k.close < k.open)
    s = mkSig("Bull Trap tại Call Wall", "SELL", { "Phân kỳ CVD âm": d0.bear || d1.bear, "CVD dốc xuống": slope < 0, "DXY tăng": dxyUp, "Volume spike": volSpike, "Vol↑ mà ΔOI≤0": volSpike && doiFlat, "ΔOI≥1500 tại vùng": doiBig }, k.high + sc.sl_buffer, nextStrike(k.close, false), pw);
  // Bước 5 – vùng hedge lớn −Γ (LP hedge thuận chiều giá). Hai kiểu tín hiệu (30/10, người dùng đồng ý):
  //  • HEDGE trap (ưu tiên): râu/nến chọc VÀO vùng rồi nến đóng NGƯỢC ra khỏi mép vùng → LP mua/bán lại, giá bật mạnh
  //    (như 30/10 14:55: rơi vào vùng 3,960–3,977 rồi bật về Put Wall/Magnet 3,989). SL ngoài cực trị 3 nến gần nhất.
  //  • HEDGE theo đà: phải có 2 NẾN ĐÓNG liên tiếp trong vùng (nến trước đã vào, nến này đóng tiếp theo chiều) → đi theo dòng hedge.
  const hz = hedgeSt();
  if (!s && hz && i >= 3) {
    const zs = (hz.zones || []).filter((z) => z.kind === "accel");
    const p2 = c[i - 2], sw = (S.smc?.sweeps || []).some((w) => w.i >= i - 2 && w.i <= i);
    const lo3 = Math.min(k.low, prev.low, p2.low), hi3 = Math.max(k.high, prev.high, p2.high);
    const zDn = zs.find((z) => lo3 <= z.hi && k.close > z.hi && (prev.low <= z.hi || k.low <= z.hi));   // chọc xuống vùng rồi rút lên
    const zUp = zs.find((z) => hi3 >= z.lo && k.close < z.lo && (prev.high >= z.lo || k.high >= z.lo)); // chọc lên vùng rồi rút xuống
    if (zDn && k.close > k.open) {
      const tp1 = nextStrike(k.close, true);
      s = mkSig(`HEDGE trap: rút chân khỏi vùng −Γ ${fmt(zDn.lo, 0)}–${fmt(zDn.hi, 0)}`, "BUY", { "CVD dốc lên": slope > 0, "Delta nến dương": k.delta > 0, "Nến quét thanh khoản": sw, "DXY giảm": dxyDn, "Volume spike": volSpike }, lo3 - sc.sl_buffer, tp1, tp1 != null ? nextStrike(tp1, true) : null);
    } else if (zUp && k.close < k.open) {
      const tp1 = nextStrike(k.close, false);
      s = mkSig(`HEDGE trap: rút râu khỏi vùng −Γ ${fmt(zUp.lo, 0)}–${fmt(zUp.hi, 0)}`, "SELL", { "CVD dốc xuống": slope < 0, "Delta nến âm": k.delta < 0, "Nến quét thanh khoản": sw, "DXY tăng": dxyUp, "Volume spike": volSpike }, hi3 + sc.sl_buffer, tp1, tp1 != null ? nextStrike(tp1, false) : null);
    }
    if (!s) {
      const z = hZoneAt(k.close), zp = z && prev.close >= z.lo && prev.close <= z.hi ? z : null;
      if (zp && zp.kind === "accel") {
        if (p2.close > zp.hi && k.close < prev.close && k.close < k.open) {
          const tp1 = nextStrike(k.close, false);
          s = mkSig(`HEDGE −Γ: LP bán đuổi, 2 nến trong vùng (${Math.abs(zp.peak)} HĐ/${hz.win}$)`, "SELL", { "CVD dốc xuống": slope < 0, "Delta nến âm": k.delta < 0, "DXY tăng": dxyUp, "Volume spike": volSpike }, Math.max(prev.high, zp.hi) + sc.sl_buffer, tp1, tp1 != null ? nextStrike(tp1, false) : null);
        } else if (p2.close < zp.lo && k.close > prev.close && k.close > k.open) {
          const tp1 = nextStrike(k.close, true);
          s = mkSig(`HEDGE −Γ: LP mua đuổi, 2 nến trong vùng (${Math.abs(zp.peak)} HĐ/${hz.win}$)`, "BUY", { "CVD dốc lên": slope > 0, "Delta nến dương": k.delta > 0, "DXY giảm": dxyDn, "Volume spike": volSpike }, Math.min(prev.low, zp.lo) - sc.sl_buffer, tp1, tp1 != null ? nextStrike(tp1, true) : null);
        }
      }
    }
  }
  if (!s && !negG && k.low <= pw + tol && k.close > pw && k.close > k.open)
    s = mkSig("Bear Trap tại Put Wall", "BUY", { "Phân kỳ CVD dương": d0.bull || d1.bull, "CVD dốc lên": slope > 0, "DXY giảm": dxyDn, "Volume spike": volSpike, "Vol↑ mà ΔOI≤0": volSpike && doiFlat, "ΔOI≥1500 tại vùng": doiBig }, k.low - sc.sl_buffer, nextStrike(k.close, true), cw);
  return s;
}
function addSignal(s, live) {
  S.signals.push(s); S.lastSigIdx = s.i; setMarkers();
  if (live) { const e = jUpsert(jFromOF(s)); if (e) jPost([e]); renderJournal(); }
  if (live && $("#autoTrade").checked && !S.paper.pos) {
    const plan = planFor(s);
    paperOpen(s.side, plan.lots, s.sl, s.tp1, `Tự động: ${s.type} (${s.score}/${s.max})`);
  }
  if (live && "Notification" in window && Notification.permission === "granted")
    new Notification(`${s.side} – ${s.type}`, { body: `Entry ${fmt(s.entry)} · SL ${fmt(s.sl)} · TP1 ${fmt(s.tp1)}` });
}
function replaySignals() {
  S.signals = []; S.lastSigIdx = -1e9;
  const c = S.candles; if (!c.length) return;
  const day = vnDate(c[c.length - 1].time);
  for (let i = 0; i < c.length - 1; i++) {
    if (vnDate(c[i].time) !== day) continue; // mốc OI là của hôm nay
    const s = evaluate(i, false); if (s) { S.signals.push(s); S.lastSigIdx = i; }
  }
  setMarkers();
}
function setMarkers() {
  const show = $("#lyMk").checked, smcOn = $("#lySMC")?.checked && S.smc;
  const mk = show ? S.signals.map((s) => ({
    time: s.time + TZ, position: s.side === "SELL" ? "aboveBar" : "belowBar", color: s.side === "SELL" ? C.down : C.up,
    shape: s.side === "SELL" ? "arrowDown" : "arrowUp", text: `${s.tag ? s.tag + " " : ""}${s.side} ${s.score}/${s.max}`,
  })) : [];
  if (smcOn) {
    const c = S.candles;
    // nến quét thanh khoản (chỉ tại 4 loại thanh khoản của khung này, xét khi nến đã đóng)
    // mã loại: $ = đỉnh/đáy gần nhất · EQH/EQL = đỉnh/đáy bằng nhau · TL = trendline
    const swCode = (t, top) => [/gần nhất/.test(t) && "$", /bằng nhau/.test(t) && (top ? "EQH" : "EQL"), /trendline/.test(t) && "TL"].filter(Boolean).join("+");
    for (const w of S.smc.sweeps) if (c[w.i]) mk.push({ time: c[w.i].time + TZ, position: w.side === "top" ? "aboveBar" : "belowBar", color: C.mag, shape: "circle", size: 0.5, text: "✕ " + swCode(w.txt, w.side === "top") });
    // nến tạo (▼/▲ nhỏ) và nến xác nhận (■) của đỉnh/đáy thuộc cấu trúc khung này; mờ = đỉnh/đáy tạm đang chờ
    for (const F of S.smc.forms || []) {
      const top = F.side === "top", col = top ? C.down : C.up, cc = F.pending ? col + "99" : col, pos = top ? "aboveBar" : "belowBar";
      if (c[F.f]) mk.push({ time: c[F.f].time + TZ, position: pos, color: cc, shape: top ? "arrowDown" : "arrowUp", size: 0.6, text: "" });
      if (F.cf != null && c[F.cf]) mk.push({ time: c[F.cf].time + TZ, position: pos, color: cc, shape: "square", size: 0.5, text: "" });
    }
    if (show) for (const s of smcFilled()) mk.push({ time: s.time + TZ, position: s.side === "SELL" ? "aboveBar" : "belowBar", color: s.side === "SELL" ? C.down : C.up, shape: s.side === "SELL" ? "arrowDown" : "arrowUp", size: 1.4, text: `${s.name} ${s.side}${s.status === "tp1" ? " ✓" : s.status === "sl" ? " ✗" : ""}` });
  }
  mk.sort((a, b) => a.time - b.time);
  candleS.setMarkers(mk);
  const nS = smcOn ? smcFilled().filter((s) => vnDate(s.time) === vnDate(nowSec())).length : 0;
  $("#sigCount").textContent = `${S.signals.length} tín hiệu Options · ${nS} SMC hôm nay`;
}
function planFor(s) {
  const r = S.cfg.risk, risk = r.account_size_usd * r.risk_pct / 100, dist = Math.abs(s.entry - s.sl);
  return { lots: dist > 0 ? Math.max(0.01, Math.floor((risk / (dist * r.contract_oz)) * 100) / 100) : 0.01, risk };
}

// ─────────────────────────── Agent ───────────────────────────
function agentState() {
  const p = lastPrice(), L = primaryLevels(), c = S.candles, sc = S.cfg.signals;
  if (!L || p == null || L.call_wall == null || L.put_wall == null) return null;
  const flip = L.gamma_flip ?? L.put_wall, neg = p < flip, above = p >= L.call_wall;
  const i = c.length - 1, slope = i > sc.cvd_slope_bars ? c[i].cvd - c[i - sc.cvd_slope_bars].cvd : 0;
  const tape = slope > 0 ? 1 : slope < 0 ? -1 : 0;
  const dx = S.state?.macro?.DXY?.chg_n_pct ?? 0, dxyC = dx >= sc.dxy_thr_pct ? -1 : dx <= -sc.dxy_thr_pct ? 1 : 0;
  const target = neg ? nextStrike(p, false) : above ? L.call_wall : (L.magnet ?? (L.call_wall + L.put_wall) / 2);
  const pull = neg ? tape : target == null ? 0 : target > p + sc.touch_tol ? 1 : target < p - sc.touch_tol ? -1 : 0;
  const conv = 0.4 * tape + 0.3 * dxyC + 0.3 * pull;
  const sf = smcFilled(), lo = S.signals[S.signals.length - 1], ls = sf.sort((a, b) => a.i - b.i)[sf.length - 1];
  const last = lo && ls ? (ls.i >= lo.i ? ls : lo) : lo || ls;
  const live = last && i - last.i <= 3;
  const act = live ? (last.side === "BUY" ? "LONG" : "SHORT") : "WAIT";
  const regime = neg ? "SHORT_GAMMA" : above ? "ABOVE_CALL_WALL" : "LONG_GAMMA";
  const why = neg ? "strike kế tiếp phía dưới" : above ? "Call Wall (chờ rút chân)" : (L.magnet != null && L.max_pain != null && Math.abs(L.magnet - L.max_pain) <= 5) ? "Magnet ≈ Max Pain (hợp lưu)" : "Magnet / pin";
  return { p, L, flip, neg, above, tape, dxyC, pull, conv, target, why, act, regime, last, live };
}
function smcHtml() {
  if (!S.smc) return "";
  return `<p class="smcplan"><b>SMC:</b> ${esc(S.smc.struct)}<br>${S.smc.plan.map(esc).join("<br>")}</p>`;
}
function renderAgent() {
  const a = agentState();
  if (!a) {
    $("#decision").innerHTML = `<div class="act">WAIT</div><dl><dt>Trạng thái</dt><dd>Chưa có dữ liệu Options</dd></dl>`;
    $("#fusion").innerHTML = ""; $("#outlook").innerHTML = smcHtml() + `<p class="muted">Chạy XUAT_TRADINGVIEW.bat hoặc bấm “Làm mới Options” để nạp dữ liệu.</p>`;
    return;
  }
  const L = a.L, dealer = a.neg ? "LP bán khi giá giảm → gia tốc" : "LP mua dip / bán rip → giữ biên";
  $("#decision").innerHTML = `<div class="act ${a.act.toLowerCase()}">${a.act}</div>
    <dl><dt>Regime</dt><dd>${a.regime} <span class="muted">(${regimePct(a.p, a.L.gamma_flip).short.replace(/ \((.*)\)$/, ", $1")})</span></dd><dt>Dealer</dt><dd>${dealer}</dd>
    <dt>Lệnh lớn</dt><dd>${(() => { const f = bigFlow(S.cfg?.signals?.cvd_slope_bars ?? 5); return f ? `MUA ${f.b.toFixed(0)} · BÁN ${f.s.toFixed(0)} oz → ròng ${f.d >= 0 ? "+" : "−"}${Math.abs(f.d).toFixed(0)} (${f.nb}/${f.ns} lệnh ≥ ${S.big.thr?.toFixed(0)} oz)` : "đang thu thập"; })()}</dd>
    <dt>Hedge LP</dt><dd>${(() => { const v = hedgePer(a.p), z = hZoneAt(a.p); return v == null ? "—" : `≈ ${Math.abs(Math.round(v)).toLocaleString("en-US")} HĐ/${hedgeSt().win}$ (${hTier(v)}, ${v > 0 ? "−Γ gia tốc" : "+Γ hãm"})${z ? " · trong vùng hedge lớn" : ""}`; })()}</dd>
    <dt>Target</dt><dd>${fmt(a.target)} <span class="muted">(${esc(a.why)})</span></dd><dt>Conviction</dt><dd>${sgn(a.conv, 2)}</dd>
    ${S.smc ? `<dt>Cấu trúc</dt><dd>${esc(S.smc.struct)}</dd>` : ""}</dl>`;
  const w = Math.abs(a.conv) * 45;
  $("#fusion").innerHTML = `<b>FUSION</b> tape ${a.tape > 0 ? "↑" : a.tape < 0 ? "↓" : "·"} · DXY ${a.dxyC > 0 ? "hỗ trợ vàng" : a.dxyC < 0 ? "chống vàng" : "trung tính"} · kéo về target ${a.pull > 0 ? "↑" : a.pull < 0 ? "↓" : "·"}
    <span class="bar"><i style="left:${a.conv >= 0 ? 50 : 50 - w}%;width:${w}%;background:${a.conv >= 0 ? C.up : C.down}"></i></span>${sgn(a.conv, 2)}`;
  const dCW = L.call_wall - a.p, dPW = L.put_wall - a.p;
  let main, alt, trap;
  if (a.neg) {
    main = `<b>Chính:</b> Negative Gamma, giá dưới Flip ${fmt(a.flip)}. Ưu tiên SELL khi hồi về ${fmt(a.flip)} hoặc theo đà thủng ${fmt(nextStrike(a.p, false))}. Không bắt đáy.`;
    alt = `<b>Phụ:</b> đóng nến trở lại trên ${fmt(a.flip)} kèm CVD dốc lên thì chuyển về Positive Gamma, đánh biên.`;
    trap = `<b>Bẫy:</b> râu thủng Put Wall ${fmt(L.put_wall)} rồi rút chân, CVD phân kỳ dương, Volume tăng mà ΔOI không tăng → Bear Trap BUY.`;
  } else if (a.above) {
    main = `<b>Chính:</b> giá trên Call Wall ${fmt(L.call_wall)}. Chờ nến rút chân đóng dưới Wall để SELL về ${fmt(nextStrike(L.call_wall, false))}.`;
    alt = `<b>Phụ:</b> CVD và DXY cùng ủng hộ thì squeeze lên ${fmt(nextStrike(a.p, true))}.`;
    trap = `<b>Bẫy:</b> Volume spike tại Wall mà ΔOI không tăng là dấu hiệu Bull Trap.`;
  } else {
    main = `<b>Chính:</b> Positive Gamma, biên ${fmt(L.put_wall)} (${sgn(dPW)}) ↔ ${fmt(L.call_wall)} (${sgn(dCW)}). Giá bị hút về ${fmt(a.target)}. Scalp hai biên.`;
    alt = `<b>Phụ:</b> đóng nến thủng ${fmt(a.flip)} thì chuyển Negative Gamma, đánh theo chiều xả.`;
    trap = `<b>Bẫy:</b> canh râu quét qua Wall rồi đóng ngược vào trong kèm phân kỳ CVD.`;
  }
  const smcP = smcHtml();
  const sig = a.last ? `<p><b>Tín hiệu cuối:</b> ${a.last.side} · ${esc(a.last.type)}${a.last.smc ? "" : ` (${a.last.score}/${a.last.max})`} lúc ${vnClock(a.last.time)} · Entry ${fmt(a.last.entry)} · SL ${fmt(a.last.sl)} · TP1 ${fmt(a.last.tp1)} · khối lượng ≈ ${fmt(planFor(a.last).lots, 2)} lot</p>` : "";
  $("#outlook").innerHTML = `${smcP}<p>${main}</p><p>${alt}</p><p>${trap}</p>${sig}`;
  $("#agentAge").textContent = `cập nhật ${new Date().toLocaleTimeString("vi-VN")}`;
}

// ─────────────────────────── bảng & panel ───────────────────────────
function renderQuote() {
  const c = S.candles; if (!c.length) return;
  const p = lastPrice(), key = sessKey(c[c.length - 1].time), open = (c.find((x) => sessKey(x.time) === key) || c[0]).open, ch = p - open;
  $("#px").textContent = fmt(p);
  const el = $("#pxchg"); el.textContent = `${sgn(ch, 2)} (${sgn((ch / open) * 100, 2)}%)`; el.className = "chg " + (ch >= 0 ? "up" : "down");
  $("#nbars").textContent = c.length;
  const last = c[c.length - 1], d = divAt(c.length - 1);
  $("#cvdVal").textContent = fmtK(last.cvd);
  const tag = $("#cvdDiv"); tag.textContent = d.bear ? "Phân kỳ âm" : d.bull ? "Phân kỳ dương" : "Không phân kỳ"; tag.className = "tag " + (d.bear ? "bear" : d.bull ? "bull" : "");
  chip("#chipSess", inUsSession(nowSec()) ? "ok" : "", "Phiên Mỹ " + S.cfg.signals.us_session_vn.join("–"));
}

// Bid/Ask theo strike (Bước 2): spread % so với giá giữa; ≥ 15% = thanh khoản kém (tô vàng)
function baCell(s) {
  const one = (b, a) => (b && a && a > 0 ? (200 * (a - b)) / (a + b) : null);
  const c = one(s.c_bid, s.c_ask), p = one(s.p_bid, s.p_ask);
  if (c == null && p == null) return `<td class="muted" title="Không có Bid/Ask (GC: CME miễn phí không có; GLD: ngoài giờ Mỹ Yahoo trả 0)">—</td>`;
  const f = (x) => (x == null ? "—" : x.toFixed(0) + "%"), wide = (c ?? 0) >= 15 || (p ?? 0) >= 15;
  const tip = `CALL bid ${s.c_bid ?? "—"} / ask ${s.c_ask ?? "—"}\nPUT bid ${s.p_bid ?? "—"} / ask ${s.p_ask ?? "—"}\nSpread = (ask − bid) / giá giữa (kỳ gần nhất)`;
  return `<td class="${wide ? "warnc" : ""}" title="${tip}">${f(c)} · ${f(p)}</td>`;
}
function renderProfile() {
  const o = optV(S.profSrc), tb = $("#prof tbody");
  if (!o) { tb.innerHTML = `<tr><td colspan="19" class="muted">${S.state && S.state.options_updated ? `Chưa có dữ liệu ${S.profSrc}. Xem dòng cảnh báo vàng phía trên để biết lý do, rồi bấm “Làm mới Options”.` : `Đang tải dữ liệu ${S.profSrc} lần đầu (1–2 phút)…`}</td></tr>`; $("#profMeta").textContent = "—"; return; }
  const p = lastPrice() ?? o.chart.gamma_flip;
  const maxG = Math.max(1, ...o.strikes.map((s) => Math.abs(s.net_gex)));
  const atm = o.strikes.reduce((b, s) => (b == null || Math.abs(s.chart - p) < Math.abs(b.chart - p) ? s : b), null);
  const big = S.cfg.signals.doi_big, n = (v, d) => (v == null ? "—" : Number(v).toFixed(d)), dTh = o.source === "GLD" ? 3 : 2;
  tb.innerHTML = [...o.strikes].reverse().map((s) => {
    const cls = [s === atm ? "atm" : "", s.strike === o.call_wall ? "wall-c" : "", s.strike === o.put_wall ? "wall-p" : ""].join(" ");
    const w = Math.round((Math.abs(s.net_gex) / maxG) * 100), hc = s.net_gex >= 0 ? "rgba(38,179,132,.22)" : "rgba(229,83,75,.22)";
    const doi = s.d_oi == null ? "—" : `<span class="doi ${s.d_oi >= big ? "big" : s.d_oi <= 0 ? "neg" : ""}">${s.d_oi > 0 ? "+" : ""}${fmtK(s.d_oi)}</span>`;
    return `<tr class="${cls}" ${s === atm ? 'id="atmRow"' : ""}><td class="xau">${fmt(s.chart)}${s.strike === o.call_wall ? " CW" : s.strike === o.put_wall ? " PW" : ""}</td><td class="muted">${s.strike}</td>
      <td>${fmtK(s.call_oi)}</td><td>${fmtK(s.call_vol)}</td><td>${fmtK(s.put_oi)}</td><td>${fmtK(s.put_vol)}</td>
      <td class="${s.net_gex >= 0 ? "gp" : "gn"}" style="background:linear-gradient(to left, ${hc} ${w}%, transparent ${w}%)">${fmtK(s.net_gex)}</td>
      <td class="${s.dex >= 0 ? "gp" : "gn"}">${fmtK(s.dex)}</td><td>${s.iv ? (s.iv * 100).toFixed(1) + "%" : "—"}</td><td>${doi}</td>${baCell(s)}
      <td class="muted">${n(s.dte, 0)}</td><td>${n(s.delta, 2)}</td><td>${n(s.gamma, 4)}</td><td>${n(s.vega, 2)}</td><td>${n(s.vanna, 4)}</td>
      <td class="gn">${n(s.theta, dTh)}</td><td>${n(s.rho, 3)}</td><td>${n(s.charm, 4)}</td></tr>`;
  }).join("");
  const rt = S.state?.rate, rTxt = o.rate != null ? `r ${(o.rate * 100).toFixed(2)}%${rt?.src ? " (" + rt.src + ")" : ""}` : "";
  const expo = o.net_vex != null ? ` · Vanna Exp ${fmtK(o.net_vex)}/1 vol · Charm Exp ${fmtK(o.net_cex)}/ngày · Θ OI ${fmtK(o.theta_oi)}/ngày` : "";
  // IV surface: IV ATM kỳ gần nhất của từng nhóm + skew (IV 95% − IV 105%, điểm vol; > 0 = put đắt hơn call)
  const seen = new Set(), ivTxt = (o.surface || []).filter((x) => !seen.has(x.tenor) && seen.add(x.tenor)).slice(0, 4)
    .map((x) => `${x.tenor} ${(x.atm_iv * 100).toFixed(1)}%${x.interp ? "*" : ""}`).join(" · ");
  const sk = (o.surface || [])[0], skTxt = sk ? ` · skew ${sk.skew >= 0 ? "+" : ""}${(sk.skew * 100).toFixed(1)}đ` : "";
  const base = opt(S.profSrc), ei = base?.expiry_info || [], tot = ei.reduce((a, x) => a + x.oi, 0) || 1;
  const shortOI = ei.filter((x) => x.dte <= 7).reduce((a, x) => a + x.oi, 0);
  const lv = S.state?.live, liveTxt = lv?.time ? ` · tính lại ${new Date(lv.time).toLocaleTimeString("vi-VN")} theo giá ${fmt(lv.price)}` : "";
  $("#profMeta").textContent = `${TENOR_TXT[S.tenor] || ""}: ${o.n_expiries ?? o.expiries.length} kỳ (${o.expiries.slice(0, 3).join(", ")}${o.expiries.length > 3 ? "…" : ""}) · OI ≤7 ngày ${Math.round((shortOI / tot) * 100)}% · IV ATM ${ivTxt || "—"}${skTxt} · nguồn ${o.source} (giá ${fmt(o.underlying)}) · ${o.model || ""}${rTxt ? " " + rTxt : ""}${expo}${liveTxt} · ${oiLabelVN(base?.cme) ? `${oiLabelVN(base.cme)} · tải ${(base.fetched || o.fetched) ? new Date(base.fetched || o.fetched).toLocaleString("vi-VN") : ""}` : `OI ngày ${o.fetched ? new Date(o.fetched).toLocaleString("vi-VN") : ""}`}`;
  $("#profMeta").title = "Kỳ hạn: chọn ở ô bên trái (chỉ đổi phần xem; tín hiệu và Agent dùng Mọi kỳ hạn). IV ATM: IV đã làm mượt (smile bậc 2 theo OI, * = nội suy từ kỳ khác). Skew: IV strike 95% − IV strike 105%. Mốc được tính lại mỗi 60 giây hoặc khi giá đi > 2 USD; OI là số cuối phiên của sàn (GC: OI của phiên trước ngày settle, xem nhãn cuối dòng). Strike giá sàn (settle ≤ 0,1) không tính vào GEX/Flip/Magnet.\nExposure theo quy ước dấu GEX (dealer long call / short put). Vanna Exp: USD delta dealer đổi khi IV +1 điểm. Charm Exp: USD delta dealer đổi sau 1 ngày nếu giá và IV đứng yên. Θ OI: tổng giá trị thời gian mất mỗi ngày của toàn bộ OI.";
  if (!S.profScrolled && $("#atmRow")) { const w = $(".sp .tablewrap"), r = $("#atmRow"); w.scrollTop = r.offsetTop - w.clientHeight / 2; S.profScrolled = true; }
}

// ─── 7f: HIỂN THỊ chế độ Gamma theo % khoảng cách tới Flip (B2), cảnh báo CME chậm, hệ số kỳ hạn ───
// Chỉ đổi NHÃN hiển thị; Agent, kế hoạch, tín hiệu vẫn dùng dấu trên/dưới Flip như cũ.
// FLIP_FAR_PCT = 2,5%: ngưỡng do Claude chọn, tương đương 100 điểm ở giá 4.000 (quy tắc "không rõ" của bước 6 là 100 điểm cố định). Chưa kiểm định.
const FLIP_FAR_PCT = 2.5;
function regimePct(p, flip) {
  const fx = (v) => Number(v).toFixed(1).replace(".", ","), farTxt = fx(FLIP_FAR_PCT);
  if (p == null || flip == null || !(flip > 0)) return { cls: "unk", pct: null, far: false, pctTxt: "", farTxt, short: "không rõ (không có Flip)" };
  const pct = ((p - flip) / flip) * 100, far = Math.abs(pct) > FLIP_FAR_PCT, pctTxt = `${pct >= 0 ? "+" : "−"}${fx(Math.abs(pct))}%`;
  return { cls: far ? "unk" : pct >= 0 ? "pos" : "neg", pct, far, pctTxt, farTxt, short: far ? `không rõ (Flip cách ${fx(Math.abs(pct))}%)` : `${pct >= 0 ? "Long γ" : "Short γ"} ${pctTxt}` };
}
window.regimePct = regimePct;
// Ngày giao dịch CME (MM/DD/YYYY) cũ hơn phiên lẽ ra đã có? Phiên "đã có" = ngày làm việc của (bây giờ − 23h30 UTC) (settle đăng xong khoảng 23:03 UTC theo bước 4).
// Ngưỡng do Claude chọn; ngày lễ cũng báo (nên chữ ghi "có thể"). Dashboard không thấy giờ đăng, chỉ so được ngày.
function cmeStale(cme, nowMs) {
  const m = cme && cme.trade_date ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(cme.trade_date).trim()) : null; if (!m) return null;
  const DAY = 86400e3, td = Date.UTC(+m[3], +m[1] - 1, +m[2]), d0 = new Date((nowMs ?? Date.now()) - 23.5 * 3600e3);
  let e = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate());
  while ([0, 6].includes(new Date(e).getUTCDay())) e -= DAY;
  if (td >= e) return null;
  let n = 0; for (let x = td + DAY; x <= e; x += DAY) if (![0, 6].includes(new Date(x).getUTCDay())) n++;
  return n > 0 ? { n, txt: `CME chậm ${n} phiên (settle mới nhất ${m[2]}/${m[1]}/${m[3]}); có thể chưa đăng số mới, hoặc ngày lễ` } : null;
}
window.cmeStale = cmeStale;
function tenorWTxt(o) {
  const t = o && o.tenor_w; if (!t) return "—";
  if (!t.on) return "tắt";
  const BN = { d: "DATE", w: "WEEK", m: "MONTH" };
  return "A " + Object.entries(t.buckets).map(([b, v]) => `${BN[b]}·${v.n_exp}kỳ·${String(v.f.toFixed(2)).replace(".", ",")}`).join(" ");
}
function renderKpis() {
  const P = prim(), gld = opt("GLD"), iv = P?.strikes?.find((s) => s.iv)?.iv;
  const atmIv = (() => { const o = gld || P; if (!o) return null; const p = o.underlying; const s = o.strikes.reduce((b, x) => (b == null || Math.abs(x.strike - p) < Math.abs(b.strike - p) ? x : b), null); return s?.iv; })();
  $("#kpis").innerHTML = `<span>— Vol / Risk <b>${atmIv ? (atmIv * 100).toFixed(1) + "% IV" : "—"}</b></span>
    <span>— XAU / GLD <b>×${fmt(gld?.ratio, 3)}</b></span><span>— Net GEX <b>${fmtK(P?.net_gex)}</b></span>
    <span>— Regime <b>${P?.gamma_flip == null ? "—" : regimePct(P.underlying, P.gamma_flip).short}</b></span>
    <span>— Hệ số kỳ hạn <b>${tenorWTxt(P)}</b></span>`;
  void iv;
}

function renderMacro() {
  const m = S.state?.macro || {};
  const box = (name, v, unit = "") => `<div><small>${name}</small><b>${v ? fmt(v.last, name === "US10Y" ? 3 : 2) + unit : "—"}</b>
    <span class="${v && v.chg_n_pct >= 0 ? "up" : "down"}"> ${v ? sgn(v.chg_n_pct, 3) + "%/5p" : ""}</span></div>`;
  $("#macro").innerHTML = box("DXY", m.DXY) + box("US10Y", m.US10Y, "%");
  const now = Date.now(), items = (S.state?.calendar || []).filter((n) => new Date(n.time).getTime() > now - 3600e3).slice(0, 5);
  $("#news").innerHTML = items.length ? items.map((n) => {
    const t = new Date(n.time), mins = (t - now) / 60000;
    return `<li><span>${esc(n.title)}</span><span class="${mins < 120 && mins > -60 ? "soon" : "muted"}">${t.toLocaleString("vi-VN", { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span></li>`;
  }).join("") : `<li class="muted">Không có tin USD đỏ sắp tới.</li>`;
}

let warnExtra = [];
function addWarn(t) { if (!warnExtra.includes(t)) warnExtra.push(t); renderWarn(); }
function renderWarn() {
  const errs = [...(S.state?.errors || []), ...warnExtra];
  if (S.state?.demo) errs.unshift("CHẾ ĐỘ DEMO: giá và Options là dữ liệu giả lập.");
  const w = $("#warn"); w.hidden = !errs.length; w.textContent = errs.join("  •  ");
  // ghi chú (dùng bản lưu còn mới, cùng phiên) → dòng xám nhỏ, không phải cảnh báo
  let n = $("#notes");
  if (!n) { n = document.createElement("div"); n.id = "notes"; n.className = "notes"; w.after(n); }
  const notes = S.state?.notes || [];
  n.hidden = !notes.length; n.textContent = notes.length ? "ℹ " + notes.join("  •  ") : "";
}
function renderEngineChip() {
  const st = S.state;
  if (!st) return chip("#chipEngine", "bad", "Engine offline");
  const age = st.options_updated ? (Date.now() - new Date(st.options_updated)) / 60000 : null;
  chip("#chipEngine", st.demo ? "mid" : st.status === "ok" ? "ok" : "mid", st.demo ? "Engine DEMO" : age != null ? `Options ${Math.round(age)}p trước` : "Engine đang chạy");
  const r = st.refs || {};
  $("#metaRef").textContent = `GC ${fmt(r.gc)} · GLD ${fmt(r.gld)}`;
}
async function renderPine() {
  try {
    const r = await (await fetch(API("/api/tv"))).json();
    $("#pineOut").innerHTML = `<label>Đoạn mã dán vào ô "Dữ liệu engine" <button class="ghost small" id="copyPine">Sao chép</button></label><code>${esc(r.blob)}</code>`;
    $("#copyPine").onclick = async (e) => { try { await navigator.clipboard.writeText(r.blob); e.target.textContent = "Đã chép"; } catch { e.target.textContent = "Hãy chọn thủ công"; } };
  } catch { $("#pineOut").innerHTML = `<p class="muted">Không lấy được đoạn mã.</p>`; }
}



// ─────────────────────────── Bước 5b: LỆNH LỚN ("Smart Money") — thay cho "Tách ID Order" ───────────────────────────
// Không có nguồn miễn phí cho dữ liệu lệnh theo ID → đọc TỪNG GIAO DỊCH khớp (aggTrade) của feed Binance, tách các giao dịch
// có giá trị ≥ ngưỡng CỐ ĐỊNH config signals.big_trade_usd (mặc định 50.000 USD), nạp lại từ đầu phiên (tối đa 8 giờ) → mọi máy cùng số liệu
// → "CVD lệnh lớn" = mua chủ động lớn − bán chủ động lớn (oz), cộng dồn theo phiên. Chạy cả trên bản web (trình duyệt tự nối).
// Lưu ý: đây là dòng lệnh trên Binance (XAUUSDT/PAXG), chỉ đại diện một phần dòng tiền COMEX/OTC.
S.big = { thr: null, ids: new Set(), raw: [], byT: {}, ws: null, n: 0, since: null, t0: null, loaded: false };
const BIG_MIN_USD = () => S.cfg?.signals?.big_trade_usd ?? 50000;
const BIG_KEEP = 8 * 3600e3, BIG_LS = "bildol_big_v2";
function bigThr(price) {
  // ngưỡng CỐ ĐỊNH theo giá trị USD (config signals.big_trade_usd) → mọi máy/bản web đếm cùng một tập lệnh
  return price ? BIG_MIN_USD() / price : null;
}
function bigBucket(x) {
  const step = TF_SEC[S.tf] || 900, ts = Math.floor(x.T / 1000);
  const t = AGG[S.tf] ? SMC.bucketOf(ts, AGG[S.tf]) : Math.floor(ts / step) * step;   // 4h/1d neo 18:00 New York như nến
  const e = S.big.byT[t] || (S.big.byT[t] = { d: 0, n: 0, buy: 0, sell: 0, nb: 0, ns: 0 });
  if (x.s) { e.d -= x.q; e.sell += x.q; e.ns++; } else { e.d += x.q; e.buy += x.q; e.nb++; }
  e.n++;
}
function bigRebucket() {
  // đổi khung → chia lại từ danh sách lệnh lớn đã có (KHÔNG tải lại từ Binance)
  const B = S.big; B.byT = {};
  for (const x of B.raw) bigBucket(x);
  const step = TF_SEC[S.tf] || 900;
  B.since = B.t0 == null ? null : (AGG[S.tf] ? SMC.bucketOf(Math.ceil(B.t0 / 1000), AGG[S.tf]) + AGG[S.tf] : Math.ceil(B.t0 / 1000 / step) * step);
  for (const t of Object.keys(B.byT)) if (B.since != null && +t < B.since) delete B.byT[t];   // bỏ nến có dữ liệu dở
}
function bigAdd(tMs, price, qty, sellAggr, id) {
  const B = S.big;
  if (id != null) { if (B.ids.has(id)) return false; B.ids.add(id); if (B.ids.size > 300000) B.ids.clear(); }   // bỏ trùng giữa nạp lại (REST) và luồng trực tiếp (WS)
  B.thr = bigThr(price); B.lastId = Math.max(B.lastId || 0, id || 0); B.lastT = Math.max(B.lastT || 0, tMs);
  if (qty * price < BIG_MIN_USD()) return false;
  const x = { T: tMs, q: qty, s: !!sellAggr, a: id };
  B.raw.push(x); bigBucket(x); B.n++; return true;
}
function bigSave() {
  try {
    const B = S.big, cut = Date.now() - BIG_KEEP;
    B.raw = B.raw.filter((x) => x.T >= cut); if (B.t0 < cut) B.t0 = cut;
    localStorage.setItem(BIG_LS, JSON.stringify({ sym: S.feed?.symbol, usd: BIG_MIN_USD(), t0: B.t0, lastId: B.lastId, lastT: B.lastT, raw: B.raw }));
  } catch { }
}
function bigSeries() {
  // CVD lệnh lớn theo phiên, gắn vào nến hiện có
  // trả về 3 đường theo phiên: ròng, tổng MUA lớn (dương), tổng BÁN lớn (vẽ âm)
  const c = S.candles, out = [], ob = [], os = []; let cum = 0, cb = 0, cs = 0, key = null;
  for (const k of c) {
    if (sessKey(k.time) !== key) { key = sessKey(k.time); cum = 0; cb = 0; cs = 0; }
    const e = S.big.byT[k.time]; if (e) { cum += e.d; cb += e.buy; cs += e.sell; }
    k.bigd = e ? e.d : 0; k.bign = e ? e.n : 0; k.bigb = e ? e.buy : 0; k.bigs = e ? e.sell : 0;
    k.bignb = e ? e.nb || 0 : 0; k.bigns = e ? e.ns || 0 : 0; k.bigcvd = cum; k.bigcb = cb; k.bigcs = cs;
    if (S.big.since != null && k.time + (TF_SEC[S.tf] || 900) > S.big.since) {
      out.push({ time: k.time + TZ, value: cum }); ob.push({ time: k.time + TZ, value: cb }); os.push({ time: k.time + TZ, value: -cs });
    }
  }
  return { net: out, buy: ob, sell: os };
}
function bigFlow(n = 5) { // lệnh lớn ròng (oz) trong n nến gần nhất, chỉ tính khi đã có dữ liệu cho cả n nến
  const c = S.candles; if (S.big.since == null || c.length < n) return null;
  if (c[c.length - n].time < S.big.since - (TF_SEC[S.tf] || 900)) return null;
  let d = 0, m = 0, b = 0, s = 0, nb = 0, ns = 0;
  for (const k of c.slice(-n)) { d += k.bigd || 0; m += k.bign || 0; b += k.bigb || 0; s += k.bigs || 0; nb += k.bignb || 0; ns += k.bigns || 0; }
  return { d, n: m, b, s, nb, ns };
}
function bigFlowAt(j, n = 5) { // v23o: như bigFlow nhưng cho n nến kết thúc tại nến j (đánh dấu nến quá khứ)
  const c = S.candles; if (S.big.since == null || j - n + 1 < 0 || !c[j]) return null;
  if (c[j - n + 1].time < S.big.since - (TF_SEC[S.tf] || 900)) return null;
  let d = 0, m = 0, b = 0, s = 0, nb = 0, ns = 0;
  for (const k of c.slice(j - n + 1, j + 1)) { d += k.bigd || 0; m += k.bign || 0; b += k.bigb || 0; s += k.bigs || 0; nb += k.bignb || 0; ns += k.bigns || 0; }
  return { d, n: m, b, s, nb, ns };
}
function renderBig() {
  if (!bigLine) return;
  const sr = bigSeries(); bigLine.setData(sr.net); bigBuyLine?.setData(sr.buy); bigSellLine?.setData(sr.sell);
  const el = $("#bigVal"); if (!el) return;
  const f = bigFlow(S.cfg?.signals?.cvd_slope_bars ?? 5), thr = S.big.thr;
  const nb = S.cfg?.signals?.cvd_slope_bars ?? 5, fx = (v) => Math.round(v).toLocaleString("en-US");
  el.innerHTML = thr == null ? "đang thu thập…" : `≥ ${thr.toFixed(thr < 10 ? 1 : 0)} oz · ${nb} nến: ${f ? `<b class="up">MUA ${fx(f.b)} oz</b> (${f.nb}) · <b class="down">BÁN ${fx(f.s)} oz</b> (${f.ns}) · ròng <b class="${f.d >= 0 ? "up" : "down"}">${f.d >= 0 ? "+" : "−"}${fx(Math.abs(f.d))}</b>` : "chưa đủ dữ liệu"}`;
}
async function bigBackfill(f) {
  // Tải NHẸ để không bị Binance chặn IP: tối đa 40 trang (1.000 giao dịch/trang), tuần tự, nghỉ 250 ms giữa các trang.
  // Có bộ nhớ trình duyệt: mở lại trang chỉ tải phần giao dịch MỚI kể từ lần trước.
  // Không có bộ nhớ: tải ngược từ hiện tại ~2 giờ (đủ cho "5 nến" khung ≤ 15m).
  const B = S.big, now = Date.now(), path = /fapi/.test(f.kpath) ? "/fapi/v1/aggTrades" : "/api/v3/aggTrades";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const get = async (q) => {
    const r = await fetch(`${f.rest}${path}?symbol=${f.symbol}${q}`);
    if (r.status === 418 || r.status === 429) { B.banned = Date.now(); throw new Error("rate"); }
    const a = await r.json(); return Array.isArray(a) ? a : [];
  };
  let c = null; try { c = JSON.parse(localStorage.getItem(BIG_LS) || "null"); } catch { }
  try {
    if (c && c.sym === f.symbol && c.usd === BIG_MIN_USD() && c.lastT > now - 30 * 60e3 && Array.isArray(c.raw)) {
      for (const x of c.raw) { B.ids.add(x.a); B.raw.push(x); }
      B.t0 = c.t0; B.lastId = c.lastId; B.lastT = c.lastT; bigRebucket(); renderBig();
      let from = c.lastId + 1;
      for (let p = 0; p < 40; p++) {                       // tải tiếp phần mới
        const a = await get(`&fromId=${from}&limit=1000`); if (!a.length) break;
        for (const x of a) bigAdd(x.T, +x.p, +x.q, !!x.m, x.a);
        from = a[a.length - 1].a + 1; if (a.length < 1000) break; await sleep(250);
      }
    } else {
      const last = await get("&limit=1"); if (!last.length) throw new Error("no trades");
      const L = last[0].a, want = now - 2 * 3600e3; let minT = now;
      for (let p = 1; p <= 40 && minT > want; p++) {       // tải ngược
        const fid = L + 1 - 1000 * p; if (fid + 1000 <= 0) break;
        const a = await get(`&fromId=${Math.max(0, fid)}&limit=1000`); if (!a.length) break;
        for (const x of a) { bigAdd(x.T, +x.p, +x.q, !!x.m, x.a); if (x.T < minT) minT = x.T; }
        if (p % 5 === 0) { B.t0 = minT; bigRebucket(); renderBig(); }
        await sleep(250);
      }
      B.t0 = Math.max(minT, want);
    }
  } catch { if (B.t0 == null) B.t0 = now; }
  B.loaded = true; bigRebucket(); renderBig(); bigSave();
}
function connectBig(i = 0) {
  const f = S.feed || feeds()[0];
  if (S.big.ws) { try { S.big.ws.onclose = null; S.big.ws.close(); } catch { } }
  let urls = [f.ws, ...(f.ws_alt || [])];
  if (/fstream\.binance\.com\/ws$/.test(f.ws)) urls = ["wss://fstream.binance.com/market/ws", f.ws];
  const ws = new WebSocket(`${urls[i % urls.length]}/${f.symbol.toLowerCase()}@aggTrade`);
  S.big.ws = ws;
  let last = 0;
  ws.onmessage = (ev) => {
    const x = JSON.parse(ev.data); if (!x || x.e !== "aggTrade") return;
    if (bigAdd(x.T, +x.p, +x.q, !!x.m, x.a) || Date.now() - last > 5000) { last = Date.now(); renderBig(); }
  };
  ws.onclose = () => { if (S.big.ws === ws) setTimeout(() => connectBig(i + 1), 5000); };
  ws.onerror = () => ws.close();
}
function startBig() {
  if (S.state?.demo) return;
  const f = S.feed || feeds()[0];
  if (S.big.loaded && S.big.sym === f.symbol) { bigRebucket(); renderBig(); return; }
  S.big = { thr: null, ids: new Set(), raw: [], byT: {}, ws: S.big?.ws || null, n: 0, since: null, t0: null, loaded: false, sym: f.symbol };
  bigBackfill(f); connectBig(0);
}
setInterval(() => { if (S.big?.loaded) bigSave(); }, 60e3);

// ─────────────────────────── Bản web tĩnh (GitHub Pages / điện thoại) ───────────────────────────
// γ live: tính lại Gamma Black-76/BSM từng strike theo giá hiện tại từ "gói" (giống Pine v32, analytics.pack_gamma)
// → Flip (lưới ±12%, 120 bước), Magnet (±8%), Net GEX khi máy tính tắt. OI giữ nguyên số cuối ngày.
const YEAR_SEC = 365 * 86400, T_FLOOR = 1 / (365 * 24), TV_SPAN = 0.12;
function packGamma(pk, Sx, now) {
  const out = [], kk = pk.mult * Sx * Sx * 0.01;
  for (const [ks, ois] of Object.entries(pk.oi)) {
    const k = parseFloat(ks); let cg = 0, pg = 0;
    pk.buckets.forEach((bk, j) => {
      if (!bk) return;
      const co = ois[2 * j], po = ois[2 * j + 1]; if (co <= 0 && po <= 0) return;
      const left = bk.ts - now; if (j === 0 && left <= 0) return;
      const T = Math.max(left / YEAR_SEC, T_FLOOR), x = Math.log(k / pk.F);
      const iv = Math.min(Math.max(bk.a + bk.s1 * x + bk.s2 * x * x, 0.03), 2.0), sq = iv * Math.sqrt(T);
      const d1 = (Math.log(Sx / k) + (pk.b + iv * iv / 2) * T) / sq;
      const g = Math.exp((pk.b - pk.r) * T) * Math.exp(-d1 * d1 / 2) / Math.sqrt(2 * Math.PI) / (Sx * sq);
      cg += g * co * kk; pg -= g * po * kk;
    });
    const f = pk.fac?.[ks] ?? pk.fac?.[String(k)] ?? 1;
    out.push({ k, cg: cg * f, pg: pg * f });
  }
  return out;
}
function packResid(pk, Sx) { const n = pk.resid.length, xs = Array.from({ length: n }, (_, i) => -TV_SPAN + (2 * TV_SPAN * i) / (n - 1)); return interp(xs, pk.resid, Sx / pk.C - 1) || 0; }
const packNet = (pk, Sx, now) => packGamma(pk, Sx, now).reduce((a, x) => a + x.cg + x.pg, 0) + packResid(pk, Sx);
function liveFromPack(pk, Sx, now) {
  const g = packGamma(pk, Sx, now); let mag = null, best = 0;
  for (const x of g) if (Math.abs(x.k / Sx - 1) <= 0.08 && x.cg - x.pg > best) { best = x.cg - x.pg; mag = x.k; }
  const net = g.reduce((a, x) => a + x.cg + x.pg, 0) + packResid(pk, Sx);
  let flip = null; const steps = 120, lo = Sx * 0.88, st = (Sx * 0.24) / steps; let prev = packNet(pk, lo, now);
  for (let j = 1; j <= steps; j++) {
    const px = lo + st * j, v = packNet(pk, px, now);
    if ((prev < 0) !== (v < 0)) { const c = px - st + (st * -prev) / (v - prev); if (flip == null || Math.abs(c - Sx) < Math.abs(flip - Sx)) flip = c; }
    prev = v;
  }
  return { flip, mag, net, g };
}
let staticLive = { t: 0, p: null };
function staticRecompute(force = false) {
  if (!STATIC || !S.state?.options) return;
  const p = lastPrice(); if (p == null) return;
  if (!force && Date.now() - staticLive.t < 60000 && staticLive.p != null && Math.abs(p - staticLive.p) < 2) return;
  const now = Date.now() / 1000;
  for (const o of Object.values(S.state.options)) {
    const pk = o.pack; if (!pk || !o.ratio) continue;
    const Sx = p / o.ratio, r = liveFromPack(pk, Sx, now);
    o.gamma_flip = r.flip; o.magnet = r.mag ?? o.magnet; o.net_gex = r.net; o.underlying = Sx;
    o.regime = r.flip == null ? null : Sx >= r.flip ? "POSITIVE" : "NEGATIVE";
    o.chart = { ...o.chart, gamma_flip: r.flip == null ? null : +(r.flip * o.ratio).toFixed(2), magnet: o.magnet == null ? null : +(o.magnet * o.ratio).toFixed(2) };
    const byK = new Map(r.g.map((x) => [x.k, x]));
    for (const st of o.strikes) { const x = byK.get(st.strike); if (x) { st.call_gex = x.cg; st.put_gex = x.pg; st.net_gex = x.cg + x.pg; } }
  }
  S.state.live = { time: new Date().toISOString(), price: +p.toFixed(2) };
  staticLive = { t: Date.now(), p };
}
// 7d A6: nhãn "OI của phiên trước (…) · settle phiên …" do server gửi ở options.GC.cme.oi_label.
// CME ghi ngày kiểu MM/DD/YYYY (ví dụ 11/13/2026 = 13/11/2026) nên đổi sang DD/MM/YYYY để khỏi đọc nhầm. Không có nhãn → "".
function oiLabelVN(cme) {
  return cme && cme.oi_label ? String(cme.oi_label).replace(/(\d{2})\/(\d{2})\/(\d{4})/g, "$2/$1/$3") : "";
}
const OI_LABEL_TIP = "OI (open interest) trên trang CME ngày D là số của phiên giao dịch TRƯỚC (D-1); giá settle là của ngày D. Ngày của OI được suy ra từ ngày giao dịch liền trước trong danh sách CME (ghi nhận từ một quan sát 29/10/2026, chưa phải chuẩn).";
function renderBuild() {
  const el = $("#buildInfo"); if (!el || !S.state) return;
  const b = S.state.build || S.state.options_updated, cme = S.state.options?.GC?.cme, oiLbl = oiLabelVN(cme);
  const age = b ? (Date.now() - new Date(b)) / 60000 : null;
  el.textContent = `${STATIC ? "Build" : "Engine"} ${b ? new Date(b).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "—"}${oiLbl ? ` · ${oiLbl}` : cme?.trade_date ? ` · CME phiên ${cme.trade_date}` : ""}${STATIC && age > 90 ? " · máy tính chưa gửi bản mới" : ""}`;
  const stl = cmeStale(cme);   // 7f: cảnh báo CME chậm
  if (stl) el.textContent += ` · ⚠ ${stl.txt}`;
  el.style.color = stl ? "#ffb300" : "";
  if (oiLbl) el.title = OI_LABEL_TIP + (stl ? "\n⚠ " + stl.txt + ". Dashboard không thấy giờ đăng, chỉ so được ngày giao dịch với phiên lẽ ra đã có." : "");
  el.className = "build" + (STATIC && age > 24 * 60 ? " old" : "");
}
async function copyTV(e) {
  const btn = e.currentTarget;
  try {
    const r = await (await fetch(API("/api/tv") + (STATIC ? "?t=" + Date.now() : ""))).json();
    if (!r.blob) throw new Error("chưa có dữ liệu");
    await navigator.clipboard.writeText(r.blob); btn.textContent = "✓ Đã copy";
  } catch (err) { btn.textContent = "Không copy được"; }
  setTimeout(() => { btn.textContent = "Copy cho TradingView"; }, 2500);
}
// chạm để xem giải thích (điện thoại không rê chuột được): chạm phần tử có title → hiện hộp; chạm lần nữa để ẩn
function initTouchTips() {
  if (!("ontouchstart" in window)) return;
  const tip = document.createElement("div"); tip.className = "tip"; tip.hidden = true; document.body.appendChild(tip);
  let cur = null;
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[title]");
    if (!el || el === cur) { tip.hidden = true; cur = null; return; }
    if (el.matches("button, select, input, a")) return;
    cur = el; tip.textContent = el.getAttribute("title"); tip.hidden = false;
    const r = el.getBoundingClientRect();
    tip.style.top = `${window.scrollY + r.bottom + 6}px`; tip.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 300))}px`;
  });
}
function initStatic() {
  document.body.classList.add("static");
  for (const id of ["#btnRefresh", "#mt5Box"]) { const el = $(id); if (el) el.hidden = true; }
  $("#btnAI").textContent = "Xem nhận định AI";
  const n = document.createElement("p"); n.className = "muted small"; n.textContent = "Bản web: dữ liệu Options và nhận định AI do máy tính cập nhật (lịch 13:30 mỗi ngày; AI thêm khi bấm \"AI phân tích\" trên board máy tính). Giá chạy live.";
  $(".llm")?.appendChild(n);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => { });
}

// ─────────────────────────── Nhật ký tín hiệu live + thống kê + backtest SMC ───────────────────────────
// Board ghi mỗi tín hiệu live (Options Flow) và mỗi lệnh SMC đã khớp trong 24 giờ vào data/journal.json (qua /api/journal),
// rồi tự theo dõi chạm TP1 / SL (cùng nến: tính SL trước). R: TP1 = +RR, SL = −1.
const J_CLOSED = ["tp1", "sl", "expired"];
S.journal = []; S.jTab = "live"; S.bt = null;
async function journalLoad() {
  try { S.journal = (await (await fetch(API("/api/journal"))).json()).entries || []; } catch { S.journal = []; }
  renderJournal();
}
function jPost(list) {
  if (STATIC || !list.length) return;
  fetch("/api/journal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries: list }) }).catch(() => { });
}
function jUpsert(e) {
  const i = S.journal.findIndex((x) => x.id === e.id);
  if (i < 0) { S.journal.push(e); return e; }
  const o = S.journal[i];
  if (J_CLOSED.includes(o.status) && !J_CLOSED.includes(e.status)) return null;
  if (o.status === e.status && o.entry === e.entry) return null;
  S.journal[i] = { ...o, ...e }; return S.journal[i];
}
const jR = (e, exit) => { const d = e.side === "BUY" ? 1 : -1, risk = (e.entry - e.sl) * d; return risk > 0 ? ((exit - e.entry) * d) / risk : null; };
function jFromOF(s) {
  return { id: `OF|${s.type}|${s.side}|${s.time}`, t: s.time, kind: "OF", name: s.type.replace("[Options Flow] ", "").replace(/ \(.*\)$/, "").split(":")[0],
    type: s.type, side: s.side, entry: s.entry, sl: s.sl, tp1: s.tp1, tp2: s.tp2, tf: S.tf, status: "open", score: `${s.score}/${s.max}` };
}
function jFromSMC(o) {
  const c = S.candles, t = c[o.fillI].time, st = o.status === "tp1" ? "tp1" : o.status === "sl" ? "sl" : "open";
  const e = { id: `SMC|${o.name}|${o.side}|${S.tf}|${t}`, t, kind: "SMC", name: o.name, type: o.txt, side: o.side, entry: o.entry, sl: o.sl, tp1: o.tp1, tp2: o.tp2, tf: S.tf, status: st };
  if (st !== "open" && o.closeI != null && c[o.closeI]) { e.closeT = c[o.closeI].time; e.exit = st === "tp1" ? o.tp1 : o.sl; e.r = st === "tp1" ? jR(e, o.tp1) : -1; }
  return e;
}
// lệnh SMC đã khớp trong 24 giờ qua (lệnh SMC tính lại được từ nến đã đóng nên ghi cả khi board vừa mở)
function journalSyncSMC() {
  if (!S.smc) return;
  const since = nowSec() - 86400, out = [];
  for (const o of smcOrders()) if (o.fillI != null && S.candles[o.fillI] && S.candles[o.fillI].time >= since) { const e = jUpsert(jFromSMC(o)); if (e) out.push(e); }
  jPost(out);
}
// Options Flow: theo dõi kết quả bằng nến của khung đang mở (hết hạn sau 2 ngày không chạm)
function journalTrack() {
  const c = S.candles, out = [];
  if (!c.length) return;
  for (const e of S.journal) {
    if (e.kind !== "OF" || e.status !== "open" || e.tp1 == null) continue;
    const d = e.side === "BUY" ? 1 : -1;
    for (const k of c) {
      if (k.time <= e.t || k === c[c.length - 1]) continue;   // bỏ nến tín hiệu và nến đang chạy
      const hitSL = d > 0 ? k.low <= e.sl : k.high >= e.sl, hitTP = d > 0 ? k.high >= e.tp1 : k.low <= e.tp1;
      if (hitSL || hitTP) { Object.assign(e, { status: hitSL ? "sl" : "tp1", closeT: k.time, exit: hitSL ? e.sl : e.tp1, r: hitSL ? -1 : jR(e, e.tp1) }); out.push(e); break; }
    }
    if (e.status === "open" && nowSec() - e.t > 2 * 86400 && c[0].time < e.t) { Object.assign(e, { status: "expired", closeT: nowSec(), r: 0 }); out.push(e); }
  }
  jPost(out);
}
// thống kê một danh sách lệnh {status, r, t}: theo thứ tự thời gian
function statsOf(list) {
  const done = list.filter((x) => x.status === "tp1" || x.status === "sl").sort((a, b) => (a.closeT ?? a.t) - (b.closeT ?? b.t));
  let R = 0, pk = 0, dd = 0, ls = 0, mls = 0, w = 0;
  for (const x of done) {
    const r = x.status === "tp1" ? (x.r ?? 1) : -1; R += r;
    if (r > 0) { w++; ls = 0; } else { ls++; mls = Math.max(mls, ls); }
    pk = Math.max(pk, R); dd = Math.max(dd, pk - R);
  }
  return { n: list.length, closed: done.length, w, wr: done.length ? (100 * w) / done.length : null, R, avg: done.length ? R / done.length : null, dd, mls, open: list.filter((x) => x.status === "open" || x.status === "pending").length };
}
const statTxt = (st) => `<span>Lệnh <b>${st.n}</b></span><span>Đã đóng <b>${st.closed}</b></span><span>Winrate <b>${st.wr == null ? "—" : st.wr.toFixed(1) + "%"}</b></span>
  <span>Tổng <b class="${st.R >= 0 ? "win" : "loss"}">${sgn(st.R, 1)}R</b></span><span>TB <b>${st.avg == null ? "—" : sgn(st.avg, 2)}R</b></span><span>DD <b>${st.dd.toFixed(1)}R</b></span><span>Thua liền <b>${st.mls}</b></span>`;
function groupRows(list, key) {
  const g = {};
  for (const x of list) (g[key(x)] = g[key(x)] || []).push(x);
  return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => { const st = statsOf(v); return `<tr><td>${esc(k)}</td><td>${st.n}</td><td>${st.w}/${st.closed - st.w}</td><td>${st.wr == null ? "—" : st.wr.toFixed(0) + "%"}</td><td class="${st.R >= 0 ? "win" : "loss"}">${sgn(st.R, 1)}</td><td>${st.dd.toFixed(1)}</td></tr>`; }).join("");
}
const gHead = (t) => `<thead><tr><th>${t}</th><th>Lệnh</th><th>T/B</th><th>WR</th><th>R</th><th>DD</th></tr></thead>`;
const stTxt = { open: "đang chạy", pending: "chờ", tp1: "✓ TP1", sl: "✗ SL", expired: "hết hạn", missed: "lỡ", skip: "bỏ" };
function renderJournal() {
  const box = $("#jOut"); if (!box) return;
  document.querySelectorAll("#jTabs button").forEach((b) => b.classList.toggle("on", b.dataset.t === S.jTab));
  if (S.jTab === "live") {
    const J = S.journal, smc = J.filter((x) => x.kind === "SMC"), of = J.filter((x) => x.kind === "OF");
    const rows = [...J].sort((a, b) => b.t - a.t).slice(0, 40).map((e) => `<tr><td>${vnDate(e.t).slice(5)} ${vnClock(e.t)}</td><td>${e.kind === "SMC" ? "SMC" : "OF"} ${esc(e.name)} <span class="muted">${esc(e.tf || "")}</span></td>
      <td class="${e.side === "BUY" ? "win" : "loss"}">${e.side}</td><td>${fmt(e.entry)}</td><td>${fmt(e.sl)} / ${fmt(e.tp1)}</td><td class="${e.status === "tp1" ? "win" : e.status === "sl" ? "loss" : "muted"}">${stTxt[e.status] || e.status}</td><td>${e.r == null ? "—" : sgn(e.r, 2)}</td></tr>`).join("");
    box.innerHTML = `<div class="hstats"><b>Tất cả</b>${statTxt(statsOf(J))}</div><div class="hstats"><b>SMC</b>${statTxt(statsOf(smc))}</div><div class="hstats"><b>Options Flow</b>${statTxt(statsOf(of))}</div>
      <div class="jgrid"><table class="htable">${gHead("Loại")}<tbody>${groupRows(J, (x) => `${x.kind} ${x.name}`) || `<tr><td colspan="6" class="muted">Chưa có.</td></tr>`}</tbody></table>
      <table class="htable">${gHead("Tháng")}<tbody>${groupRows(J, (x) => vnDate(x.t).slice(0, 7)) || `<tr><td colspan="6" class="muted">Chưa có.</td></tr>`}</tbody></table></div>
      <div class="tablewrap"><table class="htable"><thead><tr><th>Giờ</th><th>Tín hiệu</th><th>Lệnh</th><th>Entry</th><th>SL / TP1</th><th>Kết quả</th><th>R</th></tr></thead><tbody>${rows || `<tr><td colspan="7" class="muted">Chưa có tín hiệu nào được ghi. Board ghi tự động khi có tín hiệu live (SMC ghi cả lệnh đã khớp trong 24 giờ).</td></tr>`}</tbody></table></div>
      <p class="muted small">Options Flow chỉ thống kê được từ khi bắt đầu ghi (chưa có OI lịch sử để backtest). Kết quả tính theo nến, chưa trừ spread/phí.</p>`;
    return;
  }
  const bt = S.bt;
  const head = `<div class="order"><label>Khung <select id="btTf"><option value="15m">M15</option><option value="5m">M5</option></select></label><button id="btRun" class="ghost small">Chạy backtest SMC</button><span class="muted small" id="btMsg">${bt?.msg || "Từ " + (S.cfg?.smc?.h4_from || "").slice(0, 10) + " tới nay, luật như board/Pine."}</span></div>`;
  let body = "";
  if (bt?.orders) {
    const O = bt.orders.filter((o) => o.status !== "skip"), st = statsOf(O.map((o) => ({ ...o, r: o.status === "tp1" ? o.rr : -1, t: o.time, closeT: o.closeT })));
    body = `<div class="hstats"><b>${bt.tf.toUpperCase()}</b>${statTxt(st)}<span>Bỏ (TP1&lt;1R) <b>${bt.orders.length - O.length}</b></span><span>Lỡ/hết hạn <b>${O.filter((o) => o.status === "missed" || o.status === "expired").length}</b></span></div>
      <canvas id="btCv" class="hedgecv" height="110"></canvas>
      <div class="jgrid"><table class="htable">${gHead("CL-KB")}<tbody>${groupRows(O.map((o) => ({ ...o, r: o.rr, t: o.time })), (x) => x.name + " " + x.side)}</tbody></table>
      <table class="htable">${gHead("Tháng")}<tbody>${groupRows(O.map((o) => ({ ...o, r: o.rr, t: o.time })), (x) => vnDate(x.t).slice(0, 7))}</tbody></table></div>
      <p class="muted small">SL trước nếu cùng nến chạm SL và TP1, không tính phí/spread. Nến Binance perp (lọc giờ FXCM), H4 gộp từ 1h neo 18:00 New York.</p>`;
  }
  box.innerHTML = head + body;
  if (bt?.tf) $("#btTf").value = bt.tf;
  $("#btRun").onclick = runBacktest;
  if (bt?.orders) drawEquity(bt.orders.filter((o) => o.status === "tp1" || o.status === "sl"));
}
async function runBacktest() {
  const tf = $("#btTf").value; S.bt = { tf, msg: "Đang tải nến…" }; renderJournal();
  try {
    const get = async (t) => { const r = await (await fetch(API(`/api/klines?tf=${t}`))).json(); if (!r.ok) throw new Error(r.error || "lỗi tải nến"); return r.rows; };
    const mk2 = (r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], vol: r[5], delta: 0 });
    const t0 = h4From(), seed = (a) => { const k = a.findIndex((x) => x.time >= t0); return a.slice(Math.max(0, k - 1)); };
    const [rc, rh] = await Promise.all([get(tf), get("1h")]);
    const c = seed(rc.map(mk2).filter((k) => SMC.fxOpen(k.time))), h4 = seed(SMC.aggregate(rh.map(mk2).filter((k) => SMC.fxOpen(k.time)), H4_SEC));
    const cfg = { ...smcCfg(), kb2: true, tfSec: TF_SEC[tf], tfName: tf === "15m" ? "M15" : "M5", sessionOk: S.cfg?.smc?.session_only ? inUsSession : null };
    const r = SMC.analyze(c, h4, H4_SEC, cfg);
    const orders = r.orders.map((o) => ({ ...o, time: c[o.created].time, closeT: o.closeI != null && c[o.closeI] ? c[o.closeI].time : null }));
    S.bt = { tf, orders, msg: `${c.length} nến ${tf} · ${vnDate(c[0].time)} → ${vnDate(c[c.length - 1].time)}` };
  } catch (e) { S.bt = { tf, msg: "Lỗi: " + e.message }; }
  renderJournal();
}
function drawEquity(done) {
  const cv = $("#btCv"); if (!cv || !done.length) return;
  done.sort((a, b) => (a.closeT ?? a.time) - (b.closeT ?? b.time));
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 300, Hh = 110;
  cv.width = W * dpr; cv.height = Hh * dpr; const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  let R = 0; const eq = [0, ...done.map((o) => (R += o.status === "tp1" ? o.rr : -1))];
  const lo = Math.min(0, ...eq), hi = Math.max(0.5, ...eq), X = (i) => (i / (eq.length - 1 || 1)) * W, Y = (v) => Hh - 8 - ((v - lo) / (hi - lo || 1)) * (Hh - 16);
  ctx.strokeStyle = "#3a4552"; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0)); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = R >= 0 ? C.up : C.down; ctx.lineWidth = 1.6; ctx.beginPath(); eq.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)))); ctx.stroke();
  ctx.font = "10px 'IBM Plex Mono', monospace"; ctx.fillStyle = C.muted; ctx.textBaseline = "top"; ctx.fillText(`Equity (R) · ${done.length} lệnh đóng · ${sgn(R, 1)}R`, 4, 2);
}

// ─────────────────────────── Bước 5: mô phỏng Rebalance Hedge của LP ───────────────────────────
// Backend tính N(ΔP) = số HĐ GC tương đương LP phải MUA (+) / BÁN (−) trên lưới ±100 USD quanh giá lúc tính.
// Board dời theo giá live: N từ giá hiện tại = N(x0 + ΔP) − N(x0), x0 = giá live − giá lúc tính.
const hedgeSt = () => S.state?.hedge || null;
function interp(xs, ys, x) {
  if (!xs?.length) return null;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let i = 1; while (xs[i] < x) i++;
  const a = ys[i - 1], b = ys[i];
  if (a == null || b == null) return a ?? b;
  return a + (b - a) * (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
}
function hedgeFrom(dp, price = lastPrice(), key = "all") {
  const h = hedgeSt(); if (!h || price == null) return null;
  const x0 = price - h.price, xs = h.curve.dp, ys = h.curve[key];
  if (Math.abs(x0 + dp) > xs[xs.length - 1]) return null;
  return interp(xs, ys, x0 + dp) - interp(xs, ys, x0);
}
function hedgePer(price = lastPrice()) { const h = hedgeSt(); return h && price != null ? interp(h.curve.dp, h.curve.per, price - h.price) : null; }
const hTier = (v) => { const h = hedgeSt(), a = Math.abs(v ?? 0); return !h ? "" : a >= h.big ? "LP / Big Boy" : a >= h.mid ? "quỹ vừa" : "nhỏ"; };
const hKind = (v) => (v > 0 ? "−Γ gia tốc (LP hedge thuận chiều giá)" : "+Γ hãm (LP hedge ngược chiều giá)");
const hZoneAt = (price) => (hedgeSt()?.zones || []).find((z) => price >= z.lo && price <= z.hi) || null;
function hNext(price, up) {
  const zs = (hedgeSt()?.zones || []).filter((z) => (up ? z.lo > price : z.hi < price));
  return zs.length ? (up ? zs.reduce((a, z) => (z.lo < a.lo ? z : a)) : zs.reduce((a, z) => (z.hi > a.hi ? z : a))) : null;
}
const nHD = (v) => (v == null ? "—" : `<span class="${v >= 0 ? "up" : "down"}">${v >= 0 ? "MUA" : "BÁN"} ${Math.abs(Math.round(v)).toLocaleString("en-US")}</span>`);
function renderHedge() {
  const box = $("#hedgeOut"); if (!box) return;
  const h = hedgeSt(), p = lastPrice();
  if (!h || p == null) { box.innerHTML = `<p class="muted">Chưa có dữ liệu Options để mô phỏng (cần GC/GLD).</p>`; return; }
  const srcs = h.sources || [];
  const sh = (src, dp) => { const r = h.moves.find((m) => m.dp === dp); return r ? r[src] : null; };
  // bảng: dời theo giá live cho cột Tổng/≤7 ngày; cột từng nguồn lấy tại giá lúc tính
  const rows = h.moves.map((m) => `<tr><td class="${m.dp > 0 ? "up" : "down"}">${m.dp > 0 ? "+" : ""}${m.dp}</td>
    ${srcs.map((src) => `<td>${nHD(sh(src, m.dp))}</td>`).join("")}<td><b>${nHD(hedgeFrom(m.dp, p))}</b></td><td>${nHD(hedgeFrom(m.dp, p, "short"))}</td></tr>`).join("");
  const per = hedgePer(p), z = hZoneAt(p), up = hNext(p, true), dn = hNext(p, false);
  const zTxt = (q, lab) => q ? `${lab} <b>${fmt(q.lo)}–${fmt(q.hi)}</b> (đỉnh ${Math.abs(q.peak).toLocaleString("en-US")} HĐ/${h.win}$, ${q.kind === "accel" ? "−Γ gia tốc" : "+Γ hãm"})` : `${lab} không có trong ±100 USD`;
  box.innerHTML = `<p class="hedgehead">Tại ${fmt(p)}: mỗi ${h.win} USD LP giao dịch ≈ <b>${Math.abs(Math.round(per ?? 0)).toLocaleString("en-US")} HĐ GC</b> · cỡ <b>${hTier(per)}</b> · ${per == null ? "" : hKind(per)}${z ? ` · <span class="hz">ĐANG TRONG VÙNG HEDGE LỚN</span>` : ""}</p>
    <div class="tablewrap"><table class="htable hedge"><thead><tr><th>ΔP USD</th>${srcs.map((s) => `<th>${s}</th>`).join("")}<th>Tổng</th><th title="Chỉ các kỳ đáo hạn ≤ 7 ngày">≤ 7 ngày</th></tr></thead><tbody>${rows}</tbody></table></div>
    <canvas id="hedgeCv" class="hedgecv" height="120"></canvas>
    <p class="small">${zTxt(up, "↑ Vùng hedge lớn phía trên:")}<br>${zTxt(dn, "↓ Vùng hedge lớn phía dưới:")}</p>`;
  $("#hedgeMeta").textContent = `GC${srcs.includes("GLD") ? " + GLD" : ""} · tính lúc ${new Date(h.time).toLocaleTimeString("vi-VN")} ở ${fmt(h.price)}`;
  drawHedgeCurve(h, p);
}
function drawHedgeCurve(h, p) {
  const cv = $("#hedgeCv"); if (!cv) return;
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 300, Hh = 120;
  cv.width = W * dpr; cv.height = Hh * dpr; const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const xs = h.curve.dp.map((d) => h.price + d), per = h.curve.per;
  const vmax = Math.max(h.big * 1.2, ...per.filter((v) => v != null).map(Math.abs));
  const X = (x) => ((x - xs[0]) / (xs[xs.length - 1] - xs[0])) * W, Y = (v) => Hh / 2 - (v / vmax) * (Hh / 2 - 8);
  ctx.fillStyle = "rgba(255,255,255,.03)"; ctx.fillRect(0, Y(h.big), W, Y(-h.big) - Y(h.big));
  for (const z of h.zones) { ctx.fillStyle = z.kind === "accel" ? "rgba(229,83,75,.16)" : "rgba(38,179,132,.16)"; ctx.fillRect(X(z.lo), 0, Math.max(2, X(z.hi) - X(z.lo)), Hh); }
  ctx.strokeStyle = "#3a4552"; ctx.setLineDash([3, 3]);
  for (const v of [h.big, -h.big, 0]) { ctx.beginPath(); ctx.moveTo(0, Y(v)); ctx.lineTo(W, Y(v)); ctx.stroke(); }
  ctx.setLineDash([]); ctx.lineWidth = 1.6; ctx.beginPath(); let on = false;
  per.forEach((v, i) => { if (v == null) { on = false; return; } const x = X(xs[i]), y = Y(v); on ? ctx.lineTo(x, y) : ctx.moveTo(x, y); on = true; });
  ctx.strokeStyle = C.mag; ctx.stroke();
  const xp = X(p); ctx.strokeStyle = C.fg; ctx.beginPath(); ctx.moveTo(xp, 0); ctx.lineTo(xp, Hh); ctx.stroke();
  ctx.font = "10px 'IBM Plex Mono', monospace"; ctx.fillStyle = C.muted; ctx.textBaseline = "top";
  ctx.textAlign = "left"; ctx.fillText(`${fmt(xs[0], 0)}`, 2, Hh - 12); ctx.textAlign = "right"; ctx.fillText(`${fmt(xs[xs.length - 1], 0)}`, W - 2, Hh - 12);
  ctx.textAlign = "left"; ctx.fillText(`HĐ/${h.win}$  ↑ −Γ gia tốc · ↓ +Γ hãm · vạch ±${h.big}`, 2, 2);
}
function renderAll() { renderQuote(); renderProfile(); renderKpis(); renderMacro(); renderAgent(); renderHedge(); renderJournal(); renderWarn(); renderEngineChip(); renderBuild(); renderPaper(); showAiLast(); drawOverlay(); }

// ─────────────────────────── tài khoản Paper ───────────────────────────
function paperLoad() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(PAPER_KEY) || "null"); } catch { p = null; }
  const start = S.cfg?.risk?.account_size_usd || 10000;
  S.paper = p && typeof p.balance === "number" ? p : { start, balance: start, pos: null, hist: [] };
}
function paperSave() { try { localStorage.setItem(PAPER_KEY, JSON.stringify(S.paper)); } catch { /* bỏ qua */ } }
const oz = () => S.cfg?.risk?.contract_oz || 100;
function pnlOf(pos, price) { return (price - pos.entry) * (pos.side === "BUY" ? 1 : -1) * pos.lots * oz(); }
function paperOpen(side, lots, sl, tp, note) {
  const p = lastPrice(); if (p == null || S.paper.pos) return;
  S.paper.pos = { side, lots: +lots || 0.01, entry: p, sl: sl ?? null, tp: tp ?? null, time: nowSec(), note: note || "" };
  paperSave(); renderPaper(); drawPlanLines();
}
function paperClose(price, reason) {
  const pos = S.paper.pos; if (!pos) return;
  const pnl = pnlOf(pos, price), risk = pos.sl != null ? Math.abs(pos.entry - pos.sl) * pos.lots * oz() : null;
  S.paper.balance += pnl;
  S.paper.hist.push({ ...pos, exit: price, closed: nowSec(), pnl, r: risk ? pnl / risk : null, reason });
  S.paper.pos = null; paperSave(); renderPaper(); drawPlanLines();
}
function paperTick(price) {
  const pos = S.paper?.pos; if (!pos) { return; }
  const buy = pos.side === "BUY";
  if (pos.sl != null && (buy ? price <= pos.sl : price >= pos.sl)) return paperClose(pos.sl, "SL");
  if (pos.tp != null && (buy ? price >= pos.tp : price <= pos.tp)) return paperClose(pos.tp, "TP");
  renderPaperNums();
}
function drawPlanLines() {
  S.planLines.forEach((l) => candleS.removePriceLine(l)); S.planLines = [];
  const pos = S.paper?.pos; if (!pos) return;
  const add = (price, color, title, style) => price != null && S.planLines.push(candleS.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title }));
  add(pos.entry, pos.side === "BUY" ? C.up : C.down, `${pos.side} ${pos.lots}`, 0);
  add(pos.sl, C.down, "SL", 2); add(pos.tp, C.up, "TP", 2);
}
function renderPaperNums() {
  const P = S.paper, p = lastPrice(), open = P.pos && p != null ? pnlOf(P.pos, p) : 0;
  const closed = P.hist.reduce((a, h) => a + h.pnl, 0);
  $("#acctNums").innerHTML = `<div><small>Balance</small>$${fmt(P.balance, 0)}</div><div><small>Equity</small>$${fmt(P.balance + open, 0)}</div>
    <div><small>Lãi/lỗ mở</small><span class="${open >= 0 ? "win" : "loss"}">${sgn(open, 0)}</span></div><div><small>Đã chốt</small><span class="${closed >= 0 ? "win" : "loss"}">${sgn(closed, 0)}</span></div>`;
  $("#openPos").innerHTML = P.pos ? `<div class="row"><b class="${P.pos.side === "BUY" ? "win" : "loss"}">${P.pos.side} ${P.pos.lots} lot</b><span>@ ${fmt(P.pos.entry)}</span><span>SL ${fmt(P.pos.sl)}</span><span>TP ${fmt(P.pos.tp)}</span><span>${vnClock(P.pos.time)}</span>${P.pos.note ? `<span class="muted">${esc(P.pos.note)}</span>` : ""}</div>` : `<span class="muted small">Không có lệnh đang mở.</span>`;
}
function renderPaper() {
  if (!S.paper) return;
  renderPaperNums();
  const h = S.paper.hist;
  $("#hTable tbody").innerHTML = [...h].reverse().slice(0, 100).map((x) =>
    `<tr><td>${vnClock(x.closed)}</td><td class="${x.side === "BUY" ? "win" : "loss"}">${x.side} ${x.lots}</td><td>${fmt(x.entry)}</td><td>${fmt(x.exit)}</td><td>${fmt(x.sl)} / ${fmt(x.tp)}</td><td class="${x.r > 0 ? "win" : x.r < 0 ? "loss" : ""}">${x.r == null ? "—" : sgn(x.r, 2)}</td><td class="${x.pnl >= 0 ? "win" : "loss"}">${sgn(x.pnl, 0)}</td></tr>`).join("") || `<tr><td colspan="7" class="muted">Chưa có lệnh nào.</td></tr>`;
  const wins = h.filter((x) => x.pnl > 0), gp = wins.reduce((a, x) => a + x.pnl, 0), gl = -h.filter((x) => x.pnl < 0).reduce((a, x) => a + x.pnl, 0);
  $("#hStats").innerHTML = `<span>Lệnh <b>${h.length}</b></span><span>Thắng <b>${h.length ? Math.round((wins.length / h.length) * 100) : 0}%</b> (${wins.length}/${h.length})</span>
    <span>Tổng <b class="${gp - gl >= 0 ? "win" : "loss"}">${sgn(gp - gl, 0)}$</b></span><span>PF <b>${gl > 0 ? fmt(gp / gl, 2) : "—"}</b></span>`;
}
function exportCsv() {
  const rows = [["open", "close", "side", "lots", "entry", "exit", "sl", "tp", "R", "pnl", "reason", "note"]].concat(S.paper.hist.map((x) => [vnDate(x.time) + " " + vnClock(x.time), vnDate(x.closed) + " " + vnClock(x.closed), x.side, x.lots, x.entry, x.exit, x.sl ?? "", x.tp ?? "", x.r ?? "", x.pnl.toFixed(2), x.reason, `"${(x.note || "").replace(/"/g, '""')}"`]));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" }));
  a.download = `bildol-paper-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
}

// ─────────────────────────── backend ───────────────────────────
async function pollState(first = false) {
  try {
    const st = await (await fetch(API("/api/state") + (STATIC ? "?t=" + Date.now() : ""))).json();
    const changed = JSON.stringify(st.options) !== JSON.stringify(S.state?.options);
    S.state = st; S.cfg = st.config;
    if (first) return;
    // chênh lệch đổi > 0.6 USD so với lúc vẽ -> tải lại nến cho khớp giá broker
    if (S.feed && Math.abs(basisNow(S.feed.symbol) - (S.basis || 0)) > 1.0) { startFeed(); return; }
    if (STATIC) staticRecompute(true);
    if (changed) { runSMC(); replaySignals(); renderPine(); S.profScrolled = false; }
    renderAll();
  } catch { S.state = null; renderEngineChip(); }
}
// Nhận định AI mới nhất do máy tính tự chạy (mỗi 60 phút + sau job 13:30) → tự hiện trên board và bản web
function showAiLast(force = false) {
  const a = S.state?.ai_last, out = $("#aiOut");
  if (!a?.text || (!force && S.aiShown === a.time)) return;
  if (!force && S.aiManual && new Date(S.aiManual) > new Date(a.time)) return;   // đang xem bản vừa bấm tay, mới hơn
  S.aiShown = a.time;
  out.innerHTML = esc(a.text).split(/\n{2,}/).map((p) => `<p>${p.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>")}</p>`).join("");
  $("#aiMeta").textContent = `${a.auto ? "Tự chạy" : "Bấm tay"} · ${new Date(a.time).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}`;
}
async function askAI() {
  if (STATIC) {
    if (S.state?.ai_last?.text) showAiLast(true);
    else $("#aiOut").innerHTML = `<p class="muted">Chưa có nhận định AI nào. Máy tính chạy AI lúc 13:30 mỗi ngày và mỗi lần bấm "AI phân tích" trên board máy tính.</p>`;
    return;
  }
  const btn = $("#btnAI"), out = $("#aiOut"), c = S.candles, last = c[c.length - 1], sc = S.cfg.signals;
  btn.disabled = true; out.innerHTML = `<p class="muted">Claude đang đọc dữ liệu và lập kịch bản… (10–60 giây)</p>`;
  const vavg = c.slice(-sc.vol_sma - 1, -1).reduce((a, x) => a + x.vol, 0) / sc.vol_sma, d = divAt(c.length - 1), ag = agentState();
  const body = {
    price: lastPrice(),
    flow: { lenh_lon: (() => { const f = bigFlow(sc.cvd_slope_bars); return f ? { nguong_oz: S.big.thr, rong_oz_5_nen: f.d, mua_lon_oz_5_nen: f.b, ban_lon_oz_5_nen: f.s, so_lenh_mua: f.nb, so_lenh_ban: f.ns, so_lenh: f.n, cvd_lenh_lon_phien: last?.bigcvd, ghi_chu: "giao dịch khớp ≥ ngưỡng trên Binance (đại diện một phần)" } : null; })(), cvd_phien: last?.cvd, cvd_doc_5_nen: c.length > 6 ? last.cvd - c[c.length - 6].cvd : null, volume_so_voi_tb: vavg ? last.vol / vavg : null, phan_ky: d.bear ? "âm" : d.bull ? "dương" : "không", khung: S.tf, wall_chinh: S.primary, agent: ag ? { act: ag.act, regime: ag.regime, target: ag.target, conviction: ag.conv } : null,
      smc: S.smc ? { cau_truc: S.smc.struct, ke_hoach: S.smc.plan, lenh: smcOrders().slice(-4).map((o) => ({ gio_vn: vnClock(S.candles[o.created]?.time ?? 0), loai: o.txt, huong: o.side, trang_thai: o.status, entry: o.entry, sl: o.sl, tp1: o.tp1, tp2: o.tp2, tp3: o.tp3 })) } : null },
    signals: S.signals.slice(-3).map((s) => ({ gio_vn: vnClock(s.time), loai: s.type, huong: s.side, diem: `${s.score}/${s.max}`, entry: s.entry, sl: s.sl, tp1: s.tp1, tp2: s.tp2 })),
    candles: c.slice(-30).map((x) => [vnClock(x.time), +x.open.toFixed(2), +x.high.toFixed(2), +x.low.toFixed(2), +x.close.toFixed(2), Math.round(x.vol), Math.round(x.delta)]),
  };
  try {
    const res = await (await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
    if (!res.ok) { out.innerHTML = `<p class="loss">${esc(res.error)}</p><p class="muted small">Nhập key: nhấp đúp DAT_API_KEY.bat trong thư mục bildol-gold-terminal.</p>`; return; }
    out.innerHTML = esc(res.text).split(/\n{2,}/).map((p) => `<p>${p.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>")}</p>`).join("");
    $("#aiMeta").textContent = `${res.model || "Claude"} · ${new Date().toLocaleTimeString("vi-VN")}${res.web ? " · đã gửi lên web (≈1–3 phút sau mở link sẽ thấy)" : ""}`;
    S.aiManual = new Date().toISOString();
  } catch (e) { out.innerHTML = `<p class="loss">Không gọi được backend: ${esc(e.message)}</p>`; }
  finally { btn.disabled = false; }
}
async function loadMt5() {
  const out = $("#mt5Out");
  try {
    const r = await (await fetch("/api/account")).json();
    if (!r.ok) { out.textContent = r.error; return; }
    out.innerHTML = `<p>${esc(r.account.server)} · #${r.account.login} · Balance ${fmt(r.account.balance)} · Equity ${fmt(r.account.equity)}</p>` +
      (r.positions.map((p) => `<div>${p.type} ${esc(p.symbol)} ${p.volume} @ ${fmt(p.price_open)} · PnL ${fmt(p.profit)}</div>`).join("") || "<div>Không có lệnh XAU đang mở.</div>");
  } catch { out.textContent = "Không đọc được /api/account."; }
}

// ─────────────────────────── sự kiện ───────────────────────────
function bind() {
  // 7i: nhớ bật/tắt 6 nút lớp qua F5 (localStorage "tvlb.layers"). Chưa bấm nút nào thì giữ mặc định của trang. Không đổi số liệu nào.
  const LY_IDS = ["#lyKey", "#lyGLD", "#lyGex", "#lyVP", "#lySMC", "#lyMk"];
  let lySaved = {};
  try { lySaved = JSON.parse(localStorage.getItem("tvlb.layers") || "{}"); } catch { lySaved = {}; }
  if (!lySaved || typeof lySaved !== "object" || Array.isArray(lySaved)) lySaved = {};
  LY_IDS.forEach((id) => {
    const el = $(id); if (!el) return;
    if (typeof lySaved[id] === "boolean") el.checked = lySaved[id];
    el.addEventListener("change", () => { lySaved[id] = !!el.checked; try { localStorage.setItem("tvlb.layers", JSON.stringify(lySaved)); } catch { } });
  });
  $("#tfs").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    document.querySelectorAll("#tfs button").forEach((x) => x.classList.toggle("on", x === b));
    S.tf = b.dataset.tf; try { localStorage.setItem("bildol.tf", S.tf); } catch { } startFeed();
  });
  ["#lyKey", "#lyGLD", "#lyGex", "#lyVP"].forEach((s) => $(s).addEventListener("change", drawOverlay));
  $("#lyMk").addEventListener("change", setMarkers);
  $("#lySMC").addEventListener("change", () => { setMarkers(); drawOverlay(); });
  $("#primarySrc").addEventListener("change", (e) => { S.primary = e.target.value; try { localStorage.setItem("bildol.primary", S.primary); } catch { } replaySignals(); renderAll(); });
  $("#profTabs").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    document.querySelectorAll("#profTabs button").forEach((x) => x.classList.toggle("on", x === b));
    S.profSrc = b.dataset.src; S.profScrolled = false; renderProfile();
  });
  $("#tenorSel")?.addEventListener("change", (e) => {
    S.tenor = e.target.value; S.profScrolled = false;
    try { localStorage.setItem("bildol.tenor", S.tenor); } catch { }
    renderProfile(); drawOverlay();
  });
  $("#btnRefresh").addEventListener("click", async () => {
    const b = $("#btnRefresh"); b.disabled = true; b.textContent = "Đang làm mới…";
    await fetch("/api/refresh", { method: "POST" }).catch(() => { });
    setTimeout(async () => { await pollState(); b.disabled = false; b.textContent = "Làm mới Options"; }, 20000);
  });
  $("#btnAI").addEventListener("click", askAI);
  $("#btnCopyTV")?.addEventListener("click", copyTV);
  const num = (id) => { const v = parseFloat($(id).value); return isFinite(v) ? v : null; };
  $("#oBuy").addEventListener("click", () => paperOpen("BUY", num("#oLots"), num("#oSL"), num("#oTP"), "Thủ công"));
  $("#oSell").addEventListener("click", () => paperOpen("SELL", num("#oLots"), num("#oSL"), num("#oTP"), "Thủ công"));
  $("#oSig").addEventListener("click", () => {
    const s = S.signals[S.signals.length - 1]; if (!s) { $("#openPos").innerHTML = `<span class="muted small">Chưa có tín hiệu hôm nay.</span>`; return; }
    $("#oLots").value = planFor(s).lots.toFixed(2); $("#oSL").value = s.sl.toFixed(2); $("#oTP").value = s.tp1 != null ? s.tp1.toFixed(2) : "";
  });
  $("#oClose").addEventListener("click", () => { const p = lastPrice(); if (p != null) paperClose(p, "Đóng tay"); });
  let resetArmed = false;
  $("#oReset").addEventListener("click", (e) => {
    if (!resetArmed) { resetArmed = true; e.target.textContent = "Bấm lần nữa để xác nhận"; setTimeout(() => { resetArmed = false; e.target.textContent = "Đặt lại tài khoản"; }, 4000); return; }
    const start = S.cfg?.risk?.account_size_usd || 10000; S.paper = { start, balance: start, pos: null, hist: [] }; paperSave(); renderPaper(); drawPlanLines();
    resetArmed = false; e.target.textContent = "Đặt lại tài khoản";
  });
  $("#hExport").addEventListener("click", exportCsv);
  $("#jTabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; S.jTab = b.dataset.t; renderJournal(); });
  $("#mt5Box").addEventListener("toggle", (e) => { if (e.target.open) loadMt5(); });
  document.addEventListener("click", () => { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); }, { once: true });
}

async function boot() {
  if (!LC) { $("#warn").hidden = false; $("#warn").textContent = "Không tải được thư viện biểu đồ (cần Internet)."; return; }
  try { S.primary = localStorage.getItem("bildol.primary") || "GC"; S.tf = localStorage.getItem("bildol.tf") || "15m"; S.tenor = localStorage.getItem("bildol.tenor") || "all"; } catch { }
  if (!TENOR_TXT[S.tenor]) S.tenor = "all";
  if ($("#tenorSel")) $("#tenorSel").value = S.tenor;
  $("#primarySrc").value = S.primary;
  document.querySelectorAll("#tfs button").forEach((x) => x.classList.toggle("on", x.dataset.tf === S.tf));
  if (STATIC) initStatic();
  await pollState(true);
  if (!S.state) { $("#warn").hidden = false; $("#warn").textContent = STATIC ? "Chưa tải được dữ liệu (state.json). Kiểm tra mạng rồi mở lại." : "Không kết nối được backend. Hãy chạy MO_DASHBOARD.bat và giữ cửa sổ đen đó mở."; return; }
  // Không có GC thì mặc định dùng GLD cho Strike Profile
  if (!opt("GC") && opt("GLD")) { S.profSrc = "GLD"; document.querySelectorAll("#profTabs button").forEach((x) => x.classList.toggle("on", x.dataset.src === "GLD")); }
  void 0;
  paperLoad();
  initCharts(); initOverlay(); bind(); ofInitUI(); initTouchTips();
  await startFeed();
  if (STATIC) { staticRecompute(true); renderAll(); }
  drawPlanLines(); renderPine();
  await journalLoad(); journalSyncSMC(); journalTrack(); renderJournal();
  setInterval(pollState, STATIC ? 120000 : 20000);
  if (STATIC) setInterval(() => { staticRecompute(); renderProfile(); renderAgent(); renderHedge(); drawOverlay(); }, 30000);
  setInterval(() => { renderMacro(); renderEngineChip(); renderAgent(); }, 30000);
}
boot();
