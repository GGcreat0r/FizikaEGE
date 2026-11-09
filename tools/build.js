// Сборка PWA-квиза. Использование:
//   node build.js topics/<тема>/content.json <папка-вывода>
// Нужно: npm i katex sharp (sharp — для иконок; без него иконки не создаются).
const fs = require('fs'), path = require('path');
const [, , contentFile, outDir = 'dist'] = process.argv;
if (!contentFile) { console.error('usage: node build.js content.json [outDir]'); process.exit(1); }
const C = JSON.parse(fs.readFileSync(contentFile, 'utf8')).config;
const dataFile = path.join(path.dirname(contentFile), 'quiz-data.json');
if (!fs.existsSync(dataFile)) { console.error('Сначала запусти: node gen.js ' + contentFile); process.exit(1); }
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cfg = {
  title: C.title, short: C.short || C.title, slug: C.slug || 'quiz', subtitle: C.subtitle || '', prompt: C.prompt || 'Выбери правильный ответ',
  foot: C.foot || '', theme: C.theme || '#4f46e5', math: C.math !== false,
  star: Object.assign({ label: '★ дополнительно', name: 'Карточки со ★', hint: 'дополнительный материал' }, C.star || {}),
};
let html = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
const rep = { TITLE: cfg.title, SHORT: cfg.short, SUBTITLE: cfg.subtitle, PROMPT: cfg.prompt, FOOT: cfg.foot, THEME: cfg.theme,
  STAR_NAME: cfg.star.name, STAR_HINT: cfg.star.hint, STAR_LABEL: cfg.star.label };
for (const k in rep) html = html.split(`{{${k}}}`).join(esc(rep[k]));

let css = '', js = '';
if (cfg.math) {
  const K = path.dirname(require.resolve('katex/package.json')) + '/dist/';
  const keep = ['AMS-Regular', 'Caligraphic-Regular', 'Main-Regular', 'Main-Italic', 'Main-Bold', 'Math-Italic', 'Size1-Regular', 'Size2-Regular', 'Size3-Regular', 'Size4-Regular'];
  css = fs.readFileSync(K + 'katex.min.css', 'utf8').replace(/@font-face\{[^}]*\}/g, ff => {
    const m = ff.match(/KaTeX_([A-Za-z0-9]+-[A-Za-z]+)\.woff2/); if (!m || !keep.includes(m[1])) return '';
    return ff.replace(/src:[^;}]*/, `src:url(data:font/woff2;base64,${fs.readFileSync(K + 'fonts/KaTeX_' + m[1] + '.woff2').toString('base64')}) format("woff2")`);
  });
  js = fs.readFileSync(K + 'katex.min.js', 'utf8').replace(/<\/script/g, '<\\/script');
}
html = html.replace('/*KATEX_CSS*/', () => css).replace('/*KATEX_JS*/', () => js)
  .replace('/*DATA*/', () => fs.readFileSync(dataFile, 'utf8').replace(/<\//g, '<\\/'))
  .replace('/*CONFIG*/', () => JSON.stringify(cfg).replace(/<\//g, '<\\/'));

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), html);
const ver = Date.now().toString(36);
fs.writeFileSync(path.join(outDir, 'sw.js'), `const C='${cfg.slug}-${ver}';const F=['./','index.html','manifest.json','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim();});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r;}).catch(()=>caches.match(e.request,{ignoreSearch:true})));});
`);
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({
  name: cfg.title, short_name: cfg.short, lang: 'ru', start_url: './', scope: './', display: 'standalone',
  background_color: '#f4f5fb', theme_color: cfg.theme,
  icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
}, null, 2));

// Иконка: C.icon — короткий текст (1–5 символов), по умолчанию первые буквы short
const iconText = esc(C.icon || cfg.short.slice(0, 2));
const fs_ = iconText.length <= 2 ? 240 : iconText.length <= 4 ? 170 : 130;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${cfg.theme}"/><text x="256" y="${256 + fs_ * 0.35}" font-family="DejaVu Serif" font-style="italic" font-size="${fs_}" fill="#fff" text-anchor="middle">${iconText}</text></svg>`;
(async () => {
  let sharp; try { sharp = require('sharp'); } catch (e) { try { sharp = require('/opt/npm-tools/node_modules/sharp'); } catch (e2) {} }
  if (sharp) for (const s of [192, 512]) await sharp(Buffer.from(svg)).resize(s, s).png().toFile(path.join(outDir, `icon-${s}.png`));
  else { fs.writeFileSync(path.join(outDir, 'icon.svg'), svg); console.warn('sharp не найден — сохранён icon.svg, PNG-иконки сделай вручную'); }
  console.log(`готово: ${outDir}/index.html (${(html.length / 1024).toFixed(0)} KB)`);
})();
