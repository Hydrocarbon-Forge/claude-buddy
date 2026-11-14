// Claude Buddy pixel art. Shared by the buddy window, the customize window
// and the icon generator, so it only talks to a tiny `plot` function.
//
// Grid: 16 pixels wide. y = 0 is the top of his body, hats go into negative y,
// his feet touch the ground at y = 11 (exclusive).
(function (root) {
  const GRID_W = 16;
  const TOP = -7; // highest row a hat can reach
  const FEET = 11; // row just below his feet

  function hexToRgb(hex) {
    const h = String(hex || '#D97757').replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex([r, g, b]) {
    return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  function shade(hex, f) {
    const c = hexToRgb(hex);
    return rgbToHex(f < 1 ? c.map((v) => v * f) : c.map((v) => v + (255 - v) * (f - 1)));
  }

  const HATS = {
    none: () => {},
    party(r) {
      r(5, -1, 6, 1, '#4C8DF6');
      r(6, -2, 4, 1, '#F6C744');
      r(6, -3, 4, 1, '#4C8DF6');
      r(7, -4, 2, 1, '#F6C744');
      r(7, -5, 2, 1, '#4C8DF6');
      r(7, -6, 2, 1, '#FFFFFF');
    },
    crown(r) {
      r(4, -2, 8, 2, '#F2C230');
      r(4, -3, 1, 1, '#F2C230');
      r(7, -3, 2, 1, '#F2C230');
      r(11, -3, 1, 1, '#F2C230');
      r(7, -2, 2, 1, '#E0413A');
      r(5, -1, 1, 1, '#4C8DF6');
      r(10, -1, 1, 1, '#4C8DF6');
    },
    wizard(r) {
      r(3, -1, 10, 1, '#5B3E9E');
      r(5, -2, 6, 1, '#6F4CC0');
      r(6, -3, 4, 1, '#6F4CC0');
      r(7, -4, 2, 1, '#6F4CC0');
      r(7, -5, 2, 1, '#6F4CC0');
      r(8, -6, 2, 1, '#6F4CC0');
      r(7, -3, 1, 1, '#F6E05E');
      r(9, -2, 1, 1, '#F6E05E');
    },
    tophat(r) {
      r(3, -1, 10, 1, '#1E1E1E');
      r(5, -6, 6, 5, '#1E1E1E');
      r(5, -2, 6, 1, '#C0392B');
    },
    beanie(r) {
      r(4, -3, 8, 1, '#3FA34D');
      r(3, -2, 10, 1, '#3FA34D');
      r(3, -1, 10, 1, '#7BD389');
      r(7, -4, 2, 1, '#FFFFFF');
    },
    cowboy(r) {
      r(1, -1, 14, 1, '#8B5A2B');
      r(4, -3, 8, 2, '#A0522D');
      r(5, -4, 2, 1, '#A0522D');
      r(9, -4, 2, 1, '#A0522D');
      r(4, -2, 8, 1, '#5C3A1A');
    },
  };

  const ACCESSORIES = {
    none: () => {},
    sunglasses(r) {
      r(3, 2, 4, 2, '#111111');
      r(9, 2, 4, 2, '#111111');
      r(7, 2, 2, 1, '#111111');
      r(4, 2, 1, 1, '#5A5A5A');
      r(10, 2, 1, 1, '#5A5A5A');
    },
    bowtie(r) {
      r(5, 6, 2, 2, '#E0413A');
      r(9, 6, 2, 2, '#E0413A');
      r(7, 6, 2, 2, '#A82820');
    },
    scarf(r) {
      r(2, 6, 12, 1, '#4C8DF6');
      r(11, 7, 2, 3, '#4C8DF6');
      r(11, 9, 2, 1, '#2F6AD0');
    },
    flower(r) {
      r(11, -1, 1, 1, '#FF8FC7');
      r(10, 0, 1, 1, '#FF8FC7');
      r(12, 0, 1, 1, '#FF8FC7');
      r(11, 1, 1, 1, '#FF8FC7');
      r(11, 0, 1, 1, '#F6E05E');
    },
  };

  // opts: { color, hat, accessory, pose: idle|walk|run|sleep|think|wave|talk,
  //         frame, blink, look (-1, 0, 1), facing (1 right, -1 left) }
  function drawBuddy(plot, opts) {
    const o = Object.assign({ color: '#D97757', hat: 'none', accessory: 'none', pose: 'idle', frame: 0, look: 0, facing: 1 }, opts);
    const body = o.color;
    const dark = shade(body, 0.72);
    const light = shade(body, 1.25);
    const eye = '#1A1410';
    const sitting = o.pose === 'sleep';
    const dy = sitting ? 2 : 0;
    const flip = o.facing < 0;
    const r = (x, y, w, h, c) => plot(flip ? GRID_W - x - w : x, y + dy, w, h, c);
    const look = flip ? -o.look : o.look;

    // legs
    const step = o.frame % 2;
    const moving = o.pose === 'walk' || o.pose === 'run';
    [3, 5, 10, 12].forEach((x, i) => {
      if (sitting) return r(x, 8, 1, 1, dark);
      const lifted = moving && (i % 2 === step);
      r(x, 8, 1, lifted ? 2 : 3, dark);
    });

    // body
    r(2, 0, 12, 8, body);
    r(2, 7, 12, 1, dark);
    r(3, 1, 2, 1, light);

    // arms
    if (o.pose === 'wave') {
      r(0, 3, 2, 2, body);
      if (step) { r(14, 1, 2, 2, body); } else { r(14, 0, 1, 2, body); r(15, -1, 1, 2, body); }
    } else if (moving) {
      r(0, 3 + step, 2, 2, body);
      r(14, 4 - step, 2, 2, body);
    } else {
      r(0, 3, 2, 2, body);
      r(14, 3, 2, 2, body);
    }

    // eyes
    if (sitting || o.blink) {
      r(4, 3, 2, 1, eye);
      r(10, 3, 2, 1, eye);
    } else if (o.pose === 'think') {
      r(4, 2, 1, 1, eye);
      r(11, 2, 1, 1, eye);
    } else {
      r(4 + look, 2, 1, 2, eye);
      r(11 + look, 2, 1, 2, eye);
    }

    // mouth
    if (o.pose === 'talk' && step) r(7, 5, 2, 1, dark);
    if (o.pose === 'wave') r(7, 5, 2, 1, dark);

    (ACCESSORIES[o.accessory] || ACCESSORIES.none)(r);
    (HATS[o.hat] || HATS.none)(r);
  }

  root.BuddySprite = {
    GRID_W, TOP, FEET, drawBuddy, shade,
    HATS: Object.keys(HATS), ACCESSORIES: Object.keys(ACCESSORIES),
  };
  if (typeof module !== 'undefined') module.exports = root.BuddySprite;
})(typeof window !== 'undefined' ? window : globalThis);
