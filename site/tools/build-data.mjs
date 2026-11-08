// 《脂砚斋重评石头记》排版数据构建
// 输入：../脂砚斋重评石头记.md（UTF-8）
// 输出：../site/data/book.js（window.BOOK = {...}）与 data-report.txt（脏点清单）
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('D:/Desktop_Env/MyBook/脂砚斋重评石头记');
const SRC = path.join(ROOT, '脂砚斋重评石头记.md');
const OUT_DIR = path.join(ROOT, 'site', 'data');
const OUT = path.join(OUT_DIR, 'book.js');
const REPORT = path.join(ROOT, 'site', 'tools', 'data-report.txt');

const raw = fs.readFileSync(SRC, 'utf8');
const lines = raw.split(/\r?\n/);

const SOURCES = ['甲戌', '庚辰', '己卯', '戚', '蒙', '靖', '脂', '甲', '庚', '梦', '该', '校者注', '题曰'];

const anomalies = [];
const warn = (lineNo, kind, detail) => anomalies.push({ lineNo, kind, detail });

// ---------- 批语分类 ----------
function classify(label) {
  let src = '';
  for (const s of SOURCES) {
    if (label.startsWith(s)) { src = s; break; }
  }
  const rest = label.slice(src.length);
  let kind;
  if (/回前/.test(rest)) kind = '回前';
  else if (/回末|回后/.test(rest)) kind = '回末';
  else if (/眉批/.test(rest)) kind = '眉批';
  else if (/双行|夹批/.test(rest)) kind = '夹批';
  else if (/侧批|旁批|侧|旁/.test(rest)) kind = '侧批';
  else if (/批|评|诗|词|注|题/.test(rest)) kind = '总批';
  else kind = '批';
  return { src, kind };
}

// 合法标签：短，且含已知书源或批语字样
function isLabel(s) {
  if (!s || s.length > 8) return false;
  if (s.includes('，') || s.includes('。')) return false;
  if (SOURCES.some((x) => s.startsWith(x))) return true;
  return /^[^：]{0,4}(批|评|注)$/.test(s);
}

// ---------- 单行解析 ----------
function parseLine(line, lineNo, ctx) {
  const runs = [];
  let i = 0;
  const open = '【';
  const close = '】';
  while (i < line.length) {
    const p = line.indexOf(open, i);
    if (p < 0) { pushText(runs, line.slice(i)); break; }
    if (p > i) pushText(runs, line.slice(i, p));
    let q = line.indexOf(close, p + 1);
    let unclosed = false;
    if (q < 0) { q = line.length; unclosed = true; warn(lineNo, '未闭合【', line.slice(p, p + 40)); }
    let inner = line.slice(p + 1, q);
    i = q + 1;

    // 嵌套标签（如「…。 该 批：…」）拆成两条
    if (/[。！？]\s*该\s*批[：:]/.test(inner)) {
      const parts = inner.split(/([。！？])\s*该\s*批[：:]/);
      // parts: [前段, 标点, 后段]
      const head = parts[0] + (parts.length > 1 ? parts[1] : '');
      const tail = parts.slice(2).join('');
      pushAnn(runs, head, lineNo);
      pushAnn(runs, '该批：' + tail, lineNo);
      warn(lineNo, '嵌套「该 批」', head.slice(0, 30));
      continue;
    }
    pushAnn(runs, inner, lineNo);
    if (unclosed) warn(lineNo, '行内截断', '该批语直到行尾');
  }
  return runs;
}

function pushText(runs, s) {
  if (!s) return;
  runs.push(['x', s]);
}

function pushAnn(runs, inner, lineNo) {
  const m = inner.match(/^([^：:]{1,10})[：:]([\s\S]*)$/);
  if (m && isLabel(m[1])) {
    const { src, kind } = classify(m[1]);
    runs.push(['a', kind, src, m[2].trim(), m[1].trim()]);
  } else {
    // 无标签：按位置在后续处理中判定回前/回末/总批
    runs.push(['a', '无', '', inner.trim(), '']);
    if (inner.length > 0) warn(lineNo, '无标签批语', inner.slice(0, 30));
  }
}

// ---------- 切分回目 ----------
const chapters = [];
let cur = null;
for (let n = 0; n < lines.length; n++) {
  const line = lines[n];
  const m = line.match(/^\s*####\s+(.+?)\s*$/);
  if (m) {
    cur = { title: m[1].trim(), lineNo: n + 1, blocks: [] };
    chapters.push(cur);
    continue;
  }
  if (!cur) continue;                     // 书名行
  const t = line.trim();
  if (!t) continue;

  // 去掉重复的回目标题行（已知第 702 行）
  if (/^第[一二三四五六七八九十百]+回[　\s]/.test(t) && cur.blocks.length < 4) {
    warn(n + 1, '疑似重复回目', t.slice(0, 30));
    continue;
  }

  const runs = parseLine(t, n + 1, cur);
  const onlyAnn = runs.length === 1 && runs[0][0] === 'a';
  cur.blocks.push({ runs, onlyAnn, lineNo: n + 1 });
}

// ---------- 回前/回末/无标签 的定位修正 ----------
for (const ch of chapters) {
  ch.n = chapters.indexOf(ch) + 1;
  const blocks = ch.blocks;
  // 去掉首尾空/异常块后判断
  const firstTextIdx = blocks.findIndex((b) => !b.onlyAnn);
  const lastIdx = blocks.length - 1;
  blocks.forEach((b, idx) => {
    if (!b.onlyAnn) return;
    const r = b.runs[0];
    if (r[1] === '无') {
      r[1] = idx < (firstTextIdx < 0 ? blocks.length : firstTextIdx) ? '回前' : (idx === lastIdx ? '回末' : '总批');
    }
  });
  // 首部无标签批语若在正文前，标为回前
  blocks.forEach((b, idx) => {
    if (!b.onlyAnn) return;
    const r = b.runs[0];
    if ((r[1] === '批' || r[1] === '总批') && idx < (firstTextIdx < 0 ? 0 : firstTextIdx)) r[1] = '回前';
    if ((r[1] === '批' || r[1] === '总批') && idx === lastIdx) r[1] = '回末';
  });

  // 第一回卷首的《戚蓼生序》《甲戌本凡例》及凡例诗是前置文字，不是批语
  if (ch.n === 1) {
    const startOfText = blocks.findIndex(
      (b) => !b.onlyAnn && b.runs.some((r) => r[0] === 'x' && r[1].includes('列位看官'))
    );
    const end = startOfText < 0 ? blocks.length : startOfText;
    blocks.forEach((b, idx) => {
      if (!b.onlyAnn || idx >= end) return;
      const r = b.runs[0];
      if (r[2] === '') r[1] = '序';
    });
  }
  ch.blocks = blocks;
  // 只保留序列化需要的字段
  ch.out = blocks.map((b) => [b.onlyAnn ? 'n' : 'p', ...b.runs.flat()]);
}

// ---------- 统计 ----------
const stat = { chapters: chapters.length, chars: 0, ann: 0, byKind: {}, bySrc: {} };
for (const ch of chapters) {
  for (const b of ch.blocks) {
    for (const r of b.runs) {
      if (r[0] === 'x') stat.chars += r[1].length;
      else {
        stat.ann++;
        stat.byKind[r[1]] = (stat.byKind[r[1]] || 0) + 1;
        stat.bySrc[r[2] || '(无)'] = (stat.bySrc[r[2] || '(无)'] || 0) + 1;
      }
    }
  }
}

// ---------- 输出 ----------
const book = {
  title: '脂硯齋重評石頭記',
  subtitle: '八十一卷 · 甲戌庚辰諸本匯錄',
  chapters: chapters.map((ch) => ({
    n: ch.n,
    t: ch.title.replace(/^第[^回]*回[　\s]*/, ''),
    full: ch.title,
    b: ch.out,
  })),
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const js = 'window.BOOK=' + JSON.stringify(book) + ';\n';
fs.writeFileSync(OUT, js, 'utf8');

const rep = [];
rep.push(`生成时间: ${new Date().toISOString()}`);
rep.push(`回数: ${stat.chapters}`);
rep.push(`正文字数(不含批语): ${stat.chars}`);
rep.push(`批语条数: ${stat.ann}`);
rep.push('');
rep.push('按类型:');
for (const [k, v] of Object.entries(stat.byKind).sort((a, b) => b[1] - a[1])) rep.push(`  ${k}\t${v}`);
rep.push('');
rep.push('按书源:');
for (const [k, v] of Object.entries(stat.bySrc).sort((a, b) => b[1] - a[1])) rep.push(`  ${k}\t${v}`);
rep.push('');
rep.push(`脏点/异常 ${anomalies.length} 条:`);
const grouped = {};
for (const a of anomalies) (grouped[a.kind] ||= []).push(a);
for (const [k, arr] of Object.entries(grouped)) {
  rep.push(`  类型「${k}」共 ${arr.length} 条，样例：`);
  for (const a of arr.slice(0, 6)) rep.push(`    行${a.lineNo}: ${a.detail}`);
}
fs.writeFileSync(REPORT, rep.join('\n'), 'utf8');

console.log(rep.slice(0, 40).join('\n'));
console.log('\n输出字节:', fs.statSync(OUT).size);
