(() => {
  const D = window.YD_DEFAULTS;
  const ACCENTS = window.YD_ACCENTS;

  const FLAGS = [
    ['theme', 'theme', 'terminal skin'],
    ['statusBar', 'status bar', 'tmux bar: page, time, eta'],
    ['monoFont', 'mono font', 'monospace (captions kept)'],
    ['terminalLogo', 'terminal logo', 'devz@yt:~$ in the header'],
    ['dimThumbs', 'dim thumbs', 'grayscale until hover'],
    ['hideShorts', 'hide shorts', 'shelves, sidebar, results'],
    ['hideFeed', 'hide feed', 'blank home (alt+f)'],
    ['hideComments', 'hide comments', ''],
    ['hideRelated', 'hide sidebar', 'watch page suggestions'],
    ['hideAmbient', 'hide ambient', 'glow behind the player'],
    ['rememberSpeed', 'keep speed', 'same playback rate every video'],
    ['scanlines', 'scanlines', 'CRT line overlay']
  ];

  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v);
    }
    n.append(...kids);
    return n;
  };
  const save = (patch) => chrome.storage.sync.set(patch);

  chrome.storage.sync.get(D, (cfg) => {
    const setAccent = (c) => document.documentElement.style.setProperty('--accent', c);
    setAccent(cfg.accent);

    const flags = document.getElementById('flags');
    FLAGS.forEach(([key, name, desc]) => {
      const box = el('input', { type: 'checkbox' });
      box.checked = !!cfg[key];
      box.addEventListener('change', () => save({ [key]: box.checked }));
      flags.append(
        el('label', { class: 'flag' }, box, el('span', { class: 'box' }), el('b', { text: name }), el('i', { text: desc }))
      );
    });

    const accents = document.getElementById('accents');
    const buttons = [];
    Object.entries(ACCENTS).forEach(([name, color]) => {
      const b = el('button', { type: 'button', 'aria-label': name, title: name });
      b.style.background = color;
      b.setAttribute('aria-pressed', String(color === cfg.accent));
      b.addEventListener('click', () => {
        buttons.forEach((x) => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
        setAccent(color);
        save({ accent: color });
      });
      buttons.push(b);
      accents.append(b);
    });
  });
})();
