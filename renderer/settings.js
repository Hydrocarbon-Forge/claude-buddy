/* global BuddySprite */
(async function () {
  const api = window.buddy;
  const { drawBuddy, TOP, FEET, GRID_W, HATS, ACCESSORIES } = BuddySprite;
  let s = await api.getSettings();

  const COLORS = ['#D97757', '#E8A33D', '#E05C8A', '#9B6BDF', '#4C8DF6', '#3FB59A', '#6BBF59', '#8A8F98', '#3A3A3A', '#F2EBDD'];
  const LABELS = {
    none: 'None', party: 'Party hat', crown: 'Crown', wizard: 'Wizard', tophat: 'Top hat', beanie: 'Beanie', cowboy: 'Cowboy',
    sunglasses: 'Sunglasses', bowtie: 'Bow tie', scarf: 'Scarf', flower: 'Flower',
    wander: 'Run around', follow: 'Follow cursor', stay: 'Stay put', sleepy: 'Sleepy',
    above: 'Above windows', behind: 'Behind windows', on: 'On', off: 'Off',
    squeaky: 'Squeaky', normal: 'Normal', deep: 'Deep',
  };
  const SPEED = ['', 'Snail', 'Slow', 'Slow', 'Easy', 'Normal', 'Normal', 'Quick', 'Fast', 'Zoomy', 'Zoomy!'];

  const $ = (id) => document.getElementById(id);
  const set = (patch) => { s = { ...s, ...patch }; api.setSettings(patch); render(); };

  function chips(el, items, key) {
    el.innerHTML = '';
    items.forEach((v) => {
      const b = document.createElement('button');
      const cur = key === '_sound' ? (s.sound !== false ? 'on' : 'off') : s[key];
      b.className = 'chip' + (cur === v ? ' on' : '');
      b.textContent = LABELS[v] || v;
      b.onclick = () => {
        set(key === '_sound' ? { sound: v === 'on' } : { [key]: v });
        if (key === 'voice' || (key === '_sound' && v === 'on')) window.BuddySound.play('hi');
      };
      el.appendChild(b);
    });
  }
  const pick = document.createElement('input');
  pick.type = 'color';
  pick.title = 'Pick any color';
  pick.oninput = () => set({ color: pick.value });
  function swatches() {
    const el = $('colors');
    el.querySelectorAll('.sw').forEach((b) => b.remove());
    COLORS.forEach((c) => {
      const b = document.createElement('button');
      b.className = 'sw' + (s.color.toLowerCase() === c.toLowerCase() ? ' on' : '');
      b.style.background = c;
      b.title = c;
      b.onclick = () => set({ color: c });
      el.insertBefore(b, pick.parentNode === el ? pick : null);
    });
    if (pick.parentNode !== el) el.appendChild(pick);
    if (document.activeElement !== pick) pick.value = s.color;
  }

  const pv = $('pv');
  const ctx = pv.getContext('2d');
  let frame = 0;
  function preview() {
    const sc = Math.max(3, Math.min(7, s.size));
    const w = GRID_W * sc, h = (FEET - TOP) * sc;
    const dpr = window.devicePixelRatio || 1;
    pv.width = w * dpr; pv.height = h * dpr;
    pv.style.width = w + 'px'; pv.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawBuddy((x, y, ww, hh, c) => { ctx.fillStyle = c; ctx.fillRect(x * sc, (y - TOP) * sc, ww * sc, hh * sc); },
      { color: s.color, hat: s.hat, accessory: s.accessory, pose: s.behavior === 'sleepy' ? 'sleep' : 'walk', frame });
  }
  setInterval(() => { frame++; preview(); }, 220);

  function render() {
    document.documentElement.style.setProperty('--accent', s.color);
    if (document.activeElement !== $('name')) $('name').value = s.name;
    swatches();
    chips($('hats'), HATS, 'hat');
    chips($('accessories'), ACCESSORIES, 'accessory');
    chips($('behaviors'), ['wander', 'follow', 'stay', 'sleepy'], 'behavior');
    chips($('layers'), ['above', 'behind'], 'layer');
    chips($('sounds'), ['on', 'off'], '_sound');
    chips($('voices'), ['squeaky', 'normal', 'deep'], 'voice');
    $('volume').value = s.volume;
    $('volumeVal').textContent = s.volume === 0 ? 'Muted' : s.volume <= 3 ? 'Quiet' : s.volume <= 7 ? 'Medium' : 'Loud';
    window.BuddySound.configure(s);
    $('size').value = s.size;
    $('sizeVal').textContent = ['', '', '', 'Tiny', 'Small', 'Medium', 'Big', 'Bigger', 'Huge', 'Giant'][s.size] || '';
    $('speed').value = s.speed;
    $('speedVal').textContent = SPEED[s.speed] || '';
    preview();
  }

  $('name').addEventListener('input', (e) => { s.name = e.target.value; api.setSettings({ name: e.target.value.trim() || 'Claude' }); });
  $('size').addEventListener('input', (e) => set({ size: Number(e.target.value) }));
  $('speed').addEventListener('input', (e) => set({ speed: Number(e.target.value) }));
  $('volume').addEventListener('input', (e) => set({ volume: Number(e.target.value) }));
  $('volume').addEventListener('change', () => window.BuddySound.play('boop'));
  $('reset').onclick = () => api.resetSettings();
  $('done').onclick = () => window.close();
  api.onSettings((ns) => { s = ns; render(); });

  render();
})();
