// Генератор неверных вариантов для квиза-запоминалки.
// Для формул (config.math=true) — мутации LaTeX + ручные варианты; для текста — ручные + ответы соседних карточек.
const katex = require('katex');
const fs = require('fs');

// ---------- утилиты разбора ----------
function matchBrace(s, i) { // s[i]=='{'
  let d = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === '{') d++;
    else if (s[j] === '}') { d--; if (d === 0) return j; }
  }
  return -1;
}
// аргумент команды: {...} | \cmd | один символ. Возвращает [start,end) и "тело"
function readArg(s, i) {
  while (s[i] === ' ') i++;
  if (s[i] === '{') { const e = matchBrace(s, i); return { st: i, en: e + 1, body: s.slice(i + 1, e) }; }
  if (s[i] === '\\') { let j = i + 1; while (j < s.length && /[a-zA-Z]/.test(s[j])) j++; if (j === i + 1) j++; return { st: i, en: j, body: s.slice(i, j) }; }
  return { st: i, en: i + 1, body: s[i] };
}
// защищённые зоны: \text{...}, _{...}, \begin{..}/\end{..}
function protectedMask(s) {
  const m = new Array(s.length).fill(false);
  const mark = (a, b) => { for (let k = a; k < b; k++) m[k] = true; };
  let re = /\\text\s*\{|_\{|\\(begin|end)\{/g, r;
  while ((r = re.exec(s))) { const b = s.indexOf('{', r.index); const e = matchBrace(s, b); mark(r.index, e + 1); }
  return m;
}
const allIdx = (s, sub) => { const out = []; let i = s.indexOf(sub); while (i >= 0) { out.push(i); i = s.indexOf(sub, i + 1); } return out; };
const simple = b => b.length <= 14 && !/[+\-=]/.test(b);
const wrap = b => (b.length === 1 || /^\\[a-zA-Z]+$/.test(b)) ? b : `{${b}}`;


// ---------- произведения ----------
const PREFIX = ['\\vec', '\\Delta', '\\overline', '\\mathcal'];
function factors(seg) { // разбить сегмент на множители, или null
  let i = 0; const out = []; const s = seg;
  const ws = () => { while (i < s.length && (s[i] === ' ' || s.startsWith('\\,', i) || s.startsWith('\\cdot', i))) i += s.startsWith('\\cdot', i) ? 5 : (s[i] === ' ' ? 1 : 2); };
  ws();
  while (i < s.length) {
    const st = i;
    let guard = 0;
    while (guard++ < 4) { const p = PREFIX.find(p => s.startsWith(p, i) && !/[a-zA-Z]/.test(s[i + p.length] || '')); if (!p) break; i += p.length; while (s[i] === ' ') i++; }
    if (/[a-zA-Z0-9]/.test(s[i])) { i++; while (/[0-9]/.test(s[i - 1]) && /[0-9]/.test(s[i] || '')) i++; }
    else if (s[i] === '\\') { let j = i + 1; while (j < s.length && /[a-zA-Z]/.test(s[j])) j++; const cmd = s.slice(i, j); if (/^\\(frac|tfrac|dfrac|sqrt|sin|cos|text|left|right|quad|lim|Bigl|Bigr|begin|end|ldots|to|le|ge|perp|pm|sum|textstyle|langle|rangle|ldots|infty)$/.test(cmd)) return null; i = j; }
    else if (s[i] === '{' ) { const e = matchBrace(s, i); i = e + 1; }
    else return null;
    while (s[i] === '_' || s[i] === '^' || s[i] === "'") { if (s[i] === "'") { i++; continue; } const a = readArg(s, i + 1); i = a.en; }
    out.push(s.slice(st, i).trim());
    ws();
  }
  return out.length ? out : null;
}
function segments(f) { // верхнеуровневые части между = и ,
  const cuts = []; let d = 0; const m = protectedMask(f);
  for (let i = 0; i < f.length; i++) { if (f[i] === '\\') { i++; continue; } if (f[i] === '{') d++; else if (f[i] === '}') d--; else if (d === 0 && !m[i] && (f[i] === '=' || f[i] === ',')) cuts.push(i); }
  const segs = []; let prev = 0;
  for (const c of [...cuts, f.length]) { let a = prev, b = c; let seg = f.slice(a, b); const lead = seg.match(/^(\\quad|\\,|\s)*/)[0]; a += lead.length; seg = f.slice(a, b); const trail = seg.match(/(\\quad|\s)*$/)[0]; b -= trail.length; segs.push([a, b, prev > 0 ? f[prev - 1] : '']); prev = c + 1; }
  return segs;
}
function productMutations(f, add) {
  segments(f).forEach(([a, b, cut], idx) => {
    if (cut !== '=') return;
    const fs_ = factors(f.slice(a, b)); if (!fs_) return;
    const pre = f.slice(0, a), post = f.slice(b);
    const nonNum = fs_.filter(x => !/^\d+$/.test(x));
    if (fs_.length >= 2 && nonNum.length >= 2) {
      const first = fs_[0], rest = fs_.slice(1).join(' ');
      const last = fs_[fs_.length - 1], init = fs_.slice(0, -1).join(' ');
      add(pre + `\\frac{${init}}{${last}}` + post, 'умножение → деление');
      add(pre + `\\frac{${last}}{${init}}` + post, 'умножение → деление');
      if (!/\^/.test(last)) add(pre + fs_.slice(0, -1).join(' ') + ' ' + wrap(last) + '^2' + post, 'лишний квадрат');
    } else if (idx > 0 && fs_.length === 1 && !/\^/.test(fs_[0]) && !/^\d/.test(fs_[0]) && !/const/.test(fs_[0])) {
      add(pre + wrap(fs_[0]) + '^2' + post, 'z-одиночный квадрат');
    }
  });
}

// ---------- мутации ----------
function mutations(f) {
  const out = [];
  const add = (x, why) => out.push([x, why]);
  // 1. перевернуть дробь / превратить дробь в произведение / потерять знаменатель-двойку
  for (const cmd of ['\\frac', '\\tfrac', '\\dfrac']) {
    for (const i of allIdx(f, cmd)) {
      if (/[a-zA-Z]/.test(f[i + cmd.length])) continue;
      const a = readArg(f, i + cmd.length), b = readArg(f, a.en);
      if (a.body === b.body) continue;
      const swapOk = a.body !== '1';
      const pre = f.slice(0, i), post = f.slice(b.en);
      if (swapOk) add(pre + `${cmd}{${b.body}}{${a.body}}` + post, 'перевёрнута дробь');
      if (b.body === '2') add(pre + wrap(a.body) + post, 'потеряна ½');
      else if (simple(a.body) && simple(b.body) && a.body !== '1' && !(/^\d+$/.test(a.body) && /^\d+$/.test(b.body))) add(pre + `${wrap(a.body)}\\cdot ${wrap(b.body)}` + post, 'деление → умножение');
    }
  }
  productMutations(f, add);
  // 2. квадраты/степени
  for (const p of ['^2', '^{2}']) for (const i of allIdx(f, p)) add(f.slice(0, i) + f.slice(i + p.length), 'потерян квадрат');
  for (const i of allIdx(f, '^{-')) add(f.slice(0, i + 2) + f.slice(i + 3), 'знак степени');
  // 3. корень
  for (const i of allIdx(f, '\\sqrt')) {
    const a = readArg(f, i + 5);
    add(f.slice(0, i) + wrap(a.body) + f.slice(a.en), 'потерян корень');
  }
  // 4. sin ↔ cos
  for (const [x, y] of [['\\sin', '\\cos'], ['\\cos', '\\sin']])
    for (const i of allIdx(f, x)) if (!/[a-zA-Z]/.test(f[i + 4] || '')) add(f.slice(0, i) + y + f.slice(i + 4), 'sin ↔ cos');
  // 5. знаки
  const m = protectedMask(f);
  for (let i = 0; i < f.length; i++) {
    if (m[i]) continue;
    if (f[i] === '-' && f[i - 1] !== '\\') add(f.slice(0, i) + (f[i - 1] === '=' || i === 0 || f[i - 1] === '{' || f[i - 1] === '(' ? '' : '+') + f.slice(i + 1), 'неверный знак');
    if (f[i] === '+' && !f.slice(i + 1).trimStart().startsWith('\\ldots')) add(f.slice(0, i) + '-' + f.slice(i + 1), 'неверный знак');
  }
  // 6. коэффициенты
  for (const i of allIdx(f, '2\\pi')) add(f.slice(0, i) + f.slice(i + 1), 'потеряно 2');
  { const re = /(^|[=\s(])2(?=[a-zA-Z\\])/g; let r; while ((r = re.exec(f))) { const k = r.index + r[1].length; if (!m[k] && !f.slice(k, k + 4).startsWith('2\\pi')) add(f.slice(0, k) + f.slice(k + 1), 'потеряно 2'); } }
  for (const [x, y] of [['\\frac32', '\\frac12'], ['\\tfrac13', '\\tfrac12'], ['\\tfrac23', '\\tfrac13']]) for (const i of allIdx(f, x)) add(f.slice(0, i) + y + f.slice(i + x.length), 'неверный коэффициент');
  // 7. ≤ ↔ ≥, ⊥ etc
  for (const [x, y] of [['\\le', '\\ge'], ['\\perp', '\\parallel'], ['\\mu', '\\rho']])
    for (const i of allIdx(f, x)) if (!/[a-zA-Z]/.test(f[i + x.length] || '')) add(f.slice(0, i) + y + f.slice(i + x.length), 'подмена');
  return out;
}

const norm = s => { try { return katex.renderToString(s, { strict: false, output: 'mathml' }).replace(/<annotation[\s\S]*?<\/annotation>/, ''); } catch (e) { return s; } };
const renders = s => { try { katex.renderToString(s, { throwOnError: true, strict: false }); return true; } catch (e) { return false; } };


// ---------- основной процесс ----------
// Использование: node gen.js topics/<тема>/content.json  → topics/<тема>/quiz-data.json
const path = require('path');
const file = process.argv[2];
if (!file) { console.error('usage: node gen.js path/to/content.json'); process.exit(1); }
const C = JSON.parse(fs.readFileSync(file, 'utf8'));
const MATH = C.config.math !== false;
const manual = C.manual || {}, banned = C.banned || {}, exclude = new Set(C.exclude || []);
const keyOf = MATH ? norm : (s => s.trim().toLowerCase().replace(/\s+/g, ' '));
const ok = MATH ? renders : (() => true);
const out = [], low = [];
const WANT = C.config.pool || 8;
C.sections.forEach((sec, si) => sec.items.forEach(([name, f, star]) => {
  if (exclude.has(name)) return;
  const seen = new Set([keyOf(f)]), pool = [];
  const push = x => { if ((banned[name] || []).includes(x)) return; const k = keyOf(x); if (seen.has(k) || !ok(x)) return; seen.add(k); pool.push(x); };
  (manual[name] || []).forEach(push);
  if (MATH) {
    const byWhy = {};
    mutations(f).forEach(([x, w]) => (byWhy[w] = byWhy[w] || []).push(x));
    let round = 0, added = true;
    while (pool.length < WANT && added) { added = false; for (const w in byWhy) { if (w.startsWith('z-') && pool.length >= 3) continue; if (byWhy[w][round]) { push(byWhy[w][round]); added = true; } } round++; }
  }
  // запасной вариант: ответы соседних карточек того же раздела (для текстовых тем это основной источник)
  if (pool.length < 3) {
    const others = sec.items.filter(it => it[0] !== name).map(it => it[1]).sort(() => Math.random() - .5);
    for (const x of others) { if (pool.length >= 4) break; push(x); }
  }
  if (pool.length < 3) low.push(`${name} (${pool.length})`);
  out.push({ s: si, n: name, st: star ? 1 : 0, f, d: pool });
}));
const dst = path.join(path.dirname(file), 'quiz-data.json');
fs.writeFileSync(dst, JSON.stringify({ sections: C.sections.map(s => ({ t: s.t, c: s.c })), q: out }));
console.log(`карточек: ${out.length}, в среднем неверных вариантов: ${(out.reduce((a, q) => a + q.d.length, 0) / out.length).toFixed(1)}`);
if (low.length) console.log('Мало вариантов (<3) — допиши в manual:', low.join('; '));
// дамп для ревью
fs.writeFileSync(path.join(path.dirname(file), 'review.txt'), out.map(q => `## ${q.n}\n  ✓ ${q.f}\n` + q.d.map(x => `  ✗ ${x}`).join('\n')).join('\n'));
