// Fake `window.buddy` API so the real buddy page can be rendered for screenshots.
const { ipcRenderer } = require('electron');

const settings = JSON.parse(process.argv.find((a) => a.startsWith('--shot-settings=')).slice(16));
const W = 354, H = 560;
let onChunk, onDone;
const REPLY = "Hi! I'm a tiny Claude who lives on your screen. Ask me anything, drag me around, or let me nap. Zzz… just kidding, I'm wide awake! 🧡";

window.buddy = {
  platform: 'darwin',
  getSettings: async () => settings,
  setSettings: () => {}, resetSettings: () => {},
  onSettings: () => {},
  workArea: async () => ({ x: 0, y: 0, width: W, height: H }),
  cursor: async () => ({ x: 0, y: 0 }),
  setBounds: () => {}, setHit: () => {}, focus: () => {}, menu: () => {},
  onAction: () => {},
  ask: (id) => {
    let i = 0;
    const t = setInterval(() => {
      if (i >= REPLY.length) { clearInterval(t); onDone({ id }); return; }
      onChunk({ id, text: REPLY.slice(i, i + 6) }); i += 6;
    }, 15);
  },
  cancel: () => {}, newChat: () => {},
  onChunk: (fn) => { onChunk = fn; }, onDone: (fn) => { onDone = fn; },
  openSettings: () => {}, quit: () => {},
};
window.__shots = { ipcRenderer };
