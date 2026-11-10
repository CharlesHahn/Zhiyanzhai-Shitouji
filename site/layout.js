/* 排版内核：不碰 DOM，浏览器与 Node 共用
 *
 * 版式（对照原书样张）：
 *   主列（正文，一字一格） + 窄缝（批注，小字单行）交替排列；
 *   批注不再占用正文的行位，而是从锚点所在行起、在自己那条窄缝里向下排；
 *   缝满则接到下一条缝，直接换行，不做标记。
 */
(function (root) {
  'use strict';

  function geom(opts) {
    const f = opts.f;
    const rh = f * 1.08;              // 正文行距
    const sf = f * 0.62;              // 批注字号
    const gw = Math.round(sf + 8);    // 批注窄缝宽（留出两侧余白，仿样张比例）
    const pitch = f + gw;             // 主列 + 窄缝
    const avail = opts.avail;
    const headH = Math.max(f * 2.6, Math.round(avail * 0.16));   // 天头
    const topPad = rh * 1.25;
    const botPad = rh * 0.85;
    const rows = Math.max(6, Math.floor((avail - headH - topPad - botPad) / rh));
    const bodyH = rows * rh;
    const textTop = headH + topPad;
    const noteAdv = sf * 1.28;        // 眉批另用较紧的字距
    return {
      f, rh, sf, gw, pitch, rows, headH, avail, topPad, botPad, bodyH,
      textTop, footY: textTop + bodyH + botPad,
      ls: rh - f,                     // 正文步进 = rh
      lsSmall: rh - sf,               // 窄缝步进 = rh（与正文行对齐）
      noteAdv, lsNote: noteAdv - sf,  // 眉批步进
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
    const cols = [];        // 主列：{ segs: [{top, text, red, src}] }
    const gutters = [];     // 窄縫：{ segs: [{top, text, src}] }
    const notes = [];       // 眉批
    const gutterFree = {};  // 每條縫的下一空行
    let c = 0, r = 0;

    const colAt = (i) => (cols[i] || (cols[i] = { segs: [] }));
    const gutAt = (i) => (gutters[i] || (gutters[i] = { segs: [] }));
    const nextCol = () => { c++; r = 0; };

    function emitText(str, red, src) {
      let seg = null;
      for (const ch2 of str) {
        if (r >= G.rows) {
          if (seg) { colAt(c).segs.push(seg); seg = null; }
          nextCol();
        }
        if (!seg) seg = { top: r, text: '', red: !!red, src };
        seg.text += ch2;
        r++;
      }
      if (seg) colAt(c).segs.push(seg);
    }

    // 批註寫進窄縫：自錨點行起向下，縫滿接下一條縫
    function placeNote(str, src) {
      let g = c;
      let rr = Math.max(r, gutterFree[g] || 0);
      let seg = null;
      const flush = () => {
        if (seg && seg.text) gutAt(seg.g).segs.push({ top: seg.top, text: seg.text, src });
        seg = null;
      };
      for (const ch2 of str) {
        if (rr >= G.rows) { flush(); g++; rr = gutterFree[g] || 0; }
        if (!seg || seg.g !== g) { flush(); seg = { g, top: rr, text: '' }; }
        seg.text += ch2;
        rr++;
      }
      flush();
      if (rr > (gutterFree[g] || 0)) gutterFree[g] = rr;
    }

    ch.b.forEach((b, bi) => {
      if (bi > 0) nextCol();
      const standalone = b[0] === 'n';
      for (const run of runsOf(b)) {
        if (run[0] === 'x') { emitText(run[1]); continue; }
        const kind = run[1], src = run[2], text = run[3], label = run[4] || '';
        if (kind === '序') { emitText(text); continue; }
        if (show && !show(kind, src)) continue;
        const body = withLabel(text, label);
        if (kind === '眉批') { notes.push({ col: c, text: body, src }); continue; }
        // 回前/回末等独立成段的批語：独占主列，整列红字（同原书样张）
        if (standalone && kind !== '校记') { emitText(body, true, src); continue; }
        placeNote(body, src);
      }
    });

    return { cols, gutters, notes, total: cols.length };
  }

  function placeNotes(notes, total, G) {
    const used = new Set();
    const perLine = Math.max(4, Math.floor((G.headH - 8) / G.noteAdv));
    return notes.map((n) => {
      const chunks = [];
      for (let i = 0; i < n.text.length; i += perLine) chunks.push(n.text.slice(i, i + perLine));
      const len = chunks.length;
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
