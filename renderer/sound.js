// Claude's little voice: soft, warm, made-up babble synthesized on the fly
// (a buzzy "vocal" tone shaped by vowel filters, a bit like a tiny creature
// talking to itself). No sound files.
(function () {
  let ac = null;
  let master = null;
  let noiseBuf = null;
  const cfg = { enabled: true, volume: 5, voice: 'normal' };
  // Base pitch (Hz) and how bright the vowels are for each voice.
  const VOICES = {
    squeaky: { f0: 420, formant: 1.25 },
    normal: { f0: 290, formant: 1.1 },
    deep: { f0: 165, formant: 0.9 },
  };
  // Rough vowel formants (F1, F2) in Hz.
  const VOWELS = {
    a: [800, 1250], e: [450, 1900], i: [320, 2300], o: [500, 900], u: [330, 800], m: [260, 1000],
  };
  let lastBlip = 0;

  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain();
      // gentle warmth: roll off harsh highs
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3800;
      master.connect(lp).connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    master.gain.value = (cfg.volume / 10) * 0.9;
    return ac;
  }
  const voice = () => VOICES[cfg.voice] || VOICES.normal;

  // One syllable: pitch glides p1 -> p2 (as multiples of the base pitch), vowel v.
  function syl(v, p1, p2, dur, { at = 0, gain = 0.5, breathy = 0.15 } = {}) {
    const a = ctx();
    if (!a) return;
    const t = a.currentTime + at;
    const vc = voice();
    const [F1, F2] = VOWELS[v] || VOWELS.a;

    const src = a.createOscillator();
    src.type = 'sawtooth';
    src.frequency.setValueAtTime(vc.f0 * p1, t);
    src.frequency.exponentialRampToValueAtTime(vc.f0 * p2, t + dur);
    // a little wobble so it sounds alive
    const vib = a.createOscillator();
    const vibG = a.createGain();
    vib.frequency.value = 6;
    vibG.gain.value = vc.f0 * 0.02;
    vib.connect(vibG).connect(src.frequency);

    const out = a.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.03, dur * 0.3));
    out.gain.setValueAtTime(gain, t + dur * 0.6);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    [[F1, 6, 1], [F2, 9, 0.5]].forEach(([f, q, g]) => {
      const bp = a.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f * vc.formant;
      bp.Q.value = q;
      const gg = a.createGain();
      gg.gain.value = g * 3;
      src.connect(bp).connect(gg).connect(out);
    });
    // soft breath
    if (breathy > 0) {
      const n = a.createBufferSource();
      n.buffer = noise(a);
      const hp = a.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = F2 * vc.formant;
      hp.Q.value = 1.5;
      const ng = a.createGain();
      ng.gain.value = breathy;
      n.connect(hp).connect(ng).connect(out);
      n.start(t);
      n.stop(t + dur + 0.02);
    }
    out.connect(master);
    src.start(t);
    vib.start(t);
    src.stop(t + dur + 0.02);
    vib.stop(t + dur + 0.02);
  }
  function noise(a) {
    if (noiseBuf) return noiseBuf;
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  // Soft breathy exhale (for snoring and sighs).
  function breath(dur, { at = 0, gain = 0.25, freq = 500 } = {}) {
    const a = ctx();
    if (!a) return;
    const t = a.currentTime + at;
    const n = a.createBufferSource();
    n.buffer = noise(a);
    n.loop = true;
    const f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f).connect(g).connect(master);
    n.start(t);
    n.stop(t + dur + 0.05);
  }
  // Warm little chime for "your answer is ready".
  function chime(at = 0) {
    const a = ctx();
    if (!a) return;
    [[1.0, 0], [1.5, 0.11]].forEach(([mult, d]) => {
      const t = a.currentTime + at + d;
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = 'sine';
      o.frequency.value = voice().f0 * 3 * mult;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.62);
    });
  }

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const SOUNDS = {
    // clicked: a curious "hm?"
    boop: () => syl('m', 1.0, 1.35, 0.16, { gain: 0.45, breathy: 0 }),
    // waving: a cheerful "hi-ii!"
    hi: () => { syl('a', 1.05, 1.25, 0.1); syl('i', 1.35, 1.6, 0.16, { at: 0.1 }); },
    // thinking about your question: a thoughtful "hmmm..."
    hmm: () => syl('m', 1.0, 0.85, 0.5, { gain: 0.4, breathy: 0.05 }),
    // picked up: a surprised "whoa!"
    squeak: () => { syl('u', 1.2, 1.7, 0.08, { gain: 0.4 }); syl('o', 1.8, 1.5, 0.14, { at: 0.08, gain: 0.45 }); },
    // put down: a little "oof"
    thud: () => syl('u', 0.95, 0.7, 0.16, { gain: 0.45 }),
    // answer ready while the bubble is closed
    ding: () => { chime(); syl('o', 1.2, 1.5, 0.12, { at: 0.05, gain: 0.3 }); },
    // napping: soft breathing with a tiny hum
    snore: () => { breath(1.1, { gain: 0.18, freq: 420 }); syl('m', 0.6, 0.55, 0.5, { at: 0.2, gain: 0.12, breathy: 0 }); },
    // idle chatter: "ooh?", "hehe", "mm-hm", "aha!"
    chirp: () => pick([
      () => syl('o', 1.0, 1.4, 0.2, { gain: 0.4 }),
      () => { syl('e', 1.3, 1.25, 0.07, { gain: 0.35, breathy: 0.4 }); syl('e', 1.2, 1.1, 0.08, { at: 0.11, gain: 0.3, breathy: 0.4 }); },
      () => { syl('m', 1.0, 1.0, 0.12, { gain: 0.35, breathy: 0 }); syl('m', 1.2, 1.0, 0.16, { at: 0.15, gain: 0.35, breathy: 0 }); },
      () => { syl('a', 1.0, 1.05, 0.08); syl('a', 1.3, 1.5, 0.14, { at: 0.1 }); },
    ])(),
  };

  // Vowel for a letter, so the same words make the same sounds.
  function vowelFor(ch) {
    const c = ch.toLowerCase();
    if ('aeiou'.includes(c)) return c;
    return 'aeioua'[c.charCodeAt(0) % 6] === 'a' ? 'a' : 'aeiou'[c.charCodeAt(0) % 5];
  }

  window.BuddySound = {
    configure(s) {
      cfg.enabled = s.sound !== false;
      cfg.volume = Number.isFinite(+s.volume) ? +s.volume : 5;
      cfg.voice = VOICES[s.voice] ? s.voice : 'normal';
    },
    play(name) {
      if (!cfg.enabled || cfg.volume <= 0) return;
      try { (SOUNDS[name] || (() => {}))(); } catch {}
    },
    // Soft babble while he "talks": one syllable every few letters, with a
    // sentence-like pitch (rises on questions, settles at full stops).
    babble(text) {
      if (!cfg.enabled || cfg.volume <= 0) return;
      const now = performance.now();
      if (now - lastBlip < 95) return;
      const tail = text.slice(-3).replace(/\s/g, '');
      const ch = tail.slice(-1);
      if (!ch || !/[\p{L}\p{N}]/u.test(ch)) return;
      lastBlip = now;
      const q = /\?/.test(text.slice(-20));
      const p = 0.95 + ((ch.charCodeAt(0) * 13) % 9) / 30 + (q ? 0.15 : 0);
      try { syl(vowelFor(ch), p, p * (q ? 1.08 : 0.97), 0.075, { gain: 0.28, breathy: 0.1 }); } catch {}
    },
  };
})();
