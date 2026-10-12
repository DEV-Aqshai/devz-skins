// document_start: theme on immediately, then real settings (no flash of stock Discord)
(() => {
  document.documentElement.setAttribute('data-dd', 'on');
  try {
    chrome.storage.sync.get(window.DD_DEFAULTS, (v) => window.ddApply({ ...window.DD_DEFAULTS, ...v }));
  } catch (_) { /* storage unavailable, keep defaults */ }
})();
