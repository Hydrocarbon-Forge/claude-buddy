/* global BuddySprite */
(async function () {
  const api = window.buddy;
  const { drawBuddy, TOP, FEET, GRID_W } = BuddySprite;
  const sfx = window.BuddySound;

  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const bubble = document.getElementById('bubble');
  const tail = document.getElementById('tail');
  const log = document.getElementById('log');
  const form = document.getElementById('askForm');
  const input = document.getElementById('prompt');
  const sendBtn = document.getElementById('send');
  const nameEl = document.getElementById('buddyName');

  const BW = 330; // bubble width
  const BH = 300; // bubble height

  let settings = await api.getSettings();
  let wa = await api.workArea();

  // Buddy state. (fx, fy) is the screen point between his feet.
  const st = {
    fx: wa.x + wa.width / 2,
    fy: wa.y + wa.height - 4,
    tx: 0, ty: 0,
    mode: 'idle', // idle | walk | run | sleep | wave | drag
    until: 0,
    facing: 1,
    look: 0,
    frame: 0,
    frameAt: 0,
    blinkUntil: 0,
    nextBlink: 0,
    open: false,
    thinking: false,
    talkingUntil: 0,
    unread: false,
  };
  let win = { x: 0, y: 0, w: 0, h: 0 };
  let mouse = null; // last known screen position of the pointer
  let over = false;
  let drag = null;

  // ---------- geometry ----------
  const scale = () => Math.max(2, Math.min(10, Math.round(settings.size || 5)));
  const spriteH = () => (FEET - TOP) * scale();
  function compactSize() {
    const s = scale();
    return { w: GRID_W * s + 48, h: spriteH() + 44 };
  }
  function frameSize() {
    const c = compactSize();
    if (!st.open) return c;
    return { w: Math.max(c.w, BW + 24), h: spriteH() + 30 + BH };
  }
  function clampBuddy() {
    const c = compactSize();
    const f = frameSize();
    st.fx = Math.min(Math.max(st.fx, wa.x + c.w / 2), wa.x + wa.width - c.w / 2);
    st.fy = Math.min(Math.max(st.fy, wa.y + f.h - 2), wa.y + wa.height - 2);
  }
  function layout() {
    const f = frameSize();
    let x = st.fx - f.w / 2;
    x = Math.min(Math.max(x, wa.x), wa.x + wa.width - f.w);
    const y = st.fy - f.h + 2;
    const next = { x: Math.round(x), y: Math.round(y), w: Math.round(f.w), h: Math.round(f.h) };
    if (next.x !== win.x || next.y !== win.y || next.w !== win.w || next.h !== win.h) {
      const resized = next.w !== win.w || next.h !== win.h;
      win = next;
      api.setBounds({ x: win.x, y: win.y, width: win.w, height: win.h });
      if (resized) sizeCanvas();
    }
    if (st.open) {
      const lx = st.fx - win.x;
      const ly = st.fy - win.y;
      const left = Math.min(Math.max(lx - BW / 2, 8), win.w - BW - 8);
      const top = Math.max(4, ly - spriteH() - 16 - BH);
      bubble.style.left = left + 'px';
      bubble.style.top = top + 'px';
      tail.style.left = Math.min(Math.max(lx - left, 24), BW - 24) + 'px';
    }
  }
  function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = win.w * dpr;
    canvas.height = win.h * dpr;
    canvas.style.width = win.w + 'px';
    canvas.style.height = win.h + 'px';
  }
  function spriteBox() {
    const s = scale();
    const lx = st.fx - win.x;
    const ly = st.fy - win.y;
    const sitting = st.mode === 'sleep' ? 2 * s : 0;
    return { x: lx - (GRID_W / 2) * s, y: ly - (FEET - TOP) * s + sitting, w: GRID_W * s, h: (FEET - TOP) * s - sitting };
  }

  // ---------- drawing ----------
  function pose() {
    if (st.mode === 'drag') return 'wave';
    if (st.mode === 'sleep') return 'sleep';
    if (st.thinking) return 'think';
    if (performance.now() < st.talkingUntil) return 'talk';
    if (st.mode === 'walk' || st.mode === 'run' || st.mode === 'wave') return st.mode;
    return 'idle';
  }
  function draw(now) {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, win.w, win.h);
    const s = scale();
    const lx = Math.round(st.fx - win.x);
    const ly = Math.round(st.fy - win.y);
    const ox = lx - (GRID_W / 2) * s;
    const oy = ly - FEET * s;
    const p = pose();

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(lx, ly - 1, 6 * s, 1.2 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    drawBuddy((x, y, w, h, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(ox + x * s, oy + y * s, w * s, h * s);
    }, {
      color: settings.color,
      hat: settings.hat,
      accessory: settings.accessory,
      pose: p,
      frame: st.frame,
      blink: now < st.blinkUntil,
      look: st.look,
      facing: st.facing,
    });

    const headY = oy + TOP * s - 4;
    ctx.textAlign = 'center';
    if (p === 'sleep') {
      const t = (now / 900) % 3;
      ctx.fillStyle = '#5B6B8C';
      ctx.font = `bold ${Math.max(10, s * 2.4)}px sans-serif`;
      for (let i = 0; i < 3; i++) {
        const k = (t + i) % 3;
        ctx.globalAlpha = 1 - k / 3;
        ctx.fillText('z', lx + (5 + k * 3) * s * 0.6, oy - k * s * 2.2);
      }
      ctx.globalAlpha = 1;
    } else if (st.thinking && !st.open) {
      ctx.fillStyle = '#8A7F76';
      for (let i = 0; i < 3; i++) {
        const on = Math.floor(now / 300) % 3 === i;
        ctx.beginPath();
        ctx.arc(lx + (i - 1) * s * 2, headY - (on ? 3 : 0), Math.max(2, s * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (st.unread && !st.open) {
      ctx.fillStyle = settings.color;
      ctx.font = `bold ${Math.max(12, s * 3)}px sans-serif`;
      ctx.fillText('!', lx, headY + Math.sin(now / 200) * 2);
    }
  }

  // ---------- behaviour ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  function setMode(mode, ms) {
    if (mode === 'wave' && st.mode !== 'wave') sfx.play('hi');
    st.mode = mode;
    st.until = performance.now() + ms;
  }

  // Follow-cursor mode: keep asking where the mouse is.
  let cursor = null;
  let cursorWaAt = 0;
  setInterval(async () => {
    if (settings.behavior !== 'follow') { cursor = null; return; }
    try { cursor = await api.cursor(); } catch { cursor = null; }
    const t = performance.now();
    if (cursor && t - cursorWaAt > 1000) { cursorWaAt = t; wa = await api.workArea(cursor); }
  }, 80);
  function followCursor() {
    if (!cursor || st.open || st.mode === 'drag' || st.mode === 'sleep') return false;
    // Stand just beside and below the pointer, not right under it.
    const side = cursor.x >= st.fx ? -1 : 1;
    const tx = cursor.x + side * (GRID_W * scale() * 0.5 + 24);
    const ty = cursor.y + FEET * scale() + 16;
    const dist = Math.hypot(tx - st.fx, ty - st.fy);
    st.look = cursor.x > st.fx + 10 ? 1 : cursor.x < st.fx - 10 ? -1 : 0;
    if (dist > 30) {
      st.tx = tx; st.ty = ty;
      st.facing = tx >= st.fx ? 1 : -1;
      const mode = dist > 260 ? 'run' : 'walk';
      if (st.mode !== mode) { st.mode = mode; st.until = performance.now() + 60000; }
    } else if (st.mode === 'walk' || st.mode === 'run') {
      st.facing = cursor.x >= st.fx ? 1 : -1;
      setMode('idle', 1e9);
      if (Math.random() < 0.3) sfx.play('chirp');
    }
    return true;
  }
  function pickNext() {
    const b = settings.behavior;
    const r = Math.random();
    if (Math.random() < 0.12) sfx.play('chirp');
    if (b === 'follow') return setMode('idle', 1e9);
    if (b === 'sleepy') {
      if (r < 0.6) return setMode('sleep', rand(15000, 40000));
      if (r < 0.8) return walkSomewhere(false);
      return setMode('idle', rand(3000, 7000));
    }
    if (b === 'stay') {
      if (r < 0.15) return setMode('wave', 1600);
      if (r < 0.25) return setMode('sleep', rand(6000, 15000));
      st.look = Math.floor(rand(-1, 2));
      return setMode('idle', rand(2500, 6000));
    }
    // wander
    if (r < 0.55) return walkSomewhere(false);
    if (r < 0.7) return walkSomewhere(true);
    if (r < 0.78) return setMode('wave', 1600);
    if (r < 0.84) return setMode('sleep', rand(8000, 20000));
    st.look = Math.floor(rand(-1, 2));
    return setMode('idle', rand(1500, 4500));
  }
  function walkSomewhere(run) {
    const c = compactSize();
    st.tx = rand(wa.x + c.w / 2, wa.x + wa.width - c.w / 2);
    st.ty = rand(wa.y + c.h, wa.y + wa.height - 2);
    if (Math.random() < 0.45) st.ty = wa.y + wa.height - 2; // he likes the bottom of the screen
    st.facing = st.tx >= st.fx ? 1 : -1;
    setMode(run ? 'run' : 'walk', 60000);
  }

  let last = performance.now();
  let snoreAt = 0;
  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    // animation frames
    const frameMs = st.mode === 'run' ? 90 : st.mode === 'drag' ? 120 : st.mode === 'wave' ? 220 : 180;
    if (now - st.frameAt > frameMs) { st.frame++; st.frameAt = now; }
    if (now > st.nextBlink) { st.blinkUntil = now + 130; st.nextBlink = now + rand(2500, 6000); }

    const following = settings.behavior === 'follow' && followCursor();
    if (st.mode === 'sleep' && now > snoreAt) { snoreAt = now + 2600; sfx.play('snore'); }

    if (st.mode === 'walk' || st.mode === 'run') {
      const speed = (settings.speed || 5) * 18 * (st.mode === 'run' ? 2.2 : 1);
      const dx = st.tx - st.fx, dy = st.ty - st.fy;
      const dist = Math.hypot(dx, dy);
      const step = speed * dt;
      if (dist <= step) { st.fx = st.tx; st.fy = st.ty; if (!following) setMode('idle', rand(1000, 3500)); }
      else { st.fx += (dx / dist) * step; st.fy += (dy / dist) * step; }
    } else if (st.mode !== 'drag' && !st.open && now > st.until) {
      pickNext();
    } else if (st.open && st.mode !== 'drag' && st.mode !== 'idle' && now > st.until) {
      setMode('idle', 1e9);
    }

    clampBuddy();
    layout();
    draw(now);
    updateHover();
    requestAnimationFrame(tick);
  }

  // ---------- mouse ----------
  function hitTest(sx, sy) {
    const x = sx - win.x, y = sy - win.y;
    const b = spriteBox();
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return 'sprite';
    if (st.open) {
      const r = bubble.getBoundingClientRect();
      if (x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 14) return 'bubble';
    }
    return null;
  }
  function updateHover() {
    if (!mouse) return;
    const hit = drag ? 'sprite' : hitTest(mouse.x, mouse.y);
    const now = !!hit;
    if (now !== over) { over = now; api.setClickThrough(!over); }
    canvas.className = drag && drag.moved ? 'grabbing' : hit === 'sprite' ? 'grab' : '';
  }
  window.addEventListener('mousemove', (e) => { mouse = { x: e.screenX, y: e.screenY }; updateHover(); });
  let pressed = false;
  document.addEventListener('pointerdown', () => { pressed = true; }, true);
  document.addEventListener('pointerup', () => { pressed = false; updateHover(); }, true);
  const leave = () => { if (!drag && !pressed) { mouse = null; if (over) { over = false; api.setClickThrough(true); } } };
  document.addEventListener('mouseleave', leave);
  window.addEventListener('blur', () => { pressed = false; leave(); });

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (hitTest(e.screenX, e.screenY) !== 'sprite') return;
    canvas.setPointerCapture(e.pointerId);
    drag = { sx: e.screenX, sy: e.screenY, fx: st.fx, fy: st.fy, moved: false, prevMode: st.mode };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.screenX - drag.sx, dy = e.screenY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) > 4) { drag.moved = true; st.mode = 'drag'; sfx.play('squeak'); }
    if (drag.moved) {
      st.fx = drag.fx + dx;
      st.fy = drag.fy + dy;
      const t = performance.now();
      if (!drag.waAt || t - drag.waAt > 250) {
        drag.waAt = t;
        api.workArea({ x: e.screenX, y: e.screenY }).then((w) => { wa = w; });
      }
      if (Math.abs(dx) > 2) st.facing = e.movementX >= 0 ? 1 : -1;
    }
  });
  async function endDrag(e, clicked) {
    if (!drag) return;
    const d = drag;
    drag = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
    if (d.moved) {
      sfx.play('thud');
      wa = await api.workArea({ x: st.fx, y: st.fy });
      setMode('idle', rand(1500, 3000));
    } else if (clicked) {
      if (st.open) sfx.play('boop');
      toggleBubble();
    } else if (st.mode === 'drag') {
      setMode('idle', 1500);
    }
    updateHover();
  }
  canvas.addEventListener('pointerup', (e) => endDrag(e, true));
  canvas.addEventListener('pointercancel', (e) => endDrag(e, false));
  canvas.addEventListener('lostpointercapture', (e) => { if (drag) endDrag(e, false); });
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (hitTest(e.screenX, e.screenY)) api.menu();
  });

  // ---------- chat bubble ----------
  let reqId = 0;
  let pendingEl = null;
  let reveal = ''; // text waiting to be typed out
  let shown = '';
  let doneData = null;
  let watchdog = null;

  function hello() {
    if (log.children.length) return;
    const el = document.createElement('div');
    el.className = 'hello';
    el.textContent = `Hi! I'm ${settings.name}. Ask me anything ✨`;
    log.appendChild(el);
  }
  function openBubble() {
    if (st.open) return;
    st.open = true;
    st.unread = false;
    if (st.mode !== 'drag') { st.facing = 1; setMode('wave', 900); }
    hello();
    clampBuddy();
    layout();
    bubble.classList.remove('hidden');
    api.focus();
    setTimeout(() => input.focus(), 30);
    log.scrollTop = log.scrollHeight;
  }
  function closeBubble() {
    if (!st.open) return;
    st.open = false;
    bubble.classList.add('hidden');
    setMode('idle', rand(1200, 2500));
  }
  function toggleBubble() { st.open ? closeBubble() : openBubble(); }

  function addMsg(cls, text) {
    const hi = log.querySelector('.hello');
    if (hi) hi.remove();
    const el = document.createElement('div');
    el.className = 'msg ' + cls;
    if (text != null) el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }
  function tidy(text) {
    // Claude sometimes uses light markdown; keep it readable as plain text.
    return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`\n]+)`/g, '$1').replace(/^#{1,6}\s+/gm, '');
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || pendingEl) return;
    addMsg('you', text);
    input.value = '';
    autoGrow();
    pendingEl = addMsg('bot');
    pendingEl.innerHTML = '<span class="dots"><span></span><span></span><span></span></span>';
    reveal = ''; shown = ''; doneData = null;
    st.thinking = true;
    sfx.play('hmm');
    if (st.mode === 'sleep') setMode('idle', 1e9);
    sendBtn.disabled = true;
    const id = ++reqId;
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      if (id === reqId && pendingEl && !doneData) {
        api.cancel();
        st.thinking = false;
        doneData = { error: 'That took too long, so I stopped. Try again?' };
      }
    }, 180000);
    api.ask(id, text);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });
  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = Math.min(80, input.scrollHeight) + 'px';
  }
  input.addEventListener('input', autoGrow);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBubble(); });
  document.getElementById('closeBubble').addEventListener('click', closeBubble);
  document.getElementById('newChat').addEventListener('click', newChat);

  function newChat() {
    clearTimeout(watchdog);
    api.cancel();
    api.newChat();
    pendingEl = null; reveal = ''; shown = ''; doneData = null;
    st.thinking = false;
    sendBtn.disabled = false;
    log.innerHTML = '';
    hello();
    input.focus();
  }

  api.onChunk(({ id, text }) => {
    if (id !== reqId || !pendingEl) return;
    st.thinking = false;
    reveal += text;
  });
  api.onDone(({ id, error }) => {
    if (id !== reqId || !pendingEl) return;
    st.thinking = false;
    doneData = { error };
  });

  // typewriter: reveals streamed text a few characters at a time
  setInterval(() => {
    if (!pendingEl) return;
    if (shown.length < reveal.length) {
      const n = Math.max(2, Math.ceil((reveal.length - shown.length) / 12));
      const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
      shown = reveal.slice(0, shown.length + n);
      pendingEl.textContent = tidy(shown);
      sfx.babble(shown);
      st.talkingUntil = performance.now() + 250;
      if (nearBottom) log.scrollTop = log.scrollHeight;
    } else if (doneData) {
      const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
      if (doneData.error) {
        if (!shown) pendingEl.textContent = doneData.error;
        else addMsg('bot error', doneData.error);
        if (!shown) pendingEl.classList.add('error');
      } else if (!shown) {
        pendingEl.textContent = 'Hmm, I got no words back. Try again?';
      }
      pendingEl = null;
      doneData = null;
      sendBtn.disabled = false;
      clearTimeout(watchdog);
      if (!st.open) { st.unread = true; sfx.play('ding'); }
      else input.focus();
      if (nearBottom) log.scrollTop = log.scrollHeight;
    }
  }, 30);

  // ---------- settings & menu actions ----------
  function applySettings(s) {
    settings = s;
    sfx.configure(s);
    nameEl.textContent = s.name || 'Claude';
    document.documentElement.style.setProperty('--accent', s.color);
    const hi = log.querySelector('.hello');
    if (hi) hi.textContent = `Hi! I'm ${s.name}. Ask me anything ✨`;
    if (s.behavior !== 'wander' && s.behavior !== 'follow' && (st.mode === 'walk' || st.mode === 'run')) setMode('idle', 1000);
    if (s.behavior !== 'follow' && st.until > performance.now() + 1e8) setMode('idle', 1000);
  }
  api.onSettings(applySettings);
  api.onAction(async (a) => {
    if (a === 'chat') openBubble();
    else if (a === 'newChat') newChat();
    else if (a === 'toggleSleep') {
      if (st.mode === 'sleep') { setMode('wave', 1200); }
      else { if (st.open) closeBubble(); setMode('sleep', settings.behavior === 'sleepy' ? 60000 : 30000); }
    } else if (a === 'home') {
      wa = await api.workArea();
      st.fx = wa.x + wa.width / 2;
      st.fy = wa.y + wa.height - 2;
      st.facing = 1;
      setMode('wave', 1800);
    } else if (a === 'screenChanged') {
      wa = await api.workArea({ x: st.fx, y: st.fy });
    }
  });

  applySettings(settings);
  setMode('wave', 1800);
  layout();
  requestAnimationFrame(tick);
})();
