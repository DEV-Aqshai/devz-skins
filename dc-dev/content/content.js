// dc-dev: main content script for Discord web
// Everything here is local UI. Nothing sends messages or touches Discord's API.
(() => {
  'use strict';
  if (window.__dcDevLoaded) return;
  window.__dcDevLoaded = true;

  const D = window.DD_DEFAULTS;
  const ACCENTS = window.DD_ACCENTS;
  const USER = 'devz@aqshai';
  let cfg = { ...D };
  const root = document.documentElement;

  /* ---------------- helpers ---------------- */
  const h = (tag, props = {}, ...kids) => {
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
  const flip = (k) => {
    save({ [k]: !cfg[k] });
    toast(`${k} = ${!cfg[k] ? 'on' : 'off'}`);
  };

  let toastEl = null;
  let toastTimer = 0;
  function toast(msg) {
    if (!toastEl) {
      toastEl = h('div', { id: 'dd-toast' });
      document.body.append(toastEl);
    }
    toastEl.textContent = '$ ' + msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('on'), 2200);
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = h('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  }

  /* ---------------- ids from the URL ---------------- */
  function urlIds() {
    const m = location.pathname.match(/^\/channels\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?/);
    return m ? { guild: m[1], channel: m[2] || null, message: m[3] || null } : null;
  }
  function copyId(kind) {
    const ids = urlIds();
    if (!ids) return toast('open a channel first');
    if (kind === 'guild') {
      if (ids.guild === '@me') return toast('this is a DM, no server id');
      copy(ids.guild);
      return toast('copied server id ' + ids.guild);
    }
    if (kind === 'channel') {
      if (!ids.channel) return toast('no channel open');
      copy(ids.channel);
      return toast('copied channel id ' + ids.channel);
    }
    if (!ids.channel) return toast('no channel open');
    const url = `${location.origin}/channels/${ids.guild}/${ids.channel}`;
    copy(url);
    toast('copied channel link');
  }

  /* ---------------- composer ---------------- */
  const composer = () => document.querySelector('[role="textbox"][data-slate-editor="true"]');
  const getText = () => {
    const c = composer();
    return c ? c.innerText.replace(/[\uFEFF\u200B]/g, '').replace(/\n+$/, '') : '';
  };

  function setComposer(text, replace = true) {
    const c = composer();
    if (!c) {
      toast('open a channel first');
      return false;
    }
    const before = c.innerText;
    c.focus();
    if (replace) document.execCommand('selectAll', false, null);
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    c.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    // fallback if the editor ignored the synthetic paste
    setTimeout(() => {
      if (text && c.innerText === before) document.execCommand('insertText', false, text);
    }, 80);
    return true; // never auto-sends: you still press Enter yourself
  }

  const transform = (fn) => {
    const t = getText();
    if (!t.trim()) return toast('composer is empty');
    try {
      setComposer(fn(t));
    } catch (err) {
      toast('failed: ' + String(err.message || err).slice(0, 60));
    }
  };

  const b64e = (s) => {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
  };
  const b64d = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.trim()), (c) => c.charCodeAt(0)));

  function wrapLang(lang = '') {
    transform((t) => {
      const m = t.match(/^```[^\n]*\n?([\s\S]*?)\n?```$/);
      if (m && !lang) return m[1]; // plain toggle: unwrap
      const body = m ? m[1] : t;
      return '```' + lang + '\n' + body + '\n```';
    });
  }
  const inlineCode = () => transform((t) => '`' + t + '`');
  const quoteLines = () => transform((t) => t.split('\n').map((l) => '> ' + l).join('\n'));
  const spoiler = () => transform((t) => '||' + t + '||');
  const prettyJson = () =>
    transform((t) => '```json\n' + JSON.stringify(JSON.parse(t.trim()), null, 2) + '\n```');
  const dateToStamp = () =>
    transform((t) => {
      const ms = Date.parse(t.trim());
      if (isNaN(ms)) throw new Error('could not parse date');
      return `<t:${Math.floor(ms / 1000)}:F>`;
    });
  const nowStamp = (style) => setComposer(`<t:${Math.floor(Date.now() / 1000)}:${style}>`, false);

  /* ---------------- snippets ---------------- */
  function parseSnippets() {
    const out = {};
    String(cfg.snippets || '')
      .split('\n')
      .forEach((line) => {
        const i = line.indexOf('=');
        if (i < 1) return;
        const name = line.slice(0, i).trim();
        if (!/^[\w-]+$/.test(name)) return;
        out[name] = line.slice(i + 1).trim().replace(/\\n/g, '\n');
      });
    return out;
  }

  function expandSnippet(e) {
    const c = composer();
    if (!c || !c.contains(document.activeElement)) return;
    const m = getText().match(/(^|\s);([\w-]+)$/);
    if (!m) return;
    const body = parseSnippets()[m[2]];
    if (body == null) return;
    e.preventDefault();
    e.stopPropagation();
    for (let i = 0; i < m[2].length + 1; i++) document.execCommand('delete');
    setComposer(body, false);
  }

  /* ---------------- chat export ---------------- */
  function copyChat() {
    const items = [...document.querySelectorAll('li[id^="chat-messages-"]')];
    if (!items.length) return toast('no messages found');
    let last = '?';
    let count = 0;
    const out = [];
    items.forEach((li) => {
      const nameEl = li.querySelector('[id^="message-username-"]');
      if (nameEl) last = nameEl.textContent.trim();
      const body = li.querySelector('[id^="message-content-"]');
      const text = body ? body.innerText.trim() : '';
      if (!text) return;
      const t = li.querySelector('time');
      const when = t ? t.getAttribute('datetime') || t.textContent : '';
      out.push(`**${last}** \`${when}\`\n${text}\n`);
      count++;
    });
    if (!count) return toast('no text messages found');
    copy(out.join('\n'));
    toast(`copied ${count} messages as markdown`);
  }

  /* ---------------- status bar ---------------- */
  const segCtx = h('span', { class: 'dd-seg dd-cur', text: '1:-' });
  const segUnread = h('span', { class: 'dd-seg' });
  const segNet = h('span', { class: 'dd-seg' });
  const segClock = h('span', { class: 'dd-seg' });
  const bar = h(
    'div',
    { id: 'dd-bar' },
    h('span', { class: 'dd-seg dd-sess', text: USER }),
    h('span', { class: 'dd-seg', text: '0:discord' }),
    segCtx,
    h('span', { class: 'dd-fill' }),
    segUnread,
    segNet,
    h('span', { class: 'dd-seg', text: 'alt+p palette' }),
    segClock,
    h('span', { class: 'dd-seg dd-caret', text: '\u258d' })
  );

  function tickBar() {
    const raw = document.title;
    const mentions = /^\((\d+)\)/.exec(raw);
    const dot = /^\u2022/.test(raw);
    const name = raw
      .replace(/^\(\d+\)\s*/, '')
      .replace(/^\u2022\s*/, '')
      .replace(/^Discord\s*\|\s*/i, '')
      .replace(/\s*[-|]\s*Discord$/i, '')
      .replace(/\s*\|\s*/g, ' @ ')
      .trim();
    segCtx.textContent = `1:${name || 'discord'}*`;
    if (mentions) {
      segUnread.textContent = `${mentions[1]} mention${mentions[1] === '1' ? '' : 's'}`;
      segUnread.className = 'dd-seg dd-unread';
    } else if (dot) {
      segUnread.textContent = 'unread';
      segUnread.className = 'dd-seg dd-ok';
    } else {
      segUnread.textContent = '';
      segUnread.className = 'dd-seg';
    }
    const on = navigator.onLine;
    segNet.textContent = on ? '\u25cf online' : '\u25cb offline';
    segNet.className = 'dd-seg ' + (on ? 'dd-ok' : 'dd-bad');
    segClock.textContent = new Date().toTimeString().slice(0, 8);
    // safety net in case the observer below ever misses something
    if (!window.ddInSync(cfg)) window.ddApply(cfg);
    if (!bar.isConnected) document.body.append(bar);
  }

  /* ---------------- command palette ---------------- */
  const pal = { el: null, input: null, list: null, items: [], shown: [], sel: 0 };

  function commands() {
    const out = [];
    const add = (kind, label, run, hint = '') => out.push({ kind, label, run, hint });

    add('composer', 'wrap in code block (toggle)', () => wrapLang(''), 'alt+c');
    ['js', 'ts', 'python', 'php', 'kotlin', 'java', 'bash', 'sql', 'json', 'html', 'css', 'go', 'rust', 'cpp', 'yaml', 'diff'].forEach(
      (l) => add('code', `code block: ${l}`, () => wrapLang(l))
    );
    add('composer', 'prettify json to code block', prettyJson, 'alt+j');
    add('composer', 'wrap in inline code', inlineCode);
    add('composer', 'quote every line', quoteLines);
    add('composer', 'spoiler', spoiler);
    add('composer', 'base64 encode', () => transform(b64e));
    add('composer', 'base64 decode', () => transform(b64d));
    add('composer', 'url encode', () => transform(encodeURIComponent));
    add('composer', 'url decode', () => transform(decodeURIComponent));
    add('composer', 'date text to discord timestamp', dateToStamp);

    add('insert', 'uuid v4', () => setComposer(crypto.randomUUID(), false));
    add('insert', 'unix timestamp', () => setComposer(String(Math.floor(Date.now() / 1000)), false));
    add('insert', 'iso timestamp', () => setComposer(new Date().toISOString(), false));
    add('insert', 'discord timestamp: now (relative)', () => nowStamp('R'));
    add('insert', 'discord timestamp: now (full)', () => nowStamp('F'));
    add('insert', 'discord timestamp: now (time)', () => nowStamp('t'));

    add('id', 'copy channel id', () => copyId('channel'));
    add('id', 'copy server id', () => copyId('guild'));
    add('id', 'copy channel link', () => copyId('link'));

    add('chat', 'copy visible messages as markdown', copyChat);

    [
      ['stealth', 'blur messages until hover', 'alt+b'],
      ['autoHide', 'blur when tab loses focus', ''],
      ['hideMembers', 'hide member list', ''],
      ['hideNitro', 'hide nitro / shop / quests / gift', ''],
      ['hideActivity', 'hide active now column', ''],
      ['hideGifs', 'hide gif + sticker buttons', ''],
      ['squareAvatars', 'square avatars', ''],
      ['monoFont', 'monospace font', ''],
      ['statusBar', 'status bar', ''],
      ['scanlines', 'crt scanlines', ''],
      ['theme', 'terminal theme', '']
    ].forEach(([k, label, hint]) => add('toggle', label, () => flip(k), hint));

    Object.entries(ACCENTS).forEach(([n, c]) => add('accent', n, () => save({ accent: c }), c));
    Object.entries(parseSnippets()).forEach(([n, body]) =>
      add('snippet', ';' + n, () => setComposer(body, false), body.replace(/\n/g, ' ').slice(0, 36))
    );
    return out;
  }

  function fuzzy(q, s) {
    q = q.toLowerCase();
    s = s.toLowerCase();
    let i = 0;
    let score = 0;
    let last = -2;
    for (let j = 0; j < s.length && i < q.length; j++) {
      if (s[j] === q[i]) {
        score += last === j - 1 ? 3 : 1;
        if (j === 0 || ' :-_/;'.includes(s[j - 1])) score += 2;
        last = j;
        i++;
      }
    }
    return i === q.length ? score : -1;
  }

  function mark() {
    [...pal.list.children].forEach((r, i) => r.classList.toggle('sel', i === pal.sel));
  }
  function runItem(it) {
    closePalette();
    setTimeout(() => it.run(), 0);
  }

  function renderPalette() {
    const q = pal.input.value.trim();
    const res = pal.items.map((i) => ({ i, s: q ? fuzzy(q, i.kind + ' ' + i.label) : 0 })).filter((x) => x.s >= 0);
    if (q) res.sort((a, b) => b.s - a.s);
    pal.shown = res.slice(0, 10).map((x) => x.i);
    pal.sel = Math.min(pal.sel, Math.max(pal.shown.length - 1, 0));
    const rows = pal.shown.map((it, idx) => {
      const row = h(
        'div',
        { class: 'dd-row' + (idx === pal.sel ? ' sel' : '') },
        h('span', { class: 'dd-k', text: it.kind }),
        h('span', { class: 'dd-l', text: it.label }),
        h('span', { class: 'dd-hint', text: it.hint || '' })
      );
      row.addEventListener('mousedown', (e) => {
        e.preventDefault();
        runItem(it);
      });
      row.addEventListener('mousemove', () => {
        pal.sel = idx;
        mark();
      });
      return row;
    });
    if (!rows.length) rows.push(h('div', { class: 'dd-empty', text: 'no match. try "json", "timestamp", "python" or "id"' }));
    pal.list.replaceChildren(...rows);
  }

  function buildPalette() {
    pal.input = h('input', { type: 'text', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'command' });
    pal.list = h('div', { role: 'listbox' });
    pal.el = h(
      'div',
      { id: 'dd-pal' },
      h('div', { class: 'dd-box' }, h('div', { class: 'dd-in' }, h('span', { class: 'dd-ps', text: '>' }), pal.input), pal.list)
    );
    pal.el.addEventListener('mousedown', (e) => {
      if (e.target === pal.el) closePalette();
    });
    pal.input.addEventListener('input', () => {
      pal.sel = 0;
      renderPalette();
    });
    pal.input.addEventListener('keydown', (e) => {
      e.stopPropagation(); // keep Discord hotkeys from firing while typing here
      const n = Math.max(pal.shown.length, 1);
      if (e.key === 'Escape') closePalette();
      else if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
        e.preventDefault();
        pal.sel = (pal.sel + 1) % n;
        mark();
      } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
        e.preventDefault();
        pal.sel = (pal.sel - 1 + n) % n;
        mark();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const it = pal.shown[pal.sel];
        if (it) runItem(it);
      }
    });
    ['keyup', 'keypress'].forEach((t) => pal.input.addEventListener(t, (e) => e.stopPropagation()));
    document.body.append(pal.el);
  }

  function openPalette() {
    if (!pal.el) buildPalette();
    pal.items = commands();
    pal.input.value = '';
    pal.sel = 0;
    renderPalette();
    pal.el.classList.add('on');
    pal.input.focus();
  }
  function closePalette() {
    if (pal.el) pal.el.classList.remove('on');
  }
  const paletteOpen = () => pal.el && pal.el.classList.contains('on');

  /* ---------------- hotkeys ---------------- */
  // Ctrl+K is Discord's own quick switcher, so the palette lives on Alt+P.
  window.addEventListener(
    'keydown',
    (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.code;
      if (e.altKey && !mod && !e.shiftKey) {
        const act = {
          KeyP: () => (paletteOpen() ? closePalette() : openPalette()),
          KeyC: () => wrapLang(''),
          KeyJ: prettyJson,
          KeyB: () => flip('stealth')
        }[k];
        if (act) {
          e.preventDefault();
          e.stopPropagation();
          act();
          return;
        }
      }
      if (k === 'Tab' && !e.shiftKey && !mod && !e.altKey) expandSnippet(e);
    },
    true
  );

  window.addEventListener('blur', () => {
    if (!cfg.autoHide) return;
    window.ddState.away = true;
    window.ddApply(cfg);
  });
  window.addEventListener('focus', () => {
    window.ddState.away = false;
    window.ddApply(cfg);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const [k, v] of Object.entries(changes)) cfg[k] = v.newValue;
    window.ddApply(cfg);
  });

  /* ---------------- boot ---------------- */
  chrome.storage.sync.get(D, (stored) => {
    cfg = { ...D, ...stored };
    document.body.append(bar);
    window.ddApply(cfg);
    tickBar();
    setInterval(tickBar, 1000);

    // Discord rewrites <html> attributes now and then. Restore ours synchronously (observer
    // callbacks run before the next paint), so there is no visible flash of stock Discord.
    let lastLog = 0;
    new MutationObserver((muts) => {
      const drifted = !window.ddInSync(cfg);
      if (drifted) window.ddApply(cfg);
      const now = Date.now();
      if (now - lastLog > 3000 && muts.length) {
        lastLog = now;
        console.debug(
          '[dc-dev] <html> attr changed by page:',
          [...new Set(muts.map((m) => m.attributeName))].join(','),
          drifted ? '(skin restored)' : '(skin unaffected)'
        );
      }
    }).observe(root, { attributes: true, attributeFilter: ['class', 'style', 'data-dd'] });
    toast('dc-dev loaded. alt+p for commands');
  });
})();
