const copy = {
  en: {
    skip: 'Skip to settings',
    loading: 'Reading config…',
    kicker: 'GPT-5.6 SOL · LOCAL CONTROL',
    title: 'Give Codex the room you choose.',
    lede: 'Set the context window and compaction line. Apply once; restore the previous setup whenever you want.',
    contextWindow: 'Context window',
    contextTokens: 'Context tokens',
    tokens: 'tokens',
    presets: 'Context presets',
    max: 'MAX',
    compactAt: 'Compact history at',
    compactNote: 'Leaves room for the answer and tool output.',
    setNinety: 'Set 90%',
    headroom: 'Headroom',
    apply: 'Apply setup',
    restore: 'Restore previous setup',
    willWrite: 'WILL WRITE',
    copy: 'Copy TOML',
    copied: 'Copied',
    file: 'File',
    modelCeiling: 'Model ceiling',
    network: 'Network',
    none: 'None',
    restart: 'After applying, restart Codex and begin a new task.',
    localFooter: 'Runs on 127.0.0.1. No telemetry. No config contents leave this device.',
    statusActive: 'Setup applied',
    statusExternal: 'Settings found',
    statusInactive: 'Not applied',
    statusConflict: 'Config changed outside the app',
    appliedToast: 'Setup applied. Restart Codex and begin a new task.',
    restoredToast: 'Previous setup restored.',
    copiedToast: 'TOML copied to the clipboard.',
    minContext: 'Context must be at least 16,000 tokens.',
    maxContext: 'GPT-5.6 Sol supports at most 1,050,000 tokens.',
    compactMinimum: 'Compaction must be at least 8,000 tokens.',
    compactBelow: 'Compaction must stay below the context window.',
    requestFailed: 'The local operation failed. Nothing else was changed.',
    conflictHelp: 'The managed lines changed outside this app. Review config.toml; the app will not overwrite them.',
  },
  es: {
    skip: 'Ir a la configuración',
    loading: 'Leyendo configuración…',
    kicker: 'GPT-5.6 SOL · CONTROL LOCAL',
    title: 'Dale a Codex el espacio que tú decidas.',
    lede: 'Define la ventana de contexto y la línea de compactación. Aplícala una vez; restaura la configuración anterior cuando quieras.',
    contextWindow: 'Ventana de contexto',
    contextTokens: 'Tokens de contexto',
    tokens: 'tokens',
    presets: 'Valores de contexto',
    max: 'MÁX',
    compactAt: 'Compactar el historial en',
    compactNote: 'Deja espacio para la respuesta y las herramientas.',
    setNinety: 'Usar 90%',
    headroom: 'Margen libre',
    apply: 'Aplicar configuración',
    restore: 'Restaurar configuración anterior',
    willWrite: 'ESCRIBIRÁ',
    copy: 'Copiar TOML',
    copied: 'Copiado',
    file: 'Archivo',
    modelCeiling: 'Límite del modelo',
    network: 'Red',
    none: 'Ninguna',
    restart: 'Después de aplicar, reinicia Codex y comienza una tarea nueva.',
    localFooter: 'Se ejecuta en 127.0.0.1. Sin telemetría. El contenido de tu configuración no sale del equipo.',
    statusActive: 'Configuración aplicada',
    statusExternal: 'Configuración detectada',
    statusInactive: 'Sin aplicar',
    statusConflict: 'El archivo cambió fuera de la app',
    appliedToast: 'Configuración aplicada. Reinicia Codex y comienza una tarea nueva.',
    restoredToast: 'Configuración anterior restaurada.',
    copiedToast: 'TOML copiado al portapapeles.',
    minContext: 'El contexto debe tener al menos 16.000 tokens.',
    maxContext: 'GPT-5.6 Sol admite como máximo 1.050.000 tokens.',
    compactMinimum: 'La compactación debe ser de al menos 8.000 tokens.',
    compactBelow: 'La compactación debe quedar por debajo de la ventana de contexto.',
    requestFailed: 'La operación local falló. No se cambió nada más.',
    conflictHelp: 'Las líneas administradas cambiaron fuera de esta app. Revisa config.toml; la app no las sobrescribirá.',
  },
};

const elements = {
  form: document.querySelector('#settingsForm'),
  contextInput: document.querySelector('#contextInput'),
  contextRange: document.querySelector('#contextRange'),
  compactInput: document.querySelector('#compactInput'),
  contextProgress: document.querySelector('#contextProgress'),
  compactProgress: document.querySelector('#compactProgress'),
  headroomOutput: document.querySelector('#headroomOutput'),
  previewContext: document.querySelector('#previewContext'),
  previewCompact: document.querySelector('#previewCompact'),
  configPreview: document.querySelector('#configPreview'),
  configPath: document.querySelector('#configPath'),
  applyButton: document.querySelector('#applyButton'),
  revertButton: document.querySelector('#revertButton'),
  ratioButton: document.querySelector('#ratioButton'),
  copyButton: document.querySelector('#copyButton'),
  languageToggle: document.querySelector('#languageToggle'),
  statusChip: document.querySelector('#statusChip'),
  statusText: document.querySelector('#statusText'),
  formMessage: document.querySelector('#formMessage'),
  toast: document.querySelector('#toast'),
  presets: [...document.querySelectorAll('[data-context]')],
};

const state = {
  language: localStorage.getItem('context-switch-language')
    ?? (navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'),
  token: null,
  status: null,
  compactWasEdited: false,
  busy: false,
  toastTimer: null,
};

function t(key) {
  return copy[state.language][key] ?? copy.en[key] ?? key;
}

function formatNumber(value) {
  return new Intl.NumberFormat(state.language === 'es' ? 'es-CO' : 'en-US').format(value);
}

function translate() {
  document.documentElement.lang = state.language;
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((node) => {
    node.setAttribute('aria-label', t(node.dataset.i18nAria));
  });
  elements.languageToggle.textContent = state.language === 'en' ? 'ES' : 'EN';
  elements.languageToggle.setAttribute(
    'aria-label',
    state.language === 'en' ? 'Cambiar idioma a español' : 'Switch language to English',
  );
  renderStatus();
  renderValues();
}

function numericValues() {
  return {
    contextWindow: elements.contextInput.valueAsNumber,
    compactLimit: elements.compactInput.valueAsNumber,
  };
}

function validate() {
  const { contextWindow, compactLimit } = numericValues();
  let message = state.status?.hasConflict ? t('conflictHelp') : '';
  if (!message && (!Number.isSafeInteger(contextWindow) || contextWindow < 16_000)) message = t('minContext');
  else if (!message && contextWindow > 1_050_000) message = t('maxContext');
  else if (!message && (!Number.isSafeInteger(compactLimit) || compactLimit < 8_000)) message = t('compactMinimum');
  else if (!message && compactLimit >= contextWindow) message = t('compactBelow');

  elements.formMessage.hidden = !message;
  elements.formMessage.textContent = message;
  elements.applyButton.disabled = Boolean(message) || state.busy || !state.token;
  return !message;
}

function renderValues() {
  const { contextWindow, compactLimit } = numericValues();
  const safeContext = Number.isFinite(contextWindow) ? Math.max(0, contextWindow) : 0;
  const safeCompact = Number.isFinite(compactLimit) ? Math.max(0, compactLimit) : 0;
  const headroom = Math.max(0, safeContext - safeCompact);
  const percentage = safeContext > 0 ? Math.round((headroom / safeContext) * 100) : 0;

  elements.contextRange.value = String(Math.min(1_050_000, safeContext));
  elements.contextProgress.value = safeContext;
  elements.compactProgress.value = Math.min(safeCompact, safeContext);
  elements.previewContext.textContent = Number.isFinite(contextWindow) ? String(contextWindow) : '—';
  elements.previewCompact.textContent = Number.isFinite(compactLimit) ? String(compactLimit) : '—';
  elements.headroomOutput.textContent = `${formatNumber(headroom)} · ${percentage}%`;
  elements.compactInput.max = String(Math.max(8_000, safeContext - 1_000));
  elements.presets.forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.context) === contextWindow));
  });
  validate();
}

function renderStatus() {
  if (!state.status) return;
  const status = state.status;
  let key = 'statusInactive';
  let chipState = 'inactive';
  if (status.hasConflict) {
    key = 'statusConflict';
    chipState = 'conflict';
  } else if (status.canRevert) {
    key = 'statusActive';
    chipState = 'active';
  } else if (status.active) {
    key = 'statusExternal';
    chipState = 'active';
  }
  elements.statusChip.dataset.state = chipState;
  elements.statusText.textContent = t(key);
  elements.revertButton.disabled = !status.canRevert || state.busy;
  elements.configPath.textContent = status.configPath;
  if (status.hasConflict) {
    elements.formMessage.hidden = false;
    elements.formMessage.textContent = t('conflictHelp');
    elements.applyButton.disabled = true;
  }
}

function setBusy(busy) {
  state.busy = busy;
  elements.contextInput.disabled = busy;
  elements.compactInput.disabled = busy;
  elements.contextRange.disabled = busy;
  elements.ratioButton.disabled = busy;
  elements.presets.forEach((button) => { button.disabled = busy; });
  renderStatus();
  validate();
}

function showToast(message) {
  clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  state.toastTimer = setTimeout(() => {
    elements.toast.hidden = true;
  }, 3600);
}

async function getStatus() {
  const response = await fetch('/api/status', { headers: { Accept: 'application/json' } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? t('requestFailed'));
  state.token = response.headers.get('x-context-switch-token');
  state.status = payload;

  const values = payload.values;
  if (payload.active) {
    elements.contextInput.value = String(values.model_context_window);
    elements.compactInput.value = String(values.model_auto_compact_token_limit);
  } else {
    elements.contextInput.value = String(payload.recommended.contextWindow);
    elements.compactInput.value = String(payload.recommended.compactLimit);
  }
  renderValues();
  renderStatus();
}

async function post(path, body = {}) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Context-Switch-Token': state.token,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error ?? t('requestFailed'));
    error.code = payload.code;
    throw error;
  }
  const nextToken = response.headers.get('x-context-switch-token');
  if (nextToken) state.token = nextToken;
  return payload;
}

elements.contextInput.addEventListener('input', () => {
  const context = elements.contextInput.valueAsNumber;
  if (!state.compactWasEdited && Number.isFinite(context)) {
    elements.compactInput.value = String(Math.floor(context * 0.9 / 1000) * 1000);
  }
  renderValues();
});

elements.contextRange.addEventListener('input', () => {
  elements.contextInput.value = elements.contextRange.value;
  if (!state.compactWasEdited) {
    elements.compactInput.value = String(Math.floor(elements.contextRange.valueAsNumber * 0.9 / 1000) * 1000);
  }
  renderValues();
});

elements.compactInput.addEventListener('input', () => {
  state.compactWasEdited = true;
  renderValues();
});

elements.presets.forEach((button) => {
  button.addEventListener('click', () => {
    const context = Number(button.dataset.context);
    elements.contextInput.value = String(context);
    elements.compactInput.value = String(Math.floor(context * 0.9 / 1000) * 1000);
    state.compactWasEdited = false;
    renderValues();
  });
});

elements.ratioButton.addEventListener('click', () => {
  const context = elements.contextInput.valueAsNumber;
  if (Number.isFinite(context)) {
    elements.compactInput.value = String(Math.floor(context * 0.9 / 1000) * 1000);
    state.compactWasEdited = false;
    renderValues();
  }
});

elements.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!validate()) return;
  setBusy(true);
  try {
    state.status = await post('/api/apply', numericValues());
    renderStatus();
    showToast(t('appliedToast'));
  } catch (error) {
    elements.formMessage.hidden = false;
    elements.formMessage.textContent = error.message;
  } finally {
    setBusy(false);
  }
});

elements.revertButton.addEventListener('click', async () => {
  setBusy(true);
  try {
    state.status = await post('/api/revert');
    const values = state.status.values;
    if (state.status.active) {
      elements.contextInput.value = String(values.model_context_window);
      elements.compactInput.value = String(values.model_auto_compact_token_limit);
    } else {
      elements.contextInput.value = String(state.status.recommended.contextWindow);
      elements.compactInput.value = String(state.status.recommended.compactLimit);
    }
    state.compactWasEdited = false;
    renderValues();
    renderStatus();
    showToast(t('restoredToast'));
  } catch (error) {
    elements.formMessage.hidden = false;
    elements.formMessage.textContent = error.message;
  } finally {
    setBusy(false);
  }
});

elements.copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(elements.configPreview.innerText.trim());
    showToast(t('copiedToast'));
  } catch {
    elements.formMessage.hidden = false;
    elements.formMessage.textContent = t('requestFailed');
  }
});

elements.languageToggle.addEventListener('click', () => {
  state.language = state.language === 'en' ? 'es' : 'en';
  localStorage.setItem('context-switch-language', state.language);
  translate();
});

translate();
getStatus().catch((error) => {
  elements.statusChip.dataset.state = 'conflict';
  elements.statusText.textContent = t('requestFailed');
  elements.formMessage.hidden = false;
  elements.formMessage.textContent = error.message;
  elements.applyButton.disabled = true;
});
