const { app, BrowserWindow, ipcMain, screen, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const Sprite = require('./sprite');

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
const isLinux = process.platform === 'linux';

// Let him make noises without waiting for a click first.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

if (isLinux) {
  app.commandLine.appendSwitch('enable-transparent-visuals');
  // Wayland won't let apps move their own windows, so run under XWayland.
  if (process.env.XDG_SESSION_TYPE === 'wayland' || process.env.WAYLAND_DISPLAY) {
    app.commandLine.appendSwitch('ozone-platform', 'x11');
  }
}

// Only one buddy at a time.
if (!app.requestSingleInstanceLock()) app.quit();

// ---------- settings ----------
const DEFAULTS = {
  name: 'Claude',
  color: '#D97757',
  hat: 'none',
  accessory: 'none',
  size: 5,
  speed: 5,
  behavior: 'wander',
  layer: 'above',
  sound: true,
  volume: 5,
  voice: 'normal',
};
let settingsFile;
let settings = { ...DEFAULTS };

function loadSettings() {
  settingsFile = path.join(app.getPath('userData'), 'settings.json');
  try {
    settings = cleanSettings(JSON.parse(fs.readFileSync(settingsFile, 'utf8')));
  } catch {
    settings = { ...DEFAULTS };
  }
}
function saveSettings() {
  try {
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error('Could not save settings', e);
  }
}

// ---------- windows ----------
let buddyWin = null;
let settingsWin = null;
let tray = null;

function broadcast(channel, data) {
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send(channel, data);
}

function applyOnTop() {
  if (!buddyWin) return;
  const above = settings.layer !== 'behind';
  buddyWin.setAlwaysOnTop(above, 'floating');
  if (isMac) buddyWin.setVisibleOnAllWorkspaces(above, { visibleOnFullScreen: true });
  // "Behind" is a normal window: your other windows cover him, and clicking him brings him forward.
  if (!above && buddyWin.isFocused()) buddyWin.blur();
}

function createBuddyWindow() {
  const wa = screen.getPrimaryDisplay().workArea;
  buddyWin = new BrowserWindow({
    width: 160,
    height: 170,
    x: Math.round(wa.x + wa.width / 2 - 80),
    y: Math.round(wa.y + wa.height - 170),
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    skipTaskbar: false,
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    backgroundColor: '#00000000',
    title: 'Claude Buddy',
    acceptFirstMouse: true, // first click on him counts even when another app is active
    webPreferences: {
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  applyOnTop();
  // Clicks on the see-through parts fall through to whatever is behind him.
  // (Linux can't forward mouse moves, so there the small window just stays clickable.)
  if (!isLinux) buddyWin.setIgnoreMouseEvents(true, { forward: true });
  buddyWin.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  buddyWin.on('closed', () => {
    buddyWin = null;
    app.quit();
  });
}

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 400,
    height: 800,
    useContentSize: true,
    resizable: true,
    minWidth: 360,
    minHeight: 400,
    title: 'Customize your buddy',
    backgroundColor: '#FAF6F1',
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  settingsWin.setMenuBarVisibility(false);
  settingsWin.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  settingsWin.on('closed', () => (settingsWin = null));
}

// ---------- tray / menus ----------
function buddyBitmap(scale, size, scaleFactor = 2) {
  // Draws the buddy (no hat) into a BGRA bitmap for the tray icon.
  const buf = Buffer.alloc(size * size * 4);
  const w = Sprite.GRID_W * scale;
  const h = Sprite.FEET * scale;
  const ox = Math.floor((size - w) / 2);
  const oy = Math.floor((size - h) / 2);
  Sprite.drawBuddy((x, y, ww, hh, c) => {
    const n = parseInt(c.slice(1), 16);
    for (let py = y * scale; py < (y + hh) * scale; py++) {
      for (let px = x * scale; px < (x + ww) * scale; px++) {
        const X = px + ox, Y = py + oy;
        if (X < 0 || Y < 0 || X >= size || Y >= size) continue;
        const i = (Y * size + X) * 4;
        buf[i] = n & 255; buf[i + 1] = (n >> 8) & 255; buf[i + 2] = (n >> 16) & 255; buf[i + 3] = 255;
      }
    }
  }, { color: settings.color });
  return nativeImage.createFromBitmap(buf, { width: size, height: size, scaleFactor });
}

function menuTemplate() {
  return [
    { label: `Talk to ${settings.name}`, click: () => sendAction('chat') },
    { label: 'Customize…', click: openSettings },
    { label: 'Nap time / Wake up', click: () => sendAction('toggleSleep') },
    { label: 'Come here!', click: () => sendAction('home') },
    { label: 'Follow my cursor', type: 'checkbox', checked: settings.behavior === 'follow', click: (i) => setSetting({ behavior: i.checked ? 'follow' : 'wander' }) },
    { label: 'Stay above other windows', type: 'checkbox', checked: settings.layer !== 'behind', click: (i) => setSetting({ layer: i.checked ? 'above' : 'behind' }) },
    { label: 'Noises', type: 'checkbox', checked: settings.sound !== false, click: (i) => setSetting({ sound: i.checked }) },
    { label: 'New conversation', click: () => { sessionId = null; sendAction('newChat'); } },
    { type: 'separator' },
    { label: `Quit ${app.getName()}`, accelerator: isMac ? 'Cmd+Q' : 'Ctrl+Q', click: () => app.quit() },
  ];
}
function setSetting(patch) {
  settings = cleanSettings({ ...settings, ...patch });
  saveSettings();
  applyOnTop();
  refreshMenus();
  broadcast('settings:changed', settings);
}
function sendAction(action) {
  if (buddyWin) buddyWin.webContents.send('action', action);
}
function refreshMenus() {
  if (tray) {
    tray.setImage(buddyBitmap(2, 32));
    tray.setContextMenu(Menu.buildFromTemplate(menuTemplate()));
  }
  if (isMac) {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: app.getName(), submenu: menuTemplate() },
      { role: 'editMenu' },
    ]));
  } else {
    Menu.setApplicationMenu(null);
  }
}
function createTray() {
  try {
    tray = new Tray(buddyBitmap(2, 32));
    tray.setToolTip('Claude Buddy');
    tray.on('click', () => { if (isWin) sendAction('home'); });
  } catch (e) {
    console.warn('No tray icon available; use the right-click menu on the buddy to quit.', e.message);
    tray = null;
  }
  refreshMenus();
}

// ---------- talking to Claude Code ----------
let sessionId = null;
let child = null;

function findClaude() {
  const home = os.homedir();
  const candidates = isWin
    ? [
        path.join(home, '.local', 'bin', 'claude.exe'),
        process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'claude.cmd'),
        process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'claude', 'claude.exe'),
      ].filter(Boolean)
    : [
        path.join(home, '.local', 'bin', 'claude'),
        path.join(home, '.claude', 'local', 'claude'),
        '/opt/homebrew/bin/claude',
        '/usr/local/bin/claude',
        '/usr/bin/claude',
        path.join(home, '.npm-global', 'bin', 'claude'),
        '/snap/bin/claude',
      ];
  for (const c of candidates) {
    try { if (c && fs.statSync(c).isFile()) return c; } catch {}
  }
  // Fall back to whatever is on PATH.
  const dirs = (process.env.PATH || '').split(path.delimiter);
  const names = isWin ? ['claude.exe', 'claude.cmd'] : ['claude'];
  for (const d of dirs) for (const n of names) {
    const p = path.join(d, n);
    try { if (fs.statSync(p).isFile()) return p; } catch {}
  }
  return null;
}

function childEnv() {
  // Apps opened from the Dock / Start menu don't get the shell's PATH.
  const home = os.homedir();
  const extra = isWin
    ? [path.join(home, '.local', 'bin'), process.env.APPDATA && path.join(process.env.APPDATA, 'npm')].filter(Boolean)
    : [path.join(home, '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/snap/bin'];
  return { ...process.env, PATH: [...extra, process.env.PATH || ''].join(path.delimiter) };
}

function systemPrompt() {
  const name = String(settings.name || 'Claude').slice(0, 40);
  return `You are ${name}, a tiny pixel-art desktop buddy who runs around on the user's screen. ` +
    'You are Claude, just very small and cheerful. Keep replies short and friendly (usually 1-4 sentences) ' +
    'unless the user asks for more detail. Write plain text: no markdown headings or tables.';
}

function killChild() {
  if (!child) return;
  const c = child;
  child = null;
  try {
    if (isWin && c.pid) spawn('taskkill', ['/pid', String(c.pid), '/t', '/f'], { windowsHide: true });
    else c.kill();
  } catch {}
}

// Work out how to launch the CLI without going through a shell.
function launchCommand(bin) {
  if (isWin && bin.toLowerCase().endsWith('.cmd')) {
    // npm's claude.cmd shim just runs node on the package's cli.js; run that directly.
    const cli = path.join(path.dirname(bin), 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
    if (fs.existsSync(cli)) return { cmd: 'node', pre: [cli], shell: false };
    return { cmd: `"${bin}"`, pre: [], shell: true };
  }
  return { cmd: bin, pre: [], shell: false };
}

function ask(id, prompt) {
  killChild();
  const send = (ch, data) => { if (buddyWin) buddyWin.webContents.send(ch, { id, ...data }); };

  const bin = findClaude();
  if (!bin) {
    send('claude:done', { error: "I can't find Claude Code on this computer. Install it from claude.com/claude-code, sign in once with `claude`, then try again!" });
    return;
  }

  const workDir = path.join(app.getPath('userData'), 'chat');
  fs.mkdirSync(workDir, { recursive: true });

  const resumed = !!sessionId;
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    '--tools', '', '--append-system-prompt', systemPrompt()];
  if (sessionId) args.push('--resume', sessionId);

  const launch = launchCommand(bin);
  // Only the last-resort shell path needs quoting; the name is already limited to safe characters.
  const finalArgs = launch.shell ? args.map((a) => `"${a.replace(/["%^&|<>!]/g, '')}"`) : [...launch.pre, ...args];
  let proc;
  try {
    proc = spawn(launch.cmd, finalArgs, { cwd: workDir, env: childEnv(), shell: launch.shell, windowsHide: true });
  } catch (e) {
    send('claude:done', { error: 'Could not start Claude Code: ' + e.message });
    return;
  }
  child = proc;
  proc.stdout.setEncoding('utf8');
  proc.stderr.setEncoding('utf8');

  let buf = '';
  let gotDeltas = false;
  let finished = false;
  let stderr = '';
  const finish = (data) => {
    if (finished) return;
    finished = true;
    if (data.error && resumed) sessionId = null; // don't keep resuming a broken conversation
    send('claude:done', data);
  };

  const handleLine = (raw) => {
    const line = raw.trim();
    if (!line) return;
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    if (msg.session_id) sessionId = msg.session_id;
    if (msg.type === 'stream_event' && msg.event?.type === 'content_block_delta' && msg.event.delta?.type === 'text_delta') {
      gotDeltas = true;
      send('claude:chunk', { text: msg.event.delta.text });
    } else if (msg.type === 'assistant' && !gotDeltas) {
      const text = (msg.message?.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
      if (text) send('claude:chunk', { text });
    } else if (msg.type === 'result') {
      if (msg.is_error) finish({ error: String(msg.result || 'Something went wrong.') });
      else finish({});
    }
  };

  proc.stdout.on('data', (d) => {
    if (child !== proc) return; // a newer question replaced this one
    buf += d;
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      handleLine(line);
    }
  });
  proc.stderr.on('data', (d) => { stderr += d; });
  proc.stdin.on('error', () => {});
  proc.stdin.end(prompt);
  proc.on('error', (e) => finish({ error: 'Could not start Claude Code: ' + e.message }));
  proc.on('close', (code) => {
    const current = child === proc;
    if (current) child = null;
    if (!current) return; // replaced or cancelled; the renderer has moved on
    if (buf.trim()) handleLine(buf);
    buf = '';
    if (code && !finished) {
      const hint = /log ?in|auth/i.test(stderr) ? ' Try running `claude` in a terminal once to sign in.'
        : /git-bash|bash\.exe/i.test(stderr) ? ' Claude Code on Windows needs Git for Windows (git-scm.com).' : '';
      finish({ error: (stderr.trim().split('\n').pop() || `Claude Code stopped (code ${code}).`) + hint });
    }
    finish(gotDeltas ? {} : { error: finished ? undefined : 'No reply came back. Try again?' });
  });
}

// ---------- IPC ----------
ipcMain.handle('settings:get', () => settings);
function cleanSettings(raw) {
  const out = { ...DEFAULTS };
  const r = raw && typeof raw === 'object' ? raw : {};
  const name = String(r.name ?? DEFAULTS.name).replace(/[^\p{L}\p{N} _.'-]/gu, '').trim().slice(0, 24);
  out.name = name || DEFAULTS.name;
  if (/^#[0-9a-f]{6}$/i.test(r.color)) out.color = r.color;
  if (Sprite.HATS.includes(r.hat)) out.hat = r.hat;
  if (Sprite.ACCESSORIES.includes(r.accessory)) out.accessory = r.accessory;
  const num = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.round(+v))) : d);
  out.size = num(r.size, 3, 9, DEFAULTS.size);
  out.speed = num(r.speed, 1, 10, DEFAULTS.speed);
  if (['wander', 'follow', 'stay', 'sleepy'].includes(r.behavior)) out.behavior = r.behavior;
  out.layer = r.layer === 'behind' || r.layer === 'above' ? r.layer : r.onTop === false ? 'behind' : 'above';
  out.sound = r.sound === undefined ? DEFAULTS.sound : !!r.sound;
  out.volume = num(r.volume, 0, 10, DEFAULTS.volume);
  if (['squeaky', 'normal', 'deep'].includes(r.voice)) out.voice = r.voice;
  return out;
}

ipcMain.on('settings:set', (_e, patch) => {
  settings = cleanSettings({ ...settings, ...patch });
  saveSettings();
  applyOnTop();
  refreshMenus();
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed() && w.webContents !== _e.sender) w.webContents.send('settings:changed', settings);
  }
});
ipcMain.on('settings:reset', () => {
  settings = { ...DEFAULTS };
  saveSettings();
  applyOnTop();
  refreshMenus();
  broadcast('settings:changed', settings);
});
ipcMain.handle('workArea', (_e, pt) => {
  const d = pt ? screen.getDisplayNearestPoint({ x: Math.round(pt.x), y: Math.round(pt.y) }) : screen.getPrimaryDisplay();
  return d.workArea;
});
ipcMain.on('win:bounds', (_e, b) => {
  if (!buddyWin) return;
  buddyWin.setBounds({ x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) });
});
// Click-through: the window ignores the mouse except over the buddy and his bubble.
// We watch the real cursor here (instead of relying on forwarded mouse moves),
// so it keeps working when he's behind other windows or the app isn't active.
let hitAreas = { rects: [], hold: false };
let interactive = false;
ipcMain.on('win:hit', (_e, hit) => { if (hit && Array.isArray(hit.rects)) hitAreas = hit; });
function pollCursor() {
  if (!buddyWin || buddyWin.isDestroyed() || isLinux) return;
  const p = screen.getCursorScreenPoint();
  const b = buddyWin.getBounds();
  const x = p.x - b.x, y = p.y - b.y;
  const inside = hitAreas.hold || hitAreas.rects.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  if (inside !== interactive) {
    interactive = inside;
    buddyWin.setIgnoreMouseEvents(!inside, { forward: true });
  }
}
ipcMain.handle('cursor', () => screen.getCursorScreenPoint());
ipcMain.on('win:focus', () => {
  if (!buddyWin) return;
  if (isMac) app.focus({ steal: true });
  buddyWin.moveTop();
  buddyWin.focus();
});
ipcMain.on('menu', () => {
  if (buddyWin) Menu.buildFromTemplate(menuTemplate()).popup({ window: buddyWin });
});
ipcMain.on('claude:ask', (_e, { id, prompt }) => ask(id, String(prompt || '')));
ipcMain.on('claude:cancel', killChild);
ipcMain.on('claude:newChat', () => { sessionId = null; });
ipcMain.on('openSettings', openSettings);
ipcMain.on('quit', () => app.quit());

// ---------- lifecycle ----------
app.on('web-contents-created', (_e, wc) => {
  wc.on('will-navigate', (e) => e.preventDefault());
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
});

app.whenReady().then(() => {
  loadSettings();
  if (isMac && app.dock) app.dock.setIcon(buddyBitmap(28, 512, 1));
  const start = () => { createBuddyWindow(); createTray(); setInterval(pollCursor, 30); };
  // Linux compositors need a moment before transparent windows work reliably.
  if (isLinux) setTimeout(start, 400); else start();
  screen.on('display-metrics-changed', () => sendAction('screenChanged'));
});
app.on('second-instance', () => sendAction('home'));
app.on('window-all-closed', () => app.quit());
app.on('before-quit', killChild);
