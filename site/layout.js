/* 排版内核：不碰 DOM，瀏覽器與 Node 共用
 * 版式單位：正文一字一格；雙行夾批每行 2 窄行 × 2 字；眉批走天頭。
 */
(function (root) {
  'use strict';

  function geom(opts) {
    const f = opts.f;
    const rh = f * 1.04;          // 每行（字）高度
    const cw = f * 1.34;          // 每列寬度（含界欄間距）
    const avail = opts.avail;     // 版心可用高
    const headH = Math.max(f * 2.4, Math.round(avail * 0.15));
    const rows = Math.max(8, Math.floor((avail - headH - 4) / rh));
    return {
      f, rh, cw, rows, headH, avail,
      sf: f * 0.52,               // 批語字號
      ls: rh - f,                 // 正文字距（使步進 = rh）
      bodyH: rows * rh,
    };
  }

  function runsOf(b) {
    const out = [];
    let i = 1;
    while (i < b.length) {
      if (b[i] === 'x') { out.push(['x', b[i + 1]]); i += 2; }
      else { out.push(['a', b[i + 1], b[i + 2], b[i + 3]]); i += 4; }
    }
    return out;
  }

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

    function emitSmall(str, lanes, meta) {
      let i = 0;
      while (i < str.length) {
        if (r >= G.rows) nextCol();
        const capRows = G.rows - r;
        const cap = capRows * 2 * lanes;
        const chunk = str.slice(i, i + cap);
        i += chunk.length;
        const per = Math.ceil(chunk.length / lanes);
        let maxLen = 0;
        for (let L = 0; L < lanes; L++) {
          const part = chunk.slice(L * per, (L + 1) * per);
          if (!part) continue;
          if (part.length > maxLen) maxLen = part.length;
          colAt(c).segs.push({ t: 'small', top: r, lane: L, text: part, meta });
        }
        r += Math.ceil(maxLen / 2);
      }
    }

    ch.b.forEach((b, bi) => {
      if (bi > 0) nextCol();
      for (const run of runsOf(b)) {
        if (run[0] === 'x') { emitText(run[1]); continue; }
        const kind = run[1], src = run[2], text = run[3];
        if (kind === '序') { emitText(text); continue; }
        if (show && !show(kind, src)) continue;
        if (kind === '眉批') { notes.push({ col: c, text, src }); continue; }
        const meta = (src || '') + (kind === '批' ? '' : kind);
        if (kind === '夹批') emitSmall(text, 2, meta);
        else if (kind === '侧批') emitSmall(text, 1, meta);
        else emitSmall(text, 2, meta);
      }
    });

    return { cols, notes, total: cols.length };
  }

  function placeNotes(notes, total, G) {
    const used = new Set();
    const perLine = Math.max(4, Math.floor((G.headH - G.rh - 8) / G.sf));
    return notes.map((n) => {
      const chunks = [];
      for (let i = 0; i < n.text.length; i += perLine) chunks.push(n.text.slice(i, i + perLine));
      const fits = (x) => {
        if (x - chunks.length + 1 < 0) return false;
        for (let k = 0; k < chunks.length; k++) if (used.has(x - k)) return false;
        return true;
      };
      let s = Math.min(n.col, Math.max(total - 1, 0));
      while (s > 0 && !fits(s)) s--;
      for (let k = 0; k < chunks.length; k++) used.add(s - k);
      return { ...n, start: s, chunks, perLine };
    });
  }

  root.LAYOUT = { geom, typeset, placeNotes, runsOf };
})(typeof window !== 'undefined' ? window : globalThis);
