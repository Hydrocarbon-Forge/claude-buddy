// Little made-up Claude noises, synthesized on the fly (no sound files).
(function () {
  let ac = null;
  let master = null;
  const cfg = { enabled: true, volume: 5, voice: 'normal' };
  const VOICE = { squeaky: 760, normal: 500, deep: 270 };
  let lastBlip = 0;

  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain();
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    master.gain.value = (cfg.volume / 10) * 0.35;
    return ac;
  }

  // One tone that slides from f1 to f2.
  function tone(f1, f2, dur, { type = 'triangle', at = 0, gain = 1 } = {}) {
    const a = ctx();
    if (!a) return;
    const t = a.currentTime + at;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  const base = () => VOICE[cfg.voice] || VOICE.normal;
  const SOUNDS = {
    boop: () => tone(base() * 1.0, base() * 1.5, 0.09),
    hi: () => { tone(base() * 1.1, base() * 1.6, 0.08); tone(base() * 1.6, base() * 2.2, 0.1, { at: 0.09 }); },
    hmm: () => tone(base() * 0.8, base() * 0.7, 0.28, { type: 'sine', gain: 0.8 }),
    squeak: () => tone(base() * 1.6, base() * 2.6, 0.07, { type: 'square', gain: 0.35 }),
    thud: () => tone(base() * 0.5, base() * 0.3, 0.12, { type: 'sine' }),
    ding: () => { tone(base() * 2, base() * 2, 0.12, { type: 'sine' }); tone(base() * 2.5, base() * 2.5, 0.18, { type: 'sine', at: 0.1 }); },
    snore: () => tone(base() * 0.32, base() * 0.24, 0.7, { type: 'sine', gain: 0.5 }),
    chirp: () => {
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const f = base() * (1 + Math.random() * 0.8);
        tone(f, f * (Math.random() < 0.5 ? 1.3 : 0.8), 0.06, { at: i * 0.08 });
      }
    },
  };

  window.BuddySound = {
    configure(s) {
      cfg.enabled = s.sound !== false;
      cfg.volume = Number.isFinite(+s.volume) ? +s.volume : 5;
      cfg.voice = s.voice || 'normal';
    },
    play(name) {
      if (!cfg.enabled || cfg.volume <= 0) return;
      try { (SOUNDS[name] || (() => {}))(); } catch {}
    },
    // Animal-crossing-style babble while he "talks": one blip per few letters.
    babble(text) {
      if (!cfg.enabled || cfg.volume <= 0) return;
      const now = performance.now();
      if (now - lastBlip < 70) return;
      const ch = text.replace(/\s/g, '').slice(-1);
      if (!ch) return;
      lastBlip = now;
      const f = base() * (0.85 + ((ch.charCodeAt(0) * 7) % 11) / 18);
      try { tone(f, f * 1.05, 0.05, { type: 'square', gain: 0.25 }); } catch {}
    },
  };
})();
