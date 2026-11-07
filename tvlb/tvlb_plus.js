/* TVLB+ (phần riêng, không có trong bản Bildol gốc) — v1
   • Menu ẩn bên trái: rê chuột sát mép trái màn hình mới hiện (chụp màn hình gửi người khác sẽ không thấy).
   • Giải thích khi rê chuột (như LP Quant): nút, bảng, ô Agent, Hedge… và các vạch mốc trên chart.
   • Giá nhảy theo từng lệnh khớp (aggTrade) thay vì chờ luồng nến; đếm ngược đóng nến trên chart.
   • Nút copy link web GitHub.
   Chạy sau app.js, dùng chung biến toàn cục của app.js (S, candleS, renderQuote, bigAdd…). */
(function () {
  "use strict";
  const K = "tvlb.plus";
  const P = Object.assign({ tips: true, fast: true, cd: true, grid: true }, (() => { try { return JSON.parse(localStorage.getItem(K) || "{}"); } catch (e) { return {}; } })());
  const save = () => { try { localStorage.setItem(K, JSON.stringify(P)); } catch (e) { } };
  const $1 = (s) => document.querySelector(s);
  const f2 = (x) => (x == null || !isFinite(x) ? "—" : Number(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  // ───────────────────── CSS ─────────────────────
  const css = document.createElement("style");
  css.textContent = `
#tvlbPlus { position: fixed; top: 0; left: 0; height: 100%; width: 8px; z-index: 60; }
#tvlbPlus:hover { width: 290px; }
#tvlbPlus .pm { position: absolute; top: 0; left: 0; height: 100%; width: 280px; box-sizing: border-box; padding: 14px 12px; overflow: auto;
  background: #11161d; border-right: 1px solid #3a4552; box-shadow: 6px 0 18px rgba(0,0,0,.5); transform: translateX(-100%); transition: transform .15s ease; }
#tvlbPlus:hover .pm { transform: none; }
#tvlbPlus h3 { margin: 0 0 8px; font: 700 13px var(--f-label, sans-serif); letter-spacing: .1em; color: #e0a83a; text-transform: uppercase; }
#tvlbPlus .pb { display: block; width: 100%; text-align: left; margin: 0 0 6px; padding: 6px 9px; border-radius: 5px; cursor: pointer;
  background: #1a212b; color: #cfd6df; border: 1px solid #2b3440; font: 500 12.5px var(--f-body, sans-serif); }
#tvlbPlus .pb.on { border-color: #e0a83a; color: #f3d38c; }
#tvlbPlus .pb:hover { border-color: #e0a83a; }
#tvlbPlus .ps { color: #7d8796; font-size: 11px; margin: 10px 0 4px; }
#tvlbTip { position: fixed; z-index: 70; max-width: 560px; max-height: 88vh; overflow: hidden; padding: 9px 11px; border-radius: 6px; background: #0d1117; color: #dfe5ec; border: 1px solid #e0a83a;
  font: 12px/1.5 var(--f-body, sans-serif); pointer-events: none; box-shadow: 0 6px 18px rgba(0,0,0,.55); display: none; }
#tvlbTip b { color: #f3d38c; }
#tvlbCd { position: absolute; right: 64px; bottom: 30px; z-index: 5; padding: 2px 7px; border-radius: 4px; background: #e0a83a; color: #111;
  font: 700 11px var(--f-mono, monospace); pointer-events: auto; cursor: help; }
#tvlbCd[hidden] { display: none; }`;
  document.head.appendChild(css);

  // ───────────────────── menu ẩn bên trái ─────────────────────
  const box = document.createElement("div"); box.id = "tvlbPlus";
  box.innerHTML = `<div class="pm"><h3>TVLB+ · riêng</h3>
    <button class="pb" data-k="tips"></button><button class="pb" data-k="fast"></button><button class="pb" data-k="cd"></button><button class="pb" data-k="grid"></button>
    <div class="ps">Web xem trên điện thoại</div><button class="pb" id="pGh">🌐 Copy link web GitHub</button>
    <div class="ps" id="pGhUrl" style="word-break:break-all"></div>
    <div class="ps">Menu này chỉ hiện khi rê chuột sát mép trái màn hình.</div></div>`;
  document.body.appendChild(box);
  const LBL = { tips: "💡 Giải thích khi rê chuột", fast: "⚡ Giá nhảy theo từng lệnh khớp", cd: "⏱ Đếm ngược đóng nến", grid: "▦ Lưới dọc/ngang trên chart" };
  const syncBtns = () => box.querySelectorAll("[data-k]").forEach((b) => { const k = b.dataset.k; b.textContent = `${LBL[k]}: ${P[k] ? "BẬT" : "TẮT"}`; b.classList.toggle("on", !!P[k]); });
  box.querySelectorAll("[data-k]").forEach((b) => { b.onclick = () => { P[b.dataset.k] = !P[b.dataset.k]; save(); syncBtns(); if (!P.tips) hideTip(); cdTick(); applyGrid(); }; });
  syncBtns();
  function applyGrid() {
    try { const g = { vertLines: { visible: !!P.grid }, horzLines: { visible: !!P.grid } };
      if (typeof chart !== "undefined" && chart) chart.applyOptions({ grid: g }); if (typeof cvdChart !== "undefined" && cvdChart) cvdChart.applyOptions({ grid: g }); } catch (e) { }
  }
  setTimeout(applyGrid, 1500); setTimeout(applyGrid, 5000);
  let WEB = null;
  async function webUrl() {
    if (WEB) return WEB;
    if (window.BILDOL_STATIC) return (WEB = location.href.split("#")[0].split("?")[0]);
    try { const r = await (await fetch("/api/weburl")).json(); WEB = r.url || null; } catch (e) { WEB = null; }
    return WEB;
  }
  webUrl().then((u) => { $1("#pGhUrl").textContent = u || "Chưa có github.txt → chưa có web."; });
  $1("#pGh").onclick = async (e) => {
    const b = e.currentTarget, u = await webUrl();
    if (!u) { b.textContent = "❌ Chưa có link web"; }
    else { try { await navigator.clipboard.writeText(u); b.textContent = "✓ Đã copy link web"; } catch (err) { b.textContent = "Chọn và copy dòng bên dưới"; } }
    setTimeout(() => { b.textContent = "🌐 Copy link web GitHub"; }, 2500);
  };

  // ───────────────────── giải thích khi rê chuột ─────────────────────
  const TIPS = {
    "#lyKey": "Bật/tắt các vạch mốc của <b>GC (CME)</b>: Call Wall (kháng cự Gamma), Put Wall (hỗ trợ Gamma), Gamma Flip, Magnet, Max Pain. Nhãn ghi <b>% độ mạnh</b> của tường so với tường lớn nhất và ΔOI so với phiên trước.",
    "#lyGLD": "Bật/tắt các mốc của <b>GLD</b> (quyền chọn ETF vàng), đã quy đổi về giá XAU theo hệ số XAU/GLD hiện tại.",
    "#lyGex": "Đường cong <b>Net GEX</b> theo giá (bên phải chart): dương = dealer kìm giá (hay đảo chiều tại tường), âm = dealer đẩy theo giá (dễ phá tường). TVLB dùng trọng số kỳ hạn <b>40/40/20</b>.",
    "#lyVP": "Volume Profile phiên: <b>POC</b> (giá khớp nhiều nhất), <b>VAH/VAL</b> (biên vùng giá trị 70%). Giá trong VA → hay đi ngang; ra ngoài VA → dễ chạy xa.",
    "#lySMC": "Lớp SMC của anh Thắng (CL1/CL2 × KB1–KB3): đỉnh/đáy, BOS/CHoCH, vùng chờ lệnh, Premium/Discount, OTE H4.",
    "#lyMk": "Mũi tên tín hiệu trên nến: Options Flow (tại tường) và lệnh SMC đã khớp.",
    "#primarySrc": "Nguồn <b>tường chính</b> dùng cho tín hiệu và Agent: GC (CME, chuẩn) hoặc GLD.",
    "#btnCopyTV": "Copy đoạn dữ liệu <b>TVLB v2</b> để dán tay vào ô “Dữ liệu engine” của indicator TVLB trên TradingView. Thường không cần: lịch 06:20 / 13:35 tự dán.",
    "#btnRefresh": "Tải lại chuỗi quyền chọn GC/GLD ngay (bình thường tự làm mới mỗi 15 phút).",
    "#btnAI": "Gửi trạng thái hiện tại cho AI để lấy <b>nhận định + 3 kịch bản</b> có xác suất. Mỗi lần bấm tốn 1 lượt gọi API.",
    "#tfs": "Khung nến. 4h và 1d gộp từ nến 1h theo giờ FXCM (neo 18:00 New York) để khớp TradingView.",
    "#chipWs": "Trạng thái luồng giá realtime từ Binance (XAUUSDT Futures). Đỏ = mất kết nối, đang tự nối lại.",
    "#chipEngine": "Tuổi dữ liệu Options của engine (lần lấy CME/GLD gần nhất).",
    "#chipSess": "Phiên Mỹ 19:00–23:00 giờ VN — tín hiệu Options Flow chỉ tính trong phiên này (nếu bật).",
    "#chartInfo": "Nguồn tường chính · số strike · tổng Net GEX · chế độ Gamma (+Γ dealer kìm giá / −Γ dealer đẩy giá).",
    "#sigCount": "Số tín hiệu Options Flow và lệnh SMC đã khớp hôm nay.",
    "#cvdVal": "<b>CVD phiên</b>: cộng dồn Delta (mua chủ động − bán chủ động) từ đầu phiên. Đi lên = phe mua chủ động áp đảo.",
    "#cvdDiv": "<b>Phân kỳ CVD</b>: giá tạo đỉnh/đáy mới nhưng CVD không xác nhận → lực yếu, dễ đảo chiều.",
    ".sp h2": "<b>Strike Profile</b>: OI, Volume, GEX, DEX, IV, ΔOI và Greeks theo từng strike quanh giá. Dòng vàng = gần giá nhất; đỏ/xanh đậm = Call Wall / Put Wall.",
    "#tenorSel": "Kỳ hạn dùng cho bảng và vạch vẽ: Mọi kỳ hạn (40/40/20) · Ngắn ≤ 7 ngày · Tháng. Tín hiệu và Agent luôn dùng Mọi kỳ hạn.",
    "#profTabs": "Chọn bể quyền chọn: GC (CME, chuẩn) hoặc GLD (ETF).",
    ".llm h2": "<b>AI phân tích</b>: nhận định + 3 kịch bản có xác suất, dựa trên mốc Options, CVD, DXY, lịch tin. Chỉ chạy khi bấm nút (hoặc lịch nếu bật).",
    "#kpis": "Chỉ số nhanh: IV (rủi ro), hệ số XAU/GLD, Net GEX tổng và chế độ Gamma.",
    ".agent h2": "<b>TVLB Agent</b>: tổng hợp chế độ Gamma, hành vi dealer, lệnh lớn, Hedge LP, mục tiêu và cấu trúc SMC → quyết định WAIT / BUY / SELL.",
    "#decision": "Quyết định của Agent + các thành phần: REGIME (chế độ Gamma), DEALER (dealer sẽ mua/bán thế nào), LỆNH LỚN, HEDGE LP, TARGET (Magnet/pin), CONVICTION (−1…+1).",
    "#fusion": "<b>FUSION</b>: gộp tape (dòng lệnh), DXY và kéo về target thành 1 điểm thiên hướng (−1 bán … +1 mua).",
    "#outlook": "Kế hoạch SMC hiện tại (CL1 đánh hồi / CL2 đánh thuận) và vùng chờ.",
    "#macro": "Vĩ mô: DXY, US10Y, lãi suất — DXY tăng thường gây áp lực lên vàng.",
    "#news": "Lịch tin đỏ USD sắp tới — tránh vào lệnh sát giờ tin.",
    ".hedgep h2": "<b>Rebalance Hedge LP</b>: số hợp đồng GC mà LP phải MUA/BÁN khi giá đi ±ΔP. −Γ (đỏ) = LP hedge cùng chiều giá → giá gia tốc; +Γ (xanh) = LP hedge ngược chiều → giá bị hãm. ≥ 1.000 HĐ/10$ là cỡ LP lớn.",
    ".journal h2": "<b>Nhật ký & Thống kê</b>: tự ghi lệnh SMC/Options Flow đã khớp và kết quả; tab Backtest SMC chạy lại hệ CL/KB trên nến lịch sử.",
    ".acct h2": "<b>Account · Paper</b>: tài khoản giả lập để tập vào lệnh theo tín hiệu, không phải tiền thật.",
    "#autoTrade": "Tự mở lệnh Paper khi có tín hiệu mới (chỉ giả lập).",
    "#oSig": "Điền SL/TP theo tín hiệu hiện tại.",
    ".hist h2": "<b>Lịch sử giao dịch</b> của tài khoản Paper; Xuất CSV để phân tích thêm.",
    "#pgbar": "Chuyển trang. Mỗi hàng có nút ⤢ để phóng to, ⇕ để chia đều lại.",
  };
  const LVL = {
    call_wall: ["Call Wall", "Strike có <b>OI Call lớn nhất</b> phía trên giá → kháng cự Gamma; dealer bán ra khi giá tiến lên. Giá hay bị chặn/đảo chiều ở đây khi Gamma dương."],
    put_wall: ["Put Wall", "Strike có <b>OI Put lớn nhất</b> phía dưới giá → hỗ trợ Gamma; dealer mua vào khi giá rơi xuống. Thủng Put Wall khi Gamma âm → dễ rơi mạnh."],
    gex_call_wall: ["Call Wall theo GEX", "Strike có <b>Call GEX lớn nhất</b> (OI × Gamma × giá²) — kháng cự tính theo lực hedge thực tế, trọng số 40/40/20."],
    gex_put_wall: ["Put Wall theo GEX", "Strike có <b>Put GEX lớn nhất</b> — hỗ trợ tính theo lực hedge thực tế, trọng số 40/40/20."],
    gamma_flip: ["Gamma Flip", "Ranh giới Gamma: <b>trên Flip</b> dealer kìm giá (đánh hồi 2 biên); <b>dưới Flip</b> dealer đẩy theo giá (không bắt đáy, đi theo xu hướng)."],
    magnet: ["Magnet", "Strike có Net GEX lớn nhất — giá hay bị <b>hút về / ghim</b> quanh đây, nhất là gần giờ đáo hạn."],
    max_pain: ["Max Pain", "Giá đáo hạn khiến người mua quyền chọn lỗ nhiều nhất — lực hút yếu, rõ hơn ở kỳ sắp đáo hạn."],
  };
  const tip = document.createElement("div"); tip.id = "tvlbTip"; document.body.appendChild(tip);
  let mx = 0, my = 0;
  function showTip(html) { if (!P.tips || !html) return hideTip(); tip.innerHTML = html; tip.style.display = "block"; place(); }
  function hideTip() { tip.style.display = "none"; }
  function place() { const r = tip.getBoundingClientRect(); let x = mx + 14, y = my + 16;
    if (x + r.width > innerWidth - 6) x = mx - r.width - 14; if (y + r.height > innerHeight - 6) y = my - r.height - 14; tip.style.left = Math.max(4, x) + "px"; tip.style.top = Math.max(4, y) + "px"; }
  function applyTips() {
    Object.entries(TIPS).forEach(([sel, html]) => document.querySelectorAll(sel).forEach((el) => {
      el.dataset.ptip = html;
      // nút bật/tắt trong <label>: gắn cho cả label
      const lb = el.closest("label"); if (lb) lb.dataset.ptip = html;
    }));
  }
  applyTips();
  let lastTip = 0;
  document.addEventListener("mousemove", (e) => {
    mx = e.clientX; my = e.clientY;
    if (!P.tips) return;
    if (Date.now() - lastTip < 40) { if (tip.style.display === "block") place(); return; }   // nhẹ máy: tối đa ~25 lần/giây
    lastTip = Date.now();
    try { const x = window.tvlbTipX && window.tvlbTipX(e); if (x) return showTip(x); } catch (err) { }
    const el = e.target.closest && e.target.closest("[data-ptip],[title]");
    if (el && el.closest("#tvlbPlus") == null) {
      if (el.dataset.ptip) { if (el.title) { el.dataset.ptitle = el.title; el.removeAttribute("title"); } return showTip(el.dataset.ptip); }
      if (el.title) { el.dataset.ptip = esc2(el.title).replace(/\n/g, "<br>"); el.dataset.ptitle = el.title; el.removeAttribute("title"); return showTip(el.dataset.ptip); }
    }
    hideTip();
  }, { passive: true });
  document.addEventListener("mouseleave", hideTip);
  function esc2(s) { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

  // ───────────────────── giá nhảy theo từng lệnh khớp ─────────────────────
  let lastT = 0, pend = null;
  function tickPrice(raw) {
    if (!P.fast || !S.candles || !S.candles.length || typeof candleS === "undefined") return;
    const p = raw + (S.basis || 0), c = S.candles[S.candles.length - 1], sec = TF_SEC[S.tf] || 900, now = Date.now() / 1000;
    if (!c || now >= c.time + sec || now < c.time) return;           // nến mới chưa mở → để luồng nến xử lý
    c.close = p; if (p > c.high) c.high = p; if (p < c.low) c.low = p;
    pend = c;
    if (Date.now() - lastT < 120) return;                             // vẽ tối đa ~8 lần/giây
    lastT = Date.now();
    try { candleS.update(shift(pend)); renderQuote(); } catch (e) { }
  }
  if (typeof bigAdd === "function") {
    const orig = bigAdd;
    // eslint-disable-next-line no-global-assign
    bigAdd = function (tMs, price, qty, sellAggr, id) { try { tickPrice(price); } catch (e) { } return orig.apply(this, arguments); };
  }

  // ───────────────────── đếm ngược đóng nến ─────────────────────
  const cd = document.createElement("div"); cd.id = "tvlbCd"; cd.hidden = true;
  cd.dataset.ptip = "Thời gian còn lại tới khi <b>nến hiện tại đóng</b>. Tín hiệu xác nhận (râu nến, Delta, phá vùng) chỉ tính khi nến đã đóng.";
  ($1("#chartWrap") || document.body).appendChild(cd);
  const DOW = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
  function nextOpen(t) { for (let x = Math.ceil(t / 900) * 900, i = 0; i < 1000; i++, x += 900) if (SMC.fxOpen(x)) return x; return null; }
  function cdTick() {
    if (!P.cd || !S.candles || !S.candles.length) { cd.hidden = true; return; }
    const nowS = Date.now() / 1000;
    if (typeof SMC !== "undefined" && SMC.fxOpen && !SMC.fxOpen(Math.floor(nowS / 60) * 60)) {   // vàng nghỉ: cuối tuần / 17–18h New York
      const no = nextOpen(nowS), d = no ? new Date(no * 1000) : null;
      cd.textContent = `⏸ Vàng ĐÓNG CỬA${d ? ` · mở lại ${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} ${DOW[d.getDay()]}` : ""}`;
      cd.style.background = "#ffb300"; cd.dataset.ptip = "Thị trường vàng đang <b>nghỉ</b> (FXCM/CME: nghỉ cuối tuần từ 17:00 thứ 6 đến 18:00 Chủ nhật New York, và 17:00–18:00 New York mỗi ngày). Binance vẫn chạy 24/7 nhưng nến ngoài giờ bị bỏ để khớp TradingView. Đồng hồ hiện giờ mở cửa lại theo giờ máy.";
      cd.hidden = false; return;
    }
    cd.style.background = ""; cd.dataset.ptip = "Thời gian còn lại tới khi <b>nến hiện tại đóng</b>. Tín hiệu xác nhận (râu nến, Delta, phá vùng) chỉ tính khi nến đã đóng.";
    const c = S.candles[S.candles.length - 1], sec = TF_SEC[S.tf] || 900, left = Math.round(c.time + sec - Date.now() / 1000);
    if (left <= 0 || left > sec) { cd.hidden = true; return; }
    const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60), s = left % 60;
    cd.textContent = `⏱ ${S.tf} ${h ? h + ":" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`; cd.hidden = false;
  }
  setInterval(cdTick, 1000);

  // ───────────────────── mở rộng ngang: kéo vạch chia chart | bảng, nút ⇔ cho từng bảng trong hàng 2 bảng ─────────────────────
  (function widen() {
    const st2 = document.createElement("style");
    st2.textContent = `.right { position: relative; }
#tvlbSplit { position: absolute; left: -8px; top: 0; bottom: 0; width: 6px; cursor: col-resize; z-index: 6; border-radius: 3px; }
#tvlbSplit:hover, #tvlbSplit.on { background: rgba(224,168,58,.45); }
.duo[data-wide="0"] { grid-template-columns: minmax(0, 1fr) !important; } .duo[data-wide="0"] > :nth-child(2) { display: none !important; }
.duo[data-wide="1"] { grid-template-columns: minmax(0, 1fr) !important; } .duo[data-wide="1"] > :nth-child(1) { display: none !important; }
.wx { background: transparent; color: var(--muted, #7d8796); border: 1px solid var(--line, #2b3440); border-radius: 4px; padding: 0 6px; font-size: 12px; line-height: 20px; cursor: pointer; margin-left: 4px; }
.wx:hover { color: #e0a83a; border-color: #e0a83a; }
.panel > header > .wx { margin-left: auto; } .panel > header > .wx + .mx { margin-left: 4px; }
@media (max-width: 1250px) { #tvlbSplit { display: none; } }`;
    document.head.appendChild(st2);
    const grid = $1("main.grid"), aside = $1(".right"); if (!grid || !aside) return;
    const W = (() => { try { return JSON.parse(localStorage.getItem("tvlb.wide") || "{}"); } catch (e) { return {}; } })();
    const saveW = () => { try { localStorage.setItem("tvlb.wide", JSON.stringify(W)); } catch (e) { } };
    const setCols = () => { if (W.right && innerWidth > 1250) grid.style.gridTemplateColumns = `minmax(0, 1fr) ${Math.round(W.right)}px`; else grid.style.gridTemplateColumns = ""; };
    setCols(); addEventListener("resize", setCols);
    const sp = document.createElement("div"); sp.id = "tvlbSplit"; sp.dataset.ptip = "Kéo sang trái / phải để nới rộng bảng bên phải hoặc chart. Bấm đúp để về mặc định."; aside.appendChild(sp);
    sp.addEventListener("pointerdown", (e) => { e.preventDefault(); sp.classList.add("on"); sp.setPointerCapture(e.pointerId);
      const mv = (ev) => { const r = grid.getBoundingClientRect(); W.right = Math.max(380, Math.min(r.width - 420, r.right - ev.clientX - 16)); setCols(); };
      const up = () => { sp.classList.remove("on"); sp.removeEventListener("pointermove", mv); sp.removeEventListener("pointerup", up); saveW(); window.dispatchEvent(new Event("resize")); };
      sp.addEventListener("pointermove", mv); sp.addEventListener("pointerup", up); });
    sp.addEventListener("dblclick", () => { delete W.right; saveW(); setCols(); window.dispatchEvent(new Event("resize")); });
    // nút ⇔ trên mỗi bảng trong hàng có 2 bảng: bảng đó chiếm hết bề ngang hàng, bấm lại để chia đôi
    document.querySelectorAll(".right .duo").forEach((duo, di) => {
      const key = "d" + di; if (W[key] != null) duo.dataset.wide = W[key];
      [...duo.children].forEach((pn, i) => { const h = pn.querySelector(":scope > header"); if (!h) return;
        const b = document.createElement("button"); b.type = "button"; b.className = "wx";
        const sync = () => { b.textContent = duo.dataset.wide === String(i) ? "⇆" : "⇔"; b.dataset.ptip = duo.dataset.wide === String(i) ? "Chia đôi lại với bảng bên cạnh" : "Mở rộng bảng này hết bề ngang (ẩn bảng bên cạnh)"; };
        b.onclick = (e) => { e.stopPropagation(); if (duo.dataset.wide === String(i)) { delete duo.dataset.wide; delete W[key]; } else { duo.dataset.wide = String(i); W[key] = String(i); }
          saveW(); duo.querySelectorAll(".wx").forEach((x) => x._sync && x._sync()); window.dispatchEvent(new Event("resize")); };
        b._sync = sync; sync(); const mx2 = h.querySelector(".mx"); h.insertBefore(b, mx2 || null); });
    });
  })();

  // ───────────────────── chart mượt khi kéo / cuộn (như LP Quant) ─────────────────────
  // Bản gốc vẽ lại lớp tường/nhãn mỗi 400 ms → khi kéo chart các vạch "chạy theo không kịp". Vẽ lại ngay ở khung hình kế tiếp
  // mỗi khi chart đổi khung nhìn / di chuột / cuộn, và vẽ liên tục thêm 0,6 s sau khi thả chuột (quán tính cuộn).
  let rq = false, until = 0;
  const kick = () => { if (rq) return; rq = true; requestAnimationFrame(() => { rq = false; try { drawOverlay(); } catch (e) { } }); };
  const loop = () => { kick(); if (Date.now() < until) requestAnimationFrame(loop); };
  const burst = () => { const go = Date.now() >= until; until = Date.now() + 600; if (go) loop(); };
  (function hook(n) {
    try {
      if (typeof chart === "undefined" || !chart || !chart.timeScale) throw 0;
      chart.timeScale().subscribeVisibleLogicalRangeChange(kick);
      chart.subscribeCrosshairMove(kick);
      const cw = $1("#chartWrap");
      ["wheel", "pointerdown", "pointerup", "touchmove"].forEach((ev) => cw.addEventListener(ev, burst, { passive: true }));
      cw.addEventListener("pointermove", (e) => { if (e.buttons) burst(); }, { passive: true });
    } catch (e) { if (n < 60) setTimeout(() => hook(n + 1), 500); }
  })(0);
})();
