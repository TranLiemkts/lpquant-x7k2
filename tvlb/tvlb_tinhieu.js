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
  const f2 = (x) => (x == null || !isFinite(x) ? "—" : Number(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const f0 = (x) => (x == null || !isFinite(x) ? "—" : Math.round(x).toLocaleString("en-US"));
  const sg = (x, f = f2) => (x == null || !isFinite(x) ? "—" : (x >= 0 ? "+" : "−") + f(Math.abs(x)));
  const st_ = { get(k, d) { try { const v = localStorage.getItem("tvlb." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem("tvlb." + k, JSON.stringify(v)); } catch (e) { } } };
  const ZONE = 4, SLU = 3;
  const O = Object.assign({ thSt: true, thSg: true, sig: true, kh: true, box: true, snd: true, tg: true, tout: 36,
    k: { wall: true, oh: true, oht: true, conf: true, pro: true, m: true, sw: true }, minG: "C", kh1: true, kh2: true, kh3: true,
    tpm: "auto", boxn: 3, slmax: 0, al: { kh: true, khz: true, sig: true, hedge: true, div: true, news: true }, sty: "beep", vol: 60, diff: true, minor: true, topn: 10, wh: true }, st_.get("o3", {}));
  ["k", "al"].forEach((k) => { O[k] = Object.assign({}, { k: { wall: true, oh: true, oht: true, conf: true, pro: true, m: true, sw: true }, al: { kh: true, khz: true, sig: true, hedge: true, div: true, news: true } }[k], O[k] || {}); });
  window.TVLB_MINOR = O.minor !== false; window.TVLB_TOPN = O.topn || 10;
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
    ctx.fillStyle = SMC_COL.pro[ci]; ctx.font = '600 10px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(t, x1 + 3, y + 3.5); ctx.textAlign = 'center'; });
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
      // vùng KH1–3
      if (O.kh) { const P = window.tvlbPlans ? window.tvlbPlans().PLANS : [];
        const seen = new Map();
        P.filter((p) => p.st !== "HUỶ" && O["kh" + p.id.slice(2)] !== false).forEach((p) => { const a = Y(p.z.hi), b = Y(p.z.lo); if (!ok(a, b)) return; const col = p.d < 0 ? "239,83,80" : "38,166,154";
          const k_ = seen.get(p.z) || 0; seen.set(p.z, k_ + 1);
          if (!k_) { cx.fillStyle = `rgba(${col},${p.st === "CHỜ" ? 0.06 : 0.14})`; cx.fillRect(plotW * 0.55, a, plotW * 0.45, b - a);
            cx.strokeStyle = `rgba(${col},.55)`; cx.setLineDash([4, 3]); cx.strokeRect(plotW * 0.55, a, plotW * 0.45, b - a); cx.setLineDash([]); }
          cx.fillStyle = `rgb(${col})`; cx.font = "700 10px sans-serif"; cx.textAlign = "right";
          const ly = p.d < 0 ? a - 4 - 12 * k_ : b + 11 + 12 * k_;   // SELL ghi trên vùng, BUY ghi dưới vùng; cùng vùng thì xếp chồng
          cx.fillText(`${p.id} ${p.kind === "break" ? "PHÁ" : "BẬT"} ${p.d < 0 ? "SELL" : "BUY"} ${"★".repeat(p.z.st)} · ${p.st}`, plotW - 6, ly); }); }
      // hộp SL/TP lệnh KH đang chạy + 3 lệnh vừa đóng
      if (O.box && O.boxn >= 0) { const T = (window.tvlbPlans ? window.tvlbPlans().TRK : []).filter((t) => t.tf === S.tf && !t.drop);
        const show = T.filter((t) => !t.res).concat(T.filter((t) => t.res).slice(0, O.boxn === 999 ? 1e9 : Math.max(1, O.boxn))); const idx = new Map(bars.map((b, i) => [b.time, i]));
        show.forEach((t) => { const i0 = idx.get(t.t); if (i0 == null) return; const i1 = t.res && t.xt != null && idx.get(t.xt) != null ? idx.get(t.xt) : bars.length + 6;
          const x0 = X(i0), x1 = X(i1), ye = Y(t.e), yt = Y(t.tp), ys = Y(t.sl); if (!ok(x0, x1, ye, yt, ys)) return;
          cx.fillStyle = "rgba(38,166,154,.16)"; cx.fillRect(x0, Math.min(ye, yt), x1 - x0, Math.abs(yt - ye)); cx.fillStyle = "rgba(239,83,80,.16)"; cx.fillRect(x0, Math.min(ye, ys), x1 - x0, Math.abs(ys - ye));
          cx.fillStyle = "rgba(220,220,220,.7)"; cx.font = "600 9.5px sans-serif"; cx.textAlign = "center";
          cx.fillText(`${t.code}${t.res ? (t.res === "TP" ? " ✓" : " ✗") : ""}`, (x0 + x1) / 2, (ye + yt) / 2 + 3); }); }
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
      <div style="margin-top:5px;border-top:1px solid #2b3440;padding-top:4px"><b>Vì sao có tín hiệu</b><br>${(x.why || []).join("<br>")}</div>
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
      <section class="panel"><header><h2>Backtest mọi tín hiệu · tìm EDGE</h2><span class="muted small" id="t4bn"></span><span class="muted small" id="t5ver" style="margin-left:10px;opacity:.75" title="Phiên bản giao diện TVLB+ (file web) · phiên bản máy chủ (server.py). Sau khi cập nhật: tắt / mở lại máy chủ rồi Ctrl+F5."></span><label class="muted small" style="margin-left:auto;margin-right:6px" title="Lệnh chưa chạm SL/TP sau số nến này sẽ đóng ở giá lúc đó (Hết giờ)">Đóng sau <select id="t4to" class="btn sm">${[24, 36, 72, 144].map((v) => `<option value="${v}">${v} nến</option>`).join("")}</select></label></header><div id="t4bt" style="font-size:12px"></div></section></div>
    <div class="row" data-row="bot"><div class="duo">
      <section class="panel"><header><h2>So sánh cách chốt lời</h2><span class="muted small" id="t5cn"></span></header><div id="t5cmp" style="font-size:12px"></div></section>
      <section class="panel"><header><h2>SMC Tip dài hạn</h2><span class="muted small" id="t5tn"></span></header><div id="t5tip" style="font-size:12px"></div></section></div></div>`;
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
    const T = (window.tvlbPlans ? window.tvlbPlans().TRK : []).filter((t) => t.res).map((t) => ({ t: t.xt || t.t, r: t.res === "TP" ? Math.abs(t.tp - t.e) / Math.max(Math.abs(t.e - (t.sl0 ?? t.sl)), 0.5) : -1, nm: "Kế hoạch " + t.id }));
    const F = FWD.filter((f) => f.res).map((f) => ({ t: f.xt || f.t, r: f.r, nm: f.fam || FAM[f.kind] || f.kind }));
    const all = T.concat(F).sort((a, b) => a.t - b.t);
    document.querySelector("#t4fn").textContent = `${FWD.length} tín hiệu + ${T.length} lệnh KH đã đóng`;
    const g2 = {}; all.forEach((o) => (g2[o.nm] = g2[o.nm] || []).push({ res: o.r > 0 ? "W" : o.r < 0 ? "L" : "T", r: o.r }));
    document.querySelector("#t4fw").innerHTML = eqSvg(all.map((o) => o.r), "Equity Nhật ký live (mọi loại)") + tbl(HEAD, Object.entries(g2).sort().map(([k, v]) => stRow(k, statsOf(v), 1)).concat(all.length ? [stRow("<b>TẤT CẢ</b>", statsOf(all.map((o) => ({ res: o.r > 0 ? "W" : o.r < 0 ? "L" : "T", r: o.r }))))] : []))
      + FWD.slice().reverse().slice(0, 10).map((f) => `<div class="v3row"><span class="muted">${new Date(f.t * 1000).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span><b style="color:${f.dir < 0 ? "#ef5350" : "#26a69a"}">${f.dir < 0 ? "SELL" : "BUY"}</b><span>${f.label} · ${f.tf}${f.grade ? " · hạng " + f.grade : ""}</span>${f.res ? `<b class="${f.r > 0 ? "win" : "loss"}">${sg(f.r, (v) => v.toFixed(2))}R</b>` : '<span class="muted">đang chạy</span>'}</div>`).join("")
      + '<div class="muted" style="margin-top:4px">Tự ghi MỌI tín hiệu (Option Flow · SMC Tip · Tường / OF·HEDGE / Hợp lưu · SMC hub) ngay khi nến tín hiệu đóng (để dashboard mở), kết quả theo cách chốt lời đang chọn; cộng các lệnh KH1–3 đã đóng ở trang ③. Lưu trong trình duyệt.</div>';
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
      TIPL = { tf, orders: O_.map((o) => ({ name: `${o.name} ${o.side}`, status: o.status, rr: o.rr, t: c[o.created].time, fill: o.fillI != null, ct: o.closeI != null && c[o.closeI] ? c[o.closeI].time : null })),
        skip: r.orders.length - O_.length, msg: `${c.length} nến ${tf} · ${new Date(c[0].time * 1000).toLocaleDateString("vi-VN")} → ${new Date(c[c.length - 1].time * 1000).toLocaleDateString("vi-VN")}` };
    } catch (e) { TIPL = { tf, msg: "❌ " + e.message + " (cần mở dashboard qua máy chủ TVLB)" }; }
    renderTipLong();
  }
  function renderTipLong() {
    const el = document.querySelector("#t5tip"); if (!el || (TIPL && TIPL._drawn === TIPL.msg && el.dataset.v === "1")) return;
    let h = `<div class="v3sw" style="margin-bottom:6px"><button data-tl="15m">▶ Chạy M15</button><button data-tl="5m">▶ Chạy M5</button> <span class="muted">${TIPL ? TIPL.msg : "Backtest hệ CL/KB trên TOÀN BỘ nến lưu trên máy chủ (từ mốc h4_from, ~5 tháng), luật gốc: chốt tại TP1, SL trước nếu cùng nến."}</span></div>`;
    if (TIPL && TIPL.orders) {
      const filled = TIPL.orders.filter((o) => o.fill), toR = (o) => (o.status === "tp1" ? { res: "W", r: o.rr } : o.status === "sl" ? { res: "L", r: -1 } : { res: "O", r: 0 });
      const g = {}; filled.forEach((o) => (g[o.name] = g[o.name] || []).push(toR(o)));
      const all = filled.slice().sort((a, b) => (a.ct || 9e9) - (b.ct || 9e9)).map(toR);
      document.querySelector("#t5tn").textContent = `${filled.length} lệnh khớp · ${TIPL.orders.length - filled.length} không khớp (hết hạn / lỡ) · bỏ ${TIPL.skip} lệnh TP1 < 1R`;
      h += eqSvg(all.filter((r) => r.res !== "O").map((r) => r.r), `Equity SMC Tip dài hạn (${TIPL.tf}, chốt TP1)`)
        + tbl(HEAD, Object.entries(g).sort().map(([k, v]) => stRow(k, statsOf(v))).concat(all.length ? [stRow("<b>TẤT CẢ</b>", statsOf(all))] : []));
    }
    el.innerHTML = h; el.dataset.v = "1"; if (TIPL) TIPL._drawn = TIPL.msg;
    el.querySelectorAll("[data-tl]").forEach((b) => { b.onclick = () => { el.dataset.v = ""; runTipLong(b.dataset.tl); }; });
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
      if (show && TIP.of) S.signals.forEach((s) => mk.push({ time: s.time + TZ, position: s.side === "SELL" ? "aboveBar" : "belowBar", color: s.side === "SELL" ? C.down : C.up, shape: s.side === "SELL" ? "arrowDown" : "arrowUp", text: `${s.side} ${s.score}/${s.max}` }));
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
      ${CK("O", "sig", "Tường Option · OF·HEDGE · Hợp lưu (ký hiệu + hạng)", 1)}<div class="sub">Kế hoạch giao dịch</div>${CK("O", "kh", "Vùng KH trên chart")}${CK("O", "kh1", "KH1 — Kế hoạch chính")}${CK("O", "kh2", "KH2 — Kế hoạch phụ")}${CK("O", "kh3", "KH3 — Đảo chiều / Phá biên")}
      <div class="sub">Tường Option & vùng Hedge (−Γ)</div>${CK("O.k", "wall", "B / S — Từ chối tại tường Option")}${CK("O.k", "oh", "OF·H — Đi theo vùng Hedge (−Γ)")}${CK("O.k", "oht", "H-T — Bẫy tại vùng Hedge")}${CK("O.k", "conf", "HL — Hợp lưu Option + SMC")}
      <div class="sub">SMC hub (ký hiệu + hạng)</div>${CK("O.k", "pro", "Pro")}${CK("O.k", "m", "Sweep M")}${CK("O.k", "sw", "Sweep sw")}${SEL("minG", [["C", "Mọi hạng (A, B, C)"], ["B", "Chỉ hạng A + B"], ["A", "Chỉ hạng A"]], "Hạng tối thiểu hiển thị / thống kê")}`],
    ["tp", "📏 TP / SL", `${SEL("tpm", Object.entries(TPM), "🎯 Cách chốt lời (thống kê mọi tín hiệu)")}${CK("O", "wh", "Backtest dùng tường theo TỪNG NGÀY (OI lịch sử, không nhìn trước)")}${SEL("boxn", [[-1, "Hộp SL/TP: Tắt"], [0, "Lệnh gần nhất + hiện tại"], [1, "+ 1 lệnh gần nhất"], [3, "+ 3 lệnh"], [5, "+ 5 lệnh"], [10, "+ 10 lệnh"], [20, "+ 20 lệnh"], [999, "+ Tất cả lệnh"]], "📐 Hộp SL/TP trên chart")}
      ${SEL("slmax", [[0, "SL tối đa: không giới hạn"], [6, "Bỏ lệnh SL > 6$"], [8, "Bỏ lệnh SL > 8$"], [10, "Bỏ lệnh SL > 10$"], [12, "Bỏ lệnh SL > 12$"], [15, "Bỏ lệnh SL > 15$"]], "🛡 SL tối đa")}${SEL("tout", [[24, "Đóng lệnh sau 24 nến"], [36, "Đóng sau 36 nến"], [72, "Đóng sau 72 nến"], [144, "Đóng sau 144 nến"]], "⏱ Hết giờ")}${CK("O", "box", "Hiện hộp SL/TP + mã lệnh KH (K1-xxxx)")}
      <div class="sub">Cơ chế SL/TP gốc của TVLB</div><div class="note"><b>Option Flow:</b> vào giá đóng nến tín hiệu · SL = tường ± 3$ (Trap: râu nến ± 3$; HEDGE: cực trị 3 nến ± 3$) · TP1 = strike kế tiếp theo hướng lệnh · TP2 = strike sau đó (Trap: tường đối diện).<br><b>SMC CL/KB:</b> lệnh LIMIT tại 50% râu nến quét (KB2: vùng FVG/IMB) · SL = râu nến quét ± 3$ · TP1 = mốc cấu trúc gần nhất (bỏ lệnh nếu &lt; 1R, tối đa 3R) · hết hạn sau 6 nến H4.<br>Nhật ký / backtest gốc chỉ tính tới TP1; cùng nến chạm SL và TP thì tính SL.</div>`],
    ["al", "🔔 Cảnh báo", `${CK("O", "snd", "Âm thanh trên máy này", 1)}<div class="sub">Loại cảnh báo</div>${CK("O.al", "kh", "✅ KH1–3 XÁC NHẬN")}${CK("O.al", "khz", "⏳ Giá vào vùng KH")}${CK("O.al", "sig", "🎯 Tín hiệu mới hạng A–B")}${CK("O.al", "hedge", "🟥 Giá vào vùng Hedge")}${CK("O.al", "div", "📉 Phân kỳ CVD")}${CK("O.al", "news", "📰 Tin đỏ USD (trước 30 & 5 phút)")}
      <div class="sub">Âm thanh</div>${SEL("sty", [["beep", "🔔 Bíp đôi (mặc định)"], ["chime", "🎵 Chuông lên"], ["bell", "🛎 Chuông đơn"], ["siren", "🚨 Còi"], ["voice", "🗣 Giọng đọc tiếng Việt"], ["mute", "🔇 Tắt tiếng"]], "Kiểu")}${CK("O", "diff", "Âm riêng theo hướng (BUY ↑ · SELL ↓)")}<div class="note" style="margin-bottom:0">Âm lượng <b id="mVolV"></b></div><input type="range" min="0" max="100" step="5" data-rng="vol"><button class="pb" id="mTest">▶ Nghe thử</button>
      <div class="sub">Telegram — điện thoại khoá máy vẫn báo</div>${CK("O", "tg", "Gửi cảnh báo về Telegram")}<button class="pb" id="mTg">📨 Gửi tin thử</button><button class="pb" id="mNt">🔔 Cho phép thông báo màn hình</button><div class="note">Lệnh SMC Tip (CL/KB) và Option Flow được máy chủ báo Telegram riêng (config.json → telegram).</div>`],
    ["view", "🖥 Hiển thị", `<div id="mView"></div>${CK("O", "minor", "Vạch strike phụ (nét đứt không tên)")}${SEL("topn", [[10, "10 tường có nhãn mỗi nguồn (mặc định)"], [6, "6 tường"], [4, "4 tường"], [2, "2 tường (chỉ tường lớn nhất)"]], "Số tường có nhãn mỗi nguồn (GC / GLD) — Call/Put Wall luôn hiện")}`],
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
    pm.querySelectorAll("[data-sel]").forEach((s_) => { s_.onchange = () => { const v = s_.value; O[s_.dataset.sel] = isNaN(+v) ? v : +v; saveO(); if (s_.dataset.sel === "topn") { window.TVLB_TOPN = O.topn; try { drawOverlay(); } catch (e) { } } key = ""; tick(); }; });
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
  const WEB_VER = "web 12 · 08/11";
  window.TVLB_WEB_VER = WEB_VER;
  function showVer() { fetch(API("/api/version")).then((r) => r.json()).then((v) => { const t = `${WEB_VER} · máy chủ ${v.version || "?"}`;
      const e = document.querySelector("#t5ver"); if (e) e.textContent = t; const h = document.querySelector("#tvlbPlus .pm h3"); if (h) h.innerHTML = `TVLB+ <span style="font-size:10px;font-weight:400;opacity:.7">${t}</span>`; })
    .catch(() => { const e = document.querySelector("#t5ver"); if (e) e.textContent = WEB_VER + " · máy chủ ?"; }); }
  setTimeout(showVer, 2500); setInterval(showVer, 10 * 60 * 1000);
  window.tvlbSig = () => ({ SIG, TH, RX, FWD });
})();
