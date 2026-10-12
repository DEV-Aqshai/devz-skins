// wa-dev: main content script for web.whatsapp.com
(() => {
  'use strict';
  if (window.__waDevLoaded) return;
  window.__waDevLoaded = true;

  const D = window.WA_DEV_DEFAULTS;
  const ACCENTS = window.WA_DEV_ACCENTS;
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

  const hexToRgb = (hex) => {
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
    return m ? `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}` : '77,255,160';
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
      toastEl = h('div', { id: 'dz-toast' });
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

  const realClick = (el) => {
    for (const t of ['mousedown', 'mouseup', 'click']) {
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
    }
  };

  /* ---------------- apply settings ---------------- */
  function apply() {
    root.classList.toggle('dz-on', !!cfg.theme);
    root.classList.toggle('dz-bar', !!cfg.statusBar);
    root.classList.toggle('dz-code', !!cfg.codeTools);
    root.classList.toggle('dz-stealth', !!cfg.stealth);
    root.classList.toggle('dz-scan', !!cfg.scanlines);
    root.style.setProperty('--dz-accent', cfg.accent);
    root.style.setProperty('--dz-accent-rgb', hexToRgb(cfg.accent));
    root.style.setProperty('--dz-fs', `${cfg.fontSize}px`);
    rehighlight();
  }

  /* ---------------- status bar ---------------- */
  const segChat = h('span', { class: 'dz-seg dz-cur', text: '1:-' });
  const segUnread = h('span', { class: 'dz-seg' });
  const segNet = h('span', { class: 'dz-seg' });
  const segHint = h('span', { class: 'dz-seg', text: '^k palette' });
  const segClock = h('span', { class: 'dz-seg' });
  const bar = h(
    'div',
    { id: 'dz-bar' },
    h('span', { class: 'dz-seg dz-sess', text: USER }),
    h('span', { class: 'dz-seg', text: '0:chats' }),
    segChat,
    h('span', { class: 'dz-fill' }),
    segUnread,
    segNet,
    segHint,
    segClock,
    h('span', { class: 'dz-seg dz-caret', text: '\u258d' })
  );

  function activeChat() {
    const t =
      document.querySelector('#main header span[dir="auto"][title]') ||
      document.querySelector('#main header [title]');
    return t ? (t.getAttribute('title') || t.textContent || '').trim() : null;
  }

  function tickBar() {
    const name = activeChat();
    segChat.textContent = name ? `1:${name}*` : '1:-';
    const m = /^\((\d+)\)/.exec(document.title);
    segUnread.textContent = m ? `${m[1]} unread` : '';
    segUnread.className = 'dz-seg' + (m ? ' dz-unread' : '');
    const on = navigator.onLine;
    segNet.textContent = on ? '\u25cf online' : '\u25cb offline';
    segNet.className = 'dz-seg ' + (on ? 'dz-ok' : 'dz-bad');
    segClock.textContent = new Date().toTimeString().slice(0, 8);
  }

  /* ---------------- composer ---------------- */
  const composer = () => document.querySelector('footer [contenteditable="true"]');
  const getText = () => {
    const c = composer();
    return c ? c.innerText.replace(/\n+$/, '') : '';
  };

  function setComposer(text, replace = true) {
    const c = composer();
    if (!c) {
      toast('open a chat first');
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
    return true;
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

  function wrapCode() {
    transform((t) => {
      const m = t.match(/^```\n?([\s\S]*?)\n?```$/);
      return m ? m[1] : '```\n' + t + '\n```';
    });
  }
  const inlineCode = () => transform((t) => '`' + t + '`');
  const prettyJson = () =>
    transform((t) => '```\n' + JSON.stringify(JSON.parse(t.trim()), null, 2) + '\n```');

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

  /* ---------------- chat helpers ---------------- */
  function chatRows() {
    const seen = new Set();
    const out = [];
    document
      .querySelectorAll('#pane-side [role="row"], #pane-side [role="listitem"]')
      .forEach((row) => {
        const t = row.querySelector('span[title]');
        const title = t && t.getAttribute('title');
        if (title && !seen.has(title)) {
          seen.add(title);
          out.push({ title, el: t });
        }
      });
    return out;
  }

  function copyChat() {
    const nodes = [...document.querySelectorAll('#main [data-pre-plain-text]')];
    if (!nodes.length) return toast('no messages found in this chat');
    const md = nodes
      .map((n) => {
        const m = (n.getAttribute('data-pre-plain-text') || '').match(/^\[(.*?)\]\s*(.*?):\s*$/);
        const when = m ? m[1] : '';
        const who = m ? m[2] : '?';
        return `**${who}** \`${when}\`\n${n.innerText.trim()}\n`;
      })
      .join('\n');
    copy(md);
    toast(`copied ${nodes.length} messages as markdown`);
  }

  function focusSearch() {
    const s = document.querySelector('#side [contenteditable="true"]');
    if (s) s.focus();
    else toast('search box not found');
  }

  /* ---------------- command palette ---------------- */
  const pal = { el: null, input: null, list: null, items: [], shown: [], sel: 0 };

  function commands() {
    const out = [];
    const add = (kind, label, run, hint = '') => out.push({ kind, label, run, hint });
    add('composer', 'wrap in code block', wrapCode, 'alt+c');
    add('composer', 'prettify json to code block', prettyJson, 'alt+j');
    add('composer', 'wrap in inline code', inlineCode);
    add('composer', 'base64 encode', () => transform(b64e));
    add('composer', 'base64 decode', () => transform(b64d));
    add('composer', 'url encode', () => transform(encodeURIComponent));
    add('composer', 'url decode', () => transform(decodeURIComponent));
    add('insert', 'uuid v4', () => setComposer(crypto.randomUUID(), false));
    add('insert', 'unix timestamp', () => setComposer(String(Math.floor(Date.now() / 1000)), false));
    add('insert', 'iso timestamp', () => setComposer(new Date().toISOString(), false));
    add('chat', 'copy visible messages as markdown', copyChat);
    add('chat', 'search chats', focusSearch);
    [
      ['stealth', 'blur chats until hover', 'alt+b'],
      ['autoHide', 'blur when tab loses focus', ''],
      ['scanlines', 'crt scanlines', ''],
      ['statusBar', 'status bar', ''],
      ['codeTools', 'code colors + click to copy', ''],
      ['theme', 'terminal theme', '']
    ].forEach(([k, label, hint]) => add('toggle', label, () => flip(k), hint));
    Object.entries(ACCENTS).forEach(([n, c]) => add('accent', n, () => save({ accent: c }), c));
    Object.entries(parseSnippets()).forEach(([n, body]) =>
      add('snippet', ';' + n, () => setComposer(body, false), body.replace(/\n/g, ' ').slice(0, 36))
    );
    chatRows().forEach((r) => add('open', r.title, () => realClick(r.el)));
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
    let res = pal.items.map((i) => ({ i, s: q ? fuzzy(q, i.kind + ' ' + i.label) : 0 })).filter((x) => x.s >= 0);
    if (q) res.sort((a, b) => b.s - a.s);
    pal.shown = res.slice(0, 10).map((x) => x.i);
    pal.sel = Math.min(pal.sel, Math.max(pal.shown.length - 1, 0));
    const rows = pal.shown.map((it, idx) => {
      const row = h(
        'div',
        { class: 'dz-row' + (idx === pal.sel ? ' sel' : '') },
        h('span', { class: 'dz-k', text: it.kind }),
        h('span', { class: 'dz-l', text: it.label }),
        h('span', { class: 'dz-hint', text: it.hint || '' })
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
    if (!rows.length) rows.push(h('div', { class: 'dz-empty', text: 'no match. try "json", "uuid" or a chat name' }));
    pal.list.replaceChildren(...rows);
  }

  function buildPalette() {
    pal.input = h('input', { type: 'text', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'command' });
    pal.list = h('div', { role: 'listbox' });
    pal.el = h(
      'div',
      { id: 'dz-pal' },
      h(
        'div',
        { class: 'dz-box' },
        h('div', { class: 'dz-in' }, h('span', { class: 'dz-ps', text: '>' }), pal.input),
        pal.list
      )
    );
    pal.el.addEventListener('mousedown', (e) => {
      if (e.target === pal.el) closePalette();
    });
    pal.input.addEventListener('input', () => {
      pal.sel = 0;
      renderPalette();
    });
    pal.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
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

  /* ---------------- code highlighting (CSS Custom Highlight API: no DOM edits) ---------------- */
  const HL_TYPES = ['kw', 'str', 'num', 'com', 'fn', 'ty'];
  const hl = {};
  try {
    if (window.CSS && CSS.highlights && typeof Highlight === 'function') {
      HL_TYPES.forEach((t) => {
        hl[t] = new Highlight();
        CSS.highlights.set('dz-' + t, hl[t]);
      });
    }
  } catch (_) { /* unsupported, highlighting stays off */ }

  const KW = new Set(
    ('abstract and as assert async await break case catch class const continue def default del do echo elif else elseif ' +
      'enum except export extends false final finally fn for foreach from fun function global if implements import in ' +
      'instanceof interface is lambda let match namespace new nil none not null object of or override pass private ' +
      'protected public raise return select self static struct super switch this throw trait true try type use val var ' +
      'void when where while with yield insert update delete create table join on group by order limit set values into ' +
      'echo exit fi then done').split(' ')
  );

  const TOKEN_RE =
    /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|--\s[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|(\b0x[\da-f]+\b|\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)/gi;

  function tokenize(src, emit) {
    TOKEN_RE.lastIndex = 0;
    let m;
    while ((m = TOKEN_RE.exec(src))) {
      const s = m.index;
      const e = s + m[0].length;
      if (m[1]) emit('com', s, e);
      else if (m[2]) emit('str', s, e);
      else if (m[3]) emit('num', s, e);
      else if (m[4]) emit(KW.has(m[4].toLowerCase()) ? 'kw' : 'fn', s, e);
      else if (m[5]) {
        if (KW.has(m[5].toLowerCase())) emit('kw', s, e);
        else if (/^[A-Z]/.test(m[5])) emit('ty', s, e);
      }
    }
  }

  function locate(nodes, pos, isEnd) {
    for (const x of nodes) {
      const len = x.n.nodeValue.length;
      if (isEnd ? pos > x.start && pos <= x.start + len : pos >= x.start && pos < x.start + len) return x;
    }
    return nodes[nodes.length - 1];
  }

  function rehighlight() {
    if (!hl.kw) return;
    HL_TYPES.forEach((t) => hl[t].clear());
    if (!cfg.codeTools) return;
    document.querySelectorAll('#main code').forEach((code) => {
      const nodes = [];
      let full = '';
      const w = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        nodes.push({ n, start: full.length });
        full += n.nodeValue;
      }
      if (!nodes.length || !full.trim()) return;
      tokenize(full, (type, s, e) => {
        const a = locate(nodes, s, false);
        const b = locate(nodes, e, true);
        const r = document.createRange();
        r.setStart(a.n, Math.min(s - a.start, a.n.nodeValue.length));
        r.setEnd(b.n, Math.min(e - b.start, b.n.nodeValue.length));
        hl[type].add(r);
      });
    });
  }

  /* tag the real bubble element of each message so CSS can square it off */
  function tagBubbles() {
    document
      .querySelectorAll('#main .message-in:not([data-dz]), #main .message-out:not([data-dz])')
      .forEach((m) => {
        m.setAttribute('data-dz', '1');
        const w = document.createTreeWalker(m, NodeFilter.SHOW_ELEMENT);
        let n;
        let guard = 0;
        while ((n = w.nextNode()) && guard++ < 14) {
          const cs = getComputedStyle(n);
          if (parseFloat(cs.borderTopLeftRadius) > 2 && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
            n.setAttribute('data-dz-bubble', '');
            break;
          }
        }
      });
  }

  /* ---------------- events ---------------- */
  window.addEventListener(
    'keydown',
    (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.code;
      if (mod && !e.shiftKey && !e.altKey && k === 'KeyK') {
        e.preventDefault();
        e.stopPropagation();
        paletteOpen() ? closePalette() : openPalette();
      } else if (e.altKey && !mod && !e.shiftKey && k === 'KeyC') {
        e.preventDefault();
        wrapCode();
      } else if (e.altKey && !mod && !e.shiftKey && k === 'KeyJ') {
        e.preventDefault();
        prettyJson();
      } else if (e.altKey && !mod && !e.shiftKey && k === 'KeyB') {
        e.preventDefault();
        flip('stealth');
      } else if (k === 'Tab' && !e.shiftKey && !mod && !e.altKey) {
        expandSnippet(e);
      }
    },
    true
  );

  document.addEventListener(
    'click',
    (e) => {
      if (!cfg.codeTools || !e.target.closest) return;
      const code = e.target.closest('#main code');
      if (!code) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      copy(code.textContent);
      toast(`copied ${code.textContent.length} chars`);
    },
    true
  );

  window.addEventListener('blur', () => cfg.autoHide && root.classList.add('dz-away'));
  window.addEventListener('focus', () => root.classList.remove('dz-away'));

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const [k, v] of Object.entries(changes)) cfg[k] = v.newValue;
    apply();
  });

  /* ---------------- boot ---------------- */
  chrome.storage.sync.get(D, (stored) => {
    cfg = { ...D, ...stored };
    document.body.append(bar);
    apply();
    tickBar();
    setInterval(tickBar, 1000);

    let timer = 0;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        tagBubbles();
        rehighlight();
      }, 250);
    };
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    schedule();
    toast('wa-dev loaded. ctrl+k for commands');
  });
})();
