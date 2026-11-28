// standing chat shortcuts: Shift+Z (잡담) / Shift+X (대화 기록) next to Alt+Z / Alt+X; Shift never fires while typing
// usage: node tests/shortcut_test.js
const { chromium } = require('playwright'); const path = require('path');
// served over http (file:// blocks the WebGL textures); a tiny static server for the repo folder
const http = require('http'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
const R = []; const ok = (lab, c, v = '') => { R.push(!!c); console.log((c ? 'OK  ' : 'FAIL'), lab, v === '' ? '' : JSON.stringify(v)); };
(async () => {
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const U = `http://127.0.0.1:${srv.address().port}/index.html`;
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 800 } }); const errs = [];
  pg.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  // a signed-in player who already went past the title (sessionStorage vt.in), as after entering for real
  await pg.goto(U); await pg.waitForFunction(() => typeof S !== 'undefined' && typeof saveLocal === 'function', null, { timeout: 60000 });
  await pg.evaluate(() => { S.settings.userId = S.settings.nick = 'tester'; S.picker = false; saveLocal(); sessionStorage.setItem('vt.in', '1'); });
  await pg.waitForTimeout(1500); await pg.reload();
  await pg.waitForFunction(() => typeof PL !== 'undefined' && typeof A !== 'undefined' && A.plOocToggle && A.plTalkLog, null, { timeout: 60000 });
  await pg.waitForTimeout(1500);
  // skip title / gates: the shortcut only listens once the play screen is up; count the toggles instead of drawing them
  await pg.evaluate(() => {
    document.querySelectorAll('#vr,.gate,#wizroot').forEach((e) => e.remove()); const vt = document.getElementById('vt'); if (vt) vt.style.display = 'none'; PL.tab = 'talk';
  });
  // the real thing first: Shift+Z opens the 잡담 panel and Shift+Z again closes it
  await pg.evaluate(() => document.activeElement?.blur?.());
  const ooc0 = await pg.evaluate(() => !!PL.ui.ooc);
  await pg.keyboard.press('Shift+KeyZ'); await pg.waitForTimeout(300); const ooc1 = await pg.evaluate(() => !!PL.ui.ooc);
  await pg.evaluate(() => document.activeElement?.blur?.()); await pg.keyboard.press('Shift+KeyZ'); await pg.waitForTimeout(300);
  ok('real: Shift+Z opens and closes 잡담', ooc1 === !ooc0 && await pg.evaluate(() => !!PL.ui.ooc) === ooc0, [ooc0, ooc1]);
  await pg.evaluate(() => {
    window.__n = { c: 0, l: 0, tab: [] }; PL.tab = 'talk';
    A.plOocToggle = () => { __n.c++; }; A.plTalkLog = () => { __n.l++; }; A.plTab = (e) => { __n.tab.push(e.dataset.v); };
    const i = document.createElement('input'); i.id = '__t'; document.body.append(i); document.activeElement?.blur?.();
  });
  const n = () => pg.evaluate(() => ({ c: __n.c, l: __n.l, tab: __n.tab.length }));
  await pg.keyboard.press('Shift+KeyZ'); ok('Shift+Z opens 잡담', (await n()).c === 1, await n());
  await pg.keyboard.press('Shift+KeyX'); ok('Shift+X opens 대화 기록', (await n()).l === 1, await n());
  await pg.keyboard.press('Alt+KeyZ'); await pg.keyboard.press('Alt+KeyX'); ok('Alt+Z / Alt+X still work', JSON.stringify(await n()) === '{"c":2,"l":2,"tab":0}', await n());
  await pg.keyboard.press('Shift+Digit1'); ok('Shift+1 is not a standing pick', JSON.stringify(await n()) === '{"c":2,"l":2,"tab":0}');
  // typing in a box: Shift+Z is a capital Z, not a shortcut
  await pg.focus('#__t'); await pg.keyboard.press('Shift+KeyZ'); await pg.keyboard.press('Shift+KeyX');
  ok('Shift+Z/X while typing just types', JSON.stringify(await n()) === '{"c":2,"l":2,"tab":0}' && await pg.inputValue('#__t') === 'ZX', [await n(), await pg.inputValue('#__t')]);
  await pg.keyboard.press('Alt+KeyZ'); ok('Alt+Z still works while typing', (await n()).c === 3);
  await pg.evaluate(() => document.activeElement.blur());
  // other tabs: Shift+X goes to the standing tab with the log open
  await pg.evaluate(() => { PL.tab = 'battle'; PL.talkLog = false; });
  await pg.keyboard.press('Shift+KeyX'); ok('Shift+X from another tab -> standing tab + log', await pg.evaluate(() => __n.tab[0] === 'talk' && PL.talkLog === true));
  await b.close(); srv.close(); console.log('errors:', errs.slice(0, 5));
  const pass = R.every(Boolean); console.log(pass ? 'PASS' : 'FAILED'); process.exit(pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
