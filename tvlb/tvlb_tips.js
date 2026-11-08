/* TVLB+ · GIẢI THÍCH CHI TIẾT KHI RÊ CHUỘT (như TVL Quant) — phần riêng.
   Trả về HTML cho: vạch/nhãn tường trên chart (công thức, độ cứng, ΔOI, GEX, uy tín, hành động), Gamma Flip, Magnet, Max Pain,
   từng dòng + từng cột bảng Strike Profile, ô Agent, bảng Hedge LP, bảng Nhật ký, KPI. tvlb_plus.js gọi window.tvlbTipX(event). */
(function () {
  "use strict";
  const f2 = (x) => (x == null || !isFinite(x) ? "—" : Number(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const f4 = (x) => (x == null || !isFinite(x) ? "—" : Number(x).toFixed(4));
  const f0 = (x) => (x == null || !isFinite(x) ? "—" : Math.round(x).toLocaleString("en-US"));
  const sg = (x, f = f2) => (x == null || !isFinite(x) ? "—" : (x >= 0 ? "+" : "−") + f(Math.abs(x)));
  const M$ = (v) => (v == null || !isFinite(v) ? "—" : sg(v / 1e6, (x) => x.toFixed(2)) + "M$");
  const sec = (t, body, col) => `<div style="margin-top:6px;padding-top:5px;border-top:1px solid #2b3440"><b style="color:${col || "#f3d38c"}">${t}</b><br>${body}</div>`;
  const code = (x) => `<code style="background:#1d2530;padding:0 4px;border-radius:3px;color:#ffe9a8">${x}</code>`;
  const star = (n) => `<span style="color:#ffc400">${"★".repeat(n)}</span><span style="color:#5f6b7a">${"★".repeat(5 - n)}</span>`;
  const H = (t, c) => `<div style="font-weight:700;font-size:13px;color:${c || "#f3d38c"};margin-bottom:4px">${t}</div>`;
  const ZONE = 4, SLU = 3;
  const phi = (x) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
  const ncdf = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989423 * Math.exp(-x * x / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; };
  const px = () => { try { return lastPrice(); } catch (e) { return null; } };
  const flip = () => { try { return primV()?.chart?.gamma_flip ?? null; } catch (e) { return null; } };
  const srcInfo = (o) => o.source === "GLD" ? `yfinance (OPRA) · ${o.n_expiries ?? (o.expiries || []).length} kỳ: ${(o.expiries || []).slice(0, 4).join(", ")}` : `CME Settlements ${o.cme?.trade_date || ""}${o.cme?.prev_date ? ` (phiên trước ${o.cme.prev_date})` : ""} · ${o.n_expiries ?? (o.expiries || []).length} kỳ: ${(o.expiries || []).slice(0, 4).join(", ")}`;
  const conv = (o, s) => o.source === "GLD"
    ? `• <b>Đổi ra giá XAU:</b> Hệ số XAU/GLD = giá chart ÷ giá GLD = ${code(f4(o.ratio))} → Giá XAU = Strike GLD × hệ số = ${s.strike} × ${f4(o.ratio)} = ${code(f2(s.chart))}`
    : `• <b>Đổi ra giá XAU:</b> Giá XAU = Strike GC × (giá chart ÷ giá GC Future) = ${s.strike} × ${f4(o.ratio)} = ${code(f2(s.chart))} <span style="color:#9aa4b2">(tương đương trừ basis ${f2(s.strike - s.chart)}$)</span>`;
  function front(o, s) {   // công thức Gamma kỳ gần nhất (Black-76 cho GC, Black-Scholes có carry cho GLD) để kiểm tra
    const F = o.underlying, K = s.strike, iv = s.iv, T = (s.dte || 0) / 365, r = o.rate || 0, b = o.carry ?? 0;
    if (!F || !iv || !(T > 0)) return "<span style=\"color:#9aa4b2\">(thiếu IV/DTE kỳ gần nhất để minh hoạ công thức)</span>";
    const sq = iv * Math.sqrt(T), d1 = (Math.log(F / K) + (b + iv * iv / 2) * T) / sq, g = Math.exp((b - r) * T) * phi(d1) / (F * sq);
    return `• d1 = [ln(F/K) + (b + σ²/2)·T] ÷ (σ√T) = [ln(${f2(F)}/${K}) + (${b.toFixed(4)} + ${iv.toFixed(3)}²/2)×${T.toFixed(4)}] ÷ (${iv.toFixed(3)}×√${T.toFixed(4)}) = ${code(d1.toFixed(4))}<br>
      • Γ = e^((b−r)T)·φ(d1) ÷ (F·σ·√T) = ${code(g.toExponential(4))} <span style="color:#9aa4b2">(bảng: ${s.gamma != null ? Number(s.gamma).toExponential(3) : "—"}; kỳ gần nhất ${s.dte} ngày, IV ${(iv * 100).toFixed(1)}%)</span><br>
      • GEX 1 kỳ = Γ × OI × ${o.multiplier || 100} × F² × 1% — cộng mọi kỳ, mỗi kỳ nhân trọng số rổ DATE ×1.2 · WEEK ×1.2 · MONTH ×0.6 (40/40/20)`;
  }
  function score(l) { try { return window.tvlbScore ? window.tvlbScore(l) : null; } catch (e) { return null; } }

  // ───────────────────── tường / strike trên chart ─────────────────────
  function tipStrike(o, s, side0) {
    const p = px(), dist = s.chart - (p ?? s.chart), isGld = o.source === "GLD", isCW = s.strike === o.call_wall, isPW = s.strike === o.put_wall;
    const maxOI = Math.max(1, ...o.strikes.map((x) => x.call_oi + x.put_oi)), oi = s.call_oi + s.put_oi, share = Math.round((oi / maxOI) * 100);
    const res = isCW || (!isPW && (side0 ? side0 === "c" : s.chart >= (p ?? s.chart)));
    const nm = isCW ? "Call Wall" : isPW ? "Put Wall" : res ? "tường kháng cự (OI lớn)" : "tường hỗ trợ (OI lớn)";
    const maxC = Math.max(1, ...o.strikes.map((x) => x.call_oi)), maxP = Math.max(1, ...o.strikes.map((x) => x.put_oi));
    const hard = res ? Math.round((100 * s.call_oi) / maxC) : Math.round((100 * s.put_oi) / maxP);
    const why = isCW ? `Strike có <b>Call OI lớn nhất</b> phía trên giá (trong ±8% quanh giá ${isGld ? "GLD" : "GC"} ${f2(o.underlying)}).`
      : isPW ? `Strike có <b>Put OI lớn nhất</b> phía dưới giá (trong ±8%).`
      : `Một trong 10 strike có <b>tổng OI (Call + Put) lớn nhất</b> quanh giá — nhãn hiện khi OI ≥ 12% strike lớn nhất.`;
    const key = isGld ? (res ? "GCW" : "GPW") : isCW ? "CW" : isPW ? "PW" : res ? "T1" : "T2";
    const w = score({ key, xau: s.chart, hard, doi: s.d_oi, pool: o.source });
    const fl = flip(), neg = fl != null && p != null && p < fl;
    const act = res
      ? `• Giá vào vùng <b>${f2(s.chart - ZONE)}–${f2(s.chart + ZONE)}</b>: chờ nến <b>đóng</b> có râu TRÊN (râu ≥ thân và ≥ 40% biên độ) + Delta ÂM → <b>canh SELL</b>.<br>• SL = đỉnh râu + ${SLU}$ (xa nhất ≈ ${f2(s.chart + ZONE + SLU)}).<br>• Nến thân dài đóng trên ${f2(s.chart + ZONE + SLU)} kèm CVD tăng → tường bị phá, <b>huỷ Sell</b>${neg ? ", Gamma âm → có thể đánh theo hướng phá" : ""}.`
      : `• Giá vào vùng <b>${f2(s.chart - ZONE)}–${f2(s.chart + ZONE)}</b>: chờ nến <b>đóng</b> có râu DƯỚI + Delta DƯƠNG → <b>canh BUY</b>.<br>• SL = đáy râu − ${SLU}$ (xa nhất ≈ ${f2(s.chart - ZONE - SLU)}).<br>• Nến thân dài đóng dưới ${f2(s.chart - ZONE - SLU)} kèm CVD giảm → tường bị phá, <b>huỷ Buy</b>${neg ? ", Gamma âm → có thể đánh theo hướng phá" : ""}.`;
    return H(`${o.source} – ${nm}: ${f2(s.chart)} (Strike ${s.strike} | Cứng ${hard}% | ΔOI ${s.d_oi == null ? "—" : sg(s.d_oi, f0)} | ${sg(dist)}$)`, res ? "#ff8a80" : "#69f0ae")
      + `<b>1. Giải nghĩa từng thông số & công thức kiểm tra</b><br>• <b>${o.source} – ${nm}:</b> ${why}<br>
      • <b>Strike gốc ${s.strike}:</b> Call OI ${code(f0(s.call_oi))} · Put OI ${code(f0(s.put_oi))} (Volume Call ${f0(s.call_vol)} / Put ${f0(s.put_vol)}) → tổng ${f0(oi)} = ${share}% strike lớn nhất (số % trên nhãn chart).<br>
      ${conv(o, s)}<br>
      • <b>Độ cứng ${hard}%</b> = ${res ? "Call" : "Put"} OI tại strike ÷ ${res ? "Call" : "Put"} OI lớn nhất cùng bảng × 100 = ${f0(res ? s.call_oi : s.put_oi)} ÷ ${f0(res ? maxC : maxP)} × 100 = ${code(hard + "%")}<br>
      • <b>ΔOI</b> = tổng OI hôm nay − phiên trước = ${s.d_oi == null ? "— (chưa có phiên trước để so)" : code(sg(s.d_oi, f0)) + ` hợp đồng (${s.d_oi >= 0 ? "vị thế mở thêm → tường dày lên" : "vị thế đóng bớt → tường mỏng đi"})`}<br>
      • <b>Khoảng cách</b> = mốc − giá live = ${f2(s.chart)} − ${f2(p)} = ${code(sg(dist) + "$")}`
      + sec(`GEX tại strike (${isGld ? "Black-Scholes có carry trên ETF GLD" : "Black-76 trên HĐTL GC"}, r = ${((o.rate || 0) * 100).toFixed(2)}%)`,
        `• Call GEX ${code(M$(s.call_gex))} + Put GEX ${code(M$(s.put_gex))} = Net ${code(M$(s.net_gex))} <span style="color:#9aa4b2">(USD dealer phải mua/bán khi giá đi 1%; dương = kìm giá, âm = đẩy giá)</span><br>
        • DEX = Σ Δ × OI × ${o.multiplier || 100} × S = ${code(M$(s.dex))} · IV ${s.iv ? (s.iv * 100).toFixed(1) + "%" : "—"} · DTE ${s.dte ?? "—"}<br>${front(o, s)}`)
      + sec("2. Bản chất (cơ chế Delta Hedging của Dealer/MM)", res
        ? "Nơi tập trung Call OI lớn: khi giá tăng sát tường, Delta của dealer tăng buộc dealer <b>BÁN hợp đồng tương lai</b> để cân bằng (Rebalance Hedge) → lực cản ép giá quay đầu (Mean Reversion). Khi Gamma âm, lực này yếu và tường dễ bị xuyên."
        : "Nơi tập trung Put OI lớn: khi giá rơi sát tường, dealer phải <b>MUA hợp đồng tương lai</b> để cân bằng Delta → lực đỡ đẩy giá bật lên. Thủng Put Wall khi Gamma âm → dealer bán đuổi, giá rơi nhanh.")
      + (w ? sec("3. Uy tín tường", `<b>${star(w.st)} ${w.txt} (${w.s}/100)</b><br><span style="color:#9aa4b2">${w.plus.join(" · ")}</span>${w.minus.length ? ` · <span style="color:#ff8a80">${w.minus.join(" · ")}</span>` : ""}<br><span style="color:#9aa4b2">★★★★ trở lên = mạnh · ★★★ = đánh nhỏ · ★★ trở xuống = bỏ qua.</span>`) : "")
      + sec("4. Tình huống & hành động", act)
      + `<div style="color:#9aa4b2;margin-top:6px">Kiểm tra: ${isGld ? `OptionCharts / Barchart GLD, strike ${s.strike}` : `QuikStrike / CME Settlements, strike ${s.strike}`} → Call OI ${f0(s.call_oi)} · Put OI ${f0(s.put_oi)}. Nguồn: ${srcInfo(o)}.</div>`;
  }
  function plansShort() {
    try { const P = window.tvlbPlans ? window.tvlbPlans().PLANS : []; if (!P.length) return "<span style=\"color:#9aa4b2\">(mở trang ③ Vào lệnh để xem 3 kế hoạch)</span>";
      return P.map((p) => `<div><b style="color:${p.d < 0 ? "#ef5350" : "#26a69a"}">${p.id} ${p.prob}%</b> ${p.role} · vùng ${f2(p.z.lo)}–${f2(p.z.hi)} · ${p.st}</div>`).join(""); } catch (e) { return ""; }
  }
  function tipFlip(o) {
    const p = px(), v = o.chart.gamma_flip, pos = p != null && p >= v;
    return H(`${o.source} – Gamma Flip: ${f2(v)} | ${sg(v - p)}$`, "#b388ff")
      + `<b>1. Thông số & công thức</b><br>• Gamma Flip = mức giá giả định làm <b>tổng Net GEX đổi dấu</b>. Engine quét lưới 241 mức giá trong ±12% quanh giá ${o.source} ${f2(o.underlying)}, mỗi mức tính lại GEX toàn chuỗi (mọi kỳ, trọng số 40/40/20), rồi nội suy tuyến tính chỗ đổi dấu gần giá nhất: Flip = x0 − y0 × (x1 − x0) ÷ (y1 − y0).<br>
      • Flip (giá ${o.source}) = ${code(f2(o.gamma_flip))} → giá chart ${code(f2(v))} · Net GEX tại giá hiện tại ${code(M$(o.net_gex))}<br>
      • Khoảng cách = Flip − giá live = ${f2(v)} − ${f2(p)} = ${code(sg(v - p) + "$")} → hiện đang <b style="color:${pos ? "#26a69a" : "#ef5350"}">${pos ? "TRÊN Flip (Gamma dương)" : "DƯỚI Flip (Gamma âm)"}</b>`
      + sec("2. Ý nghĩa", "Trên Flip: dealer <b>long gamma</b> → bán khi giá lên, mua khi giá xuống → giá bị kìm, đi ngang, hay hồi về tường.<br>Dưới Flip: dealer <b>short gamma</b> → mua đuổi khi lên, bán đuổi khi xuống → biến động mạnh, dễ phá tường, không bắt đáy/đỉnh.")
      + sec("3. Hành động — 3 kế hoạch hiện tại", plansShort());
  }
  function tipMag(o) {
    const p = px(), v = o.chart.magnet, s = o.strikes.find((x) => x.strike === o.magnet) || {}, g = s.net_gex;
    return H(`${o.source} – Magnet: ${f2(v)} | ${sg(v - p)}$`, "#ffd54f")
      + `• Magnet = strike có <b>tổng lực Gamma lớn nhất</b> (Call GEX − Put GEX, tức |Call GEX| + |Put GEX|) quanh giá: strike ${o.magnet}, Call GEX ${code(M$(s.call_gex))} · Put GEX ${code(M$(s.put_gex))} · Net ${code(M$(g))}<br>
      ${conv(o, Object.assign({ strike: o.magnet, chart: v }, s))}<br>• Khoảng cách = ${code(sg(v - p) + "$")}`
      + sec("Ý nghĩa", g >= 0 ? "<b>Magnet HÚT (Net GEX dương):</b> dealer bán khi giá lên / mua khi giá xuống quanh strike này → giá bị <b>hút về / ghim quanh</b> mốc, nhất là gần giờ đáo hạn. Dùng làm <b>mục tiêu chốt lời</b>, đánh hồi về Magnet."
        : "<b>Magnet ĐẨY (Net GEX âm):</b> dealer mua đuổi khi giá lên / bán đuổi khi giá xuống → khi giá phá qua mốc này dễ <b>chạy xa</b>; đi theo hướng phá, không bắt ngược.");
  }
  function tipMp(o) {
    const p = px(), v = o.chart.max_pain;
    return H(`${o.source} – Max Pain: ${f2(v)} | ${sg(v - p)}$`, "#b0bec5")
      + `• Max Pain = strike K* làm <b>tổng giá trị nội tại</b> người mua quyền chọn nhận được <b>nhỏ nhất</b>: min Σ [Call OI × max(K* − K, 0) + Put OI × max(K − K*, 0)] × ${o.multiplier || 100}.<br>• K* = ${o.max_pain} → giá chart ${code(f2(v))} · cách ${code(sg(v - p) + "$")}`
      + sec("Ý nghĩa", "Tham khảo: giá hay dao động về gần Max Pain vào ngày đáo hạn khi không có tin lớn. Không dùng riêng lẻ để vào lệnh.");
  }
  function chartTip(e) {
    const wrap = document.querySelector("#chartWrap"); if (!wrap || typeof candleS === "undefined") return null;
    const r = wrap.getBoundingClientRect(), y = e.clientY - r.top, hits = [];
    const yy = (v) => (v == null ? null : candleS.priceToCoordinate(v));
    [["GC", "#lyKey"], ["GLD", "#lyGLD"]].forEach(([src, chk]) => {
      const box = document.querySelector(chk); if (box && !box.checked) return;
      const o = optV(src); if (!o || !o.strikes) return;
      const maxOI = Math.max(1, ...o.strikes.map((s) => s.call_oi + s.put_oi));
      o.strikes.forEach((s) => { const isW = s.strike === o.call_wall || s.strike === o.put_wall; if (!isW && (s.call_oi + s.put_oi) / maxOI < 0.12) return;
        const c = yy(s.chart); if (c != null && Math.abs(c - y) <= 5) hits.push({ d: Math.abs(c - y), k: 0, f: () => tipStrike(o, s) }); });
    });
    const P = primV(); if (P && (!document.querySelector("#lyKey") || document.querySelector("#lyKey").checked)) {
      const c = P.chart; [["gamma_flip", tipFlip], ["magnet", tipMag], ["max_pain", tipMp]].forEach(([k, fn]) => { const v = yy(c[k]); if (v != null && Math.abs(v - y) <= 5) hits.push({ d: Math.abs(v - y), k: 1, f: () => fn(P) }); });
    }
    if (!hits.length) return null;
    hits.sort((a, b) => a.k - b.k || a.d - b.d);
    const main = hits[0], extra = hits.filter((h) => h.k === 1 && h !== main).slice(0, 1);   // mốc trùng nhau (vd Call Wall = Magnet): hiện cả 2
    return main.f() + extra.map((h) => `<div style="margin-top:8px;padding-top:6px;border-top:2px solid #e0a83a">${h.f()}</div>`).join("");
  }
  // ───────────────────── bảng Strike Profile ─────────────────────
  const COLS = [
    ["Giá XAU", "Giá chart (XAUUSD) tương ứng của strike = Strike × (giá chart ÷ giá nguồn). Dòng vàng = gần giá nhất; CW / PW = Call Wall / Put Wall."],
    ["Strike gốc", "Strike gốc trên sàn: GC = giá hợp đồng tương lai vàng CME; GLD = giá cổ phiếu ETF GLD."],
    ["Call OI", "Open Interest quyền chọn Call — số hợp đồng đang mở (cộng mọi kỳ hạn đang xem)."],
    ["Call Vol", "Khối lượng Call giao dịch trong phiên (báo cáo cuối ngày CME / Yahoo)."],
    ["Put OI", "Open Interest quyền chọn Put — số hợp đồng đang mở."],
    ["Put Vol", "Khối lượng Put giao dịch trong phiên."],
    ["GEX", "GEX = Σ Γ × (Call OI − Put OI) × 100 × S² × 1% — USD dealer phải mua/bán khi giá đi 1%. Dương (xanh) = dealer kìm giá; âm (đỏ) = dealer đẩy theo giá. TVLB: mỗi kỳ nhân trọng số 40/40/20. Thanh nền = độ lớn so với strike lớn nhất."],
    ["DEX", "DEX = Σ Δ × OI × 100 × S — tổng Delta danh nghĩa (USD) dealer đang giữ tại strike. Δcall = N(d1), Δput = N(d1) − 1."],
    ["IV", "Implied Volatility kỳ gần nhất tại strike (GC: suy ngược từ giá settle CME; GLD: Yahoo), đã làm mượt theo smile."],
    ["ΔOI", "ΔOI = Tổng OI hôm nay − phiên trước. Vàng = |ΔOI| lớn (≥ ngưỡng doi_big) — LP mở/đóng vị thế mạnh, vùng nghi vấn. “—” = chưa có phiên trước."],
    ["B/A C·P", "Chênh lệch Bid/Ask Call · Put kỳ gần nhất, % so với giá giữa (chỉ GLD, giờ Mỹ). Vàng = ≥ 15% → thanh khoản mỏng, số liệu kém tin cậy."],
    ["DTE", "Số ngày tới đáo hạn của kỳ gần nhất dùng để tính Greeks (tính đúng giờ: GC 12:30 Chicago, GLD 16:00 New York)."],
    ["Δ", "Delta Call = e^(−rT)·N(d1) (Black-76) — giá quyền chọn đổi bao nhiêu khi giá cơ sở +1$. Gần 0.5 = sát giá."],
    ["Γ", "Gamma = e^(−rT)·φ(d1) ÷ (F·σ·√T) — Delta đổi bao nhiêu khi giá đi 1$. Lớn nhất tại strike sát giá, kỳ sắp đáo hạn."],
    ["Vega", "Vega = F·φ(d1)·√T ÷ 100 — $ thay đổi giá quyền chọn khi IV +1 điểm %."],
    ["Vanna", "Vanna = −φ(d1)·d2 ÷ σ ÷ 100 — Delta đổi bao nhiêu khi IV +1 điểm %. IV giảm sau tin → dealer mua/bán lại theo dấu Vanna."],
    ["Θ/ngày", "Theta Call ($/ngày) — giá quyền chọn mất bao nhiêu sau 1 ngày (cho 1 oz / 1 cổ). Âm = người mua mất, người bán hưởng."],
    ["ρ", "Rho ($/1% lãi suất). Black-76: ρ = −T × giá quyền chọn ÷ 100 — rất nhỏ với kỳ ngắn. r lấy từ ^IRX."],
    ["Charm", "Charm = φ(d1)·d2 ÷ (2T) ÷ 365 — Delta tự đổi bao nhiêu sau 1 ngày. Lớn khi sắp đáo hạn → hedge cuối phiên mạnh."],
  ];
  function rowTip(tr) {
    const o = optV(S.profSrc); if (!o) return null; const k = parseFloat((tr.children[1] || {}).textContent); const s = o.strikes.find((x) => x.strike === k); if (!s) return null;
    const p = px(), maxOI = Math.max(1, ...o.strikes.map((x) => x.call_oi + x.put_oi)), oi = s.call_oi + s.put_oi;
    return H(`${o.source === "GLD" ? "Bể GLD" : "Bể GC"} – Strike ${s.strike} → ${f2(s.chart)}${s.strike === o.call_wall ? " (Call Wall)" : s.strike === o.put_wall ? " (Put Wall)" : ""}`)
      + `${conv(o, s)} · cách giá ${code(sg(s.chart - p) + "$")}<br>
      • Call OI ${f0(s.call_oi)} · Put OI ${f0(s.put_oi)} → tổng ${f0(oi)} = ${code(Math.round((oi / maxOI) * 100) + "%")} strike lớn nhất · Vol Call ${f0(s.call_vol)} / Put ${f0(s.put_vol)}<br>
      • ΔOI = ${s.d_oi == null ? "— (chưa có phiên trước)" : code(sg(s.d_oi, f0)) + " hợp đồng so với phiên trước"}${s.d_oi != null && Math.abs(s.d_oi) >= (S.cfg?.signals?.doi_big || 1500) ? ' · <b style="color:#ffd600">ΔOI lớn → vùng nghi vấn (LP mở/đóng mạnh)</b>' : ""}`
      + sec("GEX / DEX", `• Call GEX ${code(M$(s.call_gex))} + Put GEX ${code(M$(s.put_gex))} = Net ${code(M$(s.net_gex))} (40/40/20)<br>• DEX ${code(M$(s.dex))} · Vanna Exp ${M$(s.vex)} · Charm Exp ${M$(s.cex)}<br>${front(o, s)}`)
      + sec("Greeks kỳ gần nhất (Call)", `Δ ${s.delta != null ? Number(s.delta).toFixed(3) : "—"} · Γ ${s.gamma != null ? Number(s.gamma).toExponential(3) : "—"} · Vega ${s.vega != null ? Number(s.vega).toFixed(2) : "—"} · Vanna ${s.vanna != null ? Number(s.vanna).toFixed(4) : "—"} · Θ ${s.theta != null ? Number(s.theta).toFixed(3) : "—"}/ngày · ρ ${s.rho != null ? Number(s.rho).toFixed(3) : "—"} · Charm ${s.charm != null ? Number(s.charm).toFixed(4) : "—"} · DTE ${s.dte ?? "—"}`)
      + `<div style="color:#9aa4b2;margin-top:5px">Nguồn: ${srcInfo(o)}</div>`;
  }
  function headTip(th) {
    const row = th.parentElement, idx = [...row.children].indexOf(th);
    if (row.classList.contains("grp")) return H(th.textContent.trim() || "Nhóm cột") + "CALL / PUT = OI và khối lượng theo loại quyền chọn · EXPO = độ phơi nhiễm của dealer (GEX, DEX) · GREEKS = các hệ số rủi ro của quyền chọn Call kỳ gần nhất.";
    const c = COLS[idx]; return c ? H(c[0]) + c[1] : null;
  }
  // ───────────────────── Agent / Hedge / Nhật ký / KPI ─────────────────────
  const AGT = {
    REGIME: "Chế độ Gamma của thị trường: <b>LONG_GAMMA</b> (giá trên Flip, dealer kìm giá → đánh hồi 2 biên) hoặc <b>SHORT_GAMMA</b> (giá dưới Flip, dealer đẩy theo giá → đánh theo xu hướng, không bắt đáy/đỉnh).",
    DEALER: "Dealer sẽ làm gì để cân bằng Delta: long gamma = mua khi giá giảm / bán khi giá tăng (giữ biên); short gamma = bán khi giảm / mua khi tăng (gia tốc).",
    "LỆNH LỚN": "Dòng lệnh lớn (Smart Money) trên Binance trong vài nến gần nhất: mua ròng / bán ròng / đang thu thập. Ngưỡng = phân vị 99% gần đây (tối thiểu ≈ 50.000 USD/lệnh).",
    "HEDGE LP": "Mô phỏng: mỗi 10 USD giá đi, LP phải giao dịch bao nhiêu hợp đồng GC (gộp GC + GLD). ≥ 1.000 HĐ/10$ = cỡ LP lớn. −Γ = hedge cùng chiều giá (gia tốc), +Γ = ngược chiều (hãm).",
    TARGET: "Mục tiêu giá: Magnet / pin (strike giá hay bị hút về) hoặc tường đối diện.",
    CONVICTION: "Độ tin cậy −1 … +1: gộp chế độ Gamma, dòng lệnh, DXY, khoảng cách tới target. |≥ 0.5| mới nên hành động; gần 0 = WAIT.",
    "CẤU TRÚC": "Cấu trúc SMC Tip (hệ CL/KB): xu hướng H4 và khung đang xem — ▲ tăng / ▼ giảm.",
    FUSION: "FUSION = gộp tape (dòng lệnh), DXY và lực kéo về target thành 1 điểm thiên hướng −1 (bán) … +1 (mua).",
  };
  function agentTip(el) {
    const box = el.closest("#decision, #fusion"); if (!box) return null;
    for (let x = el; x && x !== box; x = x.parentElement) {
      const t = (x.textContent || "").trim().toUpperCase();
      for (const k of Object.keys(AGT)) if (t === k || t.startsWith(k + " ")) return H(k) + AGT[k];
      const prev = x.previousElementSibling, pt = prev ? (prev.textContent || "").trim().toUpperCase() : "";
      for (const k of Object.keys(AGT)) if (pt === k) return H(`${k}: ${x.textContent.trim()}`) + AGT[k];
    }
    if (box.id === "decision" && /WAIT|BUY|SELL/.test(el.textContent || "")) return H("Quyết định Agent") + "WAIT = chưa đủ điều kiện · BUY / SELL = các thành phần cùng hướng và độ tin cậy đủ lớn. Đây là gợi ý tổng hợp, vẫn chờ nến xác nhận tại vùng.";
    return null;
  }
  const HEDGE_COLS = ["ΔP USD: giá XAU giả định đi lên (+) / xuống (−) bao nhiêu USD so với hiện tại.", "GLD: số HĐ GC tương đương LP phải MUA/BÁN từ quyền chọn GLD.", "GC: số HĐ GC LP phải MUA/BÁN từ quyền chọn GC (CME).", "TỔNG = GC + GLD. Đỏ (BÁN khi giá giảm / MUA khi tăng) = −Γ, hedge cùng chiều → giá gia tốc; xanh = +Γ, hedge ngược chiều → giá bị hãm.", "≤ 7 NGÀY: riêng các kỳ còn ≤ 7 ngày (0DTE + tuần) — phần hedge phản ứng nhanh nhất."];
  function hedgeTip(el) {
    const tbl = el.closest(".hedgep table"); if (!tbl) return null;
    const cell = el.closest("td,th"); if (!cell) return null; const tr = cell.parentElement, idx = [...tr.children].indexOf(cell);
    if (cell.tagName === "TH") return H(cell.textContent.trim()) + (HEDGE_COLS[idx] || "");
    const c = [...tr.children].map((x) => x.textContent.trim());
    return H(`Nếu giá đi ${c[0]} USD`) + `LP phải: GLD <b>${c[1]}</b> · GC <b>${c[2]}</b> → tổng <b>${c[3]}</b> hợp đồng GC (kỳ ≤ 7 ngày: ${c[4]}).<br>`
      + "Công thức: N = −[Delta LP(giá mới) − Delta LP(giá hiện tại)] × OI, định giá lại toàn bộ Delta (Black-76 / Black-Scholes); GLD quy ra HĐ GC 100 oz.<br>"
      + "<b>BÁN khi giá giảm / MUA khi giá tăng</b> = LP hedge cùng chiều (−Γ) → giá dễ gia tốc. <b>MUA khi giảm / BÁN khi tăng</b> = ngược chiều (+Γ) → giá bị hãm.";
  }
  const JCOL = { "LOẠI": "Loại tín hiệu: SMC Tip CLx-KBy hoặc OF (Options Flow tại tường).", "CL-KB": "Chiến lược (CL1 đánh hồi / CL2 đánh thuận) × Kịch bản (KB1 risk · KB2 confirm · KB3 risk dự phòng).", "LỆNH": "Số lệnh đã khớp.", "T/B": "Thắng / Bại (chạm TP1 / chạm SL).", "WR": "Winrate = Thắng ÷ (Thắng + Bại).", "R": "Tổng R: thắng = R:R của lệnh, thua = −1R.", "DD": "Sụt giảm lớn nhất của đường Equity (R).", "THÁNG": "Thống kê theo tháng.", "GIỜ": "Giờ khớp lệnh (giờ VN).", "TÍN HIỆU": "Tên tín hiệu.", "ENTRY": "Giá vào lệnh.", "SL / TP1": "Cắt lỗ / chốt lời 1.", "KẾT QUẢ": "Trạng thái: đang chạy / ✓ TP1 / ✗ SL / hết hạn / lỡ." };
  function journalTip(el) {
    const th = el.closest(".journal th, .hist th"); if (!th) return null; const t = th.textContent.trim().toUpperCase();
    return JCOL[t] ? H(th.textContent.trim()) + JCOL[t] : null;
  }
  function kpiTip(el) {
    const k = el.closest("#kpis"); if (!k) return null; const t = (el.closest("span,div") || el).textContent;
    if (/Vol|Risk|IV/.test(t)) return H("Vol / Risk") + "IV ATM kỳ gần — đo mức biến động kỳ vọng. IV cao = biên dao động rộng, SL nên rộng hơn / khối lượng nhỏ hơn.";
    if (/XAU\s*\/\s*GLD|×/.test(t)) return H("Hệ số XAU / GLD") + "Giá chart ÷ giá GLD — dùng quy đổi strike GLD ra giá vàng (thường ≈ 10,9, không phải ×10).";
    if (/Net GEX/.test(t)) return H("Net GEX") + "Tổng GEX toàn chuỗi tại giá hiện tại (40/40/20). Dương = dealer kìm giá; âm = dealer đẩy giá.";
    if (/Regime/.test(t)) return H("Regime") + "Long γ = giá trên Flip (đi ngang, đánh hồi) · Short γ = dưới Flip (biến động mạnh, đánh theo xu hướng).";
    return null;
  }
  window.tvlbTipX = function (e) {
    const t = e.target; if (!t || !t.closest) return null;
    if (t.closest("#tvlbPlus")) return null;
    const th = t.closest("#prof th"); if (th) return headTip(th);
    const tr = t.closest("#prof tbody tr"); if (tr) return rowTip(tr);
    const a = agentTip(t); if (a) return a;
    const h = hedgeTip(t); if (h) return h;
    const j = journalTip(t); if (j) return j;
    const k = kpiTip(t); if (k) return k;
    if (t.closest("#chartWrap") && !t.closest("#tvlbCd, .chartinfo, .sigcount")) return chartTip(e);
    return null;
  };
})();
