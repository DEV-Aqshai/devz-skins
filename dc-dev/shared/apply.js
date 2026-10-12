// shared: map settings onto <html data-dd="..."> + CSS variables.
// We use a data attribute (not classes) because Discord's app rewrites <html class> now and then,
// which used to wipe the skin for a moment.
window.ddState = { away: false };

function ddTokens(cfg) {
  const t = [];
  for (const [key, cls] of Object.entries(window.DD_FLAG_CLASSES)) {
    if (cfg[key]) t.push(cls.replace(/^dd-/, ''));
  }
  if (window.ddState.away) t.push('away');
  return t.join(' ');
}

function ddAccentVars(cfg) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(cfg.accent || '');
  return {
    accent: m ? cfg.accent : '#4dffa0',
    rgb: m ? `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}` : '77,255,160'
  };
}

// only writes when something differs, so observers never loop
window.ddApply = (cfg) => {
  const root = document.documentElement;
  const tokens = ddTokens(cfg);
  if (root.getAttribute('data-dd') !== tokens) root.setAttribute('data-dd', tokens);
  const v = ddAccentVars(cfg);
  if (root.style.getPropertyValue('--dd-accent') !== v.accent) root.style.setProperty('--dd-accent', v.accent);
  if (root.style.getPropertyValue('--dd-accent-rgb') !== v.rgb) root.style.setProperty('--dd-accent-rgb', v.rgb);
};

window.ddInSync = (cfg) => {
  const root = document.documentElement;
  const v = ddAccentVars(cfg);
  return (
    root.getAttribute('data-dd') === ddTokens(cfg) &&
    root.style.getPropertyValue('--dd-accent') === v.accent &&
    root.style.getPropertyValue('--dd-accent-rgb') === v.rgb
  );
};
