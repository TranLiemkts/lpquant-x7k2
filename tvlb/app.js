/* TVLB (từ Bildol Gold Terminal của anh Thắng; sửa 1 dòng: ẩn vạch strike phụ theo menu TVLB+) — giao diện kiểu RyanFX.
   Giá realtime: Binance XAUUSDT perp (dự phòng PAXG/USDT; kline có taker-buy volume => CVD theo phe chủ động).
   Mốc Options / vĩ mô: backend /api/state, làm mới mỗi 20 giây.
   Lớp phủ (canvas) vẽ mốc GC bên trái, GLD bên phải, đường cong Net GEX ngay trên chart.
   SMC (smc.js): cấu trúc H4 + khung chart, OTE/Extreme, thanh khoản, nến quét, CL1 Buy/Sell hồi & CL2 thuận (KB1/KB2/KB3). */
"use strict";
// B9b5c-3 (25/11/2026): THIẾT LẬP MẶC ĐỊNH khi trình duyệt mở dashboard LẦN ĐẦU (chụp từ máy anh lúc 21:44 25/11).
// Chỉ ghi khóa nào CHƯA có → trình duyệt đã có thiết lập riêng thì giữ nguyên. Bỏ: nhật ký lệnh, KH1–3 (trang «Vào lệnh» đã bỏ), tài khoản Paper.
// Trang mở đầu = «Vào lệnh OF» (pg 6). Muốn quay về mặc định: F12 → Console → gõ  tvlbResetDefaults()  → Enter.
const TVLB_DEFAULTS = {
 "bildol.tf": "5m",
 "bildol.primary": "GC",
 "tvlb.layers": "{\"#lyGex\":true,\"#lySMC\":true,\"#lyKey\":true,\"#lyGLD\":true,\"#lyVP\":true,\"#lyMk\":true}",
 "tvlb.of": "{\"minConf\":2,\"x_regime\":true,\"x_near\":true,\"boxMax\":5,\"boxRun\":false,\"session\":false,\"x_flipnear\":true}",
 "tvlb.o3": "{\"thSt\":false,\"thSg\":false,\"sig\":false,\"kh\":false,\"box\":true,\"snd\":true,\"tg\":true,\"tout\":36,\"k\":{\"wall\":false,\"oh\":false,\"oht\":false,\"conf\":false,\"pro\":false,\"m\":false,\"sw\":false},\"minG\":\"C\",\"kh1\":false,\"kh2\":false,\"kh3\":false,\"tpm\":\"auto\",\"boxn\":3,\"slmax\":0,\"al\":{\"kh\":false,\"khz\":false,\"sig\":true,\"hedge\":true,\"div\":true,\"news\":true},\"sty\":\"beep\",\"vol\":60,\"diff\":true,\"minor\":false,\"topn\":5,\"wst\":2,\"wh\":true}",
 "tvlb.tip": "{\"st\":true,\"sg\":false,\"of\":true,\"prem\":false,\"ext\":false,\"fib\":false,\"kb2\":false,\"liq\":false,\"tl\":true,\"hl\":false,\"bos\":false,\"swp\":false,\"form\":true,\"ord\":false,\"fill\":false}",
 "tvlb.plus": "{\"tips\":true,\"fast\":true,\"cd\":true,\"grid\":false,\"compact\":false}",
 "tvlb.p3": "true",
 "tvlb.ofsz": "{\"t\":false,\"w\":false}",
 "tvlb.ofrun": "{\"st\":\"closed\",\"k\":\"wall\"}",
 "tvlb.menuopen": "{\"view\":true,\"hub\":false,\"tip\":false,\"of\":false,\"tp\":false}",
 "tvlb.wide": "false",
 "tvlb.layout": "{\"pg\":\"6\",\"max\":{\"4\":\"\",\"5\":\"\"}}"
};
(function () {
  try {
    if (localStorage.getItem("tvlb.defInit") === "1") return;
    let n = 0;
    for (const [k, v] of Object.entries(TVLB_DEFAULTS)) if (localStorage.getItem(k) == null) { localStorage.setItem(k, v); n++; }
    localStorage.setItem("tvlb.defInit", "1");
    if (n) location.reload();   // một lần duy nhất: để các file nạp trước app.js cũng đọc đúng thiết lập
  } catch (e) { }
})();
window.tvlbResetDefaults = function () {
  try { for (const k of Object.keys(TVLB_DEFAULTS)) localStorage.removeItem(k); localStorage.removeItem("tvlb.defInit"); } catch (e) { }
  location.reload();
};
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
  return ({ "/api/state": "state.json", "/api/tv": "tv.json", "/api/journal": "journal.json", "/api/settings": "settings.json", "/api/walls9a": "walls9a.json" })[path] || p;
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
      labs.push({ p, sell: p.side === "SELL", y: p.side === "SELL" ? top - 2 : top + h + 12, col, t: `${p.short} ${p.side} · ${p.state}${p.chk && p.chk.tot ? " · " + (p.blocked ? ofSimple(p.chk).replace("⛔ ", "") : ofSimple(p.chk)) + (p.chk.time ? " · " + vnClock(p.chk.time) : "") : ""}` });   // SELL: nhãn nằm TRÊN vùng · BUY: nhãn nằm DƯỚI vùng
    }
    const up = labs.filter((l) => l.sell).sort((u, v) => v.y - u.y), dn = labs.filter((l) => !l.sell).sort((u, v) => u.y - v.y);
    for (let j = 1; j < up.length; j++) if (up[j - 1].y - up[j].y < 13) up[j].y = up[j - 1].y - 13;   // nhãn SELL sát nhau: xếp chồng lên trên
    for (let j = 1; j < dn.length; j++) if (dn[j].y - dn[j - 1].y < 13) dn[j].y = dn[j - 1].y + 13;   // nhãn BUY sát nhau: xếp chồng xuống dưới
    ctx.font = "600 10px 'IBM Plex Mono', monospace"; ctx.textAlign = "right"; ctx.textBaseline = "bottom";
    for (const l of labs) { const w = ctx.measureText(l.t).width; ctx.fillStyle = "rgba(10,14,20,.88)"; ctx.fillRect(plotW - 9 - w, l.y - 11, w + 6, 12); ctx.fillStyle = `rgb(${l.col})`; ctx.fillText(l.t, plotW - 6, l.y); ov.tags.push({ x0: plotW - 9 - w, x1: plotW - 3, y0: l.y - 12, y1: l.y + 2, k: "zone", tip: ofStateTip(l.p) }); }
  }

  // TVLB B9b0: khung đo SL/TP kiểu TradingView + dấu vào lệnh cho các tín hiệu Option Flow hôm nay
  if (ofOn("rr") && S.ofChk && S.ofChk.checked && (S.signals.length || (S.of9Sig && S.of9Sig.length))) {
    const tsc = chart.timeScale(), cc = S.candles, P = (v) => candleS.priceToCoordinate(v);
    ctx.font = "500 8.5px 'IBM Plex Mono', monospace"; ctx.textBaseline = "middle";   // v23am-3: chữ nhỏ, mảnh, không nền
    const rrLab = []; let rrN = 0;
    for (const g of boxList()) {
      const x0 = tsc.timeToCoordinate(g.time + TZ); if (x0 == null || x0 > plotW) continue;
      const nx = cc[g.i + 1] ? tsc.timeToCoordinate(cc[g.i + 1].time + TZ) : null, bs = nx != null ? Math.max(3, nx - x0) : 8;
      const mg = rrManage(g, cc), hit = mg.t ? { j: mg.j, t: mg.t, r: mg.r } : null;   // v23am-17
      let x1 = hit ? tsc.timeToCoordinate(cc[hit.j].time + TZ) : null; if (x1 == null) { const xl = tsc.timeToCoordinate(cc[cc.length - 1].time + TZ); x1 = xl != null ? xl + bs : x0 + 14 * bs; }   // v23am-16: lệnh chưa chạm SL/TP = còn mở → khung kéo tới nến hiện tại
      x1 = Math.min(plotW - 2, Math.max(x1, x0 + 6 * bs));
      const yE = P(g.entry), yS = P(g.sl), yT = g.tp1 != null ? P(g.tp1) : null; if (yE == null || yS == null) continue;
      const risk = Math.abs(g.entry - g.sl), gain = g.tp1 != null ? Math.abs(g.tp1 - g.entry) : null, w = x1 - x0;
      if (yT != null) { ctx.fillStyle = "rgba(38,166,154,.07)"; ctx.fillRect(x0, Math.min(yE, yT), w, Math.abs(yT - yE)); }
      ctx.fillStyle = "rgba(239,83,80,.07)"; ctx.fillRect(x0, Math.min(yE, yS), w, Math.abs(yS - yE));
      /* v23am-10: bỏ vạch vàng ngang ở mức vào lệnh — ranh giới giữa khung xanh và đỏ đã thể hiện mức vào */
      ctx.fillStyle = "#f0b429"; ctx.beginPath(); ctx.moveTo(x0, yE - 3); ctx.lineTo(x0 + 3, yE); ctx.lineTo(x0, yE + 3); ctx.lineTo(x0 - 3, yE); ctx.closePath(); ctx.fill();   // dấu vào lệnh (hình thoi)
      const pr = ++rrN;   // v23am-2: nhãn xếp hàng, vẽ sau cùng (tín hiệu mới nhất ưu tiên, nhãn chạm nhau thì bỏ)
      // v23am-4: bỏ nhãn điểm vào lệnh (khung SL/TP đã nằm đúng chỗ vào lệnh; hướng BUY/SELL đã có mũi tên trên nến tín hiệu)
      // v23am-6: TP ở cạnh TP, SL ở cạnh SL, mỗi nhãn căn giữa bề rộng khung đo
      if (yT != null) rrLab.push({ t: `TP ${gain.toFixed(0)} · 1:${(gain / Math.max(risk, 0.01)).toFixed(1)}${hit && hit.t === "chạm TP1" ? " ✓" : ""}`, c: "#26a69a", x: x0 + w / 2, y: yT + (g.side === "BUY" ? 6 : -6), al: "center", pr, o: 1 });
      rrLab.push({ t: `SL ${risk.toFixed(0)}${hit && hit.t === "chạm SL" ? " ✕" : hit && hit.t === "hòa vốn" ? " =BE" : !hit && mg.be ? " →BE" : ""}`, c: "#ef5350", x: x0 + w / 2, y: yS + (g.side === "BUY" ? -6 : 6), al: "center", pr, o: 2 });
      if (!hit && p0 != null) {   // v23am-13: lệnh đang chạy (chưa chạm SL/TP, khung còn trong 14 nến): ghi R hiện tại ở giữa khung
        const pnl = (g.side === "BUY" ? p0 - g.entry : g.entry - p0) / Math.max(risk, 0.01);
        rrLab.push({ t: `${pnl >= 0 ? "+" : "−"}${Math.abs(pnl).toFixed(1)}R`, c: pnl >= 0 ? "#26a69a" : "#ef5350", x: x0 + w / 2, y: (yS + (yT != null ? yT : yE)) / 2, al: "center", pr, o: 0 });
      }
      if (hit && (hit.t === "hết giờ" || hit.t === "hòa vốn" || hit.t === "đóng vì lệnh ngược")) {
        const rr = hit.t === "hòa vốn" ? 0 : hit.r;
        rrLab.push({ t: hit.t === "hòa vốn" ? "BE 0.0R" : `${hit.t === "đóng vì lệnh ngược" ? "⇄" : "⏱"} ${rr >= 0 ? "+" : "−"}${Math.abs(rr).toFixed(1)}R`, c: rr > 0 ? "#26a69a" : rr < 0 ? "#ef5350" : "#9aa4b2", x: x0 + w / 2, y: (yS + (yT != null ? yT : yE)) / 2, al: "center", pr, o: 0 });
      }
      // v23am-12: bỏ nhãn "SL✕/TP✓" riêng — dấu ✕ nằm ngay sau nhãn SL, dấu ✓ ngay sau nhãn TP khi lệnh đã chạm
    }
    rrLab.sort((a, b) => b.pr - a.pr || a.o - b.o);
    const rrBox = [];
    for (const l of rrLab) {
      const w = ctx.measureText(l.t).width, bx0 = l.al === "left" ? l.x : l.al === "center" ? l.x - w / 2 : l.x - w, bx1 = bx0 + w, by0 = l.y - 5, by1 = l.y + 5;
      if (by1 < 0 || by0 > plotH) continue;
      if (rrBox.some((r) => bx0 < r.x1 + 2 && bx1 > r.x0 - 2 && by0 < r.y1 && by1 > r.y0)) continue;   // chạm nhãn đã đặt → bỏ nhãn này (xem số trong bảng Vào lệnh)
      rrBox.push({ x0: bx0, x1: bx1, y0: by0, y1: by1 });
      ctx.textAlign = l.al; ctx.globalAlpha = 0.8; ctx.fillStyle = l.c; ctx.fillText(l.t, l.x, l.y); ctx.globalAlpha = 1;
    }
  }

  // v23am-8: nhãn tín hiệu 2 dòng tự vẽ (thư viện chart không xuống dòng được): dòng trên = điểm xác nhận (tỷ trọng), dòng dưới = buy/sell; mũi tên vẫn do chart vẽ
  if ($("#lyMk") && $("#lyMk").checked && window.TVLB_MK_OF !== false && S.signals.length) {
    const tsc2 = chart.timeScale(), cc2 = S.candles;
    ctx.font = "500 8.5px 'IBM Plex Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.globalAlpha = 0.85;
    const sgBox = [], wSet = new Set();
    try { if (ofOn("watch")) for (const w of ofWatchCached()) if (w.first) wSet.add(w.j + "|" + w.p.side); } catch (e) { /* bỏ qua */ }   // B9b5c-3: nến đã có nhãn «nến quan sát» thì không vẽ thêm nhãn tín hiệu (trước đây 2 nhãn đè nhau)
    for (const g of [...S.signals].reverse()) {   // 9b-5c: lệnh 9A/9B dùng nhãn của nến quan sát (#số ✔), không vẽ lại ở đây để khỏi đè   // mới nhất trước; nhãn chạm nhãn đã đặt thì bỏ (tránh chồng khi nhiều tín hiệu sát nhau)
      const k = cc2[g.i]; if (!k) continue;
      if (wSet.has(g.i + "|" + g.side)) continue;
      const x = tsc2.timeToCoordinate(g.time + TZ); if (x == null || x < 0 || x > plotW) continue;
      const sell = g.side === "SELL", yb = candleS.priceToCoordinate(sell ? k.high : k.low); if (yb == null) continue;
      const bsp = Number(tsc2.options().barSpacing) || 8, off = Math.max(21, Math.min(Math.max(bsp, 12), 30) * 0.7 + 14);   // v23am-11: mũi tên to theo mức zoom → đẩy chữ ra xa theo cỡ mũi tên
      const y1 = sell ? yb - off - 10 : yb + off, y2 = sell ? yb - off : yb + off + 10, nOrd = ofNumOf(g), y0 = sell ? y1 - 10 : y2 + 10;   // 9b-5c: dòng #số nằm xa mũi tên nhất   // SELL: chữ nằm phía trên mũi tên xuống; BUY: phía dưới mũi tên lên
      if (Math.min(y0, y1) < 2 || Math.max(y0, y2) > plotH - 2) continue;
      const tx = `${ofTagName(g)} ✔ ${g.score}/${g.max}`, hw = ctx.measureText(tx).width / 2 + 2;
      if (sgBox.some((r) => x - hw < r.x1 && x + hw > r.x0 && Math.abs(y1 - r.y) < 34)) continue;
      sgBox.push({ x0: x - hw, x1: x + hw, y: y1 });
      ctx.fillStyle = sell ? C.down : C.up;
      ctx.fillText(tx, x, y1);
      ctx.fillText(sell ? "sell" : "buy", x, y2);
      if (nOrd) { ctx.font = "700 9px 'IBM Plex Mono', monospace"; ctx.fillStyle = "#f0b429"; ctx.fillText("#" + nOrd, x, y0); ctx.font = "500 8.5px 'IBM Plex Mono', monospace"; }   // 9b-5c: số thứ tự khớp thẻ «Lệnh hôm nay»
    }
    ctx.globalAlpha = 1;
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
    $("#chartInfo").textContent = P ? `${P.source} · ${P.strikes.length} strikes · ${(() => { const A = bangA(); return A ? `Net GEX tổng GC+GLD ${fmtK(A.g)} (${P.source} ${fmtK(P.net_gex)})` : `Σ ${P.source} ${fmtK(P.net_gex)}`; })()} · ${rg.pct == null ? "?" : `${rg.pct >= 0 ? "+Γ" : "−Γ"} ${rg.pctTxt} Flip`}${(() => { const A = bangA(); return A ? ` · Bảng A ${A.short}` : ""; })()} · mốc chưa kiểm định` : "Chưa có dữ liệu Options";
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
// v23am-17: QUẢN LÝ LỆNH cho khung đo (HG, 9A/9B, TL): (1) lời tới +1R thì dời SL về giá vào (hòa vốn; tắt được trong menu), (2) hết 12:30 Chicago thì đóng lệnh tại giá mở nến đó (tắt được),
// (3) vẫn chạm SL hoặc TP1 trước thì dừng như cũ. Ba luật này là GIẢ THUYẾT chưa backtest (bước 6). Nến chạm SL và +1R cùng một nến: coi như chạm SL trước (thận trọng).
const CHI_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }), chiMemo = new Map();
// B9b5e: đổi giờ Chicago → giờ Việt Nam để theo dõi. Tự theo giờ mùa hè/mùa đông của Mỹ (VN không đổi giờ):
// mùa đông (CST) VN = Chicago + 13 giờ (11:30 → 00:30, 12:30 → 01:30, 20:00 → 09:00 hôm sau); mùa hè (CDT) + 12 giờ.
const VN_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", hour12: false, hour: "2-digit", minute: "2-digit" });
function chiVnShift(t) {   // số phút giờ VN đi trước giờ Chicago tại thời điểm t (giây; bỏ trống = bây giờ)
  const d = new Date((t || Date.now() / 1000) * 1000), pm = (f) => { const q = {}; for (const x of f.formatToParts(d)) q[x.type] = x.value; return (q.hour === "24" ? 0 : +q.hour) * 60 + +q.minute; };
  return ((pm(VN_FMT) - pm(CHI_FMT)) % 1440 + 1440) % 1440;
}
function chiToVn(hm, t) { const [h, m] = String(hm).split(":").map(Number), v = (h * 60 + m + chiVnShift(t)) % 1440; return String(Math.floor(v / 60)).padStart(2, "0") + ":" + String(v % 60).padStart(2, "0"); }
const CHV = (hm, t) => `${chiToVn(hm, t)} giờ VN (${hm} Chicago)`;   // ví dụ "01:30 giờ VN (12:30 Chicago)"
function chiSlot(t) {
  let v = chiMemo.get(t); if (v) return v;
  const q = {}; for (const x of CHI_FMT.formatToParts(new Date(t * 1000))) q[x.type] = x.value;
  v = { d: `${q.year}-${q.month}-${q.day}`, s: ((q.hour === "24" ? 0 : +q.hour) * 60 + +q.minute) >= 750 ? 1 : 0 };   // s=1: đã qua 12:30 giờ Chicago trong ngày
  chiMemo.set(t, v); return v;
}
function boxList() {   // v23am-19: chọn các hộp đo SL/TP cần vẽ theo menu (OFS.boxRun = chỉ hộp đang chạy · OFS.boxMax = số hộp tối đa, 0 = tất cả)
  const cc = S.candles; let a = [...S.signals, ...(S.of9Sig || [])].filter((g) => cc[g.i]).sort((u, v) => u.time - v.time);
  a = a.filter((g) => !rrManage(g, cc).skip);   // 9b-5: lệnh bị bỏ (luật lệnh ngược chiều) không vẽ khung
  if (OFS.boxRun === true) a = a.filter((g) => !rrManage(g, cc).t);
  const n = OFS.boxMax == null ? 8 : +OFS.boxMax; return n > 0 ? a.slice(-n) : a;
}
// 9b-5: rrManage = kết quả HIỂN THỊ (khung đo + thẻ lệnh): luật tự nhiên (rrNatural) + ép đóng/bỏ theo luật lệnh ngược chiều (S.ofForce do ofRefresh dựng). raw=true: bỏ qua ép.
function rrManage(g, cc, closedOnly, raw) {
  if (!raw && S.ofForce && S.ofForce.size) {
    const f = S.ofForce.get(ofKey(g));
    if (f) {
      if (f.skip) return { j: g.i + 1 < cc.length ? g.i + 1 : cc.length - 1, t: "bỏ", r: 0, be: false, skip: true };
      const n = rrNatural(g, cc, closedOnly), jj = Math.min(f.j, cc.length - 1);
      if (n.j == null || n.j >= jj) return { j: jj, t: "đóng vì lệnh ngược", r: f.r, be: rrNatural(g, cc.slice(0, jj), closedOnly).be, forced: true };
      return n;
    }
  }
  return rrNatural(g, cc, closedOnly);
}
function rrNatural(g, cc, closedOnly) {
  if (!cc[g.i]) return { j: null, t: null, be: false };
  const buy = g.side === "BUY", risk = Math.abs(g.entry - g.sl), dir = buy ? 1 : -1, beOn = OFS.beOff !== true, teOn = OFS.teOff !== true;
  let be = false, slE = g.sl; const e0 = chiSlot(cc[g.i].time);
  for (let j = g.i + 1; j < cc.length - (closedOnly ? 1 : 0); j++) {
    const k = cc[j];
    if (teOn) { const c1 = chiSlot(k.time); if (c1.s === 1 && (e0.s === 0 ? c1.d === e0.d : c1.d > e0.d)) return { j, t: "hết giờ", r: (k.open - g.entry) * dir / Math.max(risk, 0.01), be }; }
    if (buy ? k.low <= slE : k.high >= slE) return { j, t: be ? "hòa vốn" : "chạm SL", be };
    if (g.tp1 != null && (buy ? k.high >= g.tp1 : k.low <= g.tp1)) return { j, t: "chạm TP1", be };
    if (beOn && !be && (buy ? k.high >= g.entry + risk : k.low <= g.entry - risk)) { be = true; slE = g.entry; }
  }
  return { j: null, t: null, be };
}
function nextStrike(price, above) {
  const p = prim(); if (!p) return null;
  const xs = p.strikes.map((s) => s.chart).filter((x) => (above ? x > price + 0.01 : x < price - 0.01));
  return xs.length ? (above ? Math.min(...xs) : Math.max(...xs)) : null;
}
// v23am (số 198): tường ĐANG HIỂN THỊ trên chart = cùng bộ lọc với drawOverlayBase (OI ≥ 12% tường lớn nhất, hoặc CW/PW; menu "chỉ tường có nhãn" + "số tường" của TVLB+). Dùng cho TP của nhóm HG.
function hgRRmin() { const v = Number(OFS.minRRhg); return Number.isFinite(v) && OFS.minRRhg !== undefined ? v : HG_RR_DEF; }
function shownLevels() {
  const out = [], layers = [["GC", "#lyKey"], ["GLD", "#lyGLD"]];
  const on = layers.filter(([src, sel]) => opt(src) && $(sel) && $(sel).checked);
  const use = on.length ? on.map((x) => x[0]) : [prim()?.source].filter(Boolean);   // v23am-2: lớp GC và GLD đang bật đều được tính (như chart); tắt hết thì dùng nguồn chính
  for (const src of use) {
    const o = opt(src); if (!o || !Array.isArray(o.strikes) || !o.strikes.length) continue;
    const oiOf = (s) => s.call_oi + s.put_oi, maxOI = Math.max(1, ...o.strikes.map(oiOf));
    const top = new Set([...o.strikes].sort((x, y) => oiOf(y) - oiOf(x)).slice(0, window.TVLB_TOPN || 10).map((s) => s.strike));
    for (const s of o.strikes) {
      const cwpw = s.strike === o.call_wall || s.strike === o.put_wall;
      if (oiOf(s) / maxOI < 0.12 && !cwpw) continue;
      if ((window.TVLB_MINOR === false || wallStyle() === "old") && !top.has(s.strike) && !cwpw) continue;
      if (typeof s.chart === "number") out.push(s.chart);
    }
  }
  const mg = prim()?.chart?.magnet;   // v23am-3: Magnet (vạch ◎ đang hiện khi lớp GC Levels bật) cũng là mốc TP
  if (typeof mg === "number" && $("#lyKey") && $("#lyKey").checked) out.push(mg);
  return out;
}
function nextWall(price, above) {
  const xs = shownLevels().filter((x) => (above ? x > price + 0.01 : x < price - 0.01));
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
const HG_RR_DEF = 2;
const OFS = (() => { try { const o = JSON.parse(localStorage.getItem(OF_LS) || "{}"); return o && typeof o === "object" && !Array.isArray(o) ? o : {}; } catch { return {}; } })();
const ofOn = (k) => OFS[k] !== false;
// TVLB B9b1: bộ lọc theo anh Nam, MẶC ĐỊNH TẮT (= hành vi TL1/TL2 cũ). Chỉ bật khi bạn tick ở hộp "Bật/tắt điều kiện". Chờ anh Nam xác nhận câu 4, 5 (bản 3.3).
const ofX = (k) => OFS[k] === true;
const ofFlipNear = () => (Number.isFinite(OFS.flipNear) && OFS.flipNear > 0 ? OFS.flipNear : 20);   // v23ab: ngưỡng $ cho ô "Flip GẦN giá" (giả thuyết, chọn theo ý bạn 10-20$)
// 9b-4: ô chọn «Cách dùng Flip» thay 3 ô tick. Đọc từ 3 cờ cũ (x_noflip thắng 2 cờ kia, đúng như code chạy trước đây); logic tín hiệu KHÔNG đổi.
const OF_FLIP_OPTS = [["near", "Giá trong VÙNG ĐỆM quanh Flip thì đứng ngoài, theo loại lệnh (anh Nam 25/11, mặc định)"], ["off", "Không lọc Flip (chỉ để so)"]];
// B9b5c-3: anh Nam 25/11 — Flip XA không phải lý do chặn; vùng nhạy là GẦN Flip. Bỏ các chế độ «Flip xa», «xa hoặc gần», «bỏ hẳn Flip» (chuyển máy đang dùng chúng về «gần»).
(function () { let ch = false; if (OFS.x_noflip || OFS.x_flipfar) { delete OFS.x_noflip; delete OFS.x_flipfar; OFS.x_flipnear = true; ch = true; } if (!OFS.b10bMig) { if (OFS.x_flipnear === undefined) OFS.x_flipnear = true; OFS.x_regime = true; OFS.b10bMig = 1; ch = true; } if (ch) try { localStorage.setItem(OF_LS, JSON.stringify(OFS)); } catch (e) { } })();
function ofFlipMode() { return ofX("x_flipnear") ? "near" : "off"; }
// ── B9b5d: VÙNG ĐỆM QUANH FLIP (anh Nam Zalo 24-25/11: chặn/cảnh báo bằng vùng đệm quanh Flip GẦN, tính theo % hoặc ATR, và phân biệt theo loại lệnh bật lại / theo xu hướng).
// Anh Nam CHƯA cho số → mọi con số dưới đây là THAM SỐ CHƯA KIỂM ĐỊNH (Claude chọn mặc định 0,5% ≈ 18$ ở giá 3.650, gần ngưỡng 20$ cũ để hành vi ít đổi).
// Loại lệnh: «A» = bật lại (9A; TL1·2 Bẫy, HG dùng chung công tắc Flip gần như trước) · «B» = theo xu hướng (9B). Mặc định: 9A đứng ngoài trong vùng đệm; 9B KHÔNG (B10b coi chính Gamma Flip là một mốc để đánh 9B phá vỡ).
const FB_MODES = [["pct", "% giá Flip (mặc định)"], ["atr", "× ATR(14) nến 1 giờ"], ["usd", "$ cố định (cách cũ)"]];
const FB_VALS = { pct: [0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.75, 1], atr: [0.5, 0.75, 1, 1.5, 2, 3], usd: [5, 10, 15, 20, 30, 50] };
const ofFbMode = () => (FB_VALS[OFS.fbMode] ? OFS.fbMode : "pct");
const ofFbVal = (m) => { m = m || ofFbMode(); const v = m === "pct" ? OFS.fbPct : m === "atr" ? OFS.fbAtr : OFS.flipNear; return Number.isFinite(v) && v > 0 ? v : m === "pct" ? 0.5 : m === "atr" ? 1 : 20; };
// ATR(14) kiểu Wilder của nến 1 GIỜ gộp từ nến đang xem; chỉ dùng các giờ ĐÃ ĐÓNG trước giờ chứa t (không nhìn trước). Không đủ 15 giờ → null.
function atrH1At(t) {
  const c = S.candles; if (!c || !c.length || t == null) return null;
  const key = c.length + "|" + c[0].time + "|" + c[c.length - 1].time + "|" + S.tf;
  if (!S.atrH || S.atrH.key !== key) {
    const hs = []; let cur = null;
    for (const k of c) { const b = Math.floor(k.time / 3600) * 3600; if (!cur || cur.t !== b) { cur = { t: b, h: k.high, l: k.low, c: k.close }; hs.push(cur); } else { cur.h = Math.max(cur.h, k.high); cur.l = Math.min(cur.l, k.low); cur.c = k.close; } }
    let atr = null, sum = 0; const out = [];
    hs.forEach((h, n) => { const tr = n ? Math.max(h.h - h.l, Math.abs(h.h - hs[n - 1].c), Math.abs(h.l - hs[n - 1].c)) : h.h - h.l;
      if (n < 14) { sum += tr; if (n === 13) atr = sum / 14; } else atr = (atr * 13 + tr) / 14; out.push({ t: h.t, atr: n >= 13 ? atr : null }); });
    S.atrH = { key, out };
  }
  const h0 = Math.floor(t / 3600) * 3600, a = S.atrH.out; let lo = 0, hi = a.length - 1, best = null;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (a[m].t < h0) { best = a[m]; lo = m + 1; } else hi = m - 1; }
  return best ? best.atr : null;
}
// Độ rộng vùng đệm ($) tại thời điểm t. Chế độ ATR mà chưa đủ dữ liệu → tạm dùng % (ghi rõ trong txt).
function ofFlipBuf(flip, t) {
  const m = ofFbMode(), v = ofFbVal(m), f2 = (x) => x.toFixed(1).replace(".", ",");
  if (m === "usd") return { w: v, txt: `${f2(v)}$ cố định` };
  if (m === "atr") { const a = atrH1At(t); if (a != null && a > 0) return { w: v * a, txt: `${String(v).replace(".", ",")} × ATR H1 ${f2(a)}$` }; }
  const p = m === "pct" ? v : ofFbVal("pct"), w = flip != null ? (flip * p) / 100 : 0;
  return { w, txt: `${String(p).replace(".", ",")}% Flip${m === "atr" ? " (chưa đủ 15 giờ nến để tính ATR, tạm dùng %)" : ""}` };
}
function ofFbValSel() { const m = ofFbMode(), cur = ofFbVal(m), u = m === "pct" ? "%" : m === "atr" ? "× ATR" : "$";
  return `<select id="ofFbV" style="font-size:12px">${FB_VALS[m].map((v) => `<option value="${v}"${v === cur ? " selected" : ""}>${String(v).replace(".", ",")}${u}</option>`).join("")}</select>`; }
function ofFbNowTxt() { try { const L = primaryLevels(), c = S.candles, f = L && L.gamma_flip; if (f == null || !c || !c.length) return "Hiện tại: chưa có Flip.";
  const b = ofFlipBuf(f, c[c.length - 1].time), px = c[c.length - 1].close; return `Hiện tại: vùng đệm ±${b.w.toFixed(1).replace(".", ",")}$ (${b.txt}) quanh Flip ${ofFm(f)} → ${ofFm(f - b.w)}–${ofFm(f + b.w)}; giá ${ofFm(px)} ${Math.abs(px - f) <= b.w ? "<b>ĐANG TRONG vùng</b>" : "ngoài vùng"}.`; } catch (e) { return ""; } }
const ofNearFlip = (p, flip, t) => p != null && flip != null && Math.abs(p - flip) <= ofFlipBuf(flip, t).w;
// Có áp vùng đệm cho loại lệnh này không (A = 9A bật lại, B = 9B theo xu hướng). Công tắc chung «Lọc Flip» tắt thì không áp loại nào.
const ofFbOn = (typ) => ofX("x_flipnear") && (typ === "B" ? OFS.fbB === true : OFS.fbA !== false);
// ── B9b5d: chế độ NGÀY theo Bảng A (Handbook, anh Nam 15/11): TỔNG Net GEX mọi pool. Dashboard chỉ có GC + GLD (thiếu XAU/QTY, số 252). Chỉ để XEM cạnh chế độ theo Flip; KHÔNG dùng để chọn 9A/9B.
function bangA() {
  const gc = opt("GC"), gl = opt("GLD"); if (gc?.net_gex == null && gl?.net_gex == null) return null;
  const g = (gc?.net_gex || 0) + (gl?.net_gex || 0), B = 1e9, Mi = 1e6, sgn = g >= 500 * Mi ? 1 : g > -500 * Mi ? 0 : -1;
  const zone = g > 2 * B ? "Gamma dương MẠNH (dealer phanh mạnh)" : g >= 500 * Mi ? "Gamma dương (dealer phanh)" : g > -500 * Mi ? "TRUNG TÍNH (−500M…+500M: chờ hướng)" : g >= -2 * B ? "Gamma âm (dealer đạp ga, trending)" : "Gamma âm MẠNH (< −2B: không BUY dưới Flip)";
  const short = g > 2 * B ? "+Γ mạnh" : sgn > 0 ? "+Γ" : sgn < 0 ? (g < -2 * B ? "−Γ mạnh" : "−Γ") : "trung tính";
  return { g, gc: gc?.net_gex ?? null, gl: gl?.net_gex ?? null, sgn, zone, short, gcOnly: gl?.net_gex == null, glOnly: gc?.net_gex == null };
}
// So chế độ theo Flip (dấu giá − Flip) với Bảng A: «khớp», «KHÁC» hoặc «Bảng A trung tính».
const bangAvsFlip = (A, negG) => (!A ? "" : A.sgn === 0 ? "Bảng A trung tính" : (A.sgn < 0) === !!negG ? "khớp" : "KHÁC");
const ofFlipTxt = () => (OF_FLIP_OPTS.find((o) => o[0] === ofFlipMode()) || ["", "?"])[1].split(":")[0].replace(/ \(.*$/, "");
const OF_FILTERS = [
  ["x_noflip", "BỎ HẲN FLIP: không dùng Flip để chọn 9A/9B và không chặn theo Flip; tường gần luôn xét kiểu 9A (bật lại: tường trên giá = SELL, dưới giá = BUY). TRÁI với bản nháp B10b (Gamma âm = 9B); chỉ để THỬ, chưa kiểm định"],
  ["x_flipnear", "Giá trong VÙNG ĐỆM quanh Flip (%, ATR hoặc $ ở dòng dưới) thì ĐỨNG NGOÀI: vùng chuyển Gamma (anh Nam 25/11; độ rộng vùng anh chưa cho số → tham số, chưa kiểm định)"],
  ["x_flipfar", "Ngày Flip xa (cách giá > 2,5%) thì ĐỨNG NGOÀI (theo B6; chờ xác nhận câu 4)"],
  ["x_near", "Hiện thêm TƯỜNG GẦN theo B10b: top 3 OI trong ±2,5% quanh giá mở ngày (anh Nam chốt ở biên bản niêm phong; xấp xỉ, chưa kiểm định)"],
  ["x_regime", "Bẫy chỉ khi Gamma DƯƠNG, Thủng/Squeeze chỉ khi Gamma ÂM (anh Nam B1, 23/11: Positive đánh đảo chiều, Negative đánh theo hướng phá)"],
];
const OF_GROUPS = [
  ["g_tl1", "TL1 · Thủng Put Wall / Squeeze Call Wall (đi theo xu hướng)"],
  ["g_trap", "TL1+TL2 · Bẫy tại Call/Put Wall (đánh ngược)"],
  ["g_hedge", "HG · Vùng Hedge −Γ (không có trong TL1/TL2)"],
  ["session", "Chỉ xét phiên Mỹ 19:00-23:00 giờ VN (bỏ tick = xét cả ngày)"],
  ["zones", "Vẽ vùng xem xét TL1·TL2·HG lên chart"],
  ["rr", "Vẽ khung đo SL/TP kiểu TradingView cho tín hiệu hôm nay"],
  ["watch", "Đánh dấu NẾN ĐANG QUAN SÁT trên chart: tam giác nhỏ + x/y (▽ trên nến = SELL, △ dưới nến = BUY). ✔ = đủ mọi điều kiện, ⛔ = nến đủ nhưng cổng chưa qua, rê chuột để xem chi tiết (chỉ hiển thị, không phải lệnh)"],
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
// B9b5c-3: ô xác nhận CÓ trong tài liệu anh Nam (TL2: phân kỳ CVD, Volume tăng mà OI không tăng, ΔOI lớn tại vùng). Các ô còn lại do dashboard gốc tự thêm.
const OF_DOC = ["Phân kỳ CVD", "Vol↑ΔOI", "ΔOI lớn"];
function ofPresetNow() {
  const on = (k) => OF_CONDS.find((c) => c[0] === k)[2].every((x) => ofOn("c:" + x)), ks = OF_CONDS.map((c) => c[0]).filter((k) => k !== "gamma");
  if (ks.every(on)) return "all";
  if (ks.every((k) => on(k) === OF_DOC.includes(k))) return "doc";
  return "custom";
}

// ── TVLB B9b0: bảng theo dõi Option Flow (cảnh báo cấu hình + đang chờ gì + tín hiệu hôm nay) ──
function ofWarnText() {
  const minC = Number.isInteger(OFS.minConf) ? OFS.minConf : S.cfg.signals.min_confirm;
  const nC = OF_CONDS.filter(([k]) => k !== "gamma").filter(([, , n]) => ofOn("c:" + n[0])).length;
  const nG = OF_GROUPS.filter(([k]) => k !== "session" && k !== "zones" && k !== "rr" && k !== "watch").filter(([k]) => ofOn(k)).length;
  if (nG === 0) return "Đã tắt cả 3 nhóm tín hiệu → sẽ không có tín hiệu nào. Hãy tick ít nhất 1 nhóm.";
  if (nC < minC) return `Chỉ đang bật ${nC} điều kiện xác nhận nhưng cần tối thiểu ${minC} → sẽ KHÔNG BAO GIỜ có tín hiệu. Hãy tick thêm điều kiện hoặc hạ "Số xác nhận tối thiểu".`;
  return "";
}
const OFV = { tab: "new", focus: null, rf: (() => { try { return Object.assign({ st: "all", k: "all" }, JSON.parse(localStorage.getItem("tvlb.ofrun") || "{}")); } catch { return { st: "all", k: "all" }; } })() };   // 9b-5b: rf = bộ lọc tab «Lệnh hôm nay» (nhớ qua F5); focus = kế hoạch đang được chọn để xem
// 9b-5b: loại lệnh để lọc tab «Lệnh hôm nay»: wall = tường 9A/9B · hg = HG Hedge · tl = TL1 / TL1·2
const ofKind = (g) => (g.tag === "9C" || g.tag === "9D" ? "gld" : g.tag === "9A" || g.tag === "9B" ? "wall" : g.tag === "HG" || /HEDGE/i.test(g.type || "") ? "hg" : "tl");
const OF_KIND_TXT = { wall: "Tường 9A/9B", gld: "9C/9D GLD (thử nghiệm)", hg: "HG Hedge", tl: "TL1 / TL1·2" };
const ofShortChip = (t, col) => `<span style="display:inline-block;font-size:9.5px;font-weight:700;padding:0 5px;margin-right:4px;border-radius:3px;border:1px solid ${col};color:${col}">${t}</span>`;
const ofFm = (v) => (v == null || !isFinite(v) ? "—" : Number(v).toFixed(2));
function ofModel() {
  const c = S.candles, sc = S.cfg.signals, L = primaryLevels();
  if (!L || L.call_wall == null || L.put_wall == null || c.length < 30) return null;
  const i = c.length - 2, k = c[i], px = c[c.length - 1].close, tol = sc.touch_tol, buf = sc.sl_buffer;
  const cw = L.call_wall, pw = L.put_wall, flip = L.gamma_flip, negG = flip != null && px < flip, blockG = ofOn("gamma") && negG;
  const tNow = c[c.length - 1].time, fbL = ofFlipBuf(flip, tNow);   // B9b5d: vùng đệm Flip tại nến hiện tại
  const rgp = regimePct(px, flip), noFlip = ofX("x_noflip"), flipFar = !noFlip && ofX("x_flipfar") && flip != null && rgp.far, flipNear = !noFlip && ofX("x_flipnear") && flip != null && Math.abs(px - flip) <= fbL.w, flipOut = flipFar || flipNear, regX = ofX("x_regime") && flip != null;   // TVLB B9b1 · B9b5d: «gần» = trong vùng đệm %/ATR/$ thay cho 20$ cố định
  const nwBlk = (brk) => flipNear && ofFbOn(brk ? "B" : "A");   // B9b5d: 9A/9B chỉ đứng ngoài khi công tắc của ĐÚNG loại lệnh đang bật
  const tfOk = (TF_SEC[S.tf] || 0) >= 300, sessOn = sc.session_only && ofOn("session"), inS = inUsSession(c[c.length - 1].time);
  const since = i - S.lastSigIdx, cdOk = since > sc.cooldown_bars || since === 0, gatesOk = tfOk && (!sessOn || inS) && !flipOut, gatesOkNw = tfOk && (!sessOn || inS);   // B9b5d: 9A/9B có cổng Flip riêng theo loại lệnh (trong kế hoạch)
  const gates = [[tfOk, "Khung nến ≥ M5 (đang " + S.tf + ")"], [!sessOn || inS, sessOn ? (inS ? "Trong phiên Mỹ 19:00-23:00 VN" : "Ngoài phiên Mỹ 19:00-23:00 VN") : "Không lọc phiên"], [!flipOut, flipNear ? `Flip chỉ cách giá ${Math.abs(px - flip).toFixed(1).replace(".", ",")}$ (≤ vùng đệm ${fbL.w.toFixed(1).replace(".", ",")}$ = ${fbL.txt}): vùng chuyển Gamma, TL1·TL2·HG đứng ngoài; 9A ${ofFbOn("A") ? "đứng ngoài" : "KHÔNG chặn"} · 9B ${ofFbOn("B") ? "đứng ngoài" : "KHÔNG chặn"} (công tắc theo loại lệnh)` : flipFar ? `Flip cách giá ${rgp.pctTxt}: ngày "không rõ", đứng ngoài («Cách dùng Flip» đang lọc Flip xa, B6)` : "Không lọc theo khoảng cách Flip"], [cdOk, cdOk ? "Hết nghỉ sau tín hiệu trước" : "Đang nghỉ " + (sc.cooldown_bars - since + 1) + " nến sau tín hiệu trước"]];
  const plans = [];
  const add = (o) => {
    o.past = (o.id === "bd" && px < o.lo) || (o.id === "sq" && px > o.hi); // giá đã ở phía bên kia tường: không còn "chờ tới vùng"
    o.dist = o.hi == null || o.past ? null : px < o.lo ? o.lo - px : px > o.hi ? px - o.hi : 0;
    o.state = !o.on ? "TẮT" : o.blocked ? "ĐỨNG NGOÀI" : !(/^nw/.test(o.id) ? gatesOkNw : gatesOk) ? "NGOÀI CỔNG" : o.past ? "ĐÃ QUA" : o.dist <= tol ? (o.side === "BOTH" ? "TRONG VÙNG" : "SẴN SÀNG") : o.dist <= 6 ? "GẦN" : "CHỜ";
    // v23z: lý do đứng ngoài + ô menu trái điều khiển nó (để giải thích khi rê chuột / trong thẻ)
    if (o.tick === undefined) o.tick = /^nw/.test(o.id) ? (flip == null ? "" : "Cách dùng Flip") : o.id === "tb" && blockG ? "Lọc Gamma" : "Bẫy chỉ khi Gamma DƯƠNG, Thủng/Squeeze chỉ khi Gamma ÂM";
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
      const day = vnDate(c[c.length - 1].time), f0 = c.find((x) => vnDate(x.time) === day), ref = f0 ? f0.open : px, unclear = !noFlip && flip == null;   // B9b5d: chỉ còn «không rõ» khi CHƯA có Flip; Flip gần chặn theo loại lệnh (nwBlk), Flip xa không chặn
      const r0 = ofRatio0(o), frz = ofOn("wfreeze") && o.ratio > 0 && r0 > 0, cv = (s) => (frz && s.strike != null ? s.strike * r0 : s.chart);
      S.wFrz = frz ? { r0, now: o.ratio_raw || o.ratio } : null;
      const top3 = o.strikes.filter((s) => Math.abs(cv(s) / ref - 1) <= 0.025).sort((a, b) => (b.call_oi + b.put_oi) - (a.call_oi + a.put_oi)).slice(0, 3);
      try {   // 9b-5 (số 223): danh sách tường 9A/9B của ngày → ofWallsPost ghi lên máy chủ (data/walls9a/<ngày>.jsonl)
        const brk0 = !noFlip && !unclear && negG;
        S.w9 = { t: Date.now(), day, ref, flip: flip ?? null, neg: !!negG, mode: brk0 ? "9B" : unclear ? "không rõ" : noFlip ? "9A (bỏ Flip)" : "9A", ratio: r0 || o.ratio || null, src: o.source || "", lock: o.ratio_lock_id || null,
          walls: top3.map((s, n) => ({ id: (brk0 ? "nwb" : "nwa") + n, lvl: +cv(s).toFixed(2), strike: s.strike ?? null, oi: s.call_oi + s.put_oi, c_oi: s.call_oi, p_oi: s.put_oi })) };
      } catch { /* không chặn việc tính tín hiệu */ }
      top3.forEach((s, n) => {
        const lvl = cv(s), up = lvl > px, brk = !noFlip && !unclear && negG, side = brk ? (up ? "BUY" : "SELL") : (up ? "SELL" : "BUY"), oi = s.call_oi + s.put_oi;
        const bl = unclear || nwBlk(brk);   // B9b5d
        add({ id: (brk ? "nwb" : "nwa") + n, short: brk ? "9B TƯỜNG" : "9A TƯỜNG", name: `${brk ? "9B phá vỡ (Gamma âm)" : unclear ? "9A bật lại (chưa có Flip)" : noFlip ? "9A bật lại (bỏ Flip)" : "9A bật lại (Gamma dương)"} · tường gần ${ofFm(lvl)} (OI ${fmtK(oi)})`, side, on: true, blocked: bl, why: flip == null ? "Chưa có mốc Gamma Flip nên không phân loại được ngày" : `Flip chỉ cách giá ${Math.abs(px - flip).toFixed(1).replace(".", ",")}$ (≤ vùng đệm ${fbL.w.toFixed(1).replace(".", ",")}$ = ${fbL.txt}): giá trong vùng chuyển Gamma, ${brk ? "9B" : "9A"} đứng ngoài (công tắc «${brk ? "9B theo xu hướng" : "9A bật lại"}: đứng ngoài khi gần Flip» đang bật; tham số chưa kiểm định)`, zone: "tường gần", lo: lvl * 0.999, hi: lvl * 1.001,
          cond: brk ? "nến M5 đóng vượt tường ≥ 0,15% và thân nến lớn hơn trung bình 10 nến M5 trước, vào ở giá mở nến kế" : "chạm vùng ±0,10% quanh tường, trong 3 nến M5 có 1 nến đóng quay ngược ≥ 0,10% từ tường (chưa đóng xuyên quá 0,10%), vào ở giá mở nến kế · chỉ lần chạm đầu trong phiên",
          sl: "0,30% từ giá vào", tp1: "tường đang hiển thị kế tiếp (cách giá vào ≥ 1R); không có thì 0,60% từ giá vào", tp2: null, cancel: "hết " + CHV("12:30") + " (đóng lệnh); lời +1R thì dời SL về hòa vốn" });
      });
      // UI3: 9C/9D = TƯỜNG GẦN của nguồn PHỤ (GLD khi Wall chính = GC), cùng luật 9A/9B (top 3 OI trong ±2,5% quanh giá mở ngày, cùng chế độ Flip, SL/TP, BE, 12:30 Chicago).
      // THỬ NGHIỆM, CHƯA KIỂM CHỨNG (GLD chưa từng kiểm ở bước 6/8). Công tắc OFS.x_gld9, mặc định TẮT. id nwa5..7 / nwb5..7 (số ≥ 5) để dùng chung toàn bộ luật 9A/9B; đánh dấu p.gx.
      // Bỏ strike nguồn phụ nằm trong ±0,10% của một tường 9A/9B (trùng mức, tránh 2 lệnh cùng chỗ). Không chiếm suất B10b (1 lệnh/phía, 2 lệnh/ngày) của 9A/9B.
      if (ofX("x_gld9")) try {
        const o2 = opt(o.source === "GLD" ? "GC" : "GLD");
        if (o2 && o2.strikes && o2.strikes.length) {
          const r2 = ofRatio0(o2, o2.source), frz2 = ofOn("wfreeze") && o2.ratio > 0 && r2 > 0, cv2 = (s) => (frz2 && s.strike != null ? s.strike * r2 : s.chart);
          const nm2 = o2.source || "GLD", lv1 = top3.map((s) => cv(s));
          const top3b = o2.strikes.filter((s) => cv2(s) > 0 && Math.abs(cv2(s) / ref - 1) <= 0.025 && !lv1.some((l) => Math.abs(cv2(s) / l - 1) <= 0.001)).sort((a, b) => (b.call_oi + b.put_oi) - (a.call_oi + a.put_oi)).slice(0, 3);
          top3b.forEach((s, n) => {
            const lvl = cv2(s), up = lvl > px, brk = !noFlip && !unclear && negG, side = brk ? (up ? "BUY" : "SELL") : (up ? "SELL" : "BUY"), oi = s.call_oi + s.put_oi, bl = unclear || nwBlk(brk);
            add({ id: (brk ? "nwb" : "nwa") + (n + 5), gx: true, src: nm2, short: brk ? "9D " + nm2 : "9C " + nm2, name: `${brk ? "9D phá vỡ (Gamma âm)" : unclear ? "9C bật lại (chưa có Flip)" : noFlip ? "9C bật lại (bỏ Flip)" : "9C bật lại (Gamma dương)"} · tường ${nm2} ${s.strike ?? ""} ≈ ${ofFm(lvl)} (OI ${fmtK(oi)}) · THỬ NGHIỆM, CHƯA KIỂM CHỨNG`, side, on: true, blocked: bl,
              why: flip == null ? "Chưa có mốc Gamma Flip nên không phân loại được 9C/9D" : `Giá trong vùng đệm Flip (≤ ${fbL.w.toFixed(1).replace(".", ",")}$): công tắc đứng ngoài của loại lệnh này đang bật`, lo: lvl * 0.999, hi: lvl * 1.001,
              cond: (brk ? "nến M5 đóng vượt tường ≥ 0,15% và thân nến lớn hơn trung bình 10 nến M5 trước, vào ở giá mở nến kế" : "chạm vùng ±0,10% quanh tường, trong 3 nến M5 có 1 nến đóng quay ngược ≥ 0,10% từ tường (chưa đóng xuyên quá 0,10%), vào ở giá mở nến kế · chỉ lần chạm đầu trong phiên") + ` · luật giống ${brk ? "9B" : "9A"}, tường lấy từ ${nm2} · THỬ NGHIỆM`,
              sl: "0,30% từ giá vào", tp1: "tường đang hiển thị kế tiếp (cách giá vào ≥ 1R); không có thì 0,60% từ giá vào", tp2: null, cancel: "hết " + CHV("12:30") + " (đóng lệnh); lời +1R thì dời SL về hòa vốn" });
            try { if (S.w9) S.w9.walls.push({ id: (brk ? "nwb" : "nwa") + (n + 5), lvl: +lvl.toFixed(2), strike: s.strike ?? null, oi, c_oi: s.call_oi, p_oi: s.put_oi, kind: "gld9", src: nm2 }); } catch { }
          });
        }
      } catch { /* nguồn phụ lỗi: bỏ qua, không ảnh hưởng 9A/9B */ }
      // B9b5d: «9B HỒI TEST» (break and retest) — KHÔNG có trong B10b, CHƯA KIỂM CHỨNG, chỉ để SO SÁNH; công tắc OFS.x_nwrt (mặc định TẮT).
      // Ngày Gamma âm: tường đã bị PHÁ (nến đóng vượt ≥ 0,15%) trước đó trong ngày, giá quay lại chạm tường từ phía đã phá sang rồi bị đẩy đi tiếp theo hướng phá → vào theo hướng phá.
      // Hình thái mượn của 9A (chạm ±0,10%, ≤ 3 nến M5 có nến đóng quay đi ≥ 0,10%, chưa đóng xuyên ngược 0,10%) + ô «trước đó đã phá». Anh Nam 25/11 23:39: chiều SELL thuận đà giảm hợp Gamma âm nếu CÓ XÁC NHẬN; không giải thích bằng Magnet.
      if (!noFlip && !unclear && negG && ofX("x_nwrt")) top3.forEach((s, n) => { const lvl = cv(s), up = lvl > px, oi = s.call_oi + s.put_oi;
        add({ id: "nwr" + n, short: "9B HỒI TEST", name: `9B hồi test lại tường ${ofFm(lvl)} (OI ${fmtK(oi)}) · HỒI TEST · SO SÁNH, KHÔNG có trong B10b, CHƯA KIỂM CHỨNG`, side: up ? "SELL" : "BUY", on: true, blocked: nwBlk(true), why: `Giá trong vùng đệm Flip (≤ ${fbL.w.toFixed(1).replace(".", ",")}$) và công tắc «9B theo xu hướng: đứng ngoài khi gần Flip» đang bật`, zone: "tường đã phá", lo: lvl * 0.999, hi: lvl * 1.001,
          cond: "trước đó hôm nay đã có nến đóng PHÁ qua tường ≥ 0,15%; giá quay lại chạm vùng ±0,10% từ phía đã phá sang, trong 3 nến M5 có nến đóng quay đi tiếp ≥ 0,10% theo hướng phá, vào ở giá mở nến kế · chỉ lần hồi test đầu",
          sl: "0,30% từ giá vào", tp1: "tường đang hiển thị kế tiếp (cách giá vào ≥ 1R); không có thì 0,60% từ giá vào", tp2: null, cancel: "hết " + CHV("12:30") + " (đóng lệnh); lời +1R thì dời SL về hòa vốn" }); });
      // B9b5d: B10b 9B ghi «giá tiếp cận Tường gần HOẶC GAMMA FLIP lần đầu» → thêm Flip làm một mốc 9B (chỉ ngày Gamma âm, như tường gần). Đọc theo đúng chữ B10b; CHƯA kiểm định. Tắt: ô «9B tại Gamma Flip» (OFS.b10bF9B).
      if (!noFlip && flip != null && negG && ofOn("b10bF9B") && !top3.some((s) => Math.abs(cv(s) / flip - 1) <= 0.001)) {
        const up = flip > px, bl = nwBlk(true);
        add({ id: "nwbf", short: "9B FLIP", name: `9B phá vỡ Gamma Flip ${ofFm(flip)} (B10b: «tường gần hoặc Gamma Flip»)`, side: up ? "BUY" : "SELL", on: true, blocked: bl, why: `Flip chỉ cách giá ${Math.abs(px - flip).toFixed(1).replace(".", ",")}$ (≤ vùng đệm ${fbL.w.toFixed(1).replace(".", ",")}$): công tắc «9B theo xu hướng: đứng ngoài khi gần Flip» đang bật nên 9B tại Flip không bao giờ vào được`, zone: "Gamma Flip", lo: flip * 0.999, hi: flip * 1.001,
          cond: "nến M5 đóng vượt Flip ≥ 0,15% và thân nến lớn hơn trung bình 10 nến M5 trước (lần phá đầu), vào ở giá mở nến kế",
          sl: "0,30% từ giá vào", tp1: "tường đang hiển thị kế tiếp (cách giá vào ≥ 1R); không có thì 0,60% từ giá vào", tp2: null, cancel: "hết " + CHV("12:30") + " (đóng lệnh); lời +1R thì dời SL về hòa vốn" });
        try { if (S.w9) S.w9.walls.push({ id: "nwbf", lvl: +flip.toFixed(2), strike: null, oi: null, c_oi: null, p_oi: null, kind: "flip" }); } catch { }
      }
    }
  } catch { /* bỏ qua */ }
  const avg = c.slice(i - sc.vol_sma, i).reduce((a, x) => a + x.vol, 0) / sc.vol_sma, slope = k.cvd - c[i - sc.cvd_slope_bars].cvd, doi = nearDoi(k.close);
  // TVLB B9b1/v23o: đếm điều kiện đạt x/y cho từng kế hoạch = hình thái nến + số xác nhận TỐI THIỂU cần + cổng. Tính trên nến ĐÃ ĐÓNG gần nhất (giống evaluate). Chỉ hiển thị.
  // v23o: tách thành mkCtx(j) + chkFor(p, X) để dùng lại cho nến quá khứ (đánh dấu nến quan sát). Với nến cuối (live) kết quả giữ NGUYÊN như v23n (trừ điều kiện "quay ngược" của 9A).
  let watchAt = null, liveX = null;
  try {
    const minC = Number.isInteger(OFS.minConf) ? OFS.minConf : sc.min_confirm;
    const mkCtx = (j, hist) => {
      const kk = c[j], pv = c[j - 1], q2 = c[j - 2], dx = !hist || j >= c.length - 3 ? (S.state?.macro?.DXY?.chg_n_pct ?? 0) : 0;   // 9b-5c (số 233): DXY HIỆN TẠI chỉ áp cho nến mới (≤ 2 nến trước, đúng cửa sổ chốt); nến cũ không có DXY lịch sử → không tính, để ✓/lệnh của nến cũ không nhảy theo DXY bây giờ
      const av = c.slice(j - sc.vol_sma, j).reduce((a, x) => a + x.vol, 0) / sc.vol_sma, sl = kk.cvd - c[j - sc.cvd_slope_bars].cvd, dd = nearDoi(kk.close);
      const vs = av > 0 && kk.vol >= sc.vol_spike_mult * av;
      return { j, k: kk, prev: pv, p2: q2, slope: sl, d0: divAt(j), d1: divAt(j - 1), dUp: dx >= sc.dxy_thr_pct, dDn: dx <= -sc.dxy_thr_pct, vSp: vs, dFlat: !!dd && dd.d_oi <= 0, dBig: !!dd && Math.abs(dd.d_oi) >= sc.doi_big,
        bf: hist ? bigFlowAt(j, sc.cvd_slope_bars) : bigFlow(sc.cvd_slope_bars), swp: (S.smc?.sweeps || []).some((w) => w.i >= j - 2 && w.i <= j),
        bod: c.slice(j - 10, j).reduce((a, x) => a + Math.abs(x.close - x.open), 0) / 10, lo3: Math.min(kk.low, pv.low, q2.low), hi3: Math.max(kk.high, pv.high, q2.high),
        a: hist ? j : j - 2, b: hist ? Math.min(j + 2, c.length - 2) : j, inS: hist ? inUsSession(kk.time) : inS, cdOk: hist ? !S.signals.some((g) => g.i < j && j - g.i <= sc.cooldown_bars) : cdOk };   // B9b5c-3: bỏ «g.i === j» (trước đây tín hiệu ra ở nến này lại chặn nến quan sát của chính nó → ⛔ sai)
    };
    const chkFor = (p, X) => {
      const { k, prev, p2, slope, d0, d1, dUp, dDn, vSp, dFlat, dBig, bf, swp, bod, lo3, hi3, inS, cdOk } = X;   // X.a..X.b = cửa sổ nến (9A)
      const id = p.id, sell = p.side === "SELL", nw = /^nw/.test(id), lvl = (p.lo + p.hi) / 2;
      if (/^hg/.test(id) && p.side === "BOTH") return { ok: 0, tot: 0, shape: [], conf: [], gate: [], need: 0, note: "giá đang TRONG vùng: chưa có điểm vào, chờ giá ra khỏi vùng rồi quay lại" };
      let shape = [], conf = [], revIdx = null, appr9 = null;
      if (id === "ts") { shape = [[k.high >= cw - tol, `Nến chạm vùng (cao nhất ≥ ${ofFm(cw - tol)})`], [k.close < cw, "Nến đóng dưới tường"], [k.close < k.open, "Nến giảm"]]; conf = [["Phân kỳ CVD âm", d0.bear || d1.bear], ["CVD dốc xuống", slope < 0], ["DXY tăng", dUp], ["Volume spike", vSp], ["Vol↑ mà ΔOI≤0", vSp && dFlat], ["ΔOI≥1500 tại vùng", dBig]]; }
      else if (id === "tb") { shape = [[k.low <= pw + tol, `Nến chạm vùng (thấp nhất ≤ ${ofFm(pw + tol)})`], [k.close > pw, "Nến đóng trên tường"], [k.close > k.open, "Nến tăng"]]; conf = [["Phân kỳ CVD dương", d0.bull || d1.bull], ["CVD dốc lên", slope > 0], ["DXY giảm", dDn], ["Volume spike", vSp], ["Vol↑ mà ΔOI≤0", vSp && dFlat], ["ΔOI≥1500 tại vùng", dBig]]; }
      else if (id === "bd") { shape = [[k.close < pw - tol, `Nến đóng dưới ${ofFm(pw - tol)}`], [prev.close >= pw - tol, "Nến trước còn ở trên"]]; conf = [["CVD dốc xuống", slope < 0], ["Delta nến âm", k.delta < 0], ["DXY tăng", dUp], ["Volume spike", vSp]]; }
      else if (id === "sq") { shape = [[k.close > cw + tol, `Nến đóng trên ${ofFm(cw + tol)}`], [prev.close <= cw + tol, "Nến trước còn ở dưới"]]; conf = [["CVD dốc lên", slope > 0], ["Delta nến dương", k.delta > 0], ["DXY giảm", dDn], ["Volume spike", vSp]]; }
      else if (/^hg/.test(id)) {
        if (sell) { shape = [[hi3 >= p.lo, "Nến chọc lên vùng (cao nhất 3 nến ≥ mép dưới)"], [k.close < p.lo, "Nến đóng dưới vùng"], [k.close < k.open, "Nến giảm"]]; conf = [["CVD dốc xuống", slope < 0], ["Delta nến âm", k.delta < 0], ["Nến quét thanh khoản", swp], ["DXY tăng", dUp], ["Volume spike", vSp]]; }
        else { shape = [[lo3 <= p.hi, "Nến chọc xuống vùng (thấp nhất 3 nến ≤ mép trên)"], [k.close > p.hi, "Nến đóng trên vùng"], [k.close > k.open, "Nến tăng"]]; conf = [["CVD dốc lên", slope > 0], ["Delta nến dương", k.delta > 0], ["Nến quét thanh khoản", swp], ["DXY giảm", dDn], ["Volume spike", vSp]]; }
      } else if (/^nw[ar]/.test(id)) {   // B9b5d: «9B hồi test» (nwr) dùng chung hình thái với 9A + ô «trước đó đã phá» · v23q: theo B10b, xét CỬA SỔ 3 nến M5 (không phải 1 nến): chạm vùng, rồi trong 3 nến có 1 nến đóng quay ngược, và chưa đóng xuyên quá 0,10%
        const tch = (x) => (sell ? x.high >= p.lo : x.low <= p.hi), rv = (x) => (sell ? x.close <= lvl * 0.999 : x.close >= lvl * 1.001), thr = (x) => (sell ? x.close > lvl * 1.001 : x.close < lvl * 0.999);
        let f = -1; for (let m = X.a; m <= X.b; m++) if (tch(c[m])) { f = m; break; }
        // quét lần lượt từ nến chạm, TỐI ĐA 3 nến (1, 2 hoặc 3): gặp nến đóng xuyên qua tường trước → hỏng; gặp nến đóng quay ngược → ĐẠT và dừng (các nến sau không còn liên quan)
        let st = f < 0 ? "none" : "wait", r = -1;
        if (f >= 0) for (let m = f; m <= Math.min(f + 2, X.b); m++) { if (thr(c[m])) { st = "through"; break; } if (rv(c[m])) { st = "rev"; r = m; break; } }
        if (st === "wait" && f + 2 <= X.b) st = "expired";
        // 9b-5b (số 232): "bật lại" phải là giá đi TỚI tường từ phía NGƯỢC chiều lệnh (SELL: từ dưới lên; BUY: từ trên xuống). Tìm lùi từ nến trước nến chạm tới nến gần nhất ĐÓNG NGOÀI vùng (tối đa 24 nến):
        // nó phải nằm đúng phía. Trước đây không kiểm → nến PHÁ tường từ trên xuống bị tính là "9A SELL bật lại" (lệnh 22:10 ngày 24/11).
        let appr = false; if (f >= 0) for (let m = f - 1; m >= Math.max(0, f - 24); m--) { const cl = c[m].close; if (cl < p.lo || cl > p.hi) { appr = sell ? cl < p.lo : cl > p.hi; break; } }
        if (!appr && st === "rev") st = "wrongside";
        appr9 = f >= 0 ? appr : null;   // 9b-5c (số 239): cho ofWatchList biết lần chạm này thuộc chiều nào
        revIdx = st === "rev" ? r : null;   // v23ai: nến xác nhận quay ngược (để vẽ khung vào lệnh ở nến kế)
        const rvTxt = "Có nến đóng quay ngược ≥ 0,10% từ tường (trong 1–3 nến kể từ nến chạm" + (st === "rev" ? `; đạt ở nến thứ ${r - f + 1}` : st === "wait" ? `; mới ${X.b - f + 1} nến, còn chờ` : st === "expired" ? "; đã hết 3 nến mà chưa có" : "") + ")";
        shape = [[f >= 0, "Chạm vùng ±0,10% quanh tường"]];
        if (/^nwr/.test(id)) { let pb = false; const d0 = vnDate(k.time); if (f >= 0) { let m0 = f - 1; while (m0 > 0 && vnDate(c[m0 - 1].time) === d0) m0--; let side0 = false;   // PHÁ = trước đó có nến đóng ở phía bên kia tường, SAU đó mới có nến đóng vượt ≥ 0,15%
          for (let m = m0; m < f; m++) { const cl = c[m].close; if (sell ? cl > lvl : cl < lvl) side0 = true; else if (side0 && (sell ? cl <= lvl * 0.9985 : cl >= lvl * 1.0015)) { pb = true; break; } } }
          shape.push([pb, sell ? "Trước đó HÔM NAY đã có nến đóng PHÁ XUỐNG dưới tường ≥ 0,15% (tường thành vùng cản)" : "Trước đó HÔM NAY đã có nến đóng PHÁ LÊN trên tường ≥ 0,15% (tường thành vùng đỡ)"]); }
        shape = shape.concat([[f >= 0 && appr, sell ? "Giá đi LÊN tới tường (trước lần chạm, nến đóng gần nhất ngoài vùng nằm DƯỚI vùng)" : "Giá đi XUỐNG tới tường (trước lần chạm, nến đóng gần nhất ngoài vùng nằm TRÊN vùng)"], [st === "rev", rvTxt], [f >= 0 && st !== "through", "Chưa đóng xuyên quá 0,10% qua tường (trước nến quay ngược)"]]);
        // v23s: xác nhận theo MENU (cùng bộ với bẫy TL1·2; B10b gốc không có xác nhận, đây là phần gắn thêm theo yêu cầu: điều kiện phải theo menu)
        conf = sell ? [["Phân kỳ CVD âm", d0.bear || d1.bear], ["CVD dốc xuống", slope < 0], ["DXY tăng", dUp], ["Volume spike", vSp], ["Vol↑ mà ΔOI≤0", vSp && dFlat], ["ΔOI≥1500 tại vùng", dBig]] : [["Phân kỳ CVD dương", d0.bull || d1.bull], ["CVD dốc lên", slope > 0], ["DXY giảm", dDn], ["Volume spike", vSp], ["Vol↑ mà ΔOI≤0", vSp && dFlat], ["ΔOI≥1500 tại vùng", dBig]];
      }
      else if (/^nwb/.test(id)) { shape = [[sell ? k.close <= lvl * 0.9985 : k.close >= lvl * 1.0015, "Nến đóng vượt tường ≥ 0,15%"], [(() => { for (let m = X.j - 1; m >= Math.max(0, X.j - 24); m--) { const cl = c[m].close; if (sell ? cl <= lvl * 0.9985 : cl >= lvl * 1.0015) return false; if (sell ? cl > lvl : cl < lvl) return true; } return false; })(), sell ? "Lần phá đầu: trước đó giá còn đóng TRÊN tường, chưa nến nào đóng dưới quá 0,15%" : "Lần phá đầu: trước đó giá còn đóng DƯỚI tường, chưa nến nào đóng trên quá 0,15%"], [Math.abs(k.close - k.open) > bod, "Thân nến lớn hơn trung bình 10 nến trước"]];   // 9b-5c (số 239): thêm ô «lần phá đầu»: lùi tối đa 24 nến, gặp nến đóng phía bên kia tường trước khi gặp nến đã vượt 0,15% (cho phép phá 2 bước, vd 25/11 18:25→18:35); trước đây nến đóng cùng phía (chưa hề phá) cũng bị tính là phá
        conf = sell ? [["CVD dốc xuống", slope < 0], ["Delta nến âm", k.delta < 0], ["DXY tăng", dUp], ["Volume spike", vSp]] : [["CVD dốc lên", slope > 0], ["Delta nến dương", k.delta > 0], ["DXY giảm", dDn], ["Volume spike", vSp]];   // v23s: xác nhận theo menu
      }
      if ((bf && (nw || ["ts", "tb", "bd", "sq"].includes(id))) || (/^hg/.test(id) && bf)) conf.push([sell ? "Lệnh lớn bán ròng" : "Lệnh lớn mua ròng", sell ? bf.d < 0 : bf.d > 0]);
      conf = conf.filter(([n]) => ofOn("c:" + n));   // điều kiện bị tắt thì không tính (giống mkSig)
      const gate = [];
      gate.push([tfOk, "Khung nến ≥ M5"]); if (sessOn) gate.push([inS, "Trong phiên Mỹ 19:00-23:00 VN"]); if (!nw) gate.push([cdOk, "Hết nghỉ sau tín hiệu trước"]);   // v23s
      // B9b5d: cổng Flip tính theo GIÁ ĐÓNG CỦA CHÍNH NẾN NÀY (trước đây dùng giá HIỆN TẠI cho cả nến cũ → ✓/⛔ của nến cũ nhảy theo giá bây giờ, nghi là một nguyên nhân số 233)
      if (flip != null && !noFlip && (nw ? ofFbOn(/^nw[br]/.test(id) ? "B" : "A") : ofX("x_flipnear"))) { const fb = ofFlipBuf(flip, k.time), dd = Math.abs(k.close - flip);
        gate.push([dd > fb.w, `Ngoài vùng đệm Flip: giá đóng cách Flip ${dd.toFixed(1).replace(".", ",")}$ ${dd > fb.w ? ">" : "≤"} ${fb.w.toFixed(1).replace(".", ",")}$ (${fb.txt}; chưa kiểm định)`]); }
      if (typeof p.blocked === "boolean" && !nw) gate.push([!p.blocked, "Chế độ Gamma cho phép"]);   // v23u: 9A/9B bị chặn vì Flip xa đã có dòng cổng Flip riêng, không lặp lại
      if (nw && flip == null) gate.push([false, "Có mốc Gamma Flip"]);
      if (nw && OFS.b10bTime !== false) { const cm = chiMin(k.time + (TF_SEC[S.tf] || 300)); gate.push([!(cm >= 690 && cm < 1200), "Trong giờ vào lệnh B10b (không vào từ " + CHV("11:30") + " tới khi có OI mới, xấp xỉ " + CHV("20:00") + ")"]); }   // B9b5c-3
      if (nw && !ofX("x_nwconf")) conf = [];   // B9b5c-3: B10b của anh Nam cho 9A/9B KHÔNG dùng ô xác nhận nào (chỉ hình thái nến); bật «x_nwconf» để thêm lại
      const cOk = conf.filter((x) => x[1]).length, need = nw && !ofX("x_nwconf") ? 0 : minC;   // v23v: đúng như engine (score >= minConf): ít ô tick hơn mức tối thiểu thì KHÔNG BAO GIỜ đủ
      // v23t: số x/y hiển thị bên ngoài = các ô XÁC NHẬN đang tick trong menu (không cộng hình thái + cổng như v23s). Hình thái và cổng vẫn bắt buộc: "full" = đủ cả ba.
      const shOk = shape.filter((x) => x[0]).length, gOk = gate.filter((x) => x[0]).length, xOk = Math.min(cOk, need), full = shOk === shape.length && cOk >= need && gOk === gate.length;
      return { shape, conf, gate, need, cOk, xOk, shOk, gOk, full, time: k.time, revIdx, cj: X.j, appr: appr9, ok: shOk + xOk + gOk, tot: shape.length + need + gate.length };   // v23v: ok/tot chỉ để biết có dữ liệu; hiển thị luôn dùng ofSum(h)
    };
    liveX = mkCtx(i, false); plans.forEach((p) => { p.chk = chkFor(p, liveX); });
    const twC = {}, twin = (p, sd) => twC[p.id + sd] || (twC[p.id + sd] = { ...p, id: p.id + sd[0], base: p.id, side: sd });   // 9b-5c (số 239): bản SELL (…S) và BUY (…B) của mỗi tường 9A/9B
    watchAt = (j) => { const X = mkCtx(j, true), out = []; for (const p of plans) { if (/^nw/.test(p.id)) { for (const sd of ["SELL", "BUY"]) { const q = twin(p, sd); out.push({ p: q, chk: chkFor(q, X) }); } } else out.push({ p, chk: chkFor(p, X) }); } return out; };
  } catch (e) { /* bỏ qua */ }
  return { px, cw, pw, flip, negG, blockG, rgp, flipFar, flipNear, flipOut, fbL, tol, gates, gatesOk, plans, k, avg, slope, doi, sc, watchAt, xc: liveX };
}
// ── TVLB B9b0: hình minh họa mini cho từng kế hoạch (SVG, không theo tỉ lệ giá) ──
function ofIllu(p, nocap) {
  const W = 300, H = 108, flip = p.side === "BUY", Y = (y) => (flip ? H - y : y), up = "#26a69a", dn = "#ef5350";
  const kind = p.id === "ts" || p.id === "tb" || /^nw[ar]/.test(p.id) ? "trap" : p.id === "bd" || p.id === "sq" || /^nwb/.test(p.id) ? "break" : "hedge";
  const cd = (x, o, h, l, c) => { const col = Y(c) < Y(o) ? up : dn, t = Math.min(Y(o), Y(c)); return `<line x1="${x}" x2="${x}" y1="${Y(h)}" y2="${Y(l)}" stroke="${col}" stroke-width="1.8"/><rect x="${x - 6}" y="${t}" width="12" height="${Math.max(2, Math.abs(Y(c) - Y(o)))}" fill="${col}"/>`; };
  const ln = (y, col, txt, dash, x2 = 152) => `<line x1="6" x2="${x2}" y1="${Y(y)}" y2="${Y(y)}" stroke="${col}" stroke-width="1" ${dash ? 'stroke-dasharray="4 3"' : ""}/><text x="${x2 + 5}" y="${Y(y) + 3}" font-size="10.5" fill="${col}">${txt}</text>`;
  const nw = /^nw/.test(p.id || "");   // 9b-5b: 9A/9B dùng luật riêng (SL 0,30%, TP1 tường kế tiếp ≥ 1R) nên chữ trên hình khác TL1
  const wick = flip ? "đáy" : "đỉnh", wallName = p.zone || (nw ? "tường gần" : p.id === "ts" || p.id === "sq" ? "Call Wall" : "Put Wall"), G = "#9aa4b2";
  let g = "";
  if (kind === "trap") {
    g += nw ? ln(30, G, `${wallName} ±0,10%`) + ln(14, dn, "SL = giá vào ± 0,30%", true) + ln(50, "#f0b429", "vào: giá mở nến kế", true) + ln(74, up, "TP1: tường kế (≥ 1R)", true) + ln(92, up, "+1R: dời SL hòa vốn", true)
      : ln(30, G, `${wallName} (tường)`) + ln(14, dn, `SL = ${wick} râu + 3$`, true) + ln(50, "#f0b429", "vào lệnh (đóng nến)", true) + ln(74, up, "TP1: mốc OI kế", true) + ln(92, up, "TP2: tường đối diện", true);
    g += cd(30, 66, 62, 68, 60) + cd(50, 60, 52, 62, 54) + cd(70, 54, 42, 56, 44) + cd(90, 36, 20, 52, 50) + cd(110, 50, 48, 62, 60) + cd(130, 60, 58, 74, 72) + cd(150, 72, 70, 84, 82);
    g += `<text x="8" y="${flip ? H - 3 : 9}" font-size="10.5" fill="#cfd6e0">${nw ? "chạm vùng rồi đóng quay ngược ≥ 0,10%" : "râu chọc qua tường"}</text>`;
  } else if (kind === "break") {
    g += nw ? ln(54, G, `${wallName}`) + ln(42, dn, "SL = giá vào ± 0,30%", true) + ln(70, "#f0b429", "vào: giá mở nến kế", true) + ln(90, up, "TP1: tường kế (≥ 1R)", true)
      : ln(54, G, `${wallName} (tường)`) + ln(42, dn, "SL = tường + 3$", true) + ln(70, "#f0b429", "vào lệnh (đóng nến)", true) + ln(90, up, "TP1: mốc OI kế", true);
    g += cd(30, 28, 24, 34, 32) + cd(50, 32, 30, 42, 40) + cd(70, 40, 38, 54, 50) + cd(90, 48, 46, 74, 70) + cd(110, 70, 68, 84, 82) + cd(130, 82, 80, 90, 88);
    g += `<text x="8" y="${flip ? H - 3 : 9}" font-size="10.5" fill="#cfd6e0">${nw ? "nến ĐÓNG xuyên tường ≥ 0,15%, thân lớn" : "nến ĐÓNG xuyên tường"}</text>`;
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
const ofSimple = (h) => { if (!h || !h.tot) return ""; return `${h.full ? "đủ " : h.gOk < h.gate.length ? "⛔ " : ""}${h.shOk + h.xOk}/${h.shape.length + h.need}`; };   // 9b-5c: «✔» chỉ dùng cho nến ĐÃ VÀO LỆNH; đủ điều kiện ghi «đủ»
const ofCandleOk = (h) => h.shOk === h.shape.length && h.cOk >= h.need;   // nến đã thỏa cả hình thái lẫn xác nhận tối thiểu
const ofStatTxt = (h) => (h.full ? "ĐỦ ĐIỀU KIỆN" : ofCandleOk(h) && h.gOk < h.gate.length ? "nến ĐÃ THỎA, nhưng cổng chưa qua → đứng ngoài" : "chưa đủ");
const ofColH = (h) => (h.full ? "#26b384" : h.gOk < h.gate.length ? "#9aa4b2" : "#f0b429");
const ofXNote = (h) => `đang tick ${h.conf.length} ô, đạt ${h.cOk}, cần ≥ ${h.need}${h.conf.length < h.need ? " → tick thêm ô hoặc hạ số tối thiểu (hiện KHÔNG BAO GIỜ đủ)" : ""}`;
function ofChip(p) {
  const h = p.chk; if (!h) return ofOn("watch") && p.on ? `<span title="Hôm nay chưa có nến nào chạm vùng này" style="font:700 8px/1 monospace;color:#6b7684">–</span>` : "";
  if (!h.tot) return `<span title="${h.note || ""}" style="font:700 10.5px/1 monospace;padding:2px 5px;border-radius:4px;background:rgba(255,255,255,.08);color:#9aa4b2">—</span>`;
  const col = ofColH(h);
  return `<span title="Điều kiện đạt / cần (hình thái nến + xác nhận trong menu) của lần chạm gần nhất hôm nay — nến ${vnClock(h.time)}, cũng là nến có ký hiệu trên chart. ⛔ = cổng chưa qua · ✔ = đủ. Bấm kế hoạch để xem chi tiết." style="font:700 8px/1 monospace;white-space:nowrap;padding:2px 3px;border-radius:4px;background:rgba(255,255,255,.08);color:${col};border:1px solid ${col}55">${ofSimple(h)}</span>`;
}
// v23y: bên phải phải CHO THẤY những gì menu trái đang chọn: ô xác nhận nào đang tick, giá trị hiện tại, SELL/BUY đạt hay chưa; bộ lọc và nhóm đang bật.
function ofCondHtml(M) {
  const X = M.xc, sc = M.sc, minC = Number.isInteger(OFS.minConf) ? OFS.minConf : sc.min_confirm, bf = X ? X.bf : null, dxy = S.state?.macro?.DXY?.chg_n_pct;
  const ck = (on) => (on ? "☑" : "☐"), sessOn = sc.session_only && ofOn("session");
  if (!X) return "";
  const R = [["Phân kỳ CVD", "Phân kỳ CVD âm", X.d0.bear || X.d1.bear, X.d0.bull || X.d1.bull, ""], ["CVD dốc", "CVD dốc xuống", X.slope < 0, X.slope > 0, (X.slope >= 0 ? "+" : "") + Math.round(X.slope)],
    ["Delta nến", "Delta nến âm", X.k.delta < 0, X.k.delta > 0, "Δ " + Math.round(X.k.delta)], ["DXY", "DXY tăng", X.dUp, X.dDn, dxy == null ? "chưa có" : (dxy >= 0 ? "+" : "") + dxy.toFixed(3) + "%"],
    ["Volume spike", "Volume spike", X.vSp, X.vSp, M.avg > 0 ? (M.k.vol / M.avg).toFixed(2) + "×" : ""], ["Vol↑ mà ΔOI≤0", "Vol↑ mà ΔOI≤0", X.vSp && X.dFlat, X.vSp && X.dFlat, ""],
    ["ΔOI ≥ 1500", "ΔOI≥1500 tại vùng", X.dBig, X.dBig, ""], ["Nến quét thanh khoản", "Nến quét thanh khoản", X.swp, X.swp, "chỉ HG"], ["Lệnh lớn ròng", "Lệnh lớn bán ròng", !!bf && bf.d < 0, !!bf && bf.d > 0, bf ? "" : "chỉ có khi live"]]
    .map(([lb, key, s, b, rd]) => ({ lb, on: ofOn("c:" + key), s: !!s, b: !!b, rd }));
  const on = R.filter((r) => r.on), sOk = on.filter((r) => r.s).length, bOk = on.filter((r) => r.b).length, bad = on.length < minC;
  const mk = (v) => `<span style="color:${v ? "#26b384" : "#85909c"}">${v ? "✔" : "✘"}</span>`;
  return `<div style="margin-top:8px"><b>Xác nhận theo menu</b> <span class="muted">(nến ${S.tf} ${vnClock(M.k.time)})</span>`
    + `<div style="font-size:11px;margin:2px 0;color:${bad ? "#ff6b6b" : "#f0b429"}">Đang tick <b>${on.length}</b> ô · cần ≥ <b>${minC}</b> · hiện đạt: SELL <b>${sOk}</b> · BUY <b>${bOk}</b>${bad ? " → không bao giờ đủ" : ""}</div>`
    + R.map((r) => `<div style="font-size:11px;${r.on ? "" : "opacity:.4;"}">${ck(r.on)} ${r.lb} ${r.on ? `· SELL ${mk(r.s)} BUY ${mk(r.b)}` : '<span class="muted">· không tính</span>'}${r.rd ? ` <span class="muted">${r.rd}</span>` : ""}</div>`).join("")
    + `<div class="muted" style="font-size:10.5px;margin-top:4px">${S.wFrz ? `Tỉ lệ quy đổi: khóa ${S.wFrz.r0.toFixed(5)} · hiện ${S.wFrz.now.toFixed(5)} (lệch ${((S.wFrz.now / S.wFrz.r0 - 1) * 3600).toFixed(1).replace(".", ",")}$ ở giá 3.600)<br>` : ""}Bộ lọc: Cách dùng Flip <b>${ofFlipTxt()}</b> · Tường gần ${ck(ofX("x_near"))} · Gamma B1 ${ck(ofX("x_regime"))} · Lọc Gamma TL1 ${ck(ofOn("gamma"))} · Phiên Mỹ ${ck(sessOn)}${ofOn("session") && !sc.session_only ? " (cấu hình server chưa bật session_only nên chưa có tác dụng)" : ""}<br>Nhóm: TL1 ${ck(ofOn("g_tl1"))} · Bẫy ${ck(ofOn("g_trap"))} · HG ${ck(ofOn("g_hedge"))}</div></div>`;
}
// v23z: giải thích trạng thái + hướng của kế hoạch (rê chuột vào nhãn vùng, vào dòng danh sách, và dòng trạng thái trong thẻ)
function ofStateWhy(p) {
  const M = S.ofM;
  if (p.state === "ĐỨNG NGOÀI") return `${p.why || "bị bộ lọc ở menu trái loại"}. Hôm nay kế hoạch này KHÔNG vào lệnh, cả SELL lẫn BUY (không phải "chỉ SELL" hay "chỉ BUY").${p.tick ? ` Muốn bỏ bộ lọc này: ${p.tick === "Cách dùng Flip" ? "đổi ô «Cách dùng Flip» (chọn «Không lọc»)" : `bỏ tick «${p.tick}»`} ở menu trái.` : ""}`;
  if (p.state === "NGOÀI CỔNG") { const f = M ? M.gates.filter((g) => !g[0]).map((g) => g[1]) : []; return `một cổng chung chưa qua${f.length ? ": " + f.join("; ") : ""}.`; }
  if (p.state === "TẮT") return "nhóm này đang bỏ tick ở menu trái.";
  if (p.state === "ĐÃ QUA") return "giá đã ở bên kia tường, chờ giá quay lại.";
  return "";
}
function ofDirWhy(p) {
  if (/^nwr/.test(p.id)) return "9B HỒI TEST (so sánh, chưa kiểm chứng): tường đã bị phá, giá quay lại chạm rồi bị đẩy đi tiếp → đánh THEO hướng phá. Tường TRÊN giá (đã phá xuống) = SELL, DƯỚI giá (đã phá lên) = BUY.";
  if (p.gx) return (/^nwa/.test(p.id) ? "9C" : "9D") + " = luật " + (/^nwa/.test(p.id) ? "9A (bật lại, đánh NGƯỢC)" : "9B (phá vỡ, đi THEO hướng phá)") + " nhưng tường lấy từ " + (p.src || "GLD") + " (quy đổi sang giá chart). THỬ NGHIỆM, CHƯA KIỂM CHỨNG: GLD chưa từng được kiểm ở bước 6/8.";
  if (/^nwa/.test(p.id)) return "9A (bật lại): giá chạm tường rồi bị đẩy quay lại → đánh NGƯỢC. Tường nằm TRÊN giá = SELL, nằm DƯỚI giá = BUY.";
  if (/^nwb/.test(p.id)) return "9B (phá vỡ): giá đóng vượt qua tường → đi THEO hướng phá. Tường TRÊN giá = BUY (phá lên), tường DƯỚI giá = SELL (phá xuống).";
  if (p.id === "ts" || p.id === "tb") return "Bẫy: giá chọc qua tường rồi đóng ngược lại → đánh NGƯỢC. Call Wall = SELL, Put Wall = BUY.";
  if (p.id === "bd" || p.id === "sq") return "Thủng/Squeeze: giá đóng xuyên tường → đi THEO. Thủng Put Wall = SELL, Squeeze qua Call Wall = BUY.";
  return "";
}
function ofStateTip(p) {
  const col = OF_COL[p.side] || "#f0b429", sec = (t, b) => (b ? `<div style="margin-top:5px;padding-top:4px;border-top:1px solid #2b3440"><b style="color:#f3d38c">${t}</b><br>${b}</div>` : "");
  const sel = /^nw/.test(p.id) ? "Chọn 9A hay 9B theo Gamma: giá TRÊN Flip (Gamma dương) → 9A; giá DƯỚI Flip (Gamma âm) → 9B; Flip XA không chặn (anh Nam 25/11). Giá trong VÙNG ĐỆM quanh Flip (% / ATR / $, ở menu ②) thì xét theo LOẠI lệnh: 9A bật lại đứng ngoài (mặc định); 9B theo xu hướng KHÔNG chặn (mặc định, vì B10b coi chính Flip là mốc để đánh 9B). Chế độ theo Bảng A (tổng GC+GLD) chỉ hiện ở «Bối cảnh» để so, không dùng chọn 9A/9B. Độ rộng vùng đệm là tham số chưa có số từ anh Nam, chưa kiểm định." : "";
  return `<div style="font-weight:700;color:${col};margin-bottom:3px">${p.name}</div><div>Trạng thái: <b>${p.state}</b>${p.dist != null && p.dist > 0 ? ` · cách vùng ${p.dist.toFixed(1)}$` : ""}</div>`
    + sec("Ý nghĩa trạng thái", ofStateWhy(p)) + sec("Hướng lệnh", ofDirWhy(p)) + sec(p.gx ? "Chọn 9C / 9D (thử nghiệm)" : "Chọn 9A / 9B", p.gx ? "9C/9D dùng ĐÚNG luật chọn của 9A/9B (9C ≈ 9A bật lại, 9D ≈ 9B theo hướng phá), chỉ khác tường lấy từ top 3 OI của nguồn phụ (GLD nếu nguồn chính là GC). 🧪 THỬ NGHIỆM: chưa kiểm chứng, không gộp thống kê với 9A/9B. " + sel : sel)
    + `<div style="margin-top:5px;color:#9aa4b2">Số x/y xem ở ký hiệu trên nến và thẻ chi tiết.</div>`;
}
function ofChkHtml(p) {
  // v23aa: bị chặn (ĐỨNG NGOÀI) hay chưa chạm thì VẪN hiện danh sách điều kiện nến. Có lần chạm hôm nay: mở sẵn, theo lần chạm đó. Chưa chạm: dùng nến vừa đóng, thu gọn.
  const h0 = p.chk, lv = !h0 && p.live && p.live.tot ? p.live : null, h = h0 || lv;
  if (!h) return ofOn("watch") && p.on ? `<div class="muted" style="font-size:11px;margin:3px 0">Hôm nay chưa có nến nào chạm vùng này, nên chưa có x/y.</div>` : "";
  if (!h.tot) return `<div class="muted" style="font-size:11px;margin:3px 0">${h.note || ""}</div>`;
  const li = (a, rev) => a.map((x) => { const ok = rev ? x[1] : x[0], t = rev ? x[0] : x[1]; return `<div style="color:${ok ? "#26b384" : "#85909c"}">${ok ? "✔" : "✘"} ${t}</div>`; }).join("");
  const cnt = (a) => a.filter((x) => x[0]).length, def = !!h0, open = OFV.chk && OFV.chk[p.id] !== undefined ? !!OFV.chk[p.id] : def;
  const stCol = h.full ? "#26b384" : ofCandleOk(h) && h.gOk < h.gate.length ? "#f0b429" : "";
  const head = lv ? `Chưa chạm vùng hôm nay · nến vừa đóng ${vnClock(h.time)}` : `<b>${ofSimple(h)}</b> · nến ${vnClock(h.time)} · ${stCol ? `<b style="color:${stCol}">${ofStatTxt(h)}</b>` : ofStatTxt(h)}`;
  return `<div style="font-size:11px;margin:4px 0 4px 6px"><div data-ofchk="${p.id}" data-ofdef="${def ? 1 : 0}" style="cursor:pointer;user-select:none;color:#f0b429" title="Bấm để sổ xuống / thu gọn danh sách điều kiện">${open ? "▾" : "▸"} ${head} <span class="muted">${open ? "(bấm để thu gọn)" : "(bấm để xem điều kiện)"}</span></div>`
    + (open ? `<div style="padding-left:8px;margin-top:3px;border-left:2px solid rgba(255,255,255,.12)"><div class="muted">${lv ? `Chưa có nến nào chạm vùng này hôm nay nên chưa có x/y. Dưới đây là nến ${S.tf} vừa đóng lúc ${vnClock(h.time)}, chỉ để tham khảo.` : `Lần chạm gần nhất hôm nay: nến ${S.tf} ${vnClock(h.time)} (nến có ký hiệu trên chart). <b>${ofSum(h)}</b> (H hình thái · X xác nhận · C cổng). Vào lệnh khi đủ cả 3 nhóm.`}</div>`
      + ofChkGroups(h) + `</div>` : "") + `</div>`;
}
document.addEventListener("click", (e) => { const t = e.target.closest && e.target.closest("[data-ofchk]"); if (!t) return; OFV.chk = OFV.chk || {}; { const id = t.dataset.ofchk, cur = OFV.chk[id] !== undefined ? !!OFV.chk[id] : t.dataset.ofdef === "1"; OFV.chk[id] = !cur; } try { ofRender(); } catch (x) { /* bỏ qua */ } });
function ofBadge(st, side) {
  // xám = chưa thoả / bị chặn; sáng lên theo màu BUY (xanh) / SELL (đỏ) / BOTH (vàng) khi kế hoạch đang hoạt động
  const live = st === "SẴN SÀNG" || st === "GẦN" || st === "TRONG VÙNG" || st === "XÁC NHẬN" || st === "ĐÃ VÀO", col = live ? (OF_COL[side] || "#f0b429") : "#7d8796";
  return `<span style="display:inline-block;white-space:nowrap;font:700 8px/1 monospace;padding:2px 2px;border-radius:3px;color:${col};background:${live ? col + "22" : "transparent"};border:1px solid ${col}${live ? "" : "66"}">${st}</span>`;
}
// v23o: NẾN ĐANG QUAN SÁT. Với mỗi nến đã đóng HÔM NAY, kiểm từng kế hoạch (trừ HG): bẫy TL1·2 và 9A = nến chạm vùng (lần chạm đầu của một đợt);
// TL1 Thủng/Squeeze = nến đóng xuyên tường (nến trước còn bên kia); 9B = nến đóng vượt ≥0,15% và thân lớn. Gắn x/y của nến đó. Tính theo MỐC TƯỜNG và CHẾ ĐỘ GAMMA HIỆN TẠI. Chỉ hiển thị.
function ofWatchList(M0) {
  if (!ofOn("watch")) return [];
  const M = M0 || ofModel(); if (!M || !M.watchAt) return [];
  const c = S.candles, sc = S.cfg.signals, day = vnDate(c[c.length - 1].time), j0 = Math.max(sc.vol_sma, sc.cvd_slope_bars, sc.div_lookback + 1, 12) + 2, out = [], was = {}, lastF = {};
  for (let j = j0; j <= c.length - 2; j++) {
    if (vnDate(c[j].time) !== day) continue;
    const k = c[j];
    for (const { p, chk } of M.watchAt(j)) {
      if (!p.on || /^hg/.test(p.id) || !chk || !chk.tot) continue;
      const tch = k.high >= p.lo && k.low <= p.hi, ev = /^(ts|tb)/.test(p.id) ? tch : /^nwr/.test(p.id) ? tch && chk.appr === true && !!(chk.shape[1] && chk.shape[1][0]) : /^nwa/.test(p.id) ? tch && chk.appr === true : chk.shape.length >= 2 && chk.shape.every((x) => x[0]);   // 9b-5c (số 239): 9A chỉ ghi ở chiều có hướng đi tới đúng; 9B phải đủ cả ô «nến trước ở phía bên kia»
      const was1 = was[p.id]; was[p.id] = ev;
      // v23ah: nến chạm lại trong cửa sổ 3 nến kể từ nến "first" của cùng kế hoạch chỉ là CHẤM, không thành đợt mới (không thêm tam giác/nhãn thứ hai)
      const inWin = /^(ts|tb|nwa|nwr)/.test(p.id) && lastF[p.id] != null && j - lastF[p.id] <= 2, isFirst = ev && !was1 && !inWin;
      if (isFirst) lastF[p.id] = j;
      if (ev) out.push({ j, time: k.time, p, chk, tot: chk.tot, first: isFirst });   // first = nến đầu của một đợt; các nến sau trong cùng đợt cũng được chấm (chấm nhỏ)
    }
  }
  return out;
}
// v23ak: KHÓA TỈ LỆ QUY ĐỔI THEO NGÀY cho MỌI mốc Options. Server tính vị trí chart = strike × ratio và TÍNH LẠI ratio mỗi lần làm mới Options (khoảng 15 phút; ratio = giá XAU cùng thời điểm với giá Yahoo GC=F),
// nên mọi tường/Magnet/Flip dịch vài đô cùng lúc (quan sát 24/11: +3,4$). Ratio của ngày = giá trị thấy ĐẦU TIÊN trong ngày (localStorage "tvlb.ratio0"); ngay khi nhận dữ liệu từ server (pollState)
// mọi mốc chart được tính lại = mốc gốc × ratio đó (tường, Flip, Magnet, Max Pain, từng strike, từng kỳ hạn, Volume Profile). Chưa khóa: vùng Hedge LP (server tự tính theo giá live). Tắt: bỏ tick «Khóa tỉ lệ quy đổi».
const ofR0Key = (o, src) => vnDate(Math.floor(Date.now() / 1000)) + "|" + (o.source || src || "");
// v23am-17: 9A TP1 = tường hiển thị kế tiếp (≥ 1R); quản lý lệnh: BE tại +1R, thoát 12:30 Chicago (menu bật/tắt).
// v23am-2: tường tính cả lớp GC + GLD đang bật; nhãn khung SL/TP không còn chồng nhau (nhãn mới ưu tiên); v23am-3: chữ 8.5px, không nền, khung SL/TP mờ (7%), nhãn rút gọn; Magnet cũng là mốc TP của HG.
// v23am: nhóm HG lấy TP1/TP2 từ TƯỜNG ĐANG HIỂN THỊ (nextWall, cùng bộ lọc với chart) thay vì strike liền kề bất kỳ; R:R tối thiểu riêng cho HG (mặc định 2, chỉnh trong menu).
// v23al: server (9b-3) đã KHÓA ratio theo ngày giao dịch CME và gửi ratio_lock_id → dùng thẳng o.ratio, không khóa lại ở trình duyệt (khóa theo ngày VN sẽ giữ ratio cũ sau khi server khóa lại, vd đổi hợp đồng GC)
function ofRatio0(o, src) {
  if (!o || !(o.ratio > 0)) return o && o.ratio;
  if (o.ratio_lock_id) return o.ratio;
  const key = ofR0Key(o, src), day = key.split("|")[0];
  if (!S.r0) { try { S.r0 = JSON.parse(localStorage.getItem("tvlb.ratio0") || "{}"); } catch { S.r0 = {}; } }
  if (!(S.r0[key] > 0)) {
    const keep = {}; for (const k of Object.keys(S.r0)) if (k.startsWith(day + "|")) keep[k] = S.r0[k];   // chỉ giữ các khóa của hôm nay
    keep[key] = o.ratio; S.r0 = keep; try { localStorage.setItem("tvlb.ratio0", JSON.stringify(S.r0)); } catch { /* bỏ qua */ }
  }
  return S.r0[key];
}
function ofFreezeRatio(st) {
  try {
    if (STATIC || !st || !st.options || !ofOn("wfreeze")) return;
    let kGC = null;
    for (const [src, o] of Object.entries(st.options)) {
      if (!o || !(o.ratio > 0) || !o.chart || !Array.isArray(o.strikes)) continue;
      if (o.ratio_lock_id) continue;   // v23al: server đã khóa (giữ nguyên o.ratio_raw của server)
      const raw = o.ratio, r0 = ofRatio0(o, src); if (!(r0 > 0)) continue;
      o.ratio_raw = raw; if (src === "GC") kGC = r0 / raw;
      const apply = (t) => {
        if (!t || !t.chart) return;
        for (const k of Object.keys(t.chart)) if (typeof t[k] === "number" && typeof t.chart[k] === "number") t.chart[k] = +(t[k] * r0).toFixed(2);
        if (Array.isArray(t.strikes)) for (const x of t.strikes) if (typeof x.strike === "number") x.chart = +(x.strike * r0).toFixed(2);
        t.ratio = r0;
      };
      apply(o); for (const bt of Object.values(o.by_tenor || {})) apply(bt);
    }
    const vp = st.volume_profile;
    if (kGC && Math.abs(kGC - 1) > 1e-9 && vp && typeof vp === "object") for (const k of Object.keys(vp)) if (typeof vp[k] === "number") vp[k] = +(vp[k] * kGC).toFixed(2);
  } catch { /* giữ dữ liệu gốc */ }
}
// v23ai: KHUNG VÀO LỆNH cho 9A/9B (chỉ VẼ, không ghi nhật ký, không tự động đặt lệnh giấy). Quy tắc B10b: SL 0,30%, TP 0,60% tính từ giá vào = giá MỞ nến kế nến xác nhận;
// chỉ LẦN CHẠM ĐẦU của mỗi tường trong ngày (9A: nến đóng quay ngược trong 3 nến; 9B: nến đóng vượt tường). Chỉ vẽ khi đủ mọi điều kiện theo menu (full).
// 9b-5: lệnh 9A/9B đã ghi trong nhật ký máy chủ (kind "OF9") của ngày VN hôm nay → dựng lại thành lệnh để vẽ/quản lý (khôi phục lệnh mất khi xóa bộ nhớ trình duyệt, và là NGUỒN DUY NHẤT của điện thoại)
function ofJournalOrders(c, day, used) {
  const res = [];
  for (const e of S.journal || []) {
    if (e.kind !== "OF9" || !of9Tag(e.tag || e.name) || vnDate(e.t) !== day || e.entry == null || e.sl == null) continue;
    const id = String(e.id).replace(/^OF9\|/, ""); if (used && used.has(id)) continue;
    const ix = ofIdxAt(c, e.t); if (ix < 0) continue;
    res.push({ i: ix, time: e.t, side: e.side, entry: e.entry, sl: e.sl, tp1: e.tp1 ?? null, tp2: e.tp2 ?? null, tag: e.tag || e.name, gx: of9X(e.tag || e.name) || undefined, n2: e.alt === "lan2" || /LẦN 2/.test(e.type || "") || undefined, rt: e.alt === "retest" || /HỒI TEST/.test(e.type || "") || undefined, id, wall: e.wall, gam: e.gam, flip: e.flip, score: 0, max: 0, virt: true, latched: true, fromJ: true });
  }
  return res;
}
function ofEntries() {
  const c = S.candles, out = [], seen = {};
  if (!c || c.length < 30) return out;
  const day0 = vnDate(c[c.length - 1].time);
  if (STATIC) return ofJournalOrders(c, day0, null);   // điện thoại: KHÔNG tự tính 9A/9B, chỉ đọc lệnh máy tính đã ghi
  if (!ofOn("watch")) return out;
  const M0 = S.ofM;
  for (const w of ofWatchCached()) {
    if (!w.first || !/^nw/.test(w.p.id)) continue;
    const n2 = !!seen[w.p.id]; if (n2 && !ofX("x_nw2")) continue;   // B9b5d: công tắc «Cho phép lần 2» (mặc định TẮT = chỉ lần đầu, đúng B10b)
    seen[w.p.id] = true;   // lần chạm/phá ĐẦU (dù chưa đủ điều kiện) vẫn là «lần đầu», như trước
    if (!w.chk.full) continue;
    const idx = /^nw[ar]/.test(w.p.id) ? w.chk.revIdx : w.chk.cj, rt = /^nwr/.test(w.p.id);
    if (idx == null || !c[idx + 1]) continue;
    const sell = w.p.side === "SELL", e = c[idx + 1].open, rk = e * 0.003;
    const wl = shownLevels().filter((x) => (sell ? x <= e - rk : x >= e + rk)).sort((a, b) => (sell ? b - a : a - b));   // v23am-17: TP1 = tường đang hiển thị kế tiếp cách giá vào ≥ 1R (không có thì quay về 0,60% cũ); TP2 = tường sau đó
    out.push({ i: idx, time: c[idx].time, side: w.p.side, entry: e, sl: e * (sell ? 1.003 : 0.997), tp1: wl.length ? wl[0] : e * (sell ? 0.994 : 1.006), tp2: wl.length > 1 ? wl[1] : null, tag: /^nwa/.test(w.p.id) ? (w.p.gx ? "9C" : "9A") : (w.p.gx ? "9D" : "9B"), gx: w.p.gx || undefined, n2: n2 || undefined, rt: rt || undefined, score: 0, max: 0, virt: true, wkey: w.p.id + "|" + w.time,
      wall: (w.p.lo + w.p.hi) / 2, gam: M0 && M0.flip != null ? (M0.negG ? -1 : 1) : null, flip: M0 && M0.flip != null ? M0.flip : null });   // 9b-5: tường, dấu Gamma và Flip lúc vào lệnh (cho gợi ý + nhật ký)
  }
  // B9b5c-3: B10b của anh Nam — tối đa 1 lệnh mỗi PHÍA (BUY/SELL) mỗi phiên và 2 lệnh mỗi ngày (tính cả lệnh đã chốt hôm nay); lệnh sau bị bỏ
  if (ofOn("b10bCap") || ofOn("b10bOne")) { out.sort((x, y) => x.i - y.i); let sv0 = []; try { sv0 = JSON.parse(localStorage.getItem("tvlb.of9." + day0) || "[]"); } catch (e) { }
    const used = {}, ids = new Set(), acc = []; for (const g of sv0) { if (ids.has(g.id)) continue; ids.add(g.id); if (g.n2 || g.rt || of9X(g.tag)) continue; used[g.side] = (used[g.side] || 0) + 1; acc.push({ ...g, i: ofIdxAt(c, g.time) }); }   // B9b5d: lệnh «lần 2» là nhánh SO SÁNH riêng: không chiếm suất B10b
    // B9b5d: B10b «không mở lệnh mới nếu đang có lệnh mở» (chỉ xét lệnh 9A/9B). Lệnh cũ còn mở khi nến vào lệnh mới (g.i + 1) mở cửa = chưa chốt (j == null) hoặc chốt ở nến ≥ g.i + 1. Tắt: OFS.b10bOne = false.
    const stillOpen = (g) => ofOn("b10bOne") && acc.some((a) => { if (!(a.i >= 0) || a.i >= g.i || a.entry == null || a.sl == null) return false; const r = rrNatural(a, c, false); return r.j == null || r.j > g.i; });
    for (let q = 0; q < out.length; q++) { const g = out[q], id = `${g.tag}|${g.side}|${g.time}`; if (ids.has(id) || g.n2 || g.rt || g.gx) continue; const tot = (used.BUY || 0) + (used.SELL || 0);
      if ((ofOn("b10bCap") && ((used[g.side] || 0) >= 1 || tot >= 2)) || stillOpen(g)) { out.splice(q, 1); q--; continue; } used[g.side] = (used[g.side] || 0) + 1; ids.add(id); acc.push(g); } }
  // v23am-14: CHỐT LỆNH 9A/9B ngay khi vừa xuất hiện (≤ 2 nến trước), lưu theo ngày VN. Trước đây mọi thứ tính lại từ mốc tường/Gamma HIỆN TẠI nên lệnh đã vào bị biến mất khi Magnet/cổng đổi.
  try {
    const day = day0, key = "tvlb.of9." + day;
    for (let q = localStorage.length - 1; q >= 0; q--) { const kk = localStorage.key(q); if (kk && kk.indexOf("tvlb.of9.") === 0 && kk !== key) localStorage.removeItem(kk); }
    const saved = JSON.parse(localStorage.getItem(key) || "[]"), byId = new Map(saved.map((x) => [x.id, x]));
    let dirty = false;
    for (const g of out) { g.id = `${g.tag}|${g.side}|${g.time}`; if (!byId.has(g.id) && c.length - 1 - g.i <= 2) { const o = { id: g.id, time: g.time, side: g.side, entry: g.entry, sl: g.sl, tp1: g.tp1, tag: g.tag, wall: g.wall, gam: g.gam, flip: g.flip, wkey: g.wkey, n2: g.n2 || undefined, rt: g.rt || undefined }; saved.push(o); byId.set(g.id, o); dirty = true; } }
    if (dirty) localStorage.setItem(key, JSON.stringify(saved));
    const res = [], used = new Set();
    for (const g of out) { used.add(g.id); const sv = byId.get(g.id); res.push(sv ? { ...g, entry: sv.entry, sl: sv.sl, tp1: sv.tp1, wall: sv.wall ?? g.wall, gam: sv.gam ?? g.gam, flip: sv.flip ?? g.flip } : { ...g, rebuilt: true }); }   // rebuilt = dựng lại từ mốc HIỆN TẠI, chưa chốt → không ghi nhật ký
    for (const sv of saved) { if (used.has(sv.id)) continue; const ix = ofIdxAt(c, sv.time); if (ix < 0) continue; used.add(sv.id); res.push({ i: ix, time: sv.time, side: sv.side, entry: sv.entry, sl: sv.sl, tp1: sv.tp1, tp2: null, tag: sv.tag, n2: sv.n2 || undefined, rt: sv.rt || undefined, id: sv.id, wkey: sv.wkey, wall: sv.wall, gam: sv.gam, flip: sv.flip, score: 0, max: 0, virt: true, latched: true }); }
    for (const g of ofJournalOrders(c, day, used)) res.push(g);   // 9b-5 (số 212): lệnh có trong nhật ký máy chủ nhưng mất khỏi bộ nhớ trình duyệt
    return res;
  } catch (e) { return out; }
}
// v23t: ký hiệu NẾN QUAN SÁT vẽ trên lớp overlay (cùng lớp với nhãn VAH/POC/VAL, vùng HG), không dùng setMarkers của biểu đồ.
// ◉ vàng = nến chạm vùng, kèm x/y = số ô XÁC NHẬN (tick trong menu) đạt / số ô đang tick · ✔ = đủ hình thái + xác nhận tối thiểu + cổng. Chỉ hiển thị, không phải lệnh.
// v23am-15: CHỐT KÝ HIỆU NẾN QUAN SÁT "ĐỦ ĐIỀU KIỆN" (✓ x/y) của 9A/9B ngay khi vừa xuất hiện (≤ 2 nến trước), lưu theo ngày VN. Trước đây mọi ký hiệu tính lại từ mốc tường/Gamma HIỆN TẠI nên ✓ 3/3 biến mất khi cổng đổi.
function ofWatchLatch(list) {
  const c = S.candles; if (!c || !c.length) return list;
  const day = vnDate(c[c.length - 1].time), key = "tvlb.ow.v3." + day;   // 9b-5c: khóa mới → ký hiệu chốt theo luật cũ (kể cả bản 9b-5c đầu) bị xóa
  for (let q = localStorage.length - 1; q >= 0; q--) { const kk = localStorage.key(q); if (kk && kk.indexOf("tvlb.ow.") === 0 && kk !== key) localStorage.removeItem(kk); }
  const saved = JSON.parse(localStorage.getItem(key) || "[]").filter((x) => /^nw[abr](\d+|f)[SB]$/.test(x.pid || "")), have = new Set(saved.map((x) => x.id));   // 9b-5c: bỏ ký hiệu chốt theo luật cũ (chiều theo giá hiện tại)
  let dirty = false;
  for (const w of list) {
    if (!w.first || !w.chk || !w.chk.full || !/^nw/.test(w.p.id) || c.length - 1 - w.j > 2) continue;
    const id = w.p.id + "|" + w.time; if (have.has(id)) continue;
    saved.push({ id, time: w.time, pid: w.p.id, base: w.p.base, gx: w.p.gx || undefined, side: w.p.side, short: w.p.short, lo: w.p.lo, hi: w.p.hi, chk: w.chk, tot: w.tot }); have.add(id); dirty = true;
  }
  if (dirty) localStorage.setItem(key, JSON.stringify(saved));
  const present = new Set(list.filter((w) => w.first).map((w) => w.p.id + "|" + w.time)), out = list.slice();
  for (const sv of saved) {
    if (present.has(sv.id)) continue;
    let j = -1; for (let q = c.length - 1; q >= 0; q--) if (c[q].time === sv.time) { j = q; break; }
    if (j < 0) continue;
    const plan = (S.ofPlans || []).find((p) => p.id === sv.pid) || { id: sv.pid, base: sv.base || sv.pid.replace(/[SB]$/, ""), side: sv.side, short: sv.short, gx: sv.gx || undefined, lo: sv.lo, hi: sv.hi, on: true };
    out.push({ j, time: sv.time, p: plan, chk: sv.chk, tot: sv.tot, first: true, latched: true });
  }
  out.sort((x, y) => x.j - y.j);
  return out;
}
function ofWatchCached(M0) {
  const c = S.candles; if (!c || c.length < 30) return [];
  const key = [c.length, c[c.length - 1].time, c[c.length - 1].close, S.tf, JSON.stringify(OFS)].join("|"), now = Date.now();
  if (S.watchC && S.watchC.key === key && now - S.watchC.t < 5000) return S.watchC.list;
  let list = []; try { list = ofWatchList(M0 || ofModel()); S.watchErr = null; } catch (e) { S.watchErr = String(e && e.message || e); }
  try { list = ofWatchLatch(list); } catch (e) { /* giữ list gốc */ }
  try { const cnt = {}, ft = {}; for (const w of list) if (w.first && /^nw/.test(w.p.id)) { cnt[w.p.id] = (cnt[w.p.id] || 0) + 1; w.nth = cnt[w.p.id]; if (w.nth === 1) ft[w.p.id] = w.time; w.firstT = ft[w.p.id]; } } catch (e) { /* chỉ để hiển thị */ }   // 9b-5c (số 239): lần thứ mấy của tường + chiều này trong ngày (ofEntries chỉ lấy lần 1)
  S.watchC = { key, t: now, list }; S.watchN = list.filter((w) => w.first).length; return list;
}
// gán x/y của MỖI kế hoạch = lần theo dõi gần nhất hôm nay (cùng nguồn với ký hiệu trên nến); gọi cả từ ofRender lẫn lúc vẽ overlay để hai nơi không lệch nhau
// v23am-18: kế hoạch 9A/9B đã đủ điều kiện (✔) thì trạng thái là "ĐÃ VÀO" (trước đây vẫn ghi CHỜ vì trạng thái chỉ nhìn khoảng cách giá tới vùng)
function ofMarkEntered(plans) {
  for (const p of plans || []) { if (!/^nw/.test(p.id) || !p.on || p.blocked) continue; const lv = (p.lo + p.hi) / 2; if ((S.of9Sig || []).some((g) => g.side === p.side && g.wall != null && Math.abs(g.wall - lv) <= lv * 0.0005)) p.state = "ĐÃ VÀO"; }   // 9b-5c (số 239): trước đây cứ có nến ✔ là ghi ĐÃ VÀO dù không có lệnh
}
function ofSyncChk(plans, M0) {
  if (!plans || !ofOn("watch")) { (plans || []).forEach((p) => { if (p.live !== undefined) { p.chk = p.live; } }); return; }
  try { const last = {}; for (const w of ofWatchCached(M0)) if (w.first) last[(w.p.base || w.p.id) + "|" + w.p.side] = w;   // 9b-5c: theo tường gốc + chiều
    plans.forEach((p) => { if (p.live === undefined) p.live = p.chk; p.chk = last[p.id + "|" + p.side] ? last[p.id + "|" + p.side].chk : (p.live && !p.live.tot ? p.live : null); }); ofMarkEntered(plans); } catch (e) { /* giữ số cũ */ }
}
function ofWatchTip(w) {
  const h = w.chk, col = w.chk.full ? (w.p.side === "SELL" ? "#ef5350" : "#26a69a") : ofColH(w.chk), li = (a, rev) => a.map((x) => { const ok = rev ? x[1] : x[0], t = rev ? x[0] : x[1]; return `<div style="color:${ok ? "#7be0b0" : "#9aa4b2"}">${ok ? "✔" : "✘"} ${t}</div>`; }).join("");
  const sec = (t, body) => body ? `<div style="margin-top:5px;padding-top:4px;border-top:1px solid #2b3440"><b style="color:#f3d38c">${t}</b>${body}</div>` : "";
  const ordHtml = (() => { try { if (!/^nw/.test(w.p.id)) return ""; const wk = w.p.id + "|" + w.time, g = (S.of9Sig || []).find((x) => x.wkey === wk);
    if (g) { const r = S.ofRes && S.ofRes.get(ofKey(g)), st = r && r.res ? r.res.status : ""; return `<div style="margin:2px 0 4px;padding:4px 6px;border-radius:4px;background:rgba(38,166,154,.12)"><b style="color:#7be0b0">✔ ĐÃ VÀO LỆNH #${ofNumW(w) || "?"}</b> · ${g.tag} ${g.side}${g.rt ? ' <b style="color:#ffb74d">· HỒI TEST · SO SÁNH, KHÔNG có trong B10b, CHƯA KIỂM CHỨNG</b>' : ""}${g.n2 ? ' <b style="color:#ffb74d">· LẦN 2 · SO SÁNH, KHÔNG theo B10b, CHƯA KIỂM CHỨNG</b>' : ""}<br>Vào ${ofFm(g.entry)} (giá mở nến kế) · SL ${ofFm(g.sl)} · TP1 ${ofFm(g.tp1)}${g.tp2 != null ? " · TP2 " + ofFm(g.tp2) : ""}${st ? `<br>Trạng thái: <b>${st}</b>` : ""}${g.rebuilt ? '<br><span style="color:#ff8a65">dựng lại, chưa chốt (không ghi nhật ký)</span>' : ""}</div>`; }
    const why = w.nth > 1 ? `đã có lần đầu hôm nay lúc ${vnClock(w.firstT)} (luật: mỗi tường, mỗi chiều chỉ tính lần đầu)` : !h.full ? (h.shOk < h.shape.length ? "thiếu hình thái nến" : h.cOk < h.need ? `thiếu xác nhận (đạt ${h.cOk}, cần ≥ ${h.need})` : "cổng chặn") : "đủ điều kiện nhưng không thành lệnh";
    return `<div style="margin:2px 0 4px;padding:4px 6px;border-radius:4px;background:rgba(255,255,255,.05);color:#c3c9d2"><b>✘ KHÔNG VÀO LỆNH</b>: ${why}</div>`; } catch (e) { return ""; } })();
  return `<div style="font-weight:700;color:${col};margin-bottom:3px">${h.full ? "ĐỦ ĐIỀU KIỆN" : h.gOk < h.gate.length ? (ofCandleOk(h) ? "⛔ Nến đã thỏa, cổng chưa qua (đứng ngoài)" : "⛔ Cổng chưa qua (đứng ngoài)") : "Đang theo dõi"} · ${ofNumW(w) ? "#" + ofNumW(w) + " " : ""}${w.p.short} ${w.p.side} · nến ${vnClock(w.time)}${ofEntW(w) ? " · ✔ ĐÃ VÀO LỆNH" : ""}</div>`
    + ordHtml + `<div><b>${ofSimple(h)}</b> <span style="color:#9aa4b2">(${ofSum(h)})</span></div>`
    + sec(`H · Hình thái ${h.shOk}/${h.shape.length}`, li(h.shape)) + sec(`X · Xác nhận (menu): ${ofXNote(h)}`, li(h.conf, true)) + sec(`C · Cổng ${h.gOk}/${h.gate.length}`, li(h.gate))
    + `<div style="margin-top:5px;color:#9aa4b2">Vào lệnh khi đủ cả 3 nhóm (H, X, C) và là lần đầu của tường + chiều này trong ngày. Mốc tường theo Options hiện tại.</div>`;
}
function ofDrawWatch() {
  const ctx = ov.ctx; if (!ctx || !candleS) return;
  const badge = (() => { let b = document.getElementById("tvWatchN"); if (!b) { const s = document.getElementById("sigCount"); if (!s || !s.parentNode) return null; b = document.createElement("span"); b.id = "tvWatchN"; b.style.cssText = "margin-left:8px;color:#f0b429"; s.parentNode.insertBefore(b, s.nextSibling); } return b; })();
  if (!ofOn("watch")) { if (badge) badge.textContent = ""; return; }
  const W = ofWatchCached(); if (badge) badge.textContent = S.watchErr ? `· lỗi nến quan sát: ${S.watchErr}` : `· ◉ ${S.watchN} nến quan sát`;
  const c = S.candles, tsc = chart.timeScale(), dpr = ov.dpr, Wd = ov.cv.width / dpr, Hd = ov.cv.height / dpr, psW = chart.priceScale("right").width() || 70, plotW = Wd - psW, plotH = Hd - 28, per = {};
  ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.font = "700 10.5px 'IBM Plex Mono', monospace"; ctx.textBaseline = "middle"; ctx.textAlign = "center";
  const nAt = {}; for (const w of W) nAt[w.j] = (nAt[w.j] || 0) + 1;
  const evAt = new Set(W.map((w) => w.p.id + "|" + w.j)), boxes = [];   // v23ae: các ô nhãn đã vẽ, để nhãn sau tự né không đè lên nhãn trước
  for (const w of W) {
    const k = c[w.j]; if (!k) continue; const x = tsc.timeToCoordinate(w.time + TZ); if (x == null || x < 0 || x > plotW) continue;
    const sell = w.p.side === "SELL", ye = candleS.priceToCoordinate(sell ? k.high : k.low); if (ye == null) continue;
    const n = per[w.j] = (per[w.j] || 0) + 1; if (n > 3) continue;
    const late = /^nw/.test(w.p.id) && w.nth > 1, inO = ofEntW(w), wn = ofNumW(w), col = inO ? (sell ? "#ff5252" : "#4fc3f7") : "#7d8794", dy = 3 + (n - 1) * 22, tipY = ye + (sell ? -dy : dy), dir = sell ? -1 : 1;
    ctx.fillStyle = col;
    if (!w.first) { ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(x, tipY + dir * 3, 2.2, 0, 7); ctx.fill(); ctx.globalAlpha = 1; continue; }   // nến tiếp theo trong cùng đợt chạm: chỉ chấm nhỏ
    // tam giác nhỏ chỉ vào nến (SELL: ▼ phía trên nến · BUY: ▲ phía dưới nến) + số x/y; chi tiết khi rê chuột
    ctx.beginPath(); ctx.moveTo(x, tipY); ctx.lineTo(x - 4.5, tipY + dir * 7); ctx.lineTo(x + 4.5, tipY + dir * 7); ctx.closePath(); ctx.fill();
    // v23ag: 9A có cửa sổ 3 nến (nến chạm + 2 nến sau): chấm nhỏ cho 2 nến kế tiếp, kể cả khi chúng không còn chạm vùng (như bản cũ nhưng không phụ thuộc nến có chạm hay không)
    if (/^nw[ar]/.test(w.p.id)) for (let jj = w.j + 1; jj <= w.j + 2 && jj < c.length; jj++) {
      if (evAt.has(w.p.id + "|" + jj) || !c[jj]) continue;
      const x2 = tsc.timeToCoordinate(c[jj].time + TZ), y2 = candleS.priceToCoordinate(sell ? c[jj].high : c[jj].low); if (x2 == null || y2 == null || x2 < 0 || x2 > plotW) continue;
      ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(x2, y2 + (sell ? -dy : dy) + dir * 3, 2.2, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    }
    // 9b-5c: nhãn XẾP DỌC (mẫu nhãn lệnh HG), mỗi dòng một ý
    const xy = ofSimple(w.chk).replace(/^(đủ|⛔) /, ""), nm = /^nw/.test(w.p.id) ? (/^nwa/.test(w.p.id) ? (w.p.gx ? "9C" : "9A") : /^nwr/.test(w.p.id) ? "9B·HT" : (w.p.gx ? "9D" : "9B")) : /^(ts|tb)/.test(w.p.id) ? "TL1·2" : "TL1";
    const st2 = (w.chk.gOk < w.chk.gate.length ? "⛔" : "") + xy;   // trọng số x/y (⛔ = cổng chặn)
    const ofSg = $("#lyMk") && $("#lyMk").checked && window.TVLB_MK_OF !== false ? (S.signals || []).find((g) => g.i === w.j && g.side === w.p.side) : null;   // B9b5c-3: tín hiệu Option Flow trùng nến → gộp thành 1 dòng «OF ✔ x/y» trong cùng cột nhãn
    const lines = [sell ? "sell" : "buy", st2, nm, ofSg ? `OF ✔ ${ofSg.score}/${ofSg.max}` : "", wn ? "#" + wn + (inO ? " ✔" : "") : inO ? "✔" : "", late ? `lần ${w.nth}` : ""].filter(Boolean);   // 9b-5c: từ tam giác ra ngoài: chiều → trọng số → kiểu lệnh → #số (+✔ đã vào) → «lần N» ngoài cùng
    ctx.font = "600 9px 'IBM Plex Mono', monospace";
    const lh = 10, bw = Math.max(...lines.map((q) => ctx.measureText(q).width)) + 8, bh = lines.length * lh + 2;
    let ty = tipY + dir * 9;   // mép gần tam giác của cột chữ
    for (let g = 0; g < 4; g++) {   // v23ae: cột trùng chỗ thì đẩy ra xa nến một nấc, không đè chữ lên nhau
      const y0 = dir > 0 ? ty : ty - bh, r = { x0: x - bw / 2, x1: x + bw / 2, y0, y1: y0 + bh };
      if (!boxes.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0) || g === 3) { boxes.push(r); break; }
      ty += dir * (bh + 2);
    }
    const yTop = dir > 0 ? ty : ty - bh; if (yTop < 2 || yTop + bh > plotH - 2) continue;
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(10,14,20,.9)";
    lines.forEach((q, n) => { const yy = ty + dir * (n * lh + lh / 2 + 1); ctx.strokeText(q, x, yy); ctx.fillStyle = q === st2 ? "#ffffff" : inO || (ofSg && q.startsWith("OF ✔")) ? (sell ? "#ff5252" : "#4fc3f7") : "#8a93a0"; ctx.fillText(q, x, yy); });   // 9b-5c: trọng số x/y luôn TRẮNG; lệnh đã vào: chữ xanh da trời (buy) / đỏ (sell); chưa thỏa / không vào: xám
    ctx.font = "700 10.5px 'IBM Plex Mono', monospace";
    ov.tags.push({ x0: x - bw / 2 - 2, x1: x + bw / 2 + 2, y0: Math.min(tipY, yTop) - 2, y1: Math.max(tipY + dir * 7, yTop + bh) + 2, k: "watch", tip: ofWatchTip(w) });
  }
  ctx.restore();
}
function drawOverlay() { try { const ws = `${window.TVLB_TOPN}|${window.TVLB_MINOR}|${window.TVLB_WALLSTYLE}|${$("#lyKey")?.checked}|${$("#lyGLD")?.checked}`; if (S._wallSig !== undefined && S._wallSig !== ws) { S._wallSig = ws; replaySignals(); } S._wallSig = ws; } catch (e) { }   // v23am: đổi menu tường → tính lại tín hiệu
  try { ofSyncChk(S.ofPlans); S.of9Sig = ofEntries(); } catch (e) { S.of9Sig = []; } try { S.ofNum = ofOrderNums(); const sig = [...S.ofNum.keys()].join(","); if (sig !== S._numSig) { S._numSig = sig; setMarkers(); } } catch (e) { /* chỉ để đánh số */ } try { ofRefresh(); } catch (e) { /* khung đo vẫn vẽ theo luật tự nhiên */ } drawOverlayBase(); try { ofDrawWatch(); } catch (e) { S.watchErr = String(e && e.message || e); } }
// 9b-5b: danh sách điều kiện chia 3 NHÓM có khung riêng: ① Hình thái nến (bắt buộc đủ hết) · ② Xác nhận theo menu (đủ số tối thiểu là được) · ③ Cổng (bắt buộc). Viền xanh = nhóm đã đạt, cam = chưa.
function ofChkGroups(h) {
  const li = (a, rev) => a.map((x) => { const ok = rev ? x[1] : x[0], t = rev ? x[0] : x[1]; return `<div style="color:${ok ? "#26b384" : "#85909c"}">${ok ? "✔" : "✘"} ${t}</div>`; }).join("");
  const box = (ok, title, body) => `<div style="border-left:3px solid ${ok ? "#26b384" : "#f0b429"};background:rgba(255,255,255,.03);padding:3px 6px;margin:4px 0;border-radius:3px"><div style="font-weight:700;color:${ok ? "#26b384" : "#f0b429"};font-size:10.5px">${title}</div>${body}</div>`;
  const shOk = h.shOk === h.shape.length, xOk = h.cOk >= h.need, gOk = h.gOk === h.gate.length;
  return (h.shape.length ? box(shOk, `① HÌNH THÁI NẾN · bắt buộc đủ TẤT CẢ · ${h.shOk}/${h.shape.length} ${shOk ? "✔" : "(chưa đủ)"}`, li(h.shape)) : "")
    + (h.conf.length || h.need > 0 ? box(xOk, `② XÁC NHẬN theo menu · cần ≥ ${h.need} ô · đang đạt ${h.cOk}/${h.conf.length} ô đang tick ${xOk ? "✔" : "(chưa đủ)"}`, li(h.conf, true) + (h.conf.length < h.need ? '<div style="color:#ff8a65">Số ô đang tick ít hơn số cần → nhóm này KHÔNG BAO GIỜ đủ: tick thêm ô hoặc hạ «xác nhận tối thiểu».</div>' : "")) : "")
    + (h.gate.length ? box(gOk, `③ CỔNG · bắt buộc · ${h.gOk}/${h.gate.length} ${gOk ? "✔" : "(chưa qua → đứng ngoài)"}`, li(h.gate)) : "");
}
const ofChkLines = (h) => ofChkGroups(h);
// B9b5c-3: các dòng thêm cho «Bối cảnh thị trường» ở trang «Vào lệnh OF» (lấy từ bảng của trang «Vào lệnh» cũ). Chỉ để XEM, không đổi tín hiệu.
function ofCtxExtra(M) {
  const out = { gex: "—", tenor: "—", mag: "—", conf: "—", hedge: "—", wick: "—", div: "—", smc: "—" }, px = M.px, c = S.candles, fd = (d) => `${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(2)}`;
  const P = prim(), gc = opt("GC"), gl = opt("GLD");
  try { const A = bangA(), g = A ? A.g : null, B = 1e9, Mi = 1e6;   // B9b5c-3: anh Nam 15/11 (Module 3-4, Bảng A): Net GEX = TỔNG mọi pool (GC/OG + GLD + …), không lấy riêng GC · B9b5d: dùng chung hàm bangA()
    const zone = A ? A.zone : "";
    const dx = [gc, gl].reduce((a, o) => a + ((o?.strikes || []).reduce((q, x) => q + (Number(x.dex) || 0), 0)), 0), dOk = [gc, gl].some((o) => (o?.strikes || []).some((x) => x.dex != null));
    const h5 = g == null ? "" : g > 500 * Mi ? "Range: bán kháng cự, mua hỗ trợ" : g < -500 * Mi ? (!dOk ? "cần DEX" : dx > 0 ? "Gamma Squeeze Risk (bull)" : "Bearish Expansion (theo xu hướng giảm)") : "trung tính: chờ";
    out.gex = `Tổng <b>${fmtK(g)}$</b> (GC ${fmtK(gc?.net_gex)} + GLD ${fmtK(gl?.net_gex)})${zone ? ` → <b>${zone}</b>` : ""} <span class="muted">(Bảng A theo tổng; thiếu pool XAU/QTY)</span>`
      + `<br>Σ DEX ${dOk ? fmtK(dx) + "$" : "—"} → Hình 5: <b>${h5}</b> <span class="muted">(dấu DEX dealer: giả định, chưa đối chiếu)</span>`; } catch (e) { }
  try { out.tenor = tenorWTxt(P) + (P?.tenor_w?.on ? " <span class=\"muted\">(chưa kiểm định)</span>" : ""); } catch (e) { }
  try { const mg = P?.chart?.magnet;
    if (mg != null) { const st = (P.strikes || []).reduce((b, x) => (x.chart != null && (b == null || Math.abs(x.chart - mg) < Math.abs(b.chart - mg)) ? x : b), null), gx = st?.net_gex;
      out.mag = `${ofFm(mg)} — ${gx == null ? "chưa rõ hút/đẩy" : gx >= 0 ? `<b style="color:#26b384">Magnet HÚT (GEX dương ${fmtK(gx)})</b>` : `<b style="color:#ff6b6b">Magnet ĐẨY (GEX âm ${fmtK(gx)})</b>`} · cách ${fd(mg - px)}`; } else out.mag = "chưa có"; } catch (e) { }
  try { const lv = [], ad = (x, n) => { if (x != null && isFinite(x)) lv.push({ x, n }); }, a = P?.chart || {}, gch = (P?.source === "GLD" ? gc : gl)?.chart || {}, og = P?.source === "GLD" ? "GC " : "GLD ";
    ad(a.call_wall, "Call Wall"); ad(a.put_wall, "Put Wall"); ad(a.gamma_flip, "Flip"); ad(a.magnet, "Magnet"); ad(a.max_pain, "Max Pain"); ad(gch.call_wall, og + "Call Wall"); ad(gch.put_wall, og + "Put Wall"); ad(S.state?.volume_profile?.poc, "POC");
    lv.sort((p, q) => p.x - q.x); const TOL = 3, cl = []; let cur = null;
    lv.forEach((l) => { if (cur && l.x - cur[0].x <= TOL) cur.push(l); else { cur = [l]; cl.push(cur); } });
    const best = cl.filter((g) => g.length >= 2).map((g) => ({ g, lo: g[0].x, hi: g[g.length - 1].x })).sort((p, q) => Math.abs((p.lo + p.hi) / 2 - px) - Math.abs((q.lo + q.hi) / 2 - px))[0];
    out.conf = best ? `×${best.g.length} ${ofFm(best.lo)}–${ofFm(best.hi)}: ${best.g.map((l) => l.n).join(", ")} (cách ${fd((best.lo + best.hi) / 2 - px)}) <span class="muted">(gom mốc cách nhau ≤ ${TOL}$, giả định)</span>` : `không có 2 mốc nào cách nhau ≤ ${TOL}$`; } catch (e) { }
  try { const zs = ((hedgeSt() || {}).zones || []).filter((z) => z.kind === "accel"), inz = zs.find((z) => px >= z.lo && px <= z.hi);
    if (inz) out.hedge = `<b style="color:#ff6b6b">TRONG vùng Hedge −Γ ${ofFm(inz.lo)}–${ofFm(inz.hi)}</b>: biến động mở rộng, không bắt đáy/đỉnh`;
    else { const nz = zs.map((z) => ({ z, d: px < z.lo ? z.lo - px : px - z.hi })).sort((p, q) => p.d - q.d)[0]; out.hedge = nz ? `ngoài vùng hedge lớn · gần nhất ${ofFm(nz.z.lo)}–${ofFm(nz.z.hi)} (cách ${nz.d.toFixed(2)}$)` : "ngoài vùng hedge lớn"; } } catch (e) { }
  try { const k = M.k, up = k.high - Math.max(k.open, k.close), lo = Math.min(k.open, k.close) - k.low; out.wick = `râu ↑${up.toFixed(2)} ↓${lo.toFixed(2)} · thân ${Math.abs(k.close - k.open).toFixed(2)}`; } catch (e) { }
  try { const d = divAt(c.length - 2); out.div = d.bear ? `<b style="color:#ff6b6b">PHÂN KỲ GIẢM</b>: giá lên đỉnh mới nhưng CVD không lên theo (mua yếu dần)` : d.bull ? `<b style="color:#26b384">PHÂN KỲ TĂNG</b>: giá xuống đáy mới nhưng CVD không xuống theo (bán yếu dần)` : "đỉnh/đáy giá và CVD cùng chiều (không phân kỳ)"; } catch (e) { }
  try { const R = S.smc;
    if (!R) out.smc = "chưa có (cần nến H4; bật nút SMC trên thanh đầu)";
    else { const tfN = (smcCfg().tfName) || S.tf, h4 = R.frame ? (R.frame.dir === -1 ? "H4 ▼ giảm" : "H4 ▲ tăng") : "H4 chưa rõ";
      const ev = (R.events || []).filter((e) => e.kind === "BOS" || e.kind === "CHoCH").slice(-1)[0], tf = ev ? `${tfN} ${ev.dir > 0 ? "▲" : "▼"} (${ev.kind}${c[ev.i] ? " " + vnClock(c[ev.i].time) : ""})` : `${tfN} chưa có BOS/CHoCH`;
      const od = smcOrders().filter((o) => o.status === "pending" || o.status === "open").map((o) => `${o.name} ${o.side} ${o.status === "pending" ? "LIMIT" : "ĐANG CHẠY"} ${ofFm(o.entry)}`);
      out.smc = `${h4} · ${tf} · ${od.length ? od.join(" · ") : "chưa có lệnh SMC chờ"}`; } } catch (e) { }
  return out;
}
// 26/11: «3 câu hỏi đầu mỗi phiên» (Sổ tay ①) trả lời TỰ ĐỘNG thành 4 dòng gọn ở đầu bảng «Bối cảnh thị trường» (thay 2 dòng Net GEX · Gamma cũ).
// Cuối mỗi dòng có nút ▸ mở phần giải thích chi tiết (chính là nội dung 2 dòng cũ). Chỉ đọc số có sẵn; không đổi tín hiệu/lệnh nào.
const OF3_OPEN = new Set((() => { try { return JSON.parse(localStorage.getItem("tvlb.of3open") || "[]"); } catch (e) { return []; } })());
function of3Row(n, lab, short, det) {
  const o = OF3_OPEN.has(n);
  return `<div class="muted">${lab}</div><div>${short} <span data-of3="${n}" title="${o ? "Thu gọn" : "Xem giải thích chi tiết"}" style="cursor:pointer;white-space:nowrap;color:#e0a83a;font-weight:700;padding:0 4px;border:1px solid #3a4552;border-radius:4px;font-size:10.5px">${o ? "▾ gọn" : "▸ chi tiết"}</span>`
    + `<div data-of3d="${n}" style="${o ? "" : "display:none;"}margin-top:3px;padding:4px 6px;border-left:2px solid #e0a83a;background:#11161d;font-size:11.5px">${det || "—"}</div></div>`;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-of3]"); if (!b) return;
  const n = +b.dataset.of3, d = document.querySelector(`[data-of3d="${n}"]`); if (OF3_OPEN.has(n)) OF3_OPEN.delete(n); else OF3_OPEN.add(n);
  const o = OF3_OPEN.has(n); if (d) d.style.display = o ? "" : "none"; b.textContent = o ? "▾ gọn" : "▸ chi tiết"; b.title = o ? "Thu gọn" : "Xem giải thích chi tiết";
  try { localStorage.setItem("tvlb.of3open", JSON.stringify([...OF3_OPEN])); } catch (err) { }
});
function of3Q(M) {
  const A = bangA(), B = 1e9, cm = (v, d = 1) => Number(v).toFixed(d).replace(".", ",");
  const col = (t, c) => `<b style="color:${c}">${t}</b>`, G = "#26b384", R = "#ff6b6b", Y = "#f0b429", lb = (t) => `<span class="muted">${t}</span>`;
  const lv = !A ? 0 : A.sgn === 0 ? 0 : Math.abs(A.g) > 2 * B ? 2 : 1;
  const l1 = !A ? "chưa có" : (A.sgn > 0 ? col(lv === 2 ? "DƯƠNG MẠNH" : "DƯƠNG", G) : A.sgn < 0 ? col(lv === 2 ? "ÂM MẠNH" : "ÂM", R) : col("TRUNG TÍNH", Y)) + ` ${lb(`(${fmtK(A.g)}$${A.sgn === 0 ? ", nghiêng " + (A.g < 0 ? "âm" : "dương") : ""})`)}`;
  const D4 = '<span class="muted">Cách đọc: Gamma âm (giá dưới Flip) → 9B đi theo hướng phá, không bắt đáy/đỉnh; Gamma dương → 9A bật lại tại tường; giá trong vùng đệm Flip → 9A đứng ngoài; Net GEX trung tính (±500M) → lực yếu, chờ nến xác nhận. Đây là BỐI CẢNH, không phải tín hiệu vào lệnh · chưa kiểm định (Sổ tay ⑤b, ⑥, ⑬, ⑮).</span>';
  if (M.flip == null) return { l1, l2: "chưa rõ Flip", l3: "chưa rõ", l4: "chưa rõ", d4: D4 };
  const d = Math.abs(M.px - M.flip), bw = M.fbL ? ` ±${cm(M.fbL.w)}$` : "";
  const l2 = `${cm(d)}$ (${M.rgp.pctTxt}) · giá <b>${M.negG ? "DƯỚI" : "TRÊN"}</b> Flip → `
    + (M.flipNear ? col(`GẦN (trong vùng đệm${bw}): dễ lật chế độ`, Y) : M.rgp.far ? col("XA: chế độ ổn định cả ngày", G) : `VỪA (ngoài vùng đệm${bw}): khá ổn định`);
  const sp = !A ? "" : lv === 0 ? " · lực NHẸ" : lv === 2 ? " · lực MẠNH" : " · lực vừa", clash = A && A.sgn !== 0 && (A.sgn < 0) !== !!M.negG;
  const l3 = M.flipNear ? col("ở RANH GIỚI, chưa rõ phanh hay đạp ga", Y) : (M.negG ? col("ĐẠP GA", R) + " (đẩy giá đi xa)" : col("PHANH", G) + " (kìm giá trong biên)") + sp + (clash ? ` · ${col("Bảng A ngược Flip", "#ff8a65")}` : "");
  const l4 = M.flipNear ? "<b>Đứng ngoài 9A</b>: giá trong vùng đệm; chỉ 9B khi phá rõ."
    : clash ? "<b>Thận trọng</b>: hai cách đo ngược nhau → đứng ngoài hoặc giảm khối lượng."
    : M.negG ? (lv === 0 ? "<b>Nghiêng 9B</b>: theo hướng phá, không bắt đáy/đỉnh · lực yếu → chờ nến phá rõ."
      : `<b>9B</b>: theo hướng phá, không bắt đáy/đỉnh${lv === 2 ? " · Net GEX &lt; −2B: không BUY dưới Flip" : ""}.`)
    : (lv === 0 ? "<b>Nghiêng 9A</b>: bật lại tại tường · lực yếu → chờ nến xác nhận." : "<b>9A</b>: bật lại tại tường, có nến xác nhận.");
  const l4x = ofX("x_gld9") ? ' <span style="color:#ce93d8">· 9C/9D🧪 (tường GLD, thử nghiệm) theo cùng luật: ' + (M.flipNear ? "đứng ngoài 9C, chỉ 9D khi phá rõ" : M.negG ? "nghiêng 9D" : "nghiêng 9C") + ".</span>" : "";
  return { l1, l2, l3, l4: l4 + l4x, d4: D4 };
}
function ofRender() {
  const wn = $("#ofWarn"), T = $("#ofT"); let w = ""; try { w = ofWarnText(); } catch { /* chưa có cấu hình */ }
  if (wn) { wn.textContent = w ? "⚠ " + w : ""; wn.style.display = w ? "block" : "none"; }
  { const fbn = $("#ofFbNow"); if (fbn) { const t = ofFbNowTxt(); if (fbn.innerHTML !== t) fbn.innerHTML = t; } }   // B9b5d: dòng «Hiện tại: vùng đệm …» cập nhật theo giá
  if (!T) return;
  let M = null; try { M = ofModel(); } catch (e) { T.textContent = "Lỗi: " + e.message; return; }
  // v23x: MỘT NGUỒN SỐ. x/y của mỗi kế hoạch = lần theo dõi GẦN NHẤT hôm nay (nến đầu của đợt chạm), đúng nến có ký hiệu trên chart; nhãn vùng, danh sách, thẻ đều dùng cùng số này.
  if (M) ofSyncChk(M.plans, M);
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
    + `<div class="muted" style="font-size:9.5px;line-height:1.35;margin:2px 0 5px">x/y = điều kiện đạt / cần (hình thái nến + xác nhận theo menu, tối thiểu ${lgMin}) của <b>lần chạm gần nhất hôm nay</b>: cùng một con số ở nhãn vùng, danh sách, thẻ và ký hiệu trên nến đó. ⛔ = cổng chưa qua · ✔ = đủ. "–" = hôm nay chưa chạm. <b>ĐỨNG NGOÀI</b> = bị bộ lọc ở menu trái loại, không vào lệnh cả 2 hướng; rê chuột vào nhãn để xem lý do.</div>`
    + (() => { const dn = live.filter((p) => p.state === "ĐÃ VÀO"); return dn.length ? `<div class="muted" style="font-size:9.5px;margin:2px 0 4px">Đã vào hôm nay (ẩn khỏi danh sách, xem tab «Lệnh hôm nay»): ${dn.map((p) => `<span data-ofgo="${p.id}" style="cursor:pointer;color:${OF_COL[p.side]}">${p.short} ${p.side} ${ofFm((p.lo + p.hi) / 2)}</span>`).join(" · ")}</div>` : ""; })()   // 9b-5b: «Theo dõi diễn biến» chỉ giữ kế hoạch CHƯA vào lệnh
    + live.filter((p) => p.state !== "ĐÃ VÀO").map((p) => { const full = p.blocked ? (p.why || "Gamma âm: không bắt đáy") : p.past ? "giá đã ở bên kia tường (đã qua)" : p.dist === 0 ? "giá trong vùng" : "còn " + p.dist.toFixed(2) + "$ tới vùng";
      const sh = p.blocked ? (p.why || full) : p.past ? "giá đã qua tường" : p.dist === 0 ? "giá đang trong vùng" : "còn " + p.dist.toFixed(1) + "$ tới vùng";
      return `<div data-ofgo="${p.id}" title="Bấm để mở kế hoạch này ở tab «Kế hoạch mới». ${(ofStateTip(p) ? ofStateTip(p).replace(/<\/?(div|b|br)[^>]*>/g, " ").replace(/\s+/g, " ").trim() : full).replace(/"/g, "&quot;")}" style="display:grid;grid-template-columns:62px 60px 42px 26px 1fr;gap:3px;align-items:start;margin:3px 0;font-size:9px;line-height:1.25;cursor:pointer${OFV.focus === p.id ? ";outline:1px solid #f0b429;border-radius:3px" : ""}"><b style="color:${OF_COL[p.side]};font-size:9px;white-space:nowrap">${p.short}</b><span style="text-align:center">${ofBadge(p.state, p.side)}</span><span style="text-align:center">${ofChip(p)}</span><span style="color:${OF_COL[p.side]};font-weight:700;font-size:9px">${p.side}</span><span class="muted" style="font-size:9px">${sh}</span></div>`; }).join("")
    + `<div style="margin-top:8px"><b>Cổng kiểm</b>${M.gates.map(gate).join("")}</div>` + ofCondHtml(M);
  const kv = (a, b) => `<div class="muted">${a}</div><div>${b}</div>`, k = M.k, sc = M.sc, dxy = S.state?.macro?.DXY?.chg_n_pct;
  const X = ofCtxExtra(M);   // B9b5c-3: thêm các dòng của bảng «Bối cảnh» trang «Vào lệnh» (đã bỏ trang đó)
  const Q = of3Q(M), dFlip = (M.flip == null ? "chưa rõ Flip" : `Theo Flip: <b>${M.negG ? "ÂM" : "DƯƠNG"}</b> · Flip ${ofFm(M.flip)} · cách ${M.rgp.pctTxt}${M.rgp.far ? " (Flip xa: chế độ ổn định, KHÔNG chặn lệnh — anh Nam 25/11)" : ""}${M.flipNear ? ` (trong vùng đệm ${M.fbL.w.toFixed(1).replace(".", ",")}$: TL1·TL2·HG đứng ngoài${ofFbOn("A") ? ", 9A đứng ngoài" : ""}${ofFbOn("B") ? ", 9B đứng ngoài" : ""})` : M.fbL ? ` · vùng đệm ±${M.fbL.w.toFixed(1).replace(".", ",")}$ (${M.fbL.txt})` : ""}` + (M.blockG ? " → BUY bắt đáy bị chặn" : "")), dBang = String((() => { const A = bangA(); if (!A) return "<br>Theo Bảng A: —"; const v = M.flip == null ? "" : bangAvsFlip(A, M.negG); return `<br>Theo Bảng A (tổng GC+GLD ${fmtK(A.g)}$): <b>${A.short}</b>${v ? ` → <b style="color:${v === "KHÁC" ? "#ff8a65" : v === "khớp" ? "#26b384" : "#f0b429"}">${v === "KHÁC" ? "KHÁC chế độ theo Flip" : v === "khớp" ? "khớp chế độ theo Flip" : "trung tính, Flip quyết"}</b>` : ""} <span class="muted">(chỉ để xem; 9A/9B vẫn chọn theo Flip; thiếu pool XAU/QTY)</span>`; })()).replace(/^<br>/, "");
  $("#ofC").innerHTML = of3Row(1, "1. Net GEX", Q.l1, X.gex)
    + of3Row(2, "2. Giá ↔ Flip", Q.l2, dFlip)
    + of3Row(3, "3. Dealer", Q.l3, dBang)
    + of3Row(4, "4. Hướng", Q.l4, Q.d4)
    + kv("Magnet", X.mag)
    + kv("Vùng Hedge", X.hedge)
    + kv("Hệ số kỳ hạn", X.tenor)
    + kv("Giá / Tường", `${ofFm(M.px)} · Call Wall ${ofFm(M.cw)} (cách ${Math.abs(M.cw - M.px).toFixed(1)}$) · Put Wall ${ofFm(M.pw)} (cách ${Math.abs(M.pw - M.px).toFixed(1)}$)`)
    + kv("Hội tụ gần nhất", X.conf)
    + kv(`Nến đóng ${vnClock(k.time)}`, `${X.wick} · CVD dốc ${M.slope > 0 ? "lên ↑" : M.slope < 0 ? "xuống ↓" : "phẳng"} · Delta ${k.delta > 0 ? "+" : k.delta < 0 ? "−" : ""}${Math.abs(k.delta).toFixed(0)} · Volume ${M.avg > 0 ? (k.vol / M.avg).toFixed(2) : "?"}× SMA${sc.vol_sma} (cần ≥ ${sc.vol_spike_mult}×)`)
    + kv("CVD", X.div)
    + kv("SMC", X.smc)
    + kv("ΔOI gần nhất", M.doi ? `${M.doi.d_oi} tại strike ${M.doi.chart}` : `không có strike trong ${sc.doi_zone}$`)
    + kv("DXY", dxy == null ? "—" : `${dxy >= 0 ? "+" : ""}${Number(dxy).toFixed(3)}% (ngưỡng ${sc.dxy_thr_pct}%) · chỉ tính khi live`)
    + kv("Cấu hình", `xác nhận tối thiểu ${Number.isInteger(OFS.minConf) ? OFS.minConf : sc.min_confirm} · nghỉ ${sc.cooldown_bars} nến · chạm tường ≤ ${sc.touch_tol}$ · SL ± ${sc.sl_buffer}$`);
  const c = S.candles, sgK = new Set(), sg = [...(S.of9Sig || []), ...S.signals].filter((g) => { if (!c[g.i]) return false; const k = ofKey(g); if (sgK.has(k)) return false; sgK.add(k); return true; }).sort((a, b) => b.time - a.time);   // 9b-5b: khử trùng theo mã lệnh   // v23am-18: cả lệnh 9A/9B (trước đây không có trong danh sách này)
  let W = []; try { W = ofWatchCached(M).filter((w) => w.first); } catch (e) { /* bỏ qua */ }   // 9b-5c: cùng nguồn với chart (có số «lần», có ký hiệu đã chốt)
  ofRefresh();
  const stOf = (g) => (S.ofRes ? S.ofRes.get(ofKey(g)) : null);
  const stt = (g) => { const x = stOf(g); if (x && x.res) return x.res.status === "open" ? "đang chạy" : OF_ST_TXT[x.res.status] || x.res.status; return rrManage(g, c).t || "đang chạy"; };   // v23am-18: cùng luật với khung đo (hòa vốn, hết giờ 12:30 Chicago)
  const run = sg.filter((g) => stt(g) === "đang chạy").length;
  $("#ofAct").textContent = near ? near.state : "";
  $("#ofTabs").innerHTML = `<button type="button" data-oftab="new" class="${OFV.tab === "new" ? "on" : ""}" style="margin:0 6px 6px 0;padding:3px 10px;border-radius:5px;border:1px solid rgba(255,255,255,.2);background:${OFV.tab === "new" ? "#f0b429" : "transparent"};color:${OFV.tab === "new" ? "#1b1407" : "inherit"};cursor:pointer">Kế hoạch mới</button>`
    + `<button type="button" data-oftab="run" style="margin:0 6px 6px 0;padding:3px 10px;border-radius:5px;border:1px solid rgba(255,255,255,.2);background:${OFV.tab === "run" ? "#f0b429" : "transparent"};color:${OFV.tab === "run" ? "#1b1407" : "inherit"};cursor:pointer">Lệnh hôm nay (${sg.length}${run ? " · " + run + " đang chạy" : ""})</button>`
    + `<button type="button" data-oftab="watch" style="margin:0 6px 6px 0;padding:3px 10px;border-radius:5px;border:1px solid rgba(255,255,255,.2);background:${OFV.tab === "watch" ? "#f0b429" : "transparent"};color:${OFV.tab === "watch" ? "#1b1407" : "inherit"};cursor:pointer">Nến quan sát (${W.length})</button>`;
  const watchHtml = `<div class="muted" style="font-size:10.5px;margin-bottom:6px">◉ trên chart = nến chạm vùng / đóng xuyên tường của một kế hoạch. x/y tính trên chính nến đó, theo mốc tường và chế độ Gamma HIỆN TẠI. Chỉ để quan sát, chưa kiểm định.</div>`
    + (W.slice().reverse().map((w) => `<div style="border-left:3px solid ${OF_COL[w.p.side]};padding:4px 8px;margin:0 0 8px;border-radius:4px"><div>${ofNumW(w) ? `<b style="color:#f0b429">#${ofNumW(w)}</b> ` : ""}<b style="color:${OF_COL[w.p.side]}">${vnClock(w.time)} ${w.p.short} ${w.p.side}</b>${ofEntW(w) ? ' <b style="color:#7be0b0">✔ ĐÃ VÀO LỆNH</b>' : ""} <a href="#" data-ofgo="${w.p.base || w.p.id}" style="font-size:10.5px;color:#f0b429">→ xem kế hoạch</a> · <b>${ofSimple(w.chk)}</b> <span class="muted" style="font-size:10.5px" title="x/y = (ô hình thái đạt + ô xác nhận tính, tối đa bằng số cần) / (số ô hình thái + số xác nhận cần). Cổng (vd Khung nến ≥ M5) không tính vào x/y.">= hình thái ${w.chk.shOk}/${w.chk.shape.length} + xác nhận ${w.chk.xOk}/${w.chk.need} (đang có ${w.chk.cOk})</span>${w.chk.full ? " · <b style=\"color:#26b384\">ĐỦ</b>" : ofCandleOk(w.chk) && w.chk.gOk < w.chk.gate.length ? " · <b style=\"color:#f0b429\">nến đã thỏa, cổng chưa qua</b>" : ""}${w.p.blocked ? ` · <span class="muted">bị chặn: ${w.p.why || ""}</span>` : ""}</div><div class="muted" style="font-size:10.5px">Kế hoạch: ${w.p.name}</div>${ofNextStep(w)}<div style="font-size:11px;margin-left:6px">${ofChkLines(w.chk)}</div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px"><div style="flex:1 1 200px;min-width:0"><b style="font-size:10.5px">Mẫu luật cần có</b>${ofIllu(w.p, true)}</div><div style="flex:1 1 200px;min-width:0"><b style="font-size:10.5px">Thực tế (nến quanh lần chạm)</b>${ofRealMini(w)}</div></div><div class="muted" style="font-size:10px">Hình mẫu không theo tỉ lệ giá; hình thực tế theo giá thật. Xanh = nến tăng, đỏ = nến giảm.</div></div>`).join("") || '<span class="muted">Hôm nay chưa có nến nào chạm vùng / đóng xuyên tường của kế hoạch nào.</span>');
  // 9b-5b: thứ tự thẻ: kế hoạch GẦN NHẤT trước, rồi theo khoảng cách tới vùng; kế hoạch bị lọc (ĐỨNG NGOÀI) xuống cuối. Mỗi thẻ có mã ngắn giống nhãn chart và danh sách bên trái.
  const liveS = live.slice().sort((a, b) => (near && a === near ? -1 : near && b === near ? 1 : 0) || ((a.blocked ? 1 : 0) - (b.blocked ? 1 : 0)) || ((a.dist == null ? 1e9 : a.dist) - (b.dist == null ? 1e9 : b.dist)));
  $("#ofP").innerHTML = OFV.tab === "new"
    ? '<div class="muted" style="font-size:10.5px;margin-bottom:6px">Thứ tự: kế hoạch gần giá nhất ở trên, kế hoạch bị lọc (ĐỨNG NGOÀI) ở cuối. Mã ngắn (vd «9A TƯỜNG») giống nhãn trên chart và danh sách «Theo dõi diễn biến»; bấm một dòng ở danh sách đó để nhảy tới thẻ.</div>'
    + liveS.map((p) => `<div data-ofcard="${p.id}" style="border-left:3px solid ${OF_COL[p.side]};padding:4px 8px;margin:0 0 8px;border-radius:4px${OFV.focus === p.id ? ";outline:2px solid #f0b429;background:rgba(240,180,41,.06)" : near && p === near ? ";background:rgba(240,180,41,.04)" : ""}"><div>${ofShortChip(p.short, OF_COL[p.side])}<b style="color:${OF_COL[p.side]}">${p.name}</b> ${ofBadge(p.state, p.side)}${near && p === near ? ' <b style="color:#f0b429;font-size:10.5px">◀ GẦN NHẤT</b>' : ""}</div>`
      + (ofStateWhy(p) && p.state !== "ĐÃ QUA" ? `<div style="font-size:10.5px;margin:2px 0;color:#f0b429">${p.state}: ${ofStateWhy(p)}</div>` : "")
      + `<div>Vùng: <b>${p.lo === p.hi ? ofFm(p.lo) : ofFm(p.lo) + "–" + ofFm(p.hi)}</b>${p.past ? " · giá ĐÃ QUA tường (chờ giá quay lại rồi mới tính)" : p.dist ? " · cách " + p.dist.toFixed(2) + "$" : ""}</div><div>Điều kiện: ${p.cond}</div><div class="muted" style="font-size:10.5px">Xác nhận theo menu (cần ≥ ${lgMin}): ${(p.live || p.chk) && (p.live || p.chk).conf && (p.live || p.chk).conf.length ? (p.live || p.chk).conf.map((x) => x[0]).join(", ") : "chưa tick ô nào"}</div>${ofChkHtml(p)}${p.side === "BOTH" ? `<div class="muted" style="margin-top:4px">Hai kịch bản sau khi giá ra khỏi vùng rồi quay lại:</div>` + ofIllu({ id: "hg0", side: "SELL" }, true) + ofIllu({ id: "hg0", side: "BUY" }) : ofPlanPics(p)}`
      + `<div>SL ${p.sl} · TP1 <b>${typeof p.tp1 === "number" ? ofFm(p.tp1) : p.tp1 || "—"}</b>${p.tp2 != null ? " · TP2 " + ofFm(p.tp2) : ""}</div><div class="muted">Huỷ khi: ${p.cancel}</div></div>`).join("") || '<span class="muted">Chưa có nhóm nào được bật.</span>'
    : OFV.tab === "watch" ? watchHtml
    : ofRunHeadHtml(sg.map(stOf).filter(Boolean)) + ofRunListHtml(sg, stt, stOf);
}
// 9b-5b: tab «Lệnh hôm nay»: bộ lọc Trạng thái (đang chạy / đã đóng / tất cả) + Loại (tường 9A/9B / HG / TL); khi xem «tất cả» thì chia 2 nhóm ĐANG CHẠY rồi ĐÃ ĐÓNG (thẻ đã đóng thu gọn)
function ofRunListHtml(sg, stt, stOf) {
  const rf = OFV.rf, isRun = (g) => stt(g) === "đang chạy";
  const byK = (k) => sg.filter((g) => k === "all" || ofKind(g) === k), cntSt = (st, k) => byK(k).filter((g) => (st === "all" ? true : st === "open" ? isRun(g) : !isRun(g))).length;
  const chip = (key, val, txt) => { const on = rf[key] === val; return `<button type="button" data-ofrf="${key}:${val}" style="margin:0 4px 4px 0;padding:1px 8px;border-radius:10px;font-size:10.5px;border:1px solid ${on ? "#f0b429" : "rgba(255,255,255,.2)"};background:${on ? "#f0b429" : "transparent"};color:${on ? "#1b1407" : "inherit"};cursor:pointer">${txt}</button>`; };
  const bar = `<div style="margin:0 0 6px">${chip("st", "all", `Tất cả (${cntSt("all", rf.k)})`)}${chip("st", "open", `● Đang chạy (${cntSt("open", rf.k)})`)}${chip("st", "closed", `Đã đóng (${cntSt("closed", rf.k)})`)}<br>`
    + chip("k", "all", `Mọi loại (${sg.length})`) + ["wall", "gld", "hg", "tl"].filter((k) => k !== "gld" || ofX("x_gld9") || byK(k).length).map((k) => chip("k", k, `${OF_KIND_TXT[k]} (${byK(k).length})`)).join("") + "</div>";
  const card = (g, small) => { const run = isRun(g), kd = ofKind(g), col = OF_COL[g.side];
    return `<div style="border-left:3px solid ${col};padding:4px 8px;margin:0 0 ${small ? 5 : 8}px;border-radius:4px${small ? ";opacity:.85" : ""}"><div>${ofShortChip(OF_KIND_TXT[kd], "#9aa4b2")}${ofNumOf(g) ? `<b style="color:#f0b429">#${ofNumOf(g)}</b> ` : ""}<b style="color:${col}">${vnClock(g.time)} ${g.tag || ""} ${g.side}${g.virt ? " ✔ đủ điều kiện" : " " + g.score + "/" + g.max}</b> · <b>${stt(g)}</b>${g.rebuilt ? ' <span style="color:#ff8a65;font-size:10.5px" title="Lệnh dựng lại từ mốc tường HIỆN TẠI (lúc lệnh xuất hiện trình duyệt chưa mở hoặc chưa chốt): không ghi nhật ký, có thể biến mất khi tường đổi">· dựng lại, chưa chốt</span>' : ""}</div>`
      + `<div>Vào ${ofFm(g.entry)} · SL ${ofFm(g.sl)} · TP1 ${ofFm(g.tp1)}${g.tp2 != null ? " · TP2 " + ofFm(g.tp2) : ""}</div>`
      + (small ? ofStatusHtml(stOf(g)) : `<div class="muted">${g.type ? g.type.replace("[Options Flow] ", "") : g.tag === "9D" ? "9D · phá vỡ tường GLD (Gamma âm) · THỬ NGHIỆM" : g.tag === "9C" ? "9C · bật lại từ tường GLD · THỬ NGHIỆM" : g.tag === "9B" ? "9B · phá vỡ tường (Gamma âm)" : "9A · bật lại từ tường"}</div>${ofStatusHtml(stOf(g))}${ofTickLine(g)}`) + "</div>"; };
  const L = byK(rf.k), R = L.filter(isRun), D = L.filter((g) => !isRun(g)), hd = (t) => `<div style="font-weight:700;color:#f0b429;margin:6px 0 4px;font-size:11px">${t}</div>`;
  let body = "";
  if (rf.st !== "closed") body += (rf.st === "all" ? hd(`● ĐANG CHẠY (${R.length})`) : "") + (R.map((g) => card(g, false)).join("") || '<div class="muted" style="margin-bottom:6px">Không có lệnh đang chạy.</div>');
  if (rf.st !== "open") body += (rf.st === "all" ? hd(`ĐÃ ĐÓNG (${D.length})`) : "") + (D.map((g) => card(g, true)).join("") || '<div class="muted">Chưa có lệnh đã đóng.</div>');
  return bar + (sg.length ? body : '<span class="muted">Hôm nay chưa có tín hiệu.</span>');
}
// 9b-5b: hình nến THỰC TẾ quanh lần chạm (6 nến trước → 4 nến sau), có vùng tường, để so với hình mẫu của luật. Nến chạm đánh dấu ▼/▲.
function ofRealMini(w, back = 6, fwd = 4, lab) {
  const c = S.candles, j = w.j, a = Math.max(0, j - back), b = Math.min(c.length - 1, j + fwd), K = c.slice(a, b + 1); if (!K.length) return "";
  const p = w.p, W = 300, H = 108, lo = Math.min(p.lo, ...K.map((k) => k.low)), hi = Math.max(p.hi, ...K.map((k) => k.high)), pad = (hi - lo) * 0.08 || 1;
  const Y = (v) => 6 + ((hi + pad - v) / (hi - lo + 2 * pad)) * (H - 12), dx = Math.min(24, 250 / K.length), X = (i) => 10 + i * dx + dx / 2;
  let g = `<rect x="4" y="${Y(p.hi)}" width="${W - 8}" height="${Math.max(2, Y(p.lo) - Y(p.hi))}" fill="rgba(240,180,41,.16)" stroke="rgba(240,180,41,.6)" stroke-dasharray="3 3"/><text x="${W - 6}" y="${Y(p.hi) - 2}" font-size="10" fill="#f0b429" text-anchor="end">tường ${ofFm((p.lo + p.hi) / 2)}</text>`;
  K.forEach((k, i) => { const col = k.close >= k.open ? "#26a69a" : "#ef5350", x = X(i), t = Math.min(Y(k.open), Y(k.close));
    g += `<line x1="${x}" x2="${x}" y1="${Y(k.high)}" y2="${Y(k.low)}" stroke="${col}" stroke-width="1.5"/><rect x="${x - dx * 0.3}" y="${t}" width="${dx * 0.6}" height="${Math.max(1.5, Math.abs(Y(k.close) - Y(k.open)))}" fill="${col}"/>`;
    if (a + i === j) g += `<text x="${x}" y="${Math.max(10, Y(k.high) - 3)}" font-size="10" fill="#f0b429" text-anchor="${lab ? "end" : "middle"}">▼ ${lab || vnClock(k.time)}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:460px;display:block;margin:2px 0;border-radius:4px;background:rgba(255,255,255,.02)" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">${g}</svg>`;
}
// 9b-5b: thẻ kế hoạch 9A/9B: hình MẪU = kịch bản đang CHỜ (ghi rõ hướng giá phải đi), đặt cạnh hình nến THỰC TẾ 12 nến gần nhất + vị trí giá so với tường
function ofPlanPics(p) {
  if (!/^nw/.test(p.id || "") || !S.candles || !S.candles.length) return ofIllu(p);
  const c = S.candles, px = c[c.length - 1].close, lvl = (p.lo + p.hi) / 2, sell = p.side === "SELL", brk = /^nwb/.test(p.id);
  const pos = px > p.hi ? `giá đang ở TRÊN tường ${ofFm(px - lvl)}$` : px < p.lo ? `giá đang ở DƯỚI tường ${ofFm(lvl - px)}$` : "giá đang TRONG vùng tường";
  const wait = brk ? `nến M5 đóng ${sell ? "DƯỚI" : "TRÊN"} tường ≥ 0,15%, thân lớn → ${p.side}` : sell ? "giá hồi LÊN chạm vùng rồi có nến đóng quay XUỐNG ≥ 0,10% → SELL" : "giá rơi XUỐNG chạm vùng rồi có nến đóng quay LÊN ≥ 0,10% → BUY";
  return `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px"><div style="flex:1 1 200px;min-width:0"><b style="font-size:10.5px">Kịch bản đang CHỜ: ${wait}</b>${ofIllu(p, true)}</div>`
    + `<div style="flex:1 1 200px;min-width:0"><b style="font-size:10.5px">Thực tế bây giờ: ${pos}</b>${ofRealMini({ j: c.length - 1, p }, 11, 0, "bây giờ")}</div></div>`
    + '<div class="muted" style="font-size:10px">Hình bên trái là MẪU điều phải xảy ra tiếp theo (không theo tỉ lệ giá), không phải chuyện đã xảy ra; hình bên phải là nến thật. Xanh = nến tăng, đỏ = nến giảm.</div>';
}
// 9b-5b: nến quan sát: một dòng «còn thiếu gì» để biết cần chờ gì tiếp (chỉ diễn giải bảng ✔/✘, không thêm luật)
function ofNextStep(w) {
  const h = w.chk; if (!h || !h.tot) return "";
  const box = (t, col) => `<div style="font-size:10.5px;margin:3px 0;padding:3px 6px;border-radius:4px;background:rgba(255,255,255,.04);color:${col}">${t}</div>`;
  if (h.full && /^nw/.test(w.p.id) && w.nth > 1 && ofEntW(w)) return box(`✔ ĐÃ VÀO LỆNH #${ofNumW(w) || "?"} · LẦN 2 · SO SÁNH, KHÔNG theo B10b, CHƯA KIỂM CHỨNG: lần đầu hôm nay lúc ${vnClock(w.firstT)}; lệnh này chỉ vào vì công tắc «Cho phép lần 2» đang bật, KHÔNG chiếm suất 1 lệnh/phía · 2 lệnh/ngày của B10b.`, "#ffb74d");
  if (h.full && /^nw/.test(w.p.id) && w.nth > 1) return box(`✔ Nến đạt đủ điều kiện nhưng KHÔNG vào lệnh: ${w.p.short} ${w.p.side} đã có lần đầu hôm nay lúc ${vnClock(w.firstT)} (luật: mỗi tường, mỗi chiều chỉ tính lần đầu trong ngày).`, "#9aa4b2");   // 9b-5c (số 239)
  if (h.full && /^nw/.test(w.p.id)) return ofEntW(w) ? box(`✔ ĐÃ VÀO LỆNH #${ofNumW(w) || "?"}: vào ở giá MỞ nến kế (xem tab «Lệnh hôm nay»).`, "#26b384") : box("Nến đạt đủ điều kiện nhưng CHƯA thành lệnh (xem dòng ✔/✘ bên dưới).", "#9aa4b2");
  if (h.full) return box("Đủ điều kiện ở nến này (nhóm TL: lệnh do bộ máy tín hiệu riêng quyết định, xem tab «Lệnh hôm nay»).", "#26b384");
  if (w.p.blocked) return box(`⛔ Kế hoạch đang bị lọc (ĐỨNG NGOÀI): ${w.p.why || ""}. Dù nến đạt cũng không vào lệnh.`, "#ff8a65");
  const sh = h.shape.filter((x) => !x[0]).map((x) => x[1]);
  if (sh.length) return box(`⏳ Còn thiếu HÌNH THÁI NẾN: ${sh.join("; ")}. Xác nhận theo menu hiện đạt ${h.cOk}/${h.need} (cần ≥ ${h.need}).`, "#f0b429");
  if (h.cOk < h.need) return box(`⏳ Hình thái nến đã đạt, còn thiếu XÁC NHẬN: đang có ${h.cOk}, cần ≥ ${h.need} (các ô ✘ bên dưới).`, "#f0b429");
  const gt = h.gate.filter((x) => !x[0]).map((x) => x[1]);
  return box(`⛔ Nến đã thỏa nhưng CỔNG chưa qua: ${gt.join("; ")}.`, "#ff8a65");
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
  // 9b-4: XẾP LẠI MENU (chỉ đổi chỗ + tiêu đề, KHÔNG đổi phép tính). ①②③ = làm ĐỔI tín hiệu · ④ = chỉ đổi cách vẽ · Nâng cao thu gọn.
  // Khung đo SL/TP + quản lý lệnh của Option Flow chuyển sang mục «📏 TP / SL» (khối #ofTpBox, xem dưới). 3 ô Flip gộp thành 1 ô chọn «Cách dùng Flip».
  const txt = (arr, k) => (arr.find((x) => x[0] === k) || [null, k])[1];
  const xrow = (k, t) => `<label style="display:block;margin:2px 0;cursor:pointer"><input type="checkbox" data-ofx="${k}"${ofX(k) ? " checked" : ""}> ${t}</label>`;
  const H = (t, s) => `<div class="sub" style="margin-top:10px">${t}</div>${s ? `<div class="muted" style="font-size:10.5px;margin:0 0 3px">${s}</div>` : ""}`;
  const sel = (id, opts, cur) => `<select id="${id}" style="font-size:12px">${opts.map(([v, t]) => `<option value="${v}"${cur === v ? " selected" : ""}>${t}</option>`).join("")}</select>`;
  const gm = OF_CONDS.find(([k]) => k === "gamma");
  d.innerHTML = `<summary style="cursor:pointer;font-weight:600">Cài đặt Option Flow (TL1 · TL2 · HG · 9A/9B · 9C/9D🧪)</summary>
    <div id="ofWarn" style="display:none;color:#ff6b6b;font-weight:600;margin:4px 0"></div>
    <div class="muted" style="margin:2px 0 4px">Bảng theo dõi ở trang "Vào lệnh OF" bên phải. Nhóm ① ② ③ làm ĐỔI tín hiệu; nhóm ④ chỉ đổi cách vẽ. Khung đo SL/TP và quản lý lệnh nằm ở mục «📏 TP / SL».</div>
    ${H("① Bật nhóm tín hiệu")}${["g_tl1", "g_trap", "g_hedge"].map((k) => row(k, txt(OF_GROUPS, k), [k])).join("")}${xrow("x_near", txt(OF_FILTERS, "x_near") + " → nguồn tường cho 9A/9B")}
    <div class="muted" style="font-size:10.5px;margin:2px 0 0">Lưu ý: HG lấy TP theo tường ĐANG HIỂN THỊ, nên bật/tắt nút GC Levels / GLD Levels trên thanh đầu cũng đổi TP của HG.</div>
    ${H("② Bộ lọc đứng ngoài", "không đạt thì KHÔNG ra lệnh (cả BUY lẫn SELL)")}${row("session", txt(OF_GROUPS, "session"), ["session"])}${row(gm[0], gm[1], gm[2])}${xrow("x_regime", txt(OF_FILTERS, "x_regime"))}
    <div class="muted" style="margin:4px 0 2px">Lọc Flip (anh Nam 25/11: Flip XA không chặn; chỉ đứng ngoài khi giá trong VÙNG ĐỆM quanh Flip):</div>${sel("ofFlip", OF_FLIP_OPTS, ofFlipMode())}
    <div class="muted" style="margin:2px 0 2px">Vùng đệm quanh Flip: ${sel("ofFbM", FB_MODES, ofFbMode())} <span id="ofFbVw">${ofFbValSel()}</span></div>
    <div class="muted" style="font-size:10.5px;margin:0 0 3px" id="ofFbNow">${ofFbNowTxt()}</div>
    ${row("fbA", "9A bật lại: ĐỨNG NGOÀI khi giá trong vùng đệm (bật lại cần Gamma dương ổn định; sát Flip dễ đổi chế độ)", ["fbA"])}${xrow("fbB", "9B theo xu hướng: ĐỨNG NGOÀI khi giá trong vùng đệm (mặc định TẮT: B10b coi chính Flip là mốc để đánh 9B; bật thì 9B tại Flip không bao giờ vào)")}
    <div class="muted" style="font-size:10.5px;margin:0 0 4px">TL1 · TL2 · HG: vẫn đứng ngoài khi giá trong vùng đệm (như trước, khi «Lọc Flip» bật). <b style="color:#f0b429">Độ rộng vùng đệm và cách tách theo loại lệnh là GIẢ THUYẾT, anh Nam chưa cho số, chưa kiểm định.</b></div>
    <div class="muted" style="margin:2px 0 4px">Tỉ lệ lời/lỗ tối thiểu (TP1 ÷ SL) của TL1·TL2·HG: ${sel("ofRR", [0, 0.5, 1, 1.5, 2].map((n) => [n, n === 0 ? "0 (tắt)" : String(n)]), Number(OFS.minRR) || 0)} (thấp hơn thì KHÔNG ra tín hiệu)</div>
    <div class="muted" style="margin:2px 0 4px">R:R tối thiểu riêng cho nhóm HG (TP1 = tường đang hiển thị kế tiếp): ${sel("ofRRh", [0, 1, 1.5, 2, 2.5, 3].map((n) => [n, n === 0 ? "0 (tắt)" : String(n)]), hgRRmin())} (mặc định 2 = lời ≥ 2 × lỗ)</div>
    ${H("②b 9A/9B theo B10b (dự thảo anh Nam 23/11)", "mặc định = đúng B10b; tắt ô nào là đi KHÁC B10b (chỉ để so). B10b chưa được duyệt chính thức, CHƯA KIỂM ĐỊNH bằng backtest.")}
    ${xrow("x_nwconf", "Bắt 9A/9B đạt thêm ô xác nhận theo menu ③ (KHÔNG có trong B10b; mặc định TẮT)")}${row("b10bTime", "Không VÀO lệnh 9A/9B từ " + CHV("11:30") + " tới khi có OI mới (xấp xỉ " + CHV("20:00") + "); lệnh đang chạy vẫn đóng lúc " + CHV("12:30"), ["b10bTime"])}
    ${row("b10bCap", "Tối đa 1 lệnh mỗi phía (BUY/SELL) và 2 lệnh mỗi ngày, tính cả lệnh đã chốt hôm nay", ["b10bCap"])}${row("b10bOne", "Không mở lệnh 9A/9B mới khi lệnh 9A/9B trước còn đang mở", ["b10bOne"])}
    ${xrow("x_nw2", '<b style="color:#ffb74d">Cho phép LẦN 2</b> (cú chạm/phá thứ 2, 3… cùng tường cùng chiều trong ngày) — KHÔNG theo B10b, CHƯA KIỂM CHỨNG, chỉ để SO SÁNH; mặc định TẮT. Lệnh lần 2 ghi riêng (nhãn «LẦN 2», nhật ký alt = lan2), không chiếm suất 1 lệnh/phía · 2 lệnh/ngày')}
    ${xrow("x_nwrt", '<b style="color:#ffb74d">9B HỒI TEST</b> (phá tường rồi quay lại chạm, bị đẩy đi tiếp → vào theo hướng phá; chỉ ngày Gamma âm) — KHÔNG có trong B10b, CHƯA KIỂM CHỨNG, chỉ để SO SÁNH; mặc định TẮT. Ghi riêng (nhãn «HỒI TEST», nhật ký alt = retest), không chiếm suất B10b')}
    ${xrow("x_gld9", '<b style="color:#ce93d8">9C/9D tường GLD — THỬ NGHIỆM</b>: thêm top 3 tường của nguồn phụ (GLD) trong ±2,5% quanh giá mở ngày, luật y hệt 9A/9B (9C = bật lại như 9A, 9D = phá vỡ như 9B). CHƯA KIỂM CHỨNG (GLD chưa từng kiểm ở bước 6/8); mặc định TẮT. Ghi riêng (nhãn 9C/9D, nhật ký alt = gld), không chiếm suất 1 lệnh/phía · 2 lệnh/ngày; bỏ tường GLD trùng ±0,10% với tường 9A/9B')}
    ${row("b10bF9B", "9B tại Gamma Flip: Flip cũng là một mốc để đánh 9B phá vỡ (B10b: «tường gần hoặc Gamma Flip»; chỉ ngày Gamma âm)", ["b10bF9B"])}
    ${H("③ Điều kiện xác nhận", "nến phải đạt ít nhất «Số xác nhận tối thiểu» trong các ô đang tick (x/y trên chart)")}
    <div class="muted" style="margin:2px 0 4px">Số xác nhận tối thiểu: ${sel("ofMin", [0, 1, 2, 3, 4].map((n) => [n, String(n)]), Number.isInteger(OFS.minConf) ? OFS.minConf : S.cfg.signals.min_confirm)} (mặc định 2)</div>
    <div class="muted" style="font-size:10.5px;margin:2px 0 4px">Các ô bên dưới áp cho TL1 · TL2 · HG. 9A/9B theo B10b KHÔNG dùng ô xác nhận (xem khối «9A/9B theo B10b» ở trên).</div>
    <div class="muted" style="margin:2px 0 4px">Bộ xác nhận: ${sel("ofPreset", [["custom", "Tùy chỉnh (tự tick)"], ["doc", "Chỉ theo tài liệu (TL2)"], ["all", "Bật tất cả"]], ofPresetNow())}</div>
    <div class="sub" style="margin-top:6px;color:#26b384">📄 Theo tài liệu anh Nam (TL2)</div>${OF_CONDS.filter(([k]) => OF_DOC.includes(k)).map(([k, t, n]) => row(k, t, n.map((x) => "c:" + x))).join("")}
    <div class="sub" style="margin-top:6px;color:#f0b429">🔧 Dashboard tự thêm (không có trong TL1/TL2)</div>${OF_CONDS.filter(([k]) => k !== "gamma" && !OF_DOC.includes(k)).map(([k, t, n]) => row(k, t, n.map((x) => "c:" + x))).join("")}
    <div class="muted" style="font-size:10.5px;margin:2px 0 0">⚠ «Chỉ theo tài liệu»: nhóm TL1 Thủng/Squeeze và HG KHÔNG có ô nào thuộc tài liệu → sẽ không ra tín hiệu (trừ khi «Số xác nhận tối thiểu» = 0); Bull/Bear Trap còn tối đa 3 ô. Con số 1,8× SMA20 của Volume spike cũng do dashboard tự đặt (số 189).</div>
    ${H("④ Hiển thị trên chart", "chỉ đổi cách vẽ, không đổi tín hiệu")}${row("zones", txt(OF_GROUPS, "zones"), ["zones"])}${row("watch", txt(OF_GROUPS, "watch"), ["watch"])}${xrow("hg_show", "Hiện nền màu + viền nét đứt của vùng HG HEDGE (bỏ tick = ẩn, chỉ còn nhãn, vì trùng vùng HEDGE −Γ)")}
    <details style="margin-top:8px"><summary class="muted" style="cursor:pointer">Nâng cao</summary>${row("wfreeze", "Khóa tỉ lệ quy đổi theo ngày ở TRÌNH DUYỆT (dự phòng). Máy chủ từ 9b-3 đã khóa ratio, nên ô này chỉ có tác dụng khi máy chủ không gửi mã khóa (ratio_lock_id)", ["wfreeze"])}</details>`;
  // 9b-4: khối «Khung đo Option Flow» đặt lên đầu mục «📏 TP / SL» của menu TVLB+ (tvlb_tinhieu.js); không tìm thấy mục đó thì để cuối khung này.
  const tpBox = document.createElement("div"); tpBox.id = "ofTpBox"; tpBox.style.cssText = "font-size:12px";
  tpBox.innerHTML = `<div class="sub">Khung đo Option Flow (TL1 · TL2 · HG · 9A/9B · 9C/9D🧪)</div>${row("rr", "Vẽ khung đo SL/TP cho tín hiệu Option Flow hôm nay", ["rr"])}
    <div class="muted" style="margin:2px 0 4px">Số khung: ${sel("ofBoxMax", [[0, "tất cả"], [3, "3 khung mới nhất"], [5, "5 khung mới nhất"], [8, "8 khung mới nhất"], [12, "12 khung mới nhất"]], OFS.boxMax == null ? 8 : +OFS.boxMax)} ${sel("ofBoxRun", [[0, "cả lệnh đã xong"], [1, "chỉ lệnh đang chạy"]], OFS.boxRun === true ? 1 : 0)}</div>
    <div class="muted" style="margin:2px 0 4px">Dời SL về hòa vốn khi lời +1R: ${sel("ofBE", [[1, "Bật"], [0, "Tắt"]], OFS.beOff === true ? 0 : 1)}</div>
    <div class="muted" style="margin:2px 0 4px">Đóng lệnh lúc ${CHV("12:30")}: ${sel("ofTE", [[1, "Bật"], [0, "Tắt"]], OFS.teOff === true ? 0 : 1)} (giả thuyết, chưa backtest)</div>
    <div class="muted" style="margin:2px 0 4px">Hai lệnh NGƯỢC CHIỀU chồng nhau (giả thuyết, chưa backtest): ${sel("ofOpp", [["warn", "Chỉ cảnh báo (mặc định)"], ["newer", "Đóng lệnh CŨ khi lệnh mới ngược chiều xuất hiện"], ["older", "Bỏ lệnh MỚI nếu đang có lệnh ngược chiều"]], ofOppRule())}</div>
    <div class="muted" style="margin:2px 0 4px">Gợi ý quản lý lệnh «Giả thuyết» (sắp ${chiToVn("12:30")} giờ VN, gần TP1, xuyên tường, vùng Hedge, đổi Gamma): ${sel("ofAdv", [[1, "Bật"], [0, "Tắt"]], OFS.advOff === true ? 0 : 1)}</div>
    <div class="note">Các ô BÊN DƯỚI (cách chốt lời, hộp +N lệnh, SL tối đa, đóng sau N nến) KHÔNG áp cho khung đo này: chúng dùng cho hộp lệnh KH, ký hiệu TVLB+ (B/S, OF·H, H-T, HL, SMC hub) và bảng backtest trang ⑤ (bảng này có cả Option Flow).</div>
    <div class="sub" style="margin-top:10px">Hộp lệnh KH · TVLB+ · backtest</div>`;
  const onChg = (e) => {
    if (e.target.id === "ofFlip") { for (const k of ["x_noflip", "x_flipfar", "x_flipnear"]) delete OFS[k]; const m = e.target.value;   // 9b-4: 1 ô chọn thay 3 ô tick (giữ nguyên 3 cờ cũ bên dưới)
      if (m === "near") OFS.x_flipnear = true; else delete OFS.x_flipnear;
      try { localStorage.setItem(OF_LS, JSON.stringify(OFS)); } catch { } replaySignals(); ofRender(); drawOverlay(); return; }
    if (e.target.id === "ofOpp" || e.target.id === "ofAdv") { if (e.target.id === "ofOpp") OFS.oppRule = e.target.value; else OFS.advOff = e.target.value === "0"; try { localStorage.setItem(OF_LS, JSON.stringify(OFS)); } catch { } ofRefresh(true); ofRender(); drawOverlay(); return; }
    if (e.target.id === "ofBE" || e.target.id === "ofTE") { OFS[e.target.id === "ofBE" ? "beOff" : "teOff"] = e.target.value === "0"; try { localStorage.setItem(OF_LS, JSON.stringify(OFS)); } catch { } ofRender(); drawOverlay(); return; }
    if (e.target.id === "ofBoxMax" || e.target.id === "ofBoxRun") { if (e.target.id === "ofBoxMax") OFS.boxMax = +e.target.value; else OFS.boxRun = e.target.value === "1"; try { localStorage.setItem(OF_LS, JSON.stringify(OFS)); } catch { } drawOverlay(); return; }
    if (e.target.id === "ofRRh") { OFS.minRRhg = +e.target.value; try { localStorage.setItem(OF_LS, JSON.stringify(OFS)); } catch { } replaySignals(); ofRender(); drawOverlay(); return; }
    if (e.target.id === "ofRR") { OFS.minRR = +e.target.value; try { localStorage.setItem(OF_LS, JSON.stringify(OFS)); } catch { } replaySignals(); ofRender(); drawOverlay(); return; }
    if (e.target.id === "ofPreset") { const m = e.target.value; if (m === "custom") return;   // B9b5c-3: bộ xác nhận theo tài liệu / tất cả
      for (const [k, , n] of OF_CONDS) { if (k === "gamma") continue; for (const x of n) { if (m === "all" || OF_DOC.includes(k)) delete OFS["c:" + x]; else OFS["c:" + x] = false; } }
      try { localStorage.setItem(OF_LS, JSON.stringify(OFS)); } catch { }
      d.querySelectorAll('input[data-of^="c:"]').forEach((el) => { el.checked = ofOn(el.dataset.of.split("|")[0]); });
      replaySignals(); ofRender(); drawOverlay(); return; }
    if (e.target.id === "ofMin") { OFS.minConf = +e.target.value; try { localStorage.setItem(OF_LS, JSON.stringify(OFS)); } catch { } replaySignals(); ofRender(); return; }
    if (e.target.id === "ofFbM" || e.target.id === "ofFbV") {   // B9b5d: vùng đệm Flip
      if (e.target.id === "ofFbM") { OFS.fbMode = e.target.value; const w = d.querySelector("#ofFbVw"); if (w) w.innerHTML = ofFbValSel(); }
      else { const m = ofFbMode(), v = +e.target.value; if (m === "pct") OFS.fbPct = v; else if (m === "atr") OFS.fbAtr = v; else OFS.flipNear = v; }
      try { localStorage.setItem(OF_LS, JSON.stringify(OFS)); } catch { } const nw = d.querySelector("#ofFbNow"); if (nw) nw.innerHTML = ofFbNowTxt();
      replaySignals(); ofRender(); drawOverlay(); return; }
    const ex = e.target.closest("input[data-ofx]");   // TVLB B9b1
    if (ex) { if (ex.checked) OFS[ex.dataset.ofx] = true; else delete OFS[ex.dataset.ofx]; try { localStorage.setItem(OF_LS, JSON.stringify(OFS)); } catch { } replaySignals(); ofRender(); drawOverlay(); return; }
    const el = e.target.closest("input[data-of]"); if (!el) return;
    for (const k of el.dataset.of.split("|")) { if (el.checked) delete OFS[k]; else OFS[k] = false; }
    try { localStorage.setItem(OF_LS, JSON.stringify(OFS)); } catch { /* bỏ qua */ }
    if (el.dataset.of === "wfreeze") { pollState(); return; }
    { const ps = d.querySelector("#ofPreset"); if (ps) ps.value = ofPresetNow(); }   // v23ak: bật/tắt khóa -> nạp lại dữ liệu từ server ngay
    replaySignals(); ofRender();
  };
  d.addEventListener("change", onChg); tpBox.addEventListener("change", onChg);
  { const nt = lab.nextElementSibling; (nt && nt.classList.contains("note") ? nt : lab).insertAdjacentElement("afterend", d); }   // 9b-5 (số 221): ô «Cài đặt Option Flow» nằm SAU ghi chú xám của TVLB+, không chen giữa
  { const tpb = document.querySelector('#tvlbPlus .grp[data-g="tp"] .gb'); if (tpb) tpb.insertBefore(tpBox, tpb.firstChild); else d.appendChild(tpBox); }
  ofCompactTop(); ofStartDecor();
  ofRender(); setInterval(ofRender, 3000);
  document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest("[data-offollow]"); if (!b) return; localStorage.setItem("tvlb.follow", localStorage.getItem("tvlb.follow") === "0" ? "1" : "0"); if (localStorage.getItem("tvlb.follow") !== "0") { localStorage.setItem("tvlb.setRev", "0"); ofSettingsPull(); } ofRender(); });   // điện thoại: bật/tắt «theo cài đặt máy tính»
  setTimeout(ofInitPage, 1500);   // đợi các trang ③④⑤ dựng xong để nút ⑥ nằm sau chúng
  setTimeout(ofInitNotes, 3500);   // 9b-5c: tab «📘 Sổ tay» ở cuối hàng tab (sau Backtest)
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
// 9b-5c: tab «📘 Sổ tay»: ghi chú học Option Flow (Net GEX, Gamma, Flip, Magnet, hút/đẩy, thứ tự đọc, nhãn chart). Chỉ là nội dung tĩnh, không đổi số liệu/tín hiệu.
const SOTAY_HTML = "<div class=\"stk\">\n<p class=\"muted\">Sổ tay học Option Flow · ghi từ chat B9b-5c và B9b-5d (24–25/11/2026); mục <b>⑤b</b> thêm từ hỏi đáp 26/11. Mục <b>① Trọng tâm</b> đặt đầu: đọc trước mọi thứ khác. Bấm vào tên mục để mở / đóng. Mục <b>⑰ TỔNG HỢP</b> ở cuối là bản tóm tắt một màn hình.</p>\n\n<details open><summary>① Trọng tâm của phương pháp Option Flow</summary>\n<p><b>Đi theo dòng tiền phòng hộ BẮT BUỘC của dealer, không phải theo mốc giá</b> (Handbook Module 1). Dealer giữ sổ cân bằng (delta ≈ 0) nên khi giá chạy họ buộc phải mua/bán vàng tương lai; dòng tiền khổng lồ đó mới là lực chính đẩy giá.</p>\n<p>Mọi thứ trên dashboard chỉ để trả lời: <b>lúc này dealer đang bị ép mua hay bán theo kiểu nào?</b></p>\n<p><b>Vì sao anh Nam chê «mụ mị indi»:</b> tối 24/11 dashboard dùng tường như hỗ trợ/kháng cự cố định («mốc này buy, mốc kia sell»), bỏ qua chế độ Gamma. Trung tâm phải là <b>hành vi dealer</b>; tường chỉ có nghĩa sau khi biết dealer đang phanh hay đạp ga.</p>\n<p><b>3 câu hỏi đầu mỗi phiên:</b> (1) Net GEX dương, âm hay trung tính? (2) Giá cách Flip bao xa? (3) Vậy hôm nay dealer phanh hay đạp ga? Có câu trả lời rồi mới nhìn tường.</p>\n</details>\n\n<details><summary>② Ba khái niệm hay bị rối: Net GEX · Gamma âm/dương · Gamma Flip</summary>\n<p>Ba từ này <b>cùng nói về một chuyện</b>: dealer (bên bán quyền chọn, như ngân hàng, quỹ lớn) bị ép mua/bán vàng thế nào khi giá chạy. Hình dung dealer là <b>tài xế</b> chiếc xe chở giá vàng.</p>\n<ul>\n<li><b>Net GEX</b> = <b>một con số</b> đo tính khí tài xế: giá chạy 1% thì dealer phải mua/bán bao nhiêu tiền vàng để cân lại.\n <br>· <b>Dương</b> (vd +800M): tài xế <b>PHANH</b>. Giá lên thì dealer bán ra, giá xuống thì mua vào → giá bị kìm, đi trong biên.\n <br>· <b>Âm</b> (vd −700M): tài xế <b>ĐẠP GA</b>. Giá lên thì mua đuổi, giá xuống thì bán đuổi → giá chạy xa.</li>\n<li><b>Gamma dương / Gamma âm</b> = <b>tên gọi</b> của hai tính khí đó. Net GEX dương gọi là Gamma dương, Net GEX âm gọi là Gamma âm. Hai cái là một.</li>\n<li><b>Gamma Flip</b> = <b>một mức giá</b>, chỗ Net GEX bằng 0, tức chỗ tài xế <b>đổi tính</b>. Giá trên Flip thì phanh (Gamma dương); giá dưới Flip thì đạp ga (Gamma âm).</li>\n</ul>\n<table><tr><th>Hỏi</th><th>Nhìn vào</th></tr>\n<tr><td>Dealer đang phanh hay đạp ga, mạnh hay yếu?</td><td><b>Net GEX</b> (con số Σ)</td></tr>\n<tr><td>Gọi chế độ đó là gì?</td><td><b>Gamma dương / âm</b></td></tr>\n<tr><td>Giá phải đi tới đâu thì chế độ lật?</td><td><b>Gamma Flip</b> (mức giá)</td></tr></table>\n<p><b>Vùng trung tính</b> (Handbook Bảng A): Net GEX từ −500M đến +500M thì tài xế vừa phanh nhẹ vừa ga nhẹ → <b>chờ hướng</b>. Anh Nam (15/11, Module 3–4): ngưỡng Bảng A áp cho <b>TỔNG Net GEX mọi nguồn</b> (GC/OG + GLD…); chỉ lấy riêng GC sẽ nhỏ hơn thật. Ví dụ 25/11: GC −356M + GLD −200M ≈ <b>−556M → Gamma âm (trending)</b>, không phải trung tính như khi chỉ nhìn GC.</p>\n</details>\n\n<details><summary>③ Xem các thứ này ở đâu trên dashboard</summary>\n<ul>\n<li><b>Net GEX:</b> dòng chữ xám nhỏ góc trên bên trái chart, vd «GC · 113 strikes · <b>Σ −246.2M</b> · …».</li>\n<li><b>Gamma Flip:</b> đường <b>trắng</b> có nhãn «<b>Γ FLIP 3,671.41</b>».</li>\n<li><b>Kết luận của dashboard:</b> khung «Theo dõi diễn biến», dòng đầu «GAMMA ÂM (giá dưới Flip …, cách …%)»; khung «Bối cảnh thị trường», dòng «Gamma».</li>\n<li><b>TVLB Agent</b> (tab Strike · AI · Agent): dòng REGIME «SHORT_GAMMA» = Gamma âm.</li>\n<li><b>Thanh đỏ/xanh dọc bên phải chart</b> (−24,4M, −15,4M…): Net GEX của từng mức giá; cộng hết lại ra con số Σ.</li>\n<li><b>Magnet:</b> đường <b>xanh ngọc</b> «◎ MAGNET 3,522.79». Rê chuột vào nhãn để biết HÚT hay ĐẨY.</li>\n</ul>\n</details>\n\n<details><summary>④ Magnet là gì · HÚT và ĐẨY</summary>\n<p><b>Magnet</b> = mức giá có <b>lực gamma mạnh nhất</b> quanh giá hiện tại, chỗ dealer phòng hộ dày nhất (vd strike 3550 của GC quy ra giá XAU 3522,79).</p>\n<ul>\n<li><b>Net GEX tại đó dương → HÚT:</b> giá hay bị kéo về và loanh quanh mức này.</li>\n<li><b>Net GEX tại đó âm → ĐẨY:</b> giá <b>phá qua</b> mức này thì dễ <b>chạy xa</b>.</li>\n</ul>\n<p><b>Flip và Magnet trả lời hai câu khác nhau.</b> Flip: «Cả thị trường hôm nay chạy kiểu gì?» (đường trơn hay khô). Magnet: «Riêng mức giá này có gì đặc biệt?» (một ổ gà hay con dốc trên đường).</p>\n<p>Ví dụ 25/11: Magnet 3522,79 kiểu ĐẨY (GEX −52,5M). 18:35 giá phá xuống qua đó rồi rơi một mạch khoảng 40$.</p>\n<p class=\"warn\">⚠ Bước 6 chưa có bằng chứng thống kê rằng Magnet thật sự hút/đẩy giá vàng: dùng để định hướng cách chờ, chưa phải lý do vào lệnh một mình.</p>\n</details>\n\n<details><summary>⑤ 4 tổ hợp Flip × Magnet + ví dụ kịch bản giá</summary>\n<table><tr><th></th><th>Magnet HÚT</th><th>Magnet ĐẨY</th></tr>\n<tr><td><b>Giá trên Flip</b><br>(Gamma dương, đường khô)</td><td>① Giá hay quay về, loanh quanh Magnet. Đi xa thì dễ bị kéo về → đánh <b>đảo chiều</b> (9A).</td><td>② Bình thường êm, nhưng <b>phá qua</b> Magnet thì có một cú chạy nhanh rồi lại êm.</td></tr>\n<tr><td><b>Giá dưới Flip</b><br>(Gamma âm, đường trơn)</td><td>③ Giá giật mạnh nhưng hay <b>kẹt quanh</b> Magnet; phá qua dễ là phá giả → hạn chế đánh phá vỡ sát mức này.</td><td>④ <b>Nguy hiểm nhất:</b> phá qua là <b>trượt dài</b>. Không bắt đáy/đỉnh, <b>chờ phá rồi đi theo</b> (9B, TL1 Thủng).</td></tr></table>\n<p><b>Ví dụ 25/11 ~20:40:</b> giá 3474,51, ngay trên Magnet 3473,17 (trùng Put Wall, strike 3500), Flip 3671 xa khoảng 200$ → Gamma âm, nhiều khả năng ô ④. Ba kịch bản:</p>\n<ol>\n<li><b>Nến M5 đóng dưới ~3468</b> (dưới Magnet ≥ 0,15%): phá thật → dealer bán đuổi → dễ rơi tới ~3450 rồi ~3425 → <b>SELL theo hướng phá</b> (kế hoạch «TL1 Thủng Put Wall»).</li>\n<li><b>Chạm 3473 rồi bật, đóng trên ~3478:</b> Put Wall giữ <b>tạm thời</b>; ngày Gamma âm không nên BUY bắt đáy ở đây.</li>\n<li><b>Đi ngang 3470–3478:</b> chưa phá chưa bật → <b>đứng ngoài</b>, chờ 1 hoặc 2.</li></ol>\n<p><b>Ví dụ ngược (ô ①):</b> nếu giá trên Flip và Magnet hút, giá sát Magnet sẽ loanh quanh; đi xa lên tường trên thì có thể SELL đảo chiều. Cách đánh ngược hẳn ô ④.</p>\n</details>\n\n<details><summary>⑤b Hỏi đáp 26/11: giá nằm DƯỚI cả Magnet và Flip · Magnet ở trên hay dưới Flip thì khác gì?</summary>\n<p><b>Bạn hỏi:</b> Magnet ở trên Flip, giá ở dưới cả Magnet và Flip thì nói lên điều gì?</p>\n<p><b>Ba hình ảnh dễ nhớ</b> (nối tiếp mục ② và ④):</p>\n<ul>\n<li><b>Flip là vạch đổi cách lái.</b> Trên vạch, tài xế (dealer) <b>phanh</b>: giá lên thì họ bán, giá xuống thì họ mua, nên giá bị kìm lại. Dưới vạch, tài xế <b>đạp ga</b>: giá xuống họ bán đuổi, giá lên họ mua đuổi, nên giá chạy xa.</li>\n<li><b>Magnet là một trạm dừng trên đường.</b> Trạm kiểu HÚT: xe hay ghé lại rồi loanh quanh. Trạm kiểu ĐẨY: xe chạy qua trạm là vọt đi luôn.</li>\n<li><b>Net GEX cho biết tài xế đạp mạnh hay nhẹ.</b> −2B là đạp lút ga, còn −300M chỉ là nhích ga. Bảng A xếp −300M vào nhóm trung tính (mục ⑮).</li>\n</ul>\n<p><b>Điểm mấu chốt: Magnet nằm ở PHÍA NÀO của Flip.</b></p>\n<table><tr><th>Thứ tự từ trên xuống</th><th>Nghĩa là gì</th></tr>\n<tr><td><b>A.</b> Magnet → Flip → Giá<br>(đúng câu bạn hỏi)</td><td>Muốn tới Magnet, giá phải <b>đi qua Flip trước</b>, và trước đó tài xế vẫn đang đạp ga. Magnet nằm sẵn trong vùng Gamma dương, nên chỉ thành điểm đến hợp lý <b>sau khi</b> giá lấy lại được Flip. Câu cần hỏi lúc này là «giá có lấy lại được Flip không?», chưa phải «giá có về Magnet không?».</td></tr>\n<tr><td><b>B.</b> Flip → Magnet → Giá<br>(dashboard 26/11)</td><td>Magnet nằm <b>ngay trong vùng Gamma âm</b>, giữa giá và Flip. Lúc này dùng thẳng ô ③ của mục ⑤ (Magnet HÚT: giá giật mạnh nhưng hay kẹt quanh Magnet) hoặc ô ④ (Magnet ĐẨY: phá qua là chạy).</td></tr></table>\n\n<p><b>Ví dụ A (số giả định):</b> giá 3500, Flip 3540, Magnet 3600.</p>\n<table><tr><th>Chuyện xảy ra</th><th>Nghĩa là gì</th></tr>\n<tr><td>Giá giảm từ 3500 xuống 3490</td><td>Tài xế bán đuổi nên giá dễ rơi tiếp về 3470, 3460. Mốc hỗ trợ dễ bị xuyên, vì vậy không BUY bắt đáy (mục ⑥).</td></tr>\n<tr><td>Giá tăng lên 3530</td><td>Tài xế mua đuổi nên đoạn này có thể lên nhanh. Giá vẫn chưa qua vạch.</td></tr>\n<tr><td>Giá chạm 3540 rồi bị đẩy xuống</td><td>Chưa đổi cách lái. Giá quay đầu, tài xế lại đạp ga đi xuống.</td></tr>\n<tr><td>Giá vượt 3540 và <b>giữ được</b> (vd 2–3 nến M5 đóng trên, ra ngoài vùng đệm ở mục ⑮)</td><td>Tài xế chuyển sang phanh. Lúc này trạm 3600 mới thành điểm đến hợp lý.</td></tr>\n<tr><td>Giá tới gần 3600</td><td>Nếu Magnet HÚT, giá hay đi ngang và bị «ghim» quanh 3600 (ô ① của mục ⑤).</td></tr></table>\n\n<p><b>Ví dụ B (dashboard 26/11 khoảng 17:31–17:40):</b> giá 3558–3561, <b>Magnet 3573,01</b> (trên giá khoảng 12$, tức 0,34%), <b>Flip 3684,87</b> (đường trắng, trên giá khoảng 3,5%). Net GEX tổng GC+GLD là <b>−378,9M</b>, nên Bảng A xếp vào nhóm <b>trung tính</b>.</p>\n<ul>\n<li><b>Flip cách xa khoảng 3,5%.</b> Anh Nam nói Flip xa thì không chặn lệnh. Cả ngày vẫn là Gamma âm, nhưng tài xế chỉ <b>nhích ga nhẹ</b>.</li>\n<li><b>Magnet nằm sát giá</b> nên đây là vùng giá hay quanh quẩn. Chart từ 12:00 đi ngang quanh 3560–3580 đúng kiểu này. Đây mới là quan sát, chưa phải bằng chứng.</li>\n<li>Ba kịch bản (cùng cách viết với mục ⑤):<ol>\n<li><b>Nến M5 đóng rõ trên Magnet</b> (vd trên khoảng 3578, cao hơn Magnet ít nhất 0,15%): giá phá lên. Nếu Magnet là kiểu ĐẨY, giá dễ chạy tiếp tới GLD 330 (khoảng 3602 trên chart). Đây là kiểu 9B BUY, đi theo hướng phá (mục ⑥).</li>\n<li><b>Giá chạm 3573 rồi quay xuống, có nến đóng xác nhận:</b> Magnet đang làm cản. Nếu SELL ở đây thì lý do là <b>hành động giá</b> (nến xác nhận), không phải «Magnet hút lên rồi bật xuống» (mục ⑬).</li>\n<li><b>Giá đi ngang trong khoảng 3555–3578:</b> chưa phá cũng chưa bật, Net GEX lại trung tính, nên <b>đứng ngoài</b> và chờ kịch bản 1 hoặc 2.</li></ol></li>\n<li>Các mốc phía dưới: GLD 325 (khoảng 3550), rồi GC 3500 / Put Wall (khoảng 3474).</li></ul>\n<p><b>Xem Magnet đang HÚT hay ĐẨY ở đâu:</b> vào tab «Vào lệnh OF», tìm bảng Bối cảnh, xem dòng <b>Magnet</b>. Dòng này ghi «Magnet HÚT (GEX dương …)» hoặc «Magnet ĐẨY (GEX âm …)».</p>\n<p class=\"warn\">⚠ Đính chính từ chat 26/11: lúc đầu Claude giải thích Magnet là «strike có GEX dương lớn nhất» và cho rằng «Magnet chỉ có tác dụng khi giá ở trên Flip». Thực ra dashboard này tính Magnet theo <b>lực gamma mạnh nhất</b>, nên Magnet có thể HÚT hoặc ĐẨY (mục ④). Ô ③ cũng cho thấy: dưới Flip, Magnet kiểu HÚT vẫn có thể làm giá kẹt quanh nó. Ý «phải qua Flip trước» chỉ đúng cho trường hợp A, khi Magnet nằm bên kia Flip. Trường hợp B thì dùng mục ⑤.</p>\n<p class=\"warn\">⚠ Mọi điều ở mục này là lý thuyết, chưa kiểm định. Kết quả bước 6 và bước 8: Magnet chưa cho thấy hút giá hơn các số tròn đối chứng.</p>\n</details>\n\n<details><summary>⑥ Gamma âm vẫn BUY được (BUY theo đà lên)</summary>\n<ul>\n<li>❌ <b>Không BUY bắt đáy:</b> giá đang rơi, chạm tường dưới, mua vì nghĩ sẽ bật lại. Dashboard đang chặn kiểu này.</li>\n<li>✅ <b>BUY khi giá PHÁ LÊN qua tường:</b> dealer mua đuổi, đẩy giá lên tiếp = <b>9B BUY</b> (các kế hoạch «9B TƯỜNG BUY · CHỜ»). Ví dụ 25/11 15:20: 9B BUY phá lên qua 3522,79 trong ngày Gamma âm.</li>\n<li>Handbook chỉ <b>cấm hẳn BUY dưới Flip</b> khi Net GEX <b>dưới −2B</b> (Module 28), trừ khi có Gamma Squeeze điểm &gt; 85.</li>\n</ul>\n<p><b>Gamma âm: BUY khi phá lên, SELL khi phá xuống, đều theo hướng phá; tránh bắt đáy, bắt đỉnh.</b></p>\n</details>\n\n<details><summary>⑦ Flip có tự dời không?</summary>\n<p>Có. Flip được tính lại từ dữ liệu quyền chọn nên đổi khi:</p>\n<ol><li><b>OI mới mỗi ngày</b> sau phiên (lý do lớn nhất). Ví dụ: Flip 3929 (24/11) → 3720 → 3671 (25/11).</li>\n<li><b>Quyền chọn đáo hạn:</b> gamma của hợp đồng hết hạn biến mất → Flip có thể nhảy mạnh (ngày đáo hạn tuần/tháng).</li>\n<li><b>Thời gian và IV đổi:</b> Flip trôi dần.</li></ol>\n<p>Flip có thể xuống dưới giá (ngày thành Gamma dương), nhưng không đoán trước được. Dashboard cập nhật OI một lần mỗi ngày sau phiên, nên trong phiên Flip gần như đứng yên. Cách còn lại: <b>giá tự đi lên vượt Flip</b> thì sang Gamma dương ngay.</p>\n</details>\n\n<details><summary>⑧ Cái nào quan trọng nhất? Thứ tự đọc mỗi phiên</summary>\n<table><tr><th>#</th><th>Nhìn gì</th><th>Trả lời</th></tr>\n<tr><td>1</td><td><b>Net GEX</b></td><td>Phanh hay đạp ga, <b>mạnh hay yếu</b> (Bảng A, «Critical»)</td></tr>\n<tr><td>2</td><td><b>Gamma Flip</b></td><td>Còn <b>bao xa</b> thì chế độ lật; xa = chế độ ổn định cả ngày, sát = dễ lật nên đứng ngoài</td></tr>\n<tr><td>3</td><td>Tường, Magnet</td><td><b>Chỗ nào</b> có chuyện: chặn, hút, đẩy, phá</td></tr>\n<tr><td>4</td><td>CVD, lệnh lớn</td><td>Dòng tiền thật có <b>xác nhận</b> không</td></tr></table>\n<p>Net GEX đứng trước Flip vì nó cho cả <b>dấu</b> lẫn <b>độ mạnh</b>. Hai ngày cùng «dưới Flip 200$» có thể khác hẳn: −300M (gần trung tính) và −2B (đạp ga hết cỡ).</p>\n</details>\n\n<details><summary>⑨ Handbook v1.1: những chỗ cần nhớ (trang · module)</summary>\n<table><tr><th>Ý</th><th>Chỗ</th></tr>\n<tr><td>5 chế độ theo Net GEX (&gt;+2B · +500M…+2B · ±500M trung tính · −500M…−2B Gamma âm = trending · &lt;−2B)</td><td>Trang 4 · Table A</td></tr>\n<tr><td>Trên Flip Gamma dương, dưới Flip Gamma âm</td><td>Trang 2 · Module 10</td></tr>\n<tr><td>Call Wall / Put Wall</td><td>Trang 2 · Module 12–13</td></tr>\n<tr><td>Cây quyết định (Hình 5), ma trận dealer (Hình 4): bị cắt trong PDF, đang xin bản gốc</td><td>Trang 4 · Module 24–25</td></tr>\n<tr><td>Điểm tin cậy &gt; 70 mới phát lệnh</td><td>Trang 4 · Module 26 · Table B</td></tr>\n<tr><td>Không BUY dưới Flip khi Net GEX &lt; −2B</td><td>Trang 5 · Module 28</td></tr>\n<tr><td>Backtest 3 năm, ≥ 500 phiên, Win Rate &gt; 62%, PF &gt; 1,8 trước khi dùng thật</td><td>Trang 5 · Module 29</td></tr></table>\n<p>Anh Nam: Handbook chỉ mô tả sơ lược; bên mình phải tự viết luật cho từng module rồi gửi anh duyệt (bản «Module 25 – mô tả và lộ trình»).</p>\n</details>\n\n<details><summary>⑩ Bài học tối 24/11: lệnh 9A SELL tại Magnet 3602</summary>\n<ul>\n<li>Magnet 3602 có Net GEX âm (đẩy), ngày Gamma âm. 22:05 giá phá xuống qua đó rồi rơi tới ~3560.</li>\n<li>Kế hoạch «9A SELL chờ giá hồi lên tường rồi bán» <b>không mâu thuẫn về hướng</b> (cũng là SELL), nhưng <b>sai bản chất</b>: 9A là «tường chặn giá», hợp với Gamma dương; ngày Gamma âm phải đánh theo hướng phá (9B).</li>\n<li>Các nến hồi nhẹ ngay dưới tường không vào lệnh vì chưa chạm vùng tường (9A chỉ bán TẠI tường). Lệnh 9A SELL 22:10 của luật cũ có thể thắng, nhưng thắng vì lý do sai.</li>\n<li>Gốc lỗi: chế độ menu «Bỏ hẳn Flip: luôn 9A». Đã đổi sang «Flip gần giá thì đứng ngoài» → ngày Gamma âm dùng 9B.</li>\n</ul>\n</details>\n\n<details><summary>⑪ Đọc nhãn nến quan sát trên chart (bản 9b-5c)</summary>\n<p>Nhãn xếp dọc, từ tam giác ra ngoài:</p>\n<ul>\n<li><b>sell / buy</b>: chiều · <b>5/5</b>: trọng số (luôn chữ trắng; ⛔ = cổng chặn) · <b>9A / 9B / TL1 / TL1·2</b>: kiểu lệnh · <b>#số</b>: mã số trong ngày · <b>✔</b>: đã vào lệnh · <b>lần 2</b>: lần thứ 2 trở đi của tường + chiều đó.</li>\n<li><b>Đã vào lệnh:</b> chữ xanh da trời (buy) hoặc đỏ (sell). <b>Chưa thỏa hoặc không vào:</b> chữ xám.</li>\n<li>Rê chuột vào nhãn: khung «✔ ĐÃ VÀO LỆNH #n» (giá vào, SL, TP, kết quả) hoặc «✘ KHÔNG VÀO LỆNH: lý do».</li>\n<li>Luật hiện tại (giả thuyết, chờ anh Nam): mỗi tường, mỗi chiều chỉ tính <b>lần đầu trong ngày</b>, kể cả khi lần đầu chưa đủ điều kiện. Ví dụ 25/11: #1 13:55 phá xuống 3/5 (không vào, tiêu lượt SELL) · #2 15:20 phá lên ✔ vào 9B BUY (dính SL) · 18:35 phá xuống thật nhưng là lần 2 nên không vào.</li>\n<li><b>Câu hỏi mở (25/11): có nên vào lần 2, lần 3?</b> Tối 25/11 lần 2 (#3, ~18:35) và lần 3 (#4, ~19:50) đều SELL 5/5 phá xuống tường ~3522 trong ngày dưới Flip, tường có GEX âm (ĐẨY), và cả hai đều rơi khoảng 30–40$. Đúng với bản chất Option Flow: dealer đạp ga thì mỗi cú phá thật đều có lực, không chỉ cú đầu. Nhưng <b>một ngày đẹp chưa phải bằng chứng</b> (nhìn lại sau khi biết kết quả). Định lượng = luật viết trước + kiểm định, không phải tuỳ hứng. Hướng làm: ghi các lệnh lần 2+ như <b>lệnh ảo</b> để tích mẫu, rồi ở bước 6 so 3 luật: (A) chỉ lần đầu · (B) cho lần 2+ nếu giá đã quay lại phía bên kia tường và vẫn Gamma âm + tường ĐẨY · (C) như B nhưng tối đa 2 lệnh/tường/ngày. Lưu ý: Σ −361.8M hôm đó nằm trong vùng trung tính của Handbook (−500M…+500M). <i>(giả thuyết, chờ anh Nam)</i></li>\n<li>9B chỉ tính <b>cú phá thật</b>: lần đầu đóng vượt 0,15% kể từ khi giá còn ở phía bên kia tường. Chiều lệnh theo hướng phá, không theo giá hiện tại.</li>\n</ul>\n</details>\n\n<details><summary>⑫ Hỏi đáp 25/11 (1): hai chỗ code không vào lệnh có «uổng» không?</summary>\n<p><b>Bạn hỏi:</b> lệnh 9B SELL lần 2 lúc 18:25 và chỗ hồi lên tường 3.522 lúc ~19:45 rồi rơi mạnh, dashboard không vào → có uổng không?</p>\n<svg viewBox=\"0 0 320 110\" style=\"width:100%;max-width:460px;background:#0f141a;border-radius:6px;margin:4px 0\" xmlns=\"http://www.w3.org/2000/svg\" font-family=\"sans-serif\" font-size=\"8.5\"><line x1=\"5\" y1=\"45\" x2=\"315\" y2=\"45\" stroke=\"#f0b429\" stroke-dasharray=\"4 3\"/><text x=\"232\" y=\"40\" fill=\"#f0b429\">tường 3.522,79</text><line x1=\"14\" y1=\"34\" x2=\"14\" y2=\"44\" stroke=\"#26a69a\" stroke-width=\"1\"/><rect x=\"10\" y=\"38\" width=\"8\" height=\"2\" fill=\"#26a69a\"/><line x1=\"27\" y1=\"34\" x2=\"27\" y2=\"44\" stroke=\"#ef5350\" stroke-width=\"1\"/><rect x=\"23\" y=\"38\" width=\"8\" height=\"2\" fill=\"#ef5350\"/><line x1=\"40\" y1=\"33\" x2=\"40\" y2=\"43\" stroke=\"#26a69a\" stroke-width=\"1\"/><rect x=\"36\" y=\"37\" width=\"8\" height=\"2\" fill=\"#26a69a\"/><line x1=\"53\" y1=\"33\" x2=\"53\" y2=\"62\" stroke=\"#ef5350\" stroke-width=\"1\"/><rect x=\"49\" y=\"37\" width=\"8\" height=\"21\" fill=\"#ef5350\"/><line x1=\"66\" y1=\"54\" x2=\"66\" y2=\"70\" stroke=\"#ef5350\" stroke-width=\"1\"/><rect x=\"62\" y=\"58\" width=\"8\" height=\"8\" fill=\"#ef5350\"/><line x1=\"79\" y1=\"58\" x2=\"79\" y2=\"70\" stroke=\"#26a69a\" stroke-width=\"1\"/><rect x=\"75\" y=\"62\" width=\"8\" height=\"4\" fill=\"#26a69a\"/><line x1=\"92\" y1=\"46\" x2=\"92\" y2=\"66\" stroke=\"#26a69a\" stroke-width=\"1\"/><rect x=\"88\" y=\"50\" width=\"8\" height=\"12\" fill=\"#26a69a\"/><line x1=\"105\" y1=\"40\" x2=\"105\" y2=\"54\" stroke=\"#26a69a\" stroke-width=\"1\"/><rect x=\"101\" y=\"44\" width=\"8\" height=\"6\" fill=\"#26a69a\"/><line x1=\"118\" y1=\"36\" x2=\"118\" y2=\"48\" stroke=\"#26a69a\" stroke-width=\"1\"/><rect x=\"114\" y=\"40\" width=\"8\" height=\"4\" fill=\"#26a69a\"/><line x1=\"131\" y1=\"36\" x2=\"131\" y2=\"50\" stroke=\"#ef5350\" stroke-width=\"1\"/><rect x=\"127\" y=\"40\" width=\"8\" height=\"6\" fill=\"#ef5350\"/><line x1=\"144\" y1=\"42\" x2=\"144\" y2=\"66\" stroke=\"#ef5350\" stroke-width=\"1\"/><rect x=\"140\" y=\"46\" width=\"8\" height=\"16\" fill=\"#ef5350\"/><line x1=\"157\" y1=\"58\" x2=\"157\" y2=\"82\" stroke=\"#ef5350\" stroke-width=\"1\"/><rect x=\"153\" y=\"62\" width=\"8\" height=\"16\" fill=\"#ef5350\"/><line x1=\"170\" y1=\"74\" x2=\"170\" y2=\"94\" stroke=\"#ef5350\" stroke-width=\"1\"/><rect x=\"166\" y=\"78\" width=\"8\" height=\"12\" fill=\"#ef5350\"/><line x1=\"183\" y1=\"86\" x2=\"183\" y2=\"100\" stroke=\"#ef5350\" stroke-width=\"1\"/><rect x=\"179\" y=\"90\" width=\"8\" height=\"6\" fill=\"#ef5350\"/><text x=\"40\" y=\"82\" fill=\"#26a69a\">① phá lần đầu</text><text x=\"40\" y=\"92\" fill=\"#26a69a\">✔ lệnh #1 (13:55)</text><text x=\"150\" y=\"30\" fill=\"#9aa4b2\">giá hồi lên lại</text><text x=\"200\" y=\"70\" fill=\"#ef5350\">② phá lần 2 (18:25)</text><text x=\"200\" y=\"80\" fill=\"#ef5350\">✘ không vào: «chỉ lần đầu»</text><text x=\"200\" y=\"90\" fill=\"#ef5350\">+ đã đủ 2 lệnh/ngày</text></svg><div class=\"muted\" style=\"font-size:10.5px;margin:-2px 0 6px\">Hình minh hoạ (không theo tỉ lệ giá): mỗi tường, mỗi chiều chỉ vào lệnh ở lần phá ĐẦU trong ngày (B10b). Lần 2, lần 3 bị bỏ.</div>\n<p><b>Anh Nam trả lời (25/11): KHÔNG uổng.</b></p>\n<ul>\n<li><b>Lần 2, lần 3 kém hơn lần 1:</b> lần chạm đầu là lúc phe giữ giá phản ứng mạnh nhất; các lần sau «đạn» đã tiêu bớt (như cánh cửa bị đẩy nhiều lần thì lỏng).</li>\n<li><b>Gamma âm thì theo xu hướng, không bắt đảo chiều:</b> dealer mua đuổi/bán đuổi nên giá chạy xa; chờ bật ngược là đi ngược dòng nước.</li>\n<li><b>Nhìn lại thấy tiếc là bình thường</b> (thiên lệch nhìn lại): sau khi giá rơi xong, chỗ nào cũng trông như «điểm vàng». Lệnh chỉ đáng vào khi đủ điều kiện NGAY LÚC ĐÓ.</li>\n<li><b>Bỏ vài kèo để đỡ lỗ dồn:</b> trong pha giá chạy mạnh, ít lệnh nhiễu hơn thì sụt vốn (drawdown) ít hơn.</li>\n</ul>\n<p class=\"muted\">Ghi chú Claude: cổng kiểm đều ✓; cái chặn là luật «chỉ lần đầu» và «tối đa 1 lệnh/phía, 2 lệnh/ngày» của B10b. Muốn đo xem lần 2 có lời không: bật công tắc <b>«Cho phép LẦN 2»</b> (so sánh, chưa kiểm chứng) ở menu ②b.</p>\n</details>\n\n<details><summary>⑬ Hỏi đáp 25/11 (2): Gamma âm + Magnet — có mâu thuẫn không?</summary>\n<p><b>Bạn hỏi:</b> giá dưới Flip (Gamma âm, dealer đẩy giá), Magnet thì hút giá → vậy SELL ở chỗ giá hồi lên tường rồi bật xuống là đúng chứ?</p>\n<p><b>Gỡ chỗ rối:</b> đây là HAI câu hỏi khác nhau.</p>\n<ul>\n<li><b>Gamma âm</b> trả lời «cả ngày thị trường chạy kiểu gì»: dealer đẩy theo hướng giá đang chạy, giá chạy xa, không nảy qua lại êm như Gamma dương.</li>\n<li><b>Magnet</b> trả lời «riêng mức giá này có gì đặc biệt». Magnet KHÔNG luôn hút: GEX tại đó dương → HÚT; GEX âm → ĐẨY (dễ bị phá rồi chạy tiếp). Ngày 25/11 Magnet 3.522,79 có GEX âm (−52,5M) → kiểu ĐẨY, nên cả 3 điều (dưới Flip, Gamma âm, Magnet đẩy) cùng chiều giảm.</li>\n</ul>\n<p><b>Anh Nam trả lời (25/11 23:39):</b> hướng SELL thuận nhịp giảm sau nhịp hồi lên vùng cản là <b>khớp</b> với Gamma âm. Nhưng lý do SELL phải là <b>đà giảm + bối cảnh Gamma âm + vùng cản/tường, CÓ XÁC NHẬN</b> (nến đóng quay xuống), <b>không</b> giải thích là «Magnet hút giá rồi bật lại» — Magnet chưa phải lý do vào lệnh một mình và đang ở trạng thái chưa kiểm định.</p>\n<p><b>Hiểu nôm na (ý bạn):</b> nếu SELL ở đó thì lệnh dựa vào <b>yếu tố hành động giá</b> (phá rồi hồi test, nến xác nhận), Option Flow chỉ cho biết <b>bối cảnh</b> (ngày Gamma âm → ưu tiên theo xu hướng). B10b của anh Nam chưa có kiểu lệnh này → xem mục ⑭.</p><p><b>Anh Nam bổ sung (file 25/11 «Gamma âm, Magnet &amp; nhịp hồi chạm tường»):</b></p><ul><li>Chỗ đó có thể xem là <b>nhịp hồi kỹ thuật trong pha giảm (pullback theo xu hướng)</b>: canh giá hồi về vùng cản/tường để SELL theo xu hướng <b>đồng thuận</b> với hướng giảm chính hơn là bắt đáy mua lên — NẾU có đủ xác nhận nến và dòng tiền thuận chiều giảm.</li><li><b>Rủi ro nếu gán sai lý do:</b> coi Magnet là «nam châm kéo lên rồi bẻ xuống» thì gặp nhịp hồi mạnh hơn dự kiến trong Gamma âm, lệnh SELL bắt đỉnh hồi rất dễ bị <b>quét SL</b> (stop hunt: giá chọc qua mức cắt lỗ rồi mới đi đúng hướng).</li><li>Không vào lệnh chỉ vì thấy «giá dưới Flip + có Magnet»; luôn cần hình thái nến, động lượng và quản trị rủi ro (Handbook <b>Module 28</b>).</li></ul>\n</details>\n\n<details><summary>⑭ Kiểu lệnh «9B HỒI TEST» (phá rồi hồi test) — công tắc so sánh, CHƯA KIỂM CHỨNG</summary>\n<svg viewBox=\"0 0 320 120\" style=\"width:100%;max-width:460px;background:#0f141a;border-radius:6px;margin:4px 0\" xmlns=\"http://www.w3.org/2000/svg\" font-family=\"sans-serif\" font-size=\"8.5\"><rect x=\"5\" y=\"40\" width=\"310\" height=\"8\" fill=\"rgba(240,180,41,.12)\"/><line x1=\"5\" y1=\"44\" x2=\"315\" y2=\"44\" stroke=\"#f0b429\" stroke-dasharray=\"4 3\"/><text x=\"240\" y=\"37\" fill=\"#f0b429\">tường (±0,10%)</text><line x1=\"14\" y1=\"24\" x2=\"14\" y2=\"34\" stroke=\"#26a69a\" stroke-width=\"1\"/><rect x=\"10\" y=\"28\" width=\"8\" height=\"2\" fill=\"#26a69a\"/><line x1=\"27\" y1=\"24\" x2=\"27\" y2=\"36\" stroke=\"#ef5350\" stroke-width=\"1\"/><rect x=\"23\" y=\"28\" width=\"8\" height=\"4\" fill=\"#ef5350\"/><line x1=\"40\" y1=\"26\" x2=\"40\" y2=\"36\" stroke=\"#26a69a\" stroke-width=\"1\"/><rect x=\"36\" y=\"30\" width=\"8\" height=\"2\" fill=\"#26a69a\"/><line x1=\"53\" y1=\"26\" x2=\"53\" y2=\"56\" stroke=\"#ef5350\" stroke-width=\"1\"/><rect x=\"49\" y=\"30\" width=\"8\" height=\"22\" fill=\"#ef5350\"/><line x1=\"66\" y1=\"48\" x2=\"66\" y2=\"68\" stroke=\"#ef5350\" stroke-width=\"1\"/><rect x=\"62\" y=\"52\" width=\"8\" height=\"12\" fill=\"#ef5350\"/><line x1=\"79\" y1=\"60\" x2=\"79\" y2=\"76\" stroke=\"#ef5350\" stroke-width=\"1\"/><rect x=\"75\" y=\"64\" width=\"8\" height=\"8\" fill=\"#ef5350\"/><line x1=\"92\" y1=\"62\" x2=\"92\" y2=\"76\" stroke=\"#26a69a\" stroke-width=\"1\"/><rect x=\"88\" y=\"66\" width=\"8\" height=\"6\" fill=\"#26a69a\"/><line x1=\"105\" y1=\"54\" x2=\"105\" y2=\"70\" stroke=\"#26a69a\" stroke-width=\"1\"/><rect x=\"101\" y=\"58\" width=\"8\" height=\"8\" fill=\"#26a69a\"/><line x1=\"118\" y1=\"44\" x2=\"118\" y2=\"62\" stroke=\"#26a69a\" stroke-width=\"1\"/><rect x=\"114\" y=\"48\" width=\"8\" height=\"10\" fill=\"#26a69a\"/><line x1=\"131\" y1=\"40\" x2=\"131\" y2=\"52\" stroke=\"#26a69a\" stroke-width=\"1\"/><rect x=\"127\" y=\"44\" width=\"8\" height=\"4\" fill=\"#26a69a\"/><line x1=\"144\" y1=\"40\" x2=\"144\" y2=\"54\" stroke=\"#ef5350\" stroke-width=\"1\"/><rect x=\"140\" y=\"44\" width=\"8\" height=\"6\" fill=\"#ef5350\"/><line x1=\"157\" y1=\"46\" x2=\"157\" y2=\"66\" stroke=\"#ef5350\" stroke-width=\"1\"/><rect x=\"153\" y=\"50\" width=\"8\" height=\"12\" fill=\"#ef5350\"/><line x1=\"170\" y1=\"58\" x2=\"170\" y2=\"80\" stroke=\"#ef5350\" stroke-width=\"1\"/><rect x=\"166\" y=\"62\" width=\"8\" height=\"14\" fill=\"#ef5350\"/><line x1=\"183\" y1=\"72\" x2=\"183\" y2=\"92\" stroke=\"#ef5350\" stroke-width=\"1\"/><rect x=\"179\" y=\"76\" width=\"8\" height=\"12\" fill=\"#ef5350\"/><text x=\"44\" y=\"84\" fill=\"#9aa4b2\">① PHÁ xuống</text><text x=\"44\" y=\"94\" fill=\"#9aa4b2\">(đóng dưới ≥ 0,15%)</text><text x=\"118\" y=\"30\" fill=\"#9aa4b2\">② hồi lên CHẠM lại</text><text x=\"150\" y=\"40\" fill=\"#9aa4b2\">từ phía dưới</text><text x=\"196\" y=\"66\" fill=\"#ef5350\">③ đóng quay xuống ≥ 0,10%</text><text x=\"196\" y=\"90\" fill=\"#ef5350\">▼ SELL ở giá mở nến kế</text><text x=\"196\" y=\"100\" fill=\"#ef5350\">SL 0,30% · TP tường kế</text></svg><div class=\"muted\" style=\"font-size:10.5px;margin:-2px 0 6px\">«9B hồi test» (break and retest): tường đã bị phá trở thành vùng cản; giá quay lại chạm rồi bị đẩy đi tiếp → vào THEO hướng phá. Công tắc so sánh, CHƯA KIỂM CHỨNG.</div>\n<p><b>Luật nháp</b> (ghép từ các con số của 9A/9B, <b>chưa ai kiểm chứng</b>, KHÔNG có trong B10b):</p>\n<ol>\n<li>Chỉ ngày <b>Gamma âm</b>; tường là một trong 3 tường gần (top 3 OI trong ±2,5%).</li>\n<li>Trước đó <b>hôm nay</b> giá đã PHÁ tường: có nến đóng ở phía bên kia, rồi nến đóng vượt ≥ 0,15%.</li>\n<li>Giá quay lại chạm vùng ±0,10% quanh tường <b>từ phía đã phá sang</b>.</li>\n<li>Trong 3 nến M5 có 1 nến đóng quay đi tiếp ≥ 0,10% theo hướng phá (chưa đóng xuyên ngược 0,10%) → vào ở giá mở nến kế.</li>\n<li>SL 0,30% · TP1 tường đang hiển thị kế tiếp (≥ 1R, không có thì 0,60%) · đóng " + CHV("12:30") + " · chỉ lần hồi test ĐẦU mỗi tường.</li>\n</ol>\n<p><b>Cách dùng:</b> menu «Cài đặt Option Flow» → khối ②b → tick <b>«9B HỒI TEST»</b> (mặc định TẮT). Lệnh mang nhãn cam «HỒI TEST · SO SÁNH, KHÔNG có trong B10b, CHƯA KIỂM CHỨNG», ghi nhật ký riêng (alt = retest), <b>không</b> chiếm suất 1 lệnh/phía · 2 lệnh/ngày. Khi thống kê phải TÁCH khỏi lệnh B10b; cần vài chục lệnh mới nói được lời hay lỗ.</p>\n<p class=\"muted\">Còn chờ anh Nam: xác nhận cụ thể là gì (nến đóng quay đầu, Delta hay CVD), SL đặt ở đâu, chỉ lần hồi đầu hay nhiều lần.</p>\n</details>\n\n<details><summary>⑮ Vùng đệm quanh Flip &amp; chế độ theo Bảng A (bản 9b-5d)</summary>\n<svg viewBox=\"0 0 320 110\" style=\"width:100%;max-width:460px;background:#0f141a;border-radius:6px;margin:4px 0\" xmlns=\"http://www.w3.org/2000/svg\" font-family=\"sans-serif\" font-size=\"8.5\"><rect x=\"5\" y=\"40\" width=\"310\" height=\"34\" fill=\"rgba(77,208,225,.10)\"/><line x1=\"5\" y1=\"57\" x2=\"315\" y2=\"57\" stroke=\"#e0e0e0\"/><text x=\"8\" y=\"54\" fill=\"#e0e0e0\">Gamma Flip</text><line x1=\"5\" y1=\"40\" x2=\"315\" y2=\"40\" stroke=\"#4dd0e1\" stroke-dasharray=\"2 3\"/><line x1=\"5\" y1=\"74\" x2=\"315\" y2=\"74\" stroke=\"#4dd0e1\" stroke-dasharray=\"2 3\"/><text x=\"205\" y=\"36\" fill=\"#4dd0e1\">vùng đệm ±0,5% / × ATR</text><text x=\"14\" y=\"20\" fill=\"#26a69a\">Giá TRÊN vùng: Gamma dương rõ → 9A được</text><text x=\"14\" y=\"98\" fill=\"#ef5350\">Giá DƯỚI vùng: Gamma âm rõ → 9B được</text><text x=\"110\" y=\"52\" fill=\"#f0b429\">TRONG vùng: 9A ĐỨNG NGOÀI</text><text x=\"110\" y=\"69\" fill=\"#f0b429\">9B vẫn được (Flip là mốc 9B)</text></svg><div class=\"muted\" style=\"font-size:10.5px;margin:-2px 0 6px\">Vùng đệm quanh Flip (9b-5d): độ rộng là tham số anh Nam chưa cho số, CHƯA KIỂM ĐỊNH. Flip XA không chặn.</div>\n<ul>\n<li><b>Flip XA không chặn</b> (anh Nam 24–25/11): giá cách Flip xa nghĩa là chế độ Gamma ổn định. Chỗ nhạy là <b>sát Flip</b>.</li>\n<li><b>Vùng đệm</b> = dải giá hai bên Flip. Đo bằng % giá Flip (mặc định 0,5% ≈ 18$), × ATR(14) nến 1 giờ (thị trường giật mạnh → vùng rộng), hoặc $ cố định. Chọn ở menu ②.</li>\n<li><b>Tách theo loại lệnh</b> (anh Nam: «phân biệt bật lại vs theo xu hướng»; cách tách do Claude suy, chờ anh xác nhận): 9A bật lại ĐỨNG NGOÀI trong vùng; 9B theo xu hướng KHÔNG chặn, vì B10b ghi 9B đánh tại «tường gần <b>hoặc Gamma Flip</b>» → có thêm kế hoạch <b>9B FLIP</b>.</li>\n<li><b>Chế độ theo Bảng A</b> (Handbook): TỔNG Net GEX mọi pool (dashboard có GC + GLD, thiếu XAU/QTY): &gt; +2B dương mạnh · +500M…+2B dương · −500M…+500M trung tính · −2B…−500M âm · &lt; −2B âm mạnh. Hiện cạnh «chế độ theo Flip» kèm chữ <b>khớp</b> / <b>KHÁC</b>. KHÁC = hai cách đọc ngược nhau → thận trọng. Chỉ để xem; 9A/9B vẫn chọn theo Flip.</li>\n<li>Ví dụ 25/11: GC −346M + GLD −230M ≈ −580M → Gamma âm theo Bảng A, khớp với «giá dưới Flip».</li>\n</ul>\n</details>\n\n<details><summary>⑯ Vì sao nhãn nến quanh Magnet lúc có lúc mất (25/11 ~23:45)?</summary>\n<p><b>Bạn thấy:</b> lúc đầu quanh Magnet 3.473 không có nhãn; một lúc sau hiện nhiều nhãn TL1·2 BUY ⛔, TL1 SELL, «OF ✓ 2/4».</p>\n<p><b>Lý do (suy từ ảnh, chưa kiểm bằng dữ liệu):</b> nhãn nến quan sát và tín hiệu TL1/TL1·2 được <b>tính lại cho mọi nến hôm nay</b> theo Call/Put Wall <b>HIỆN TẠI</b>. Ảnh 22:44 Put Wall là GC 3400 (~3.374); ảnh 23:46 nhãn «GC 3500 · 93% <b>PW</b>» → Put Wall đã ĐỔI sang GC 3500 (~3.473). Dashboard liền chấm lại các nến cũ quanh 3.473 theo Put Wall mới nên nhãn «mọc ra» ở quá khứ. Ảnh 23:49 Put Wall lại về GC 3400 → nhãn BIẾN MẤT. Tức Put Wall đang <b>nhảy qua lại</b> giữa hai strike (đã thấy trên 3 ảnh 22:44 · 23:46 · 23:49).</p>\n<ul>\n<li>Đây là nhãn <b>dựng lại</b>, không phải lệnh có thật đúng lúc đó; lúc nến chạy, Put Wall còn là 3.374 nên không ai thấy để vào.</li>\n<li>Phần lớn là ⛔ (cổng chặn: Gamma âm chặn bắt đáy) nên cũng không thành lệnh.</li>\n<li>Cùng họ lỗi «tường nhảy» (số 187) và «nhìn trước tương lai» khi chạy lại (số 218). Cách sửa về sau: khóa Call/Put Wall theo ngày như đã khóa tỉ lệ quy đổi và Magnet.</li>\n</ul>\n</details>\n\n<details open><summary>⑰ TỔNG HỢP (một màn hình)</summary>\n<ol>\n<li><b>Bản chất:</b> theo dòng tiền phòng hộ bắt buộc của dealer, không theo mốc giá.</li>\n<li><b>Net GEX</b> (Σ) = phanh hay đạp ga, mạnh hay yếu → <b>xem đầu tiên</b>. Dương: đánh đảo chiều trong biên (9A). Âm: đi theo hướng phá (9B). −500M…+500M: chờ hướng.</li>\n<li><b>Gamma dương/âm</b> = tên gọi của Net GEX dương/âm.</li>\n<li><b>Gamma Flip</b> (đường trắng) = mức giá đổi chế độ. Xa: chế độ ổn định cả ngày. Sát (trong vùng đệm): dễ lật → 9A đứng ngoài, 9B vẫn được (mục ⑮). Flip tự dời theo OI mới mỗi ngày.</li>\n<li><b>Magnet</b> (đường xanh ngọc) = mức giá lực dealer mạnh nhất. HÚT (GEX dương): giá hay quay về. ĐẨY (GEX âm): phá qua thì chạy xa.</li>\n<li><b>Nguy hiểm nhất:</b> Gamma âm + Magnet đẩy → không bắt đáy/đỉnh, chờ phá rồi theo.</li>\n<li><b>Gamma âm vẫn BUY được:</b> BUY khi phá lên, SELL khi phá xuống; chỉ tránh bắt đáy/đỉnh. Cấm BUY dưới Flip chỉ khi Net GEX &lt; −2B.</li>\n<li><b>3 câu đầu phiên:</b> Net GEX? Cách Flip bao xa? Dealer phanh hay đạp ga? → rồi mới nhìn tường.</li>\n<li><b>Câu hỏi 25/11:</b> lần 2 không vào là đúng luật, nhìn lại thấy tiếc là bình thường (⑫); SELL khi hồi test sau khi phá là lý do hành động giá, Option Flow cho bối cảnh (⑬, ⑭); nhãn hiện ra sau là do Put Wall đổi (⑯).</li>\n<li><b>Magnet ở phía nào của Flip (⑤b):</b> Magnet nằm bên kia Flip → giá phải lấy lại Flip trước rồi Magnet mới thành điểm đến; Magnet nằm giữa giá và Flip → dùng ô ③/④ của mục ⑤.</li>\n<li><b>Chưa kiểm định:</b> tường, Magnet, luật 9A/9B đều là giả thuyết; chỉ quan sát cho tới khi backtest đạt chuẩn Module 29.</li>\n</ol>\n</details>\n</div>\n";
let stTry = 0;
function ofInitNotes() {
  const bar = document.querySelector("#pgbar"), aside = document.querySelector(".right");
  if (!bar || !aside || !bar.querySelector('[data-pg="5"]')) { if (++stTry < 30) setTimeout(ofInitNotes, 700); return; }
  if (bar.querySelector('[data-pg="st"]')) return;
  const btn = document.createElement("button"); btn.type = "button"; btn.dataset.pg = "st"; btn.className = "v3btn"; btn.textContent = "📘 Sổ tay"; btn.title = "Sổ tay học Option Flow: Net GEX, Gamma, Flip, Magnet… (để xem lại)";
  bar.appendChild(btn);
  const page = document.createElement("div"); page.className = "page"; page.dataset.pg = "st"; page.hidden = true;
  page.innerHTML = '<section class="panel" style="height:100%;overflow:auto"><header><h2>📘 Sổ tay Option Flow</h2><span class="muted small">bấm tên mục để mở / đóng</span></header><div id="stBody">' + SOTAY_HTML + "</div></section>";
  const css = document.createElement("style");
  css.textContent = ".stk{font-size:12.5px;line-height:1.55;color:#d7dde5;padding:2px 4px}.stk details{border:1px solid #2b3440;border-radius:6px;margin:0 0 8px;background:#121820}.stk summary{cursor:pointer;padding:7px 10px;font-weight:700;color:#f0c46a}.stk details[open] summary{border-bottom:1px solid #2b3440}.stk details>*:not(summary){margin:6px 12px}.stk table{border-collapse:collapse;width:calc(100% - 24px)!important;max-width:calc(100% - 24px)!important;table-layout:auto!important;font-size:12px}.stk th,.stk td{border:1px solid #2b3440;padding:4px 6px;vertical-align:top;text-align:left;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;font-family:inherit!important;font-size:12px!important;letter-spacing:0!important;text-transform:none!important;max-width:none!important;color:#d7dde5!important;background:transparent}.stk th{font-weight:700!important}.stk details{overflow:hidden}.stk th{color:#9fb3c8;background:#18202a}.stk ul,.stk ol{padding-left:20px}.stk li{margin:3px 0}.stk .warn{color:#ffb74d}.stk b{color:#f2f5f8}";
  document.head.appendChild(css);
  aside.insertBefore(page, aside.querySelector("#pineOut") || null);
  btn.addEventListener("click", () => { aside.querySelectorAll(":scope > .page").forEach((pg) => { pg.hidden = pg !== page; }); bar.querySelectorAll("button[data-pg]").forEach((b) => b.classList.toggle("on", b === btn)); });
  bar.addEventListener("click", (e) => { const b = e.target.closest("button[data-pg]"); if (b && b !== btn) { page.hidden = true; btn.classList.remove("on"); } }, true);
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
    <section class="panel v3track"><header><h2>Theo dõi diễn biến</h2><span id="ofReg" hidden></span><span style="margin-left:auto;display:inline-flex;gap:4px"><button type="button" id="ofWide" title="Mở rộng sang ngang (bảng chiếm cả hàng trên)" style="cursor:pointer;border:1px solid #2b3440;background:#141a22;color:#9aa4b2;border-radius:5px;padding:2px 7px;font-size:12px;line-height:1.1">⇔</button><button type="button" id="ofTall" title="Phóng to chiều cao bảng" style="cursor:pointer;border:1px solid #2b3440;background:#141a22;color:#9aa4b2;border-radius:5px;padding:2px 7px;font-size:12px;line-height:1.1">⤢</button></span></header><div id="ofNear" class="v3box">—</div><div id="ofT"></div></section>
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
  page.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-oftab]"); if (b) { OFV.tab = b.dataset.oftab; OFV.focus = null; ofRender(); return; }
    const f = e.target.closest("button[data-ofrf]"); if (f) { const [k, v] = f.dataset.ofrf.split(":"); OFV.rf[k] = v; try { localStorage.setItem("tvlb.ofrun", JSON.stringify(OFV.rf)); } catch { } ofRender(); return; }   // 9b-5b
    const go = e.target.closest("[data-ofgo]"); if (go) { e.preventDefault(); OFV.tab = "new"; OFV.focus = go.dataset.ofgo; ofRender();   // 9b-5b: nhảy tới thẻ kế hoạch
      setTimeout(() => { const el = page.querySelector(`[data-ofcard="${OFV.focus}"]`); if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }); }, 30); }
  });
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
  if (!ofX("x_noflip") && ofX("x_flipfar") && L.gamma_flip != null && regimePct(k.close, L.gamma_flip).far) return null;
  if (!ofX("x_noflip") && ofX("x_flipnear") && L.gamma_flip != null && ofNearFlip(k.close, L.gamma_flip, k.time)) return null;   // B9b5d: vùng đệm %/ATR/$ (TL1·TL2·HG vẫn đứng ngoài khi gần Flip như trước)   // v23ab   // TVLB B9b1: lọc ngày Flip xa (mặc định tắt)
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
    const rrMin = grp === "g_hedge" ? Math.max(Number(OFS.minRR) || 0, hgRRmin()) : (Number(OFS.minRR) || 0);   // v23am: HG có ngưỡng R:R riêng (mặc định 2)
    if (rrMin > 0) { const risk = Math.abs(k.close - sl), gain = tp1 != null ? Math.abs(tp1 - k.close) : 0; if (!(gain / Math.max(risk, 0.01) >= rrMin)) return null; }   // v23ai: bỏ tín hiệu có tỉ lệ lời/lỗ (TP1/SL) thấp hơn ngưỡng ở menu (0 = tắt)   // v23ai: bỏ tín hiệu có tỉ lệ lời/lỗ (TP1/SL) thấp hơn ngưỡng ở menu (0 = tắt)
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
      const tp1 = nextWall(k.close, true);
      s = mkSig(`HEDGE trap: rút chân khỏi vùng −Γ ${fmt(zDn.lo, 0)}–${fmt(zDn.hi, 0)}`, "BUY", { "CVD dốc lên": slope > 0, "Delta nến dương": k.delta > 0, "Nến quét thanh khoản": sw, "DXY giảm": dxyDn, "Volume spike": volSpike }, lo3 - sc.sl_buffer, tp1, tp1 != null ? nextWall(tp1, true) : null);
    } else if (zUp && k.close < k.open) {
      const tp1 = nextWall(k.close, false);
      s = mkSig(`HEDGE trap: rút râu khỏi vùng −Γ ${fmt(zUp.lo, 0)}–${fmt(zUp.hi, 0)}`, "SELL", { "CVD dốc xuống": slope < 0, "Delta nến âm": k.delta < 0, "Nến quét thanh khoản": sw, "DXY tăng": dxyUp, "Volume spike": volSpike }, hi3 + sc.sl_buffer, tp1, tp1 != null ? nextWall(tp1, false) : null);
    }
    if (!s) {
      const z = hZoneAt(k.close), zp = z && prev.close >= z.lo && prev.close <= z.hi ? z : null;
      if (zp && zp.kind === "accel") {
        if (p2.close > zp.hi && k.close < prev.close && k.close < k.open) {
          const tp1 = nextWall(k.close, false);
          s = mkSig(`HEDGE −Γ: LP bán đuổi, 2 nến trong vùng (${Math.abs(zp.peak)} HĐ/${hz.win}$)`, "SELL", { "CVD dốc xuống": slope < 0, "Delta nến âm": k.delta < 0, "DXY tăng": dxyUp, "Volume spike": volSpike }, Math.max(prev.high, zp.hi) + sc.sl_buffer, tp1, tp1 != null ? nextWall(tp1, false) : null);
        } else if (p2.close < zp.lo && k.close > prev.close && k.close > k.open) {
          const tp1 = nextWall(k.close, true);
          s = mkSig(`HEDGE −Γ: LP mua đuổi, 2 nến trong vùng (${Math.abs(zp.peak)} HĐ/${hz.win}$)`, "BUY", { "CVD dốc lên": slope > 0, "Delta nến dương": k.delta > 0, "DXY giảm": dxyDn, "Volume spike": volSpike }, Math.min(prev.low, zp.lo) - sc.sl_buffer, tp1, tp1 != null ? nextWall(tp1, true) : null);
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
function ofMkText(g) { try { const n = ofNumOf(g); return (n ? `#${n} ` : "") + ofTagName(g); } catch (e) { return ""; } }
function setMarkers() {
  const show = $("#lyMk").checked, smcOn = $("#lySMC")?.checked && S.smc;
  const mk = show ? S.signals.map((s) => ({
    time: s.time + TZ, position: s.side === "SELL" ? "aboveBar" : "belowBar", color: s.side === "SELL" ? C.down : C.up,
    shape: s.side === "SELL" ? "arrowDown" : "arrowUp", size: 0.7, text: "",   // 9b-5c: chữ nằm ở nhãn DỌC trên lớp phủ (#số / tên / sell-buy), không trải ngang
  })) : [];
  if (show) for (const g of S.of9Sig || []) if (S.candles[g.i]) mk.push({ time: g.time + TZ, position: g.side === "SELL" ? "aboveBar" : "belowBar", color: g.side === "SELL" ? C.down : C.up, shape: g.side === "SELL" ? "arrowDown" : "arrowUp", size: 0.7, text: "" });   // 9b-5c: lệnh 9A/9B cũng có mũi tên; chữ ở nhãn dọc
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
  return { cls: pct >= 0 ? "pos" : "neg", pct, far, pctTxt, farTxt, short: `${pct >= 0 ? "Long γ" : "Short γ"} ${pctTxt}` };
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
    <span>— XAU / GLD <b>×${fmt(gld?.ratio, 3)}</b></span><span>— Net GEX tổng <b>${(() => { const A = bangA(); return A ? fmtK(A.g) : fmtK(P?.net_gex); })()}</b>${P?.net_gex != null ? ` <span class="muted">(${P.source} ${fmtK(P.net_gex)})</span>` : ""}</span>
    <span>— Regime <b>${P?.gamma_flip == null ? "—" : regimePct(P.underlying, P.gamma_flip).short}</b>${(() => { const A = bangA(); return A ? ` · Bảng A <b>${A.short}</b>` : ""; })()}</span>
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
const J_CLOSED = ["tp1", "sl", "expired", "be", "timeout", "opp", "skip"];   // 9b-5: thêm hòa vốn (be), hết 12:30 (timeout), đóng vì lệnh ngược (opp), bị bỏ (skip)
S.journal = []; S.jTab = "live"; S.bt = null;
async function journalLoad() {
  let ok = false;
  try { S.journal = (await (await fetch(API("/api/journal") + (STATIC ? "?t=" + Date.now() : ""))).json()).entries || []; ok = true; } catch { if (!S.journal) S.journal = []; }
  if (ok) S.jLoaded = true;   // 9b-5: chưa đọc được nhật ký thì KHÔNG ghi lệnh lên (tránh ghi chồng)
  renderJournal();
}
function jPost(list) {
  if (STATIC || !list.length) return;
  fetch("/api/journal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries: list }) }).catch(() => { });
}
const jSig = (e) => [e.status, e.entry, e.sl, !!e.be, e.opp || "", e.oppBy || "", e.r == null ? "" : e.r, (e.adv || []).length].join("|");
function jUpsert(e) {
  const i = S.journal.findIndex((x) => x.id === e.id);
  if (i < 0) { S.journal.push(e); return e; }
  const o = S.journal[i];
  if (J_CLOSED.includes(o.status) && !J_CLOSED.includes(e.status)) return null;
  const m = { ...o, ...e }, of = o.kind === "OF" || o.kind === "OF9";
  if (of) {
    if (J_CLOSED.includes(o.status)) return null;   // 9b-5: trạng thái đã chốt trong nhật ký là CHỐT, đổi luật sau không sửa lại
    if (o.kind === "OF9") for (const k of OF9_FIXED_JS) if (o[k] !== undefined) m[k] = o[k];   // trường cố định chỉ ghi một lần (khớp server)
    m.be = !!(o.be || e.be);
    for (const k of ["opp", "oppBy"]) if (o[k]) m[k] = o[k];
    if (o.adv || e.adv) m.adv = jAdvMerge(o.adv, e.adv);
  } else if (o.status === e.status && o.entry === e.entry) return null;
  if (jSig(m) === jSig(o)) return null;
  S.journal[i] = m; return m;
}
const OF9_FIXED_JS = ["t", "kind", "name", "type", "side", "entry", "sl", "tp1", "tp2", "tf", "tag", "wall", "gam", "flip", "oppRule", "score", "from", "alt"];
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
// ═══════════════ 9b-5: LỆNH 9A/9B + QUẢN LÝ LỆNH → NHẬT KÝ MÁY CHỦ, TRẠNG THÁI, LUẬT LỆNH NGƯỢC CHIỀU, ĐỒNG BỘ ĐIỆN THOẠI ═══════════════
// Mọi luật quản lý lệnh (dời SL hòa vốn +1R, đóng 12:30 Chicago, gợi ý, luật lệnh ngược chiều) là GIẢ THUYẾT chưa backtest.
// Nguyên tắc: máy tính TÍNH và GHI vào nhật ký máy chủ (/api/journal); điện thoại (bản web) chỉ ĐỌC nhật ký + cài đặt do máy tính đẩy lên rồi tự theo dõi tiếp bằng nến của nó.
const OPP_RULES = { warn: "Chỉ cảnh báo: cả hai lệnh vẫn chạy, ghi cờ ngược chiều", newer: "Đóng lệnh CŨ khi lệnh mới ngược chiều xuất hiện (đóng ở giá vào của lệnh mới)", older: "BỎ lệnh MỚI nếu đang có lệnh ngược chiều đang chạy" };
const ofOppRule = () => (OFS.oppRule === "newer" || OFS.oppRule === "older" ? OFS.oppRule : "warn");
const J_FINAL = ["tp1", "sl", "expired", "be", "timeout", "opp"];   // đã đóng thật (skip = lệnh bị bỏ, tách riêng)
const ofName = (g) => g.tag || String(g.type || "OF").replace("[Options Flow] ", "").replace(/ \(.*$/, "").split(":")[0].trim();
// 9b-5b: CHỈ 9A/9B là lệnh OF9. Tín hiệu HG/TL1/TL1·2 (evaluate) cũng có g.tag (nhãn nến, v23ak) nên trước đây bị coi là 9A → ghi nhật ký sai kind OF9 + trùng lệnh.
function of9Tag(t) { return t === "9A" || t === "9B" || t === "9C" || t === "9D"; }
// UI3: 9C/9D = 9A/9B nhưng tường lấy từ nguồn PHỤ (GLD khi Wall chính = GC). THỬ NGHIỆM, CHƯA KIỂM CHỨNG; công tắc OFS.x_gld9 (mặc định TẮT).
const of9X = (t) => t === "9C" || t === "9D";
// 9b-5c: số thứ tự #1, #2… của các lệnh HÔM NAY (9A/9B + HG/TL), xếp theo giờ; dùng chung cho mũi tên trên chart và thẻ «Lệnh hôm nay»
function ofOrderNums() {   // 9b-5c: MỘT dãy số #1, #2… theo giờ cho mọi NẾN QUAN SÁT hôm nay (kể cả chưa đạt) và lệnh HG/TL; lệnh 9A/9B mang số của nến quan sát sinh ra nó
  const c = S.candles, m = new Map(), ent = new Set(); S.ofIn = ent; if (!c || !c.length) return m;
  const day = vnDate(c[c.length - 1].time), it = [], seen = new Set();
  let W = []; try { W = ofWatchCached().filter((w) => w.first && vnDate(w.time) === day); } catch (e) { /* bỏ qua */ }
  const wk = new Set(W.map((w) => w.p.id + "|" + w.time));
  for (const w of W) it.push({ t: w.time, k: "W|" + w.p.id + "|" + w.time, o: 0 });
  for (const g of S.of9Sig || []) { if (!c[g.i] || vnDate(g.time) !== day) continue; if (g.wkey && wk.has(g.wkey)) { ent.add(g.wkey); continue; } const k = ofKey(g); if (!seen.has(k)) { seen.add(k); it.push({ t: g.time, k, o: 1 }); } }
  for (const g of S.signals || []) { if (!c[g.i] || vnDate(g.time) !== day) continue; const k = ofKey(g); if (!seen.has(k)) { seen.add(k); it.push({ t: g.time, k, o: 1 }); } }
  it.sort((a, b) => a.t - b.t || a.o - b.o || (a.k < b.k ? -1 : 1)).forEach((x, n) => m.set(x.k, n + 1));
  return m;
}
const ofNumOf = (g) => (S.ofNum ? (g.wkey && S.ofNum.get("W|" + g.wkey)) || S.ofNum.get(ofKey(g)) : null);   // số của một LỆNH
const ofNumW = (w) => (S.ofNum ? S.ofNum.get("W|" + w.p.id + "|" + w.time) : null);   // số của một NẾN QUAN SÁT
const ofEntW = (w) => !!(S.ofIn && S.ofIn.has(w.p.id + "|" + w.time));   // nến quan sát này đã thành lệnh
const ofTagName = (g) => g.tag || (/HEDGE/i.test(g.type || "") ? "HG" : "TL");
const ofKey = (g) => (of9Tag(g.tag) ? "OF9|" + (g.id || `${g.tag}|${g.side}|${g.time}`) : `OF|${g.type}|${g.side}|${g.time}`);   // = id trong nhật ký (jFromOF dùng cùng công thức cho lệnh HG/TL)
const chiMin = (t) => { const q = {}; for (const x of CHI_FMT.formatToParts(new Date(t * 1000))) q[x.type] = x.value; return (q.hour === "24" ? 0 : +q.hour) * 60 + +q.minute; };
// số phút còn lại tới 12:30 Chicago (tính từ lúc vào lệnh t0; xấp xỉ, bỏ qua 2 ngày/năm đổi giờ mùa hè)
function ofChiRemain(t0) { const m = chiMin(t0), add = m < 750 ? 750 - m : 1440 - m + 750; return Math.round((t0 + add * 60 - nowSec()) / 60); }
const ofHm = (min) => (min >= 60 ? `${Math.floor(min / 60)} giờ ${String(min % 60).padStart(2, "0")} phút` : `${min} phút`);
function jAdvMerge(a, b) { const out = [...(a || [])], have = new Set(out.map((x) => x.c)); for (const x of b || []) if (x && x.c && !have.has(x.c) && out.length < 20) { out.push(x); have.add(x.c); } return out; }

// gộp: lệnh đang tính trên màn hình (S.signals = HG/TL, S.of9Sig = 9A/9B) + lệnh trong nhật ký (OF, OF9) của ~2 ngày; khử trùng theo id nhật ký
function ofOrderList() {
  const c = S.candles, now = nowSec(), jm = new Map((S.journal || []).map((e) => [e.id, e])), map = new Map();
  if (!c || c.length < 30) return [];
  const idxOf = (t) => ofIdxAt(c, t);
  const addCalc = (g) => {
    if (!c[g.i]) return; const key = ofKey(g); if (map.has(key)) return; const e = jm.get(key) || null;
    const g2 = e && e.entry != null && e.sl != null ? { ...g, entry: e.entry, sl: e.sl, tp1: e.tp1 !== undefined ? e.tp1 : g.tp1, tp2: e.tp2 !== undefined ? e.tp2 : g.tp2 } : g;   // đã có trong nhật ký thì dùng giá ĐÃ GHI
    map.set(key, { key, e, g: g2 });
  };
  for (const g of S.of9Sig || []) addCalc(g);
  for (const g of S.signals || []) addCalc(g);
  for (const e of jm.values()) {
    if ((e.kind !== "OF" && e.kind !== "OF9") || (e.kind === "OF9" && !of9Tag(e.tag || e.name)) || map.has(e.id) || e.entry == null || e.sl == null || (e.kind === "OF" && e.tp1 == null) || e.status === "skip" && e.kind === "OF" || now - e.t > 2 * 86400) continue;
    const ix = idxOf(e.t); if (ix < 0) continue;
    map.set(e.id, { key: e.id, e, g: { i: ix, time: e.t, side: e.side, entry: e.entry, sl: e.sl, tp1: e.tp1 ?? null, tp2: e.tp2 ?? null, type: e.type, tag: e.kind === "OF9" ? (e.tag || e.name) : undefined, id: e.kind === "OF9" ? String(e.id).replace(/^OF9\|/, "") : undefined, wall: e.wall, gam: e.gam, flip: e.flip, virt: true, latched: true } });
  }
  return [...map.values()].sort((a, b) => a.g.i - b.g.i || a.g.time - b.g.time);
}
// kết quả cuối của một lệnh
function ofResOf(st, cc) {
  const g = st.o.g, dir = g.side === "BUY" ? 1 : -1, risk = Math.max(Math.abs(g.entry - g.sl), 0.01);
  if (st.skip) return { status: "skip", r: 0, j: g.i + 1, closeT: cc[g.i + 1] ? cc[g.i + 1].time : null, exit: null, be: false };
  if (st.fin) { const e = st.fin; return { status: e.status, r: e.r ?? 0, j: st.effJ != null && st.effJ >= 0 ? st.effJ : null, closeT: e.closeT ?? null, exit: e.exit ?? null, be: !!e.be || e.status === "be" }; }
  if (st.forced) { const kc = cc[st.forced.j]; return { status: "opp", r: st.forced.r, j: st.forced.j, closeT: kc ? kc.time : st.forced.t ?? null, exit: st.forced.price, be: rrNatural(g, cc.slice(0, st.forced.j), false).be }; }
  const n = st.nat, kc = n.j != null ? cc[n.j] : null;
  if (!n.t) return { status: "open", r: null, j: null, closeT: null, exit: null, be: !!n.be };
  if (n.t === "chạm TP1") return { status: "tp1", r: ((g.tp1 - g.entry) * dir) / risk, j: n.j, closeT: kc.time, exit: g.tp1, be: !!n.be };
  if (n.t === "chạm SL") return { status: "sl", r: -1, j: n.j, closeT: kc.time, exit: g.sl, be: false };
  if (n.t === "hòa vốn") return { status: "be", r: 0, j: n.j, closeT: kc.time, exit: g.entry, be: true };
  return { status: "timeout", r: n.r, j: n.j, closeT: kc.time, exit: kc.open, be: !!n.be };   // "hết giờ" 12:30 Chicago: đóng ở giá MỞ nến đó
}
// QUẢN LÝ + LUẬT LỆNH NGƯỢC CHIỀU. list đã sắp theo thời gian vào lệnh. Hai lệnh "ngược chiều chồng nhau" = lệnh cũ chưa đóng lúc lệnh mới vào (đóng ở nến j ≥ nến vào của lệnh mới).
// rule: warn = chỉ ghi cờ · newer = đóng lệnh CŨ ở giá vào của lệnh MỚI · older = BỎ lệnh MỚI (chỉ áp cho lệnh chưa có trong nhật ký). Trạng thái đã ghi trong nhật ký (đã đóng / opp / skip) là CHỐT, đổi luật sau không sửa lại.
function ofResolve(list, cc, rule, closedOnly) {
  const R = new Map(), live = [], cIdx = (t) => ofIdxAt(cc, t);
  for (const o of list) {
    const g = o.g, e = o.e, ie = g.i + 1, st = { o, key: o.key, nat: null, fin: null, forced: null, skip: false, opp: null, oppBy: null, effJ: null, res: null };
    R.set(o.key, st);
    if (e && e.status === "skip") { st.skip = true; continue; }
    st.nat = rrNatural(g, cc, closedOnly); st.effJ = st.nat.j;
    if (e && J_FINAL.includes(e.status)) {
      st.fin = e; const jj = e.closeT != null ? cIdx(e.closeT) : -1; st.effJ = jj >= 0 ? jj : st.nat.j != null ? st.nat.j : -1;
      if (e.status === "opp") st.forced = { j: st.effJ >= 0 ? st.effJ : ie, r: e.r ?? 0, price: e.exit };
    }
    const ovl = live.filter((a) => a.o.g.side !== g.side && (a.effJ == null || a.effJ >= ie));
    if (ovl.length) { st.opp = ovl[ovl.length - 1].key; for (const a of ovl) if (!a.oppBy) a.oppBy = st.key; }
    if (ovl.length && !e && rule === "older") { st.skip = true; continue; }
    if (ovl.length && rule === "newer") for (const a of ovl) if (!a.fin) { const ag = a.o.g; a.forced = { j: ie, r: ((g.entry - ag.entry) * (ag.side === "BUY" ? 1 : -1)) / Math.max(Math.abs(ag.entry - ag.sl), 0.01), price: g.entry, t: g.time }; a.effJ = ie; }
    live.push(st);
  }
  for (const st of R.values()) st.res = ofResOf(st, cc);
  return R;
}
// tính lại danh sách + kết quả hiển thị (nến đang chạy cũng tính) — khung đo trên chart và thẻ lệnh dùng S.ofForce / S.ofRes
function ofRefresh(force) {
  const cc = S.candles; if (!cc || cc.length < 30) return null;
  if (!force && S.ofRes && Date.now() - (S.ofRefT || 0) < 2500) return S.ofRes;
  const list = ofOrderList(), live = ofResolve(list, cc, ofOppRule(), false), fz = new Map();
  for (const [k, st] of live) { if (st.skip) fz.set(k, { skip: true }); else if (st.forced) fz.set(k, { j: st.forced.j, r: st.forced.r }); }
  S.ofForce = fz; S.ofRes = live; S.ofList = list; S.ofRefT = Date.now();
  return live;
}
// ── gợi ý quản lý lệnh (lớp 2, GIẢ THUYẾT, tắt được). Trả về [{c: mã, txt}] ──
function ofAdvise(st, price) {
  const out = [], g = st.o.g, res = st.res, cc = S.candles; if (!res || res.status !== "open" || OFS.advOff === true || price == null) return out;
  const dir = g.side === "BUY" ? 1 : -1, risk = Math.max(Math.abs(g.entry - g.sl), 0.01), R = ((price - g.entry) * dir) / risk;
  if (OFS.teOff !== true) { const m = ofChiRemain(g.time); if (m <= 30 && m >= 0) out.push({ c: "t1230", txt: `Sắp ${CHV("12:30")} (còn ${m} phút): lệnh sẽ tự đóng ở giá mở nến đó.` }); }
  if (g.tp1 != null) { const full = Math.abs(g.tp1 - g.entry), done = (price - g.entry) * dir; if (full / risk >= 1 && done >= 0.8 * full && done < full) out.push({ c: "half", txt: `Giá đã đi ≥ 80% quãng tới TP1 (R ${sgn(R, 2)}): cân nhắc chốt ½ rồi giữ SL hòa vốn (giống «Chốt 2 phần» ở trang ⑤).` }); }
  if (g.wall != null && cc[cc.length - 2] && cc.length - 2 > g.i) { const k = cc[cc.length - 2]; if (dir < 0 ? k.close > g.wall * 1.001 : k.close < g.wall * 0.999) out.push({ c: "wallx", txt: `Nến đóng ${ofFm(k.close)} xuyên tường ${ofFm(g.wall)} quá 0,10% NGƯỢC hướng lệnh (B10b): cân nhắc thoát.` }); }
  try {
    const zs = (((hedgeSt() || {}).zones) || []).filter((z) => z.kind === "accel"), inz = zs.find((z) => price >= z.lo && price <= z.hi);
    if (inz) out.push({ c: "hz", txt: `Giá đang TRONG vùng Hedge −Γ ${ofFm(inz.lo)}–${ofFm(inz.hi)}: biến động mở rộng, SL dễ bị quét.` });
    else if (g.tp1 != null) { const ah = zs.find((z) => (dir > 0 ? z.lo > price && z.lo < g.tp1 : z.hi < price && z.hi > g.tp1)); if (ah) out.push({ c: "hz", txt: `Vùng Hedge −Γ ${ofFm(ah.lo)}–${ofFm(ah.hi)} nằm giữa giá và TP1: giá có thể gia tốc qua vùng hoặc bị bẫy.` }); }
  } catch (e) { /* bỏ qua */ }
  if ((g.gam === 1 || g.gam === -1) && g.flip != null) { const now = price < g.flip ? -1 : 1; if (now !== g.gam) out.push({ c: "flip", txt: `Giá vừa cắt Flip ${ofFm(g.flip)}: Gamma đổi từ ${g.gam < 0 ? "ÂM sang DƯƠNG" : "DƯƠNG sang ÂM"} so với lúc vào lệnh.` }); }
  return out;
}
// ── GHI vào nhật ký máy chủ (PC) / cập nhật bản sao trong bộ nhớ (điện thoại). Dùng NẾN ĐÃ ĐÓNG để chốt trạng thái (khỏi chốt nhầm vì râu nến đang chạy) ──
function ofJournalPost() {
  const cc = S.candles; if (!S.jLoaded || !cc || cc.length < 30) return;
  ofRefresh(true);
  const rule = ofOppRule(), jr = ofResolve(S.ofList || [], cc, rule, true), out = [], price = lastPrice(), teOn = OFS.teOff !== true, now = nowSec();
  for (const [key, st] of jr) {
    const o = st.o, g = o.g, e0 = o.e, is9 = of9Tag(g.tag), res = st.res;
    if (is9 ? g.rebuilt && !e0 : !e0) continue;   // HG/TL chỉ cập nhật lệnh ĐÃ có trong nhật ký; 9A/9B dựng lại (không chốt được) không ghi
    if (e0 && J_CLOSED.includes(e0.status)) continue;
    let status = res.status, closeT = res.closeT, r = res.r, exit = res.exit;
    if (status === "open" && !teOn && now - g.time > 2 * 86400) { status = "expired"; closeT = now; r = 0; }
    const e = { id: key, t: g.time, kind: is9 ? "OF9" : "OF", status, be: !!res.be, opp: st.opp || undefined, oppBy: st.oppBy || undefined };
    if (status !== "open") { e.closeT = closeT; e.exit = exit; e.r = r == null ? null : +r.toFixed(3); }
    if (is9 && !e0) {
      Object.assign(e, { name: g.tag, type: (g.tag === "9D" ? "9D phá vỡ tường GLD (Gamma âm) · THỬ NGHIỆM, CHƯA KIỂM CHỨNG" : g.tag === "9C" ? "9C bật lại từ tường GLD · THỬ NGHIỆM, CHƯA KIỂM CHỨNG" : g.tag === "9B" ? "9B phá vỡ tường (Gamma âm)" : "9A bật lại từ tường") + (g.rt ? " · HỒI TEST · SO SÁNH, KHÔNG có trong B10b, CHƯA KIỂM CHỨNG" : "") + (g.n2 ? " · LẦN 2 · SO SÁNH, KHÔNG theo B10b, CHƯA KIỂM CHỨNG" : ""), alt: g.rt ? "retest" : g.n2 ? "lan2" : of9X(g.tag) ? "gld" : undefined, side: g.side, entry: g.entry, sl: g.sl, tp1: g.tp1, tp2: g.tp2 ?? null, tf: S.tf, tag: g.tag, wall: g.wall, gam: g.gam, flip: g.flip,
        score: "✔ đủ điều kiện", oppRule: rule, from: cc.length - 1 - g.i <= 2 ? "live" : "ls", note: cc.length - 1 - g.i <= 2 ? undefined : "nhập từ bộ nhớ trình duyệt (không phải lúc lệnh xuất hiện)" });
      if (of9X(g.tag)) e.note = "lệnh " + g.tag + " (tường GLD, công tắc THỬ NGHIỆM, chưa kiểm chứng): KHÔNG gộp với lệnh 9A/9B khi thống kê";
      else if (g.rt) e.note = "lệnh 9B HỒI TEST (công tắc so sánh, không có trong B10b, chưa kiểm chứng): KHÔNG gộp với lệnh B10b khi thống kê";
      else if (g.n2) e.note = "lệnh LẦN 2 (công tắc so sánh, không theo B10b, chưa kiểm chứng): KHÔNG gộp với lệnh B10b khi thống kê";
      if (status === "skip") e.note = (e.note ? e.note + " · " : "") + "bỏ: đang có lệnh ngược chiều (luật «bỏ lệnh mới»)";
    }
    if (is9 && status === "open") { const adv = ofAdvise(st, price).map((a) => ({ c: a.c, t: now, px: price, r: +((((price - g.entry) * (g.side === "BUY" ? 1 : -1)) / Math.max(Math.abs(g.entry - g.sl), 0.01))).toFixed(2), txt: a.txt })); if (adv.length) e.adv = adv; }
    const n = jUpsert(e); if (n) out.push(n);
  }
  if (out.length) { jPost(out); renderJournal(); }
}
function journalTrack() { try { ofJournalPost(); } catch (e) { console.error("[TVLB] nhật ký lệnh:", e); } }
// ── dòng TRẠNG THÁI lệnh (lớp 1) + gợi ý (lớp 2) cho thẻ lệnh ──
const ofIdxAt = (c, t) => { const s = TF_SEC[S.tf] || 300; for (let j = c.length - 1; j >= 0; j--) if (c[j].time <= t) return t - c[j].time < s ? j : -1; return -1; };   // nến chứa thời điểm t (khung hiện tại có thể khác khung lúc ghi lệnh)
async function ofWallsLoad() { if (!STATIC) return; try { S.w9file = await (await fetch(API("/api/walls9a") + "?t=" + Date.now())).json(); } catch { /* giữ bản cũ */ } }
const OF_ST_TXT = { open: "đang chạy", tp1: "✓ chạm TP1", sl: "✗ chạm SL", be: "↔ hòa vốn (SL đã dời)", timeout: "⏱ hết " + CHV("12:30"), opp: "⇄ đóng vì lệnh ngược chiều", skip: "bỏ (có lệnh ngược chiều)", expired: "hết hạn" };
function ofTickLine(g) {   // số 220: thẻ lệnh ghi rõ các ô tick dùng cho loại lệnh này
  if (!of9Tag(g.tag)) return "";   // 9b-5b: chỉ 9A/9B (HG/TL dùng danh sách ô riêng của evaluate)
  const sell = g.side === "SELL", nm = (g.tag === "9A" || g.tag === "9C") ? (sell ? ["Phân kỳ CVD âm", "CVD dốc xuống", "DXY tăng", "Volume spike", "Vol↑ mà ΔOI≤0", "ΔOI≥1500 tại vùng", "Lệnh lớn bán ròng"] : ["Phân kỳ CVD dương", "CVD dốc lên", "DXY giảm", "Volume spike", "Vol↑ mà ΔOI≤0", "ΔOI≥1500 tại vùng", "Lệnh lớn mua ròng"])
    : (sell ? ["CVD dốc xuống", "Delta nến âm", "DXY tăng", "Volume spike", "Lệnh lớn bán ròng"] : ["CVD dốc lên", "Delta nến dương", "DXY giảm", "Volume spike", "Lệnh lớn mua ròng"]);
  const on = nm.filter((n) => ofOn("c:" + n)), need = Number.isInteger(OFS.minConf) ? OFS.minConf : S.cfg?.signals?.min_confirm;
  return `<div class="muted" style="font-size:10.5px">Điều kiện xác nhận theo menu HIỆN TẠI: đang tick <b>${on.length}/${nm.length}</b> ô dùng cho ${g.tag} ${g.side} (cần ≥ ${need})${on.length ? ": " + on.join(", ") : ""} · ${g.tag === "9A" ? "«Delta nến» và «Nến quét» KHÔNG áp dụng cho 9A; «Lệnh lớn» chỉ có khi live" : "«Nến quét» KHÔNG áp dụng cho 9B; «Lệnh lớn» chỉ có khi live"}.</div>`;
}
function ofStatusHtml(st) {
  if (!st || !st.res) return "";
  const g = st.o.g, res = st.res, nmOf = (k) => { const x = S.ofRes && S.ofRes.get(k); return x ? `${ofName(x.o.g)} ${x.o.g.side} ${vnClock(x.o.g.time)}` : "lệnh khác"; };
  const sm = "font-size:11px;margin-top:3px;line-height:1.45";
  if (res.status !== "open") {
    return `<div style="${sm};color:#9aa4b2">Đã đóng: <b>${OF_ST_TXT[res.status] || res.status}</b>${res.status === "skip" ? "" : ` ${sgn(res.r, 2)}R${res.closeT ? " lúc " + vnClock(res.closeT) : ""}`}${st.opp ? ` · lúc vào có lệnh ngược chiều: ${nmOf(st.opp)}` : ""}</div>`;
  }
  const p = lastPrice(), dir = g.side === "BUY" ? 1 : -1, risk = Math.max(Math.abs(g.entry - g.sl), 0.01), R = ((p - g.entry) * dir) / risk, slNow = res.be ? g.entry : g.sl;
  const dSL = (p - slNow) * dir, dTP = g.tp1 != null ? (g.tp1 - p) * dir : null, bits = [];
  bits.push(`<b style="color:${R >= 0 ? "#26b384" : "#ef5350"}">R ${sgn(R, 2)}</b> (giá ${ofFm(p)})`);
  bits.push(res.be ? `SL hiện hành <b>${ofFm(slNow)}</b> ✔ đã dời hòa vốn` : `SL <b>${ofFm(g.sl)}</b> (còn ${sgn(Math.max(0, 1 - R), 2).replace("+", "")}R nữa tới +1R để dời hòa vốn)`);
  bits.push(`còn <b>${ofFm(Math.max(0, dSL))}$</b> tới SL`);
  if (dTP != null) bits.push(dTP > 0 ? `còn <b>${ofFm(dTP)}$</b> tới TP1 ${ofFm(g.tp1)} (≈ ${(dTP / risk).toFixed(2)}R)` : `đã vượt TP1 ${ofFm(g.tp1)}`);
  const l2 = [], nw = nextWall(p, dir > 0);
  if (nw != null) l2.push(`tường kế tiếp ${ofFm(nw)} (cách ${ofFm(Math.abs(nw - p))}$)`);
  try {
    const zs = (((hedgeSt() || {}).zones) || []).filter((z) => z.kind === "accel"), inz = zs.find((z) => p >= z.lo && p <= z.hi), ah = !inz && zs.filter((z) => (dir > 0 ? z.lo > p : z.hi < p)).sort((a, b) => (dir > 0 ? a.lo - b.lo : b.hi - a.hi))[0];
    if (inz) l2.push(`<b style="color:#f0b429">ĐANG trong vùng Hedge −Γ ${ofFm(inz.lo)}–${ofFm(inz.hi)}</b>`); else if (ah) l2.push(`vùng Hedge −Γ phía trước ${ofFm(ah.lo)}–${ofFm(ah.hi)} (cách ${ofFm(dir > 0 ? ah.lo - p : p - ah.hi)}$)`);
  } catch (e) { /* bỏ qua */ }
  if (OFS.teOff !== true) { const m = ofChiRemain(g.time); l2.push(m > 0 ? `còn ${ofHm(m)} tới ${CHV("12:30")}` : `đã tới ${CHV("12:30")} (chờ nến đóng lệnh)`); }
  let h = `<div style="${sm}">● <b>ĐANG CHẠY</b> · ${bits.join(" · ")}</div>`;
  if (l2.length) h += `<div style="${sm};color:#9aa4b2">${l2.join(" · ")}</div>`;
  const opps = [...(S.ofRes ? S.ofRes.values() : [])].filter((x) => x.res && x.res.status === "open" && x.o.g.side !== g.side && x.key !== st.key);
  if (opps.length) h += `<div style="${sm};color:#ff8a65">⚠ CÓ LỆNH NGƯỢC CHIỀU đang chạy: ${opps.map((x) => `${ofName(x.o.g)} ${x.o.g.side} ${vnClock(x.o.g.time)} (R ${sgn(((lastPrice() - x.o.g.entry) * (x.o.g.side === "BUY" ? 1 : -1)) / Math.max(Math.abs(x.o.g.entry - x.o.g.sl), 0.01), 2)})`).join("; ")} · luật hiện tại: ${OPP_RULES[ofOppRule()].split(":")[0]}</div>`;
  const adv = ofAdvise(st, p);
  if (adv.length) h += `<div style="${sm};color:#e0a83a">${adv.map((a) => "💡 Giả thuyết · " + a.txt).join("<br>")}</div>`;
  return h;
}
// ── CÀI ĐẶT: máy tính gửi lên máy chủ → bản web điện thoại đọc lại (hướng B, số 216) ──
const O3_KEYS = ["thSt", "thSg", "sig", "kh", "box", "boxn", "k", "minG", "kh1", "kh2", "kh3", "tpm", "slmax", "tout", "wh", "minor", "topn", "wst", "hubtp"];   // KHÔNG đồng bộ: âm thanh, Telegram, cảnh báo (riêng từng thiết bị)
function ofSettingsSnap() {
  const rd = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } }, o3 = rd("tvlb.o3") || {}, snap = { of: OFS, o3: {}, tip: rd("tvlb.tip") || {}, layers: rd("tvlb.layers") || {} };
  for (const k of O3_KEYS) if (k in o3) snap.o3[k] = o3[k];
  return snap;
}
let setSig = null, setT = 0;
function ofSettingsPush() {
  if (STATIC) return;
  const body = JSON.stringify(ofSettingsSnap()); if (body === setSig || Date.now() - setT < 4000) return;
  setT = Date.now(); const prev = setSig; setSig = body;
  fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body }).then((r) => r.json()).then((r) => { S.setInfo = r; }).catch(() => { setSig = prev; });
}
async function ofSettingsPull() {   // điện thoại: theo cài đặt của máy tính (tắt được ở dòng «Cài đặt» trong tab Lệnh hôm nay)
  if (!STATIC || localStorage.getItem("tvlb.follow") === "0") return;
  let s = null; try { s = await (await fetch(API("/api/settings") + "?t=" + Date.now())).json(); } catch { return; }
  if (!s || !(s.rev > 0)) return;
  S.setInfo = { rev: s.rev, t: s.t };
  if (Number(localStorage.getItem("tvlb.setRev") || 0) === s.rev) return;
  const rd = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } }, wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };
  for (const k of Object.keys(OFS)) delete OFS[k]; Object.assign(OFS, s.of || {}); wr(OF_LS, OFS);
  let need = false;
  const o3 = rd("tvlb.o3") || {}, o3n = { ...o3, ...(s.o3 || {}) }; if (JSON.stringify(o3) !== JSON.stringify(o3n)) { wr("tvlb.o3", o3n); need = true; }
  if (s.tip && Object.keys(s.tip).length && JSON.stringify(rd("tvlb.tip") || {}) !== JSON.stringify(s.tip)) { wr("tvlb.tip", s.tip); need = true; }
  if (s.layers && Object.keys(s.layers).length && JSON.stringify(rd("tvlb.layers") || {}) !== JSON.stringify(s.layers)) { wr("tvlb.layers", s.layers); need = true; }
  try { localStorage.setItem("tvlb.setRev", String(s.rev)); } catch { }
  if (need) { location.reload(); return; }   // tvlb_tinhieu.js đọc cài đặt của nó lúc tải trang
  if (S.candles && S.candles.length) { try { replaySignals(); ofRender(); drawOverlay(); } catch { } }
}
// ── danh sách tường 9A của ngày → nhật ký máy chủ (số 223) ──
let w9sig = "";
function ofWallsPost() {
  const w = S.w9; if (STATIC || !w || !w.walls || !w.walls.length || Date.now() - w.t > 15000) return;
  const sig = w.day + "|" + w.mode + "|" + w.walls.map((x) => Math.round(x.lvl)).join(","); if (sig === w9sig) return;
  const prev = w9sig; w9sig = sig;
  fetch("/api/walls9a", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(w) }).catch(() => { w9sig = prev; });
}
function ofSync() {
  try { ofRefresh(true); ofJournalPost(); ofSettingsPush(); ofWallsPost(); } catch (e) { console.error("[TVLB] ofSync:", e); }
}
// dòng đầu tab «Lệnh hôm nay»: tóm tắt lệnh đang chạy, cảnh báo ngược chiều, luật, nguồn cài đặt, tường 9A
function ofRunHeadHtml(list) {   // 9b-5b: đếm trên ĐÚNG danh sách thẻ đang hiện (trước đây đếm bảng khác nên lệch với nút tab)
  const R = (list || (S.ofRes ? [...S.ofRes.values()] : [])).filter((x) => x && x.res), run = R.filter((x) => x.res.status === "open"), b = run.filter((x) => x.o.g.side === "BUY"), s = run.filter((x) => x.o.g.side === "SELL");
  const sm = "font-size:10.5px;margin:0 0 4px;line-height:1.45";
  let h = `<div class="muted" style="${sm}">Đang chạy: <b>${run.length}</b>${run.length ? ` (BUY ${b.length} · SELL ${s.length})` : ""} · luật lệnh ngược chiều: <b>${OPP_RULES[ofOppRule()].split(":")[0]}</b> (đổi ở menu «📏 TP / SL»).</div>`;
  if (b.length && s.length) h += `<div style="${sm};color:#ff8a65">⚠ Đang có CẢ lệnh BUY lẫn SELL chạy cùng lúc: thống kê và rủi ro bị lệch (hai lệnh triệt tiêu nhau). ${ofOppRule() === "warn" ? "Luật hiện tại chỉ cảnh báo." : ""}</div>`;
  const w = STATIC ? (S.w9file && S.w9file.row) : S.w9 && { mode: S.w9.mode, ref: S.w9.ref, walls: S.w9.walls };
  if (w && w.walls && w.walls.length) h += `<div class="muted" style="${sm}">Tường ${w.mode || "9A"} ${STATIC && S.w9file && S.w9file.day ? "ngày " + S.w9file.day : "hôm nay"} (top 3 OI trong ±2,5% quanh giá mở ngày ${w.ref != null ? ofFm(w.ref) : "—"}): ${(() => { const isF = (x) => x.kind === "flip" || x.id === "nwbf", isG = (x) => x.kind === "gld9" || /^nw[ab][5-7]$/.test(x.id || ""); const m = w.walls.filter((x) => !isF(x) && !isG(x)), g = w.walls.filter(isG), f = w.walls.filter(isF); return m.map((x) => ofFm(x.lvl)).join(" · ") + (f.length ? " · Flip (9B tại Flip): " + f.map((x) => ofFm(x.lvl)).join(" · ") : "") + (g.length ? '<br><span style="color:#ce93d8">Tường 9C/9D ' + (g[0].src || "GLD") + " 🧪 thử nghiệm: " + g.map((x) => ofFm(x.lvl)).join(" · ") + "</span>" : ""); })()}${STATIC ? " (máy tính ghi lúc " + vnClock(S.w9file.row.ts) + ")" : " (đã ghi vào máy chủ)"}</div>`;
  if (STATIC) {
    const on = localStorage.getItem("tvlb.follow") !== "0", si = S.setInfo;
    h += `<div class="muted" style="${sm}">📱 Cài đặt: <b>${on ? "theo máy tính" : "riêng điện thoại"}</b>${on && si && si.t ? " · bản " + new Date(si.t).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : ""} <button type="button" data-offollow="1" style="cursor:pointer;font-size:10.5px;border:1px solid #2b3440;background:#141a22;color:#9aa4b2;border-radius:4px;padding:1px 6px">${on ? "Ngừng theo máy tính" : "Theo máy tính"}</button></div>`;
  } else if (S.setInfo && S.setInfo.rev) h += `<div class="muted" style="${sm}">💻 Cài đặt menu đã gửi lên máy chủ (điện thoại sẽ theo sau vài phút).</div>`;
  return h;
}

// thống kê một danh sách lệnh {status, r, t}: theo thứ tự thời gian
function statsOf(list) {
  const FIN = ["tp1", "sl", "be", "timeout", "opp"];   // 9b-5: hòa vốn / hết 12:30 / đóng vì lệnh ngược cũng tính (R lấy từ lệnh); bị bỏ (skip) và hết hạn thì không
  const done = list.filter((x) => FIN.includes(x.status)).sort((a, b) => (a.closeT ?? a.t) - (b.closeT ?? b.t));
  let R = 0, pk = 0, dd = 0, ls = 0, mls = 0, w = 0, l = 0, z = 0;
  for (const x of done) {
    const r = x.status === "tp1" ? (x.r ?? 1) : x.status === "sl" ? -1 : (x.r ?? 0); R += r;
    if (r > 0.0001) { w++; ls = 0; } else if (r < -0.0001) { l++; ls++; mls = Math.max(mls, ls); } else z++;   // r≈0 (hòa vốn): trung tính, không cắt chuỗi thua
    pk = Math.max(pk, R); dd = Math.max(dd, pk - R);
  }
  return { n: list.filter((x) => x.status !== "skip").length, closed: done.length, w, l, z, wr: done.length ? (100 * w) / done.length : null, R, avg: done.length ? R / done.length : null, dd, mls, open: list.filter((x) => x.status === "open" || x.status === "pending").length };
}
const statTxt = (st) => `<span>Lệnh <b>${st.n}</b></span><span>Đã đóng <b>${st.closed}</b></span><span>Winrate <b>${st.wr == null ? "—" : st.wr.toFixed(1) + "%"}</b></span>
  <span>Tổng <b class="${st.R >= 0 ? "win" : "loss"}">${sgn(st.R, 1)}R</b></span><span>TB <b>${st.avg == null ? "—" : sgn(st.avg, 2)}R</b></span><span>DD <b>${st.dd.toFixed(1)}R</b></span><span>Thua liền <b>${st.mls}</b></span>`;
function groupRows(list, key) {
  const g = {};
  for (const x of list) (g[key(x)] = g[key(x)] || []).push(x);
  return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => { const st = statsOf(v); return `<tr><td>${esc(k)}</td><td>${st.n}</td><td>${st.w}/${st.l}${st.z ? "·" + st.z : ""}</td><td>${st.wr == null ? "—" : st.wr.toFixed(0) + "%"}</td><td class="${st.R >= 0 ? "win" : "loss"}">${sgn(st.R, 1)}</td><td>${st.dd.toFixed(1)}</td></tr>`; }).join("");
}
const gHead = (t) => `<thead><tr><th>${t}</th><th>Lệnh</th><th>T/B</th><th>WR</th><th>R</th><th>DD</th></tr></thead>`;
const stTxt = { open: "đang chạy", pending: "chờ", tp1: "✓ TP1", sl: "✗ SL", expired: "hết hạn", missed: "lỡ", skip: "bỏ", be: "↔ hòa vốn", timeout: "⏱ " + chiToVn("12:30") + " VN", opp: "⇄ ngược chiều" };
function renderJournal() {
  const box = $("#jOut"); if (!box) return;
  document.querySelectorAll("#jTabs button").forEach((b) => b.classList.toggle("on", b.dataset.t === S.jTab));
  if (S.jTab === "live") {
    const J = S.journal, smc = J.filter((x) => x.kind === "SMC"), of = J.filter((x) => x.kind === "OF" || x.kind === "OF9");
    const rows = [...J].sort((a, b) => b.t - a.t).slice(0, 40).map((e) => `<tr><td>${vnDate(e.t).slice(5)} ${vnClock(e.t)}</td><td>${e.kind === "SMC" ? "SMC" : "OF"} ${esc(e.name)}${e.opp || e.oppBy ? ' <span title="Có lệnh ngược chiều chồng nhau">⇄</span>' : ""} <span class="muted">${esc(e.tf || "")}</span></td>
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
    ofFreezeRatio(st);   // v23ak: khóa tỉ lệ quy đổi trước khi so sánh/hiển thị
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
  if (STATIC) await ofSettingsPull();   // 9b-5: điện thoại nhận cài đặt của máy tính TRƯỚC khi dựng giao diện
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
  await journalLoad(); await ofWallsLoad(); journalSyncSMC(); journalTrack(); renderJournal();
  setInterval(pollState, STATIC ? 120000 : 20000);
  setInterval(ofSync, 3000);   // 9b-5: ghi lệnh/cài đặt/tường lên máy chủ (PC) · cập nhật trạng thái lệnh (điện thoại)
  if (STATIC) setInterval(async () => { try { await journalLoad(); await ofSettingsPull(); await ofWallsLoad(); ofSync(); } catch { } }, 120000);
  if (STATIC) setInterval(() => { staticRecompute(); renderProfile(); renderAgent(); renderHedge(); drawOverlay(); }, 30000);
  setInterval(() => { renderMacro(); renderEngineChip(); renderAgent(); }, 30000);
}
boot();

// ═══════ 9b-5b: TIÊU ĐỀ CÁC KHUNG BÊN PHẢI ĐỨNG YÊN KHI CUỘN (chỉ phần nội dung cuộn). Áp cho mọi <section class="panel"> trong cột phải (mọi trang),
// và hàng nút tab của «Kế hoạch giao dịch» (#ofTabs) dính ngay dưới tiêu đề. Nền tiêu đề lấy đúng màu nền khung (để chữ cuộn bên dưới không lộ qua). Chỉ đổi cách hiển thị.
(function () {
  try {
    const st = document.createElement("style");
    st.textContent = ".right section.panel > header{position:sticky;top:0;z-index:4}";
    document.head.appendChild(st);
    const opaque = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ""); if (!m) return false; const v = m[1].split(",").map((x) => parseFloat(x)); return v.length < 4 || v[3] >= 0.95; };
    const bgOf = (el) => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (opaque(c)) return c; } return "#0b0e12"; };
    const fix = () => {
      document.querySelectorAll(".right section.panel > header").forEach((h) => { if (h.dataset.stk) return; h.dataset.stk = "1"; const bg = bgOf(h); h.style.backgroundColor = bg; h.style.boxShadow = `0 -12px 0 0 ${bg}, 0 4px 6px -4px rgba(0,0,0,.6)`; });
      const t = document.getElementById("ofTabs"), h = t && t.parentElement ? t.parentElement.querySelector(":scope > header") : null;
      if (t && h) { const top = h.offsetHeight + "px"; if (t.style.top !== top) { t.style.position = "sticky"; t.style.top = top; t.style.zIndex = "3"; t.style.backgroundColor = h.style.backgroundColor || bgOf(t); t.style.paddingTop = "2px"; } }
    };
    fix(); setInterval(fix, 2000);
  } catch (e) { /* chỉ là hiển thị */ }
})();

// B9b5c-3 (25/11): BỎ trang «Vào lệnh» (KH1–KH3, data-pg="3") theo yêu cầu. Code của trang nằm ở file khác nên ở đây chỉ ẨN nút + trang;
// nếu đang mở trang đó thì tự chuyển sang «Vào lệnh OF». Bảng «Bối cảnh thị trường» của trang cũ đã chuyển sang «Vào lệnh OF» (ofCtxExtra).
(function () {
  const css = document.createElement("style");
  css.textContent = '#pgbar button[data-pg="3"],.right > .page[data-pg="3"]{display:none!important}';
  document.head.appendChild(css);
  let n = 0;
  const t = setInterval(() => {
    const bar = document.querySelector("#pgbar"), b3 = bar && bar.querySelector('button[data-pg="3"]');
    if (b3) {
      b3.style.setProperty("display", "none", "important");   // để cột tiêu đề khi «Mở rộng» cũng bỏ qua nút này
      const pg3 = document.querySelector('.right > .page[data-pg="3"]'), b6 = bar.querySelector('button[data-pg="6"]');
      if ((b3.classList.contains("on") || (pg3 && !pg3.hidden)) && b6) b6.click();
    }
    if (++n > 60) clearInterval(t);
  }, 1000);
})();
