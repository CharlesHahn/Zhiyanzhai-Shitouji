/* 排版内核：不碰 DOM，瀏覽器與 Node 共用
 * 版式單位：正文一字一格；雙行夾批每行 2 窄行；眉批走天頭。
 */
(function (root) {
  'use strict';

  function geom(opts) {
    const f = opts.f;
    const rh = f * 1.08;          // 正文行距（字與字的上下步進）
    const cw = f * 1.45;          // 列寬（含界欄間距）
    const avail = opts.avail;     // 版心可用高
    const headH = Math.max(f * 2.6, Math.round(avail * 0.16));   // 天頭
    const topPad = rh * 1.25;     // 天頭界線與首字之間的留白
    const botPad = rh * 0.85;     // 末字與地腳界線之間的留白
    const rows = Math.max(6, Math.floor((avail - headH - topPad - botPad) / rh));
    const sf = f * 0.62;          // 批語字號
    const sa = sf * 1.28;         // 批語字距（上下步進）
    const bodyH = rows * rh;
    const textTop = headH + topPad;
    return {
      f, rh, cw, rows, headH, avail, sf, sa, topPad, botPad, bodyH,
      textTop, footY: textTop + bodyH + botPad,
      ls: rh - f,                 // 正文字距（使步進 = rh）
      lsSmall: sa - sf,           // 批語字距（使步進 = sa）
    };
  }

  function runsOf(b) {
    const out = [];
    let i = 1;
    while (i < b.length) {
      if (b[i] === 'x') { out.push(['x', b[i + 1]]); i += 2; }
      else { out.push(['a', b[i + 1], b[i + 2], b[i + 3], b[i + 4]]); i += 5; }
    }
    return out;
  }

  // 批語前綴：保留「甲戌側批」「庚辰雙行夾批」這類來源標記
  const withLabel = (text, label) => (label ? label + '：' + text : text);

  function typeset(ch, G, show) {
    const cols = [];
    const notes = [];
    let c = 0, r = 0;

    const colAt = (i) => (cols[i] || (cols[i] = { segs: [] }));
    const nextCol = () => { c++; r = 0; };

    function emitText(str) {
      let seg = null;
      for (const ch2 of str) {
        if (r >= G.rows) {
          if (seg) { colAt(c).segs.push(seg); seg = null; }
          nextCol();
        }
        if (!seg) seg = { t: 'text', top: r, text: '' };
        seg.text += ch2;
        r++;
      }
      if (seg) colAt(c).segs.push(seg);
    }

    // lanes = 2 雙行夾批；1 單行側批
    function emitSmall(str, lanes, meta, src) {
      let i = 0;
      while (i < str.length) {
        if (r >= G.rows) nextCol();
        const availPx = (G.rows - r) * G.rh;
        const capPerLane = Math.max(1, Math.floor(availPx / G.sa));
        const cap = capPerLane * lanes;
        const chunk = str.slice(i, i + cap);
        i += chunk.length;
        const per = Math.ceil(chunk.length / lanes);
        let maxLen = 0;
        for (let L = 0; L < lanes; L++) {
          const part = chunk.slice(L * per, (L + 1) * per);
          if (!part) continue;
          if (part.length > maxLen) maxLen = part.length;
          colAt(c).segs.push({ t: 'small', top: r, lane: L, text: part, meta, src });
        }
        r += Math.max(1, Math.ceil((maxLen * G.sa) / G.rh));
      }
    }

    ch.b.forEach((b, bi) => {
      if (bi > 0) nextCol();
      for (const run of runsOf(b)) {
        if (run[0] === 'x') { emitText(run[1]); continue; }
        const kind = run[1], src = run[2], text = run[3], label = run[4] || '';
        if (kind === '序') { emitText(text); continue; }
        if (show && !show(kind, src)) continue;
        const body = withLabel(text, label);
        if (kind === '眉批') { notes.push({ col: c, text: body, src, kind }); continue; }
        const meta = (src || '') + (kind === '批' ? '' : kind);
        if (kind === '夹批') emitSmall(body, 2, meta, src);
        else if (kind === '侧批') emitSmall(body, 1, meta, src);
        else emitSmall(body, 2, meta, src);
      }
    });

    return { cols, notes, total: cols.length };
  }

  function placeNotes(notes, total, G) {
    const used = new Set();
    const perLine = Math.max(4, Math.floor((G.headH - 8) / G.sa));
    return notes.map((n) => {
      const chunks = [];
      for (let i = 0; i < n.text.length; i += perLine) chunks.push(n.text.slice(i, i + perLine));
      const len = chunks.length;
      // 列號越大越靠左：眉批自錨點列起「向左」續排，故列號遞增
      const fits = (x) => {
        if (x < 0 || x + len > total) return false;
        for (let k = 0; k < len; k++) if (used.has(x + k)) return false;
        return true;
      };
      let s = Math.max(0, Math.min(n.col, Math.max(total - len, 0)));
      if (!fits(s)) {
        let c2 = 0;
        while (c2 + len <= total && !fits(c2)) c2++;
        s = c2 + len <= total ? c2 : Math.max(0, total - len);
      }
      for (let k = 0; k < len; k++) used.add(s + k);
      return { ...n, start: s, chunks, perLine };
    });
  }

  root.LAYOUT = { geom, typeset, placeNotes, runsOf };
})(typeof window !== 'undefined' ? window : globalThis);
