/* 脂硯齋重評石頭記 · 卷子本 —— 渲染與交互層 */
(() => {
  'use strict';

  const BOOK = window.BOOK;
  const CHS = BOOK.chapters;
  const L = window.LAYOUT;
  const $ = (id) => document.getElementById(id);

  const CN = ['零','一','二','三','四','五','六','七','八','九'];
  const numCN = (n) => {
    if (n <= 10) return n === 10 ? '十' : CN[n];
    if (n < 20) return '十' + CN[n - 10];
    const t = Math.floor(n / 10), o = n % 10;
    return CN[t] + '十' + (o ? CN[o] : '');
  };

  const state = { n: 1, f: 17, theme: 'print', notes: 'all', colno: true };

  const TITLE_H = 46;
  const STATUS_H = 34;

  const scrollEl = $('scroll');
  const stripEl = $('strip');
  let G = null;

  const availH = () => window.innerHeight - TITLE_H - STATUS_H;

  // 來源鍵一律用中文名，與 COLORS / 圖例 / 篩選狀態保持同一套鍵
  const srcKey = (s) => (COLORS[s] ? s : '其他');

  function show(kind, src) {
    if (kind === '序') return true;
    if (state.notes === 'none') return false;
    if (state.notes === 'all') return true;
    return srcKey(src) === state.notes;
  }

  function applyVars(g) {
    const s = document.documentElement.style;
    s.setProperty('--f', g.f + 'px');
    s.setProperty('--rh', g.rh + 'px');
    s.setProperty('--sf', g.sf + 'px');
    s.setProperty('--gw', g.gw + 'px');
    s.setProperty('--pitch', g.pitch + 'px');
    s.setProperty('--ls', g.ls + 'px');
    s.setProperty('--ls-small', g.lsSmall + 'px');
    s.setProperty('--ls-note', g.lsNote + 'px');
    s.setProperty('--pad-top', g.topPad + 'px');
    s.setProperty('--pad-bottom', g.botPad + 'px');
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------- 渲染 ---------------- */
  function render(p) {
    G = L.geom({ f: state.f, avail: availH() });
    applyVars(G);

    const ch = CHS[state.n - 1];
    const laid = L.typeset(ch, G, show);
    const total = Math.max(laid.total, 1);
    const notes = L.placeNotes(laid.notes, total, G);

    const f = G.f, pitch = G.pitch, sf = G.sf, gw = G.gw;
    const colorOf = (src) => COLORS[srcKey(src)] || COLORS['其他'];
    const padR = 0.35 * pitch;
    const titleR = padR;
    const volR = titleR + 2.35 * f + 0.25 * f;
    const nameR = volR + 0.88 * f + 0.25 * f;
    const offPx = Math.round(nameR + 0.95 * f + 0.35 * pitch);
    const bodyH = G.bodyH;
    const gutRight = (f + (gw - sf) / 2).toFixed(1);
    const out = [];

    out.push(`<div class="frame" style="top:${G.headH}px;right:${offPx}px"></div>`);
    out.push(`<div class="frame" style="top:${G.footY.toFixed(1)}px;right:${offPx}px"></div>`);

    out.push(
      `<div class="juan" style="width:${offPx}px">` +
      `<div class="juan-rule" style="right:${(offPx - 0.16 * pitch).toFixed(1)}px"></div>` +
      `<div class="juan-title" style="right:${titleR.toFixed(1)}px;top:${(G.headH * 0.5).toFixed(1)}px">脂硯齋重評石頭記</div>` +
      `<div class="juan-vol" style="right:${volR.toFixed(1)}px;top:${(G.headH * 0.72).toFixed(1)}px">卷之${numCN(state.n)}</div>` +
      `<div class="juan-name" style="right:${nameR.toFixed(1)}px;top:${(G.headH * 1.2).toFixed(1)}px">${esc(ch.full)}</div>` +
      `</div>`
    );

    const colX = [];
    let x = offPx;
    for (let i = 0; i < total; i++) {
      const col = laid.cols[i];
      const gut = laid.gutters[i];
      // 只放批語的列收窄成一條窄縫，主文列仍舊是「正文 + 窄縫」
      const noteOnly = !!(col && col.noteOnly && !col.segs.length);
      const w = noteOnly ? gw : pitch;
      colX[i] = x;
      const right = x.toFixed(1);
      out.push(`<div class="col${noteOnly ? ' nc' : ''}" style="right:${right}px;top:${G.textTop}px;width:${w}px;height:${bodyH}px">`);
      if (state.colno && !noteOnly) out.push(`<div class="colno" style="right:0">${i + 1}</div>`);
      if (col) {
        for (const s of col.segs) {
          const top = (s.top * G.rh).toFixed(1);
          if (s.red) {
            out.push(`<div class="seg r" style="top:${top}px;right:0;color:${colorOf(s.src)}">${esc(s.text)}</div>`);
          } else {
            out.push(`<div class="seg t" style="top:${top}px;right:0">${esc(s.text)}</div>`);
          }
        }
      }
      if (gut) {
        const gr = noteOnly ? ((gw - sf) / 2).toFixed(1) : gutRight;
        for (const s of gut.segs) {
          const top = (s.top * G.rh).toFixed(1);
          out.push(`<div class="seg s" style="top:${top}px;right:${gr}px;color:${colorOf(s.src)}">${esc(s.text)}</div>`);
        }
      }
      out.push('</div>');
      x += w;
    }

    for (const n of notes) {
      for (let k = 0; k < n.chunks.length; k++) {
        const ci = n.start + k;
        if (ci < 0) continue;
        const base = colX[ci] !== undefined ? colX[ci] : x;
        const right = (base + (gw - sf) / 2).toFixed(1);
        out.push(`<div class="seg s note" title="${esc(n.src || '')}眉批" style="right:${right}px;color:${colorOf(n.src)}">${esc(n.chunks[k])}</div>`);
      }
    }

    const stripW = x + 36;
    stripEl.style.width = stripW + 'px';
    stripEl.style.height = (G.footY + 14) + 'px';
    stripEl.innerHTML = out.join('');

    requestAnimationFrame(() => {
      const max = scrollEl.scrollWidth - scrollEl.clientWidth;
      scrollEl.scrollLeft = Math.max(0, max * (1 - (p ?? 0)));
      syncStatus();
    });
  }

  /* ---------------- 狀態 ---------------- */
  function progress() {
    const max = scrollEl.scrollWidth - scrollEl.clientWidth;
    if (max <= 0) return 0;
    return Math.min(1, Math.max(0, (max - scrollEl.scrollLeft) / max));
  }

  function syncStatus() {
    const p = progress();
    $('pos').textContent = `第${numCN(state.n)}回`;
    $('pct').textContent = (p * 100).toFixed(0) + '%';
    $('bar-progress').firstElementChild.style.width = (p * 100) + '%';
    $('vol').textContent = `第${numCN(state.n)}回`;
    document.querySelectorAll('.toc-item').forEach((el) => el.classList.toggle('cur', +el.dataset.n === state.n));
  }

  function go(n, p) {
    state.n = Math.min(CHS.length, Math.max(1, n));
    try { history.replaceState(null, '', '#' + state.n); } catch { /* file:// 下忽略 */ }
    render(p ?? 0);
  }

  /* ---------------- 目錄 ---------------- */
  function buildToc() {
    const list = $('tocList');
    list.innerHTML = CHS.map((ch) =>
      `<button class="toc-item" data-n="${ch.n}"><b>卷${numCN(ch.n)}</b><span>${esc(ch.t)}</span></button>`
    ).join('');
    list.addEventListener('click', (e) => {
      const b = e.target.closest('.toc-item');
      if (!b) return;
      go(+b.dataset.n, 0);
      closeToc();
    });
  }
  const openToc = () => { $('toc').hidden = false; $('shade').hidden = false; };
  const closeToc = () => { $('toc').hidden = true; $('shade').hidden = true; };


  /* ---------------- 批語來源圖例 ---------------- */
  const LEGEND = [['甲戌', '甲戌本'], ['庚辰', '庚辰本'], ['蒙', '蒙府本'], ['靖', '靖本'], ['己卯', '己卯本'], ['待考', '待考'], ['其他', '其他']];
  const COLORS = { '甲戌': '#a3312a', '庚辰': '#2e5c8a', '蒙': '#8a5a2f', '靖': '#6b3f7a', '己卯': '#2f6b5a', '待考': '#4f4a45', '其他': '#8a8578' };

  function syncFilterUI() {
    const label = state.notes === 'all' ? '全部' : state.notes === 'none' ? '關閉' : state.notes;
    $('notesBtn').textContent = '批語·' + label;
    document.querySelectorAll('#legend button').forEach((b) => {
      b.classList.toggle('on', b.dataset.src === state.notes);
    });
  }

  function buildLegend() {
    const el = $('legend');
    if (!el) return;                 // 容器缺失時不阻斷渲染
    el.innerHTML = LEGEND.map(([k, label]) =>
      `<button class="plaque" data-src="${k}"><i style="background:${COLORS[k]}"></i>${label}</button>`
    ).join('');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const s = b.dataset.src;
      state.notes = state.notes === s ? 'all' : s;
      syncFilterUI();
      render(progress());
    });
    syncFilterUI();
  }
  /* ---------------- 交互 ---------------- */
  function bind() {
    $('prev').onclick = () => go(state.n - 1, 0);
    $('next').onclick = () => go(state.n + 1, 0);
    $('tocBtn').onclick = openToc;
    $('tocClose').onclick = closeToc;
    $('shade').onclick = closeToc;

    $('themeBtn').onclick = () => {
      state.theme = state.theme === 'print' ? 'modern' : 'print';
      document.body.dataset.theme = state.theme;
      $('themeBtn').textContent = state.theme === 'print' ? '影印' : '現代';
    };

    const MODES = ['all', '甲戌', '庚辰', '蒙', '靖', '己卯', '待考', '其他', 'none'];
    $('notesBtn').onclick = () => {
      state.notes = MODES[(MODES.indexOf(state.notes) + 1) % MODES.length];
      syncFilterUI();
      render(progress());
    };

    $('colnoBtn').onclick = () => {
      state.colno = !state.colno;
      $('colnoBtn').classList.toggle('on', state.colno);
      render(progress());
    };

    const setF = (d) => {
      const p = progress();
      state.f = Math.min(30, Math.max(12, state.f + d));
      render(p);
    };
    $('minus').onclick = () => setF(-1);
    $('plus').onclick = () => setF(1);

    // 滾輪 → 橫向展卷
    scrollEl.addEventListener('wheel', (e) => {
      const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (!d) return;
      e.preventDefault();
      scrollEl.scrollLeft -= d;
    }, { passive: false });

    // 拖動
    let dragging = false, sx = 0, sl = 0;
    scrollEl.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      dragging = true; sx = e.clientX; sl = scrollEl.scrollLeft;
      scrollEl.classList.add('dragging');
      try { scrollEl.setPointerCapture(e.pointerId); } catch { /* noop */ }
    });
    scrollEl.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      scrollEl.scrollLeft = sl - (e.clientX - sx);
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      scrollEl.classList.remove('dragging');
      try { scrollEl.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    };
    scrollEl.addEventListener('pointerup', endDrag);
    scrollEl.addEventListener('pointercancel', endDrag);

    scrollEl.addEventListener('scroll', syncStatus, { passive: true });

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') { scrollEl.scrollBy({ left: -Math.max(200, G.cw * 8), behavior: 'smooth' }); e.preventDefault(); }
      if (e.key === 'ArrowRight') { scrollEl.scrollBy({ left: Math.max(200, G.cw * 8), behavior: 'smooth' }); e.preventDefault(); }
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { go(state.n + 1, 0); e.preventDefault(); }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') { go(state.n - 1, 0); e.preventDefault(); }
      if (e.key === 'Escape') closeToc();
    });

    let rt = 0;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => render(progress()), 150);
    });
  }

  function boot() {
    const n = parseInt((location.hash || '').replace('#', ''), 10);
    if (n >= 1 && n <= CHS.length) state.n = n;
    if (window.innerWidth < 720) state.f = 15;
    buildToc();
    buildLegend();
    bind();
    render(0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
