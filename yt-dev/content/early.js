// document_start: theme class immediately, then real settings (no flash of stock YouTube)
(() => {
  document.documentElement.classList.add('yd-on');
  try {
    chrome.storage.sync.get(window.YD_DEFAULTS, (v) => window.ydApply({ ...window.YD_DEFAULTS, ...v }));
  } catch (_) { /* storage unavailable, keep defaults */ }
})();
