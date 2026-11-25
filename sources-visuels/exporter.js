// Export des visuels : SVG (éditables dans Illustrator), PNG (x2), PDF (affiche) et MP4 (story)
// usage : node exporter.js <baseURL> <dossierSortie> [formats...]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const [base, out, ...only] = process.argv.slice(2);
const FORMATS = [
  { id: 'affiche', w: 1190, h: 1684, nom: 'affiche-A3-le-plein-ca-se-compare', pdf: true },
  { id: 'insta1', w: 1080, h: 1080, nom: 'instagram-1-plein-25-euros' },
  { id: 'insta2', w: 1080, h: 1080, nom: 'instagram-2-gazole-plus-cher' },
  { id: 'insta3', w: 1080, h: 1080, nom: 'instagram-3-ecart-stations' },
  { id: 'banniere', w: 1200, h: 630, nom: 'banniere-web-1200x630' },
  { id: 'story', w: 1080, h: 1920, nom: 'story-animee-1080x1920', video: true },
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  for (const f of FORMATS.filter(f => !only.length || only.includes(f.id))) {
    const page = await browser.newPage({ viewport: { width: f.w, height: f.h }, deviceScaleFactor: f.video ? 1 : 2 });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(`${base}/${path.basename(__dirname)}/atelier.html#${f.id}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.PRET === true);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    const svg = await page.evaluate(() => {
      const s = document.querySelector('#scene svg').cloneNode(true);
      const st = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      st.textContent = window.FONT_CSS;
      s.insertBefore(st, s.firstChild);
      return '<?xml version="1.0" encoding="UTF-8"?>\n' + s.outerHTML;
    });
    fs.writeFileSync(path.join(out, f.nom + '.svg'), svg);
    const el = await page.$('#scene svg');
    await el.screenshot({ path: path.join(out, f.nom + '.png') });
    if (f.pdf) {
      await page.addStyleTag({ content: '@page { size: 297mm 420mm; margin: 0 } #scene svg { width: 297mm !important; height: 420mm !important; }' });
      await page.pdf({ path: path.join(out, f.nom + '.pdf'), width: '297mm', height: '420mm', printBackground: true, pageRanges: '1' });
    }
    if (f.video) {
      const dir = path.join('/tmp', 'frames-' + f.id);
      fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
      const duree = await page.evaluate(() => window.DUREE), fps = 30, n = Math.round(duree * fps);
      for (let i = 0; i < n; i++) {
        await page.evaluate(t => window.renderAt(t), i / fps);
        await el.screenshot({ path: path.join(dir, `f${String(i).padStart(4, '0')}.png`) });
      }
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(dir, 'f%04d.png'), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, f.nom + '.mp4')]);
      fs.copyFileSync(path.join(dir, 'f0090.png'), path.join(out, f.nom + '-apercu.png'));
    }
    console.log(f.id, errs.length ? 'ERREURS: ' + errs.join(' | ') : 'ok');
    await page.close();
  }
  await browser.close();
})();
