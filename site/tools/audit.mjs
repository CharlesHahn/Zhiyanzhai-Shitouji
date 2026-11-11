// 对抗性自检：数据层 + 渲染层，任何一条不过就退出非零
import fs from 'node:fs';

const ROOT = 'D:/Desktop_Env/MyBook/脂砚斋重评石头记/site';
const read = (p) => fs.readFileSync(ROOT + p, 'utf8');
const win = {};
new Function('window', read('/data/book.js'))(win);
new Function('window', read('/layout.js'))(win);
const BOOK = win.BOOK, L = win.LAYOUT;

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

const SRC_OK = new Set(['甲戌', '庚辰', '蒙', '靖', '己卯', '待考', '题曰', '梦', '脂', '校者注', '']);
const EMB = /(甲戌|庚辰|己卯|蒙|靖|脂|戚|甲|庚|辰)\s*(回前总批|回末总批|双行夹批|双行夹注|侧批|眉批|夹批|夹注|批)\s*[：:]/;

let nAnn = 0, nText = 0;
const srcCount = {};

for (const ch of BOOK.chapters) {
  for (const b of ch.b) {
    for (const r of L.runsOf(b)) {
      if (r[0] === 'x') {
        nText++;
        ok(!EMB.test(r[1]), `卷${ch.n} 正文里仍夹着批语标签：${r[1].slice(0, 24)}`);
        continue;
      }
      nAnn++;
      const [, kind, src, text, label] = r;
      ok(SRC_OK.has(src), `卷${ch.n} 未知来源「${src}」（标签 ${label}）`);
      ok(!EMB.test(text), `卷${ch.n} 批语正文里仍夹着另一条批语标签：${text.slice(0, 24)}`);
      ok(kind !== '无' || !label, `卷${ch.n} 无标签批语却带标签：${label}`);
      srcCount[src || '(无)'] = (srcCount[src || '(无)'] || 0) + 1;
    }
  }
}

console.log(`数据层：批语 ${nAnn} 条，正文段 ${nText} 段`);
console.log('来源分布:', srcCount);

// ---- 结构检查：批注一律走窄缝，不得混进正文列 ----
{
  const G = L.geom({ f: 17, avail: 820 });
  let noteOnlyWithText = 0, bodySegsInNoteCol = 0, annRuns = 0;
  for (const ch of BOOK.chapters) {
    const laid = L.typeset(ch, G, () => true);
    laid.cols.forEach((col, i) => {
      if (!col) return;
      if (col.noteOnly && col.segs.length) noteOnlyWithText++;
      if (col.segs.some((s) => s.red)) bodySegsInNoteCol++;
      for (const s of col.segs) if (s.red) annRuns++;
    });
  }
  ok(noteOnlyWithText === 0, `有 ${noteOnlyWithText} 条「只放批语」的窄列混入了正文`);
  ok(bodySegsInNoteCol === 0, `有 ${bodySegsInNoteCol} 处批语被排成了正文大小`);
  console.log('结构层：批语未混入正文列，亦无正文大小的批语');
}
// ---- 渲染层（第四章抽查，避免单章特殊） ----
const COLORS = { '甲戌': '#a3312a', '庚辰': '#2e5c8a', '蒙': '#8a5a2f', '靖': '#6b3f7a', '己卯': '#2f6b5a', '待考': '#4f4a45', '其他': '#8a8578' };
const store = new Map();
function el(id) {
  if (store.has(id)) return store.get(id);
  const e = {
    id, style: { setProperty() {} }, dataset: {}, hidden: false, textContent: '', innerHTML: '', className: '',
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    firstElementChild: { style: {} }, scrollWidth: 1600, clientWidth: 1200, scrollLeft: 0, offsetWidth: 0,
    addEventListener() {}, appendChild() {}, setPointerCapture() {}, releasePointerCapture() {},
    scrollIntoView() {}, scrollBy() {}, closest() { return null; }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1200, height: 900 }; },
  };
  store.set(id, e);
  return e;
}
globalThis.window = { BOOK: win.BOOK, LAYOUT: win.LAYOUT, innerWidth: 1600, innerHeight: 900, addEventListener() {} };
globalThis.document = { readyState: 'complete', documentElement: { style: { setProperty() {} } }, body: { dataset: {} }, getElementById: el, querySelectorAll: () => [], addEventListener() {} };
globalThis.location = { hash: '' };
globalThis.history = { replaceState() {} };
globalThis.requestAnimationFrame = (f) => f();
globalThis.setTimeout = () => 0;
globalThis.clearTimeout = () => {};

const appSrc = read('/app.js');
new Function(appSrc).call(globalThis);

// 借 boot 之后的可变状态：直接再渲染若干卷
const html = store.get('strip').innerHTML;
const divs = [...html.matchAll(/<div class="(seg [^"]*)"([^>]*)>/g)].map((m) => ({ cls: m[1], attrs: m[2] }));
ok(divs.length > 100, '渲染片段过少，可能未渲染');

const needColor = divs.filter((d) => /seg s|seg r/.test(d.cls));
const noColor = needColor.filter((d) => !/color:/.test(d.attrs));
ok(noColor.length === 0, `有 ${noColor.length} 个批语片段缺颜色`);

for (const d of needColor) {
  const m = d.attrs.match(/color:([^;"]+)/);
  if (m) ok(Object.values(COLORS).includes(m[1]), `出现了调色板外的颜色 ${m[1]}`);
}

const bodyWithLabel = divs.filter((d) => d.cls === 'seg t' && EMB.test(d.attrs));
ok(bodyWithLabel.length === 0, `正文片段里出现批语标签 ${bodyWithLabel.length} 处`);

// 颜色分布必须多于一种（防止「全部同色」回归）
const palette = new Set();
for (const d of needColor) { const m = d.attrs.match(/color:([^;"]+)/); if (m) palette.add(m[1]); }
ok(palette.size >= 2, '批语颜色只有一种，疑似颜色映射失效');

console.log('渲染层：片段', divs.length, '| 批语片段', needColor.length, '| 用到的颜色', [...palette].join(' '));

if (fails.length) {
  console.error('\n✗ 审查未通过，共 ' + fails.length + ' 项：');
  for (const f of fails.slice(0, 20)) console.error('  - ' + f);
  process.exit(1);
}
console.log('\n✓ 对抗性审查全部通过');
