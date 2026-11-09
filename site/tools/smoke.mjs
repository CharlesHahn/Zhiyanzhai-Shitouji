// 無瀏覽器環境下的冒煙測試：用最小 DOM 樁跑一遍 app.js
import fs from 'node:fs';

const ROOT = 'D:/Desktop_Env/MyBook/脂砚斋重评石头记/site';
const read = (p) => fs.readFileSync(ROOT + p, 'utf8');

const win = {};
new Function('window', read('/data/book.js'))(win);
new Function('window', read('/layout.js'))(win);

const store = new Map();
function el(id) {
  if (store.has(id)) return store.get(id);
  const e = {
    id, style: {}, dataset: {}, hidden: false, textContent: '', innerHTML: '',
    className: '',
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    firstElementChild: { style: {} },
    scrollWidth: 1600, clientWidth: 1200, scrollLeft: 0,
    offsetWidth: 0,
    addEventListener() {}, removeEventListener() {},
    appendChild() {}, setPointerCapture() {}, releasePointerCapture() {},
    scrollIntoView() {}, scrollBy() {},
    closest() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1200, height: 900 }; },
  };
  store.set(id, e);
  return e;
}

globalThis.window = {
  BOOK: win.BOOK,
  LAYOUT: win.LAYOUT,
  innerWidth: 1600,
  innerHeight: 900,
  addEventListener() {},
};
globalThis.document = {
  readyState: 'complete',
  documentElement: { style: { setProperty() {} } },
  body: { dataset: {} },
  getElementById: el,
  querySelectorAll: () => [],
  addEventListener() {},
};
globalThis.location = { hash: '' };
globalThis.history = { replaceState() {} };
globalThis.requestAnimationFrame = (f) => f();
globalThis.setTimeout = (f) => 0;
globalThis.clearTimeout = () => {};

// 先核对 app.js 里 $('id') 引用的元素是否都真的存在于 index.html
{
  const idx = read('/index.html');
  const ids = new Set([...idx.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const refs = new Set([...read('/app.js').matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]));
  const missing = [...refs].filter((r) => !ids.has(r));
  if (missing.length) {
    console.error('✗ app.js 引用了 index.html 中不存在的元素:', missing.join(', '));
    process.exit(1);
  }
  console.log(`✓ DOM 引用检查通过（${refs.size} 个 id）`);
}

const html = read('/app.js');
try {
  new Function(html).call(globalThis);
} catch (e) {
  console.error('✗ app.js 執行失敗：', e && e.stack || e);
  process.exit(1);
}

const strip = el('strip');
const out = strip.innerHTML || '';
if (!out.includes('class="col"')) {
  console.error('✗ 未生成列元素');
  process.exit(1);
}
const colCount = (out.match(/class="col"/g) || []).length;
const segCount = (out.match(/class="seg /g) || []).length;
const juan = out.includes('class="juan-title"');

console.log(`✓ app.js 執行通過`);
console.log(`  列 ${colCount} / 片段 ${segCount} / 卷首 ${juan ? '有' : '無'}`);
console.log(`  strip 寬 ${strip.style.width}，高 ${strip.style.height}`);

if (colCount < 10) { console.error('✗ 列數異常'); process.exit(1); }
if (!juan) { console.error('✗ 卷首缺失'); process.exit(1); }
