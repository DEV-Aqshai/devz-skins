// shared: map settings onto <html> classes + CSS variables
window.ydApply = (cfg) => {
  const root = document.documentElement;
  for (const [key, cls] of Object.entries(window.YD_FLAG_CLASSES)) {
    root.classList.toggle(cls, !!cfg[key]);
  }
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(cfg.accent || '');
  const rgb = m ? `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}` : '77,255,160';
  root.style.setProperty('--yd-accent', m ? cfg.accent : '#4dffa0');
  root.style.setProperty('--yd-accent-rgb', rgb);
};
