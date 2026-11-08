/* TVLB+ · Trang ③ VÀO LỆNH (port từ TVL Quant v17.5, chạy trên dữ liệu TVLB — mốc 40/40/20, nến XAUUSDT Futures)
   • Theo dõi diễn biến: giá đang ở đâu so với KH1–3, nến vừa đóng đủ điều kiện chưa, lệnh đang chạy + khuyến nghị.
   • Bối cảnh thị trường: DXY, phiên, chế độ Gamma, nến vừa đóng, Net GEX, SMC, CVD, Magnet, vùng Hedge, tin đỏ.
   • Kế hoạch giao dịch KH1 (Chính) / KH2 (Phụ) / KH3 (Đảo chiều – Phá biên) theo hướng ưu tiên của Agent, uy tín vùng 1–5 sao,
     trạng thái CHỜ → TRONG VÙNG → XÁC NHẬN / HUỶ; XÁC NHẬN thì ghi lệnh (mã K1-0001…) và theo dõi tới TP / SL.
   Mọi thứ ở đây là PHẦN RIÊNG: ẩn được bằng menu bên trái (nút "③ Vào lệnh" và "Chế độ chụp màn hình"). */
(function () {
  "use strict";
  const ZONE = 4, SLU = 3, CONF_W = 6, FLIP_N = 48, DOI_REAL = 300;
  const RES = ["CW", "T1", "GCW"], SUP = ["PW", "T2", "GPW"], PKEYS = ["CW", "T1", "GCW", "PW", "T2", "GPW", "MAG", "FLIP"];
  const NM = { CW: "Call Wall", PW: "Put Wall", T1: "Tường phụ 1", T2: "Tường phụ 2", GCW: "GLD Call Wall", GPW: "GLD Put Wall", MAG: "Magnet", FLIP: "Gamma Flip", MP: "Max Pain" };
  const st_ = { get(k, d) { try { const v = localStorage.getItem("tvlb." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem("tvlb." + k, JSON.stringify(v)); } catch (e) { } } };
  const f2 = (x) => (x == null || !isFinite(x) ? "—" : Number(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const f0 = (x) => (x == null || !isFinite(x) ? "—" : Math.round(x).toLocaleString("en-US"));
  const sg = (x, f = f2) => (x == null || !isFinite(x) ? "—" : (x >= 0 ? "+" : "−") + f(Math.abs(x)));
  const G = (t) => `<b class="pos">${t}</b>`, R = (t) => `<b class="neg">${t}</b>`, Y = (t) => `<b style="color:#ffd600">${t}</b>`;
  const starTxt = (n) => `<span style="color:#ffc400">${"★".repeat(n)}</span><span style="color:#5f6b7a">${"★".repeat(5 - n)}</span>`;
  const VP = { p3: st_.get("p3", true), shot: st_.get("shot", false) };

  // ───────────────────── dữ liệu từ TVLB ─────────────────────
  let bars = [], spot = null, L = [], ZON = [], DIV = { type: null, txt: "Không phân kỳ", why: "" }, AG = {}, PZ = { up: [], dn: [] }, PLANS = [];
  let TRK = st_.get("trk", []), WATCH = st_.get("watch", { off: {}, grp: { K1: true, K2: true, K3: true, P: true } }), PLANVIEW = st_.get("planview", "plan"), TRKVIEW = "now";
  const lv = (k) => L.find((l) => l.key === k);
  const flipX = () => (lv("FLIP") || {}).xau ?? null;
  const inHedge = (p) => { try { return hZoneAt(p); } catch (e) { return null; } };
  const vp = () => S.state?.volume_profile || null;
  function buildLevels() {
    const out = [];
    const add = (src, o) => {
      if (!o || !o.chart) return;
      const c = o.chart, st = o.strikes || [], byK = (k) => st.find((s) => Math.abs(s.strike - k) < 1e-6);
      const maxC = Math.max(1, ...st.map((s) => s.call_oi || 0)), maxP = Math.max(1, ...st.map((s) => s.put_oi || 0));
      const mk = (key, strike, x, side) => {
        if (x == null) return; const s = strike != null ? byK(strike) : null, oi = s ? (side === "c" ? s.call_oi : s.put_oi) : null;
        out.push({ key, name: NM[key], pool: src, xau: x, strike, oi, hard: oi != null ? Math.round((100 * oi) / (side === "c" ? maxC : maxP)) : null, doi: s ? s.d_oi : null, gex: s ? s.net_gex : null });
      };
      if (src === "GC") {
        mk("CW", o.call_wall, c.call_wall, "c"); mk("PW", o.put_wall, c.put_wall, "p");
        const t1 = st.filter((s) => s.chart > spot && s.strike !== o.call_wall).sort((a, b) => b.call_oi - a.call_oi)[0];
        const t2 = st.filter((s) => s.chart < spot && s.strike !== o.put_wall).sort((a, b) => b.put_oi - a.put_oi)[0];
        if (t1) mk("T1", t1.strike, t1.chart, "c"); if (t2) mk("T2", t2.strike, t2.chart, "p");
        if (c.gamma_flip != null) out.push({ key: "FLIP", name: NM.FLIP, pool: "GC", xau: c.gamma_flip });
        if (c.magnet != null) { const s = byK(o.magnet); out.push({ key: "MAG", name: NM.MAG, pool: "GC", xau: c.magnet, gex: s ? s.net_gex : null }); }
        if (c.max_pain != null) out.push({ key: "MP", name: NM.MP, pool: "GC", xau: c.max_pain });
      } else { mk("GCW", o.call_wall, c.call_wall, "c"); mk("GPW", o.put_wall, c.put_wall, "p"); }
    };
    add("GC", S.state?.options?.GC); add("GLD", S.state?.options?.GLD);
    return out;
  }
  function calcZones() {
    const it = L.filter((l) => ["CW", "PW", "T1", "T2", "MAG", "MP", "GCW", "GPW", "FLIP"].includes(l.key)).map((l) => ({ x: l.xau, src: (l.pool === "GLD" && !/GLD/.test(l.name) ? "GLD " : "") + l.name }));
    const v = vp(); if (v) [["POC", v.poc], ["VAH", v.vah], ["VAL", v.val]].forEach(([n, x]) => x != null && it.push({ x, src: n }));
    it.sort((a, b) => a.x - b.x); const out = []; let cur = null;
    it.forEach((i) => { if (cur && i.x - cur.hi <= CONF_W) { cur.items.push(i); cur.hi = i.x; } else { cur = { lo: i.x, hi: i.x, items: [i] }; out.push(cur); } });
    out.forEach((z) => { z.srcs = [...new Set(z.items.map((i) => i.src))]; z.score = z.srcs.length; z.mid = (z.lo + z.hi) / 2; });
    return out.filter((z) => z.score >= 2);
  }
  const cinfo = (i) => { const b = bars[i]; return { up: b.high - Math.max(b.open, b.close), lo: Math.min(b.open, b.close) - b.low, body: Math.abs(b.close - b.open), rng: Math.max(b.high - b.low, 0.01), d: b.delta || 0, b }; };
  const rejSell = (c) => c.up >= Math.max(c.body, 0.4 * c.rng) && c.d < 0, rejBuy = (c) => c.lo >= Math.max(c.body, 0.4 * c.rng) && c.d > 0;
  const big5 = () => { try { const b = bigFlow(5); return b ? b.d : null; } catch (e) { return null; } };
  const cdText = () => { const c = bars[bars.length - 1], sec = TF_SEC[S.tf] || 900; if (!c) return "—"; const left = Math.max(0, Math.round(c.time + sec - Date.now() / 1000)); return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`; };
  function calcDiv() {
    const n = bars.length - 2; if (n < 30) return { type: null, txt: "Không phân kỳ", why: "" };
    try { const d = divAt(n); if (d.bear) return { type: "bear", txt: "PHÂN KỲ GIẢM", why: "giá lập đỉnh mới nhưng CVD không lên theo → lực MUA chủ động yếu dần" };
      if (d.bull) return { type: "bull", txt: "PHÂN KỲ TĂNG", why: "giá lập đáy mới nhưng CVD không xuống theo → lực BÁN chủ động yếu dần (có hấp thụ)" }; } catch (e) { }
    return { type: null, txt: "Không phân kỳ", why: "đỉnh/đáy giá và CVD cùng chiều" };
  }
  function dienBien() {
    const n = bars.length - 1; if (n < 30) return "";
    const a = n - 6, dp = bars[n - 1].close - bars[a].close; let d5 = 0; for (let j = a + 1; j <= n - 1; j++) d5 += bars[j].delta || 0;
    let rg = 0, ad = 0; const k0 = Math.max(1, n - 50); for (let j = k0; j < n; j++) { rg += bars[j].high - bars[j].low; ad += Math.abs(bars[j].delta || 0); }
    const k = n - k0 || 1; rg /= k; ad /= k;
    const up = dp > 0.8 * rg, dn = dp < -0.8 * rg, strong = Math.abs(d5) > 1.5 * ad;
    let msg;
    if (up && d5 > 0) msg = G("Giá TĂNG + phe MUA chủ động") + " → có người mua thật, đà tăng KHOẺ.";
    else if (up) msg = Y("Giá TĂNG nhưng phe BÁN lại chủ động hơn") + " → tăng YẾU, dễ bị đạp xuống lại.";
    else if (dn && d5 < 0) msg = R("Giá GIẢM + phe BÁN chủ động") + " → có người bán thật, đà giảm KHOẺ.";
    else if (dn) msg = Y("Giá GIẢM nhưng phe MUA lại chủ động hơn") + " → giảm YẾU, có người đỡ giá, dễ bật lên.";
    else if (strong && d5 < 0) msg = Y("Giá đứng yên dù phe BÁN đập mạnh") + " → có người HẤP THỤ (đỡ giá ở dưới), để ý bật lên.";
    else if (strong && d5 > 0) msg = Y("Giá đứng yên dù phe MUA đẩy mạnh") + " → có người CHẶN BÁN ở trên, để ý đảo xuống.";
    else msg = "<b>Giá đi ngang, hai phe cân bằng</b> → chưa có lợi thế, chờ.";
    const bn = big5(); const big = bn != null && Math.abs(bn) >= 20 ? ` Cá mập: ${bn > 0 ? G("MUA ròng " + f0(bn) + " oz") : R("BÁN ròng " + f0(-bn) + " oz")}${(bn > 0) === (dp > 0) ? " — cùng chiều giá." : " — NGƯỢC chiều giá, cẩn thận đảo chiều."}` : "";
    return `${msg}${big} <span class="mu">(5 nến vừa đóng: giá ${sg(dp)} · Delta ${sg(d5)})</span>`;
  }
  // ───────────────────── uy tín tường / vùng ─────────────────────
  function wallScore(l) {
    let s = { CW: 40, PW: 40, GCW: 30, GPW: 30, T1: 25, T2: 25, MAG: 35, FLIP: 30 }[l.key] || 25; const plus = [`${s} ${{ CW: "tường chính GC", PW: "tường chính GC", GCW: "tường GLD", GPW: "tường GLD", MAG: "Magnet", FLIP: "Gamma Flip" }[l.key] || "tường phụ"}`], minus = [];
    const add = (v, t) => { s += v; (v >= 0 ? plus : minus).push(`${v >= 0 ? "+" : "−"}${Math.abs(v)} ${t}`); };
    if (l.hard) add(Math.round(l.hard * 0.25), `độ cứng ${l.hard}%`);
    if (l.doi != null && l.doi !== 0) add(l.doi >= DOI_REAL ? 12 : l.doi > 0 ? 6 : -8, `ΔOI ${sg(l.doi, f0)} (${l.doi >= DOI_REAL ? "LP mở vị thế mới → tường thật" : l.doi > 0 ? "được bồi thêm" : "đang bị dỡ"})`);
    const z = ZON.find((z) => l.xau >= z.lo - 1 && l.xau <= z.hi + 1); if (z) add(Math.min(15, (z.score - 1) * 8), `hội tụ ×${z.score}`);
    const fl = flipX(); if (fl != null) add(spot >= fl ? 10 : -10, spot >= fl ? "Gamma dương (tường hay giữ)" : "Gamma âm (tường dễ bị phá)");
    if (inHedge(l.xau)) add(-8, "nằm trong Vùng Hedge");
    if (l.flipped) add(-5, "tường đã bị phá, đang đổi vai");
    try { const h = window.tvlbRxFor ? window.tvlbRxFor(l.xau) : [], hb = h.filter((r) => r.res === "Bật lại").length;   // lịch sử phản ứng tại tường (trang ④)
      if (h.length >= 2) add(Math.round((hb / h.length - 0.5) * 30), `lịch sử bật ${hb}/${h.length} lần chạm`); } catch (e) { }
    s = Math.max(0, Math.min(100, s)); const st = s >= 80 ? 5 : s >= 65 ? 4 : s >= 50 ? 3 : s >= 35 ? 2 : 1;
    return { s, st, txt: ["", "Rất yếu", "Yếu", "Trung bình", "Mạnh", "Rất mạnh"][st], plus, minus };
  }
  // ───────────────────── Agent (hướng ưu tiên + độ tin cậy) ─────────────────────
  function agent() {
    const fl = flipX(), pos = fl == null ? true : spot >= fl, mag = lv("MAG"), v = vp(), now = Date.now();
    const cal = (S.state?.calendar || []).map((n) => ({ t: new Date(n.time).getTime(), title: n.title })).filter((n) => n.t > now);
    const soon = cal.find((n) => n.t - now < 3600e3);
    const vis = L.filter((l) => ["CW", "PW", "T1", "T2", "GCW", "GPW", "MAG"].includes(l.key));
    const res = vis.filter((l) => l.xau > spot + 1).sort((a, b) => a.xau - b.xau), sup = vis.filter((l) => l.xau < spot - 1).sort((a, b) => b.xau - a.xau);
    const zUp = ZON.filter((z) => z.lo > spot + 1).sort((a, b) => a.lo - b.lo)[0], zDn = ZON.filter((z) => z.hi < spot - 1).sort((a, b) => b.hi - a.hi)[0];
    let loc = "—", locSide = 0;
    if (v) { if (spot > v.vah) { loc = `trên VAH ${f2(v.vah)}`; locSide = 1; } else if (spot < v.val) { loc = `dưới VAL ${f2(v.val)}`; locSide = -1; } else { loc = `trong Value Area (POC ${f2(v.poc)})`; locSide = spot >= v.poc ? 0.5 : -0.5; } }
    let bias, why;
    if (!pos) { bias = locSide < 0 ? "SELL" : locSide > 0 ? "BUY" : spot < (v ? v.poc : fl) ? "SELL" : "BUY"; why = `Gamma ÂM (giá dưới Flip ${f2(fl)}): dealer đuổi theo giá → đánh THEO xu hướng, giá đang ${loc}.`; }
    else { const m = mag ? mag.xau : v ? v.poc : spot; bias = spot > m + 3 ? "SELL" : spot < m - 3 ? "BUY" : "RANGE"; why = `Gamma DƯƠNG (giá trên Flip ${f2(fl)}): dealer kìm giá → đánh HỒI về Magnet ${mag ? f2(mag.xau) : "—"}, giá đang ${loc}.`; }
    if (mag && mag.gex < 0) why += ` Magnet ${f2(mag.xau)} có GEX âm: bị phá thì giá dễ chạy xa → đi theo, không bắt ngược.`;
    const hz = inHedge(spot); if (hz) why += ` ⚠ Giá đang trong VÙNG HEDGE ${f2(hz.lo)}–${f2(hz.hi)}: biến động mở rộng.`;
    const parts = []; let cv = 0.5; let c12 = 0; for (const b of bars.slice(-13, -1)) c12 += b.delta || 0;
    const dxy = S.state?.macro?.DXY?.chg_n_pct ?? 0;
    if (bias === "SELL" || bias === "BUY") {
      const dir = bias === "SELL" ? -1 : 1;
      if (pos || Math.sign(locSide) === dir) { cv += 0.1; parts.push("+0.10 chế độ Gamma & vị trí Volume Profile ủng hộ"); }
      if (Math.sign(c12) === dir) { cv += 0.1; parts.push(`+0.10 Delta 12 nến ${sg(c12, f0)} cùng hướng`); } else if (c12) { cv -= 0.1; parts.push(`−0.10 Delta 12 nến ${sg(c12, f0)} ngược hướng`); }
      if (dxy && Math.sign(-dxy) === dir) { cv += 0.05; parts.push(`+0.05 DXY ${sg(dxy, (x) => x.toFixed(3))}% ủng hộ`); } else if (dxy) { cv -= 0.05; parts.push(`−0.05 DXY ${sg(dxy, (x) => x.toFixed(3))}% ngược`); }
      const zE = dir < 0 ? zUp : zDn; if (zE && Math.abs(zE.mid - spot) <= 30) { cv += 0.1; parts.push(`+0.10 có vùng hội tụ ×${zE.score} gần điểm vào`); }
      const tr = S.smc?.ms?.length ? S.smc.ms[S.smc.ms.length - 1].trend : 0; if (tr === dir) { cv += 0.05; parts.push(`+0.05 cấu trúc SMC ${S.tf} cùng hướng`); } else if (tr) { cv -= 0.05; parts.push(`−0.05 cấu trúc SMC ${S.tf} ngược hướng`); }
      const bn = big5(); if (bn != null && Math.abs(bn) >= 40) { cv += Math.sign(bn) === dir ? 0.05 : -0.05; parts.push(`${Math.sign(bn) === dir ? "+" : "−"}0.05 cá mập ${bn > 0 ? "MUA" : "BÁN"} ròng ${f0(Math.abs(bn))} oz`); }
      if (DIV.type) { const dv = DIV.type === "bull" ? 1 : -1; cv += dv === dir ? 0.05 : -0.05; parts.push(`${dv === dir ? "+" : "−"}0.05 CVD ${DIV.txt.toLowerCase()}`); }
      if (hz) { cv -= 0.1; parts.push("−0.10 giá trong Vùng Hedge (biến động mở rộng)"); }
    } else { cv = 0.3; parts.push("Giá quanh Magnet trong Gamma dương → đi ngang, chưa có lợi thế"); }
    if (soon) { cv -= 0.2; parts.push(`−0.20 sắp có tin đỏ: ${soon.title}`); }
    return { bias, why, cv: Math.max(0, Math.min(1, cv)), parts, pos, soon, cal };
  }
  // ───────────────────── kế hoạch KH1–KH3 ─────────────────────
  function planZones() {
    const Ls = L.filter((l) => PKEYS.includes(l.key) && Math.abs(l.xau - spot) <= 150).slice().sort((a, b) => a.xau - b.xau), Gs = [];
    Ls.forEach((l) => { const g = Gs[Gs.length - 1]; if (g && l.xau - g.m[g.m.length - 1].xau <= CONF_W) g.m.push(l); else Gs.push({ m: [l] }); });
    const zs = Gs.map((g) => {
      const xs = g.m.map((l) => l.xau), x = (Math.min(...xs) + Math.max(...xs)) / 2, side = spot < x ? -1 : 1;
      const sc = g.m.map((l) => wallScore(Object.assign({}, l, { flipped: (side < 0 && SUP.includes(l.key)) || (side > 0 && RES.includes(l.key)) ? 1 : 0 })));
      const best = sc.reduce((a, b) => (b.s > a.s ? b : a)), s = Math.min(100, best.s + 6 * (g.m.length - 1)), st = s >= 80 ? 5 : s >= 65 ? 4 : s >= 50 ? 3 : s >= 35 ? 2 : 1;
      const fl = g.m.filter((l) => (side < 0 && SUP.includes(l.key)) || (side > 0 && RES.includes(l.key))).map((l) => `${l.name} ${side < 0 ? "đã thủng → thành kháng cự" : "đã bị vượt → thành hỗ trợ"}`);
      return { x, lo: Math.min(...xs) - ZONE, hi: Math.max(...xs) + ZONE, side, m: g.m, nm: g.m.map((l) => (l.pool === "GLD" && !/GLD/.test(l.name) ? "GLD " : "") + l.name).join(" + "), s, st, txt: ["", "Rất yếu", "Yếu", "Trung bình", "Mạnh", "Rất mạnh"][st], why: best, fl };
    });
    return { up: zs.filter((z) => z.side < 0).sort((a, b) => a.x - b.x), dn: zs.filter((z) => z.side > 0).sort((a, b) => b.x - a.x) };
  }
  function mkPlan(id, role, kind, d, z, next) {
    if (!z) return null; let ref, sl, tp, trig, inval;
    if (kind === "fade") { ref = z.x; sl = d < 0 ? z.hi - ZONE + SLU : z.lo + ZONE - SLU; tp = next ? next.x : ref + d * 3 * Math.abs(ref - sl);
      trig = `giá vào <b>${f2(z.lo)}–${f2(z.hi)}</b> → nến đóng có <b>${d < 0 ? "râu TRÊN" : "râu DƯỚI"}</b> ≥ thân + Delta <b>${d < 0 ? "ÂM" : "DƯƠNG"}</b>`; inval = `nến đóng ${d < 0 ? "trên" : "dưới"} ${f2(sl)} (vùng bị phá)`; }
    else { ref = d < 0 ? z.lo : z.hi; sl = d < 0 ? z.hi : z.lo; tp = next ? next.x : ref + d * 2 * Math.abs(ref - sl);
      trig = `nến <b>đóng ${d < 0 ? "DƯỚI" : "TRÊN"} ${f2(ref)}</b> (xuyên hẳn vùng ${f2(z.lo)}–${f2(z.hi)}) + Delta <b>${d < 0 ? "ÂM" : "DƯƠNG"}</b>`; inval = `giá quay lại ${d < 0 ? "trên" : "dưới"} ${f2(sl)} (phá giả)`; }
    const rr = Math.abs(tp - ref) / Math.max(Math.abs(ref - sl), 0.5);
    return { id, role, kind, d, z, ref, sl, tp, tpNm: next ? next.nm : `${rr.toFixed(1)}R`, rr, trig, inval };
  }
  function ordCode(pre) { const n = (st_.get("ordseq", 0) || 0) + 1; st_.set("ordseq", n); return `${pre}-${String(n).padStart(4, "0")}`; }
  function buildPlans() {
    PZ = planZones(); const { up, dn } = PZ, bias = AG.bias;
    const strong = (arr) => arr.find((z) => z.s >= 20 && Math.abs(z.x - spot) <= 80) || arr[0];
    let P;
    if (bias === "SELL") { const u = strong(up); P = [mkPlan("KH1", "Chính — SELL khi giá hồi lên", "fade", -1, u, dn[0]), mkPlan("KH2", "Phụ — SELL theo hướng phá xuống", "break", -1, dn[0], dn[1]), mkPlan("KH3", "Đảo chiều — BUY khi giá bật tại hỗ trợ", "fade", 1, dn[0], up[0])]; }
    else if (bias === "BUY") { const w = strong(dn); P = [mkPlan("KH1", "Chính — BUY khi giá hồi xuống", "fade", 1, w, up[0]), mkPlan("KH2", "Phụ — BUY theo hướng phá lên", "break", 1, up[0], up[1]), mkPlan("KH3", "Đảo chiều — SELL khi giá bị chặn tại kháng cự", "fade", -1, up[0], dn[0])]; }
    else { const nu = up[0], nd = dn[0], upNear = nu && (!nd || nu.x - spot <= spot - nd.x);
      P = [upNear ? mkPlan("KH1", "Chính — SELL ở biên trên (đi ngang)", "fade", -1, nu, nd) : mkPlan("KH1", "Chính — BUY ở biên dưới (đi ngang)", "fade", 1, nd, nu),
        upNear ? mkPlan("KH2", "Phụ — BUY ở biên dưới (đi ngang)", "fade", 1, nd, nu) : mkPlan("KH2", "Phụ — SELL ở biên trên (đi ngang)", "fade", -1, nu, nd),
        upNear ? mkPlan("KH3", "Phá biên — BUY khi phá lên", "break", 1, nu, up[1]) : mkPlan("KH3", "Phá biên — SELL khi phá xuống", "break", -1, nd, dn[1])]; }
    P = P.filter(Boolean);
    const n = bars.length - 1, mv = n > 6 ? bars[n - 1].close - bars[n - 6].close : 0; let d5 = 0; for (let j = Math.max(1, n - 5); j <= n - 1; j++) d5 += bars[j].delta || 0;
    const mom = Math.sign(mv) === Math.sign(d5) ? Math.sign(mv) : 0, cv = AG.cv ?? 0.5, fl = flipX();
    P.forEach((p) => { let w = p.id === "KH1" ? 45 + 40 * (cv - 0.5) + (p.z.s - 50) * 0.3 : p.id === "KH2" ? 30 : 22 + (p.z.s - 50) * 0.3;
      if (p.kind === "break") { w += mom === p.d ? 12 : mom === -p.d ? -6 : 0; if (inHedge(spot)) w += 5; }
      if (p.id === "KH3" && DIV.type) w += (DIV.type === "bull" ? 1 : -1) === p.d ? 10 : -5;
      if (p.id === "KH3" && fl != null && spot < fl && p.kind === "fade") w -= 5;
      p.w = Math.max(5, w); });
    const lb = n > 1 ? bars[n - 1] : null, lc = n > 1 ? cinfo(n - 1) : null, mv3 = n > 4 ? bars[n - 1].close - bars[n - 4].close : 0;
    P.forEach((p) => { const z = p.z, inZ = spot >= z.lo && spot <= z.hi; if (!lb) { p.st = "CHỜ"; return; }
      if (p.kind === "fade") { const near = spot >= z.lo - 2 * ZONE && spot <= z.hi + 2 * ZONE, touched = near && lb.high >= z.lo && lb.low <= z.hi, rej = p.d < 0 ? rejSell(lc) : rejBuy(lc), broke = p.d < 0 ? lb.close > p.sl : lb.close < p.sl;
        const wk = p.d < 0 ? lc.up : lc.lo, need = Math.max(lc.body, 0.4 * lc.rng);
        p.chk = { okW: wk >= need, wk, need, okD: p.d < 0 ? lc.d < 0 : lc.d > 0, dl: lc.d };
        p.st = broke ? "HUỶ" : touched && rej ? "XÁC NHẬN" : inZ || touched ? "TRONG VÙNG" : "CHỜ"; p.dist = p.d < 0 ? z.lo - spot : spot - z.hi; p.toward = p.d < 0 ? mv3 > 0 : mv3 < 0; }
      else { const conf = p.d < 0 ? lb.close < p.ref && lc.d < 0 : lb.close > p.ref && lc.d > 0;
        p.chk = { okC: p.d < 0 ? lb.close < p.ref : lb.close > p.ref, okD: p.d < 0 ? lc.d < 0 : lc.d > 0, dl: lc.d };
        p.st = conf && Math.abs(spot - p.ref) <= 3 * ZONE ? "XÁC NHẬN" : inZ ? "ĐANG THỬ PHÁ" : "CHỜ"; p.dist = p.d < 0 ? spot - z.lo : z.hi - spot; p.toward = p.d < 0 ? mv3 < 0 : mv3 > 0; } });
    { const tw = P.filter((p) => p.st !== "HUỶ").reduce((a, p) => a + p.w, 0) || 1; P.forEach((p) => (p.prob = p.st === "HUỶ" ? 0 : Math.round((p.w / tw) * 100))); }
    // XÁC NHẬN → ghi lệnh (mã K1-0001…) và theo dõi tới TP / SL
    let ch = false;
    P.filter((p) => p.st === "XÁC NHẬN").forEach((p) => { const k = `${p.id}@${S.tf}@${lb.time}`; if (TRK.some((t) => t.k === k)) return;
      const safeSl = p.d < 0 ? Math.max(p.sl, lb.high + SLU, lb.close + SLU) : Math.min(p.sl, lb.low - SLU, lb.close - SLU);
      TRK.unshift({ k, code: ordCode(p.id.replace("KH", "K")), id: p.id, role: p.role, kind: p.kind, d: p.d, e: lb.close, sl: +safeSl.toFixed(2), sl0: +safeSl.toFixed(2), tp: p.tp, t: lb.time, tf: S.tf, zn: p.z.nm, zs: p.z.s, zst: p.z.st, prob: p.prob });
      ch = true; try { if (typeof window.tvlbAlert === "function") window.tvlbAlert(`k${k}${p.d < 0 ? "-1" : ""}`, `${p.id} XÁC NHẬN ${p.d < 0 ? "SELL" : "BUY"} @ ${f2(lb.close)} · SL ${f2(safeSl)} · TP ${f2(p.tp)} (${p.z.nm}, khung ${S.tf})`); } catch (e) { } });
    TRK.forEach((t) => { if (t.res || t.drop || t.tf && t.tf !== S.tf) return; const i0 = bars.findIndex((b) => b.time > t.t); if (i0 < 0) return;
      for (let j = i0; j < bars.length - 1; j++) { const b = bars[j]; if (t.d < 0 ? b.high >= t.sl : b.low <= t.sl) { t.res = "SL"; t.x = t.sl; t.xt = b.time; ch = true; break; } if (t.d < 0 ? b.low <= t.tp : b.high >= t.tp) { t.res = "TP"; t.x = t.tp; t.xt = b.time; ch = true; break; } } });
    if (ch) { TRK = TRK.slice(0, 1000); st_.set("trk", TRK); }
    PLANS = P;
  }
  // ───────────────────── lệnh đang chạy + khuyến nghị ─────────────────────
  function openOrders() {
    const out = TRK.filter((t) => !t.res && !t.drop).map((t) => ({ code: t.code, grp: t.code.split("-")[0], src: `${t.id} · ${t.zn} · ${t.tf || ""}`, d: t.d, e: t.e, sl: t.sl, sl0: t.sl0 ?? t.sl, tp: t.tp, t0: t.t * 1000, ref: t }));
    const pp = S.paper?.pos; if (pp) out.unshift({ code: "P-" + String(pp.time).slice(-4), grp: "P", src: `Paper ${pp.lots} lot${pp.note ? " · " + pp.note : ""}`, d: pp.side === "SELL" ? -1 : 1, e: pp.entry, sl: pp.sl, sl0: pp.sl, tp: pp.tp, t0: pp.time * 1000, paper: true });
    return out;
  }
  const isWatched = (o) => WATCH.grp[o.grp] !== false && !WATCH.off[o.code];
  function ordAdvice(o) {
    const risk = o.sl0 ? Math.abs(o.e - o.sl0) : null, Rv = risk ? ((spot - o.e) * o.d) / risk : null, n = bars.length - 1;
    let d5 = 0; for (let j = Math.max(1, n - 5); j <= n - 1; j++) d5 += bars[j].delta || 0;
    const mv = n > 6 ? bars[n - 1].close - bars[n - 6].close : 0, mom = Math.sign(mv) === Math.sign(d5) ? Math.sign(mv) : 0;
    const zs = (o.d < 0 ? PZ.dn : PZ.up) || [], obs = zs.find((z) => (o.d < 0 ? z.x < spot + ZONE && (!o.tp || z.x > o.tp + 1) : z.x > spot - ZONE && (!o.tp || z.x < o.tp - 1)));
    const obsNear = obs && Math.abs(obs.x - spot) <= ZONE + 1, tpD = o.tp ? (o.tp - spot) * o.d : null, slD = o.sl ? (spot - o.sl) * o.d : null;
    const lk = bars.slice(-4, -1), trail = lk.length ? (o.d < 0 ? Math.max(...lk.map((b) => b.high)) + SLU : Math.min(...lk.map((b) => b.low)) - SLU) : null;
    const trailOk = trail != null && o.sl != null && (o.d < 0 ? trail < o.sl : trail > o.sl) && (o.d < 0 ? trail > spot : trail < spot);
    let act, col; const why = [];
    if (Rv != null && Rv <= -0.7 && mom === -o.d) { act = "THOÁT SỚM"; col = "#ff5252"; why.push(`đã lỗ ${Rv.toFixed(2)}R, lực đang đi ngược (giá + Delta)`); }
    else if (obsNear) { act = "CHỐT 1 PHẦN"; col = "#ffb300"; why.push(`giá đang chạm cản ${obs.nm} ${f2(obs.x)} trước TP`); }
    else if (Rv != null && Rv >= 1 && (!o.sl || (o.d < 0 ? o.sl > o.e : o.sl < o.e))) { act = mom === o.d ? "GỒNG + DỜI SL HOÀ VỐN" : "DỜI SL HOÀ VỐN"; col = "#26a69a"; why.push(`đã lãi ${Rv.toFixed(2)}R → khoá rủi ro tại giá vào ${f2(o.e)}`); }
    else if (mom === o.d) { act = "GỒNG"; col = "#26a69a"; why.push("giá + Delta đang đi đúng hướng lệnh"); }
    else if (mom === -o.d && Rv != null && Rv > 0) { act = "CHỐT 1 PHẦN / SIẾT SL"; col = "#ffb300"; why.push("đang lãi nhưng lực đảo chiều (giá + Delta ngược)"); }
    else { act = "GIỮ — THEO DÕI"; col = "#9aa4b2"; why.push("chưa có tín hiệu rõ, giữ nguyên SL/TP"); }
    if (obs && !obsNear) why.push(`cản phía trước: ${obs.nm} ${f2(obs.x)}`);
    if (inHedge(spot)) why.push("trong Vùng Hedge: biến động mạnh");
    return { R: Rv, act, col, why, tpD, slD, trail: trailOk ? +trail.toFixed(2) : null, nb: Math.max(0, Math.round((Date.now() - o.t0) / 1000 / (TF_SEC[S.tf] || 900))) };
  }
  // ───────────────────── giao diện ─────────────────────
  const STC = { "XÁC NHẬN": "#00c853", "TRONG VÙNG": "#ffb300", "ĐANG THỬ PHÁ": "#ffb300", CHỜ: "#455064", HUỶ: "#7f1d1d" };
  const stChip = (s) => `<span class="v3s" style="background:${STC[s] || "#455064"};color:${s === "CHỜ" || s === "HUỶ" ? "#e6e6e6" : "#111"}">${s}</span>`;
  const css = document.createElement("style");
  css.textContent = `
.v3grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; flex: 1 1 auto; min-height: 0; }
.v3grid > .panel { min-height: 0; overflow: auto; font-size: 12.5px; }
.v3grid > .v3plan { grid-row: 1 / span 2; grid-column: 2; }
@media (max-width: 1250px) { .v3grid { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto; } .v3grid > .v3plan { grid-row: auto; grid-column: auto; } }
.v3box { border: 1.5px solid #455064; border-radius: 6px; padding: 7px 9px; font-weight: 700; margin-bottom: 6px; }
.v3s { display: inline-block; padding: 0 6px; margin: 0 4px; border-radius: 3px; font-size: 10.5px; font-weight: 700; }
.v3row { display: flex; gap: 6px; align-items: baseline; margin: 3px 0; flex-wrap: wrap; }
.v3kv { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; } .v3kv > div:nth-child(odd) { color: var(--muted, #7d8796); }
.v3c { border-left: 3px solid #455064; padding: 5px 8px; margin: 6px 0; background: rgba(255,255,255,.02); border-radius: 0 5px 5px 0; line-height: 1.55; }
.v3c .kt { font-weight: 700; }
.v3sw button { background: var(--panel, #161b22); color: var(--fg, #ddd); border: 1px solid var(--line, #2b3440); border-radius: 4px; padding: 2px 8px; margin-right: 4px; cursor: pointer; font-size: 11.5px; }
.v3sw button.on { border-color: #e0a83a; color: #f3d38c; }
.v3grid .panel > header > h2:only-child { margin-left: 0 !important; }
.tvlb-shot .v3btn, .tvlb-shot #tvlbCd { display: none !important; }`;
  document.head.appendChild(css);
  // nút trang ③ + trang
  const bar = document.querySelector("#pgbar"), aside = document.querySelector(".right");
  if (!bar || !aside) return;
  const btn = document.createElement("button"); btn.type = "button"; btn.dataset.pg = "3"; btn.className = "v3btn"; btn.textContent = "③ Vào lệnh"; bar.appendChild(btn);
  const page = document.createElement("div"); page.className = "page"; page.dataset.pg = "3"; page.hidden = true;
  page.innerHTML = `<div class="v3grid">
    <section class="panel v3track"><header><h2>Theo dõi diễn biến</h2><span class="muted small" id="v3regime"></span></header><div id="v3sig" class="v3box">—</div><div id="v3trk"></div></section>
    <section class="panel v3ctx"><header><h2>Bối cảnh thị trường</h2></header><div class="v3kv" id="v3ctx"></div></section>
    <section class="panel v3plan"><header><h2>Kế hoạch giao dịch</h2><span class="muted small" id="v3act"></span></header><div id="v3plan"></div></section></div>`;
  const tail = aside.querySelector("#pineOut"); aside.insertBefore(page, tail || null);
  // nút trong menu ẩn bên trái
  function menuBtns() {
    const pm = document.querySelector("#tvlbPlus .pm"); if (!pm || pm.querySelector("#v3m")) return;
    const wrap = document.createElement("div"); wrap.id = "v3m";
    wrap.innerHTML = `<div class="ps">Trang thêm</div><button class="pb" id="v3mP"></button><button class="pb" id="v3mS"></button>`;
    pm.insertBefore(wrap, pm.querySelector(":scope > .ps"));
    const sync = () => { const a = document.querySelector("#v3mP"), b = document.querySelector("#v3mS");
      a.textContent = `③ Trang Vào lệnh: ${VP.p3 ? "HIỆN" : "ẨN"}`; a.classList.toggle("on", VP.p3);
      b.textContent = `📷 Chế độ chụp màn hình: ${VP.shot ? "BẬT (ẩn phần riêng)" : "TẮT"}`; b.classList.toggle("on", VP.shot); };
    document.querySelector("#v3mP").onclick = () => { VP.p3 = !VP.p3; st_.set("p3", VP.p3); applyVis(); sync(); };
    document.querySelector("#v3mS").onclick = () => { VP.shot = !VP.shot; st_.set("shot", VP.shot); applyVis(); sync(); };
    sync();
  }
  function applyVis() {
    const hide = VP.shot || !VP.p3; btn.style.display = hide ? "none" : "";
    document.body.classList.toggle("tvlb-shot", VP.shot);
    if (hide && !page.hidden) { const b1 = bar.querySelector('[data-pg="1"]'); if (b1) b1.click(); }
  }
  setTimeout(() => { menuBtns(); applyVis(); }, 0);
  page.addEventListener("click", (e) => {
    const t = e.target;
    if (t.dataset.ow) { if (t.checked) delete WATCH.off[t.dataset.ow]; else WATCH.off[t.dataset.ow] = 1; st_.set("watch", WATCH); render(); return; }
    if (t.dataset.og) { WATCH.grp[t.dataset.og] = WATCH.grp[t.dataset.og] === false; st_.set("watch", WATCH); render(); return; }
    if (t.dataset.odrop) { const r = TRK.find((x) => x.code === t.dataset.odrop); if (r) { r.drop = 1; st_.set("trk", TRK); } render(); return; }
    if (t.dataset.pv) { PLANVIEW = t.dataset.pv; st_.set("planview", PLANVIEW); render(); return; }
    if (t.dataset.tv) { TRKVIEW = t.dataset.tv; render(); }
  });
  function plansHtml() {
    if (!PLANS.length) return '<span class="muted">Chưa đủ dữ liệu tường quanh giá để lập kế hoạch (chờ engine có dữ liệu Options).</span>';
    return PLANS.map((p) => { const c = p.d < 0 ? "#ef5350" : "#26a69a", zc = p.z.st >= 4 ? "#26a69a" : p.z.st === 3 ? "#ffd600" : "#ff7043";
      return `<div class="v3c" style="border-left-color:${c}${p.st === "HUỶ" ? ";opacity:.55" : ""}"><span class="kt" style="color:${c}">${p.id} · ${p.role}</span> <b>${p.prob}%</b>${stChip(p.st)}
        <br>Vùng: <b>${f2(p.z.lo)}–${f2(p.z.hi)}</b> = ${p.z.nm} <span style="color:${zc}" title="${[...p.z.why.plus, ...p.z.why.minus].join("\n")}">${starTxt(p.z.st)} ${p.z.txt} ${p.z.s}</span> · cách ${sg(p.z.x - spot)}
        ${p.z.fl.length ? `<br><b style="color:#ffd600">↳ ${p.z.fl.join(" · ")}</b>` : ""}
        <br>Điều kiện: ${p.trig}<br>SL <b>${f2(p.sl)}</b> · TP <b>${f2(p.tp)}</b> <span class="muted">(${p.tpNm})</span> · R:R 1:${p.rr.toFixed(1)}<br><span class="muted">Huỷ khi: ${p.inval}</span></div>`; }).join("");
  }
  function ordCard(o, compact) {
    const a = ordAdvice(o), w = isWatched(o), c = o.d < 0 ? "#ef5350" : "#26a69a";
    return `<div class="v3c" style="border-left-color:${c}${w ? "" : ";opacity:.45"}"><label style="cursor:pointer"><input type="checkbox" data-ow="${o.code}" ${w ? "checked" : ""}> <b>${o.code}</b></label> <b style="color:${c}">${o.d < 0 ? "SELL" : "BUY"} ${f2(o.e)}</b> <span class="muted">${o.src}</span>
      <br>${a.R != null ? `<b class="${a.R >= 0 ? "pos" : "neg"}">${a.R >= 0 ? "+" : ""}${a.R.toFixed(2)}R</b> · ` : ""}SL ${o.sl ? f2(o.sl) : "—"}${a.slD != null ? ` (cách ${f2(a.slD)})` : ""} · TP ${o.tp ? f2(o.tp) : "—"}${a.tpD != null ? ` (còn ${f2(a.tpD)})` : ""} · ${a.nb} nến
      <br>➜ <b style="color:${a.col}">${a.act}</b>${a.trail ? ` · SL gợi ý <b>${f2(a.trail)}</b>` : ""}${compact ? "" : `<br><span class="muted">${a.why.join(" · ")}</span>`}
      ${o.paper || compact ? "" : `<div style="margin-top:3px" class="v3sw"><button data-odrop="${o.code}">Bỏ theo dõi</button></div>`}</div>`;
  }
  function ordersHtml() {
    const O = openOrders(), Gp = [["K1", "KH1"], ["K2", "KH2"], ["K3", "KH3"], ["P", "Paper"]];
    const chips = Gp.map(([g, nm]) => { const n = O.filter((o) => o.grp === g).length, on = WATCH.grp[g] !== false; return `<button class="${on ? "on" : ""}" data-og="${g}">${on ? "☑" : "☐"} ${nm} (${n})</button>`; }).join("");
    return `<div class="v3sw" style="margin-bottom:4px">${chips}</div>` + (O.length ? O.map((o) => ordCard(o, false)).join("") : '<div class="muted">Không có lệnh nào đang chạy. Lệnh được ghi khi một kế hoạch chuyển XÁC NHẬN, hoặc khi mở lệnh ở Account · Paper.</div>')
      + '<div class="muted" style="font-size:11px;margin-top:4px">Khuyến nghị: GỒNG · DỜI SL HOÀ VỐN (lãi ≥ 1R) · CHỐT 1 PHẦN (chạm cản trước TP / lực đảo chiều) · THOÁT SỚM (lỗ ≥ 0.7R và lực đi ngược).</div>';
  }
  function render() {
    if (page.hidden || !spot) return;
    const fl = flipX(), pos = fl == null || spot >= fl;
    const rg = document.querySelector("#v3regime"); rg.textContent = fl == null ? "" : pos ? `GAMMA DƯƠNG (Spot trên Flip ${f2(fl)})` : `GAMMA ÂM (Spot dưới Flip ${f2(fl)})`; rg.style.color = pos ? "#26a69a" : "#ef5350";
    // kế hoạch
    const bc = AG.bias === "SELL" ? "#ef5350" : AG.bias === "BUY" ? "#26a69a" : "#ffb300", nO = openOrders().length;
    const sw = `<div class="v3sw" style="margin-bottom:6px"><button class="${PLANVIEW === "plan" ? "on" : ""}" data-pv="plan">🧭 Kế hoạch mới</button><button class="${PLANVIEW === "ord" ? "on" : ""}" data-pv="ord">📋 Lệnh đang chạy (${nO})</button></div>`;
    const head = `<div><b style="color:${bc};font-size:1.08em">${{ SELL: "Ưu tiên SELL", BUY: "Ưu tiên BUY", RANGE: "Đi ngang — đánh 2 biên" }[AG.bias] || "—"}</b> · tin cậy <b>${(AG.cv ?? 0).toFixed(2)}</b> <span class="muted" style="cursor:help" title="${(AG.parts || []).join("\n")}">(rê chuột xem điểm)</span></div><div class="muted" style="margin:2px 0 4px">${AG.why || ""}</div>`;
    document.querySelector("#v3plan").innerHTML = PLANVIEW === "ord" ? sw + ordersHtml() : sw + head + plansHtml() + `<div class="muted" style="font-size:11px">% = khả năng ước lượng giữa 3 kế hoạch (trọng số, chưa kiểm chứng). Uy tín ${starTxt(4)} trở lên = mạnh · ${starTxt(3)} = đánh nhỏ · ${starTxt(2)} trở xuống = bỏ qua.</div>`;
    const conf = PLANS.find((p) => p.st === "XÁC NHẬN"), inz = PLANS.filter((p) => p.st === "TRONG VÙNG" || p.st === "ĐANG THỬ PHÁ");
    const act = conf ? `${conf.id} XÁC NHẬN` : inz.length ? `${inz[0].id} TRONG VÙNG` : "WAIT";
    document.querySelector("#v3act").innerHTML = `<b style="color:${act === "WAIT" ? "#9aa4b2" : (conf || inz[0]).d < 0 ? "#ef5350" : "#26a69a"}">${act}</b>`;
    // theo dõi diễn biến
    const box = document.querySelector("#v3sig"), tb = document.querySelector("#v3trk"); let hd, col = "#7d8796";
    if (conf) { hd = `✅ ${conf.id} XÁC NHẬN ${conf.d < 0 ? "SELL" : "BUY"} — vào lệnh @ ${f2(spot)} · SL ${f2(conf.sl)} · TP ${f2(conf.tp)}`; col = conf.d < 0 ? "#ef5350" : "#26a69a"; }
    else if (inz.length) { const same = inz.length > 1 && inz.every((p) => p.z === inz[0].z);
      hd = same ? `⏳ Giá đang ở vùng ${f2(inz[0].z.lo)}–${f2(inz[0].z.hi)}: chờ xem ${inz.map((p) => `${p.kind === "break" ? "PHÁ" : "BẬT"} (${p.id})`).join(" hay ")}` : `⏳ Giá đang ở vùng ${inz[0].id} (${f2(inz[0].z.lo)}–${f2(inz[0].z.hi)}): chờ nến đóng`; col = "#ffb300"; }
    else { const n = bars.length - 1, mv = n > 4 ? bars[n - 1].close - bars[n - 4].close : 0, rgv = bars.slice(-21, -1).reduce((a, b) => a + b.high - b.low, 0) / 20 || 1;
      const ab = PLANS.filter((p) => p.z.x > spot && p.st !== "HUỶ").sort((a, b) => a.z.x - b.z.x), be = PLANS.filter((p) => p.z.x < spot && p.st !== "HUỶ").sort((a, b) => b.z.x - a.z.x);
      const dU = ab.length ? Math.min(...ab.map((p) => p.z.lo - spot)) : null, dD = be.length ? Math.min(...be.map((p) => spot - p.z.hi)) : null;
      if (mv > 0.5 * rgv && ab.length) hd = `↗ Giá đang ĐI LÊN về vùng ${ab[0].id} ${f2(ab[0].z.lo)}–${f2(ab[0].z.hi)} (còn ${f2(dU)})`;
      else if (mv < -0.5 * rgv && be.length) hd = `↘ Giá đang ĐI XUỐNG về vùng ${be[0].id} ${f2(be[0].z.lo)}–${f2(be[0].z.hi)} (còn ${f2(dD)})`;
      else hd = `↔ Giá đi ngang giữa ${ab.length ? `${ab[0].id} phía trên (còn ${f2(dU)})` : "—"} và ${be.length ? `${be[0].id} phía dưới (còn ${f2(dD)})` : "—"}`; }
    const WO = openOrders().filter(isWatched);
    if (TRKVIEW === "ord") { box.innerHTML = `📋 Lệnh đang theo dõi (${WO.length})`; box.style.borderColor = box.style.color = "#ffb300";
      tb.innerHTML = `<div class="v3sw"><button data-tv="now">← Diễn biến hiện tại</button></div>` + (WO.length ? WO.map((o) => ordCard(o, true)).join("") : '<div class="muted">Không có lệnh nào đang được theo dõi.</div>'); }
    else {
      box.innerHTML = hd; box.style.borderColor = box.style.color = col;
      const rows = PLANS.map((p) => { let det;
        if (p.st === "TRONG VÙNG" && p.chk) det = `nến vừa đóng: ${p.chk.okW ? G("✓") : R("✗")} râu ${f2(p.chk.wk)} (cần ≥ ${f2(p.chk.need)}) · ${p.chk.okD ? G("✓") : R("✗")} Delta ${sg(p.chk.dl, f0)} · chờ đóng nến (${cdText()})`;
        else if (p.st === "ĐANG THỬ PHÁ") det = `chờ nến đóng ${p.d < 0 ? "dưới" : "trên"} ${f2(p.ref)} + Delta ${p.d < 0 ? "ÂM" : "DƯƠNG"} (${cdText()})`;
        else if (p.st === "XÁC NHẬN") det = `<b>vào ${p.d < 0 ? "SELL" : "BUY"}</b> · SL ${f2(p.sl)} · TP ${f2(p.tp)}`;
        else if (p.st === "HUỶ") det = `kịch bản sai: ${p.inval}`;
        else det = `còn ${f2(Math.max(0, p.dist))} tới vùng · ${p.toward ? '<span style="color:#ffd600">giá đang tiến lại gần</span>' : '<span class="muted">giá đang đi ra xa</span>'}`;
        return `<div class="v3row"><b style="color:${p.d < 0 ? "#ef5350" : "#26a69a"};min-width:30px">${p.id}</b>${stChip(p.st)}<span>${det}</span></div>`; }).join("");
      const oLine = (o) => { const a = ordAdvice(o); return `<div class="v3row"><b>${o.code}</b><b style="color:${o.d < 0 ? "#ef5350" : "#26a69a"}">${o.d < 0 ? "SELL" : "BUY"}</b>${a.R != null ? `<span class="${a.R >= 0 ? "pos" : "neg"}">${a.R >= 0 ? "+" : ""}${a.R.toFixed(2)}R</span>` : ""}<b style="color:${a.col}">${a.act}</b>${a.trail ? `<span class="muted">SL→${f2(a.trail)}</span>` : ""}</div>`; };
      const recent = TRK.filter((t) => t.tf === S.tf).slice(0, 3).map((t) => `<div class="v3row"><span class="muted">${new Date(t.t * 1000).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span><b style="color:${t.d < 0 ? "#ef5350" : "#26a69a"}">${t.code} ${t.d < 0 ? "SELL" : "BUY"}</b> ${f2(t.e)} → ${t.res ? `<b class="${t.res === "TP" ? "pos" : "neg"}">${t.res}</b>` : '<b style="color:#ffb300">đang chạy</b>'}</div>`).join("");
      tb.innerHTML = `<div style="margin:2px 0 6px"><b>Diễn biến:</b> ${dienBien() || '<span class="muted">chưa đủ nến</span>'}</div>${rows}`
        + (WO.length ? `<div class="muted" style="margin-top:6px">Lệnh đang chạy (${WO.length}):${WO.length > 3 ? ` <span class="v3sw"><button data-tv="ord">Xem tất cả</button></span>` : ""}</div>${WO.slice(0, 3).map(oLine).join("")}` : recent ? `<div class="muted" style="margin-top:6px">Lệnh theo kế hoạch gần đây:</div>${recent}` : "");
    }
    // bối cảnh thị trường
    const ctx = [], m = S.state?.macro || {}, dx = m.DXY, n = bars.length, last = n > 1 ? cinfo(n - 2) : null;
    ctx.push(["DXY", dx ? `${f2(dx.last)} (${sg(dx.chg_n_pct, (x) => x.toFixed(3))}%/5p) · ${dx.chg_n_pct > 0.02 ? R("DXY đang TĂNG → ủng hộ SELL vàng") : dx.chg_n_pct < -0.02 ? G("DXY đang GIẢM → ủng hộ BUY vàng") : "DXY đi ngang"}` : "—"]);
    let ses = false; try { ses = inUsSession(Date.now() / 1000); } catch (e) { }
    ctx.push(["Phiên", ses ? G("Phiên Mỹ 19–23h") + " — thanh khoản cao, tín hiệu tường đáng tin hơn" : "Ngoài phiên Mỹ (19–23h)"]);
    ctx.push(["Chế độ", pos ? "Gamma dương → đánh hồi tại tường" : "Gamma âm → dễ phá tường, hạn chế bắt đỉnh/đáy"]);
    ctx.push(["Nến vừa đóng", last ? `râu ↑${f2(last.up)} ↓${f2(last.lo)} · thân ${f2(last.body)} · Delta ${sg(last.d, f0)}` : "—"]);
    const og = S.state?.options || {}; ctx.push(["Net GEX", ["GC", "GLD"].filter((k) => og[k]).map((k) => `${k} ${sg((og[k].net_gex || 0) / 1e6, (x) => x.toFixed(1))}M$`).join(" · ") + " <span class='muted'>(40/40/20)</span>"]);
    if (S.smc && S.smc.struct) ctx.push(["SMC", `${S.smc.struct}${S.smc.plan && S.smc.plan[0] ? ` · ${S.smc.plan[0]}` : ""}`]);
    ctx.push(["CVD", `${DIV.type ? `<b class="${DIV.type === "bear" ? "neg" : "pos"}">${DIV.txt}</b> — ` : ""}${DIV.why || DIV.txt}`]);
    const mg = lv("MAG"); if (mg) ctx.push(["Magnet", `${f2(mg.xau)}${mg.gex != null ? ` — <b style="color:${mg.gex >= 0 ? "#26a69a" : "#ff5252"}">${mg.gex >= 0 ? "Magnet hút" : "Magnet đẩy (GEX âm)"}</b>` : ""} · cách ${sg(mg.xau - spot)}`]);
    const hz = inHedge(spot); ctx.push(["Vùng Hedge", hz ? `<b style="color:#ff5252">ĐANG TRONG ${f2(hz.lo)}–${f2(hz.hi)}</b> — biến động mở rộng` : "ngoài vùng hedge lớn"]);
    const zN = ZON.slice().sort((a, b) => Math.abs(a.mid - spot) - Math.abs(b.mid - spot))[0]; if (zN) ctx.push(["Hội tụ gần nhất", `×${zN.score} ${f2(zN.lo)}–${f2(zN.hi)}: ${zN.srcs.join(", ")} (cách ${sg(zN.mid - spot)})`]);
    if (AG.cal && AG.cal.length) ctx.push(["Tin đỏ", AG.cal.slice(0, 2).map((x) => `${new Date(x.t).toLocaleString("vi-VN", { weekday: "short", hour: "2-digit", minute: "2-digit" })} ${x.title}`).join(" · ")]);
    document.querySelector("#v3ctx").innerHTML = ctx.map(([k, v]) => `<div>${k}</div><div>${v}</div>`).join("");
  }
  function tick() {
    try {
      if (typeof S === "undefined" || !S.candles || S.candles.length < 30 || !S.state) return;
      bars = S.candles; spot = lastPrice(); if (spot == null) return;
      L = buildLevels(); ZON = calcZones(); DIV = calcDiv(); AG = agent(); buildPlans(); render();
    } catch (e) { console.error("TVLB vào lệnh:", e); }
  }
  setInterval(tick, 1500); setTimeout(tick, 2500);
  bar.addEventListener("click", (e) => { if (e.target.closest("button")) setTimeout(tick, 50); });
  window.tvlbPlans = () => ({ PLANS, AG, L, ZON, TRK });
  window.tvlbScore = (l) => (spot ? wallScore(l) : null);   // uy tín tường cho phần giải thích khi rê chuột   // để kiểm tra / mở rộng (lớp vẽ chart, cảnh báo)
})();
