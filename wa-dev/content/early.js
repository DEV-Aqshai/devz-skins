// runs at document_start: apply theme class + accent before first paint (no flash)
(() => {
  const root = document.documentElement;
  root.classList.add('dz-on');
  try {
    chrome.storage.sync.get({ theme: true, accent: '#4dffa0' }, (v) => {
      if (!v.theme) root.classList.remove('dz-on');
      const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(v.accent);
      if (m) {
        root.style.setProperty('--dz-accent', v.accent);
        root.style.setProperty('--dz-accent-rgb', `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`);
      }
    });
  } catch (_) { /* storage unavailable, keep defaults */ }
})();
