/* TVLB+ · ĐỢT 3 (phần riêng, port từ TVL Quant v17.5) — chạy trên dữ liệu TVLB
   ① SMC Tradinghub: cấu trúc (BoS/CHoCH, HH/LL, IDM, quét x, zigzag, chấm đỉnh/đáy) + tín hiệu Pro / Sweep M / Sweep sw.
   ② Tín hiệu LP Quant: B/S tại tường (6 tường), OF·HEDGE, OF·H-TRAP, Hợp lưu Option + SMC — chấm điểm 0–100, hạng A/B/C.
   ③ Lớp vẽ chart riêng (canvas thứ 2): vùng KH1–3, hộp SL/TP + mã lệnh K1-xxxx, ký hiệu tín hiệu, cấu trúc SMC Tradinghub.
   ④ Trang ④ "Tín hiệu · Phản ứng": tín hiệu gần nhất, backtest theo loại / hạng + so sánh 5 cách chốt lời, phản ứng giá tại tường,
      nhật ký live (tự ghi) + đường Equity.
   ⑤ Cảnh báo âm thanh + Telegram (bot của bạn qua máy chủ TVLB): KH xác nhận / vào vùng, tín hiệu hạng A–B, vùng Hedge, phân kỳ CVD, tin đỏ.
   Tín hiệu Option Flow gốc của anh Thắng giữ nguyên; phần này là một họ tín hiệu RIÊNG để so sánh. */
(function () {
  "use strict";
  // 7l số 127 (phần 2): điện thoại vuốt ngang bảng bị nhảy về đầu. Nguyên nhân: các khung (trang ④/⑤ mỗi 2 giây, Hedge/Nhật ký/Strike Profile mỗi 30 giây trên bản web) gán lại innerHTML nên bảng bị tạo MỚI → thanh cuộn về 0.
  // (1) mỗi lần gán innerHTML: nhớ vị trí cuộn của các phần tử con đang cuộn lệch, gán xong đặt lại đúng chỗ đó; (2) 7 khung vẽ lại định kỳ: nội dung y hệt lần trước thì không gán lại. Không đổi số liệu nào.
  (function () {
    try {
      const d = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
      if (!d || !d.set || d.set.__tvlb127) return;
      const set = d.set, KEEP = new Set(["t4sig", "t4bt", "t5cmp", "t4rx", "t4fw", "hedgeOut", "jOut"]), SC = new Set();
      document.addEventListener("scroll", (ev) => { const e = ev.target; if (!e || e.nodeType !== 1) return; if (e.scrollLeft || e.scrollTop) SC.add(e); else SC.delete(e); if (SC.size > 300) SC.forEach((x) => { if (!x.isConnected) SC.delete(x); }); }, true);
      const patched = function (v) {
        let saved = null;
        try {
          if (this.id && KEEP.has(this.id)) { const t = String(v); if (this.__h127 === t && this.firstChild) return; this.__h127 = t; }
          if (SC.size) {
            saved = [];
            SC.forEach((e) => {
              if (!e.isConnected) { SC.delete(e); return; }
              if (e !== this && !this.contains(e)) return;
              const path = []; let n = e;
              while (n && n !== this) { const p = n.parentNode; if (!p) { n = null; break; } path.push(Array.prototype.indexOf.call(p.children, n)); n = p; }
              if (n === this) saved.push([path.reverse(), e.scrollLeft, e.scrollTop]);
            });
          }
        } catch (err) { saved = null; }
        set.call(this, v);
        if (saved && saved.length) {
          try { for (const [path, l, t] of saved) { let e = this; for (const i of path) e = e && e.children[i]; if (e) { if (l) e.scrollLeft = l; if (t) e.scrollTop = t; } } } catch (err) { }
        }
      };
      patched.__tvlb127 = true;
      Object.defineProperty(Element.prototype, "innerHTML", { configurable: true, enumerable: d.enumerable, get: d.get, set: patched });
    } catch (e) { }
  })();
  const f2 = (x) => (x == null || !isFinite(x) ? "—" : Number(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const f0 = (x) => (x == null || !isFinite(x) ? "—" : Math.round(x).toLocaleString("en-US"));
  const sg = (x, f = f2) => (x == null || !isFinite(x) ? "—" : (x >= 0 ? "+" : "−") + f(Math.abs(x)));
  const st_ = { get(k, d) { try { const v = localStorage.getItem("tvlb." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem("tvlb." + k, JSON.stringify(v)); } catch (e) { } } };
  const ZONE = 4, SLU = 3;
  const O = Object.assign({ thSt: true, thSg: true, sig: true, kh: true, box: true, snd: true, tg: true, tout: 36,
    k: { wall: true, oh: true, oht: true, conf: true, pro: true, m: true, sw: true }, minG: "C", kh1: true, kh2: true, kh3: true,
    tpm: "auto", boxn: 3, slmax: 0, al: { kh: true, khz: true, sig: true, hedge: true, div: true, news: true }, sty: "beep", vol: 60, diff: true, minor: true, topn: 10, wst: 1, wh: true }, st_.get("o3", {}));
  ["k", "al"].forEach((k) => { O[k] = Object.assign({}, { k: { wall: true, oh: true, oht: true, conf: true, pro: true, m: true, sw: true }, al: { kh: true, khz: true, sig: true, hedge: true, div: true, news: true } }[k], O[k] || {}); });
  window.TVLB_MINOR = O.minor !== false; window.TVLB_TOPN = O.topn || 10; window.TVLB_WALLSTYLE = O.wst === 2 ? "old" : "tvlb";   // 7h: cách vẽ tường (1 = kiểu hiện tại, 2 = nhãn một cột); "old"/"tvlb" chỉ là tên nội bộ cho app.js
  // B9b5c-3 (25/11): bỏ trang «Vào lệnh» → tắt hẳn vùng KH1–3 / hộp K1-xxxx / cảnh báo KH và tín hiệu B/S · OF·H · H-T. Giữ HL (Hợp lưu, sẽ gộp vào «Vào lệnh OF») + SMC hub.
  O.kh = false; O.al.kh = false; O.al.khz = false; O.k.wall = false; O.k.oh = false; O.k.oht = false;
  const saveO = () => st_.set("o3", O);
  // ───────────────────── SMC TRADINGHUB (port nguyên bản từ TVL Quant) ─────────────────────
  const SMCO = { st: true, sg: true, bc: true, hl: true, mzz: true, izz: false, idm: true, lidm: true, swm: true, swi: true, dot: true, idot: false, tri: true, otri: true, sbox: true, of: false, pro: true, m: true, sw: true };
  const smcOn = (k) => (["pro", "m", "sw", "pidm"].includes(k) ? O.thSg && SMCO[k === "pidm" ? "pro" : k] : O.thSt && SMCO[k]);
  const SMC_BUF = 1.0;
  const SMC_COL = { pro: ["#00bfff", "#ff5252"], m: ["#00e676", "#ff1744"], sw: ["#00bfa5", "#ff7043"], star: ["#ffa726", "#ffa726"], flip: ["#00e5ff", "#ff4081"], scob: ["#00e676", "#ffd600"] };
  const SMC_NAME = { pro: "Pro tiếp diễn", m: "Sweep cấu trúc chính (M)", sw: "Sweep internal (sw)" };
  let TH = null, bars = [];
  const HTF = { tf: null, bars: [], at: 0 };
function proOF(B) {
  const out = []; let zd = 1, zp = null, rH = null, rL = null, liH = null, liHt = 0, liL = null, liLt = 0, zt = 0;
  let iH1 = null, iH2 = null, iL1 = null, iL2 = null, pH = null, pL = null, hB = false, lB = false;
  let legB = null, legS = null, swB = null, swS = null, stB = 0, idB = null, trB = null, trBt = null, stS = 0, idS = null, trS = null, trSt = null;
  let od = 0, oT = null, oB = null, o1 = null, oid = 0;
  B.forEach((b, i) => { const o = b.open, h = b.high, l = b.low, c = b.close, t = b.time;
    let jH = false, jL = false;
    if (i === 0) { zp = h; zt = t; rH = h; rL = l; }
    else if (!(h <= rH && l >= rL)) { const pRH = rH, pRL = rL, ob = h > rH && l < rL; rH = h; rL = l;
      if (ob) { if (c > o) { if (zd === 1) { liH = zp; liHt = zt; jH = true; } zp = l; zt = t; liL = zp; liLt = zt; jL = true; zd = 1; zp = h; zt = t; }
                else { if (zd === -1) { liL = zp; liLt = zt; jL = true; } zp = h; zt = t; liH = zp; liHt = zt; jH = true; zd = -1; zp = l; zt = t; } }
      else if (zd === 1) { if (h > zp) { zp = h; zt = t; } else if (l < pRL) { liH = zp; liHt = zt; jH = true; zd = -1; zp = l; zt = t; } }
      else { if (l < zp) { zp = l; zt = t; } else if (h > pRH) { liL = zp; liLt = zt; jL = true; zd = 1; zp = h; zt = t; } } }
    if (jH) { iH2 = iH1; iH1 = liH; } if (jL) { iL2 = iL1; iL1 = liL; }
    const up = iH2 != null && iL2 != null && iH1 > iH2 && iL1 > iL2, dn = iH2 != null && iL2 != null && iH1 < iH2 && iL1 < iL2;
    const cH = pH != null && liH !== pH, cL = pL != null && liL !== pL;
    hB = cH ? false : (liH != null && c > liH) ? true : hB; lB = cL ? false : (liL != null && c < liL) ? true : lB;
    if ((stS === 1 && c < trS) || (stS === 2 && hB && liH > idS)) { stS = 0; legS = null; }
    if (cL && iH1 != null && iL1 != null && dn && !(stS === 2 && c < trS) && (legS == null || liL <= legS)) { legS = liL; idS = iH1; stS = 1; trS = liL; trSt = liLt; swS = null; }
    if (stS === 1 && idS != null && h > idS) { stS = 2; swS = h; } else if (stS === 2) swS = Math.max(swS, h);
    if ((stB === 1 && c > trB) || (stB === 2 && lB && liL < idB)) { stB = 0; legB = null; }
    if (cH && iH1 != null && iL1 != null && up && !(stB === 2 && c > trB) && (legB == null || liH >= legB)) { legB = liH; idB = iL1; stB = 1; trB = liH; trBt = liHt; swB = null; }
    if (stB === 1 && idB != null && l < idB) { stB = 2; swB = l; } else if (stB === 2) swB = Math.min(swB, l);
    const fS = stS === 2 && trS != null && c < trS, fB = stB === 2 && trB != null && c > trB;
    if (fB) { od = 1; oT = trB; oB = swB; o1 = trBt; oid = t; stB = 0; legB = null; swB = null; }
    if (fS) { od = -1; oT = swS; oB = trS; o1 = trSt; oid = t; stS = 0; legS = null; swS = null; }
    out.push({t, c, od, oT, oB, o1, oid}); pH = liH; pL = liL; });
  return out;
}
function smcCalc() {
  const n = bars.length - 1;   // chỉ tính trên nến ĐÃ ĐÓNG (giống barstate.isconfirmed)
  const R = {n, lines: [], labels: [], mzz: [], izz: [], dots: [], idots: [], of: [], hof: [], sig: [], st: {}, tr: [], itr: [], ofd: [], swH: [], swL: [], triL: [], triH: []};
  TH = R; if (n < 30) return;
  const csec = TF_SEC[S.tf] || 2592000, hsec = HTF.tf ? TF_SEC[HTF.tf] : 0, HO = HTF.tf ? proOF(HTF.bars) : [];
  const hBox = [];   // hộp Orderflow HTF
  HO.forEach((s, k) => { hBox.forEach(bx => { if (bx.kb == null && k > bx.k0 && ((bx.dir === 1 && s.c < bx.bot) || (bx.dir === -1 && s.c > bx.top))) bx.kb = k; });
    if (s.oid && (!k || s.oid !== HO[k - 1].oid)) hBox.push({k0: k, top: s.oT, bot: s.oB, dir: s.od, t1: s.o1, kb: null}); });
  let hk = -1;
  const hAct = () => hBox.filter(bx => bx.k0 <= hk).slice(-10).filter(bx => bx.kb == null || bx.kb > hk);
  const LN = (key, i0, i1, p, col, dash, txt, pos, w) => R.lines.push({key, i0, i1, p, col, dash, txt, pos, w: w || 1});
  const SG = (kind, dir, i, i0, lvl, sl, txt, why) => R.sig.push({kind, dir, i, i0, lvl, sl, txt, why: why || [], t: bars[i].time, e: bars[i].close});
  // ---- trạng thái cấu trúc chính ----
  let top, bot, puUp, puDn, puUpbar = 0, puDnbar = 0, L, H, Lbar = 0, Hbar = 0, idmB, idmS, idmBb = 0, idmSb = 0;
  let lastH, lastL, lastHH, lastLL, lastHb = 0, lastLb = 0, lastHHb = 0, lastLLb = 0, BU = false, BD = false, CU = true, CD = true;
  let dIb = null, dIbb = null, dIbS = false, dIs = null, dIsb = null, dIsS = false, mz = {i: 0, p: (bars[0].high + bars[0].low) / 2, t: 0}, uTr = 0, hubTr = 0;
  // ---- internal ----
  let zd = 1, zp, zpi = 0, rH, rL, seg = null, ciH = null, ciHb = 0, ciL = null, ciLb = 0, iH1 = null, iH2 = null, iL1 = null, iL2 = null, hBrk = false, lBrk = false, swIH = -1, swIL = -1;
  // ---- Pro / Orderflow / Flip / BW-SW / ★ ----
  let pSB = 0, pSS = 0, plB = null, plS = null, pxB = null, pxS = null, piB = null, piS = null, piBi = 0, piSi = 0, ptB = null, ptS = null, ptBi = 0, ptSi = 0, psBi = 0, psSi = 0;
  let aDir = 0, aTop = null, aBot = null, aTi = 0, aTopB = 0, aBotB = 0, aFlip = false, aExt = null, aExtB = 0;
  const of = R.of;
  let mSW = {p: false}, mBW = {p: false}, iSW = {p: false}, iBW = {p: false}, lastScS = 0, lastScB = 0, wL = false, wH = false;
  let atr = null, trSum = 0;
  for (let i = 0; i < n; i++) {
    const b = bars[i], o = b.open, h = b.high, l = b.low, c = b.close, pb = bars[i - 1], pb2 = bars[i - 2];
    if (i === 0) { top = h; bot = l; puUp = h; puDn = l; L = l; H = h; idmB = l; idmS = h; lastH = h; lastL = l; lastHH = h; lastLL = l; }
    while (hk + 1 < HO.length && HTF.bars[hk + 1].time + hsec <= b.time + csec) hk++;
    const of1 = hk >= 0 ? HO[hk] : {od: 0};
    const tr = i ? Math.max(h - l, Math.abs(h - pb.close), Math.abs(l - pb.close)) : h - l;
    if (i < 14) { trSum += tr; if (i === 13) atr = trSum / 14; } else atr = (atr * 13 + tr) / 14;
    const lastHL = Math.max(Hbar, Lbar), prv = [lastHH, lastLL, lastH, lastL], prvTr = uTr, prvH = ciH, prvL = ciL;
    let gSH = false, gSL = false, gISH = false, gISL = false;
    const IDM = bs => LN('idm', bs ? idmBb : idmSb, i, bs ? idmB : idmS, bs ? '#00bfff' : '#ef5350', [1, 3], 'IDM', bs ? 'below' : 'above');
    const cfHL = isH => { const bi = isH ? Hbar : Lbar, p = isH ? H : L, ct = isH ? 1 : -1;
      R.labels.push({key: 'hl', i: bi, p, txt: isH ? (H === lastHH ? 'HH' : 'LH sell') : (L === lastLL ? 'LL' : 'LL buy'), col: '#9e9e9e', pos: isH ? 'above' : 'below'});
      if (mz.t !== ct) R.mzz.push([mz.i, mz.p, bi, p]); mz = {i: bi, p, t: ct}; };
    const TRI = (bi, p, up) => { const arr = up ? R.triL : R.triH, opp = up ? R.triH : R.triL; if (arr.some(t => t.i === bi)) return; arr.push({i: bi, p, up}); while (arr.length > 2) arr.shift(); opp.length = 0; };
    const BC = (bos, up) => LN('bc', bos ? (up ? lastHHb : lastLLb) : (up ? lastHb : lastLb), i, bos ? (up ? lastHH : lastLL) : (up ? lastH : lastL),
      up ? '#e0e0e0' : '#ff5252', [5, 3], bos ? (up ? 'BoS ↑' : 'BoS ↓') : (up ? 'CHoCH ↑' : 'CHoCH ↓'), up ? 'above' : 'below');
    const SW = (isH, rr) => LN('swm', isH ? (rr ? lastHHb : lastHb) : (rr ? lastLb : lastLLb), i, isH ? (rr ? lastHH : lastH) : (rr ? lastL : lastLL), '#9e9e9e', [1, 2], 'x', 'center');
    // ===== ENGINE 1: cấu trúc chính =====
    if (h > lastH) { if (l < bot && c > o) { if (l < idmB && lastHL !== Lbar) { IDM(true); cfHL(true); BU = false; L = l; Lbar = i; } idmB = l; idmBb = i; } else { idmB = puDn; idmBb = puDnbar; } }
    if (l < lastL) { if (h > top && c < o) { if (h > idmS && lastHL !== Hbar) { IDM(false); cfHL(false); BD = false; H = h; Hbar = i; } idmS = h; idmSb = i; } else { idmS = puUp; idmSb = puUpbar; } }
    if (CU && lastHL !== Lbar) { if (l < idmB) { if (idmB !== lastL) IDM(true); BU = false; if (h > lastH && c < o) { H = h; Hbar = i; }
        lastH = H; lastHb = Hbar; lastHH = H; lastHHb = Hbar; cfHL(true); L = l; Lbar = i; } }
    else if (lastH !== lastHH && h > lastH) { if (c > lastH) { BC(false, true); R.dots.push({i: Lbar, p: L, up: true}); TRI(Lbar, L, true); cfHL(false); CD = false; BD = false; CU = true; } else { SW(true, false); gSH = true; } }
    if (CD && lastHL !== Hbar) { if (h > idmS) { if (idmS !== lastH) IDM(false); BD = false; if (l < lastL && c > o) { L = l; Lbar = i; }
        lastL = L; lastLb = Lbar; lastLL = L; lastLLb = Lbar; cfHL(false); H = h; Hbar = i; } }
    else if (l < lastL && lastL !== lastLL) { if (c < lastL) { BC(false, false); R.dots.push({i: Hbar, p: H, up: false}); TRI(Hbar, H, false); cfHL(true); CD = true; CU = false; BU = false; } else { SW(false, true); gSL = true; } }
    if (!BU && h > lastHH) { if (c > lastHH) { BC(true, true); R.dots.push({i: Lbar, p: L, up: true}); TRI(Lbar, L, true); cfHL(false); lastL = L; lastLb = Lbar; CU = true; BU = true; CD = false; BD = false; } else { SW(true, true); gSH = true; } }
    if (!BD && l < lastLL) { if (c < lastLL) { BC(true, false); R.dots.push({i: Hbar, p: H, up: false}); TRI(Hbar, H, false); cfHL(true); lastH = H; lastHb = Hbar; CU = false; BU = false; CD = true; BD = true; } else { SW(false, false); gSL = true; } }
    const eqh = h > top, eql = l < bot;
    if (eqh) { puUp = h; puUpbar = i; } if (eql) { puDn = l; puDnbar = i; top = h; bot = l; } if (eqh) { top = h; bot = l; }
    if (h > H) { H = h; Hbar = i; dIb = idmB; dIbb = idmBb; dIbS = false; }
    if (dIb != null && l <= dIb) dIbS = true;
    if (h > idmS) { idmS = h; idmSb = i; } if (h > lastH) { lastH = h; lastHb = i; } if (h > lastHH) { lastHH = h; lastHHb = i; }
    if (l < L) { L = l; Lbar = i; dIs = idmS; dIsb = idmSb; dIsS = false; }
    if (dIs != null && h >= dIs) dIsS = true;
    if (l < idmB) { idmB = l; idmBb = i; } if (l < lastL) { lastL = l; lastLb = i; } if (l < lastLL) { lastLL = l; lastLLb = i; }
    uTr = (BU || CU) ? 1 : (BD || CD) ? -1 : 0; hubTr = uTr || hubTr;
    const newSt = i > 0 && [lastHH, lastLL, lastH, lastL].some((v, k) => v !== prv[k]), chTr = i > 0 && uTr !== prvTr;
    // ===== ENGINE internal (zigzag theo nến không nằm trong) =====
    let jH = false, jL = false;
    if (i === 0) { zp = h; zpi = 0; rH = h; rL = l; }
    else if (!(h <= rH && l >= rL)) { const pRH = rH, pRL = rL, ob = h > rH && l < rL; rH = h; rL = l;
      const ns = (i0, p0) => { seg = [i0, p0, zpi, zp]; R.izz.push(seg); }, ext = () => { if (seg) { seg[2] = zpi; seg[3] = zp; } };
      const cH = () => { ciH = zp; ciHb = zpi; jH = true; zd = -1; zp = l; zpi = i; ns(ciHb, ciH); }, cL = () => { ciL = zp; ciLb = zpi; jL = true; zd = 1; zp = h; zpi = i; ns(ciLb, ciL); };
      if (ob) { if (c > o) { if (zd === 1) cH(); else { zp = l; zpi = i; ext(); } cL(); } else { if (zd === -1) cL(); else { zp = h; zpi = i; ext(); } cH(); } }
      else if (zd === 1) { if (h > zp) { zp = h; zpi = i; ext(); } else if (l < pRL) cH(); }
      else { if (l < zp) { zp = l; zpi = i; ext(); } else if (h > pRH) cL(); } }
    if (jH) { iH2 = iH1; iH1 = ciH; R.idots.push({i: ciHb, p: ciH, up: false}); } if (jL) { iL2 = iL1; iL1 = ciL; R.idots.push({i: ciLb, p: ciL, up: true}); }
    const iUp = iH2 != null && iL2 != null && iH1 > iH2 && iL1 > iL2, iDn = iH2 != null && iL2 != null && iH1 < iH2 && iL1 < iL2;
    const chH = prvH != null && ciH !== prvH, chL = prvL != null && ciL !== prvL;
    // quét thanh khoản internal (chữ x)
    if (chH) hBrk = false; if (chL) lBrk = false;
    if (ciH != null && c > ciH) hBrk = true; if (ciL != null && c < ciL) lBrk = true;
    if (ciH != null && !hBrk && h > ciH && c <= ciH) { gISH = true; if (swIH !== ciHb) { LN('swi', ciHb, i, ciH, '#8d8d8d', [1, 2], 'x', 'center'); swIH = ciHb; } }
    if (ciL != null && !lBrk && l < ciL && c >= ciL) { gISL = true; if (swIL !== ciLb) { LN('swi', ciLb, i, ciL, '#8d8d8d', [1, 2], 'x', 'center'); swIL = ciLb; } }
    // ===== Pro: tiếp diễn thuận xu hướng (pullback hợp lệ phải quét IDM internal) =====
    if (chTr) { pSB = 0; pSS = 0; plB = plS = pxB = pxS = null; }
    if (pSS > 0) { if (c > lastH) { pSS = 0; plS = null; } if (pSS === 1 && c < ptS) { pSS = 0; plS = null; } if (pSS === 2 && hBrk && ciH > piS) { pSS = 0; plS = null; } }
    if (chL && iH1 != null && iL1 != null && iDn && !(pSS === 2 && c < ptS) && (plS == null || ciL <= plS)) { plS = ciL; piS = iH1; piSi = ciHb; pSS = 1; ptS = ciL; ptSi = ciLb; pxS = null; }
    if (pSS === 1 && piS != null && h > piS) { pSS = 2; psSi = i; pxS = h; LN('pidm', piSi, i, piS, SMC_COL.pro[1], [1, 2], '$', 'center'); }
    if (pSS === 2 && h >= pxS) { pxS = h; psSi = i; }
    if (pSB > 0) { if (c < lastL) { pSB = 0; plB = null; } if (pSB === 1 && c > ptB) { pSB = 0; plB = null; } if (pSB === 2 && lBrk && ciL < piB) { pSB = 0; plB = null; } }
    if (chH && iH1 != null && iL1 != null && iUp && !(pSB === 2 && c > ptB) && (plB == null || ciH >= plB)) { plB = ciH; piB = iL1; piBi = ciLb; pSB = 1; ptB = ciH; ptBi = ciHb; pxB = null; }
    if (pSB === 1 && piB != null && l < piB) { pSB = 2; psBi = i; pxB = l; LN('pidm', piBi, i, piB, SMC_COL.pro[0], [1, 2], '$', 'center'); }
    if (pSB === 2 && l <= pxB) { pxB = l; psBi = i; }
    // ===== Pro: KÍCH HOẠT TRỰC TIẾP (bản SMC Hub Core — không qua bộ lọc) =====
    if (pSS === 2 && ptS != null && c < ptS) {
      SG('pro', -1, i, ptSi, ptS, pxS + SMC_BUF, 'Sell', [`Cấu trúc internal LH–LL (giảm): đáy internal ${f2(ptS)} vừa xác nhận`, `Sóng hồi quét IDM ($) ${f2(piS)} → pullback hợp lệ, đỉnh quét ${f2(pxS)}`,
        `Nến đóng ${f2(c)} dưới đáy internal ${f2(ptS)} → kích hoạt Sell tiếp diễn`]);
      pSS = 0; plS = null; pxS = null; }
    if (pSB === 2 && ptB != null && c > ptB) {
      SG('pro', 1, i, ptBi, ptB, pxB - SMC_BUF, 'Buy', [`Cấu trúc internal HH–HL (tăng): đỉnh internal ${f2(ptB)} vừa xác nhận`, `Sóng hồi quét IDM ($) ${f2(piB)} → pullback hợp lệ, đáy quét ${f2(pxB)}`,
        `Nến đóng ${f2(c)} trên đỉnh internal ${f2(ptB)} → kích hoạt Buy tiếp diễn`]);
      pSB = 0; plB = null; pxB = null; }
    // ===== BW / SW: sweep rồi đóng nến phá đáy/đỉnh internal gần nhất =====
    if (gSH) mSW = {p: true, l: ciL, i: ciLb, inv: h}; if (gSL) mBW = {p: true, l: ciH, i: ciHb, inv: l};
    if (gISH) iSW = {p: true, l: ciL, i: ciLb, inv: h}; if (gISL) iBW = {p: true, l: ciH, i: ciHb, inv: l};
    [mSW, iSW].forEach(s => { if (s.p && h > s.inv) s.p = false; }); [mBW, iBW].forEach(s => { if (s.p && l < s.inv) s.p = false; });
    const inside = i > 0 && h <= pb.high && l >= pb.low;
    [[mSW, 'm', 'Sell M'], [iSW, 'sw', 'Sell sw']].forEach(([s, k, t]) => { if (s.p && s.l != null && c < s.l && !inside) { SG(k, -1, i, s.i, s.l, s.inv + SMC_BUF, t, [`Quét ${k === 'm' ? 'đỉnh CẤU TRÚC CHÍNH' : 'đỉnh INTERNAL'}: râu lên ${f2(s.inv)} rồi đóng lại bên dưới`, `Nến đóng ${f2(c)} dưới đáy internal gần nhất ${f2(s.l)} → xác nhận đảo chiều`, 'Nến không nằm trong nến trước (không inside bar)', `Huỷ nếu giá vượt đỉnh quét ${f2(s.inv)}`]); s.p = false; s.l = null; } });
    [[mBW, 'm', 'Buy M'], [iBW, 'sw', 'Buy sw']].forEach(([s, k, t]) => { if (s.p && s.l != null && c > s.l && !inside) { SG(k, 1, i, s.i, s.l, s.inv - SMC_BUF, t, [`Quét ${k === 'm' ? 'đáy CẤU TRÚC CHÍNH' : 'đáy INTERNAL'}: râu xuống ${f2(s.inv)} rồi đóng lại bên trên`, `Nến đóng ${f2(c)} trên đỉnh internal gần nhất ${f2(s.l)} → xác nhận đảo chiều`, 'Nến không nằm trong nến trước (không inside bar)', `Huỷ nếu giá thủng đáy quét ${f2(s.inv)}`]); s.p = false; s.l = null; } });
    R.tr.push(uTr || hubTr); R.itr.push(iUp ? 1 : iDn ? -1 : 0); R.ofd.push(null); R.swH.push(gSH ? 'chính' : gISH ? 'internal' : ''); R.swL.push(gSL ? 'chính' : gISL ? 'internal' : '');
    if (i === n - 1) Object.assign(R.st, {uTr, hubTr, iUp, iDn, lastH, lastL, lastHH, lastLL, lastHb, lastLb, dIb, dIbb, dIbS, dIs, dIsb, dIsS, atr, lastHb_: lastHb, lastLb_: lastLb,
      proB: pSB > 0 ? ptB : null, proBi: ptBi, proS: pSS > 0 ? ptS : null, proSi: ptSi});
  }
  R.hof = [];
}
function drawTH(ctx, plotW, h) {
  if (!TH || !TH.n || (!SMCO.st && !SMCO.sg)) return;
  const ts = chart.timeScale(), X = i => ts.logicalToCoordinate(i), Y = p => candleS.priceToCoordinate(p), ok = (...v) => v.every(x => x != null && isFinite(x));
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, plotW, h); ctx.clip(); ctx.textAlign = 'center';
  const poly = (segs, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
    segs.forEach(s => { const a = X(s[0]), b = Y(s[1]), c = X(s[2]), d = Y(s[3]); if (ok(a, b, c, d)) { ctx.moveTo(a, b); ctx.lineTo(c, d); } }); ctx.stroke(); ctx.lineWidth = 1; };
  if (smcOn('of')) { const bx_ = (bx, i1, fill, txt) => { const x0 = X(bx.i0), x1 = X(i1), y0 = Y(bx.top), y1 = Y(bx.bot); if (!ok(x0, x1, y0, y1)) return;
      ctx.fillStyle = fill; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.strokeStyle = fill.replace(/[\d.]+\)$/, '.6)'); ctx.setLineDash(bx.kb != null ? [4, 3] : []); ctx.strokeRect(x0, y0, x1 - x0, y1 - y0); ctx.setLineDash([]);
      if (bx.kb == null) { ctx.fillStyle = '#e0e0e0'; ctx.font = '600 9.5px sans-serif'; ctx.textAlign = 'right'; ctx.fillText(txt, x1 - 3, bx.dir > 0 ? y0 + 10 : y1 - 3); ctx.textAlign = 'center'; } };
    TH.hof.forEach(bx => bx_(bx, bx.i1 ?? TH.n + 10, bx.dir > 0 ? 'rgba(0,191,255,.10)' : 'rgba(255,82,82,.10)', `Orderflow ${bx.dir > 0 ? 'Buy' : 'Sell'} ${HTF.tf.toUpperCase()}`));
    TH.of.forEach(bx => bx_(bx, bx.kb ?? TH.n + 10, bx.dir > 0 ? 'rgba(19,62,218,.20)' : 'rgba(226,19,19,.20)', `Orderflow ${bx.dir > 0 ? 'Buy' : 'Sell'} ${S.tf}`)); }
  if (smcOn('izz')) poly(TH.izz, 'rgba(255,255,255,.45)', 1);
  if (smcOn('mzz')) poly(TH.mzz, 'rgba(255,215,0,.85)', 2);
  const lineTxt = (x0, x1, y, txt, col, pos, font) => { if (!txt) return; ctx.fillStyle = col; ctx.font = font || '600 10px sans-serif';
    ctx.fillText(txt, (x0 + x1) / 2, pos === 'above' ? y - 8 : pos === 'below' ? y + 15 : y + 3.5); };
  TH.lines.forEach(L => { if (!smcOn(L.key)) return; const x0 = X(L.i0), x1 = X(L.i1), y = Y(L.p); if (!ok(x0, x1, y)) return;
    ctx.strokeStyle = L.col; ctx.lineWidth = L.w; ctx.setLineDash(L.dash); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    lineTxt(x0, x1, y, L.txt, L.col, L.pos); });
  if (smcOn('hl')) { ctx.font = '600 9.5px sans-serif'; TH.labels.forEach(lb => { const x = X(lb.i), y = Y(lb.p); if (!ok(x, y)) return; ctx.fillStyle = lb.col; ctx.fillText(lb.txt, x, lb.pos === 'above' ? y - 10 : y + 17); }); }
  const dots = (arr, col, r) => arr.forEach(d => { const x = X(d.i), y = Y(d.p); if (!ok(x, y)) return; ctx.fillStyle = typeof col === 'function' ? col(d) : col; ctx.beginPath(); ctx.arc(x, d.up ? y + 4 : y - 4, r, 0, 7); ctx.fill(); });
  if (smcOn('dot')) dots(TH.dots, d => d.up ? 'rgba(41,98,255,.85)' : 'rgba(226,19,19,.85)', 3.5);
  if (smcOn('idot')) dots(TH.idots, 'rgba(160,160,160,.8)', 1.8);
  const tri = (x, y, up, col, sz) => { ctx.fillStyle = col; ctx.beginPath(); if (up) { ctx.moveTo(x, y); ctx.lineTo(x - sz, y + sz * 1.6); ctx.lineTo(x + sz, y + sz * 1.6); } else { ctx.moveTo(x, y); ctx.lineTo(x - sz, y - sz * 1.6); ctx.lineTo(x + sz, y - sz * 1.6); } ctx.fill(); };
  // ▲▼ tam giác thuận xu hướng (2 điểm mạnh gần nhất) — như f_add_trend_tri
  if (smcOn('tri')) TH.triL.concat(TH.triH).forEach(t => { const x = X(t.i), y = Y(t.p); if (ok(x, y)) tri(x, t.up ? y + 9 : y - 9, t.up, t.up ? '#00bfff' : '#ff1744', 6); });
  // ⚠ tam giác ngược xu hướng nhấp nháy tại mốc CHoCH
  if (smcOn('otri') && TH.st.hubTr && Math.floor(Date.now() / 600) % 2 === 0) { const up = TH.st.hubTr === 1, bi = up ? TH.st.lastHb_ : TH.st.lastLb_, p = up ? TH.st.lastH : TH.st.lastL, x = X(bi), y = Y(p);
    if (ok(x, y)) tri(x, up ? y - 9 : y + 9, !up, up ? '#ff1744' : '#00bfff', 6); }
  // hộp cấu trúc gần nhất (nét đứt) giữa đỉnh/đáy CHoCH
  if (smcOn('sbox') && TH.st.lastH != null) { const x0 = X(Math.min(TH.st.lastHb_, TH.st.lastLb_)), x1 = X(TH.n + 15), y0 = Y(TH.st.lastH), y1 = Y(TH.st.lastL);
    if (ok(x0, x1, y0, y1)) { ctx.fillStyle = 'rgba(158,158,158,.05)'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.strokeStyle = 'rgba(158,158,158,.45)'; ctx.setLineDash([5, 4]); ctx.strokeRect(x0, y0, x1 - x0, y1 - y0); ctx.setLineDash([]); } }
  if (smcOn('lidm') && TH.st.hubTr) { const up = TH.st.hubTr === 1, p = up ? TH.st.dIb : TH.st.dIs, bi = up ? TH.st.dIbb : TH.st.dIsb, sw = up ? TH.st.dIbS : TH.st.dIsS;
    if (p != null) { const x0 = X(bi), x1 = X(TH.n + 20), y = Y(p), col = up ? '#00bfff' : '#ef5350'; if (ok(x0, x1, y)) { ctx.strokeStyle = col; ctx.setLineDash([1, 3]); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col; ctx.font = '700 10px sans-serif'; ctx.textAlign = 'right'; ctx.fillText(`IDM ${up ? '▲' : '▼'} ${sw ? '✅' : '⏳'}`, x1, up ? y + 12 : y - 4); ctx.textAlign = 'center'; } } }
  // tín hiệu: đường kẻ tại mức kích hoạt + chữ (như bản Pine)
  TH.sig.forEach(s => { if (!smcOn(s.kind) || ['star', 'scob'].includes(s.kind)) return; const col = SMC_COL[s.kind][s.dir > 0 ? 0 : 1], x0 = X(s.i0), x1 = X(s.i), y = Y(s.lvl); if (!ok(x0, x1, y)) return;
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([6, 3]); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    lineTxt(x0, x1, y, s.txt, col, s.dir > 0 ? 'above' : 'below', '600 10.5px sans-serif'); });
  // lệnh Pro đang chờ xác nhận
  if (smcOn('pro')) [['proB', 'proBi', '⏳ Chờ Buy i', 0], ['proS', 'proSi', '⏳ Chờ Sell i', 1]].forEach(([k, ki, t, ci]) => { const p = TH.st[k]; if (p == null) return;
    const x0 = X(TH.st[ki]), x1 = X(TH.n + 15), y = Y(p); if (!ok(x0, x1, y)) return; ctx.strokeStyle = SMC_COL.pro[ci]; ctx.setLineDash([1, 3]); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = SMC_COL.pro[ci]; ctx.font = '600 10px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(window.TVLB_COMPACT ? (ci ? "⏳S" : "⏳B") : t, x1 + 3, y + 3.5);   /* 7o số 140: chế độ gọn */ ctx.textAlign = 'center'; });
  ctx.restore();
}
  // ───────────────────── tín hiệu LP Quant: tường, Hedge, Hợp lưu + chấm điểm ─────────────────────
  const RES = ["CW", "T1", "GCW"], SUP = ["PW", "T2", "GPW"];
  const OPT_W = { CW: 25, PW: 25, GCW: 20, GPW: 20, T1: 15, T2: 15, MAG: 15, MP: 10, FLIP: 10 };
  const KB = { oh: 15, oht: 15, wall: 15, pro: 25, m: 20, sw: 15 };
  const KNAME = { wall: "B/S tại tường Option", oh: "OF·HEDGE (đi theo vùng −Γ)", oht: "OF·H-TRAP (bẫy tại vùng −Γ)", conf: "Hợp lưu Option + SMC", pro: "SMC Pro tiếp diễn", m: "SMC Sweep cấu trúc chính (M)", sw: "SMC Sweep internal (sw)" };
  const KCOL = { wall: ["#26a69a", "#ef5350"], oh: ["#40c4ff", "#ff6e40"], oht: ["#69f0ae", "#ea80fc"], conf: ["#ffd600", "#ffd600"] };
  const kcol = (x) => (KCOL[x.kind] || SMC_COL[x.kind] || ["#ccc", "#ccc"])[x.dir > 0 ? 0 : 1];
  let L = [], SIG = [], spot = null, flipV = null;
  // ── Tường theo TỪNG NGÀY (data/oi_history, /api/wallhist): mỗi nến dùng mốc của bản OI mới nhất đã có TRƯỚC nến đó ──
  const NMH = { CW: "Call Wall", PW: "Put Wall", T1: "Tường phụ 1", T2: "Tường phụ 2", GCW: "GLD Call Wall", GPW: "GLD Put Wall", MAG: "Magnet", FLIP: "Gamma Flip", MP: "Max Pain" };
  let WH = [], whAt = 0, whMemo = new Map(), whErr = "";
  function loadWH() { try { fetch(API("/api/wallhist")).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then((r) => { whErr = r && r.ok ? (r.days && r.days.length ? "" : "empty") : "srv"; if (r && r.ok) { WH = r.days || []; whMemo = new Map(); key = ""; } }).catch(() => { whErr = "old"; key = ""; }); } catch (e) { } whAt = Date.now(); }
  function whLevels(e) {
    const out = [], st = e.strikes || [], c = e.chart || {}, sp = e.underlying * e.ratio, byK = (k) => st.find((x) => Math.abs(x.strike - k) < 1e-6);
    const maxC = Math.max(1, ...st.map((x) => x.call_oi || 0)), maxP = Math.max(1, ...st.map((x) => x.put_oi || 0));
    const mk = (key, strike, x, side) => { if (x == null) return; const s0 = strike != null ? byK(strike) : null, oi = s0 ? (side === "c" ? s0.call_oi : s0.put_oi) : null;
      out.push({ key, name: NMH[key], pool: e.src, xau: x, strike, oi, hard: oi != null ? Math.round((100 * oi) / (side === "c" ? maxC : maxP)) : null, day: e.day }); };
    if (e.src === "GC") { mk("CW", e.call_wall, c.call_wall, "c"); mk("PW", e.put_wall, c.put_wall, "p");
      const t1 = st.filter((x) => x.chart > sp && x.strike !== e.call_wall).sort((a, b) => b.call_oi - a.call_oi)[0], t2 = st.filter((x) => x.chart < sp && x.strike !== e.put_wall).sort((a, b) => b.put_oi - a.put_oi)[0];
      if (t1) mk("T1", t1.strike, t1.chart, "c"); if (t2) mk("T2", t2.strike, t2.chart, "p");
      if (c.gamma_flip != null) out.push({ key: "FLIP", name: NMH.FLIP, pool: "GC", xau: c.gamma_flip, day: e.day });
      if (c.magnet != null) out.push({ key: "MAG", name: NMH.MAG, pool: "GC", xau: c.magnet, day: e.day });
      if (c.max_pain != null) out.push({ key: "MP", name: NMH.MP, pool: "GC", xau: c.max_pain, day: e.day });
    } else { mk("GCW", e.call_wall, c.call_wall, "c"); mk("GPW", e.put_wall, c.put_wall, "p"); }
    return out;
  }
  const whUse = () => O.wh !== false && WH.length > 0;
  function Lat(i) {   // mốc Option áp dụng cho nến i
    if (!whUse()) return L; const b = bars[i]; if (!b) return [];
    const t = b.time, pick = (src) => { let best = null; for (const e of WH) { if (e.src !== src) continue; if (e.avail <= t) best = e; else break; } return best && t - best.avail <= 5 * 86400 ? best : null; };
    const g = pick("GC"), d = pick("GLD"), k = (g ? g.avail : 0) + "|" + (d ? d.avail : 0);
    if (!whMemo.has(k)) whMemo.set(k, (g ? whLevels(g) : []).concat(d ? whLevels(d) : []));
    return whMemo.get(k);
  }
  const flipAt = (i) => (whUse() ? (Lat(i).find((l) => l.key === "FLIP") || {}).xau ?? null : flipV);
  const whInfo = () => { const g = WH.filter((e) => e.src === "GC"), d = WH.filter((e) => e.src === "GLD"), dd = (e) => e && e.day;
    return { n: WH.length, gc: g.length, gld: d.length, from: dd(WH[0]), to: dd(WH[WH.length - 1]), imp: WH.filter((e) => e.imported).length, est: WH.filter((e) => e.ratio_est).length }; };
  const levels = () => { try { return (window.tvlbPlans && window.tvlbPlans().L) || []; } catch (e) { return []; } };
  const cinfo = (i) => { const b = bars[i]; return { up: b.high - Math.max(b.open, b.close), lo: Math.min(b.open, b.close) - b.low, body: Math.abs(b.close - b.open), rng: Math.max(b.high - b.low, 0.01), d: b.delta || 0, b }; };
  const rejSell = (c) => c.up >= Math.max(c.body, 0.4 * c.rng) && c.d < 0, rejBuy = (c) => c.lo >= Math.max(c.body, 0.4 * c.rng) && c.d > 0;
  const hzones = () => (S.state?.hedge?.zones || []).filter((z) => z.kind === "accel");
  const inHedge = (p) => hzones().find((z) => p >= z.lo && p <= z.hi) || null;
  const usSess = (t) => { try { return inUsSession(t); } catch (e) { return false; } };
  function optTouch(i, d) {
    const LL = Lat(i);
    for (let j = i; j >= Math.max(0, i - 2); j--) { const b = bars[j];
      const l = LL.filter((x) => OPT_W[x.key] && (d < 0 ? Math.abs(b.high - x.xau) <= ZONE && x.xau >= b.close - ZONE : Math.abs(b.low - x.xau) <= ZONE && x.xau <= b.close + ZONE)).sort((a, b2) => OPT_W[b2.key] - OPT_W[a.key])[0];
      if (l) return { x: l.xau, n: `${l.pool} – ${l.name}`, w: OPT_W[l.key] || 10, key: l.key }; }
    return null;
  }
  function optNext(e, d, risk, skip, i) {
    const v = S.state?.volume_profile, c = (i != null ? Lat(i) : L).filter((l) => OPT_W[l.key]).map((l) => ({ x: l.xau, n: `${l.pool} ${l.name}` })).concat(v && v.poc != null ? [{ x: v.poc, n: "POC" }] : []);
    const f = c.filter((l) => (l.x - e) * d >= Math.max(3, 0.5 * risk)).sort((a, b) => (a.x - b.x) * d);
    return f[skip || 0] || null;
  }
  function sweepNear(i, d) { if (!TH || !TH.swH.length) return ""; for (let j = i; j >= Math.max(0, i - 2); j--) { const v = d < 0 ? TH.swH[j] : TH.swL[j]; if (v) return v; } return ""; }
  function scoreSig(x) {
    const P = [], add = (v, t) => { if (v) P.push([v, t]); }, i = x.i, d = x.dir, b = bars[i];
    add(KB[x.base || x.kind] || 10, `Loại tín hiệu: ${x.kind === "conf" ? "nền " + KNAME[x.base] : KNAME[x.kind]}`);
    if (x.kind === "conf") add(10, "Hai hệ thống độc lập (Option + SMC) cùng xác nhận");
    const ot = x.ot || optTouch(i, d); x.ot = ot;
    if (ot) add(ot.w, `Mốc Option: ${ot.n} ${f2(ot.x)} được chạm đúng phía`); else add(-5, "Không ở gần mốc Option nào");
    const sw = sweepNear(i, d); if (sw) add(10, `SMC quét thanh khoản ${d < 0 ? "đỉnh" : "đáy"} ${sw} trong 3 nến gần nhất`);
    if (TH && TH.tr[i] != null) { const t = TH.tr[i]; if (t) { const rev = ["m", "sw"].includes(x.base || x.kind), pro = (x.base || x.kind) === "pro";
        add(t === d ? 15 : rev ? 0 : pro ? -25 : -10, `Cấu trúc chính ${t === 1 ? "TĂNG" : "GIẢM"} → ${t === d ? "cùng" : "ngược"} hướng lệnh${t !== d && rev ? " (Sweep = bắt đảo chiều: không trừ)" : ""}`); }
      const it = TH.itr[i]; if (it) add(it === d ? 10 : -5, `Cấu trúc internal ${it === 1 ? "tăng" : "giảm"} → ${it === d ? "cùng" : "ngược"} hướng`); }
    const tr_ = TH && TH.tr[i];
    const flipV = flipAt(i);
    if (flipV != null) { if (b.close >= flipV) add(5, `Gamma dương (giá trên Flip ${f2(flipV)}): dealer kìm giá → tín hiệu tại mốc đáng tin hơn`);
      else if (tr_ && tr_ !== d) add(-10, `Gamma âm (giá dưới Flip ${f2(flipV)}): lệnh ngược xu hướng rủi ro`); else add(5, "Gamma âm: lệnh thuận xu hướng được ưu tiên"); }
    const hz = inHedge(b.close);
    if (hz) { if (tr_ && tr_ === d) add(5, `Trong Vùng Hedge ${f2(hz.lo)}–${f2(hz.hi)}: lệnh THUẬN xu hướng → đi theo đà`); else add(-15, `Trong Vùng Hedge ${f2(hz.lo)}–${f2(hz.hi)}: biến động mở rộng → bắt ngược rủi ro cao`); }
    const dl = b.delta || 0; if (dl) add(Math.sign(dl) === d ? 5 : -5, `Delta nến ${sg(dl, f0)} ${Math.sign(dl) === d ? "cùng" : "ngược"} hướng`);
    if (usSess(b.time)) add(5, "Trong phiên Mỹ 19–23h (thanh khoản cao)");
    if (i >= bars.length - 3) { const dx = S.state?.macro?.DXY?.chg_n_pct; if (dx != null && Math.abs(dx) >= 0.03) add(Math.sign(-dx) === d ? 5 : -5, `DXY ${sg(dx, (v) => v.toFixed(3))}%/5p → ${Math.sign(-dx) === d ? "ủng hộ" : "ngược"} hướng`); }
    const risk = Math.max(Math.abs(b.close - x.sl), 0.01), nx = optNext(b.close, d, risk, 0, i);
    if (nx) { const rr = Math.abs(nx.x - b.close) / risk; add(rr >= 2 ? 10 : rr >= 1.5 ? 5 : -10, `Mốc kế tiếp ${nx.n} ${f2(nx.x)} → R:R ${rr.toFixed(1)}${rr < 1.5 ? " (dư địa hẹp)" : ""}`); }
    x.P = P; x.sc = Math.max(0, Math.min(100, P.reduce((s, p) => s + p[0], 0))); x.grade = x.sc >= 70 ? "A" : x.sc >= 50 ? "B" : "C";
  }
  function buildSignals() {
    const n = bars.length - 1, W = [], Hs = [];
    for (let i = 21; i < n; i++) { const b = bars[i], c = cinfo(i), got = {}, walls = Lat(i).filter((l) => RES.includes(l.key) || SUP.includes(l.key));
      walls.forEach((l) => [-1, 1].forEach((d) => { if (got[d]) return;
        const ok = d < 0 ? RES.includes(l.key) && Math.abs(b.high - l.xau) <= ZONE && rejSell(c) : SUP.includes(l.key) && Math.abs(b.low - l.xau) <= ZONE && rejBuy(c);
        if (!ok) return; got[d] = 1; const px = d < 0 ? b.high : b.low;
        W.push({ kind: "wall", dir: d, i, t: b.time, e: b.close, sl: d < 0 ? Math.max(b.high, l.xau) + SLU : Math.min(b.low, l.xau) - SLU, label: `${l.pool} – ${l.name}`, wday: l.day, ot: { x: l.xau, n: `${l.pool} – ${l.name}`, w: OPT_W[l.key] || 10 },
          why: [`${l.pool} – ${l.name} ${f2(l.xau)}: ${d < 0 ? "đỉnh" : "đáy"} nến ${f2(px)} cách tường ${f2(Math.abs(px - l.xau))}$ (≤ ${ZONE}$)`,
            d < 0 ? `Râu trên ${f2(c.up)} ≥ max(thân ${f2(c.body)}, 40% biên độ ${f2(0.4 * c.rng)}) → từ chối giá cao` : `Râu dưới ${f2(c.lo)} ≥ max(thân ${f2(c.body)}, 40% biên độ ${f2(0.4 * c.rng)}) → từ chối giá thấp`,
            `Delta nến ${sg(c.d, f0)} ${d < 0 ? "< 0: bán chủ động thắng" : "> 0: mua chủ động thắng"}`] }); })); }
    const zs = hzones();
    for (let i = 21; i < n && zs.length; i++) { const b = bars[i], c0 = bars[i - 2].close, c1 = bars[i - 1].close, c2 = b.close, dl = b.delta || 0, dl2 = dl + (bars[i - 1].delta || 0);
      zs.forEach((z) => { const inz = (x) => x >= z.lo && x <= z.hi;
        if (inz(c1) && inz(c2) && !inz(c0)) { const d = c2 > c0 ? 1 : -1; if (Math.sign(dl2) !== d) return;
          const lo = Math.min(bars[i - 1].low, b.low), hi = Math.max(bars[i - 1].high, b.high);
          Hs.push({ kind: "oh", dir: d, i, t: b.time, e: c2, sl: d > 0 ? lo - SLU : hi + SLU, label: `OF·HEDGE ${f2(z.lo)}–${f2(z.hi)}`,
            why: [`2 nến đóng trong Vùng Hedge −Γ ${f2(z.lo)}–${f2(z.hi)} sau khi ${d > 0 ? "vào từ dưới lên" : "vào từ trên xuống"} → LP phải ${d > 0 ? "MUA" : "BÁN"} đuổi, giá dễ gia tốc`, `Delta 2 nến ${sg(dl2, f0)} cùng hướng ✓`] }); return; }
        const fromBelow = c1 < z.lo && b.high >= z.lo && c2 < z.lo, fromAbove = c1 > z.hi && b.low <= z.hi && c2 > z.hi;
        if (fromBelow || fromAbove) { const d = fromBelow ? -1 : 1, c = cinfo(i), rej = d < 0 ? c.up >= 0.4 * c.rng : c.lo >= 0.4 * c.rng; if (!(Math.sign(dl) === d || rej)) return;
          Hs.push({ kind: "oht", dir: d, i, t: b.time, e: c2, sl: d < 0 ? b.high + SLU : b.low - SLU, label: `OF·H-TRAP ${f2(z.lo)}–${f2(z.hi)}`,
            why: [`Nến chọc ${fromBelow ? "lên" : "xuống"} vào Vùng Hedge −Γ ${f2(z.lo)}–${f2(z.hi)} rồi đóng ngược ra ngoài ${f2(c2)} → hedge không kích hoạt được, phe đuổi giá bị bẫy`,
              Math.sign(dl) === d ? `Delta nến ${sg(dl, f0)} xác nhận ✓` : `Râu ${d < 0 ? "trên" : "dưới"} ≥ 40% biên độ → từ chối ✓`] }); } }); }
    const Sg = TH && TH.sig ? TH.sig.map((s) => Object.assign({}, s, { label: "SMC " + s.txt })) : [];
    const conf = {}, addC = (base, x, extra, ot) => { const k = x.i + "_" + x.dir;
      if (conf[k]) { conf[k].why.push(...extra); if (!conf[k].bases.includes(base)) conf[k].bases.push(base); return; }
      conf[k] = { kind: "conf", base, bases: [base], dir: x.dir, i: x.i, t: x.t, e: x.e, sl: x.sl, ot, why: extra.slice() }; };
    Sg.forEach((s) => { const ot = optTouch(s.i, s.dir); if (ot) addC(s.kind, s, [`<b>① SMC ${s.txt}</b> (${SMC_NAME[s.kind]}):`, ...s.why.map((w) => "· " + w), `<b>② Option:</b> ${ot.n} ${f2(ot.x)} bị chạm trong 3 nến gần nhất, đúng phía`], ot); });
    W.forEach((w) => { const sw = sweepNear(w.i, w.dir); if (sw) addC("wall", w, [`<b>① Option:</b> B/S tại ${w.label}:`, ...w.why.map((x) => "· " + x), `<b>② SMC:</b> quét thanh khoản ${w.dir < 0 ? "đỉnh" : "đáy"} ${sw} trong 3 nến gần nhất`], w.ot); });
    Object.values(conf).forEach((x) => { x.label = "Hợp lưu " + x.bases.map((b) => (b === "wall" ? "Tường" : { pro: "Pro", m: "Sweep M", sw: "Sweep sw" }[b])).join(" + "); });
    SIG = W.concat(Sg, Hs, Object.values(conf)).sort((a, b) => a.i - b.i);
    SIG.forEach(scoreSig);
    const gOk = (g) => (O.minG === "A" ? g === "A" : O.minG === "B" ? g !== "C" : true);
    SIG = SIG.filter((x) => O.k[x.kind] !== false && gOk(x.grade) && (!O.slmax || Math.abs(x.e - x.sl) <= O.slmax));
  }
  // ───────────────────── MỌI tín hiệu trên dashboard (để thống kê chung) ─────────────────────
  const FAM = { of: "Option Flow", tip: "SMC Tip", wall: "Tường Option B/S", oh: "OF·HEDGE (đi theo vùng −Γ)", oht: "OF·H-TRAP (bẫy vùng −Γ)", conf: "Hợp lưu Option + SMC", pro: "SMC hub · Pro tiếp diễn", m: "SMC hub · Sweep cấu trúc chính (M)", sw: "SMC hub · Sweep internal (sw)" };
  const famOf = (x) => (x.kind === "of" || x.kind === "tip" ? `${FAM[x.kind]} · ${x.sub}` : FAM[x.kind] || x.kind);
  let ALL = [];
  function replayOF() {   // tín hiệu Option Flow (bản Bildol) chạy lại trên mọi nến đang xem, cùng luật evaluate()
    const out = []; if (typeof evaluate !== "function" || !S.cfg) return out; const save = S.lastSigIdx; S.lastSigIdx = -1e9;
    try { for (let i = 0; i < bars.length - 1; i++) { const s0 = evaluate(i, false); if (!s0) continue; S.lastSigIdx = i;
        const sub = s0.type.replace("[Options Flow] ", "").replace(/:.*$/, "").replace(/ \(.*$/, "").replace(/ \d.*$/, "").trim();
        out.push({ kind: "of", sub, dir: s0.side === "BUY" ? 1 : -1, i, t: bars[i].time, e: s0.entry, sl: s0.sl, label: `Option Flow · ${s0.type.replace("[Options Flow] ", "")} (${s0.score}/${s0.max})`, why: Object.entries(s0.conf || {}).map(([k, v]) => `${v ? "✓" : "✗"} ${k}`) }); } }
    catch (e) { } finally { S.lastSigIdx = save; }
    return out;
  }
  function tipOrders() {   // lệnh SMC Tip (CL/KB) đã khớp: vào tại giá LIMIT ở nến khớp
    return (S.smc?.orders || []).filter((o) => o.status !== "skip" && o.fillI != null && bars[o.fillI]).map((o) => ({ kind: "tip", sub: `${o.name} ${o.side}`, dir: o.side === "BUY" ? 1 : -1, i: o.fillI, t: bars[o.fillI].time, e: o.entry, sl: o.sl, label: `SMC Tip · ${o.name} ${o.side}`, why: [o.why || ""] }));
  }
  function buildAll() { ALL = SIG.concat(replayOF(), tipOrders()).filter((x) => !O.slmax || Math.abs(x.e - x.sl) <= O.slmax).sort((a, b) => a.i - b.i); }
  // ───────────────────── backtest + 5 cách chốt lời ─────────────────────
  const TPM = { auto: "Tự động theo Gamma", part: "Chốt 2 phần (mốc 1 + 2)", w1: "Mốc Option kế tiếp", w2: "Mốc Option thứ 2", r15: "Cố định 1.5R" };
  function sim(x, mode) {
    const d = x.dir, e = x.e, sl0 = x.sl, risk = Math.abs(e - sl0); if (!(risk > 0)) return null;
    const n1 = optNext(e, d, risk, 0, x.i), n2 = optNext(e, d, risk, 1, x.i), fv = flipAt(x.i);
    let m = mode || O.tpm; if (m === "auto") m = fv != null && e >= fv ? "w1" : "part";
    const tp1 = m === "r15" ? e + 1.5 * risk * d : n1 ? n1.x : e + 2 * risk * d, tp2 = n2 ? n2.x : tp1 + risk * d;
    let sl = sl0, half = false, rAcc = 0;
    const end = Math.min(bars.length - 1, x.i + 1 + (O.tout || 36));
    for (let j = x.i + 1; j < end; j++) { const b = bars[j], hitSL = d < 0 ? b.high >= sl : b.low <= sl;
      if (m === "part") {
        if (hitSL) return { res: half ? "W" : "L", r: half ? rAcc : -1, j, half };
        if (!half && (d < 0 ? b.low <= tp1 : b.high >= tp1)) { half = true; rAcc = 0.5 * Math.abs(tp1 - e) / risk; sl = e; }
        if (half && (d < 0 ? b.low <= tp2 : b.high >= tp2)) return { res: "W", r: rAcc + 0.5 * Math.abs(tp2 - e) / risk, j, half: true };
      } else {
        const tp = m === "w2" ? tp2 : tp1;
        if (hitSL) return { res: "L", r: -1, j };
        if (d < 0 ? b.low <= tp : b.high >= tp) return { res: "W", r: Math.abs(tp - e) / risk, j };
      } }
    if (end >= bars.length - 1 && x.i + 1 + (O.tout || 36) > bars.length - 1) return { res: "O", r: ((bars[bars.length - 1].close - e) * d) / risk, j: null };
    const last = bars[end - 1] || bars[x.i]; return { res: "T", r: (half ? rAcc : 0) + ((last.close - e) * d) / risk * (half ? 0.5 : 1), j: end - 1 };
  }
  function statsOf(list) {
    const c = list.filter((r) => r && r.res !== "O"); let R = 0, pk = 0, dd = 0; const w = c.filter((r) => r.res === "W").length, l = c.filter((r) => r.res === "L").length, t = c.filter((r) => r.res === "T").length;
    c.forEach((r) => { R += r.r; pk = Math.max(pk, R); dd = Math.max(dd, pk - R); });
    const gw = c.filter((r) => r.r > 0).reduce((a, r) => a + r.r, 0), gl = -c.filter((r) => r.r < 0).reduce((a, r) => a + r.r, 0), avg = c.length ? R / c.length : null;
    const sd = c.length > 1 ? Math.sqrt(c.reduce((a, r) => a + (r.r - avg) ** 2, 0) / (c.length - 1)) : null, nw = c.filter((r) => r.r > 0).length, nl = c.filter((r) => r.r < 0).length;
    return { n: list.length, closed: c.length, w, l, t, half: c.filter((r) => r.half).length, wr: w + l ? (100 * w) / (w + l) : null, R, avg, dd, pf: gl > 0 ? gw / gl : gw > 0 ? Infinity : null, sd, aw: nw ? gw / nw : null, al: nl ? -gl / nl : null };
  }
  // ───────────────────── phản ứng giá tại tường ─────────────────────
  let RX = [];
  function calcRx() {
    const W = L.filter((l) => ["CW", "PW", "T1", "T2", "GCW", "GPW", "MAG", "FLIP"].includes(l.key)), n = bars.length - 1, out = [];
    W.forEach((l) => { let last = -99;
      for (let i = 1; i < n; i++) { const b = bars[i], pc = bars[i - 1].close, x = l.xau;
        if (!(b.low <= x + ZONE && b.high >= x - ZONE) || Math.abs(pc - x) <= ZONE || i - last < 6) continue;
        last = i; const from = pc > x ? 1 : -1;   // 1 = từ trên xuống (thử hỗ trợ) · −1 = từ dưới lên (thử kháng cự)
        let res = "Đang theo dõi", mv = 0, pen = Math.max(0, from > 0 ? x - b.low : b.high - x);
        for (let j = i; j < Math.min(n, i + 12); j++) { const k = bars[j]; pen = Math.max(pen, from > 0 ? x - k.low : k.high - x);
          if (from > 0 ? k.close < x - ZONE : k.close > x + ZONE) { res = "Bị phá"; break; }
          mv = Math.max(mv, from > 0 ? k.high - x : x - k.low); if (mv >= 3 * ZONE) { res = "Bật lại"; break; } }
        if (res === "Đang theo dõi" && i + 12 < n) res = "Đi ngang";
        out.push({ key: l.key, nm: `${l.pool} – ${l.name}`, x, t: b.time, from, res, mv, pen }); } });
    RX = out;
  }
  window.tvlbRxFor = (x) => RX.filter((r) => Math.abs(r.x - x) < 0.6 && r.res !== "Đang theo dõi");
  // ───────────────────── nhật ký live (tự ghi tín hiệu lúc xuất hiện) ─────────────────────
  let FWD = st_.get("fwd", []);
  function fwdUpdate() {
    const n = bars.length - 1; let ch = false;
    ALL.filter((x) => x.i === n - 1).forEach((x) => { const id = `${x.kind}|${x.sub || ""}|${x.dir}|${S.tf}|${x.t}`; if (FWD.some((f) => f.id === id)) return;
      FWD.push({ id, kind: x.kind, fam: famOf(x), label: x.label, dir: x.dir, t: x.t, tf: S.tf, e: x.e, sl: x.sl, sc: x.sc, grade: x.grade }); ch = true;
      if (x.grade && x.grade !== "C" && O.al.sig) alert3(`s${id}${x.dir < 0 ? "-1" : ""}`, `${x.label} ${x.dir < 0 ? "SELL" : "BUY"} hạng ${x.grade} (${x.sc}/100) khung ${S.tf} @ ${f2(x.e)} — SL ${f2(x.sl)}`); });
    FWD.forEach((f) => { if (f.res || f.tf !== S.tf) return; const i0 = bars.findIndex((b) => b.time === f.t); if (i0 < 0) return;
      const r = sim({ i: i0, dir: f.dir, e: f.e, sl: f.sl }); if (r && r.res !== "O") { f.res = r.res; f.r = +r.r.toFixed(2); f.xt = r.j != null ? bars[r.j].time : null; ch = true; } });
    if (ch) { FWD = FWD.slice(-3000); st_.set("fwd", FWD); }
  }
  // ───────────────────── cảnh báo âm thanh + Telegram ─────────────────────
  const ALD = st_.get("aldone", {});
  let actx = null;
  const SND = { beep: [[880, 0, 0.12], [880, 0.18, 0.12]], chime: [[660, 0, 0.18], [990, 0.2, 0.3]], down: [[990, 0, 0.18], [660, 0.2, 0.3]], siren: [[700, 0, 0.25, 1200], [1200, 0.27, 0.25, 700]], bell: [[1320, 0, 0.5]] };
  function beep(down, sty, text) {
    sty = sty || O.sty; if (!O.snd || sty === "mute") return;
    if (sty === "voice") { try { const u = new SpeechSynthesisUtterance(String(text || "TVLB cảnh báo").replace(/[^\p{L}\p{N}\s.,:%+\-–]/gu, " ").slice(0, 160)); u.lang = "vi-VN"; u.volume = O.vol / 100; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { } return; }
    if (O.diff && sty === "beep") sty = down ? "down" : "chime";
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume();
      (SND[sty] || SND.beep).forEach(([f, t, d, f2_]) => { const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime + t; o.frequency.setValueAtTime(f, t0); if (f2_) o.frequency.linearRampToValueAtTime(f2_, t0 + d);
        o.connect(g); g.connect(actx.destination); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.3 * O.vol / 100 + 0.0001, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.start(t0); o.stop(t0 + d + 0.02); }); } catch (e) { }
  }
  function alert3(key, text) {
    if (ALD[key] && Date.now() - ALD[key] < 30 * 60e3) return; ALD[key] = Date.now();
    const ks = Object.keys(ALD); if (ks.length > 400) ks.slice(0, ks.length - 400).forEach((k) => delete ALD[k]); st_.set("aldone", ALD);
    if (key[0] === "k" && !O.al.kh) return;
    beep(/-1$/.test(key), null, text);
    if (O.tg && !window.BILDOL_STATIC) fetch("/api/tg", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, text: "🔔 TVLB+ " + new Date().toLocaleTimeString("vi-VN", { hour12: false }) + "\n" + text }) }).catch(() => { });
    try { if (window.Notification && Notification.permission === "granted") new Notification("TVLB+", { body: text, tag: key }); } catch (e) { }
  }
  window.tvlbAlert = alert3;
  let lastPlanSt = {}, lastHz = null, lastDiv = null;
  function alertChecks() {
    try { const P = window.tvlbPlans ? window.tvlbPlans().PLANS : [];
      P.forEach((p) => { const prev = lastPlanSt[p.id]; if (O.al.khz && (p.st === "TRONG VÙNG" || p.st === "ĐANG THỬ PHÁ") && prev && prev !== p.st)
        alert3(`z${p.id}${Math.round(p.z.lo)}${p.d < 0 ? "-1" : ""}`, `Giá ${f2(spot)} vào vùng ${p.id} ${f2(p.z.lo)}–${f2(p.z.hi)} (${p.z.nm}) — ${p.role}: chờ nến đóng xác nhận`); lastPlanSt[p.id] = p.st; }); } catch (e) { }
    const hz = inHedge(spot); if (hz && lastHz !== hz.lo && O.al.hedge) alert3(`h${Math.round(hz.lo)}`, `Giá ${f2(spot)} vào VÙNG HEDGE ${f2(hz.lo)}–${f2(hz.hi)} → biến động mở rộng, không bắt đáy/đỉnh vội`); lastHz = hz ? hz.lo : null;
    try { const n = bars.length - 2, d = divAt(n); const k = d.bear ? "bear" : d.bull ? "bull" : null; if (k && lastDiv !== k + bars[n].time && O.al.div) alert3(`d${k}${bars[n].time}`, `CVD ${k === "bear" ? "PHÂN KỲ GIẢM" : "PHÂN KỲ TĂNG"} khung ${S.tf}`); lastDiv = k ? k + bars[n].time : lastDiv; } catch (e) { }
    (S.state?.calendar || []).forEach((nw) => { const m = (new Date(nw.time).getTime() - Date.now()) / 60000; if (m > 0 && m <= 30 && O.al.news) alert3(`n${nw.time}${m <= 5 ? "b" : "a"}`, `Tin đỏ USD sau ${Math.ceil(m)} phút: ${nw.title}`); });
  }

  // ───────────────────── lớp vẽ riêng (canvas thứ 2, không đụng lớp của bản gốc) ─────────────────────
  const wrap = document.querySelector("#chartWrap"); if (!wrap) return;
  const cv = document.createElement("canvas"); cv.className = "ov"; cv.id = "ov3"; cv.style.zIndex = 6; wrap.appendChild(cv);
  const cx = cv.getContext("2d"); let dpr = 1;
  const fit = () => { const r = wrap.getBoundingClientRect(); dpr = window.devicePixelRatio || 1; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); cv.style.width = r.width + "px"; cv.style.height = r.height + "px"; draw(); };
  new ResizeObserver(fit).observe(wrap);
  function draw() {
    try {
      cx.setTransform(dpr, 0, 0, dpr, 0, 0); const W = cv.width / dpr, Hh = cv.height / dpr; cx.clearRect(0, 0, W, Hh);
      if (document.body.classList.contains("tvlb-shot") || typeof chart === "undefined" || !bars.length) return;
      const psW = chart.priceScale("right").width() || 70, plotW = W - psW, plotH = Hh - 28, ts = chart.timeScale();
      const X = (i) => ts.logicalToCoordinate(i), Y = (p) => candleS.priceToCoordinate(p), ok = (...v) => v.every((x) => x != null && isFinite(x));
      cx.save(); cx.beginPath(); cx.rect(0, 0, plotW, plotH); cx.clip();
      // B9b5c-3: đã bỏ vẽ vùng KH1–3 và hộp SL/TP + mã lệnh K1-xxxx (trang «Vào lệnh» đã bỏ)
      // hộp SL/TP của tín hiệu LP Quant (lệnh gần nhất + N lệnh trước, theo cách chốt lời đang chọn)
      if (O.box && O.boxn >= 0 && O.sig) { const L2 = SIG.slice(-(O.boxn === 999 ? 1e9 : O.boxn + 1));
        L2.forEach((x) => { const r = sim(x); if (!r) return; const risk = Math.abs(x.e - x.sl), n1 = optNext(x.e, x.dir, risk, 0, x.i), tp = O.tpm === "r15" ? x.e + 1.5 * risk * x.dir : n1 ? n1.x : x.e + 2 * risk * x.dir;
          const x0 = X(x.i), x1 = X(r.j != null ? r.j : bars.length + 4), ye = Y(x.e), yt = Y(tp), ys = Y(x.sl); if (!ok(x0, x1, ye, yt, ys)) return;
          cx.fillStyle = "rgba(38,166,154,.10)"; cx.fillRect(x0, Math.min(ye, yt), x1 - x0, Math.abs(yt - ye)); cx.fillStyle = "rgba(239,83,80,.10)"; cx.fillRect(x0, Math.min(ye, ys), x1 - x0, Math.abs(ys - ye));
          cx.fillStyle = "rgba(220,220,220,.6)"; cx.font = "600 9px sans-serif"; cx.textAlign = "center";
          cx.fillText(`${{ W: "✓", L: "✗", T: "⏱", O: "…" }[r.res]} ${r.r >= 0 ? "+" : ""}${r.r.toFixed(1)}R`, (x0 + x1) / 2, (ye + yt) / 2 + 3); }); }
      // cấu trúc + tín hiệu SMC Tradinghub (hàm vẽ gốc của TVL Quant)
      if (TH) drawTH(cx, plotW, plotH);
      // ký hiệu tín hiệu LP Quant (tường / Hedge / Hợp lưu) + SMC Tradinghub
      if (O.sig) { cx.textAlign = "center"; cx.font = "700 9.5px sans-serif";
        SIG.forEach((x) => { if (["pro", "m", "sw"].includes(x.kind) && !O.thSg) return; const b = bars[x.i], xx = X(x.i); if (!b || !ok(xx)) return;
          const y = x.dir > 0 ? Y(b.low) : Y(b.high); if (!ok(y)) return; const yy = x.dir > 0 ? y + 14 : y - 14, col = kcol(x);
          cx.fillStyle = col; cx.beginPath(); if (x.dir > 0) { cx.moveTo(xx, yy - 6); cx.lineTo(xx - 5, yy + 2); cx.lineTo(xx + 5, yy + 2); } else { cx.moveTo(xx, yy + 6); cx.lineTo(xx - 5, yy - 2); cx.lineTo(xx + 5, yy - 2); } cx.fill();
          const tg = { wall: x.dir > 0 ? "B" : "S", oh: "OF·H", oht: "H-T", conf: "HL", pro: "Pro", m: "M", sw: "sw" }[x.kind] || "";
          cx.fillText(`${tg}${x.grade ? " " + x.grade : ""}`, xx, x.dir > 0 ? yy + 13 : yy - 8); }); }
      cx.restore();
    } catch (e) { }
  }
  let rq = false; const kick = () => { if (rq) return; rq = true; requestAnimationFrame(() => { rq = false; draw(); }); };
  (function hook(k) { try { if (typeof chart === "undefined" || !chart) throw 0; chart.timeScale().subscribeVisibleLogicalRangeChange(kick); chart.subscribeCrosshairMove(kick);
      ["wheel", "pointerdown", "pointerup", "pointermove", "touchmove"].forEach((ev) => wrap.addEventListener(ev, kick, { passive: true })); } catch (e) { if (k < 60) setTimeout(() => hook(k + 1), 500); } })(0);
  setInterval(draw, 400);
  // giải thích khi rê chuột vào ký hiệu tín hiệu (nối vào bộ giải thích của tvlb_tips.js)
  const prevTip = window.tvlbTipX;
  window.tvlbTipX = function (e) {
    try { if (O.sig && e.target && e.target.closest && e.target.closest("#chartWrap") && SIG.length) {
        const r = wrap.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, ts = chart.timeScale();
        const hit = SIG.slice().reverse().find((x) => { const b = bars[x.i], xx = ts.logicalToCoordinate(x.i); if (!b || xx == null) return false; const y = candleS.priceToCoordinate(x.dir > 0 ? b.low : b.high); if (y == null) return false;
          const yy = x.dir > 0 ? y + 16 : y - 16; return Math.abs(mx - xx) <= 8 && Math.abs(my - yy) <= 12; });
        if (hit) return sigTip(hit); } } catch (err) { }
    return prevTip ? prevTip(e) : null;
  };
  function sigTip(x) {
    const b = bars[x.i], risk = Math.abs(x.e - x.sl), nx = optNext(x.e, x.dir, risk, 0, x.i), r = sim(x);
    return `<div style="font-weight:700;font-size:13px;color:${kcol(x)};margin-bottom:4px">${KNAME[x.kind] || x.kind} · ${x.dir < 0 ? "SELL" : "BUY"} · hạng ${x.grade} (${x.sc}/100)</div>
      ${new Date(x.t * 1000).toLocaleString("vi-VN")} · khung ${S.tf} · ${x.label || ""}<br>Vào ${f2(x.e)} (giá đóng nến) · SL ${f2(x.sl)} (${f2(risk)}$) · TP ${nx ? `${f2(nx.x)} (${nx.n}, R:R ${(Math.abs(nx.x - x.e) / risk).toFixed(1)})` : "2R"}
      <div style="margin-top:5px;border-top:1px solid #2b3440;padding-top:4px"><b>Vì sao có tín hiệu</b><br>${(x.why || []).join("<br>")}${/tường|Gamma|Flip|Magnet/i.test((x.why || []).join(" ") + (x.label || "")) ? "<br><span style=\"color:#ffb300\">⚠ Mốc tường/Magnet/Flip dùng trong tín hiệu CHƯA KIỂM ĐỊNH (bước 6: không hơn số tròn).</span>" : ""}</div>
      <div style="margin-top:5px;border-top:1px solid #2b3440;padding-top:4px"><b>Chấm điểm (${x.sc}/100 → hạng ${x.grade})</b><br>${(x.P || []).map((p) => `<span style="color:${p[0] >= 0 ? "#69f0ae" : "#ff8a80"}">${p[0] >= 0 ? "+" : ""}${p[0]}</span> ${p[1]}`).join("<br>")}</div>
      ${r ? `<div style="margin-top:5px;color:#9aa4b2">Kết quả mô phỏng (TP: ${TPM[O.tpm]}, đóng sau ${O.tout} nến): <b style="color:${r.res === "W" ? "#69f0ae" : r.res === "L" ? "#ff8a80" : "#ffd54f"}">${{ W: "chạm TP", L: "chạm SL", T: "hết giờ", O: "đang chạy" }[r.res]} ${sg(r.r, (v) => v.toFixed(2))}R</b></div>` : ""}`;
  }
  // ───────────────────── trang ④ Tín hiệu · Phản ứng ─────────────────────
  const bar = document.querySelector("#pgbar"), aside = document.querySelector(".right");
  const btn = document.createElement("button"); btn.type = "button"; btn.dataset.pg = "4"; btn.className = "v3btn"; btn.textContent = "④ Tín hiệu · Phản ứng"; bar.appendChild(btn);
  const page = document.createElement("div"); page.className = "page"; page.dataset.pg = "4"; page.hidden = true;
  page.innerHTML = `<div class="row" data-row="top"><div class="duo">
      <section class="panel"><header><h2>Tín hiệu (mọi loại)</h2><span class="muted small" id="t4n"></span></header><div id="t4sig" style="font-size:12px"></div></section>
      <section class="panel"><header><h2>Nhật ký live (tự ghi)</h2><span class="muted small" id="t4fn"></span></header><div id="t4fw" style="font-size:12px"></div></section></div></div>
    <div class="row" data-row="bot">
      <section class="panel"><header><h2>Phản ứng tại tường</h2><span class="muted small" id="t4rn"></span></header><div id="t4rx" style="font-size:12px"></div></section></div>`;
  aside.insertBefore(page, aside.querySelector("#pineOut") || null);
  // ───────────────────── trang ⑤ BACKTEST ─────────────────────
  const btn5 = document.createElement("button"); btn5.type = "button"; btn5.dataset.pg = "5"; btn5.className = "v3btn"; btn5.textContent = "⑤ Backtest"; bar.appendChild(btn5);
  const page5 = document.createElement("div"); page5.className = "page"; page5.dataset.pg = "5"; page5.hidden = true;
  page5.innerHTML = `<div class="row" data-row="top">
      <section class="panel"><header><h2>Backtest mọi tín hiệu · tìm EDGE</h2><span class="muted small" id="t4bn"></span><span class="muted small" id="t5ver" style="margin-left:10px;opacity:.75" title="Phiên bản giao diện TVLB+ (file web) · phiên bản máy chủ (server.py). Sau khi cập nhật: tắt / mở lại máy chủ rồi Ctrl+F5."></span><label class="muted small" style="margin-left:auto;margin-right:6px" title="Lệnh chưa chạm SL/TP sau số nến này sẽ đóng ở giá lúc đó (Hết giờ)">Đóng sau <select id="t4to" class="btn sm">${[24, 36, 72, 144, 288, 576].map((v) => `<option value="${v}">${v} nến</option>`).join("")}</select></label></header><div id="t4bt" style="font-size:12px"></div></section></div>
    <div class="row" data-row="bot"><div class="duo">
      <section class="panel"><header><h2>So sánh cách chốt lời</h2><span class="muted small" id="t5cn"></span></header><div id="t5cmp" style="font-size:12px"></div></section>
      <section class="panel"><header><h2>SMC dài hạn · SMC Tip + SMC hub</h2><span class="muted small" id="t5tn"></span></header><div id="t5tip" style="font-size:12px"></div></section></div></div>`;
  aside.insertBefore(page5, aside.querySelector("#pineOut") || null);
  const HT = { "Hết giờ": "Hết<br>giờ", "Chốt ½": "Chốt<br>½", "Tổng R": "Tổng<br>R", "Avg R / lệnh": "Avg R<br>/ lệnh", "Profit factor": "Profit<br>factor", "Thắng · Thua · Hết giờ": "Thắng·Thua<br>·Hết giờ", "Avg thắng · Avg thua": "Avg thắng<br>· thua", "Win%": "Win<br>%", "Đang chạy": "Đang<br>chạy" };
  const tbl = (head, rows) => `<div class="tablewrap" style="max-height:none"><table class="htable bt3"><thead><tr>${head.map((h) => `<th title="${h}">${HT[h] || h}</th>`).join("")}</tr></thead><tbody>${rows.join("") || `<tr><td colspan="${head.length}" class="muted">Chưa có.</td></tr>`}</tbody></table></div>`;
  const HEAD = ["Loại tín hiệu", "Đóng", "Thắng · Thua · Hết giờ", "Win%", "Chốt ½", "Tổng R", "Avg R / lệnh", "Profit factor", "Avg thắng · Avg thua", "DD", "EDGE", "Đang chạy"];
  function edgeOf(s) {   // EDGE = kỳ vọng R dương CÓ Ý NGHĨA THỐNG KÊ: khoảng tin cậy 95% của Avg R > 0, PF ≥ 1.3, ≥ 30 lệnh đã đóng
    if (!s.closed || s.closed < 10) return ["⚪ Ít mẫu", "#9aa4b2", "dưới 10 lệnh đã đóng — chưa kết luận được", "⚪ Ít"];
    const lo = s.sd != null ? s.avg - (1.96 * s.sd) / Math.sqrt(s.closed) : null;
    if (s.avg > 0 && lo != null && lo > 0 && s.pf >= 1.3 && s.closed >= 30) return ["🟢 CÓ EDGE", "#26a69a", `Avg R ${s.avg.toFixed(2)} · khoảng tin cậy 95% thấp nhất ${lo.toFixed(2)}R > 0 · PF ${s.pf.toFixed(2)} · ${s.closed} lệnh`, "🟢 CÓ"];
    if (s.avg > 0 && (s.pf == null || s.pf > 1)) return ["🟡 Có thể", "#ffd54f", `Avg R dương (${s.avg.toFixed(2)}) nhưng${s.closed < 30 ? ` mới ${s.closed} lệnh (< 30)` : ""}${lo != null && lo <= 0 ? ` · khoảng tin cậy 95% còn chạm ${lo.toFixed(2)}R ≤ 0` : ""}${s.pf != null && s.pf < 1.3 ? ` · PF ${s.pf.toFixed(2)} < 1.3` : ""} → cần thêm mẫu`, "🟡 Có thể"];
    return ["🔴 Không", "#ef5350", `Avg R ${s.avg.toFixed(2)} ≤ 0 hoặc PF ${s.pf == null ? "—" : s.pf.toFixed(2)} ≤ 1 → đang thua kỳ vọng`, "🔴 Không"];
  }
  if (!document.getElementById("bt3css")) { const st = document.createElement("style"); st.id = "bt3css";
    st.textContent = ".htable.bt3{width:100%;font-size:11px;table-layout:auto;font-family:'IBM Plex Sans',system-ui,sans-serif;font-variant-numeric:tabular-nums}.htable.bt3 th,.htable.bt3 td{font-family:inherit;letter-spacing:0}.htable.bt3 th{white-space:normal;line-height:1.15;padding:3px 4px;font-size:10px;vertical-align:bottom}.htable.bt3 td{padding:2px 4px;white-space:nowrap}.htable.bt3 i.sep{font-style:normal;color:#5b6573;margin:0 3px}.htable.bt3 td.nm{text-align:left;max-width:150px;overflow:hidden;text-overflow:ellipsis}";
    document.head.appendChild(st); }
  const pfT = (v) => (v == null ? "—" : v === Infinity ? "∞" : v.toFixed(2));
  const SHORT = [[/^(Option Flow|SMC Tip|SMC hub) · /, ""], [/^Tường Option B\/S$/, "Tường B/S"], [/^Hợp lưu Option \+ SMC$/, "Hợp lưu"], [/^OF·HEDGE \(.*\)$/, "OF·HEDGE"], [/^OF·H-TRAP \(.*\)$/, "OF·H-TRAP"],
    [/^Pro tiếp diễn$/, "Pro"], [/^Sweep cấu trúc chính \(M\)$/, "Sweep M"], [/^Sweep internal \(sw\)$/, "Sweep sw"], [/ tại /, " @ "], [/ \(tín hiệu có chấm điểm\)$/, ""]];
  const PRE = { "Option Flow": "OF", "SMC Tip": "Tip", "SMC hub": "Hub" };
  const shortNm = (nm, pre) => { const m = pre && nm.match(/^(Option Flow|SMC Tip|SMC hub) · /), r = SHORT.reduce((a, [re, b]) => a.replace(re, b), nm); return m ? PRE[m[1]] + " · " + r : r; };
  const apxKinds = () => (whUse() ? ["of", "oh", "oht"] : ["of", "oh", "oht", "wall", "conf"]);
  const isApx = (nm) => apxKinds().some((k) => nm.replace(/<[^>]+>/g, "").startsWith(FAM[k]));
  const edgeA = (s, nm) => { const e = edgeOf(s); return isApx(nm) && e[3] === "🟢 CÓ" ? ["🟡 Có thể (≈)", "#ffd54f", e[2] + " — nhưng loại này còn dùng mốc/vùng HIỆN TẠI cho quá khứ (≈) nên chưa được xếp CÓ EDGE", "🟡 ≈"] : e; };
  const stRow = (nm, s, pre) => { const e = edgeA(s, nm), apx = isApx(nm), full = nm.replace(/<[^>]+>/g, "") + (apx ? " — ≈ dùng mốc/vùng hiện tại cho quá khứ, kết quả có thể đẹp hơn thực tế" : "");
    return `<tr><td class="nm" title="${full}">${apx ? '<span style="color:#ffb74d">≈ </span>' : ""}${shortNm(nm, pre)}</td><td>${s.closed}</td><td><span class="win">${s.w}</span><i class="sep">/</i><span class="loss">${s.l}</span><i class="sep">/</i><span class="muted">${s.t}</span></td><td>${s.wr == null ? "—" : s.wr.toFixed(0) + "%"}</td><td>${s.half || "—"}</td>
    <td class="${s.R >= 0 ? "win" : "loss"}">${sg(s.R, (v) => v.toFixed(1))}R</td><td class="${(s.avg || 0) >= 0 ? "win" : "loss"}"><b>${s.avg == null ? "—" : sg(s.avg, (v) => v.toFixed(2)) + "R"}</b></td><td>${pfT(s.pf)}</td>
    <td><span class="win">${s.aw == null ? "—" : "+" + s.aw.toFixed(2)}</span><i class="sep">/</i><span class="loss">${s.al == null ? "—" : s.al.toFixed(2)}</span></td><td>${s.dd.toFixed(1)}R</td><td style="color:${e[1]};white-space:nowrap" title="${e[0]}: ${e[2]}">${e[3]}</td><td>${s.n - s.closed}</td></tr>`; };
  const grpRow = (t) => `<tr><td colspan="12" style="text-align:left;color:#e0a83a;font-weight:700;padding-top:6px">${t}</td></tr>`;
  function eqSvg(vals, title) {   // đường Equity (R) + tô đỏ vùng sụt giảm từ đỉnh (như TVL Quant)
    if (vals.length < 2) return `<div class="muted" style="font-size:11px;margin:4px 0">${title || "Equity"}: cần ≥ 2 lệnh đã đóng.</div>`;
    let R = 0, pk = 0, dd = 0; const eq = [0, ...vals.map((v) => (R += v))], peak = eq.map((v) => (pk = Math.max(pk, v))); eq.forEach((v, i) => (dd = Math.max(dd, peak[i] - v)));
    const lo = Math.min(0, ...eq), hi = Math.max(0.5, ...eq), W = 420, Hh = 110, X = (i) => (i / (eq.length - 1)) * W, Y = (v) => Hh - 8 - ((v - lo) / (hi - lo || 1)) * (Hh - 22);
    const area = `${eq.map((v, i) => `${X(i).toFixed(1)},${Y(peak[i]).toFixed(1)}`).join(" ")} ${eq.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).reverse().join(" ")}`;
    return `<div style="font-size:11.5px;margin-top:4px"><b>${title || "Equity"}</b> · ${vals.length} lệnh · cuối <b class="${R >= 0 ? "win" : "loss"}">${sg(R, (v) => v.toFixed(1))}R</b> · sụt giảm lớn nhất (DD) <b class="loss">${dd.toFixed(1)}R</b></div>
      <svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" style="width:100%;height:110px;background:#0f141a;border-radius:5px;margin:2px 0 4px">
      <polygon points="${area}" fill="rgba(239,83,80,.22)"/><line x1="0" x2="${W}" y1="${Y(0)}" y2="${Y(0)}" stroke="#3a4552" stroke-dasharray="3 3"/>
      <polyline fill="none" stroke="#26a69a" stroke-width="1.6" points="${eq.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}"/>
      <circle cx="${X(eq.length - 1)}" cy="${Y(R)}" r="3" fill="${R >= 0 ? "#26a69a" : "#ef5350"}"/>
</svg>`;
  }
  // Equity của "Backtest SMC" (trang ②, hàm gốc vẽ canvas) → vẽ kiểu SVG như trang ⑤ (tô đỏ vùng sụt giảm, chấm cuối, DD)
  try { window.drawEquity = function (done) {
    const cv = document.querySelector("#btCv"); if (!cv) return;
    let box = document.querySelector("#btEqSvg"); if (!box) { box = document.createElement("div"); box.id = "btEqSvg"; cv.parentNode.insertBefore(box, cv); }
    cv.style.display = "none";
    const d = (done || []).slice().sort((a, b) => (a.closeT ?? a.time) - (b.closeT ?? b.time));
    box.innerHTML = eqSvg(d.map((o) => (o.status === "tp1" ? o.rr : -1)), `Equity Backtest SMC (${(S.bt && S.bt.tf) || ""}, chốt TP1)`);
  }; } catch (e) { }
  function render4() {
    if (page.hidden && page5.hidden) return;
    const last = ALL.slice(-16).reverse();
    document.querySelector("#t4n").textContent = `${ALL.length} tín hiệu trên ${bars.length} nến ${S.tf}`;
    document.querySelector("#t4sig").innerHTML = last.length ? last.map((x) => { const r = sim(x);
      return `<div class="v3row"><span class="muted">${new Date(x.t * 1000).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span><b style="color:${kcol(x)}">${x.dir < 0 ? "SELL" : "BUY"}</b><span>${x.label}</span>${x.grade ? `<b>hạng ${x.grade} ${x.sc}</b>` : ""} @ ${f2(x.e)}${r ? ` → <b class="${r.res === "W" ? "win" : r.res === "L" ? "loss" : "muted"}">${{ W: "TP", L: "SL", T: "hết giờ", O: "đang chạy" }[r.res]} ${sg(r.r, (v) => v.toFixed(2))}R</b>` : ""}</div>`; }).join("")
      + '<div class="muted" style="margin-top:4px">Rê chuột vào ký hiệu trên chart để xem lý do + bảng chấm điểm. Backtest dùng tường theo từng ngày (data\\oi_history) — xem trang ⑤.</div>' : '<span class="muted">Chưa có tín hiệu trên số nến đang xem.</span>';
    // backtest theo loại / hạng + so sánh chốt lời
    const res = ALL.map((x) => ({ x, r: sim(x) })).filter((o) => o.r);
    const by = (f, flt) => { const g = {}; res.filter((o) => !flt || flt(o.x)).forEach((o) => { const k = f(o.x); (g[k] = g[k] || []).push(o.r); }); return Object.entries(g).sort().map(([k, v]) => stRow(k, statsOf(v))); };
    const famRows = [["Option Flow", (x) => x.kind === "of"], ["SMC Tip (CL / KB)", (x) => x.kind === "tip"], ["Tường Option · OF·HEDGE · Hợp lưu", (x) => ["wall", "oh", "oht", "conf"].includes(x.kind)], ["SMC hub", (x) => ["pro", "m", "sw"].includes(x.kind)]]
      .map(([t, f]) => { const rows = by(famOf, f); return rows.length ? [grpRow(t), ...rows] : []; }).flat();
    const grade = by((x) => "Hạng " + x.grade, (x) => !!x.grade);
    const cmp = Object.keys(TPM).map((m) => stRow(TPM[m], statsOf(ALL.map((x) => sim(x, m)).filter(Boolean))));
    document.querySelector("#t4bn").textContent = `${bars.length} nến ${S.tf}`;
    const eqB = res.filter((o) => o.r.res !== "O").sort((a, b) => (a.r.j ?? 1e9) - (b.r.j ?? 1e9)).map((o) => o.r.r);
    const groups = {}; res.forEach((o) => (groups[famOf(o.x)] = groups[famOf(o.x)] || []).push(o.r));
    const ev = Object.entries(groups).map(([k, v]) => ({ k, s: statsOf(v) })).filter((o) => o.s.closed).sort((a, b) => (b.s.avg ?? -9) - (a.s.avg ?? -9));
    const okE = ev.filter((o) => edgeA(o.s, o.k)[3] === "🟢 CÓ"), mayE = ev.filter((o) => edgeA(o.s, o.k)[3].startsWith("🟡")), noE = ev.filter((o) => edgeA(o.s, o.k)[3] === "🔴 Không"), tot = res.length ? statsOf(res.map((o) => o.r)) : null;
    const li = (arr) => arr.map((o) => `${isApx(o.k) ? "≈ " : ""}${o.k} (${sg(o.s.avg, (v) => v.toFixed(2))}R, ${o.s.closed} lệnh, PF ${pfT(o.s.pf)})`).join(" · ");
    const verdict = `<div style="border:1px solid #2b3440;border-radius:6px;padding:7px 9px;margin-bottom:6px;background:#11161d;line-height:1.6">
      <b style="color:#e0a83a">KẾT LUẬN EDGE</b> <span class="muted">(${res.length} tín hiệu · ${bars.length} nến ${S.tf} · chốt lời: ${TPM[O.tpm]} · đóng sau ${O.tout} nến)</span><br>
      ${tot ? `Toàn bộ: Avg R <b class="${tot.avg >= 0 ? "win" : "loss"}">${sg(tot.avg, (v) => v.toFixed(2))}R / lệnh</b> · PF ${pfT(tot.pf)} · Win ${tot.wr == null ? "—" : tot.wr.toFixed(0) + "%"} → <b style="color:${edgeOf(tot)[1]}">${edgeOf(tot)[0]}</b><br>` : ""}
      ${(() => { const w = whInfo(); return whUse() ? `📅 <b>Tường theo từng ngày:</b> ${w.gc} ngày GC · ${w.gld} ngày GLD (${w.from} → ${w.to}). Nến trước ngày OI đầu tiên: không tính tín hiệu tường. <span style="color:#ffb74d">≈</span> = loại còn dùng dữ liệu hiện tại (Option Flow, vùng Hedge) → không xếp CÓ EDGE.<br>`
        : `<span style="color:#ffb74d">⚠ Đang dùng mốc tường HÔM NAY cho cả quá khứ</span> (${w.n ? "đã tắt tường theo ngày ở menu TP / SL" : whErr === "old" ? "<b>máy chủ TVLB đang chạy bản cũ</b> — tắt cửa sổ máy chủ rồi mở lại 01_MO_DASHBOARD_TVLB.bat" : whErr === "empty" ? "máy chủ không đọc được ngày nào trong data\\oi_history (thiếu nến 1h hoặc giá cơ sở) — xem cửa sổ máy chủ" : "chưa có data\\oi_history — chạy 07_NHAP_OI_TU_TVLQUANT.bat hoặc để TVLB tự lưu mỗi ngày"}) → các dòng <span style="color:#ffb74d">≈</span> có thể đẹp hơn thực tế.<br>`; })()}
      🟢 <b>Có EDGE:</b> ${okE.length ? li(okE) : "chưa có loại nào đạt đủ chuẩn"}<br>
      ${mayE.length ? `🟡 <b>Có thể có edge (cần thêm mẫu):</b> ${li(mayE)}<br>` : ""}
      ${noE.length ? `🔴 <b>Không có edge (nên bỏ):</b> ${li(noE)}<br>` : ""}
      <span class="muted">EDGE = Avg R dương và <b>khoảng tin cậy 95%</b> của Avg R vẫn > 0 (không phải do may mắn) + Profit factor ≥ 1.3 + ≥ 30 lệnh đã đóng. Đây là kiểm tra trong mẫu, chưa trừ phí/spread → xác nhận lại bằng Nhật ký live (trang ④) và đổi khung (M5/M15/1h) trước khi tăng khối lượng.</span></div>`;
    document.querySelector("#t4bt").innerHTML = verdict + eqSvg(eqB, `Equity Backtest (${TPM[O.tpm]}, ${S.tf})`) + tbl(HEAD, famRows.concat(grade.length ? [grpRow("Theo hạng (tín hiệu có chấm điểm A/B/C)"), ...grade] : []).concat(res.length ? [grpRow("Tổng"), stRow("<b>TẤT CẢ</b>", statsOf(res.map((o) => o.r)))] : []))
      + `<div class="muted" style="margin-top:4px">Gồm MỌI tín hiệu: Option Flow · SMC Tip · Tường Option / OF·HEDGE / Hợp lưu · SMC hub, chạy lại trên các nến đang xem (đổi khung để thử khung khác). Avg R / lệnh = kỳ vọng mỗi lệnh. Rê chuột vào ô EDGE để xem lý do.</div>`;
    document.querySelector("#t5cn").textContent = `${ALL.length} tín hiệu · cùng SL, chỉ khác TP`;
    document.querySelector("#t5cmp").innerHTML = tbl(["Cách chốt"].concat(HEAD.slice(1)), cmp) + '<div class="muted" style="margin-top:4px">Đổi cách chốt lời dùng cho bảng trên ở menu trái → TP / SL. SL trước nếu cùng nến chạm SL và TP · Chốt ½ = số lệnh đã chốt 1 nửa ở mốc 1 rồi dời SL hoà vốn.</div>';
    renderTipLong();
    const to = document.querySelector("#t4to"); if (to && !to.dataset.b) { to.dataset.b = 1; to.onchange = () => { O.tout = +to.value; saveO(); render4(); }; } if (to && document.activeElement !== to) to.value = O.tout;
    if (page.hidden) return;
    // phản ứng tại tường
    const g = {}; RX.forEach((r) => { (g[r.nm + "|" + r.x] = g[r.nm + "|" + r.x] || []).push(r); });
    document.querySelector("#t4rn").textContent = `${RX.length} lần chạm · ${bars.length} nến`;
    document.querySelector("#t4rx").innerHTML = tbl(["Tường", "Giá", "Chạm", "Bật", "Phá", "% bật", "Bật TB $", "Xuyên TB $"], Object.entries(g).sort((a, b) => b[1].length - a[1].length).map(([k, v]) => {
      const nm = k.split("|")[0], x = +k.split("|")[1], done = v.filter((r) => r.res !== "Đang theo dõi"), bt = done.filter((r) => r.res === "Bật lại"), ph = done.filter((r) => r.res === "Bị phá");
      return `<tr><td>${nm}</td><td>${f2(x)}</td><td>${v.length}</td><td class="win">${bt.length}</td><td class="loss">${ph.length}</td><td>${done.length ? Math.round((100 * bt.length) / done.length) + "%" : "—"}</td><td>${bt.length ? f2(bt.reduce((a, r) => a + r.mv, 0) / bt.length) : "—"}</td><td>${done.length ? f2(done.reduce((a, r) => a + r.pen, 0) / done.length) : "—"}</td></tr>`; }))
      + '<div class="muted" style="margin-top:4px">Chạm = nến đi vào ±4$ quanh tường từ phía ngoài. Trong 12 nến sau: <b>Bật lại</b> = giá đi ngược ≥ 12$ · <b>Bị phá</b> = nến đóng xuyên quá 4$ · còn lại = đi ngang. Số này cộng/trừ vào uy tín tường ở trang ③ (≥ 2 lần chạm).</div>'
      + (RX.length ? `<div style="margin-top:6px"><b>Lần chạm gần nhất</b></div>` + RX.slice().sort((a, b) => b.t - a.t).slice(0, 12).map((r) => `<div class="v3row"><span class="muted">${new Date(r.t * 1000).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span><span>${r.nm} ${f2(r.x)}</span><span class="muted">${r.from > 0 ? "từ trên xuống" : "từ dưới lên"}</span><b class="${r.res === "Bật lại" ? "win" : r.res === "Bị phá" ? "loss" : "muted"}">${r.res}</b></div>`).join("") : "");
    // nhật ký live
    const T = [].filter((t) => t.res).map((t) => ({ t: t.xt || t.t, r: t.res === "TP" ? Math.abs(t.tp - t.e) / Math.max(Math.abs(t.e - (t.sl0 ?? t.sl)), 0.5) : -1, nm: "Kế hoạch " + t.id }));
    const F = FWD.filter((f) => f.res).map((f) => ({ t: f.xt || f.t, r: f.r, nm: f.fam || FAM[f.kind] || f.kind }));
    const all = T.concat(F).sort((a, b) => a.t - b.t);
    document.querySelector("#t4fn").textContent = `${FWD.length} tín hiệu`;
    const g2 = {}; all.forEach((o) => (g2[o.nm] = g2[o.nm] || []).push({ res: o.r > 0 ? "W" : o.r < 0 ? "L" : "T", r: o.r }));
    document.querySelector("#t4fw").innerHTML = eqSvg(all.map((o) => o.r), "Equity Nhật ký live (mọi loại)") + tbl(HEAD, Object.entries(g2).sort().map(([k, v]) => stRow(k, statsOf(v), 1)).concat(all.length ? [stRow("<b>TẤT CẢ</b>", statsOf(all.map((o) => ({ res: o.r > 0 ? "W" : o.r < 0 ? "L" : "T", r: o.r }))))] : []))
      + FWD.slice().reverse().slice(0, 10).map((f) => `<div class="v3row"><span class="muted">${new Date(f.t * 1000).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span><b style="color:${f.dir < 0 ? "#ef5350" : "#26a69a"}">${f.dir < 0 ? "SELL" : "BUY"}</b><span>${f.label} · ${f.tf}${f.grade ? " · hạng " + f.grade : ""}</span>${f.res ? `<b class="${f.r > 0 ? "win" : "loss"}">${sg(f.r, (v) => v.toFixed(2))}R</b>` : '<span class="muted">đang chạy</span>'}</div>`).join("")
      + '<div class="muted" style="margin-top:4px">Tự ghi MỌI tín hiệu (Option Flow · SMC Tip · Tường / OF·HEDGE / Hợp lưu · SMC hub) ngay khi nến tín hiệu đóng (để dashboard mở), kết quả theo cách chốt lời đang chọn. Lưu trong trình duyệt.</div>';
  }
  let TIPL = null;
  async function runTipLong(tf) {
    TIPL = { tf, msg: "⏳ Đang tải nến lưu trên máy chủ…" }; renderTipLong();
    try {
      const get = async (t) => { const r = await (await fetch(API(`/api/klines?tf=${t}`))).json(); if (!r.ok) throw new Error(r.error || "lỗi tải nến"); return r.rows; };
      const mk2 = (r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], vol: r[5], delta: 0 });
      const t0 = h4From(), seed = (a) => { const k = a.findIndex((x) => x.time >= t0); return a.slice(Math.max(0, k - 1)); };
      const [rc, rh] = await Promise.all([get(tf), get("1h")]);
      const c = seed(rc.map(mk2).filter((k) => SMC.fxOpen(k.time))), h4 = seed(SMC.aggregate(rh.map(mk2).filter((k) => SMC.fxOpen(k.time)), H4_SEC));
      const r = SMC.analyze(c, h4, H4_SEC, Object.assign({}, smcCfg(), { kb2: true, tfSec: TF_SEC[tf], tfName: tf === "15m" ? "M15" : "M5", sessionOk: null }));
      const O_ = r.orders.filter((o) => o.status !== "skip");
      const hub = hubLong(c, tf);
      TIPL = { tf, orders: O_.map((o) => ({ name: `${o.name} ${o.side}`, status: o.status, rr: o.rr, t: c[o.created].time, fill: o.fillI != null, ct: o.closeI != null && c[o.closeI] ? c[o.closeI].time : null })),
        skip: r.orders.length - O_.length, hub, msg: `${c.length} nến ${tf} · ${new Date(c[0].time * 1000).toLocaleDateString("vi-VN")} → ${new Date(c[c.length - 1].time * 1000).toLocaleDateString("vi-VN")}` };
    } catch (e) { TIPL = { tf, msg: "❌ " + e.message + " (cần mở dashboard qua máy chủ TVLB)" }; }
    renderTipLong();
  }
  // SMC hub trên nến dài hạn: chạy lại đúng hàm SMC hub của board (smcCalc) trên toàn bộ nến, rồi mô phỏng SL gốc + TP cố định theo R
  const HUBR = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const HUBTP = Object.assign(Object.fromEntries(HUBR.map((k) => ["r" + k, `Cố định ${k}R`])), { part: "Chốt 2 phần (½ ở 1R → SL hoà vốn, ½ ở 2R)" });
  const hubName = (m) => HUBTP[m] || (/^r[\d.]+$/.test(m) ? `Cố định ${m.slice(1)}R` : m);
  function hubLong(c, tf) {
    const b0 = bars, th0 = TH; let sg = [];
    try { bars = c; smcCalc(); sg = (TH && TH.sig ? TH.sig : []).filter((x) => ["pro", "m", "sw"].includes(x.kind) && x.sl != null && Math.abs(x.e - x.sl) > 0); }
    finally { bars = b0; TH = th0; }
    return { n: c.length, tf, sig: sg.map((x) => ({ kind: x.kind, dir: x.dir, i: x.i, t: x.t, e: x.e, sl: x.sl, c })) };
  }
  function simR(x, m) {   // SL gốc của tín hiệu, TP = k·R; SL trước nếu cùng nến; hết giờ sau O.tout nến → đóng ở giá đóng nến
    const c = x.c, d = x.dir, e = x.e, risk = Math.abs(e - x.sl), k = m === "part" ? 2 : parseFloat(String(m).slice(1)) || 2;
    let sl = x.sl, half = false, acc = 0;
    for (let j = x.i + 1; j < Math.min(c.length, x.i + 1 + O.tout); j++) { const b = c[j];
      if (d > 0 ? b.low <= sl : b.high >= sl) { const r = acc + (half ? 0.5 : 1) * ((sl - e) * d) / risk; return { res: r > 0 ? "W" : r < 0 ? "L" : "T", r, half, j }; }
      if (m === "part" && !half && (d > 0 ? b.high >= e + risk : b.low <= e - risk)) { half = true; acc = 0.5; sl = e; }
      if (d > 0 ? b.high >= e + k * risk : b.low <= e - k * risk) return { res: "W", r: acc + (half ? 0.5 : 1) * k, half, j }; }
    const j = Math.min(c.length - 1, x.i + O.tout); if (j <= x.i || x.i + O.tout >= c.length) return { res: "O", r: 0, half };
    return { res: "T", r: acc + (half ? 0.5 : 1) * ((c[j].close - e) * d) / risk, half, j };
  }
  function renderTipLong() {
    const el = document.querySelector("#t5tip"); if (!el || (TIPL && TIPL._drawn === TIPL.msg && el.dataset.v === "1")) return;
    let h = `<div class="v3sw" style="margin-bottom:6px"><button data-tl="15m">▶ Chạy M15</button><button data-tl="5m">▶ Chạy M5</button> <span class="muted">${TIPL ? TIPL.msg : "Backtest trên TOÀN BỘ nến lưu trên máy chủ (từ mốc h4_from, ~5 tháng): ① SMC Tip (CL/KB) — luật gốc chốt tại TP1 · ② SMC hub (Pro / Sweep M / Sweep sw) — SL gốc, TP theo bội số R (chọn được, có bảng so sánh)."}</span></div>`;
    if (TIPL && TIPL.orders) {
      const filled = TIPL.orders.filter((o) => o.fill), toR = (o) => (o.status === "tp1" ? { res: "W", r: o.rr } : o.status === "sl" ? { res: "L", r: -1 } : { res: "O", r: 0 });
      const g = {}; filled.forEach((o) => (g[o.name] = g[o.name] || []).push(toR(o)));
      const all = filled.slice().sort((a, b) => (a.ct || 9e9) - (b.ct || 9e9)).map(toR);
      document.querySelector("#t5tn").textContent = `${filled.length} lệnh khớp · ${TIPL.orders.length - filled.length} không khớp (hết hạn / lỡ) · bỏ ${TIPL.skip} lệnh TP1 < 1R`;
      h += eqSvg(all.filter((r) => r.res !== "O").map((r) => r.r), `Equity SMC Tip dài hạn (${TIPL.tf}, chốt TP1)`)
        + tbl(HEAD, Object.entries(g).sort().map(([k, v]) => stRow(k, statsOf(v))).concat(all.length ? [stRow("<b>TẤT CẢ</b>", statsOf(all))] : []));
    }
    if (TIPL && TIPL.hub) { const H = TIPL.hub, m = /^r[\d.]+$|^part$/.test(O.hubtp || "") ? O.hubtp : "r2", nmK = { pro: "Pro tiếp diễn", m: "Sweep cấu trúc chính (M)", sw: "Sweep internal (sw)" };
      const res = H.sig.map((x) => ({ x, r: simR(x, m) })).filter((o) => o.r), g = {};
      res.forEach((o) => { const k = `${nmK[o.x.kind]} ${o.x.dir > 0 ? "BUY" : "SELL"}`; (g[k] = g[k] || []).push(o.r); (g[nmK[o.x.kind]] = g[nmK[o.x.kind]] || []); });
      const byK = {}; res.forEach((o) => (byK[nmK[o.x.kind]] = byK[nmK[o.x.kind]] || []).push(o.r));
      const eqv = res.filter((o) => o.r.res !== "O").sort((a, b) => a.r.j - b.r.j).map((o) => o.r.r);
      h += `<div style="margin:12px 0 4px;border-top:1px solid #2b3440;padding-top:8px"><b style="color:#e0a83a">SMC hub dài hạn</b> <span class="muted">· ${H.sig.length} tín hiệu trên ${H.n} nến ${H.tf} · SL gốc của tín hiệu · đóng sau ${O.tout} nến ·</span>
        <label class="muted">TP <select id="t5hubtp" class="btn sm">${Object.entries(HUBTP).concat(HUBTP[m] ? [] : [[m, hubName(m)]]).map(([k, t]) => `<option value="${k}" ${k === m ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <label class="muted" title="Nhập R:R bất kỳ (vd 7 hoặc 2.2) rồi Enter">· R:R tự nhập <input id="t5hubr" type="number" min="0.5" max="30" step="0.1" placeholder="vd 7" style="width:58px" class="btn sm"></label></div>`
        + eqSvg(eqv, `Equity SMC hub dài hạn (${H.tf}, ${hubName(m)})`)
        + tbl(HEAD, [grpRow("Theo loại")].concat(Object.entries(byK).sort().map(([k, v]) => stRow(k, statsOf(v))), [grpRow("Theo loại · chiều")], Object.entries(g).filter(([k]) => / (BUY|SELL)$/.test(k)).sort().map(([k, v]) => stRow(k, statsOf(v))),
          res.length ? [grpRow("Tổng"), stRow("<b>TẤT CẢ</b>", statsOf(res.map((o) => o.r)))] : []))
        + `<div style="margin-top:8px"><b>So sánh cách chốt lời · SMC hub</b> <span class="muted">(cùng tín hiệu, cùng SL)</span></div>`
        + tbl(["Cách chốt"].concat(HEAD.slice(1)), Object.entries(HUBTP).concat(HUBTP[m] ? [] : [[m, hubName(m)]]).map(([k, t]) => stRow(k === m ? `<b>${t} ◀ đang chọn</b>` : t, statsOf(H.sig.map((x) => simR(x, k)).filter(Boolean)))))
        + '<div class="muted" style="margin-top:4px">SMC hub dài hạn không dùng mốc Option (chỉ cấu trúc giá) nên không bị lỗi "nhìn trước tường"; TP tính theo bội số R vì phần lớn 5 tháng chưa có OI lưu.</div>'; }
    el.innerHTML = h; el.dataset.v = "1"; if (TIPL) TIPL._drawn = TIPL.msg;
    el.querySelectorAll("[data-tl]").forEach((b) => { b.onclick = () => { el.dataset.v = ""; runTipLong(b.dataset.tl); }; });
    const reH = () => { saveO(); el.dataset.v = ""; if (TIPL) TIPL._drawn = null; renderTipLong(); };
    const hs = el.querySelector("#t5hubtp"); if (hs) hs.onchange = () => { O.hubtp = hs.value; reH(); };
    const hr = el.querySelector("#t5hubr"); if (hr) hr.onkeydown = (ev) => { if (ev.key !== "Enter") return; const v = Math.round(parseFloat(hr.value) * 10) / 10; if (v >= 0.5 && v <= 30) { O.hubtp = "r" + v; reH(); } };
  }
  // ───────────────────── SMC TIP (SMC CL/KB của anh Thắng): bật/tắt từng đối tượng + tách riêng tín hiệu Buy/Sell ─────────────────────
  const TIP = Object.assign({ st: true, sg: true, of: true, prem: true, ext: true, fib: true, kb2: true, liq: true, tl: true, hl: true, bos: true, swp: true, form: true, ord: true, fill: true }, st_.get("tip", {}));
  const saveTip = () => st_.set("tip", TIP);
  const lySMC = () => document.querySelector("#lySMC");
  function tipSync() { const c = lySMC(); if (c) c.checked = !!(TIP.st || TIP.sg); try { setMarkers(); drawOverlay(); } catch (e) { } }
  setTimeout(() => { const c = lySMC(); if (c) { c.addEventListener("change", () => { TIP.st = TIP.sg = c.checked; saveTip(); try { setMarkers(); } catch (e) { } menuSync(); }); if (!c.checked) TIP.st = TIP.sg = false; } }, 0);
  if (typeof drawSMC === "function") {
    // eslint-disable-next-line no-global-assign
    drawSMC = function (ctx, plotW, plotH) {   // bản vẽ SMC của Bildol, thêm công tắc cho từng đối tượng
      const R = S.smc, c = S.candles, ts = chart.timeScale(), fr = R.frame; if (!c.length) return;
      const X = (t) => { if (t == null) return 0; const x = ts.timeToCoordinate(t + TZ); return x == null ? (t < c[0].time ? 0 : plotW) : Math.max(0, Math.min(plotW, x)); };
      const Yr = (p) => { const y = candleS.priceToCoordinate(p); return y == null ? null : Math.max(-2, Math.min(plotH + 2, y)); };
      const box = (t0, p1, p2, fill, stroke, label, where) => { const y1 = Yr(p1), y2 = Yr(p2); if (y1 == null || y2 == null) return; const x0 = X(t0), top = Math.min(y1, y2), hh = Math.abs(y2 - y1);
        if (hh < 0.5 || top > plotH || top + hh < 0) return; ctx.fillStyle = fill; ctx.fillRect(x0, top, plotW - x0, hh); ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.setLineDash([]); ctx.strokeRect(x0 + 0.5, top + 0.5, plotW - x0 - 1, hh - 1);
        if (label) { ctx.font = "600 10px 'IBM Plex Mono', monospace"; ctx.fillStyle = stroke; ctx.textAlign = "right"; ctx.textBaseline = where === "top" ? "top" : "bottom"; ctx.fillText(label, plotW - 6, where === "top" ? Math.max(top + 2, 2) : Math.min(top + hh - 2, plotH - 2)); } };
      const f = (x) => fmt(x), tfN = smcCfg().tfName, st = TIP.st;
      if (fr && st) {
        const o1 = Math.min(...fr.ote), o2 = Math.max(...fr.ote);
        if (fr.dir === -1) { if (TIP.prem) box(fr.hiT, o1, o2, "rgba(229,83,75,.09)", "rgba(229,83,75,.7)", `H4 PREMIUM · OTE ${f(o1)}–${f(o2)} (CL2 Sell thuận)`, "bottom"); if (TIP.ext) box(fr.hiT, o2, fr.hi, "rgba(229,83,75,.17)", "rgba(229,83,75,.7)", `H4 EXTREME → ${f(fr.hi)}`, "top"); }
        else { if (TIP.prem) box(fr.hiT, o2, o1, "rgba(38,179,132,.09)", "rgba(38,179,132,.7)", `H4 DISCOUNT · OTE ${f(o1)}–${f(o2)} (CL2 Buy thuận)`, "top"); if (TIP.ext) box(fr.hiT, o1, fr.lo, "rgba(38,179,132,.17)", "rgba(38,179,132,.7)", `H4 EXTREME → ${f(fr.lo)}`, "bottom"); }
        const y5 = Yr(fr.fib05); if (TIP.fib && y5 != null && y5 > 0 && y5 < plotH) { hline(ctx, y5, X(fr.hiT), plotW, "#9aa3ad", 1, [5, 4], 0.7); ctx.fillStyle = "#9aa3ad"; ctx.font = "10px 'IBM Plex Mono', monospace"; ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText(`H4 Fibo 0.5 · ${f(fr.fib05)}`, plotW - 6, y5 - 2); }
        if (TIP.kb2) for (const [zz, cl] of [[fr.z1, 1], [fr.z2, 2]]) { if (!zz || !c[zz.from]) continue; const vals = [zz.lo, zz.top, zz.hi, zz.bot].filter((x) => x != null), a = Math.min(...vals), b = Math.max(...vals), buy = (cl === 1) === (fr.dir === -1);
          box(c[zz.from].time, a, b, buy ? "rgba(76,195,217,.10)" : "rgba(242,184,75,.10)", buy ? "rgba(76,195,217,.8)" : "rgba(242,184,75,.8)", `${tfN} vùng chờ CL${cl}-KB2 ${buy ? "BUY" : "SELL"} ${f(a)}–${f(b)}`, buy ? "top" : "bottom"); }
      }
      if (TIP.sg && TIP.ord) { ctx.font = "600 10px 'IBM Plex Mono', monospace"; ctx.textBaseline = "middle";
        for (const o of smcOrders()) { if (o.status !== "pending" && o.status !== "open") continue; const x0 = c[o.created] ? X(c[o.created].time) : 0, col = o.side === "BUY" ? C.up : C.down;
          for (const [p, lab, cc, dash] of [[o.entry, `SMC ${o.name} ${o.side} ${o.status === "pending" ? "LIMIT" : "ĐANG CHẠY"} ${f(o.entry)}`, col, []], [o.sl, `SMC SL ${f(o.sl)}`, C.down, [4, 3]], [o.tp1, `SMC TP1 ${f(o.tp1)}`, C.up, [4, 3]]]) {
            const y = Yr(p); if (p == null || y == null || y < 0 || y > plotH) continue; hline(ctx, y, x0, plotW, cc, 1.2, dash, 0.9); ctx.fillStyle = cc; ctx.textAlign = "left"; ctx.fillText(lab, x0 + 4, y - 7); } } }
      if (st && TIP.liq) { ctx.font = "10px 'IBM Plex Mono', monospace"; ctx.textBaseline = "middle"; ctx.textAlign = "right"; const p0 = lastPrice();
        for (const [arr, kind] of [[R.liqH, "đỉnh"], [R.liqL, "đáy"]]) { const near = [...arr].sort((a, b) => Math.abs(a.p - p0) - Math.abs(b.p - p0)).filter((L_, j) => j < 4 || L_.n >= 2);
          for (const L_ of near) { const y = Yr(L_.p); if (y == null || y < 0 || y > plotH || !c[L_.i]) continue; hline(ctx, y, X(c[L_.i].time), plotW, C.mag, L_.n >= 2 ? 1.6 : 1, [2, 3], L_.n >= 2 ? 0.95 : 0.6);
            ctx.fillStyle = C.mag; ctx.fillText(`${L_.n >= 2 ? (kind === "đỉnh" ? "EQH×" : "EQL×") + L_.n : "$ " + kind} ${f(L_.p)}`, plotW - 6, y - 7); } } }
      if (st && TIP.tl && R.tl && c[R.tl.a.i] && c[R.tl.b.i]) { const xa = X(c[R.tl.a.i].time), ya = Yr(R.tl.a.p), xb = X(c[R.tl.b.i].time), yb = Yr(R.tl.b.p);
        if (ya != null && yb != null && xb > xa) { const k = (yb - ya) / (xb - xa); ctx.save(); ctx.strokeStyle = C.mag; ctx.globalAlpha = 0.8; ctx.lineWidth = 1.2; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(plotW, ya + k * (plotW - xa)); ctx.stroke(); ctx.restore(); } }
      if (st && (TIP.hl || TIP.bos)) { ctx.font = "600 9.5px 'IBM Plex Mono', monospace"; ctx.textAlign = "center";
        for (const e of R.events.slice(-40)) { if (!c[e.i]) continue; const x = ts.timeToCoordinate(c[e.i].time + TZ); if (x == null || x < 0 || x > plotW) continue; const y = Yr(e.p); if (y == null || y < 0 || y > plotH) continue;
          if (e.kind === "BOS" || e.kind === "CHoCH") { if (!TIP.bos) continue; const col = e.dir > 0 ? C.up : C.down, x0 = c[e.from] ? X(c[e.from].time) : x; hline(ctx, y, x0, x, col, 1, e.kind === "BOS" ? [4, 3] : [], 0.9);
            ctx.fillStyle = col; ctx.textBaseline = e.dir > 0 ? "bottom" : "top"; ctx.fillText(e.kind, (x0 + x) / 2, y + (e.dir > 0 ? -2 : 2)); }
          else if (TIP.hl) { ctx.fillStyle = e.side === "top" ? C.down : C.up; ctx.textBaseline = e.side === "top" ? "bottom" : "top"; ctx.fillText(e.kind, x, y + (e.side === "top" ? -4 : 4)); } } }
    };
  }
  if (typeof setMarkers === "function") {
    // eslint-disable-next-line no-global-assign
    setMarkers = function () {   // ký hiệu trên nến của Bildol, thêm công tắc: tín hiệu Option Flow anh Thắng · nến quét · nến tạo đỉnh/đáy · lệnh SMC khớp
      const show = document.querySelector("#lyMk").checked, on = lySMC()?.checked && S.smc, c = S.candles, mk = [];
      window.TVLB_MK_OF = !!(show && TIP.of);   // v23am-9: app.js đọc cờ này để biết có vẽ nhãn tín hiệu Option Flow không
      if (show && TIP.of) S.signals.forEach((s) => mk.push({ time: s.time + TZ, position: s.side === "SELL" ? "aboveBar" : "belowBar", color: s.side === "SELL" ? C.down : C.up, shape: s.side === "SELL" ? "arrowDown" : "arrowUp", size: 0.7, text: "" }));   // v23am-9: chữ do app.js tự vẽ 2 dòng (điểm / buy-sell); ở đây chỉ còn mũi tên nhỏ
      if (on) {
        const swCode = (t, top) => [/gần nhất/.test(t) && "$", /bằng nhau/.test(t) && (top ? "EQH" : "EQL"), /trendline/.test(t) && "TL"].filter(Boolean).join("+");
        if (TIP.st && TIP.swp) for (const w of S.smc.sweeps) if (c[w.i]) mk.push({ time: c[w.i].time + TZ, position: w.side === "top" ? "aboveBar" : "belowBar", color: C.mag, shape: "circle", size: 0.5, text: "✕ " + swCode(w.txt, w.side === "top") });
        if (TIP.st && TIP.form) for (const F of S.smc.forms || []) { const top = F.side === "top", col = top ? C.down : C.up, cc = F.pending ? col + "99" : col, pos = top ? "aboveBar" : "belowBar";
          if (c[F.f]) mk.push({ time: c[F.f].time + TZ, position: pos, color: cc, shape: top ? "arrowDown" : "arrowUp", size: 0.6, text: "" }); if (F.cf != null && c[F.cf]) mk.push({ time: c[F.cf].time + TZ, position: pos, color: cc, shape: "square", size: 0.5, text: "" }); }
        if (show && TIP.sg && TIP.fill) for (const s of smcFilled()) mk.push({ time: s.time + TZ, position: s.side === "SELL" ? "aboveBar" : "belowBar", color: s.side === "SELL" ? C.down : C.up, shape: s.side === "SELL" ? "arrowDown" : "arrowUp", size: 1.4, text: `${s.name} ${s.side}${s.status === "tp1" ? " ✓" : s.status === "sl" ? " ✗" : ""}` });
      }
      mk.sort((a, b) => a.time - b.time); candleS.setMarkers(mk);
      const nS = on ? smcFilled().filter((s) => vnDate(s.time) === vnDate(nowSec())).length : 0;
      document.querySelector("#sigCount").textContent = `${S.signals.length} tín hiệu Options · ${nS} SMC hôm nay`;
    };
    setTimeout(() => { try { setMarkers(); } catch (e) { } document.querySelector("#lyMk")?.addEventListener("change", () => { try { setMarkers(); } catch (e) { } }); }, 0);
  }
  // ───────────────────── MENU ẨN BÊN TRÁI: nhóm bấm mở ra, tích chọn từng mục ─────────────────────
  const MS = st_.get("menuopen", {});
  const msCss = document.createElement("style");
  msCss.textContent = `#tvlbPlus .grp { margin: 0 0 6px; border: 1px solid #2b3440; border-radius: 6px; background: #151b23; }
#tvlbPlus .gh { display: flex; align-items: center; gap: 6px; width: 100%; padding: 7px 9px; background: none; border: 0; color: #e6d3a3; font: 700 12.5px var(--f-body, sans-serif); cursor: pointer; text-align: left; }
#tvlbPlus .gh .ar { margin-left: auto; color: #7d8796; } #tvlbPlus .gb { padding: 2px 10px 8px; display: none; } #tvlbPlus .grp.open .gb { display: block; }
#tvlbPlus .ck { display: flex; align-items: center; gap: 7px; margin: 3px 0; font-size: 12px; color: #cfd6df; cursor: pointer; } #tvlbPlus .ck.m { font-weight: 700; color: #f3d38c; margin-top: 6px; }
#tvlbPlus .sub { color: #e0a83a; font: 700 10.5px var(--f-body, sans-serif); letter-spacing: .06em; margin: 8px 0 2px; text-transform: uppercase; }
#tvlbPlus select, #tvlbPlus input[type=range] { width: 100%; margin: 2px 0 4px; background: #0f141a; color: #dfe5ec; border: 1px solid #2b3440; border-radius: 4px; padding: 3px; }
#tvlbPlus .note { color: #8b95a3; font-size: 11px; line-height: 1.45; margin: 4px 0; } #tvlbPlus:hover { width: 330px; } #tvlbPlus .pm { width: 320px; }`;
  document.head.appendChild(msCss);
  const CK = (obj, k, t, m) => `<label class="ck${m ? " m" : ""}"><input type="checkbox" data-o="${obj}" data-kk="${k}"> ${t}</label>`;
  const SEL = (k, opts, lab) => `<div class="note" style="margin-bottom:0">${lab}</div><select data-sel="${k}">${opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select>`;
  const GROUPS = [
    ["hub", "🧱 SMC hub", `${CK("O", "thSt", "Hiện cấu trúc SMC hub", 1)}<div class="sub">Cấu trúc chính</div>${CK("SMCO", "bc", "BoS / CHoCH")}${CK("SMCO", "hl", "Nhãn HH / LH / LL")}${CK("SMCO", "mzz", "Zigzag cấu trúc chính")}${CK("SMCO", "dot", "Chấm đỉnh/đáy mạnh")}${CK("SMCO", "idm", "IDM (đã quét)")}${CK("SMCO", "lidm", "IDM live")}${CK("SMCO", "swm", "Quét thanh khoản chính (x)")}
      <div class="sub">Internal</div>${CK("SMCO", "izz", "Zigzag internal")}${CK("SMCO", "idot", "Chấm đỉnh/đáy internal")}${CK("SMCO", "swi", "Quét internal (x)")}<div class="sub">Ký hiệu</div>${CK("SMCO", "tri", "▲▼ Tam giác thuận xu hướng")}${CK("SMCO", "otri", "⚠ Tam giác ngược xu hướng (nhấp nháy)")}${CK("SMCO", "sbox", "Hộp cấu trúc gần nhất")}
      ${CK("O", "thSg", "Hiện tín hiệu SMC hub (Buy/Sell)", 1)}${CK("SMCO", "pro", "Pro — tiếp diễn")}${CK("SMCO", "m", "M — Sweep cấu trúc chính")}${CK("SMCO", "sw", "sw — Sweep internal")}`],
    ["tip", "📐 SMC Tip", `${CK("TIP", "st", "Hiện cấu trúc SMC Tip", 1)}${CK("TIP", "prem", "Vùng H4 Premium / Discount · OTE")}${CK("TIP", "ext", "Vùng H4 Extreme")}${CK("TIP", "fib", "H4 Fibo 0.5")}${CK("TIP", "kb2", "Vùng chờ CL-KB2")}${CK("TIP", "liq", "Thanh khoản $ đỉnh/đáy · EQH / EQL")}${CK("TIP", "tl", "Trendline")}${CK("TIP", "hl", "Nhãn HH / HL / LH / LL")}${CK("TIP", "bos", "BOS / CHoCH")}${CK("TIP", "swp", "✕ Nến quét thanh khoản")}${CK("TIP", "form", "Nến tạo / xác nhận đỉnh đáy")}
      ${CK("TIP", "sg", "Hiện tín hiệu SMC Tip (Buy/Sell) — tách riêng", 1)}${CK("TIP", "fill", "▲▼ Lệnh CL/KB đã khớp")}${CK("TIP", "ord", "Lệnh chờ LIMIT / đang chạy: Entry · SL · TP1")}<div class="note">Bật riêng "tín hiệu" và tắt "cấu trúc" để chỉ xem lệnh Buy/Sell mà không rối chart. Nút SMC trên thanh đầu = bật/tắt cả nhóm.</div>`],
    ["of", "🎯 Tín hiệu Option Flow", `${CK("TIP", "of", "Option Flow (mũi tên BUY/SELL x/5)", 1)}<div class="note">Bull/Bear Trap tại tường · Thủng Put Wall · Squeeze qua Call Wall · HEDGE trap / theo đà. Cần nút Markers trên thanh đầu đang bật.</div>
      ${CK("O", "sig", "Tín hiệu chấm điểm A/B/C (họ TVLB+, khác Option Flow)", 1)}<div class="note" style="margin-top:0">Ký hiệu + hạng trên chart, có hộp SL/TP và thống kê ở trang Backtest. Chưa kiểm định.</div><div class="sub">Hợp lưu Option + SMC</div>${CK("O.k", "conf", "HL — tín hiệu SMC ngay tại mốc Option (tường · Magnet · Flip)")}
      <div class="sub">SMC hub</div>${CK("O.k", "pro", "Pro")}${CK("O.k", "m", "Sweep M")}${CK("O.k", "sw", "Sweep sw")}${SEL("minG", [["C", "Mọi hạng (A, B, C)"], ["B", "Chỉ hạng A + B"], ["A", "Chỉ hạng A"]], "Hạng tối thiểu hiển thị / thống kê")}`],
    ["tp", "📏 TP / SL", `${SEL("tpm", Object.entries(TPM), "🎯 Cách chốt lời (thống kê mọi tín hiệu)")}${CK("O", "wh", "Backtest dùng tường theo TỪNG NGÀY (OI lịch sử, không nhìn trước)")}${SEL("boxn", [[-1, "Hộp SL/TP: Tắt"], [0, "Lệnh gần nhất + hiện tại"], [1, "+ 1 lệnh gần nhất"], [3, "+ 3 lệnh"], [5, "+ 5 lệnh"], [10, "+ 10 lệnh"], [20, "+ 20 lệnh"], [999, "+ Tất cả lệnh"]], "📐 Hộp SL/TP trên chart")}
      ${SEL("slmax", [[0, "SL tối đa: không giới hạn"], [6, "Bỏ lệnh SL > 6$"], [8, "Bỏ lệnh SL > 8$"], [10, "Bỏ lệnh SL > 10$"], [12, "Bỏ lệnh SL > 12$"], [15, "Bỏ lệnh SL > 15$"]], "🛡 SL tối đa")}${SEL("tout", [[24, "Đóng sau 24 nến"], [36, "Đóng sau 36 nến"], [72, "Đóng sau 72 nến"], [144, "Đóng sau 144 nến"], [288, "Đóng sau 288 nến"], [576, "Đóng sau 576 nến"]], "⏱ Hết giờ")}${CK("O", "box", "Hiện hộp SL/TP của tín hiệu HL · SMC hub")}
      <div class="sub">Cơ chế SL/TP gốc của TVLB</div><div class="note"><b>Option Flow:</b> vào giá đóng nến tín hiệu · SL = tường ± 3$ (Trap: râu nến ± 3$; HEDGE: cực trị 3 nến ± 3$) · TP1 = strike kế tiếp theo hướng lệnh · TP2 = strike sau đó (Trap: tường đối diện).<br><b>SMC CL/KB:</b> lệnh LIMIT tại 50% râu nến quét (KB2: vùng FVG/IMB) · SL = râu nến quét ± 3$ · TP1 = mốc cấu trúc gần nhất (bỏ lệnh nếu &lt; 1R, tối đa 3R) · hết hạn sau 6 nến H4.<br>Nhật ký / backtest gốc chỉ tính tới TP1; cùng nến chạm SL và TP thì tính SL.</div>`],
    ["al", "🔔 Cảnh báo", `${CK("O", "snd", "Âm thanh trên máy này", 1)}<div class="sub">Loại cảnh báo</div>${CK("O.al", "sig", "🎯 Tín hiệu mới hạng A–B")}${CK("O.al", "hedge", "🟥 Giá vào vùng Hedge")}${CK("O.al", "div", "📉 Phân kỳ CVD")}${CK("O.al", "news", "📰 Tin đỏ USD (trước 30 & 5 phút)")}
      <div class="sub">Âm thanh</div>${SEL("sty", [["beep", "🔔 Bíp đôi (mặc định)"], ["chime", "🎵 Chuông lên"], ["bell", "🛎 Chuông đơn"], ["siren", "🚨 Còi"], ["voice", "🗣 Giọng đọc tiếng Việt"], ["mute", "🔇 Tắt tiếng"]], "Kiểu")}${CK("O", "diff", "Âm riêng theo hướng (BUY ↑ · SELL ↓)")}<div class="note" style="margin-bottom:0">Âm lượng <b id="mVolV"></b></div><input type="range" min="0" max="100" step="5" data-rng="vol"><button class="pb" id="mTest">▶ Nghe thử</button>
      <div class="sub">Telegram — điện thoại khoá máy vẫn báo</div>${CK("O", "tg", "Gửi cảnh báo về Telegram")}<button class="pb" id="mTg">📨 Gửi tin thử</button><button class="pb" id="mNt">🔔 Cho phép thông báo màn hình</button><div class="note">Lệnh SMC Tip (CL/KB) và Option Flow được máy chủ báo Telegram riêng (config.json → telegram).</div>`],
    ["view", "🖥 Hiển thị", `<div id="mView"></div>${SEL("wst", [[1, "Kiểu 1 · nhãn hai bên (mặc định)"], [2, "Kiểu 2 · nhãn một cột"]], "Cách vẽ tường")}<div class="note">Kiểu 2: mọi nhãn xếp một cột bên trái, nhãn gần nhau tự dịch ngang. Màu theo nguồn: GC cam/vàng, GLD tím (như tài liệu Master Plan). Vạch chia 3 bậc: Call/Put Wall dày và đậm (phân biệt Call hay Put bằng chữ CW/PW trên nhãn); tường lớn (từ 60% trở lên) vừa; tường phụ mảnh, nét đứt, nhạt. Chỉ vẽ tường có nhãn (ô "Vạch strike phụ" bên dưới không áp dụng).</div>${CK("O", "minor", "Vạch strike phụ (nét đứt không tên)")}${SEL("topn", [[10, "10 tường có nhãn mỗi nguồn (mặc định)"], [6, "6 tường"], [5, "5 tường"], [4, "4 tường"], [3, "3 tường"], [2, "2 tường (chỉ tường lớn nhất)"]], "Số tường có nhãn mỗi nguồn (GC / GLD) — Call/Put Wall luôn hiện")}`],
  ];
  function objOf(o) { return o === "O" ? O : o === "O.k" ? O.k : o === "O.al" ? O.al : o === "SMCO" ? SMCO : TIP; }
  function menuSync() {
    const pm = document.querySelector("#tvlbPlus .pm"); if (!pm) return;
    pm.querySelectorAll("[data-o]").forEach((c) => { c.checked = !!objOf(c.dataset.o)[c.dataset.kk]; });
    pm.querySelectorAll("[data-sel]").forEach((s_) => { s_.value = String(O[s_.dataset.sel]); });
    const r = pm.querySelector("[data-rng=vol]"); if (r) { r.value = O.vol; pm.querySelector("#mVolV").textContent = O.vol + "%"; }
  }
  function menu() {
    const pm = document.querySelector("#tvlbPlus .pm"); if (!pm || !pm.querySelector("[data-k=tips]") || !pm.querySelector("#v3m")) return false; if (pm.querySelector(".grp")) return true;
    const old = { btns: [...pm.querySelectorAll("button[data-k]")], gh: pm.querySelector("#pGh"), ghu: pm.querySelector("#pGhUrl"), v3: pm.querySelector("#v3m") };
    const box_ = document.createElement("div");
    box_.innerHTML = GROUPS.map(([id, t, body]) => `<div class="grp${MS[id] ? " open" : ""}" data-g="${id}"><button class="gh" type="button">${t}<span class="ar">${MS[id] ? "▾" : "▸"}</span></button><div class="gb">${body}</div></div>`).join("");
    pm.innerHTML = '<h3>TVLB+</h3>'; pm.appendChild(box_);
    const view = pm.querySelector("#mView");
    old.btns.forEach((b) => view.appendChild(b)); if (old.v3) [...old.v3.querySelectorAll("button")].forEach((b) => view.appendChild(b));
    if (old.gh) { const n = document.createElement("div"); n.className = "note"; n.textContent = "Web xem trên điện thoại"; view.appendChild(n); view.appendChild(old.gh); if (old.ghu) view.appendChild(old.ghu); }
    const tail = document.createElement("div"); tail.className = "note"; tail.textContent = "Menu chỉ hiện khi rê chuột sát mép trái màn hình. Bấm tên nhóm để mở / đóng."; pm.appendChild(tail);
    pm.querySelectorAll(".gh").forEach((h) => { h.onclick = () => { const g = h.parentElement, id = g.dataset.g; g.classList.toggle("open"); MS[id] = g.classList.contains("open"); h.querySelector(".ar").textContent = MS[id] ? "▾" : "▸"; st_.set("menuopen", MS); }; });
    pm.querySelectorAll("[data-o]").forEach((c) => { c.onchange = () => { objOf(c.dataset.o)[c.dataset.kk] = c.checked;
      if (c.dataset.o === "TIP") { saveTip(); tipSync(); } else saveO();
      if (c.dataset.kk === "minor") { window.TVLB_MINOR = c.checked; try { drawOverlay(); } catch (e) { } }
      if (["O.k", "O"].includes(c.dataset.o) && ["wall", "oh", "oht", "conf", "pro", "m", "sw"].includes(c.dataset.kk)) key = "";
      tick(); draw(); }; });
    pm.querySelectorAll("[data-sel]").forEach((s_) => { s_.onchange = () => { const v = s_.value; O[s_.dataset.sel] = isNaN(+v) ? v : +v; saveO(); if (s_.dataset.sel === "topn") { window.TVLB_TOPN = O.topn; try { drawOverlay(); } catch (e) { } }
      if (s_.dataset.sel === "wst") { window.TVLB_WALLSTYLE = O.wst === 2 ? "old" : "tvlb"; try { drawOverlay(); } catch (e) { } } key = ""; tick(); }; });
    const rg = pm.querySelector("[data-rng=vol]"); rg.oninput = () => { O.vol = +rg.value; pm.querySelector("#mVolV").textContent = O.vol + "%"; saveO(); };
    pm.querySelector("#mTest").onclick = () => beep(false, null, "TVLB cảnh báo thử");
    pm.querySelector("#mNt").onclick = () => { try { Notification.requestPermission(); } catch (e) { } beep(false); };
    pm.querySelector("#mTg").onclick = async (e) => { const b = e.currentTarget; try { const r = await (await fetch("/api/tg", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "🔔 TVLB+: tin thử cảnh báo" }) })).json(); b.textContent = r.ok ? "✅ Đã gửi — xem Telegram" : "❌ " + (r.err || "lỗi"); } catch (err) { b.textContent = "❌ Không nối được máy chủ TVLB"; } setTimeout(() => (b.textContent = "📨 Gửi tin thử"), 4000); };
    menuSync(); return true;
  }
  (function m(k) { if (!menu() && k < 60) setTimeout(() => m(k + 1), 250); })(0);
  setInterval(() => { const hide = st_.get("p3", true) === false || st_.get("shot", false); btn.style.display = btn5.style.display = hide ? "none" : "";
    if (hide && (!page.hidden || !page5.hidden)) { const b1 = bar.querySelector('[data-pg="1"]'); if (b1) b1.click(); } }, 1000);
  // ───────────────────── vòng chạy ─────────────────────
  let key = "";
  function tick() {
    try {
      if (typeof S === "undefined" || !S.candles || S.candles.length < 40 || !S.state) return;
      if (Date.now() - whAt > 30 * 60 * 1000) loadWH();
      bars = S.candles; spot = lastPrice(); L = levels(); flipV = (L.find((l) => l.key === "FLIP") || {}).xau ?? null;
      const k = `${S.tf}|${bars.length}|${bars[bars.length - 2].time}|${L.length}|${S.state.options_updated || ""}|${WH.length}|${O.wh}`;
      if (k !== key) { key = k; smcCalc(); buildSignals(); buildAll(); calcRx(); fwdUpdate(); }
      alertChecks(); render4(); draw();
    } catch (e) { console.error("TVLB tín hiệu:", e); }
  }
  setInterval(tick, 2000); setTimeout(tick, 3000);
  bar.addEventListener("click", () => setTimeout(() => { key = ""; tick(); }, 60));
  // ── số phiên bản (để biết đang chạy bản nào) ──
  const WEB_VER = "web 15 · 08/11";
  window.TVLB_WEB_VER = WEB_VER;
  function showVer() { fetch(API("/api/version")).then((r) => r.json()).then((v) => { const t = `${WEB_VER} · máy chủ ${v.version || "?"}`;
      const e = document.querySelector("#t5ver"); if (e) e.textContent = t; const h = document.querySelector("#tvlbPlus .pm h3"); if (h) h.innerHTML = `TVLB+ <span style="font-size:10px;font-weight:400;opacity:.7">${t}</span>`; })
    .catch(() => { const e = document.querySelector("#t5ver"); if (e) e.textContent = WEB_VER + " · máy chủ ?"; }); }
  setTimeout(showVer, 2500); setInterval(showVer, 10 * 60 * 1000);
  window.tvlbSig = () => ({ SIG, TH, RX, FWD });
})();

/* ═══════════════ va_142b · CHART MỞ RỘNG + KHUNG TUẦN/THÁNG (ghi 22/11/2026) ═══════════════
   ① Nút "⤢ Mở rộng" trên thanh khung giờ: chart giãn sang phải; cột bảng bên phải thu thành MỘT CỘT TIÊU ĐỀ (chữ dọc).
      BẤM vào tiêu đề nào thì bảng đó bật ra (bấm lại, bấm ra ngoài hoặc Esc để đóng); bấm "⤡ Thu gọn" thì về đúng như bình thường.
      Chỉ đổi cách XẾP; không đổi số liệu nào. Lựa chọn nhớ qua F5 (localStorage "tvlb.wide"). Màn hình dưới 1000 px: không có chế độ này.
   ② Thêm nút khung "1W" (Tuần) và "1M" (Tháng) vào #tfs. Gộp từ nến 1h theo ngày giao dịch neo 18:00 New York (giống D1):
      tuần = Thứ 2→Thứ 6 của ngày giao dịch, tháng = tháng lịch của ngày giao dịch. GIẢ ĐỊNH, chưa đối chiếu TradingView.
      Lịch sử lùi ~840 ngày, không bị giới hạn bởi smc.h4_from (tối đa ~2,3 năm nếu nguồn giá có dữ liệu đó). Tín hiệu trên khung này không có ý nghĩa (vùng ±4$ so với nến ~100$): chỉ để XEM.
   (Chế độ 2 chart đã bỏ theo yêu cầu.) */
(function () {
  "use strict";
  if (window.__tvlb142) return;
  window.__tvlb142 = true;
  const q = (s) => document.querySelector(s);
  const K = { get(k, d) { try { const v = localStorage.getItem("tvlb." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem("tvlb." + k, JSON.stringify(v)); } catch (e) { } } };
  const chartCol = q(".chartcol"), aside = q(".right");
  if (!chartCol || !aside) return;
  const host = chartCol.parentElement, pgbar = q("#pgbar"), bar2 = q(".bar2") || (q("#tfs") && q("#tfs").parentElement);
  host.classList.add("tvlb-wgrid");

  // ───────────── CSS ─────────────
  const css = document.createElement("style");
  css.textContent = `
.wtools{display:flex;gap:6px;align-items:center;margin-right:auto;margin-left:-2px}
.wtools button{padding:3px 11px;font:600 13px var(--f-label)}
.wtools button.on{background:var(--gold);color:#1b1407;border-color:var(--gold)}
.wrail{display:none}
html.tvlb-wide .tvlb-wgrid{grid-template-columns:minmax(0,1fr) 38px}
html.tvlb-wide .wrail{display:flex;flex-direction:column;gap:6px;align-items:stretch;min-width:0;overflow:hidden}
.wrail button{writing-mode:vertical-rl;transform:rotate(180deg);flex:0 0 auto;padding:10px 4px;font:600 12px var(--f-label);letter-spacing:.06em;color:var(--muted);background:var(--bg-2);border:1px solid var(--line);border-radius:5px;cursor:pointer;white-space:nowrap}
.wrail button:hover,.wrail button.on{color:#1b1407;background:var(--gold);border-color:var(--gold)}
html.tvlb-wide .right{display:flex;flex-direction:column;position:fixed;z-index:30;width:min(820px,64vw);max-width:calc(100vw - 70px);overflow:auto;background:var(--bg);border:1px solid var(--gold);border-radius:6px;padding:8px;box-shadow:0 10px 30px rgba(0,0,0,.65);visibility:hidden;opacity:0;pointer-events:none;transition:opacity .12s}
html.tvlb-wide .right.fly{visibility:visible;opacity:1;pointer-events:auto}
`;
  document.head.appendChild(css);

  // ───────────── nút trên thanh khung giờ ─────────────
  const tools = document.createElement("div"); tools.className = "wtools";
  tools.innerHTML = '<button type="button" class="ghost small" id="wBtn"></button>';
  const tfsEl = q("#tfs");
  if (tfsEl && tfsEl.parentElement === bar2) tfsEl.after(tools);   // ngay cạnh khung 1M
  else if (bar2) bar2.insertBefore(tools, bar2.lastElementChild); else chartCol.insertBefore(tools, chartCol.firstChild);
  const wBtn = q("#wBtn");

  // ───────────── cột tiêu đề + bảng bật ra khi rê chuột ─────────────
  const rail = document.createElement("div"); rail.className = "wrail"; host.appendChild(rail);
  let flyTimer = null, railSig = "";
  const pgBtns = () => (pgbar ? [...pgbar.querySelectorAll("button[data-pg]")].filter((b) => b.style.display !== "none") : []);
  function buildRail() {
    const bs = pgBtns(), sig = bs.map((b) => b.dataset.pg + "|" + b.textContent).join("¦");
    if (sig === railSig) return; railSig = sig; rail.innerHTML = "";
    const items = bs.length ? bs.map((b) => [b.dataset.pg, b.textContent.trim()]) : [["", "Bảng điều khiển"]];
    items.forEach(([pg, t]) => {
      const x = document.createElement("button"); x.type = "button"; x.dataset.pg = pg; x.textContent = t; x.title = t;
      x.addEventListener("click", (e) => { e.stopPropagation(); if (aside.classList.contains("fly") && x.classList.contains("on")) hideFly(); else openFly(pg); });
      rail.appendChild(x);
    });
  }
  function placeFly() {
    const r = rail.getBoundingClientRect(), top = Math.max(8, r.top);
    aside.style.top = top + "px"; aside.style.right = Math.max(8, window.innerWidth - r.left + 6) + "px"; aside.style.left = "auto"; aside.style.bottom = "auto";
    aside.style.maxHeight = ""; aside.style.height = Math.max(240, window.innerHeight - top - 12) + "px";   // cao đủ như lúc thu gọn
  }
  function openFly(pg) {
    clearTimeout(flyTimer);
    const b = pg && pgbar ? pgbar.querySelector('button[data-pg="' + pg + '"]') : null; if (b) b.click();   // dùng đúng cơ chế đổi trang có sẵn
    placeFly(); aside.classList.add("fly");
    rail.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x.dataset.pg === pg));
  }
  function hideFly() { aside.classList.remove("fly"); rail.querySelectorAll("button").forEach((x) => x.classList.remove("on")); }
  function schedHide() {
    clearTimeout(flyTimer);
    flyTimer = setTimeout(() => { const a = document.activeElement; if (a && aside.contains(a) && /^(SELECT|INPUT|TEXTAREA)$/.test(a.tagName)) return; hideFly(); }, 350);   // đang chọn trong ô thả xuống thì giữ nguyên
  }
  document.addEventListener("mousedown", (e) => { if (aside.classList.contains("fly") && !aside.contains(e.target) && !rail.contains(e.target)) hideFly(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideFly(); });
  setInterval(() => { if (document.documentElement.classList.contains("tvlb-wide")) buildRail(); }, 2000);

  // ───────────── khung Tuần / Tháng ─────────────
  (function () {
    if (typeof SMC === "undefined" || typeof AGG === "undefined" || typeof TF_SEC === "undefined" || !SMC.aggregate || !SMC.bucketOf) return;
    const WM_BACK_DAYS = 840;   // tuần/tháng lùi ~2,3 năm (app.js chỉ tải tối đa ~21000 nến 1h ≈ 2,4 năm); không đổi h4_from của các khung khác
    const WSEC = 604800, MSEC = 2592000;   // MSEC chỉ là "mã" cho tháng (độ dài thật thay đổi)
    const isW = (s) => s === WSEC || s === MSEC;
    const labelDay = (t) => new Date((t + 10800) * 1000);   // ngày giao dịch (giờ mở nến neo 18:00 NY → +3h rơi sang ngày kế)
    const keyOf = (t, sec) => { const d = labelDay(t); if (sec === MSEC) return d.getUTCFullYear() * 100 + d.getUTCMonth(); const m = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000; return Math.floor(m - ((new Date(m * 86400000).getUTCDay() + 6) % 7)); };
    const oBucket = SMC.bucketOf.bind(SMC), oAgg = SMC.aggregate.bind(SMC);
    // đầu nến tuần/tháng = đầu nến NGÀY sớm nhất cùng tuần/tháng (lùi từng ngày giao dịch, an toàn với đổi giờ mùa hè)
    SMC.bucketOf = function (ts, sec) {
      if (!isW(sec)) return oBucket(ts, sec);
      let b = oBucket(ts, 86400); const k = keyOf(b, sec);
      for (let i = 0; i < 40; i++) { const p = oBucket(b - 1, 86400); if (p >= b || keyOf(p, sec) !== k) break; b = p; }
      return b;
    };
    SMC.aggregate = function (rows, sec) {
      if (!isW(sec)) return oAgg(rows, sec);
      const days = oAgg(rows, 86400), out = []; let k = null, cur = null;
      for (const r of days) {
        const kk = keyOf(r.time, sec);
        if (kk !== k || !cur) { cur = Object.assign({}, r); out.push(cur); k = kk; }
        else { cur.high = Math.max(cur.high, r.high); cur.low = Math.min(cur.low, r.low); cur.close = r.close; cur.vol = (+cur.vol || 0) + (+r.vol || 0); cur.delta = (+cur.delta || 0) + (+r.delta || 0); }
      }
      return out;
    };
    // khung tuần/tháng không được lùi theo "ltf_bars" (sẽ đòi dữ liệu từ nhiều năm trước): chỉ lấy từ mốc h4_from
    if (typeof SMC.ltfStart === "function") { const oLtf = SMC.ltfStart.bind(SMC); SMC.ltfStart = function (now, sec, bars, h4) { return isW(sec) ? Math.min(h4, now - WM_BACK_DAYS * 86400) : oLtf(now, sec, bars, h4); }; }
    TF_SEC["1w"] = WSEC; AGG["1w"] = WSEC; TF_SEC["1M"] = MSEC; AGG["1M"] = MSEC;
    const tfs = q("#tfs"); if (!tfs || tfs.querySelector('[data-tf="1w"]')) return;
    const last = tfs.lastElementChild;
    [["1w", "1W"], ["1M", "1M"]].forEach(([tf, name]) => {
      const b = document.createElement("button"); b.type = "button"; b.dataset.tf = tf; b.textContent = name;
      b.title = (tf === "1w" ? "Tuần" : "Tháng") + " — gộp từ nến 1h, chỉ để xem (tín hiệu không có ý nghĩa ở khung này)";
      if (last && last.className) b.className = last.className; tfs.appendChild(b);
    });
    // nút đã lưu từ lần trước (nếu đang ở 1w/1M) được app.js đánh dấu "on" khi khởi động; nếu nút chưa có lúc đó thì bật lại ở đây
    tfs.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x.dataset.tf === S.tf));
  })();

  // ───────────── áp dụng chế độ ─────────────
  const pref = { wide: !!K.get("wide", false) };
  function apply() {
    const W = window.innerWidth, w = pref.wide && W >= 1000, de = document.documentElement;
    de.classList.toggle("tvlb-wide", w);
    wBtn.textContent = w ? "⤡" : "⤢"; wBtn.classList.toggle("on", w); wBtn.disabled = !w && W < 1000;
    wBtn.title = W < 1000 && !w ? "Màn hình quá hẹp để mở rộng (cần ≥ 1000 px)" : w ? "Thu gọn: về bố cục bình thường" : "Mở rộng: chart giãn sang phải; bảng bên phải thu thành cột tiêu đề, bấm vào tiêu đề để mở";
    if (w) buildRail(); else { hideFly(); ["top", "right", "left", "bottom", "maxHeight", "height"].forEach((k) => { aside.style[k] = ""; }); }
  }
  wBtn.addEventListener("click", () => { pref.wide = !pref.wide; K.set("wide", pref.wide); apply(); setTimeout(() => window.dispatchEvent(new Event("resize")), 60); });
  let rz = null; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(apply, 200); });
  apply();
})();

/* ═══════════════ va_143 · CÔNG CỤ VẼ KIỂU TRADINGVIEW (ghi 26/11/2026; va_143b: crosshair chạy theo chuột khi kéo; va_143c: thanh tuỳ chỉnh nổi khi chọn hình, hộp có chấm giữa cạnh) ═══════════════
   Thanh công cụ ngay sau nút ⤢ trên hàng khung giờ:
   ↖ chọn/sửa · ― đường ngang · │ đường dọc · ╱ đường xu hướng · ➚ mũi tên · ▭ hộp · 〰 đường dẫn (nhiều điểm)
   · ⇕ đo khoảng cách giá · L / S hộp lệnh Long / Short (Entry · SL · TP · R:R) · 🧲 hút vào giá OHLC · 🎨 đổi màu · 🗑 xoá.
   Mỗi hình lưu theo THỜI GIAN + GIÁ (không theo số thứ tự nến) nên đổi khung giờ vẫn đúng chỗ. Lưu trong trình duyệt (localStorage "tvlb.draw").
   Chỉ là hình vẽ tay, KHÔNG đổi số liệu, tín hiệu hay lệnh nào của dashboard. Phím: Esc huỷ · Delete xoá hình đang chọn ·
   Alt+H ngang · Alt+V dọc · Alt+T xu hướng · Alt+R hộp · Alt+M đo giá · Shift + kéo chuột = đo nhanh (tự mất khi bấm lần sau). */
(function () {
  "use strict";
  if (window.__tvlb143) return;
  window.__tvlb143 = true;
  const q = (s) => document.querySelector(s);
  const K = { get(k, d) { try { const v = localStorage.getItem("tvlb." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem("tvlb." + k, JSON.stringify(v)); } catch (e) { } } };
  const COLS = ["#4fc3f7", "#ffd54f", "#ef5350", "#26a69a", "#ce93d8", "#ffffff", "#ff9800"];
  const NEED = { hline: 1, vline: 1, trend: 2, arrow: 2, rect: 2, range: 2, long: 1, short: 1, path: 99 };
  const NAME = { hline: "Đường ngang", vline: "Đường dọc", trend: "Đường xu hướng", arrow: "Mũi tên", rect: "Hộp", range: "Đo giá", long: "Lệnh Long", short: "Lệnh Short", path: "Đường dẫn" };
  const ICON = {
    sel: '<path d="M5 3l11 6-5 1.5L9 16z" fill="currentColor"/>',
    hline: '<path d="M2 10h16" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="10" r="2" fill="currentColor"/>',
    vline: '<path d="M10 2v16" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="10" r="2" fill="currentColor"/>',
    trend: '<path d="M4 16L16 4" stroke="currentColor" stroke-width="1.6"/><circle cx="4" cy="16" r="2" fill="currentColor"/><circle cx="16" cy="4" r="2" fill="currentColor"/>',
    arrow: '<path d="M4 16L15 5M9 5h6v6" stroke="currentColor" stroke-width="1.8" fill="none"/>',
    rect: '<rect x="4" y="5" width="12" height="10" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="4" cy="5" r="1.7" fill="currentColor"/><circle cx="16" cy="15" r="1.7" fill="currentColor"/>',
    path: '<path d="M2 14l4-6 4 4 4-7 4 4" stroke="currentColor" stroke-width="1.6" fill="none"/>',
    range: '<path d="M5 3h10M5 17h10M10 4v12M7.5 6.5L10 4l2.5 2.5M7.5 13.5L10 16l2.5-2.5" stroke="currentColor" stroke-width="1.5" fill="none"/>',
    long: '<rect x="3" y="3" width="14" height="7" fill="rgba(38,166,154,.55)"/><rect x="3" y="10" width="14" height="5" fill="rgba(239,83,80,.55)"/><text x="10" y="9" font-size="7" text-anchor="middle" fill="#fff" font-weight="700">L</text>',
    short: '<rect x="3" y="3" width="14" height="5" fill="rgba(239,83,80,.55)"/><rect x="3" y="8" width="14" height="8" fill="rgba(38,166,154,.55)"/><text x="10" y="14.5" font-size="7" text-anchor="middle" fill="#fff" font-weight="700">S</text>',
    mag: '<path d="M5 3v7a5 5 0 0010 0V3h-3v7a2 2 0 01-4 0V3z" fill="currentColor"/>',
    col: '<circle cx="10" cy="10" r="6" fill="currentColor"/>',
    del: '<path d="M5 6h10M8 6V4h4v2M6 6l1 11h6l1-11" stroke="currentColor" stroke-width="1.5" fill="none"/>',
  };
  const TIP = {
    sel: "Chọn / sửa hình (Esc). Bấm vào hình để chọn, kéo chấm tròn để sửa, kéo thân hình để dời.",
    hline: "Đường ngang (Alt+H): bấm 1 lần vào giá cần đánh dấu", vline: "Đường dọc (Alt+V): bấm 1 lần vào thời điểm cần đánh dấu",
    trend: "Đường xu hướng (Alt+T): bấm điểm đầu rồi điểm cuối (hoặc kéo chuột)", arrow: "Mũi tên: bấm điểm đầu rồi điểm mũi tên chỉ tới",
    rect: "Hộp (Alt+R): bấm góc thứ nhất rồi góc đối diện", path: "Đường dẫn: bấm từng điểm; bấm đúp, Enter hoặc chuột phải để kết thúc",
    range: "Đo khoảng cách giá (Alt+M): bấm điểm đầu rồi điểm cuối → hiện chênh $, %, số nến, thời gian. Mẹo: giữ Shift rồi kéo chuột để đo nhanh",
    long: "Hộp lệnh LONG: bấm vào giá vào lệnh → tự đặt SL và TP (2R). Kéo cạnh xanh (TP) / đỏ (SL) / chấm phải (độ dài) để chỉnh",
    short: "Hộp lệnh SHORT: bấm vào giá vào lệnh → tự đặt SL và TP (2R). Kéo cạnh xanh (TP) / đỏ (SL) / chấm phải (độ dài) để chỉnh",
    mag: "Hút vào giá nến: điểm vẽ tự bắt vào Mở/Cao/Thấp/Đóng của nến gần nhất (trong 10 px)",
    col: "Đổi màu hình đang chọn (chưa chọn hình nào thì đổi màu cho hình vẽ tiếp theo)",
    del: "Xoá hình đang chọn (phím Delete). Chưa chọn hình nào thì hỏi xoá TẤT CẢ hình vẽ",
  };
  let D = K.get("draw", []), curW = 9999;
  if (!Array.isArray(D)) D = [];
  const P = Object.assign({ mag: false, col: 0 }, K.get("drawopt", {}));
  let tool = null, sel = null, draft = null, drag = null, temp = null, hover = null, lastPos = null;
  const save = () => { K.set("draw", D); K.set("drawopt", P); };
  const nid = () => "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function start(k) {
    if (typeof chart === "undefined" || !chart || typeof candleS === "undefined" || !candleS || !q("#chartWrap") || !q("#wBtn")) { if (k < 80) setTimeout(() => start(k + 1), 500); return; }
    init();
  }
  setTimeout(() => start(0), 800);

  function init() {
    const wrap = q("#chartWrap");
    // ───────── CSS ─────────
    const css = document.createElement("style");
    css.textContent = `.dtools{display:flex;gap:2px;align-items:center;margin-left:8px;padding-left:8px;border-left:1px solid var(--line,#2b3440);flex-wrap:wrap}
.dtools button{padding:2px 4px!important;min-width:26px;height:24px;display:inline-flex;align-items:center;justify-content:center;color:#b8c2cf;background:transparent;border:1px solid transparent;border-radius:4px;cursor:pointer}
.dtools button:hover{background:#1c2430;border-color:#2b3440;color:#fff}
.dtools button.on{background:var(--gold,#e0a83a);color:#1b1407;border-color:var(--gold,#e0a83a)}
.dtools button svg{width:18px;height:18px;display:block}
.dtools .dsep{width:1px;height:16px;background:#2b3440;margin:0 3px}
#ovDraw{position:absolute;left:0;top:0;pointer-events:none;z-index:8}
html.dt-tool #chartWrap{cursor:crosshair}`;
    document.head.appendChild(css);
    // ───────── thanh công cụ ─────────
    const bar = document.createElement("div"); bar.className = "dtools";
    const order = ["sel", "|", "hline", "vline", "trend", "arrow", "rect", "path", "|", "range", "long", "short", "|", "mag", "del"];
    bar.innerHTML = order.map((k) => k === "|" ? '<span class="dsep"></span>' : `<button type="button" data-dt="${k}" title="${TIP[k]}"><svg viewBox="0 0 20 20">${ICON[k]}</svg></button>`).join("");
    const wt = q("#wBtn").parentElement; wt.appendChild(bar);
    bar.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-dt]"); if (!b) return; const k = b.dataset.dt;
      if (k === "sel") setTool(null);
      else if (k === "mag") { P.mag = !P.mag; save(); }
      else if (k === "col") { P.col = (P.col + 1) % COLS.length; if (sel) { const d = D.find((x) => x.id === sel); if (d) d.col = COLS[P.col]; } save(); }
      else if (k === "del") delSel(true);
      else setTool(tool === k ? null : k);
      sync(); kick();
    });
    function sync() {
      bar.querySelectorAll("button[data-dt]").forEach((b) => { const k = b.dataset.dt; b.classList.toggle("on", k === "sel" ? !tool : k === "mag" ? P.mag : k === tool); });
      const c = bar.querySelector('[data-dt="col"]'); if (c) c.style.color = COLS[P.col];
      document.documentElement.classList.toggle("dt-tool", !!tool);
    }
    // ───────── canvas vẽ ─────────
    const cv = document.createElement("canvas"); cv.id = "ovDraw"; wrap.appendChild(cv);
    const cx = cv.getContext("2d"); let dpr = 1;
    const fit = () => { const r = wrap.getBoundingClientRect(); dpr = window.devicePixelRatio || 1; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); cv.style.width = r.width + "px"; cv.style.height = r.height + "px"; draw(); };
    new ResizeObserver(fit).observe(wrap); fit();
    let rq = false; const kickF = () => { if (rq) return; rq = true; requestAnimationFrame(() => { rq = false; draw(); }); };
    kick = kickF;
    try { chart.timeScale().subscribeVisibleLogicalRangeChange(kickF); } catch (e) { }
    setInterval(draw, 300);   // thang giá tự co giãn → vẽ lại định kỳ

    // ───────── đổi toạ độ: thời gian ↔ x, giá ↔ y ─────────
    const C = () => (typeof S !== "undefined" && S.candles) || [];
    const tfs = () => (typeof TF_SEC !== "undefined" && TF_SEC[S.tf]) || 300;
    function t2l(t) {   // thời gian (giây) → chỉ số nến (có phần lẻ)
      const c = C(), n = c.length; if (!n) return null;
      if (t <= c[0].time) return (t - c[0].time) / tfs();
      if (t >= c[n - 1].time) return n - 1 + (t - c[n - 1].time) / tfs();
      let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m].time <= t) lo = m; else hi = m; }
      const g = c[hi].time - c[lo].time; return lo + (g > 0 ? Math.min(1, (t - c[lo].time) / g) : 0);
    }
    function l2t(l) {   // chỉ số nến → thời gian
      const c = C(), n = c.length; if (!n || l == null) return null;
      if (l <= 0) return c[0].time + l * tfs();
      if (l >= n - 1) return c[n - 1].time + (l - (n - 1)) * tfs();
      const i = Math.floor(l), f = l - i; return c[i].time + f * (c[i + 1].time - c[i].time);
    }
    function l2x(l) {
      if (l == null) return null; const ts = chart.timeScale(), i = Math.floor(l), a = ts.logicalToCoordinate(i), b = ts.logicalToCoordinate(i + 1);
      if (a == null) return null; return b == null ? a : a + (l - i) * (b - a);
    }
    const tx = (t) => l2x(t2l(t)), py = (p) => candleS.priceToCoordinate(p);
    function x2t(x) { const ts = chart.timeScale(); let l = ts.coordinateToLogical(x); if (l == null) return null;
      const i = Math.floor(l), a = ts.logicalToCoordinate(i), b = ts.logicalToCoordinate(i + 1);   // đảm bảo có phần lẻ dù thư viện làm tròn
      if (a != null && b != null && b !== a) l = i + (x - a) / (b - a); return l2t(l); }
    const yp = (y) => candleS.coordinateToPrice(y);
    const area = () => { const W = cv.width / dpr, H = cv.height / dpr; let ps = 70; try { ps = chart.priceScale("right").width() || 70; } catch (e) { } let th = 28; try { th = chart.timeScale().height() || 28; } catch (e) { } return { w: W - ps, h: H - th, W, H }; };
    function snap(x, y) {   // 🧲 hút vào giá Mở/Cao/Thấp/Đóng của nến gần nhất
      let t = x2t(x), p = yp(y); if (t == null || p == null) return null;
      if (P.mag) { const c = C(), l = Math.round(t2l(t)); const b = c[Math.max(0, Math.min(c.length - 1, l))];
        if (b && Math.abs(l2x(Math.max(0, Math.min(c.length - 1, l))) - x) < 14) { let best = null;
          [b.open, b.high, b.low, b.close].forEach((v) => { const d = Math.abs(py(v) - y); if (d < 10 && (!best || d < best.d)) best = { d, v }; });
          if (best) { p = best.v; t = b.time; } } }
      return { t, p };
    }
    // ───────── định dạng ─────────
    const f2 = (v) => (v == null || !isFinite(v) ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    const tz = typeof TZ !== "undefined" ? TZ : 7 * 3600;
    const clk = (t) => { const d = new Date((t + tz) * 1000), z = (n) => String(n).padStart(2, "0"); return `${z(d.getUTCDate())}/${z(d.getUTCMonth() + 1)} ${z(d.getUTCHours())}:${z(d.getUTCMinutes())}`; };
    const dur = (s) => { s = Math.abs(s); const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.round((s % 3600) / 60); return (d ? d + "n " : "") + (h ? h + "g " : "") + (d ? "" : m + "p"); };
    function label(x, y, txt, bg, fg, align) {
      cx.font = "600 11px 'IBM Plex Mono', monospace"; const lines = String(txt).split("\n"), w = Math.max(...lines.map((s) => cx.measureText(s).width)) + 10, h = 15 * lines.length + 3;
      let x0 = align === "right" ? x - w : align === "center" ? x - w / 2 : x; x0 = Math.max(2, Math.min(x0, curW - w - 2)); const y0 = y - h / 2;
      cx.fillStyle = bg; cx.beginPath(); cx.roundRect ? cx.roundRect(x0, y0, w, h, 3) : cx.rect(x0, y0, w, h); cx.fill();
      cx.fillStyle = fg || "#fff"; cx.textAlign = "left"; cx.textBaseline = "middle"; lines.forEach((s, i) => cx.fillText(s, x0 + 5, y0 + 9 + i * 15));
    }
    const dot = (x, y, col) => { cx.setLineDash([]); cx.lineWidth = 1.6; cx.fillStyle = "#0b0e12"; cx.strokeStyle = col; cx.lineWidth = 1.6; cx.beginPath(); cx.arc(x, y, 4.5, 0, 7); cx.fill(); cx.stroke(); };
    const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
    // hộp lệnh: pts[0] = {t, p: giá vào}, d.t2 = thời điểm cạnh phải, d.sl, d.tp
    function posGeom(d) { const x0 = tx(d.pts[0].t), x1 = tx(d.t2), ye = py(d.pts[0].p), ys = py(d.sl), yt = py(d.tp); return { x0, x1, ye, ys, yt }; }

    // ───────── vẽ ─────────
    function shape(d, a, act) {
      const col = d.col || COLS[0], pts = d.pts.map((p) => ({ x: tx(p.t), y: py(p.p) })), ok = pts.every((p) => p.x != null && p.y != null);
      const lcol = d.la != null && d.la < 1 ? rgba(col, d.la) : col; cx.strokeStyle = lcol; cx.fillStyle = lcol; const lw = d.w || 1.5; cx.lineWidth = act ? lw + 0.5 : lw; cx.setLineDash(d.dash === "dash" ? [7, 4] : d.dash === "dot" ? [2, 3] : []);
      const handles = [];
      if (d.type === "hline") { const y = py(d.pts[0].p); if (y == null) return; cx.beginPath(); cx.moveTo(0, y); cx.lineTo(a.w, y); cx.stroke(); label(a.w - 2, y, f2(d.pts[0].p), col, "#0b0e12", "right"); handles.push([a.w / 2, y]); }
      else if (d.type === "vline") { const x = tx(d.pts[0].t); if (x == null) return; cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, a.h); cx.stroke(); label(x, a.h - 10, clk(d.pts[0].t), col, "#0b0e12", "center"); handles.push([x, a.h / 2]); }
      else if ((d.type === "trend" || d.type === "arrow" || d.type === "path") && ok && pts.length) {
        cx.beginPath(); pts.forEach((p, i) => (i ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y))); if (d === draft && lastPos && d.type === "path") cx.lineTo(lastPos.x, lastPos.y); cx.stroke();
        if (d.type === "trend" && d.ext && pts.length === 2 && pts[1].x !== pts[0].x) { const [A, B] = pts, k = (B.y - A.y) / (B.x - A.x), xe = B.x > A.x ? a.w : 0; cx.beginPath(); cx.moveTo(B.x, B.y); cx.lineTo(xe, B.y + k * (xe - B.x)); cx.stroke(); }
        if (d.type === "arrow" && pts.length > 1) { const A = pts[pts.length - 2], B = pts[pts.length - 1], an = Math.atan2(B.y - A.y, B.x - A.x), L = 12;
          cx.beginPath(); cx.moveTo(B.x, B.y); cx.lineTo(B.x - L * Math.cos(an - 0.45), B.y - L * Math.sin(an - 0.45)); cx.lineTo(B.x - L * Math.cos(an + 0.45), B.y - L * Math.sin(an + 0.45)); cx.closePath(); cx.fill(); }
        pts.forEach((p) => handles.push([p.x, p.y])); }
      else if ((d.type === "rect" || d.type === "range") && ok && pts.length === 2) {
        const [A, B] = pts, x0 = Math.min(A.x, B.x), y0 = Math.min(A.y, B.y), w = Math.abs(B.x - A.x), h = Math.abs(B.y - A.y);
        if (d.type === "rect") { cx.fillStyle = rgba(d.fill || col, d.fa ?? 0.13); cx.fillRect(x0, y0, w, h); cx.strokeRect(x0, y0, w, h); handles.push([A.x, A.y], [B.x, B.y], [A.x, B.y], [B.x, A.y], [x0 + w / 2, y0], [x0 + w / 2, y0 + h], [x0, y0 + h / 2], [x0 + w, y0 + h / 2]); }
        else { const up = d.pts[1].p >= d.pts[0].p, c2 = up ? "#26a69a" : "#ef5350", dp = d.pts[1].p - d.pts[0].p, pc = (100 * dp) / d.pts[0].p, dt = d.pts[1].t - d.pts[0].t, nb = Math.round(t2l(d.pts[1].t) - t2l(d.pts[0].t));
          cx.fillStyle = rgba(c2, 0.16); cx.fillRect(x0, y0, w, h); cx.strokeStyle = c2; cx.lineWidth = 1; cx.strokeRect(x0, y0, w, h);
          const mx = (A.x + B.x) / 2; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(mx, A.y); cx.lineTo(mx, B.y); cx.stroke();
          const s = up ? -1 : 1; cx.beginPath(); cx.moveTo(mx, B.y); cx.lineTo(mx - 5, B.y - 7 * s); cx.lineTo(mx + 5, B.y - 7 * s); cx.closePath(); cx.fillStyle = c2; cx.fill();
          label(mx, up ? y0 - 22 : y0 + h + 22, `${dp >= 0 ? "+" : "−"}${f2(Math.abs(dp))} $ (${dp >= 0 ? "+" : "−"}${Math.abs(pc).toFixed(2)}%)\n${Math.abs(nb)} nến · ${dur(dt)}`, c2, "#fff", "center");
          handles.push([A.x, A.y], [B.x, B.y]); } }
      else if (d.type === "long" || d.type === "short") {
        const g = posGeom(d); if ([g.x0, g.x1, g.ye, g.ys, g.yt].some((v) => v == null)) return; const x0 = Math.min(g.x0, g.x1), w = Math.max(4, Math.abs(g.x1 - g.x0));
        cx.fillStyle = "rgba(38,166,154,.22)"; cx.fillRect(x0, Math.min(g.ye, g.yt), w, Math.abs(g.yt - g.ye));
        cx.fillStyle = "rgba(239,83,80,.22)"; cx.fillRect(x0, Math.min(g.ye, g.ys), w, Math.abs(g.ys - g.ye));
        cx.lineWidth = 1; cx.strokeStyle = "#26a69a"; cx.beginPath(); cx.moveTo(x0, g.yt); cx.lineTo(x0 + w, g.yt); cx.stroke();
        cx.strokeStyle = "#ef5350"; cx.beginPath(); cx.moveTo(x0, g.ys); cx.lineTo(x0 + w, g.ys); cx.stroke();
        cx.strokeStyle = "#cfd6df"; cx.beginPath(); cx.moveTo(x0, g.ye); cx.lineTo(x0 + w, g.ye); cx.stroke();
        const e = d.pts[0].p, rk = Math.abs(e - d.sl), rw = Math.abs(d.tp - e), rr = rk > 0 ? rw / rk : 0, L = d.type === "long", mx = x0 + w / 2;
        label(mx, g.yt + (L ? -11 : 11), `TP ${f2(d.tp)} · ${f2(rw)} $ (${((100 * rw) / e).toFixed(2)}%)`, "#26a69a", "#fff", "center");
        label(mx, g.ys + (L ? 11 : -11), `SL ${f2(d.sl)} · ${f2(rk)} $ (${((100 * rk) / e).toFixed(2)}%)`, "#ef5350", "#fff", "center");
        if (act || hover === d.id) label(mx, g.ye + (L ? 11 : -11), `${L ? "LONG" : "SHORT"} vào ${f2(e)} · R:R ${rr.toFixed(2)}`, "#37414f", "#fff", "center");
        else label(x0 + 2, g.ye, `R:R ${rr.toFixed(2)}`, "rgba(55,65,79,.9)", "#fff", "left");
        handles.push([x0, g.ye], [x0 + w, g.ye], [mx, g.yt], [mx, g.ys]); }
      if (d.text) { cx.setLineDash([]); cx.font = `600 ${d.fs || 12}px 'IBM Plex Sans', sans-serif`; cx.fillStyle = col; cx.textBaseline = "bottom"; let tx_ = null, ty_ = null, al = "left";
        if (d.type === "hline") { const y = py(d.pts[0].p); if (y != null) { tx_ = 8; ty_ = y - 3; } }
        else if (d.type === "vline") { const x = tx(d.pts[0].t); if (x != null) { tx_ = x + 4; ty_ = 18; } }
        else if (ok && pts.length) { if (d.type === "rect" || d.type === "range") { tx_ = Math.min(pts[0].x, pts[1].x) + 4; ty_ = Math.min(pts[0].y, pts[1].y) + 16; }
          else if (pts.length >= 2) { const A = pts[0], B = pts[pts.length - 1]; tx_ = (A.x + B.x) / 2; ty_ = (A.y + B.y) / 2 - 5; al = "center"; } else { tx_ = pts[0].x + 4; ty_ = pts[0].y - 4; } }
        if (tx_ != null) { cx.textAlign = al; cx.fillText(d.text, tx_, ty_); } }
      if (d.al) { let bx = null, by = null;   // dấu chuông = hình đang có báo thức
        if (d.type === "hline") { const y = py(d.pts[0].p); if (y != null) { bx = a.w - 92; by = y - 3; } }
        else if (d.type === "vline") { const x = tx(d.pts[0].t); if (x != null) { bx = x + 4; by = 36; } }
        else if (d.type === "long" || d.type === "short") { const g = posGeom(d); if (g.x0 != null && g.ye != null) { bx = Math.min(g.x0, g.x1) - 18; by = g.ye + 6; } }
        else if (ok && pts.length) { bx = Math.max(...pts.map((p) => p.x)) + 4; by = Math.min(...pts.map((p) => p.y)) + 4; }
        if (bx != null) { cx.setLineDash([]); cx.font = "13px sans-serif"; cx.textAlign = "left"; cx.textBaseline = "bottom"; cx.globalAlpha = 1; cx.fillText("🔔", Math.max(2, Math.min(bx, a.w - 18)), by); } }
      if (act) handles.forEach(([x, y]) => dot(x, y, d.type === "long" || d.type === "short" ? "#cfd6df" : col));
    }
    function draw() {
      try {
        cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, cv.width, cv.height);
        if (document.body.classList.contains("tvlb-shot") || !C().length) return;
        const a = area(); curW = a.w; cx.save(); cx.beginPath(); cx.rect(0, 0, a.w, a.h); cx.clip();
        D.forEach((d) => shape(d, a, d.id === sel));
        if (draft) shape(draft, a, true);
        if (temp) shape(temp, a, false);
        cx.restore();
        placeEB();
      } catch (e) { }
    }

    // ───────── chạm chuột vào hình (hit test) ─────────
    const segD = (px, py_, A, B) => { const dx = B.x - A.x, dy = B.y - A.y, L = dx * dx + dy * dy; let t = L ? ((px - A.x) * dx + (py_ - A.y) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - A.x - t * dx, py_ - A.y - t * dy); };
    function hit(x, y) {   // → { d, h: chỉ số chấm tròn hoặc -1 = cả hình }
      const a = area();
      for (let k = D.length - 1; k >= 0; k--) { const d = D[k], R = 7, pts = d.pts.map((p) => ({ x: tx(p.t), y: py(p.p) }));
        if (pts.some((p) => p.x == null || p.y == null) && d.type !== "hline" && d.type !== "vline") continue;
        if (d.type === "hline") { const yy = py(d.pts[0].p); if (yy != null && Math.abs(y - yy) <= R) return { d, h: -1 }; continue; }
        if (d.type === "vline") { const xx = tx(d.pts[0].t); if (xx != null && Math.abs(x - xx) <= R) return { d, h: -1 }; continue; }
        if (d.type === "long" || d.type === "short") { const g = posGeom(d); if ([g.x0, g.x1, g.ye, g.ys, g.yt].some((v) => v == null)) continue; const x0 = Math.min(g.x0, g.x1), x1 = x0 + Math.max(4, Math.abs(g.x1 - g.x0)), mx = (x0 + x1) / 2;
          if (Math.hypot(x - x1, y - g.ye) <= R) return { d, h: 1 }; if (Math.hypot(x - x0, y - g.ye) <= R) return { d, h: 0 };
          if (x >= x0 && x <= x1 && Math.abs(y - g.yt) <= 5) return { d, h: 2 }; if (x >= x0 && x <= x1 && Math.abs(y - g.ys) <= 5) return { d, h: 3 };
          if (Math.hypot(x - mx, y - g.yt) <= R) return { d, h: 2 }; if (Math.hypot(x - mx, y - g.ys) <= R) return { d, h: 3 };
          if (x >= x0 && x <= x1 && y >= Math.min(g.yt, g.ys) && y <= Math.max(g.yt, g.ys)) return { d, h: -1 }; continue; }
        if (d.id === sel && d.type === "rect") { const [A, B] = pts, iL = A.x <= B.x ? 0 : 1, iT = A.y <= B.y ? 0 : 1, x0 = Math.min(A.x, B.x), x1 = Math.max(A.x, B.x), y0 = Math.min(A.y, B.y), y1 = Math.max(A.y, B.y), xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
          const E = [[xm, y0, iT, "p"], [xm, y1, 1 - iT, "p"], [x0, ym, iL, "t"], [x1, ym, 1 - iL, "t"]];
          for (let k2 = 0; k2 < 4; k2++) if (Math.hypot(x - E[k2][0], y - E[k2][1]) <= R) return { d, h: 10 + k2, e: { i: E[k2][2], f: E[k2][3] } }; }
        if (d.id === sel || d.type === "range") { const hs = d.type === "rect" ? pts.concat([{ x: pts[0].x, y: pts[1].y }, { x: pts[1].x, y: pts[0].y }]) : pts;
          const i = hs.findIndex((p) => Math.hypot(x - p.x, y - p.y) <= R); if (i >= 0) return { d, h: i }; }
        if (d.type === "rect" || d.type === "range") { const [A, B] = pts, x0 = Math.min(A.x, B.x), x1 = Math.max(A.x, B.x), y0 = Math.min(A.y, B.y), y1 = Math.max(A.y, B.y);
          if (x >= x0 - 4 && x <= x1 + 4 && y >= y0 - 4 && y <= y1 + 4) return { d, h: -1 }; continue; }
        for (let i = 1; i < pts.length; i++) if (segD(x, y, pts[i - 1], pts[i]) <= 6) return { d, h: -1 };
      }
      return null;
    }

    // ───────── chuột / chạm ─────────
    const pos = (e) => { const r = wrap.getBoundingClientRect(), p = e.touches ? e.touches[0] || e.changedTouches[0] : e; return { x: p.clientX - r.left, y: p.clientY - r.top }; };
    const inPlot = (p) => { const a = area(); return p.x >= 0 && p.y >= 0 && p.x < a.w && p.y < a.h; };
    let block = false;   // đang chặn chart (không cho chart kéo/cuộn)
    const stop = (e) => { e.stopPropagation(); if (e.cancelable && e.type !== "pointerdown") e.preventDefault(); };   // pointerdown KHÔNG preventDefault: nếu chặn, trình duyệt ngừng gửi mousemove cho chart → crosshair đứng yên
    const soft = (e) => { if (e.type === "touchmove" && e.cancelable) e.preventDefault(); };   // khi kéo: KHÔNG chặn sự kiện di chuột → đường nét đứt (crosshair) của chart vẫn chạy theo chuột
    function newShape(type, pt) {
      const d = { id: nid(), type, col: COLS[P.col], pts: [pt] };
      if (type === "long" || type === "short") { const a = area(), span = Math.abs((yp(0) ?? pt.p) - (yp(a.h) ?? pt.p)) || 20, rk = Math.max(1, Math.round(span * 0.06 * 2) / 2), s = type === "long" ? 1 : -1;
        d.sl = pt.p - s * rk; d.tp = pt.p + s * 2 * rk; d.t2 = pt.t + 30 * tfs(); }
      return d;
    }
    function finish(d) { if (d.type === "path" && d.pts.length < 2) { draft = null; return; } D.push(d); sel = d.id; draft = null; save(); if (!K.get("drawkeep", false)) setTool(null); sync(); kick(); }
    function down(e) {
      if (e.button === 2 && draft && draft.type === "path") { stop(e); finish(draft); return; }
      if (e.button != null && e.button !== 0) return;
      const p = pos(e); if (!inPlot(p)) return;
      if (e.type === "touchstart" && e.touches && e.touches.length > 1) return;
      if (tool) { stop(e); block = true; const pt = snap(p.x, p.y); if (!pt) return; lastPos = p;
        if (draft) { if (draft.type === "path") { draft.pts.push(pt); } else { draft.pts[1] = pt; finish(draft); } kick(); return; }
        const d = newShape(tool, pt);
        if (NEED[tool] === 1) { finish(d); return; }
        d.pts.push({ ...pt }); if (tool === "path") d.pts.pop(); draft = d; draft._x = p.x; draft._y = p.y; draft._mv = false; kick(); return; }
      if (e.shiftKey) { stop(e); block = true; const pt = snap(p.x, p.y); if (!pt) return; temp = { id: "tmp", type: "range", pts: [pt, { ...pt }] }; drag = { temp: true }; kick(); return; }
      if (temp) { temp = null; kick(); }
      const h = hit(p.x, p.y);
      if (!h) { if (sel) { sel = null; kick(); } return; }
      stop(e); block = true; sel = h.d.id; if (h.d.lock) { kick(); return; } const st = snap(p.x, p.y);
      drag = { d: h.d, h: h.h, e: h.e, x: p.x, y: p.y, t0: st ? st.t : null, p0: st ? st.p : null, orig: JSON.parse(JSON.stringify(h.d)) }; kick();
    }
    function move(e) {
      const p = pos(e); lastPos = p;
      if (draft) { if (block) soft(e); const pt = snap(p.x, p.y); if (pt && draft.type !== "path") { draft.pts[1] = pt; if (Math.hypot(p.x - draft._x, p.y - draft._y) > 5) draft._mv = true; } kick(); return; }
      if (drag && drag.temp) { soft(e); const pt = snap(p.x, p.y); if (pt) temp.pts[1] = pt; kick(); return; }
      if (drag) { soft(e); const pt = snap(p.x, p.y); if (!pt) return; const d = drag.d, o = drag.orig, dT = pt.t - drag.t0, dP = pt.p - drag.p0;
        if (d.type === "long" || d.type === "short") {
          if (drag.h === -1 || drag.h === 0) { d.pts[0] = { t: o.pts[0].t + dT, p: o.pts[0].p + dP }; d.t2 = o.t2 + dT; d.sl = o.sl + dP; d.tp = o.tp + dP; }
          else if (drag.h === 1) d.t2 = Math.max(o.pts[0].t + tfs(), pt.t);
          else if (drag.h === 2) { const L = d.type === "long"; d.tp = L ? Math.max(pt.p, o.pts[0].p + 0.01) : Math.min(pt.p, o.pts[0].p - 0.01); }
          else if (drag.h === 3) { const L = d.type === "long"; d.sl = L ? Math.min(pt.p, o.pts[0].p - 0.01) : Math.max(pt.p, o.pts[0].p + 0.01); } }
        else if (drag.h === -1) d.pts = o.pts.map((q_) => ({ t: d.type === "hline" ? q_.t : q_.t + dT, p: d.type === "vline" ? q_.p : q_.p + dP }));
        else if (d.type === "rect" && drag.h >= 10) d.pts[drag.e.i][drag.e.f] = pt[drag.e.f];
        else if (d.type === "rect" && drag.h >= 2) { if (drag.h === 2) { d.pts[0].t = pt.t; d.pts[1].p = pt.p; } else { d.pts[1].t = pt.t; d.pts[0].p = pt.p; } }
        else d.pts[drag.h] = pt;
        kick(); return; }
      if (block) return;
      const hv = inPlot(p) && !tool ? hit(p.x, p.y) : null, nh = hv ? hv.d.id : null;
      if (nh !== hover) { hover = nh; wrap.style.cursor = nh ? (hv.h >= 0 ? "grab" : "move") : ""; kick(); }
    }
    function up(e) {
      if (draft && draft._mv && draft.type !== "path" && NEED[draft.type] === 2) { stop(e); finish(draft); }
      if (drag) { stop(e); if (!drag.temp) save(); drag = null; }
      block = false; kick();
    }
    ["pointerdown", "mousedown", "touchstart"].forEach((ev) => wrap.addEventListener(ev, (e) => {
      if (e.target && e.target.closest && e.target.closest(".dtEdit")) return;   // bấm trên thanh tuỳ chỉnh: không đụng chart / hình
      if (ev === "pointerdown" && e.pointerType === "touch") return;   // trên điện thoại dùng touchstart
      if (ev === "mousedown") { if (block || tool) stop(e); return; }   // pointerdown đã xử lý; chỉ chặn chart
      down(e); }, { capture: true, passive: false }));
    window.addEventListener("pointermove", (e) => { if (e.pointerType === "touch") return; move(e); }, { capture: true });
    window.addEventListener("touchmove", (e) => { if (draft || drag || block) move(e); }, { capture: true, passive: false });
    ["pointerup", "touchend"].forEach((ev) => window.addEventListener(ev, (e) => { if (ev === "pointerup" && e.pointerType === "touch") return; up(e); }, { capture: true, passive: false }));
    wrap.addEventListener("dblclick", (e) => { if (draft && draft.type === "path") { stop(e); draft.pts.pop(); finish(draft); } else if (tool) stop(e); }, { capture: true });
    wrap.addEventListener("contextmenu", (e) => { if (draft || tool) { e.preventDefault(); e.stopPropagation(); } }, { capture: true });
    function delSel(ask) {
      if (sel) { D = D.filter((d) => d.id !== sel); sel = null; save(); kick(); return; }
      if (ask && D.length && window.confirm(`Xoá TẤT CẢ ${D.length} hình vẽ trên chart?`)) { D = []; save(); kick(); }
    }
    function setTool(k) { tool = k; draft = null; if (k) sel = null; sync(); kick(); }
    document.addEventListener("keydown", (e) => {
      const a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
      if (e.key === "Escape") { if (draft && draft.type === "path" && draft.pts.length >= 2) finish(draft); else { draft = null; temp = null; setTool(null); sel = null; } kick(); return; }
      if (e.key === "Enter" && draft && draft.type === "path") { finish(draft); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); delSel(false); return; }
      if (e.altKey && !e.ctrlKey) { const m = { h: "hline", v: "vline", t: "trend", r: "rect", m: "range" }[e.key.toLowerCase()]; if (m) { e.preventDefault(); setTool(m); } }
    });
    // ───────── va_143c: THANH TUỲ CHỈNH NỔI (giống TradingView) khi chọn một hình ─────────
    // màu nét · màu nền + độ đậm (hộp) · chữ · cỡ chữ · độ dày · kiểu nét · kéo dài (đường xu hướng) · khoá · nhân bản · xoá
    const PAL = ["#4fc3f7", "#2962ff", "#26a69a", "#00e676", "#ffd54f", "#ff9800", "#ef5350", "#ff4081", "#ce93d8", "#9e9e9e", "#ffffff", "#000000"];
    const ecss = document.createElement("style");
    ecss.textContent = `.dtEdit{position:absolute;z-index:20;display:none;align-items:center;gap:1px;padding:3px 4px;background:#1c222b;border:1px solid #2f3a47;border-radius:7px;box-shadow:0 6px 18px rgba(0,0,0,.55);font:600 12px 'IBM Plex Sans',sans-serif;color:#cfd6df;user-select:none}
.dtEdit .eb{position:relative;min-width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;gap:3px;padding:0 5px;border-radius:5px;cursor:pointer;color:#cfd6df}
.dtEdit .eb:hover,.dtEdit .eb.on{background:#2a3340;color:#fff}.dtEdit .eb svg{width:18px;height:18px}
.dtEdit .cb{position:absolute;left:6px;right:6px;bottom:3px;height:3px;border-radius:2px}
.dtEdit .es{width:1px;height:18px;background:#2f3a47;margin:0 3px}
.dtEdit .pop{position:absolute;top:calc(100% + 6px);left:0;background:#1c222b;border:1px solid #2f3a47;border-radius:7px;padding:7px;box-shadow:0 6px 18px rgba(0,0,0,.55);z-index:21;cursor:default}
.dtEdit .sw{width:18px;height:18px;border-radius:4px;cursor:pointer;border:1px solid #3a4552}.dtEdit .sw.on{outline:2px solid #e0a83a;outline-offset:1px}
.dtEdit .grid{display:grid;grid-template-columns:repeat(6,18px);gap:5px}
.dtEdit .opt{padding:4px 8px;border-radius:4px;cursor:pointer;white-space:nowrap}.dtEdit .opt:hover,.dtEdit .opt.on{background:#2a3340;color:#fff}
.dtEdit input[type=range]{width:150px;padding:0;border:0;background:none;accent-color:#e0a83a;vertical-align:middle;cursor:pointer}
.dtEdit .rl{display:flex;align-items:center;gap:8px;margin-top:8px;white-space:nowrap;color:#9aa6b2;font-weight:500}.dtEdit .rl b{color:#fff;min-width:34px;text-align:right}
.dtEdit .alx{max-width:250px;white-space:normal;font-weight:500;color:#cfd6df;line-height:1.45;margin-bottom:6px}
.dtTBox{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:6px;align-items:center}
.dtToast{background:#1c222b;border:1px solid #e0a83a;color:#fff;padding:10px 16px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.6);font:600 14px 'IBM Plex Sans',sans-serif;cursor:pointer;max-width:92vw}
.dtEdit input:not([type=range]){width:190px;background:#0f141a;color:#fff;border:1px solid #3a4552;border-radius:4px;padding:4px 6px;font:500 12px 'IBM Plex Sans',sans-serif}`;
    document.head.appendChild(ecss);
    const eb = document.createElement("div"); eb.className = "dtEdit"; wrap.appendChild(eb);
    ["pointerdown", "mousedown", "touchstart", "wheel", "dblclick", "contextmenu"].forEach((ev) => eb.addEventListener(ev, (e) => e.stopPropagation()));
    let ebKey = "", pop = null;
    const SV = { lc: '<path d="M4 16l1-4L13 4l3 3-8 8z" fill="none" stroke="currentColor" stroke-width="1.5"/>', fc: '<path d="M4 10l6-6 6 6-6 6z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M16 13c1 1.5 1.5 2.3 1.5 3a1.5 1.5 0 01-3 0c0-.7.5-1.5 1.5-3z" fill="currentColor"/>',
      tx: '<path d="M4 4h12M10 4v13M7 17h6" stroke="currentColor" stroke-width="1.7" fill="none"/>', ext: '<path d="M3 15L13 6M13 6h4" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="3" cy="15" r="1.8" fill="currentColor"/><path d="M15 4l2 2-2 2" stroke="currentColor" stroke-width="1.4" fill="none"/>',
      lk: '<rect x="5" y="9" width="10" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7 9V6.5a3 3 0 016 0V9" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      ul: '<rect x="5" y="9" width="10" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7 9V6.5a3 3 0 015.8-1" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      cp: '<rect x="7" y="7" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 13V5a1 1 0 011-1h8" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      dl: '<path d="M5 6h10M8 6V4h4v2M6 6l1 11h6l1-11" stroke="currentColor" stroke-width="1.5" fill="none"/>',
      al: '<path d="M10 3a5 5 0 00-5 5v3.5L3.5 14h13L15 11.5V8a5 5 0 00-5-5z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 16.5a2 2 0 004 0" stroke="currentColor" stroke-width="1.5" fill="none"/>' };
    const svg = (k) => `<svg viewBox="0 0 20 20">${SV[k]}</svg>`;
    const curD = () => (sel ? D.find((x) => x.id === sel) : null);
    function ebRender() {
      const d = curD(); if (!d) { eb.style.display = "none"; ebKey = ""; return; }
      const k = JSON.stringify([d.id, d.col, d.fill, d.fa, d.w, d.dash, d.text, d.fs, d.lock, d.ext, d.al, pop]); if (k === ebKey) return; ebKey = k;
      const isPos = d.type === "long" || d.type === "short", col = d.col || COLS[0], dashTxt = { solid: "───", dash: "─ ─", dot: "┄┄┄" }[d.dash || "solid"];
      let h = "";
      if (!isPos) h += `<span class="eb${pop === "lc" ? " on" : ""}" data-e="lc" title="Màu nét">${svg("lc")}<span class="cb" style="background:${col}"></span></span>`;
      if (d.type === "rect") h += `<span class="eb${pop === "fc" ? " on" : ""}" data-e="fc" title="Màu nền và độ đậm">${svg("fc")}<span class="cb" style="background:${d.fill || col};opacity:${Math.max(0.35, d.fa ?? 0.13)}"></span></span>`;
      h += `<span class="eb${pop === "tx" ? " on" : ""}" data-e="tx" title="Thêm / sửa chữ">${svg("tx")}</span>`;
      if (!isPos && d.type !== "range") h += `<span class="es"></span><span class="eb${pop === "lw" ? " on" : ""}" data-e="lw" title="Độ dày nét">${Math.round(d.w || 1.5)}px</span><span class="eb${pop === "ls" ? " on" : ""}" data-e="ls" title="Kiểu nét">${dashTxt}</span>`;
      if (d.type === "trend") h += `<span class="eb${d.ext ? " on" : ""}" data-e="ext" title="Kéo dài đường sang phải">${svg("ext")}</span>`;
      if (ALOK(d)) h += `<span class="es"></span><span class="eb${pop === "al" || d.al ? " on" : ""}" data-e="al" title="${d.al ? "ĐANG BẬT báo thức · bấm để chỉnh/tắt" : "Đặt báo thức khi giá tới hình này"}">${svg("al")}${d.al ? '<span class="cb" style="background:#e0a83a"></span>' : ""}</span>`;
      h += `<span class="es"></span><span class="eb${d.lock ? " on" : ""}" data-e="lk" title="${d.lock ? "Đang KHOÁ (không kéo được) · bấm để mở khoá" : "Khoá hình (không kéo nhầm)"}">${svg(d.lock ? "lk" : "ul")}</span>`
        + `<span class="eb" data-e="cp" title="Nhân bản hình">${svg("cp")}</span><span class="eb" data-e="dl" title="Xoá hình (Delete)">${svg("dl")}</span>`;
      if (pop === "lc" || pop === "fc") { const cur = pop === "lc" ? col : d.fill || col;
        h += `<div class="pop" data-pop="1"><div class="grid">${PAL.map((c) => `<span class="sw${c === cur ? " on" : ""}" data-c="${c}" style="background:${c}"></span>`).join("")}</div>`
          + (pop === "fc" ? `<div class="rl">Độ đậm nền <input type="range" min="0" max="100" step="1" data-rg="fa" value="${Math.round((d.fa ?? 0.13) * 100)}"><b>${Math.round((d.fa ?? 0.13) * 100)}%</b></div>`
            : `<div class="rl">Độ đậm nét <input type="range" min="5" max="100" step="1" data-rg="la" value="${Math.round((d.la ?? 1) * 100)}"><b>${Math.round((d.la ?? 1) * 100)}%</b></div>`) + "</div>"; }
      if (pop === "al") h += `<div class="pop" data-pop="1"><div class="alx">🔔 Báo khi <b>${alDesc(d)}</b>.<br><span style="color:#9aa6b2">Kêu bíp + hiện thông báo trên màn hình (và Telegram nếu bạn đã bật). Chỉ chạy khi trang dashboard đang mở.</span></div>`
        + [["once", "Báo 1 lần rồi tự tắt"], ["every", "Báo mỗi lần chạm (cách nhau ≥ 1 phút)"], ["off", "Tắt báo thức"]].map(([v, t]) => `<div class="opt${(d.al ? d.al.m : "off") === v ? " on" : ""}" data-al="${v}">${t}</div>`).join("") + "</div>";
      if (pop === "lw") h += `<div class="pop" data-pop="1">${[1, 1.5, 2, 3, 4].map((w) => `<div class="opt${(d.w || 1.5) === w ? " on" : ""}" data-w="${w}"><span style="display:inline-block;width:40px;height:${w}px;background:#cfd6df;vertical-align:middle;margin-right:8px"></span>${w}px</div>`).join("")}</div>`;
      if (pop === "ls") h += `<div class="pop" data-pop="1">${[["solid", "─── Liền"], ["dash", "─ ─ Gạch"], ["dot", "┄┄┄ Chấm"]].map(([v, t]) => `<div class="opt${(d.dash || "solid") === v ? " on" : ""}" data-ls="${v}">${t}</div>`).join("")}</div>`;
      if (pop === "tx") h += `<div class="pop" data-pop="1"><input id="dtTxt" placeholder="Gõ chữ rồi Enter (để trống = xoá chữ)" value="${(d.text || "").replace(/"/g, "&quot;")}"><div style="margin-top:6px;display:flex;gap:3px">${[10, 12, 14, 18, 24].map((f) => `<span class="opt${(d.fs || 12) === f ? " on" : ""}" data-fs="${f}">${f}</span>`).join("")}</div></div>`;
      eb.innerHTML = h; eb.style.display = "flex";
      const inp = eb.querySelector("#dtTxt"); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
        const ok_ = () => { d.text = inp.value.trim() || undefined; pop = null; save(); ebKey = ""; ebRender(); kick(); };
        inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") ok_(); if (e.key === "Escape") { pop = null; ebKey = ""; ebRender(); } });
        inp.addEventListener("input", () => { d.text = inp.value || undefined; kick(); }); }
      placeEB();
    }
    eb.addEventListener("click", (e) => {
      const d = curD(); if (!d) return; const t = e.target.closest("[data-e],[data-c],[data-a],[data-w],[data-ls],[data-fs],[data-al]"); if (!t) return; const ds = t.dataset;
      if (ds.c) { if (pop === "fc") d.fill = ds.c; else d.col = ds.c; pop = null; }
      else if (ds.a) d.fa = +ds.a;
      else if (ds.w) { d.w = +ds.w; pop = null; }
      else if (ds.ls) { d.dash = ds.ls === "solid" ? undefined : ds.ls; pop = null; }
      else if (ds.fs) d.fs = +ds.fs;
      else if (ds.al) { d.al = ds.al === "off" ? undefined : { m: ds.al }; pop = null; if (d.al) toast(`🔔 Đã đặt báo thức: ${alDesc(d)}`, 3500); }
      else if (ds.e === "ext") d.ext = !d.ext || undefined;
      else if (ds.e === "lk") d.lock = !d.lock || undefined;
      else if (ds.e === "cp") { const c2 = JSON.parse(JSON.stringify(d)); c2.id = nid(); const dt = 8 * tfs(); c2.pts = c2.pts.map((q_) => ({ t: q_.t + dt, p: q_.p })); if (c2.t2) c2.t2 += dt; delete c2.lock; D.push(c2); sel = c2.id; pop = null; }
      else if (ds.e === "dl") { pop = null; delSel(false); ebRender(); return; }
      else if (ds.e) pop = pop === ds.e ? null : ds.e;
      save(); ebKey = ""; ebRender(); kick();
    });
    // thanh trượt độ đậm: kéo = xem ngay, thả = lưu (không vẽ lại thanh để khỏi mất thao tác kéo)
    eb.addEventListener("input", (e) => { const r = e.target.closest("[data-rg]"); if (!r) return; const d = curD(); if (!d) return; const v = +r.value / 100;
      d[r.dataset.rg] = r.dataset.rg === "la" && v >= 1 ? undefined : v; const b = r.parentElement.querySelector("b"); if (b) b.textContent = r.value + "%"; kick(); });
    eb.addEventListener("change", (e) => { if (e.target.closest("[data-rg]")) save(); });

    // ───────── va_143d: BÁO THỨC GIÁ theo hình vẽ ─────────
    function ALOK(d) { return ["hline", "vline", "trend", "arrow", "rect", "long", "short"].includes(d.type); }
    function alDesc(d) {
      if (d.type === "hline") return `giá chạm / cắt qua ${f2(d.pts[0].p)}`;
      if (d.type === "vline") return `đến thời điểm ${clk(d.pts[0].t)}`;
      if (d.type === "rect") { const lo = Math.min(d.pts[0].p, d.pts[1].p), hi = Math.max(d.pts[0].p, d.pts[1].p); return `giá đi vào vùng ${f2(lo)} – ${f2(hi)}`; }
      if (d.type === "long" || d.type === "short") return `giá chạm TP ${f2(d.tp)} hoặc SL ${f2(d.sl)}`;
      return `giá cắt qua đường ${d.type === "arrow" ? "mũi tên" : "xu hướng"}${d.ext ? " (cả phần kéo dài)" : ""}`;
    }
    let tBox = null; function toast(msg, ms) { if (!tBox) { tBox = document.createElement("div"); tBox.className = "dtTBox"; document.body.appendChild(tBox); }
      const t = document.createElement("div"); t.className = "dtToast"; t.textContent = msg; t.title = "Bấm để tắt"; t.onclick = () => t.remove(); tBox.appendChild(t); while (tBox.children.length > 4) tBox.firstChild.remove(); setTimeout(() => t.remove(), ms || 10000); }
    const nowPx = () => { try { if (typeof lastPrice === "function") { const v = lastPrice(); if (v != null) return v; } } catch (_) { } const c = S.candles; return c && c.length ? c[c.length - 1].close : null; };
    function lineAt(d, L) {   // giá của đường xu hướng tại nến logical L (null nếu ngoài đoạn và không kéo dài)
      const A = d.pts[0], B = d.pts[d.pts.length - 1], la = t2l(A.t), lb = t2l(B.t); if (la == null || lb == null || la === lb) return null;
      const lo = Math.min(la, lb), hi = Math.max(la, lb); if (L < lo - 0.5 || (L > hi + 0.5 && !(d.type === "trend" && d.ext))) return null;
      return A.p + ((B.p - A.p) * (L - la)) / (lb - la);
    }
    const crossed = (a, b, lv) => lv != null && ((a < lv && b >= lv) || (a > lv && b <= lv));
    let pPx = null, pT = null; const lastFire = {};
    function alCheck() {
      const c = S.candles; if (!c || !c.length) return; const px = nowPx(), nt = c[c.length - 1].time, L = c.length - 1; if (px == null) return;
      if (pPx == null) { pPx = px; pT = nt; return; }
      let chg = false;
      for (const d of D) { if (!d.al) continue; let hit = null;
        if (d.type === "hline") { if (crossed(pPx, px, d.pts[0].p)) hit = `giá ${f2(px)} cắt qua ${f2(d.pts[0].p)}`; }
        else if (d.type === "vline") { if (pT < d.pts[0].t && nt >= d.pts[0].t) hit = `đã đến ${clk(d.pts[0].t)}`; }
        else if (d.type === "rect") { const lo = Math.min(d.pts[0].p, d.pts[1].p), hi = Math.max(d.pts[0].p, d.pts[1].p), inN = px >= lo && px <= hi, inP = pPx >= lo && pPx <= hi;
          if (inN && !inP) hit = `giá ${f2(px)} vào vùng ${f2(lo)} – ${f2(hi)}`; }
        else if (d.type === "long" || d.type === "short") { if (crossed(pPx, px, d.tp)) hit = `giá ${f2(px)} chạm TP ${f2(d.tp)} ✅`; else if (crossed(pPx, px, d.sl)) hit = `giá ${f2(px)} chạm SL ${f2(d.sl)} ⛔`; }
        else if (d.type === "trend" || d.type === "arrow") { const lv = lineAt(d, L); if (crossed(pPx, px, lv)) hit = `giá ${f2(px)} cắt đường tại ${f2(lv)}`; }
        if (!hit) continue;
        const now = Date.now(); if (d.al.m === "every" && lastFire[d.id] && now - lastFire[d.id] < 60000) continue; lastFire[d.id] = now;
        const nm = { hline: "Đường ngang", vline: "Đường dọc", trend: "Đường xu hướng", arrow: "Mũi tên", rect: "Hộp", long: "Lệnh LONG", short: "Lệnh SHORT" }[d.type];
        const msg = `🔔 ${nm}${d.text ? " «" + d.text + "»" : ""}: ${hit}`;
        toast(msg); try { if (window.tvlbAlert) window.tvlbAlert("dw" + d.id + "_" + now, msg); } catch (_) { }
        if (d.al.m !== "every") { d.al = undefined; chg = true; } }
      pPx = px; pT = nt; if (chg) { save(); ebKey = ""; kick(); }
    }
    setInterval(alCheck, 1000);
    function shapeBox(d) {   // khung bao của hình (px) để đặt thanh tuỳ chỉnh
      const a = area(); let xs = [], ys = [];
      if (d.type === "hline") { const y = py(d.pts[0].p); xs = [a.w / 2]; ys = [y]; }
      else if (d.type === "vline") { xs = [tx(d.pts[0].t)]; ys = [a.h / 2]; }
      else if (d.type === "long" || d.type === "short") { const g = posGeom(d); xs = [g.x0, g.x1]; ys = [g.ys, g.yt, g.ye]; }
      else d.pts.forEach((q_) => { xs.push(tx(q_.t)); ys.push(py(q_.p)); });
      if (xs.concat(ys).some((v) => v == null || !isFinite(v))) return null;
      return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), a };
    }
    let ebSel = null;
    function placeEB() {
      const d = curD(); if ((d && d.id) !== ebSel) { ebSel = d && d.id; pop = null; ebKey = ""; if (d) ebRender(); } if (!d || tool || draft) { if (eb.style.display !== "none") eb.style.display = "none"; ebKey = d && !tool && !draft ? ebKey : ""; if (!d) pop = null; return; }
      if (eb.style.display === "none" || ebKey === "") { ebRender(); if (eb.style.display === "none") return; }
      const b = shapeBox(d); if (!b) { eb.style.display = "none"; ebKey = ""; return; }
      const W = eb.offsetWidth || 300, H = eb.offsetHeight || 34, cxm = (b.x0 + b.x1) / 2;
      let top = b.y0 - H - 16; if (top < 4) top = Math.min(b.y1 + 16, b.a.h - H - 4);
      eb.style.left = Math.max(4, Math.min(cxm - W / 2, b.a.w - W - 4)) + "px"; eb.style.top = Math.max(4, top) + "px";
    }
    sync(); kick();
    window.tvlbDraw = { list: () => D, clear: () => { D = []; save(); kick(); }, _alCheck: alCheck };
  }
  let kick = () => { };
})();

/* va_145 (26/11/2026): tab «🇻🇳 Vàng VNĐ» — theo dõi vàng VẬT CHẤT đã đầu tư.
   • Quy đổi giá thế giới (XAUUSD) ra VNĐ / chỉ: VNĐ/chỉ = XAU × tỷ giá × 3,75 ÷ 31,1034768 + chênh lệch SJC/vật chất.
   • Nhiều NHÀ ĐẦU TƯ, mỗi người nhiều LẦN MUA (số chỉ + giá mua) → giá mua trung bình, vốn, lời / lỗ.
   • Thanh đo kéo trên chart (kéo tới đâu quy đổi tới đó) và mốc giá XAU hoà vốn của nhà đầu tư đang chọn.
   Dữ liệu lưu trong trình duyệt (localStorage "tvlb.vnd"); có nút Xuất / Nhập file để chuyển sang máy khác. */
(function () {
  "use strict";
  if (window.__tvlbVnd) return; window.__tvlbVnd = 1;
  const KEY = "tvlb.vnd", CHI = 3.75 / 31.1034768;
  const V = Object.assign({ rate: 25825, prem: 0, on: false, ly: null, be: true, cur: 0, inv: null },
    (() => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } })());
  if (!Array.isArray(V.inv) || !V.inv.length) { V.inv = [{ name: "Nhà đầu tư 1", lots: Array.isArray(V.lots) && V.lots.length ? V.lots : [{ chi: 1.5, gia: 12990000, ngay: "" }] }]; }
  delete V.lots;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(V)); } catch (e) { } };
  const vnd = (x) => (x == null || !isFinite(x) ? "—" : Math.round(x).toLocaleString("vi-VN") + " đ");
  const usd = (x) => (x == null || !isFinite(x) ? "—" : Number(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const toV = (xau) => xau * V.rate * CHI + (+V.prem || 0);           // XAU (USD/oz) → VNĐ/chỉ
  const toX = (v) => (v - (+V.prem || 0)) / (V.rate * CHI);            // VNĐ/chỉ → XAU
  const px = () => { try { const v = lastPrice(); if (v != null) return v; } catch (e) { } try { const c = S.candles; return c[c.length - 1].close; } catch (e) { return null; } };
  const curI = () => { if (!(V.cur >= 0 && V.cur < V.inv.length)) V.cur = 0; return V.inv[V.cur]; };
  const sumL = (lots) => { let c = 0, m = 0; (lots || []).forEach((l) => { const a = +l.chi || 0, g = +l.gia || 0; if (a > 0 && g > 0) { c += a; m += a * g; } }); return { chi: c, von: m, avg: c ? m / c : null }; };
  const tot = () => sumL(curI().lots);
  const num = (s) => { const n = parseFloat(String(s).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".")); return isFinite(n) ? n : 0; };
  const chiN = (s) => { const n = parseFloat(String(s).replace(",", ".")); return isFinite(n) ? n : 0; };
  const plTxt = (pl0, base) => { const pl = Math.round(pl0) || 0; return `<span class="${pl >= 0 ? "up" : "dn"}">${pl >= 0 ? "+" : "−"}${vnd(Math.abs(pl))}${base ? ` (${pl >= 0 ? "+" : "−"}${Math.abs((100 * pl) / base).toFixed(2)}%)` : ""}</span>`; };

  // ───────── CSS (đặt !important cho các thuộc tính hay bị CSS chung của dashboard ghi đè) ─────────
  const css = document.createElement("style");
  css.textContent = `#vgBody{font:13px/1.5 'IBM Plex Sans',sans-serif!important;color:#d7dde5;padding:4px 6px}
#vgBody *{box-sizing:border-box}
#vgBody table{border-collapse:collapse!important;width:100%!important;margin:0 0 10px!important;table-layout:auto!important}
#vgBody .vt th{background:#232a6b;color:#fff;font-weight:700;padding:6px 8px;border:1px solid #39407d;text-align:center}
#vgBody .vt td{padding:5px 8px;border:1px solid #2b3440;text-align:center;font-family:'IBM Plex Sans',sans-serif!important}
#vgBody .vt td:first-child{font-weight:600;color:#cfd6df;background:#151b23;width:46%}
#vgBody .big{font-size:20px;font-weight:700}#vgBody .up{color:#26c281}#vgBody .dn{color:#ef5350}#vgBody .yl{color:#ffd54f}#vgBody .og{color:#ff9800}#vgBody .mu{color:#7d8796}
#vgBody h4{margin:14px 0 6px!important;font-size:11.5px!important;letter-spacing:.08em;color:#9aa6b2!important;text-transform:uppercase;font-weight:700}
#vgBody .vgr{display:flex!important;align-items:center!important;gap:8px!important;margin:6px 0!important;flex-wrap:wrap!important;text-align:left!important}
#vgBody .vgr > .lb{flex:1 1 180px!important;color:#cfd6df;display:inline-block!important;text-align:left!important}
#vgBody input,#vgBody select{display:inline-block!important;width:150px!important;max-width:100%!important;height:30px!important;background:#0f141a!important;color:#fff!important;border:1px solid #3a4552!important;border-radius:5px!important;padding:3px 8px!important;font:500 13px 'IBM Plex Mono',monospace!important;text-align:right!important;margin:0!important}
#vgBody select{text-align:left!important;width:190px!important;font-family:'IBM Plex Sans',sans-serif!important}
#vgBody input.nm{width:190px!important;text-align:left!important;font-family:'IBM Plex Sans',sans-serif!important}
#vgBody input[type=date]{width:140px!important;text-align:left!important}
#vgBody .btn{display:inline-block!important;width:auto!important;cursor:pointer;border:1px solid #3a4552;background:#1a212b;color:#cfd6df;border-radius:6px;padding:5px 10px!important;font:600 12.5px 'IBM Plex Sans',sans-serif!important;margin:0!important}
#vgBody .btn:hover{border-color:#e0a83a;color:#fff}#vgBody .btn.on{background:#e0a83a;color:#111;border-color:#e0a83a}#vgBody .btn.red{border-color:#ef5350;color:#ef9a9a}
#vgBody .lots td,#vgBody .lots th,#vgBody .ivs td,#vgBody .ivs th{padding:4px 6px;border-bottom:1px solid #222a35;text-align:right;white-space:nowrap}
#vgBody .lots th,#vgBody .ivs th{color:#9aa6b2;font-weight:600;font-size:11.5px}
#vgBody .lots input{width:100%!important;min-width:0!important;padding:3px 5px!important}#vgBody .lots input[type=date]{width:128px!important}#vgBody .lots td.pl,#vgBody .lots td.sp{white-space:normal!important;font-size:12px}#vgBody .lots td:nth-child(4){width:118px}#vgBody .lots td:nth-child(3){width:64px}
#vgBody .lots tr.sum td,#vgBody .ivs tr.sum td{border-top:2px solid #3a4552;font-weight:700;color:#fff}
#vgBody .ivs tr[data-k]{cursor:pointer}#vgBody .ivs tr[data-k]:hover td{background:#18202a}#vgBody .ivs tr.cur td{background:#2a2412}
#vgBody #vgS td{white-space:nowrap;font-size:12px;padding:4px 5px!important}#vgBody #vgS td:first-child{white-space:normal;width:30%!important}#vgBody #vgS .mu{font-size:10.5px}
#vgBody .x{cursor:pointer;color:#ef5350;font-weight:700;padding:0 6px}
#vgBody .card{border:1px solid #2b3440;border-radius:8px;padding:8px 10px;margin:0 0 10px;background:#11161d}
#vgBody .note{color:#7d8796;font-size:11.5px;margin-top:8px;text-align:left}
#vgLine{position:absolute;left:0;height:0;border-top:2px solid #ff5a6e;z-index:9;display:none;pointer-events:none}
#vgLine .h{position:absolute;right:0;top:-12px;height:22px;pointer-events:auto;cursor:ns-resize;display:flex;align-items:center;gap:6px;padding:0 8px;background:#ff5a6e;color:#fff;border-radius:4px;font:700 12px 'IBM Plex Sans',sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.5)}
#vgBe{position:absolute;left:0;height:0;border-top:1px dashed #ffd54f;z-index:8;display:none;pointer-events:none}
#vgBe span{position:absolute;left:6px;top:-18px;color:#ffd54f;font:600 11px 'IBM Plex Sans',sans-serif;background:rgba(11,14,18,.75);padding:0 4px;border-radius:3px}`;
  document.head.appendChild(css);

  let page = null, tries = 0;
  function initTab() {
    const bar = document.querySelector("#pgbar"), aside = document.querySelector(".right");
    if (!bar || !aside || !bar.querySelector('[data-pg="st"]')) { if (++tries < 40) setTimeout(initTab, 700); return; }
    if (bar.querySelector('[data-pg="vnd"]')) return;
    const btn = document.createElement("button"); btn.type = "button"; btn.dataset.pg = "vnd"; btn.className = "v3btn"; btn.textContent = "Vàng VNĐ";
    btn.title = "Quy đổi giá vàng thế giới ra VNĐ / chỉ, thanh đo kéo trên chart, lời / lỗ vàng đã mua";
    bar.appendChild(btn);
    page = document.createElement("div"); page.className = "page"; page.dataset.pg = "vnd"; page.hidden = true;
    page.innerHTML = `<section class="panel" style="height:100%;overflow:auto"><header><h2>Vàng VNĐ · quy đổi & lời lỗ</h2><span class="muted small">1 chỉ = 3,75 g · 1 ounce = 31,1035 g</span></header><div class="vgp" id="vgBody"></div></section>`;
    aside.insertBefore(page, aside.querySelector("#pineOut") || null);
    btn.addEventListener("click", () => { aside.querySelectorAll(":scope > .page").forEach((pg) => { pg.hidden = pg !== page; }); bar.querySelectorAll("button[data-pg]").forEach((b) => b.classList.toggle("on", b === btn)); build(); });
    bar.addEventListener("click", (e) => { const b = e.target.closest("button[data-pg]"); if (b && b !== btn) { page.hidden = true; btn.classList.remove("on"); } }, true);
  }


  let delArm = 0, edOpen = false;
  // Màn hình chính chỉ có: chọn nhà đầu tư + nút Nhập liệu + bảng thông số + 2 nút chart. Mọi phần nhập liệu nằm trong khung «Nhập liệu» (bấm mới mở).
  function build() {
    const b = page && page.querySelector("#vgBody"); if (!b) return;
    b.innerHTML = `<div class="vgr" style="justify-content:flex-start!important"><span class="lb" style="flex:0 0 auto!important"><b>👤 Nhà đầu tư</b></span><select id="vgSel" title="Chọn tên của bạn để xem danh mục của bạn, hoặc chọn «＋ Thêm người mới»"></select>
        <button type="button" class="btn" id="vgEdB">✎ Nhập liệu</button></div>
      <div class="card" id="vgEd" style="display:none">
        <h4 style="margin-top:2px!important">Thông tin nhà đầu tư</h4>
        <div class="vgr"><span class="lb">Tên nhà đầu tư</span><input class="nm" id="vgName" placeholder="Tên nhà đầu tư"><button type="button" class="btn red" id="vgDel">🗑 Xoá người này</button></div>
        <h4 id="vgLh">Các lần mua</h4>
        <table class="lots"><thead><tr><th style="text-align:left">Lần</th><th style="text-align:left">Ngày mua</th><th>Số chỉ</th><th>Giá mua (VNĐ/chỉ)</th><th>Vốn</th><th>Lời / lỗ</th><th></th></tr></thead><tbody id="vgL"></tbody></table>
        <div class="vgr"><button type="button" class="btn" id="vgAdd">＋ Thêm lần mua</button><span class="mu" style="font-size:11.5px">Giá mua điền sẵn = giá vàng VN hiện tại, sửa lại theo giá bạn mua thật.</span></div>
        <h4>Chênh lệch giá vàng Việt Nam so với thế giới</h4>
        <div class="vgr"><span class="lb">Tỷ giá USD/VNĐ</span><input id="vgRate" inputmode="decimal"><button type="button" class="btn" id="vgGet" title="Lấy tỷ giá tham khảo trên mạng (liên ngân hàng, có thể lệch tỷ giá ngân hàng bạn dùng)">🌐 Lấy tỷ giá</button></div>
        <div class="vgr"><span class="lb">Giá tiệm vàng / SJC hiện tại (VNĐ/chỉ)<br><span class="mu" style="font-size:11.5px">nhập giá tiệm → tự tính chênh lệch</span></span><input id="vgShop" inputmode="decimal" placeholder="vd 15.200.000"></div>
        <div class="vgr"><span class="lb">Chênh lệch VN − thế giới (VNĐ/chỉ)<br><span class="mu" style="font-size:11.5px">hoặc nhập thẳng số chênh</span></span><input id="vgPrem" inputmode="decimal"></div>
        <h4>Danh sách nhà đầu tư <span class="mu" style="text-transform:none;letter-spacing:0;font-weight:500">(bấm một dòng để chuyển người)</span></h4>
        <table class="ivs"><thead><tr><th style="text-align:left">Tên</th><th>Số lần</th><th>Số chỉ</th><th>Giá mua TB</th><th>Vốn</th><th>Lời / lỗ</th></tr></thead><tbody id="vgI"></tbody></table>
        <h4>Sao lưu</h4>
        <div class="vgr"><button type="button" class="btn" id="vgExp">⬇ Xuất file danh mục</button><button type="button" class="btn" id="vgImp">⬆ Nhập file danh mục</button><input type="file" id="vgFile" accept=".json,application/json" style="display:none!important"><span class="mu" id="vgImpMsg" style="font-size:11.5px"></span></div>
        <div class="note">• Giá thế giới quy đổi = XAU × tỷ giá × 3,75 ÷ 31,1035. Giá vàng VN = giá thế giới quy đổi + chênh lệch (giá tiệm/SJC thường cao hơn thế giới; chênh lệch đổi theo ngày, nên cập nhật khi biết giá tiệm mới).<br>• Giá mua TB = tổng (số chỉ × giá mua) ÷ tổng số chỉ. Lời / lỗ = (giá vàng VN hiện tại − giá mua) × số chỉ, chưa trừ chênh lệch mua–bán của tiệm.<br>• Danh mục lưu trong trình duyệt của máy này. Dùng ở máy khác: “Xuất file” rồi “Nhập file” ở máy kia.</div>
        <div class="vgr" style="justify-content:center!important"><button type="button" class="btn on" id="vgEdC">✓ Xong · đóng nhập liệu</button></div>
      </div>
      <table class="vt"><thead><tr><th>Thông số</th><th id="vgWho">Giá trị thực tế</th></tr></thead><tbody id="vgT"></tbody></table>
      <div class="vgr" style="justify-content:center!important"><button type="button" class="btn" id="vgOn"></button><button type="button" class="btn" id="vgBeOn"></button></div>
      <div id="vgM" style="margin:4px 0 2px;text-align:center"></div>
      <table class="vt" style="margin-top:8px!important"><tbody id="vgS"></tbody></table>`;
    const q = (s) => b.querySelector(s);
    const setEd = (o) => { edOpen = o; q("#vgEd").style.setProperty("display", o ? "block" : "none", "important"); q("#vgEdB").classList.toggle("on", o); q("#vgEdB").textContent = o ? "✎ Đang nhập liệu · bấm để đóng" : "✎ Nhập liệu"; };
    setEd(edOpen);
    q("#vgEdB").onclick = () => setEd(!edOpen); q("#vgEdC").onclick = () => setEd(false);
    q("#vgRate").value = V.rate; q("#vgPrem").value = Math.round(+V.prem || 0).toLocaleString("vi-VN");
    q("#vgRate").addEventListener("input", (e) => { const v = num(e.target.value); if (v > 0) { V.rate = v; save(); upd(); } });
    q("#vgPrem").addEventListener("input", (e) => { V.prem = num(e.target.value); q("#vgShop").value = ""; save(); upd(); });
    q("#vgShop").addEventListener("input", (e) => { const s = num(e.target.value), p = px(); if (s > 0 && p != null) { V.prem = Math.round(s - p * V.rate * CHI); q("#vgPrem").value = V.prem.toLocaleString("vi-VN"); save(); upd(); } });
    q("#vgSel").addEventListener("change", (e) => {
      if (e.target.value === "new") { V.inv.push({ name: "Nhà đầu tư " + (V.inv.length + 1), lots: [] }); V.cur = V.inv.length - 1; save(); people(); lots(); upd(); setEd(true); const n = q("#vgName"); n.focus(); n.select(); return; }
      V.cur = +e.target.value; save(); people(); lots(); upd(); });
    q("#vgName").addEventListener("input", (e) => { curI().name = e.target.value; save(); const o = q("#vgSel").options[V.cur]; if (o) o.textContent = e.target.value || "(chưa đặt tên)"; upd(); });
    q("#vgDel").onclick = (e) => { const bt = e.currentTarget;
      if (Date.now() - delArm > 4000) { delArm = Date.now(); bt.textContent = `Bấm lần nữa để xoá «${curI().name}»`; setTimeout(() => { bt.textContent = "🗑 Xoá người này"; }, 4000); return; }
      delArm = 0; V.inv.splice(V.cur, 1); if (!V.inv.length) V.inv.push({ name: "Nhà đầu tư 1", lots: [] }); V.cur = 0; save(); bt.textContent = "🗑 Xoá người này"; people(); lots(); upd(); };
    q("#vgOn").onclick = () => { V.on = !V.on; if (V.on && V.ly == null) V.ly = px(); save(); upd(); };
    q("#vgBeOn").onclick = () => { V.be = !V.be; save(); upd(); };
    q("#vgAdd").onclick = () => { const L = curI().lots; L.push({ chi: 1, gia: Math.round(toV(px() || 0) / 1000) * 1000, ngay: new Date().toISOString().slice(0, 10) }); save(); lots(); upd(); };
    q("#vgGet").onclick = async (e) => { const bt = e.currentTarget; bt.textContent = "… đang lấy";
      try { const r = await (await fetch("https://open.er-api.com/v6/latest/USD")).json(); const v = r && r.rates && r.rates.VND; if (!v) throw 0;
        V.rate = Math.round(v); q("#vgRate").value = V.rate; save(); upd(); bt.textContent = "✓ " + V.rate.toLocaleString("vi-VN"); }
      catch (err) { bt.textContent = "❌ Không lấy được, nhập tay"; }
      setTimeout(() => { bt.textContent = "🌐 Lấy tỷ giá"; }, 3000); };
    q("#vgExp").onclick = () => { const blob = new Blob([JSON.stringify({ tvlbVnd: 1, rate: V.rate, prem: V.prem, inv: V.inv }, null, 1)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "danhmuc_vang_" + new Date().toISOString().slice(0, 10) + ".json"; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
    q("#vgImp").onclick = () => q("#vgFile").click();
    q("#vgFile").onchange = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const rd = new FileReader();
      rd.onload = () => { try { const o = JSON.parse(rd.result); if (!Array.isArray(o.inv) || !o.inv.length) throw 0; V.inv = o.inv; if (o.rate > 0) V.rate = o.rate; if (o.prem != null) V.prem = o.prem; V.cur = 0; save(); build(); q("#vgImpMsg").textContent = `✓ Đã nhập ${o.inv.length} nhà đầu tư`; }
        catch (err) { q("#vgImpMsg").textContent = "❌ File không đúng định dạng"; } };
      rd.readAsText(f); e.target.value = ""; };
    people(); lots(); upd();
  }
  function people() {
    const b = page && page.querySelector("#vgBody"); if (!b) return;
    const s = b.querySelector("#vgSel"); s.innerHTML = V.inv.map((v, i) => `<option value="${i}">${esc(v.name || "(chưa đặt tên)")}</option>`).join("") + `<option value="new">＋ Thêm người mới…</option>`; s.value = String(V.cur);
    b.querySelector("#vgName").value = curI().name || "";
  }
  function lots() {
    const tb = page && page.querySelector("#vgL"); if (!tb) return;
    const L = curI().lots;
    tb.innerHTML = L.map((l, i) => `<tr data-i="${i}"><td style="text-align:left">Lần ${i + 1}</td><td style="text-align:left"><input type="date" data-f="ngay" value="${esc(l.ngay || "")}"></td><td><input data-f="chi" value="${String(l.chi).replace(".", ",")}" inputmode="decimal" style="width:60px!important"></td><td><input data-f="gia" value="${Math.round(l.gia || 0).toLocaleString("vi-VN")}" inputmode="decimal"></td><td class="vn"></td><td class="pl"></td><td><span class="x" title="Xoá lần mua này">✕</span></td></tr>`).join("")
      + (L.length ? `<tr class="sum"><td style="text-align:left" colspan="2">Trung bình / Tổng</td><td class="sc"></td><td class="sa"></td><td class="sv"></td><td class="sp"></td><td></td></tr>` : `<tr><td colspan="7" style="text-align:center" class="mu">Chưa có lần mua nào — bấm “＋ Thêm lần mua”.</td></tr>`);
    tb.querySelectorAll("input").forEach((inp) => inp.addEventListener(inp.type === "date" ? "change" : "input", () => { const l = curI().lots[+inp.closest("tr").dataset.i], f = inp.dataset.f;
      l[f] = f === "chi" ? chiN(inp.value) : f === "gia" ? num(inp.value) : inp.value; save(); upd(); }));
    tb.querySelectorAll('input[data-f="gia"]').forEach((inp) => inp.addEventListener("blur", () => { const v = num(inp.value); if (v) inp.value = Math.round(v).toLocaleString("vi-VN"); }));
    tb.querySelectorAll(".x").forEach((x) => x.onclick = () => { curI().lots.splice(+x.closest("tr").dataset.i, 1); save(); lots(); upd(); });
  }
  function upd() {
    if (!page || page.hidden) return;
    const T = page.querySelector("#vgT"); if (!T) return;
    const I = curI(), p = px(), cur = p != null ? toV(p) : null, t = sumL(I.lots), val = cur != null ? cur * t.chi : null, pl = val != null && t.chi ? val - t.von : null, be = t.avg ? toX(t.avg) : null;
    const who = page.querySelector("#vgWho"); if (who) who.textContent = `Giá trị thực tế · ${I.name || "(chưa đặt tên)"}`;
    const lh = page.querySelector("#vgLh"); if (lh) lh.textContent = `Các lần mua của ${I.name || "(chưa đặt tên)"}`;
    T.innerHTML = [
      ["XAUUSD (Ounce)", `<span class="yl">${usd(p)} USD</span>`],
      ["Tỷ giá USD/VNĐ", `<span class="yl">${Math.round(V.rate).toLocaleString("vi-VN")} đ</span>`],
      ["Giá thế giới quy đổi / chỉ", vnd(p != null ? p * V.rate * CHI : null)],
      ["Chênh lệch giá VN − thế giới", `<span class="${(+V.prem || 0) >= 0 ? "og" : "up"}">${(+V.prem || 0) >= 0 ? "+" : "−"}${vnd(Math.abs(+V.prem || 0))}/chỉ</span>${p != null && V.prem ? ` <span class="mu">(${(100 * (+V.prem) / (p * V.rate * CHI)).toFixed(1)}%)</span>` : V.prem ? "" : ' <span class="mu">(chưa nhập — bấm ✎ Nhập liệu)</span>'}`],
      ["Giá vàng VN / Chỉ (hiện tại)", `<span class="big up">${vnd(cur)}</span>`],
      ["Giá vàng VN / Lượng (10 chỉ)", vnd(cur != null ? cur * 10 : null)],
      ["Số vàng đầu tư", `<span class="og">${t.chi ? t.chi.toLocaleString("vi-VN") + " chỉ" : "—"}</span> <span class="mu">(${I.lots.length} lần mua)</span>`],
      ["Giá mua vào trung bình (VNĐ/chỉ)", `<span class="og">${vnd(t.avg)}</span>`],
      ["Tổng vốn", vnd(t.von || null)],
      ["Giá trị hiện tại", vnd(t.chi ? val : null)],
      ["Lợi nhuận", pl == null ? "—" : `<span class="big">${plTxt(pl, t.von)}</span>`],
      ["Giá XAU hoà vốn", be ? `${usd(be)} USD <span class="mu">(${p != null ? (be >= p ? "cần tăng " : "đang trên ") + usd(Math.abs(be - p)) + "$" : ""})</span>` : "—"],
    ].map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("");
    page.querySelectorAll("#vgL tr[data-i]").forEach((tr) => { const l = I.lots[+tr.dataset.i]; if (!l) return; const ok = l.chi > 0 && l.gia > 0;
      tr.querySelector(".vn").textContent = ok ? vnd(l.chi * l.gia) : "—"; tr.querySelector(".pl").innerHTML = ok && cur != null ? plTxt((cur - l.gia) * l.chi, l.gia * l.chi) : "—"; });
    const sr = page.querySelector("#vgL tr.sum"); if (sr) { sr.querySelector(".sc").textContent = t.chi ? t.chi.toLocaleString("vi-VN") + " chỉ" : "—"; sr.querySelector(".sa").textContent = vnd(t.avg) + " (TB)"; sr.querySelector(".sv").textContent = vnd(t.von || null); sr.querySelector(".sp").innerHTML = pl == null ? "—" : plTxt(pl, t.von); }
    const IV = page.querySelector("#vgI");
    if (IV) { let ac = 0, am = 0;
      const rows = V.inv.map((v, i) => { const s = sumL(v.lots); ac += s.chi; am += s.von; const pp = cur != null && s.chi ? cur * s.chi - s.von : null;
        return `<tr data-k="${i}" class="${i === V.cur ? "cur" : ""}"><td style="text-align:left">${i === V.cur ? "▸ " : ""}${esc(v.name || "(chưa đặt tên)")}</td><td>${v.lots.length}</td><td>${s.chi ? s.chi.toLocaleString("vi-VN") : "—"}</td><td>${vnd(s.avg)}</td><td>${vnd(s.von || null)}</td><td>${pp == null ? "—" : plTxt(pp, s.von)}</td></tr>`; }).join("");
      const ap = cur != null && ac ? cur * ac - am : null;
      const k = rows + ac; if (IV.dataset.k !== k) { IV.dataset.k = k; IV.innerHTML = rows + (V.inv.length > 1 ? `<tr class="sum"><td style="text-align:left">Tổng tất cả</td><td></td><td>${ac ? ac.toLocaleString("vi-VN") : "—"}</td><td>${vnd(ac ? am / ac : null)}</td><td>${vnd(am || null)}</td><td>${ap == null ? "—" : plTxt(ap, am)}</td></tr>` : "");
        IV.querySelectorAll("tr[data-k]").forEach((tr) => tr.onclick = () => { V.cur = +tr.dataset.k; save(); people(); lots(); upd(); }); } }
    const on = page.querySelector("#vgOn"), bo = page.querySelector("#vgBeOn");
    if (on) { on.textContent = V.on ? "📏 Thanh đo trên chart: BẬT" : "📏 Bật thanh đo trên chart"; on.classList.toggle("on", !!V.on); }
    if (bo) { bo.textContent = V.be ? "Mốc hoà vốn trên chart: BẬT" : "Mốc hoà vốn trên chart: TẮT"; bo.classList.toggle("on", !!V.be); }
    const SS = page.querySelector("#vgS");   // giá thế giới đi ±X USD → giá vàng VN đổi bao nhiêu / chỉ (chênh lệch giữ nguyên)
    if (SS) { const st = [10, 50, 100, 150], k = V.rate * CHI;
      const h = `<tr><td style="background:#232a6b!important;color:#fff">Giá thế giới đi ±</td>${st.map((d) => `<td style="background:#232a6b;color:#fff;font-weight:700">${d}$</td>`).join("")}</tr>`
        + `<tr><td>Giá vàng VN / chỉ đổi</td>${st.map((d) => `<td class="yl">±${vnd(d * k)}</td>`).join("")}</tr>`
        + (t.chi ? `<tr><td>Danh mục ${esc(I.name)} (${t.chi.toLocaleString("vi-VN")} chỉ) đổi</td>${st.map((d) => `<td class="og">±${vnd(d * k * t.chi)}</td>`).join("")}</tr>` : "")
        + (cur != null && p != null ? `<tr><td>Giá vàng VN / chỉ nếu XAU tăng</td>${st.map((d) => `<td class="up">${vnd(toV(p + d))}<br><span class="mu">XAU ${usd(p + d)}</span></td>`).join("")}</tr><tr><td>Giá vàng VN / chỉ nếu XAU giảm</td>${st.map((d) => `<td class="dn">${vnd(toV(p - d))}<br><span class="mu">XAU ${usd(p - d)}</span></td>`).join("")}</tr>` : "");
      SS.innerHTML = h; }
    const M = page.querySelector("#vgM");
    if (M) M.innerHTML = V.on && V.ly != null ? `Thanh đo ở <b class="yl">${usd(V.ly)} USD</b> = <b class="up">${vnd(toV(V.ly))}/chỉ</b>${t.chi ? ` · nếu giá về đây, ${esc(I.name)}: ${plTxt((toV(V.ly) - t.avg) * t.chi, t.von)}` : ""}` : "";
  }

  // ───────── thanh đo + mốc hoà vốn trên chart ─────────
  let line = null, beL = null, drag = false;
  function initLine() {
    const wrap = document.querySelector("#chartWrap");
    if (!wrap || typeof candleS === "undefined" || typeof chart === "undefined") { setTimeout(initLine, 700); return; }
    line = document.createElement("div"); line.id = "vgLine"; line.innerHTML = '<div class="h"></div>'; wrap.appendChild(line);
    beL = document.createElement("div"); beL.id = "vgBe"; beL.innerHTML = "<span></span>"; wrap.appendChild(beL);
    const h = line.querySelector(".h");
    const start = (e) => { e.stopPropagation(); if (e.cancelable && e.type !== "pointerdown") e.preventDefault(); drag = true; };
    [h].forEach((el) => { el.addEventListener("pointerdown", start); el.addEventListener("mousedown", (e) => e.stopPropagation()); el.addEventListener("touchstart", start, { passive: false }); });
    const mv = (e) => { if (!drag) return; const t = e.touches ? e.touches[0] : e, r = wrap.getBoundingClientRect(); const v = candleS.coordinateToPrice(t.clientY - r.top); if (v != null && isFinite(v)) { V.ly = v; place(); upd(); } if (e.cancelable && e.type === "touchmove") e.preventDefault(); };
    window.addEventListener("pointermove", mv, true); window.addEventListener("touchmove", mv, { capture: true, passive: false });
    const up = () => { if (drag) { drag = false; save(); } };
    window.addEventListener("pointerup", up, true); window.addEventListener("touchend", up, true);
    const loop = () => { place(); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  }
  let lastK = "";
  function place() {
    if (!line) return;
    let w = 0; try { w = chart.timeScale().width(); } catch (e) { } if (!w) w = line.parentElement.clientWidth - 70;
    const t = tot(), be = t.avg ? toX(t.avg) : null;
    const yl = V.on && V.ly != null ? candleS.priceToCoordinate(V.ly) : null, yb = V.be && be != null ? candleS.priceToCoordinate(be) : null;
    const k = [w, yl, yb, V.ly, be, V.rate, V.prem].join("|"); if (k === lastK) return; lastK = k;
    if (yl == null) line.style.display = "none";
    else { line.style.display = "block"; line.style.top = yl + "px"; line.style.width = w + "px";
      line.querySelector(".h").textContent = `⇕ ${usd(V.ly)} = ${vnd(toV(V.ly))}/chỉ`; }
    if (yb == null) beL.style.display = "none";
    else { beL.style.display = "block"; beL.style.top = yb + "px"; beL.style.width = w + "px"; beL.querySelector("span").textContent = `Hoà vốn ${usd(be)} (giá mua TB ${vnd(t.avg)}/chỉ)`; }
  }

  setInterval(upd, 1000);
  setTimeout(initTab, 2500); setTimeout(initLine, 1500);
  window.tvlbVnd = { V, toV, toX };
})();

/* va_146 (26/11/2026): ĐIỆN THOẠI — hàng tên menu trang (#pgbar) bị tràn / chồng nhau.
   Màn hình hẹp (≤ 760 px) hoặc đang bật «Chế độ gọn»: đổi tên nút sang bản ngắn và xếp thành lưới 4 cột (2 hàng), không còn nút bị che.
   Màn hình rộng: trả lại tên đầy đủ như cũ. */
(function () {
  "use strict";
  if (window.__tvlbPgPhone) return; window.__tvlbPgPhone = 1;
  const SHORT = [[/^\s*Strike/i, "Strike·AI"], [/^\s*Hedge/i, "Hedge"], [/^\s*Vào lệnh/i, "Vào lệnh"], [/^\s*Tín hiệu/i, "Tín hiệu"], [/^\s*Backtest/i, "Backtest"], [/Sổ tay/i, "📘 Sổ tay"], [/Vàng VNĐ/i, "Vàng VNĐ"]];
  const css = document.createElement("style");
  css.textContent = `#pgbar.pgPhone{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:4px!important;flex-wrap:wrap!important;width:100%!important;overflow:visible!important}
#pgbar.pgPhone button{width:100%!important;min-width:0!important;padding:6px 3px!important;font-size:12.5px!important;line-height:1.25!important;text-align:center!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;margin:0!important}`;
  document.head.appendChild(css);
  const mq = (() => { try { return matchMedia("(max-width: 760px)"); } catch (e) { return null; } })();
  const phone = () => (mq && mq.matches) || document.documentElement.classList.contains("tvlb-compact");
  function apply() {
    const bar = document.querySelector("#pgbar"); if (!bar) return;
    const on = phone(); bar.classList.toggle("pgPhone", on);
    bar.querySelectorAll("button").forEach((b) => {
      if (on) {
        if (b.dataset.pgFull == null) { const t = b.textContent; const m = SHORT.find(([re]) => re.test(t)); if (!m) return; b.dataset.pgFull = b.innerHTML; b.dataset.pgShort = m[1]; if (!b.title) b.title = t.trim(); }
        if (b.textContent !== b.dataset.pgShort) b.textContent = b.dataset.pgShort;
      } else if (b.dataset.pgFull != null) { b.innerHTML = b.dataset.pgFull; delete b.dataset.pgFull; delete b.dataset.pgShort; }
    });
  }
  setInterval(apply, 1500); [300, 1200, 3000, 6000].forEach((t) => setTimeout(apply, t));
  if (mq) { try { mq.addEventListener("change", apply); } catch (e) { mq.addListener && mq.addListener(apply); } }
  addEventListener("resize", apply);
})();
