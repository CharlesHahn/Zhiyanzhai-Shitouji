// 把排版内核的输出转成绘制指令（JSON），供 draw-preview.ps1 生成 PNG 预览
import fs from 'node:fs';

const ROOT = 'D:/Desktop_Env/MyBook/脂砚斋重评石头记/site';
const WIN = {};

new Function('window', fs.readFileSync(ROOT + '/data/book.js', 'utf8'))(WIN);
new Function('window', fs.readFileSync(ROOT + '/layout.js', 'utf8'))(WIN);

const BOOK = WIN.BOOK;
const L = WIN.LAYOUT;

const [nArg, fArg, wArg, hArg, startArg] = process.argv.slice(2);
const n = +(nArg || 1);
const f = +(fArg || 17);
const W = +(wArg || 1600);
const H = +(hArg || 900);
const startCol = +(startArg || 0);

const TOPBAR = 46, STATUS = 34;
const avail = H - TOPBAR - STATUS;
const G = L.geom({ f, avail });
const ch = BOOK.chapters[n - 1];
const laid = L.typeset(ch, G, () => true);

// ---- 字符守恒自检 ----
let srcN = 0;
for (const b of ch.b) for (const r of L.runsOf(b)) srcN += (r[0] === 'x') ? r[1].length : ((r[4] ? r[4].length + 1 : 0) + r[3].length);
let outN = 0;
for (const c of laid.cols) if (c) for (const s of c.segs) outN += s.text.length;
for (const g of laid.gutters) if (g) for (const s of g.segs) outN += s.text.length;
for (const nt of laid.notes) outN += nt.text.length;
const ok = srcN === outN;

const notes = L.placeNotes(laid.notes, Math.max(laid.total, 1), G);

const f2 = G.f, pitch = G.pitch, sf = G.sf, gw = G.gw;
const padR = 0.35 * pitch;
const titleR = padR;
const volR = titleR + 2.35 * f2 + 0.25 * f2;
const nameR = volR + 0.88 * f2 + 0.25 * f2;
const offPx = Math.round(nameR + 0.95 * f2 + 0.35 * pitch);

const headY = TOPBAR + G.headH;
const textTop = TOPBAR + G.textTop;
const footY = TOPBAR + G.footY;
const ink = '#1d1a15';
const SRC_COLOR = { '甲戌': '#a3312a', '庚辰': '#2e5c8a', '蒙': '#8a5a2f', '靖': '#6b3f7a', '己卯': '#2f6b5a', '待考': '#4f4a45' };
const colorOf = (s) => SRC_COLOR[s] || '#8a8578';
const red = '#a3312a';
const shift = startCol * pitch;

const glyphs = [];
const rules = [];
const colnos = [];

const colX = [];
let cursor = offPx;
for (let i = 0; i < laid.total; i++) {
  const col = laid.cols[i];
  const noteOnly = !!(col && col.noteOnly && !col.segs.length);
  colX[i] = cursor;
  cursor += noteOnly ? gw : pitch;
}

for (let i = startCol; i < laid.total; i++) {
  const R = colX[i] - shift;
  if (R > W) break;
  const col = laid.cols[i];
  const noteOnly = !!(col && col.noteOnly && !col.segs.length);
  rules.push({ x: +(W - R).toFixed(1) });
  if (!noteOnly) colnos.push({ x: +(W - R - f2 / 2).toFixed(1), y: textTop - G.rh * 0.95, t: String(i + 1) });

  if (col) {
    for (const s of col.segs) {
      const x = W - R - f2;
      const color = s.red ? colorOf(s.src) : ink;
      for (let k = 0; k < s.text.length; k++) {
        glyphs.push({ c: s.text[k], x: +x.toFixed(1), y: +(textTop + s.top * G.rh + k * G.rh).toFixed(1), s: f2, color });
      }
    }
  }
  const gut = laid.gutters[i];
  if (gut) {
    const off = noteOnly ? 0 : f2;
    for (const s of gut.segs) {
      const x = W - R - off - (gw - sf) / 2 - sf;
      for (let k = 0; k < s.text.length; k++) {
        glyphs.push({ c: s.text[k], x: +x.toFixed(1), y: +(textTop + s.top * G.rh + k * G.rh).toFixed(1), s: sf, color: colorOf(s.src) });
      }
    }
  }
}

for (const nt of notes) {
  for (let k = 0; k < nt.chunks.length; k++) {
    const ci = nt.start + k;
    if (ci < 0) continue;
    const R = (colX[ci] !== undefined ? colX[ci] : cursor) - shift;
    if (R > W) continue;
    const x = W - R - (gw - sf) / 2 - sf;
    const txt = nt.chunks[k];
    for (let j = 0; j < txt.length; j++) {
      glyphs.push({ c: txt[j], x: +x.toFixed(1), y: +(TOPBAR + 8 + j * G.noteAdv).toFixed(1), s: sf, color: colorOf(nt.src), note: 1 });
    }
  }
}

const juan = [];
if (startCol === 0) {
  const title = '脂硯齋重評石頭記';
  for (let k = 0; k < title.length; k++) {
    juan.push({ c: title[k], x: +(W - titleR - 2.35 * f2).toFixed(1), y: +(textTop + k * 2.35 * f2 * 1.1).toFixed(1), s: 2.35 * f2, color: ink, font: 'KaiTi' });
  }
  const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const numCN = (x) => x <= 10 ? (x === 10 ? '十' : CN[x]) : x < 20 ? '十' + CN[x - 10] : CN[Math.floor(x / 10)] + '十' + (x % 10 ? CN[x % 10] : '');
  const vol = '卷之' + numCN(ch.n);
  for (let k = 0; k < vol.length; k++) {
    juan.push({ c: vol[k], x: +(W - volR - 0.88 * f2).toFixed(1), y: +(textTop + 0.2 * f2 + k * 0.88 * f2 * 1.22).toFixed(1), s: 0.88 * f2, color: red, font: 'KaiTi' });
  }
  const nm = ch.full;
  for (let k = 0; k < nm.length; k++) {
    juan.push({ c: nm[k], x: +(W - nameR - 0.95 * f2).toFixed(1), y: +(textTop + 0.7 * f2 + k * 0.95 * f2 * 1.1).toFixed(1), s: 0.95 * f2, color: ink, font: 'SimSun' });
  }
}

const out = {
  W, H, f: f2, cw: pitch, rh: G.rh, sf: G.sf, sa: G.rh, headH: G.headH, bodyH: G.bodyH,
  top: TOPBAR, headY, textTop, footY,
  frameRight: +(W - offPx).toFixed(1),
  juanRule: +(W - (offPx - 0.16 * pitch)).toFixed(1),
  glyphs, rules, colnos, juan,
  chapter: ch.n, cols: laid.total, notes: notes.length,
};

fs.writeFileSync('D:/Desktop_Env/MyBook/_preview/layout.json', JSON.stringify(out), 'utf8');
console.log(`第${ch.n}回：${laid.total} 主列，${laid.notes.length} 条眉批，${glyphs.length} 字入图`);
console.log(`字符守恒：源 ${srcN} / 排 ${outN} → ${ok ? 'OK' : '✗ 不一致'}`);
if (!ok) process.exit(2);
