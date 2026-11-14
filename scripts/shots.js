// Renders the README screenshots into docs/: `npx electron scripts/shots.js`
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const out = path.join(root, 'docs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const BG = 'linear-gradient(160deg, #1f3b57 0%, #3d6b8f 45%, #e9b98f 100%)';

async function chatShot() {
  const settings = { name: 'Claude', color: '#D97757', hat: 'party', accessory: 'none', size: 6, speed: 0, behavior: 'stay', layer: 'above', sound: false, volume: 0, voice: 'normal' };
  const win = new BrowserWindow({
    width: 354, height: 560, show: false, useContentSize: true,
    webPreferences: { preload: path.join(__dirname, 'shots-preload.js'), contextIsolation: false, additionalArguments: ['--shot-settings=' + JSON.stringify(settings)] },
  });
  await win.loadFile(path.join(root, 'renderer', 'index.html'));
  await win.webContents.executeJavaScript(`document.body.style.background = '${BG}'`);
  await wait(2200); // let him finish his hello wave
  await win.webContents.executeJavaScript(`(async () => {
    const c = document.getElementById('stage');
    const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data, r = devicePixelRatio;
    let mx = 1e9, my = 1e9, Mx = -1, My = -1;
    for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2)
      if (d[(y * c.width + x) * 4 + 3] > 200) { mx = Math.min(mx, x); Mx = Math.max(Mx, x); my = Math.min(my, y); My = Math.max(My, y); }
    const cx = (mx + Mx) / 2 / r, cy = (my + My) / 2 / r;
    const ev = (t) => new PointerEvent(t, { bubbles: true, button: 0, pointerId: 1, screenX: cx, screenY: cy, clientX: cx, clientY: cy });
    c.dispatchEvent(ev('pointerdown')); c.dispatchEvent(ev('pointerup'));
    await new Promise((r) => setTimeout(r, 300));
    document.getElementById('prompt').value = 'Who are you?';
    document.getElementById('askForm').requestSubmit();
  })()`);
  await wait(4500);
  await win.webContents.executeJavaScript(`document.getElementById('prompt').blur()`);
  await wait(300);
  fs.writeFileSync(path.join(out, 'chat.png'), (await win.webContents.capturePage()).toPNG());
  win.destroy();
}

async function lineupShot() {
  const win = new BrowserWindow({ width: 900, height: 230, show: false, useContentSize: true });
  const blank = path.join(require('os').tmpdir(), 'buddy-blank.html');
  fs.writeFileSync(blank, '<!doctype html><html><body></body></html>');
  await win.loadFile(blank);
  await win.webContents.executeJavaScript("document.body.style.margin='0'");
  const sprite = fs.readFileSync(path.join(root, 'sprite.js'), 'utf8');
  await win.webContents.executeJavaScript(sprite + `;(() => {
    document.body.style.background = '${BG}';
    const c = document.createElement('canvas'); const r = devicePixelRatio;
    c.width = 900 * r; c.height = 230 * r; c.style.width = '900px'; c.style.height = '230px';
    document.body.appendChild(c);
    const g = c.getContext('2d'); g.scale(r, r);
    const B = window.BuddySprite, s = 6;
    const looks = [
      { hat: 'none', accessory: 'none', color: '#D97757', pose: 'wave', frame: 1 },
      { hat: 'party', accessory: 'bowtie', color: '#E8A33D', pose: 'walk', frame: 0 },
      { hat: 'crown', accessory: 'none', color: '#9B6BDF', pose: 'idle' },
      { hat: 'wizard', accessory: 'scarf', color: '#4C8DF6', pose: 'think' },
      { hat: 'tophat', accessory: 'sunglasses', color: '#3A3A3A', pose: 'idle' },
      { hat: 'cowboy', accessory: 'none', color: '#D97757', pose: 'walk', frame: 1, facing: -1 },
      { hat: 'beanie', accessory: 'flower', color: '#3FB59A', pose: 'sleep' },
    ];
    looks.forEach((o, i) => {
      const ox = 22 + i * 124, oy = 40 - B.TOP * s;
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(ox + 8 * s, oy + B.FEET * s, 6 * s, 1.2 * s, 0, 0, 7); g.fill();
      B.drawBuddy((x, y, w, h, col) => { g.fillStyle = col; g.fillRect(ox + x * s, oy + y * s, w * s, h * s); }, o);
    });
  })()`);
  await wait(200);
  fs.writeFileSync(path.join(out, 'lineup.png'), (await win.webContents.capturePage()).toPNG());
  win.destroy();
}

async function settingsShot() {
  const settings = { name: 'Claude', color: '#D97757', hat: 'cowboy', accessory: 'none', size: 6, speed: 6, behavior: 'follow', layer: 'above', sound: true, volume: 5, voice: 'normal' };
  const win = new BrowserWindow({
    width: 400, height: 1010, show: false, useContentSize: true,
    webPreferences: { preload: path.join(__dirname, 'shots-preload.js'), contextIsolation: false, additionalArguments: ['--shot-settings=' + JSON.stringify(settings)] },
  });
  await win.loadFile(path.join(root, 'renderer', 'settings.html'));
  await wait(800);
  fs.writeFileSync(path.join(out, 'customize.png'), (await win.webContents.capturePage()).toPNG());
  win.destroy();
}

app.on('window-all-closed', () => {}); // keep going between screenshots

app.whenReady().then(async () => {
  fs.mkdirSync(out, { recursive: true });
  await chatShot();
  await lineupShot();
  await settingsShot();
  console.log('Wrote docs/chat.png, docs/lineup.png, docs/customize.png');
  app.quit();
});
