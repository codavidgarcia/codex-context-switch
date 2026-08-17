const { contextBridge, ipcRenderer } = require('electron');

async function invoke(channel, payload) {
  const result = await ipcRenderer.invoke(channel, payload);
  if (result?.ok) return result.value;
  const error = new Error('Context Switch operation failed.');
  error.code = result?.error?.code ?? 'UNEXPECTED_ERROR';
  throw error;
}

contextBridge.exposeInMainWorld('contextSwitch', Object.freeze({
  getStatus: () => invoke('context-switch:status'),
  apply: (settings) => invoke('context-switch:apply', {
    contextWindow: settings.contextWindow,
    compactLimit: settings.compactLimit,
  }),
  revert: () => invoke('context-switch:revert'),
  setAdvanced: (open) => ipcRenderer.send('context-switch:advanced', Boolean(open)),
}));
