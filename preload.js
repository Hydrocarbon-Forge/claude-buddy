const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('buddy', {
  platform: process.platform,
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.send('settings:set', patch),
  resetSettings: () => ipcRenderer.send('settings:reset'),
  onSettings: (fn) => ipcRenderer.on('settings:changed', (_e, s) => fn(s)),
  workArea: (pt) => ipcRenderer.invoke('workArea', pt),
  cursor: () => ipcRenderer.invoke('cursor'),
  setBounds: (b) => ipcRenderer.send('win:bounds', b),
  setHit: (hit) => ipcRenderer.send('win:hit', hit),
  focus: () => ipcRenderer.send('win:focus'),
  menu: () => ipcRenderer.send('menu'),
  onAction: (fn) => ipcRenderer.on('action', (_e, a) => fn(a)),
  ask: (id, prompt) => ipcRenderer.send('claude:ask', { id, prompt }),
  cancel: () => ipcRenderer.send('claude:cancel'),
  newChat: () => ipcRenderer.send('claude:newChat'),
  onChunk: (fn) => ipcRenderer.on('claude:chunk', (_e, d) => fn(d)),
  onDone: (fn) => ipcRenderer.on('claude:done', (_e, d) => fn(d)),
  openSettings: () => ipcRenderer.send('openSettings'),
  quit: () => ipcRenderer.send('quit'),
});
