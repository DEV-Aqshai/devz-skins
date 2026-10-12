(() => {
  const D = window.WA_DEV_DEFAULTS;
  const ACCENTS = window.WA_DEV_ACCENTS;

  const FLAGS = [
    ['theme', 'theme', 'terminal skin for WhatsApp Web'],
    ['statusBar', 'status bar', 'tmux-style: chat, unread, clock'],
    ['codeTools', 'code tools', 'syntax colors, click code to copy'],
    ['stealth', 'stealth', 'blur chats until hover (alt+b)'],
    ['autoHide', 'auto-hide', 'blur when the tab loses focus'],
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
      flags.append(el('label', { class: 'flag' }, box, el('span', { class: 'box' }), el('b', { text: name }), el('i', { text: desc })));
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

    const fs = document.getElementById('fs');
    const fsv = document.getElementById('fsv');
    fs.value = cfg.fontSize;
    fsv.textContent = cfg.fontSize + 'px';
    fs.addEventListener('input', () => {
      fsv.textContent = fs.value + 'px';
      save({ fontSize: Number(fs.value) });
    });

    const snips = document.getElementById('snips');
    snips.value = cfg.snippets;
    let t = 0;
    snips.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => save({ snippets: snips.value }), 300);
    });
  });
})();
