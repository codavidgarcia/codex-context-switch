const strings = {
  en: {
    title: 'Context',
    contextWindow: 'Context window',
    tokens: 'tokens',
    modelMax: '1.05M max',
    decisionNote: 'More context keeps more of the task available, but uses more resources.',
    advanced: 'Advanced',
    compactAt: 'Compact history at',
    useNinety: 'Use 90%',
    apply: 'Apply',
    applied: 'Applied',
    restore: 'Restore original',
    restart: 'Restart Codex.',
    restored: 'Original restored. Restart Codex.',
    minContext: 'Enter at least 16,000.',
    maxContext: 'The maximum is 1,050,000.',
    compactMinimum: 'Enter at least 8,000.',
    compactBelow: 'Compaction must be below the context value.',
    conflict: 'The managed settings changed outside this app. Nothing was overwritten.',
    unsupported: 'The existing settings need a manual review before this app can change them.',
    failed: 'The change could not be saved.',
  },
  es: {
    title: 'Contexto',
    contextWindow: 'Ventana de contexto',
    tokens: 'tokens',
    modelMax: 'máx. 1,05M',
    decisionNote: 'Más contexto conserva más de la tarea, pero usa más recursos.',
    advanced: 'Avanzado',
    compactAt: 'Compactar el historial en',
    useNinety: 'Usar 90%',
    apply: 'Aplicar',
    applied: 'Aplicado',
    restore: 'Restaurar original',
    restart: 'Reinicia Codex.',
    restored: 'Original restaurado. Reinicia Codex.',
    minContext: 'Ingresa al menos 16.000.',
    maxContext: 'El máximo es 1.050.000.',
    compactMinimum: 'Ingresa al menos 8.000.',
    compactBelow: 'La compactación debe ser menor que el contexto.',
    conflict: 'La configuración cambió fuera de esta app. No se sobrescribió nada.',
    unsupported: 'La configuración existente necesita una revisión manual antes de cambiarla desde aquí.',
    failed: 'No se pudo guardar el cambio.',
  },
};

const elements = {
  form: document.querySelector('#settingsForm'),
  contextInput: document.querySelector('#contextInput'),
  contextRange: document.querySelector('#contextRange'),
  compactInput: document.querySelector('#compactInput'),
  rangeShell: document.querySelector('#rangeShell'),
  currentNotch: document.querySelector('#currentNotch'),
  advanced: document.querySelector('#advanced'),
  ratioButton: document.querySelector('#ratioButton'),
  languageButton: document.querySelector('#languageButton'),
  applyButton: document.querySelector('#applyButton'),
  applyLabel: document.querySelector('#applyButton span'),
  restoreButton: document.querySelector('#restoreButton'),
  formMessage: document.querySelector('#formMessage'),
  result: document.querySelector('#result'),
};

const state = {
  language: localStorage.getItem('context-switch-language'),
  status: null,
  committedContext: null,
  committedCompact: null,
  compactWasEdited: false,
  busy: false,
  ready: false,
};

function t(key) {
  return strings[state.language]?.[key] ?? strings.en[key] ?? key;
}

function parseNumber(value) {
  const digits = String(value).replace(/[^0-9]/g, '');
  return digits ? Number(digits) : Number.NaN;
}

function formatNumber(value) {
  if (!Number.isSafeInteger(value)) return '';
  return new Intl.NumberFormat(state.language === 'es' ? 'es-CO' : 'en-US').format(value);
}

function setInputNumber(input, value) {
  input.value = formatNumber(value);
}

function setLanguage(language) {
  const visibleContext = parseNumber(elements.contextInput.value);
  const visibleCompact = parseNumber(elements.compactInput.value);
  state.language = language === 'es' ? 'es' : 'en';
  localStorage.setItem('context-switch-language', state.language);
  document.documentElement.lang = state.language;
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  elements.contextRange.setAttribute('aria-label', t('contextWindow'));
  elements.languageButton.textContent = state.language === 'en' ? 'ES' : 'EN';
  elements.languageButton.setAttribute(
    'aria-label',
    state.language === 'en' ? 'Cambiar idioma a español' : 'Switch language to English',
  );
  if (Number.isSafeInteger(visibleContext)) setInputNumber(elements.contextInput, visibleContext);
  if (Number.isSafeInteger(visibleCompact)) setInputNumber(elements.compactInput, visibleCompact);
  render();
}

function values() {
  return {
    contextWindow: parseNumber(elements.contextInput.value),
    compactLimit: parseNumber(elements.compactInput.value),
  };
}

function validationMessage() {
  const current = values();
  if (state.status?.hasConflict) return t('conflict');
  if (!Number.isSafeInteger(current.contextWindow) || current.contextWindow < 16_000) return t('minContext');
  if (current.contextWindow > 1_050_000) return t('maxContext');
  if (!Number.isSafeInteger(current.compactLimit) || current.compactLimit < 8_000) return t('compactMinimum');
  if (current.compactLimit >= current.contextWindow) return t('compactBelow');
  return '';
}

function isDirty() {
  if (!state.ready) return false;
  const current = values();
  if (!state.status?.active) return true;
  return current.contextWindow !== state.committedContext || current.compactLimit !== state.committedCompact;
}

function updateCurrentNotch() {
  if (!Number.isSafeInteger(state.committedContext)) {
    elements.currentNotch.hidden = true;
    return;
  }
  const minimum = 16_000;
  const maximum = 1_050_000;
  const percentage = ((state.committedContext - minimum) / (maximum - minimum)) * 100;
  elements.rangeShell.style.setProperty('--current-position', `${Math.max(0, Math.min(100, percentage))}%`);
  elements.currentNotch.hidden = false;
}

function render() {
  const message = validationMessage();
  const dirty = isDirty();
  elements.formMessage.hidden = !message;
  elements.formMessage.textContent = message;
  elements.applyButton.disabled = !state.ready || state.busy || Boolean(message) || !dirty;
  elements.applyLabel.textContent = dirty ? t('apply') : t('applied');
  elements.restoreButton.hidden = !state.status?.canRevert;
  elements.restoreButton.disabled = state.busy;
  updateCurrentNotch();
}

function syncContext(value) {
  setInputNumber(elements.contextInput, value);
  elements.contextRange.value = String(value);
  if (!state.compactWasEdited) {
    setInputNumber(elements.compactInput, Math.floor(value * 0.9 / 1000) * 1000);
  }
  elements.result.textContent = '';
  render();
}

function setBusy(busy) {
  state.busy = busy;
  elements.contextInput.disabled = busy;
  elements.contextRange.disabled = busy;
  elements.compactInput.disabled = busy;
  elements.ratioButton.disabled = busy;
  render();
}

async function loadStatus() {
  const status = await window.contextSwitch.getStatus();
  state.status = status;
  if (!state.language) setLanguage(status.locale?.toLowerCase().startsWith('es') ? 'es' : 'en');
  const contextWindow = status.active
    ? status.values.model_context_window
    : status.recommended.contextWindow;
  const compactLimit = status.active
    ? status.values.model_auto_compact_token_limit
    : status.recommended.compactLimit;
  state.committedContext = status.active ? contextWindow : null;
  state.committedCompact = status.active ? compactLimit : null;
  setInputNumber(elements.contextInput, contextWindow);
  elements.contextRange.value = String(contextWindow);
  setInputNumber(elements.compactInput, compactLimit);
  state.ready = true;
  render();
}

function friendlyError(error) {
  if (error?.code === 'CONFIG_CHANGED') return t('conflict');
  if (['DUPLICATE_KEY', 'UNSUPPORTED_KEY_FORMAT', 'UNSUPPORTED_VALUE'].includes(error?.code)) {
    return t('unsupported');
  }
  return t('failed');
}

elements.contextInput.addEventListener('input', () => {
  const contextWindow = parseNumber(elements.contextInput.value);
  if (Number.isSafeInteger(contextWindow)) {
    if (contextWindow >= 16_000 && contextWindow <= 1_050_000) {
      elements.contextRange.value = String(contextWindow);
    }
    if (!state.compactWasEdited) {
      setInputNumber(elements.compactInput, Math.floor(contextWindow * 0.9 / 1000) * 1000);
    }
  }
  elements.result.textContent = '';
  render();
});

elements.contextInput.addEventListener('focus', () => {
  const value = parseNumber(elements.contextInput.value);
  if (Number.isSafeInteger(value)) elements.contextInput.value = String(value);
});

elements.contextInput.addEventListener('blur', () => {
  const value = parseNumber(elements.contextInput.value);
  if (Number.isSafeInteger(value)) setInputNumber(elements.contextInput, value);
});

elements.contextRange.addEventListener('input', () => syncContext(elements.contextRange.valueAsNumber));

elements.compactInput.addEventListener('input', () => {
  state.compactWasEdited = true;
  elements.result.textContent = '';
  render();
});

elements.compactInput.addEventListener('focus', () => {
  const value = parseNumber(elements.compactInput.value);
  if (Number.isSafeInteger(value)) elements.compactInput.value = String(value);
});

elements.compactInput.addEventListener('blur', () => {
  const value = parseNumber(elements.compactInput.value);
  if (Number.isSafeInteger(value)) setInputNumber(elements.compactInput, value);
});

elements.ratioButton.addEventListener('click', () => {
  const contextWindow = parseNumber(elements.contextInput.value);
  if (!Number.isFinite(contextWindow)) return;
  setInputNumber(elements.compactInput, Math.floor(contextWindow * 0.9 / 1000) * 1000);
  state.compactWasEdited = false;
  elements.result.textContent = '';
  render();
});

elements.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (validationMessage()) return;
  setBusy(true);
  try {
    state.status = await window.contextSwitch.apply(values());
    state.committedContext = state.status.values.model_context_window;
    state.committedCompact = state.status.values.model_auto_compact_token_limit;
    elements.result.textContent = t('restart');
  } catch (error) {
    elements.formMessage.hidden = false;
    elements.formMessage.textContent = friendlyError(error);
  } finally {
    setBusy(false);
  }
});

elements.restoreButton.addEventListener('click', async () => {
  setBusy(true);
  try {
    state.status = await window.contextSwitch.revert();
    const contextWindow = state.status.active
      ? state.status.values.model_context_window
      : state.status.recommended.contextWindow;
    const compactLimit = state.status.active
      ? state.status.values.model_auto_compact_token_limit
      : state.status.recommended.compactLimit;
    state.committedContext = state.status.active ? contextWindow : null;
    state.committedCompact = state.status.active ? compactLimit : null;
    setInputNumber(elements.contextInput, contextWindow);
    elements.contextRange.value = String(contextWindow);
    setInputNumber(elements.compactInput, compactLimit);
    state.compactWasEdited = false;
    elements.result.textContent = t('restored');
  } catch (error) {
    elements.formMessage.hidden = false;
    elements.formMessage.textContent = friendlyError(error);
  } finally {
    setBusy(false);
  }
});

elements.languageButton.addEventListener('click', () => setLanguage(state.language === 'en' ? 'es' : 'en'));
elements.advanced.addEventListener('toggle', () => {
  window.contextSwitch.setAdvanced(elements.advanced.open);
});

setLanguage(state.language ?? 'en');
loadStatus().catch((error) => {
  elements.formMessage.hidden = false;
  elements.formMessage.textContent = friendlyError(error);
});
